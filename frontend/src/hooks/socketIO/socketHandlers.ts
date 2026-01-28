import { useEffect, useRef, useContext } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { notifyGlobalError } from '../useErrorsMan';
import { globalContext } from '../../contexts/globalContext';
import { createChatsHandlers } from './chatsHandlers';
import { createAlertsHandlers } from './alertsHandlers';
import { getSocketTransport, SOCKET_STATES } from './transport';

// ============================================================================
// MODULE STATE - Shared across all hook instances
// ============================================================================
// Steps: keep listener identity stable across hook remounts so we don’t register duplicate socket.on handlers on every React render cycle.
const alertListeners = {
	socket: null,
	handlers: null,
	deps: { brain: null, setAlertsData: null, setNotifDots: null, showToast: null, setMenuView: null, navigate: null, isDisposed: () => false },
};

const chatListeners = {
	socket: null,
	handlers: null,
	chatsRef: null, // STORED GLOBALLY TO SURVIVE COMPONENT REMOUNTS ---------------------------
	depsRef: null,
	isDisposed: () => false,
};

// ============================================================================
// HOOK
// ============================================================================
/** ----------------------------------------------------------------------------
 * USE SOCKET IO HOOK
 * Main entry point for Socket.IO integration.
 * Manages socket connection, event listeners, and dispatches events to handlers.
 * Maintains singleton state for listeners to prevent duplicates.
 * -------------------------------------------------------------------------- */
function useSocketIO({ brain, thisIs, setChats, chats, setNotifDots, processChatMembers = () => {}, man, run, setMenuView, setAlertsData, showToast, bottomScroll, setScrollDir }: any) {
	const transport = getSocketTransport();
	const navigate = useNavigate();
	const { logOut } = useContext(globalContext);

	const disposedRef = useRef(false);

	// USE GLOBAL CHATSREF TO SURVIVE COMPONENT REMOUNTS ---------------------------
	// Steps: store chatsRef outside React instance so async socket handlers always find the latest chat list even after component remount.
	if (!chatListeners.chatsRef) chatListeners.chatsRef = { current: [] };
	const chatsRef = chatListeners.chatsRef;

	// KEEP CHATS REF UPDATED - NOW UPDATES GLOBAL REF ---------------------------
	// Steps: update the global ref on every chats change so handlers can read current state without stale closures.
	useEffect(() => {
		chatListeners.chatsRef.current = chats;
	}, [chats]);

	// Main socket effect
	useEffect(() => {
		// CONNECT/DISCONNECT GATE ---------------------------------------------
		// Steps: disconnect when user is missing (logged out) or unintroduced, otherwise ensure transport is connected and attach listeners exactly once per socket instance.
		if (!brain?.user?.id || brain?.user?.isUnintroduced) {
			transport.disconnect();
			return;
		}

		disposedRef.current = false;

		const setupListeners = async () => {
			if (disposedRef.current) return;

			try {
				const socket = await transport.ensureReady();
				if (disposedRef.current || !socket) return;

				if (thisIs === 'chats' && chatListeners.socket !== socket) {
					// CHAT LISTENERS REBIND ---------------------------------------
					// Steps: remove old listeners (if socket changed), build fresh handlers over stable refs, then reattach so we never double-handle events.
					// Remove old listeners if they exist
					if (chatListeners.socket && chatListeners.handlers) {
						const old = chatListeners.socket;
						const h = chatListeners.handlers;
						old.off('message', h.processMessage);
						old.off('newChat', h.handleNewChat);
						old.off('chatChanged', h.handleChatChanged);
						old.off('punishment', h.handleChatPunishment);
						old.off('messSeen', h.handleMessageSeen);
						old.off('blocking', h.handleBlocking);
						old.off('reenterChat', h.reenterChat);
						old.off('membersChanged', h.handleMembersChangedEvent);
						old.off('chatEnded', h.handleChatEndedEvent);
						old.off('roomsRejoined', h.handleRoomsRejoinedEvent);
						old.off('userLeft', h.handleUserLeft);
					}

					// STORE FUNCTION REFS FOR SOCKET HANDLERS ---------------------------
					// Steps: put callbacks into depsRef so handlers can call latest run/man/processChatMembers without capturing old versions.
					chatListeners.depsRef = { run, man, processChatMembers };
					// MOUNT CHECK REFERENCE ------------------------------------------------
					// Steps: store reference to disposedRef so handlers can check mount state before updating.
					chatListeners.isDisposed = () => disposedRef.current;

					// MOUNT-SAFE STATE SETTERS ---------------------------------------------
					// Steps: wrap state setters to check isDisposed before calling to prevent updates on unmounted components.
					const safeSetChats = (...args) => !chatListeners.isDisposed() && setChats?.(...args);
					const safeSetNotifDots = (...args) => !chatListeners.isDisposed() && setNotifDots?.(...args);
					const safeSetMenuView = (...args) => !chatListeners.isDisposed() && setMenuView?.(...args);
					const safeSetScrollDir = (...args) => !chatListeners.isDisposed() && setScrollDir?.(...args);

					const handlers = createChatsHandlers({
						brain, // menuView is on brain.menuView ---------------------------
						chatsRef,
						setChats: safeSetChats,
						setNotifDots: safeSetNotifDots,
						depsRef: chatListeners.depsRef, // ACCESS AS depsRef.run(), depsRef.man() ---------------------------
						showToast,
						setMenuView: safeSetMenuView,
						setScrollDir: safeSetScrollDir,
						getTargetChat: id => chatsRef.current.find(c => Number(c.id) === Number(id)),
						bottomScroll,
					} as any);

					socket.on('message', handlers.processMessage);
					socket.on('newChat', handlers.handleNewChat);
					socket.on('chatChanged', handlers.handleChatChanged);
					socket.on('punishment', handlers.handleChatPunishment);
					socket.on('messSeen', handlers.handleMessageSeen);
					socket.on('blocking', handlers.handleBlocking);
					socket.on('reenterChat', handlers.reenterChat);
					socket.on('membersChanged', handlers.handleMembersChangedEvent);
					socket.on('chatEnded', handlers.handleChatEndedEvent);
					socket.on('roomsRejoined', handlers.handleRoomsRejoinedEvent);
					socket.on('userLeft', handlers.handleUserLeft);

					chatListeners.socket = socket;
					chatListeners.handlers = handlers;
				}

				// Attach alert listeners (only once per socket)
				if (setNotifDots && brain && alertListeners.socket !== socket) {
					// ALERT LISTENERS REBIND --------------------------------------
					// Steps: remove previous alert listeners, then create handler facade that reads deps lazily so we avoid stale brain/setters.
					// Remove old listeners
					if (alertListeners.socket && alertListeners.handlers) {
						const old = alertListeners.socket;
						const h = alertListeners.handlers;
						old.off('user', h.handleUserEvent);
						old.off('link', h.onLink);
						old.off('accept', h.onAccept);
						old.off('refuse', h.onRefuse);
						old.off('cancel', h.onCancel);
						old.off('unlink', h.onUnlink);
						old.off('trust', h.onTrust);
						old.off('untrust', h.onUntrust);
						old.off('block', h.onBlock);
						old.off('unblock', h.onUnblock);
						old.off('eve_rating', h.onEveRating);
						old.off('user_rating', h.onUserRating);
						old.off('comm_rating', h.onCommRating);
						old.off('interest', h.onInterest);
						old.off('comment', h.onComment);
						old.off('reply', h.onReply);
						old.off('invite', h.onInvite);
					}

					// Update deps
					// MOUNT CHECK REFERENCE ------------------------------------------------
					// Steps: store reference to disposedRef so handlers can check mount state before updating.
					Object.assign(alertListeners.deps, { brain, setAlertsData, setNotifDots, showToast, setMenuView, navigate, isDisposed: () => disposedRef.current });

					// Create handlers with proxy to always get current deps
					// Steps: proxy getters allow handler functions to always see latest brain/setters without re-registering listeners each render.
					// MOUNT-SAFE STATE SETTERS ---------------------------------------------
					// Steps: wrap state setters to check isDisposed before calling to prevent updates on unmounted components.
					const deps = {
						get brain() {
							return alertListeners.deps.brain;
						},
						get setAlertsData() {
							const setter = alertListeners.deps.setAlertsData;
							return (...args) => !alertListeners.deps.isDisposed() && setter?.(...args);
						},
						get setNotifDots() {
							const setter = alertListeners.deps.setNotifDots;
							return (...args) => !alertListeners.deps.isDisposed() && setter?.(...args);
						},
						get showToast() {
							return alertListeners.deps.showToast;
						},
						get setMenuView() {
							const setter = alertListeners.deps.setMenuView;
							return (...args) => !alertListeners.deps.isDisposed() && setter?.(...args);
						},
						get navigate() {
							return alertListeners.deps.navigate;
						},
					};
					const ah = createAlertsHandlers(deps);

					const handlers = {
						handleUserEvent: ah.handleUserEvent,
						onLink: e => ah.handleLinksAndBlocksAlert('link', e),
						onAccept: e => ah.handleLinksAndBlocksAlert('accept', e),
						onRefuse: e => ah.handleLinksAndBlocksAlert('refuse', e),
						onCancel: e => ah.handleLinksAndBlocksAlert('cancel', e),
						onUnlink: e => ah.handleLinksAndBlocksAlert('unlink', e),
						onTrust: e => ah.handleLinksAndBlocksAlert('trust', e),
						onUntrust: e => ah.handleLinksAndBlocksAlert('untrust', e),
						onBlock: e => ah.handleLinksAndBlocksAlert('block', e),
						onUnblock: e => ah.handleLinksAndBlocksAlert('unblock', e),
						onEveRating: e => ah.handleRatingAlert('eve_rating', e),
						onUserRating: e => ah.handleRatingAlert('user_rating', e),
						onCommRating: e => ah.handleRatingAlert('comm_rating', e),
						onInterest: e => ah.handleInterestAlert('interest', e),
						onComment: e => ah.handleCommentsAlert('comment', e),
						onReply: e => ah.handleCommentsAlert('reply', e),
						onInvite: e => ah.handleInviteAlert('invite', e),
					};

					// Attach
					socket.on('user', handlers.handleUserEvent);
					socket.on('link', handlers.onLink);
					socket.on('accept', handlers.onAccept);
					socket.on('refuse', handlers.onRefuse);
					socket.on('cancel', handlers.onCancel);
					socket.on('unlink', handlers.onUnlink);
					socket.on('trust', handlers.onTrust);
					socket.on('untrust', handlers.onUntrust);
					socket.on('block', handlers.onBlock);
					socket.on('unblock', handlers.onUnblock);
					socket.on('eve_rating', handlers.onEveRating);
					socket.on('user_rating', handlers.onUserRating);
					socket.on('comm_rating', handlers.onCommRating);
					socket.on('interest', handlers.onInterest);
					socket.on('comment', handlers.onComment);
					socket.on('reply', handlers.onReply);
					socket.on('invite', handlers.onInvite);

					alertListeners.socket = socket;
					alertListeners.handlers = handlers;
				} else if (setNotifDots && brain) {
					// Just update deps for existing listeners
					Object.assign(alertListeners.deps, { brain, setAlertsData, setNotifDots, showToast, setMenuView, navigate, isDisposed: () => disposedRef.current });
				}

				// UPDATE CHAT DEPS REF IF EXISTS ---------------------------
				if (chatListeners.depsRef) {
					Object.assign(chatListeners.depsRef, { run, man, processChatMembers });
				}
			} catch (err) {
				if (!disposedRef.current) {
					console.error('[socket] setup failed:', err);
				}
			}
		};

		// Handle state changes
		// Steps: wait for transport READY before attaching listeners so we don’t attach to a half-authenticated socket.
		const unsubscribe = transport.onState(({ state, meta }) => {
			if (disposedRef.current) return;
			if (state === SOCKET_STATES.READY) {
				setupListeners();
			}
		});

		// Initial connection
		transport
			.connect()
			.then(setupListeners)
			.catch(err => {
				if (!disposedRef.current) {
					console.error('[socket] initial connection failed:', err);
				}
			});

		return () => {
			disposedRef.current = true;
			unsubscribe?.();
		};
		// INTENTIONALLY MINIMAL DEPS ---
		// Steps: effect uses module-level refs (chatListeners.depsRef, alertListeners.deps) to access latest callbacks without stale closures.
		// Adding all callbacks as deps would cause excessive re-runs. The ref pattern ensures handlers always call current versions.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [brain?.user?.id, thisIs]);

	// Socket emit function
	// Steps: normalize high-level “mode” actions into the correct Socket.IO event and let transport handle refresh/ack/timeout; callers can fall back to axios on emitTimeout.
	const socket = async data => {
		const { mode, ...payload } = data || {};

		if (mode === 'connect') {
			return transport.connect();
		}

		if (mode === 'disconnect') {
			return transport.disconnect();
		}

		if (!mode) {
			console.warn('[socket] missing mode');
			return;
		}

		// MODE -> EVENT MAP ---------------------------------------------------
		// Steps: collapse related actions onto one server event (message/punishment/blocking) while keeping mode in payload for server dispatch.
		const eventMap = {
			postMessage: 'message',
			editMessage: 'message',
			deleteMessage: 'message',
			kick: 'punishment',
			ban: 'punishment',
			gag: 'punishment',
			unban: 'punishment',
			ungag: 'punishment',
			blockChat: 'blocking',
			unblockChat: 'blocking',
			messSeen: 'messSeen',
		};
		const event = eventMap[mode] || mode;

		try {
			return await transport.emit(event, { mode, ...payload });
		} catch (err) {
			const msg = err?.message || '';

			// Handle specific errors
			if (msg === 'rateLimited') {
				notifyGlobalError(err, 'Odesíláte příliš rychle.');
				throw err;
			}

			if (msg.includes('unauthorized')) {
				logOut();
				throw err;
			}

			// Timeouts and connection failures -> fallback to HTTP
			if (msg.includes('Timeout') || msg.includes('emitTimeout') || msg.includes('connectionTimeout') || msg.includes('noToken')) {
				throw new Error('fallbackToAxios');
			}

			throw err;
		}
	};

	return { socket };
}

export default useSocketIO;

export function disconnectSocketIO() {
	// GLOBAL DISCONNECT -------------------------------------------------------
	// Steps: disconnect transport and clear global chatsRef so next login/user starts with fresh handler state.
	try {
		getSocketTransport().disconnect();
		chatListeners.chatsRef = null; // CLEAR GLOBAL REF ON DISCONNECT ---------------------------
	} catch (_) {}
}
