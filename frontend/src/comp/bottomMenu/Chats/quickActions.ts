export function createQuickActions(props) {
	const { brain, thisChat, chats, curView, messages, messID, content, attach, run, openedChat, chatID, setOpenedChat, setCurView, getMembersObj } = props;

	return {
		messSeen: () => {
			// LOCAL SEEN UPDATE ------------------------------------------------
			// Steps: mark chat seen in memory immediately so UI clears dots, then set current user's member.seenId so remote seen markers converge when persisted/received.
			thisChat.seen = true;
			const currentUserMember = thisChat.members.find(m => m.id == brain.user.id);
			if (currentUserMember && messID) currentUserMember.seenId = messID;
		},
		hideChat: () => ((thisChat.hidden = true), openedChat === chatID && (delete brain.openedChat, setOpenedChat?.(null))),
		unhideChat: () => ((thisChat.hidden = false), run('unshift'), curView === 'hidden' && chats.filter(chat => chat.hidden === true).length === 0 && setCurView('chats')),
		leaveChat: () => {
			// LEAVE CHAT (LOCAL) ----------------------------------------------
			// Steps: mark joinedRoom false and set own member row to spect+del so UI treats the chat as left before backend confirms (optimistic UX).
			const memberObj = getMembersObj?.();
			thisChat.joinedRoom = false;
			if (memberObj) (memberObj.role = 'spect'), (memberObj.flag = 'del');
			return true;
		},
		archiveChat: () => {
			// ARCHIVE (LOCAL) --------------------------------------------------
			// Steps: mark archived and drop joinedRoom so real-time stops; also close openedChat so UI doesn't show archived thread as active.
			Object.assign(thisChat, { archived: true }), (thisChat.joinedRoom = false);
			delete brain.openedChat, setOpenedChat?.(null), setCurView?.('chats');
		},
		unarchiveChat: () => (Object.assign(thisChat, { archived: false }), run('unshift'), setCurView?.('chats')),
		muteChat: () => (thisChat.muted = true),
		unmuteChat: () => (thisChat.muted = false),
		blockChat: () => {
			// PRIVATE BLOCK (LOCAL) -------------------------------------------
			// Steps: apply punish=block and who=self to all members so UI can hide/restrict the thread even before backend response.
			if (thisChat.type !== 'private') return false;
			for (const member of thisChat.members || []) (member.who = brain.user.id), (member.punish = 'block');
			return true;
		},
		unblockChat: () => {
			// PRIVATE UNBLOCK (LOCAL) -----------------------------------------
			// Steps: remove punish/who only for rows that were blocked by self, preserving block markers that belong to the other party.
			if (thisChat.type !== 'private') return false;
			for (const member of thisChat.members || []) member.who == brain.user.id && ['punish', 'who'].forEach(key => delete member[key]);
			return true;
		},
		deleteMessage: () => {
			// MESSAGE SOFT DELETE (LOCAL) -------------------------------------
			// Steps: blank content/attach and set flag=del so message strip hides content immediately.
			const message = messages.find(msg => msg.id === messID);
			if (message) (message.content = null), (message.flag = 'del'), (message.attach = null);
		},
		editMessage: () => {
			// MESSAGE EDIT (LOCAL) --------------------------------------------
			// Steps: apply patch and mark edited so UI renders the update immediately.
			const message = messages.find(msg => msg.id == messID);
			if (message) Object.assign(message, { content, attach, edited: true });
		},
	};
}
