import { broadcastPunishment, manageUsersInChatRoom, broadcastBlocking, broadcastMembersChanged, endChat as endSocket } from '../../systems/socket/chatHandlers';
import { runChatTransaction } from '../chat';
import { getMembers, setRolesAndLasts } from './chatHelpers';

let redis;
export const ioRedisSetter = r => {
	redis = r;
};

const LAST_CLAUSE = `(COALESCE(last, (SELECT MAX(id) FROM messages WHERE chat = ?)))`;
const CLEAR_CLAUSE = `punish = NULL, mess = NULL, until = NULL, who = NULL, last = NULL`;

// TRANSACTION WRAPPER ------------------------------------
// Steps: run chat mutation under the shared chat transaction wrapper, require affectedRows, bump chat.changed so clients know membership/punishment state is stale.
async function runPunishTx(con, chatID, q, p) {
	return runChatTransaction(con, async () => {
		const [res] = await con.execute(q, p);
		if (!res.affectedRows) throw new Error('badRequest');
		await con.execute(`UPDATE chats SET changed = NOW() WHERE id = ?`, [chatID]);
		return res;
	});
}

// RE-ENTER CHAT ------------------------------------
// Steps: clear punish state when eligible, update roles/last pointers in caches, re-add user to active chat room sets, then broadcast member change and emit direct reenterChat event.
async function reenterChat({ chatID, userID, socket, con }) {
	const now = Date.now();
	await runPunishTx(
		con,
		chatID,
		`UPDATE chat_members SET role='member', flag='ok', ${CLEAR_CLAUSE} WHERE chat=? AND id=? AND (punish='kick' OR (punish IN ('gag', 'ban') AND until IS NOT NULL AND until < NOW()))`,
		[chatID, userID]
	);
	await setRolesAndLasts({ members: [{ id: userID, role: 'member', lastMessID: null }], chatID, setMembChange: now, addToMembers: true });
	await manageUsersInChatRoom({ chatID, userIDs: [userID], mode: 'add' });
	await broadcastMembersChanged({ socket, chatID, members: [{ id: userID, role: 'member', flag: 'ok', punish: null, until: null, mess: null, who: null }], allMembers: false, membSync: now });
	socket?.to(String(userID)).emit('reenterChat', { chatID, userID });
}

// BLOCK CHAT ------------------------------------
// Steps: resolve the “other” user for private chat, set punish=block once (who is blocker), end socket room for both, then broadcast blocking so UIs detach the thread.
async function blockChat({ chatID, userID, con, socket }) {
	let other = (await redis.smembers(`chatMembers:${chatID}`)).find(id => String(id) !== String(userID));
	if (!other) other = (await getMembers({ chatID, IDsOnly: true, con })).find(id => String(id) !== String(userID));
	if (!other) throw new Error('badRequest');

	const [res] = await con.execute(`UPDATE chat_members SET punish='block', who=? WHERE chat=? AND (SELECT type FROM chats WHERE id=?)='private' AND who IS NULL`, [userID, chatID, chatID]);
	if (!res.affectedRows) throw new Error('badRequest');
	await endSocket({ chatID, memberIDs: [userID, other], skipChatEndedEmit: true });
	broadcastBlocking({ socket, chatID, mode: 'block', who: userID, targetUserID: other });
}

// UNBLOCK CHAT ------------------------------------
// Steps: clear block state for this blocker, re-add both users to active sets, then broadcast unblock so UIs can re-surface the thread.
async function unblockChat({ chatID, userID, socket, con }) {
	const other = (await getMembers({ chatID, IDsOnly: true, con })).find(id => String(id) !== String(userID));
	if (!other) throw new Error('badRequest');

	const [res] = await con.execute(`UPDATE chat_members SET punish=NULL, who=NULL WHERE chat=? AND who=? AND punish='block'`, [chatID, userID]);
	if (!res.affectedRows) throw new Error('badRequest');
	await manageUsersInChatRoom({ chatID, userIDs: [userID, other], mode: 'add' }); // Re-add both users on unblock
	broadcastBlocking({ chatID, mode: 'unblock', socket, who: userID, targetUserID: other });
}

// ARCHIVE CHAT ------------------------------------
// Steps: set archived flag in SQL, then remove chat from active sets and member caches so it disappears from primary chat list without deleting membership.
async function archiveChat({ chatID, userID, con }) {
	await runChatTransaction(con, async () => {
		if (!(await con.execute(`UPDATE chat_members SET archived=1 WHERE chat=? AND id=?`, [chatID, userID]))[0].affectedRows) throw new Error('badRequest');
	});
	// Remove from userActiveChats on archive
	await manageUsersInChatRoom({ chatID, userIDs: [userID], mode: 'rem', skipChatLeftUsers: true });
	await setRolesAndLasts({ memberIDs: [userID], chatID, delFromMembers: true, skipRolesUpdate: true, setMembChange: true });
}

// UNARCHIVE CHAT ------------------------------------
// Steps: clear archived flag + bump changed timestamps, clear archive dot in user summary, re-add chat to active sets and member caches so it reappears in chat list.
async function unarchiveChat({ chatID, userID, con, redis: r }) {
	await runChatTransaction(con, async () => {
		if (!(await con.execute(`UPDATE chat_members SET archived=0, changed=NOW() WHERE chat=? AND id=?`, [chatID, userID]))[0].affectedRows) throw new Error('badRequest');
		await con.execute(`UPDATE chats SET changed=NOW() WHERE id=?`, [chatID]);
	});
	await (r || redis).hset(`userSummary:${userID}`, 'archive', 0);
	// Add to userActiveChats on unarchive
	await manageUsersInChatRoom({ chatID, userIDs: [userID], mode: 'add' });
	await setRolesAndLasts({ memberIDs: [userID], chatID, setMembChange: true, addToMembers: true, skipRolesUpdate: true });
}

// GAG ------------------------------------
// Steps: set punish=gag with until+mess, bump member role in caches, then broadcast punishment so clients enforce read-only locally.
async function gag({ chatID, targetUserID: tID, userID, mess, until, con, socket }) {
	if (!tID) throw new Error('badRequest');
	await runPunishTx(con, chatID, `UPDATE chat_members SET punish='gag', until=?, who=?, changed=NOW(), mess=? WHERE chat=? AND id=? AND role IN ('spect', 'member')`, [
		until,
		userID,
		mess,
		chatID,
		tID,
	]);
	const now = Date.now();
	await setRolesAndLasts({ chatID, members: [{ id: tID, role: 'gagged' }], setMembChange: now });
	broadcastPunishment({ chatID, socket, targetUserID: tID, how: 'gag', until, who: userID, mess, membSync: now });
}

// UNGAG ------------------------------------
// Steps: clear gag punish state, restore member role in caches, then broadcast punishment removal so clients re-enable input.
async function ungag({ chatID, targetUserID: tID, userID, con, socket }) {
	if (!tID) throw new Error('badRequest');
	await runPunishTx(con, chatID, `UPDATE chat_members SET role='member', ${CLEAR_CLAUSE}, changed=NOW() WHERE chat=? AND id=? AND punish='gag'`, [chatID, tID]);
	const now = Date.now();
	await setRolesAndLasts({ members: [{ id: tID, role: 'member', lastMessID: null }], chatID, setMembChange: now });
	broadcastPunishment({ chatID, socket, targetUserID: tID, how: 'ungag', who: userID, membSync: now });
}

// KICK ------------------------------------
// Steps: set punish=kick (keeps membership row for audit), then broadcast so clients drop the user from the room UI.
async function kick({ chatID, targetUserID: tID, userID, mess, con, socket }) {
	if (!tID) throw new Error('badRequest');
	const [res] = await con.execute(`UPDATE chat_members SET punish='kick', who=?, mess=?, until=NULL, last=NULL WHERE chat=? AND id=?`, [userID, mess, chatID, tID]);
	if (!res.affectedRows) throw new Error('badRequest');
	broadcastPunishment({ chatID, socket, targetUserID: tID, how: 'kick', who: userID, mess });
}

// BAN ------------------------------------
// Steps: transition target into spect role, set punish=ban with last pointer and until, update caches/active sets, then broadcast so clients enforce exclusion.
async function ban({ chatID, targetUserID: tID, userID, mess, until, con, socket }) {
	if (!tID || !until) throw new Error('badRequest');
	const { last } = await runChatTransaction(con, async () => {
		const [res] = await con.execute(
			`UPDATE chat_members SET role='spect', punish='ban', changed=NOW(), last=${LAST_CLAUSE}, until=?, who=?, mess=? WHERE id=? AND chat=? AND role IN ('spect', 'member')`,
			[chatID, until, userID, mess, tID, chatID]
		);
		if (!res.affectedRows) throw new Error('badRequest');
		await con.execute(`UPDATE chats SET changed=NOW() WHERE id=?`, [chatID]);
		return { last: (await con.execute(`SELECT last FROM chat_members WHERE chat=? AND id=?`, [chatID, tID]))[0][0]?.last };
	});
	const now = Date.now();
	await setRolesAndLasts({ chatID, members: [{ id: tID, role: 'spect', lastMessID: last }], setMembChange: now, delFromMembers: true });
	// Ban removes from userActiveChats
	await manageUsersInChatRoom({ chatID, userIDs: [tID], mode: 'rem', skipChatLeftUsers: true });
	broadcastPunishment({ chatID, socket, targetUserID: tID, how: 'ban', until, who: userID, mess, membSync: now });
}

// UNBAN ------------------------------------
// Steps: clear ban state under transaction, restore member role and caches, re-add to active sets, then broadcast so clients allow re-entry.
async function unban({ chatID, targetUserID: tID, userID, con, socket }) {
	if (!tID) throw new Error('badRequest');
	await runChatTransaction(con, async () => {
		if (!(await con.execute(`UPDATE chat_members SET role='member', ${CLEAR_CLAUSE}, changed=NOW() WHERE chat=? AND id=? AND punish='ban'`, [chatID, tID]))[0].affectedRows)
			throw new Error('badRequest');
		await con.execute(`UPDATE chats SET changed=NOW() WHERE id=?`, [chatID]);
	});
	const now = Date.now();
	await setRolesAndLasts({ chatID, members: [{ id: tID, role: 'member', lastMessID: null }], setMembChange: now, addToMembers: true });
	// Unban adds to userActiveChats
	await manageUsersInChatRoom({ chatID, userIDs: [tID], mode: 'add' });
	broadcastPunishment({ chatID, socket, targetUserID: tID, how: 'unban', who: userID, membSync: now });
}

// SIMPLE UPDATE HELPER------------------------------------
// Steps: generate a tiny handler that does one column update; used for mute/hide toggles to keep the dispatch table compact.
const simpleUpdate =
	(col, val) =>
	async ({ chatID, userID, con }) => {
		if (!(await con.execute(`UPDATE chat_members SET ${col}=? WHERE chat=? AND id=?`, [val, chatID, userID]))[0].affectedRows) throw new Error('badRequest');
	};

export const quickQueryHandlers = {
	reenterChat,
	blockChat,
	unblockChat,
	archiveChat,
	unarchiveChat,
	ban,
	unban,
	gag,
	ungag,
	kick,
	muteChat: simpleUpdate('muted', 1),
	unmuteChat: simpleUpdate('muted', 0),
	hideChat: simpleUpdate('hidden', 1),
	unhideChat: simpleUpdate('hidden', 0),
};
