import axios from 'axios';
import { createSubsetObj, fetchOwnProfile } from '../../../../helpers';

const setupModes = ['setType', 'groupName', 'firstMessage', 'setUserRole', 'selectUser'];

// CHAT SETUP STATE MACHINE -----------------------------------------------------
// Steps: handle setup lifecycle transitions (launch/reset) and per-step mutations (type/name/message/member selection/role toggles) by mutating brain.chatSetupData, then mirror into component state.
export async function handleChatSetupLogic({
	mode,
	brain,
	chatObj,
	chatID,
	id,
	setFoundSimilarChats,
	setChatSetupData,
	setCurView,
	run,
	processChatMembers,
	chatType,
	content,
	userObj,
	curView,
	setInformWithTimeout,
	foundSimilarChats,
}) {
	let nextMode = mode;

	if (nextMode === 'resetSetup') {
		// RESET --------------------------------------------------------------
		// Steps: preserve chatID for edit flows, clear setup state, clear similar chats, then fall through into launchSetup so UI is re-initialized in one call.
		chatID = brain.chatSetupData?.id || chatID; // PRESERVE CHAT ID BEFORE DELETING ---------------------------
		delete brain.chatSetupData, setFoundSimilarChats?.(null), (nextMode = 'launchSetup');
	}

	if (nextMode === 'launchSetup') {
		// LAUNCH -------------------------------------------------------------
		// Steps: if editing non-private chat and it isn't opened, fetch member list so setup has canonical membership; otherwise ensure self profile is available for “create” flow.
		const { type, opened } = chatObj.current;
		if (!chatID) !brain.user.first && (await fetchOwnProfile(brain));
		else if (!opened && type !== 'private') {
			const { members, membSync } = (await axios.post('chat', { mode: 'getMembers', chatID, membSync: chatObj.current?.membSync })).data || [];
			processChatMembers({ chatObj: chatObj.current, members, allMembers: true, membSync });
		}

		// INITIAL SETUP OBJECT ----------------------------------------------
		// Steps: build a stable member object shape (subset fields) and initialize chatSetupData either from existing chat (edit) or from self-only private stub (create).
		const createMemberObj = member => Object.assign(createSubsetObj(member, ['id', 'first', 'last', 'imgVers']), { role: 'member', flag: 'ok' });
		brain.chatSetupData = chatID
			? { ...chatObj.current, members: JSON.parse(JSON.stringify(chatObj.current.members)).filter(m => m.flag !== 'del' && m.punish !== 'kick') }
			: { type: 'private', members: [brain.user].map(createMemberObj) }; // FILTER OUT DELETED/KICKED MEMBERS ON SETUP LAUNCH ---------------------------

		if (brain.newPrivateChat) {
			// PREFILL PRIVATE CHAT --------------------------------------------
			// Steps: when user initiated “new private chat” from elsewhere, inject the target member + preset message, then clear the one-shot flag.
			const { otherMember, content: presetContent } = brain.newPrivateChat;
			Object.assign(brain.chatSetupData, { members: [brain.user, otherMember].map(createMemberObj), content: presetContent });
			delete brain.newPrivateChat;
		}

		setChatSetupData(brain.chatSetupData), setCurView('chatSetup');
		return { handled: true, mode: nextMode };
	}

	if (curView === 'chatSetup' && setupModes.includes(nextMode)) {
		// STEP MUTATIONS -----------------------------------------------------
		// Steps: mutate chatSetupData in place based on mode, clear similar chats when user changes membership/type, then push updated object into component state.
		const originalMembers = chatObj.current.members;
		const { members } = brain.chatSetupData;

		if (nextMode === 'setType') {
			// TYPE SWITCH ------------------------------------------------------
			// Steps: update chat type, then normalize roles to satisfy type invariants (private starts fresh, free demotes leaders, group demotes VIP to admin when needed).
			Object.assign(brain.chatSetupData, {
				type: chatType,
				members:
					chatType === 'private'
						? [Object.assign(createSubsetObj(brain.user, ['id', 'first', 'last', 'imgVers']), { role: 'member', flag: 'ok' })]
						: brain.chatSetupData.members.map(member => ({
								...member,
								role: member.role === 'spect' ? 'spect' : chatType === 'free' ? 'member' : chatType === 'group' && member.role === 'VIP' ? 'admin' : member.role,
						  })),
			});
		}

		if (nextMode === 'groupName') brain.chatSetupData.name = content;
		if (nextMode === 'firstMessage') brain.chatSetupData.content = typeof content === 'string' ? content.replace(/\s{2,}/g, ' ').trim() : '';

		if (nextMode === 'setUserRole') {
			// ROLE TOGGLE ------------------------------------------------------
			// Steps: toggle role for a single member; VIP is exclusive so first demote existing VIPs, then toggle target.
			const targetUserIndex = members.findIndex(user => user.id === id);
			if (targetUserIndex !== -1) {
				const targetUserObjRole = members[targetUserIndex].role;
				if (content !== 'VIP') members[targetUserIndex] = { ...members[targetUserIndex], role: targetUserObjRole === content ? 'member' : content };
				else {
					// First, demote existing VIPs to admin
					members.forEach((user, i) => {
						if (user.role === 'VIP') {
							members[i] = { ...user, role: 'admin' };
						}
					});
					// Then set the target user to VIP or member
					members[targetUserIndex] = { ...members[targetUserIndex], role: targetUserObjRole === 'VIP' ? 'member' : 'VIP' };
				}
			}
		}

		if (nextMode === 'selectUser') {
			// MEMBER SELECT/TOGGLE --------------------------------------------
			// Steps: prevent removing self, add new members when missing, remove newly-added members by toggling, and for existing chat members flip flag del/ok while preserving original role.
			if (userObj.id === brain.user.id) {
				setInformWithTimeout?.('selfDelete', 2000);
				return { handled: true, mode: nextMode };
			}

			const targetIdx = members.findIndex(user => user.id === userObj?.id);
			const isNewMember = !brain.chatSetupData.id || !originalMembers?.some(m => m.id === userObj.id);
			if (targetIdx === -1) members.push({ ...createSubsetObj(userObj, ['id', 'first', 'last', 'imgVers']), role: 'member', flag: 'ok' });
			else if (isNewMember) members.splice(targetIdx, 1);
			else {
				const targetMember = members[targetIdx];
				const wasDeleted = targetMember.flag === 'del';
				const role = !wasDeleted ? 'spect' : originalMembers.find(m => m.id === userObj.id).role;
				members[targetIdx] = { ...targetMember, flag: !wasDeleted ? 'del' : 'ok', role };
			}
		}

		if (foundSimilarChats) setFoundSimilarChats(null);
		setChatSetupData(brain.chatSetupData);
		return { handled: true, mode: nextMode };
	}

	return { handled: false, mode: nextMode };
}
