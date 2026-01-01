import { forage } from '../../helpers';

/** ----------------------------------------------------------------------------
 * USE COMMENTS MANAGER HOOK
 * Centralized logic for handling comment interactions: post, reply, edit, delete.
 * Also manages local state updates and clipboard operations.
 * -------------------------------------------------------------------------- */
export const useCommentsMan = () => {
	return async function man(inp) {
		const { mode, content, depth, comment, parent, superMan, setModes, brain, status, setStatus, eventID, setShowingMenuCommID } = inp;

		try {
			// SERVER ACTIONS ------------------------------------------------------
			// Steps: dispatch to superMan with the correct parent pointer (depth gates), then immediately update local UI modes so the user sees result without waiting for full refetch.
			if (mode === 'post') {
				await superMan({ mode: 'post', comment, parent: depth < 2 ? comment : parent, content, depth });
				setModes(prev => ({ ...prev, replies: true, textArea: false }));
			} else if (mode === 'getReplies') {
				await superMan({ mode: 'getReplies', comment, parent: depth < 2 ? comment : parent, depth });
				setModes(prev => ({ ...prev, replies: comment.repliesData?.length > 0 }));
			} else if (mode === 'edit') await superMan({ comment, content, mode, parent });
			else if (mode === 'delete') {
				await superMan({ mode: 'delete', comment, parent, depth });
				setModes(prev => ({ ...prev, menu: !prev.menu }));
			}
			
			// LOCAL SYNC ----------------------------------------------------------
			// Steps: after mutations that change commsData, persist only the comms payload to forage so event page reloads stay consistent without re-fetch.
			if (['getReplies', 'edit', 'post'].includes(mode)) {
				const eventData = brain.events[eventID];
				if (eventData) await forage({ mode: 'set', what: `comms`, id: eventID, val: ['commsData', 'commsSyncedAt', 'cursors'].reduce((acc, key) => ({ ...acc, [key]: eventData[key] ?? null }), {}) });
			}

			// QUICK ACTIONS -------------------------------------------------------
			// Steps: update local UI flags for cheap actions (toggle/copy/menu/reply/edit/protocol) without touching network state.
			if (mode === 'toggleReplies')
				setModes(prev => ({
					...prev,
					replies: !prev.replies,
					// Close comment menu when collapsing replies via "Sbalit"
					menu: false,
				}));
			if (mode === 'copy') {
				if (status.copied === true) setStatus(prev => ({ ...prev, copied: 'status' }));
				else setStatus(prev => ({ ...prev, copied: true }));
				const formattedData = `Komentář: ${comment.content}`;
				navigator.clipboard.writeText(formattedData);
			}

			// COMMENT MODES -------------------------------------------------------
			// Steps: drive the view-state machine for the comment strip UI; always close conflicting panels when opening a new one so state remains mutually exclusive.
			if (mode === 'rating') setModes(prev => ({ ...prev, actions: !prev.actions, menu: false, protocol: false, textArea: false }));
			if (mode === 'menu')
				setModes(prev => ({ ...prev, menu: !prev.menu, actions: false, textArea: false })),
					setStatus(prev => ({ ...prev, copied: false })),
					setShowingMenuCommID(prev => (prev === comment.id ? null : comment.id));
			if (mode === 'reply') setModes(prev => ({ ...prev, textArea: !prev.textArea ? 'reply' : false, actions: false, protocol: false, menu: false }));
			if (mode === 'showEdit') setModes(prev => ({ ...prev, textArea: !prev.textArea ? 'edit' : false, menu: false }));
			if (mode === 'protocol') setModes(prev => ({ ...prev, protocol: !prev.protocol }));
		} catch (err) {
			console.error('useCommentsMan error:', err);
		}
	};
};
