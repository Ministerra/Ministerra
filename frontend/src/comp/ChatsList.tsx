// CHATS LIST INTERFACE ---
// Renders lists of chats filtered by status (active, inactive, hidden, archived) with infinite scrolling.
import { useEffect, useRef, useState, memo, useMemo } from 'react';
import { EmptyDiv } from './EmptyDiv';
import Search from './bottomMenu/Search';
import ChatStrip from './contentStrips/ChatStrip';
import ChatsListMenuStrip from './menuStrips/ChatsListMenuStrip';

// CHATS LIST COMPONENT ---
// Manages the display and navigation of chat collections.
function ChatsList(props) {
	const { curView, scrollDir, chats, modes, chatMan, brain, setModes, inform, setCurView, openedChat, chatsListRef, notifDots, getPunishmentStatus } = props;

	// REFS AND STATE ---
	const infinityChatsTriggerRef = useRef(null),
		stripsWrapperRef = useRef(null),
		[stripMenuId, setStripMenuId] = useState(null),
		[highlightChatId, setHighlightChatId] = useState(null),
		highlightClearTimerRef = useRef(null),
		infiniteInFlightRef = useRef(false);

	// CHAT HIGHLIGHTING LOGIC ---
	// Automatically scrolls to and highlights a specific chat based on brain trigger.
	useEffect(() => {
		if (!brain.highlightChatId || brain.highlightChatId === highlightChatId) return;
		setHighlightChatId(brain.highlightChatId), stripsWrapperRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
		if (highlightClearTimerRef.current) clearTimeout(highlightClearTimerRef.current);
		highlightClearTimerRef.current = setTimeout(() => setHighlightChatId(null), 3000);
		return () => clearTimeout(highlightClearTimerRef.current);
	}, [brain.highlightChatId, highlightChatId]);

	// INFINITE SCROLL OBSERVER ---
	// Fetches more chats when the bottom of the list is reached.
	useEffect(() => {
		infiniteInFlightRef.current = false;
		const listRoot = chatsListRef?.current?.querySelector('strips-wrapper') || chatsListRef?.current;
		const infiniteObserver = new IntersectionObserver(
			entries =>
				entries.forEach(entry => {
					if (entry.isIntersecting && chats.length >= 20 && !brain.user.noMore?.chats?.[curView]) {
						if (infiniteInFlightRef.current) return;
						(infiniteInFlightRef.current = true),
							chatMan({ mode: curView === 'chats' ? 'getChats' : curView === 'inactive' ? 'getInactiveChats' : curView === 'hidden' ? 'getHiddenChats' : 'getArchivedChats' });
						setTimeout(() => (infiniteInFlightRef.current = false), 750);
					}
				}),
			{ root: listRoot || null, rootMargin: '0px', threshold: 0 }
		);
		if (infinityChatsTriggerRef.current) infiniteObserver.observe(infinityChatsTriggerRef.current);
		return () => infiniteObserver.disconnect();
	}, [chats.length, curView, chatsListRef]);

	// CHAT FILTERING ---
	// Groups chats based on visibility and status flags for the current view.
	const filteredChatsToShow = useMemo(
		() =>
			chats.filter(chat => {
				const memberFlag = chat.members?.find(m => String(m.id) === String(brain.user.id))?.flag;
				return curView === 'chats'
					? !chat.archived && ['ok', 'req'].includes(memberFlag) && (!chat.hidden || !chat.seen)
					: curView === 'inactive'
					? memberFlag === 'del' || chat.ended
					: curView === 'hidden'
					? chat.hidden
					: chat.archived;
			}),
		[chats, curView]
	);

	return (
		<chat-list ref={chatsListRef} class={`flexCol miw28 ${openedChat ? 'w30 mw60' : 'w100'} grow grow h100 mhvh100 mihvh100 ${!openedChat ? 'bInsetBlueDark' : 'bInsetBlueXs'} posRel`}>
			<content-wrapper style={{ transform: 'scaleX(1)' }} class={`${modes.searchChats ? 'justEnd flexCol' : 'mw120'} hvh100 padLeftXxs mihvh100 marAuto overHidden w100 mhvh100 `}>
				<empty-div class={`block hr5-5`} />

				{/* LIST TITLE --- */}
				{!modes.searchChats && (
					<title-wrapper>
						<span
							className={`${
								curView === 'chats' && !filteredChatsToShow.length ? 'fs25 marBotXxs' : openedChat ? 'fs17 marBotXxs' : 'fs25 marBotXs'
							} xBold marAuto inlineBlock w100 padBotXxs textAli textSha`}>
							{curView === 'chats' ? 'Poslední chaty' : curView === 'inactive' ? 'Neaktivní chaty' : curView === 'hidden' ? 'Skryté chaty' : 'Archivované chaty'}
						</span>
					</title-wrapper>
				)}

				{/* CHAT STRIPS LISTING --- */}
				{!modes.searchChats && (
					<strips-wrapper ref={stripsWrapperRef} style={{ direction: 'rtl' }} class='overAuto block padVerXs mhvh85'>
						<strips-content style={{ direction: 'ltr' }} class={'flexCol gapXs'}>
							{filteredChatsToShow.map(chatObject => {
								const { first, last } =
									chatObject.type === 'private' ? chatObject.members?.find(member => String(member.id) !== String(brain.user.id)) || chatObject.members?.[0] || {} : {};
								const chatDisplayName = chatObject.name || `${first || ''} ${last || ''}`.trim() || 'Neznámý chat';
								return (
									<ChatStrip
										key={chatObject.id}
										{...{
											isChatsList: true,
											stripMenu: stripMenuId,
											setStripMenu: setStripMenuId,
											obj: chatObject,
											userName: chatDisplayName,
											brain,
											curView,
											chatMan,
											isOpened: brain.openedChat === chatObject.id,
											punish: chatObject.punish,
											muted: chatObject.muted,
											getPunishmentStatus,
											isHighlighted: highlightChatId === chatObject.id,
										}}
									/>
								);
							})}
						</strips-content>
					</strips-wrapper>
				)}

				{/* SEARCH MODE OVERLAY --- */}
				{modes.searchChats && <Search superMan={chatMan} cat={'chats'} setModes={setModes} scrollDir={scrollDir} brain={brain} chats={chats} />}
				{!modes.searchChats && <empty-div class={`block hr20`} />}

				{/* INFINITE SCROLL TARGET --- */}
				{(() => {
					const viewKey = curView === 'chats' ? 'chats' : curView === 'hidden' ? 'hidden' : curView === 'inactive' ? 'inactive' : 'archive';
					return chats.length >= 20 && !brain.user.noMore?.chats?.[viewKey] ? <infinity-trigger ref={infinityChatsTriggerRef} class='block mih1 bor2 selfEnd' /> : null;
				})()}
			</content-wrapper>

			{/* BOTTOM CHAT NAVIGATION --- */}
			<chats-menu class='flexCol textAli posAbs zinMaXl botCen w100'>
				{/* EMPTY STATE MESSAGES --- */}
				{inform.includes('emptyChats') && <div className='bRed tWhite padAllXxs w100 xBold w100 fs9 '>Žádné aktivní chaty</div>}
				{inform.includes('emptyArchive') && <div className='bRed tWhite padAllXxs w100 xBold w100 fs9 '>Tvůj archiv je prázdný</div>}
				{inform.includes('emptyInactive') && <div className='bRed tWhite padAllXxs w100 xBold w100 fs9 '>Žádné neaktivní chaty</div>}
				{inform.includes('emptyHidden') && <div className='bRed tWhite padAllXxs w100 xBold w100 fs9 '>Žádné skryté chaty</div>}

				{/* CATEGORY SELECTOR --- */}
				{modes.chatsMenu && <ChatsListMenuStrip {...{ chatMan, setModes, notifDots }} />}

				{/* ACTION BUTTONS --- */}
				{!modes.searchChats &&
					(() => {
						const activeChatsActions = {
							Nový: () => chatMan({ mode: 'launchSetup' }),
							menu: () => (
								setModes(prev => ({ ...prev, chatsMenu: !prev.chatsMenu, searchChats: false })),
								setTimeout(() => setModes(prev => ({ ...prev, chatsMenu: false, searchChats: false })), 3000)
							),
							hledat: filteredChatsToShow.length > 1 ? () => setModes(prev => ({ ...prev, searchChats: !prev.searchChats, chatsMenu: false })) : null,
						};
						const secondaryViewActions = {
							zpět: () => setCurView('chats'),
							hledat: filteredChatsToShow.length > 1 ? () => setModes(prev => ({ ...prev, searchChats: !prev.searchChats, chatsMenu: false })) : null,
						};
						return (
							<menu-bs class=' w100 gapXxxs borTop mw100 bmw60 padAllXxxs bInsetBlueTopXs zinMax posRel marAuto flexCen'>
								{Object.entries(curView === 'chats' ? activeChatsActions : secondaryViewActions)
									.filter(([, action]) => action)
									.map(([label, action]) => (
										<button
											key={label}
											onClick={action}
											className={`${
												(modes.chatsMenu && label === 'menu') || (modes.searchChats && label === 'hledat')
													? 'bBlue fs11 tWhite '
													: label === 'zpět'
													? 'bRed fs11 tWhite '
													: label === 'Nový' && chats.length === 0
													? ' fs11 borBotGreen '
													: ' fs11 borRed bgWhite hover'
											} grow xBold h100 bHover hr4 textSha shaSubtle borderLight `}>
											{notifDots?.archive > 0 && label === 'menu' && !modes.chatsMenu && <span className='miw2 hr2 bDarkRed upTiny round' />}
											{label}
										</button>
									))}
							</menu-bs>
						);
					})()}
			</chats-menu>
			<EmptyDiv height={`${!brain.user.noMore?.chats?.[curView === 'archive' ? 'archive' : curView] ? 'hvh40' : ''}`} />
		</chat-list>
	);
}

export default memo(
	ChatsList,
	(prev, next) =>
		prev.chats === next.chats &&
		prev.chats.length === next.chats.length &&
		prev.curView === next.curView &&
		prev.inform === next.inform &&
		prev.modes === next.modes &&
		prev.openedChat === next.openedChat &&
		prev.notifDots === next.notifDots
);
