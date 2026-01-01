import { humanizeDateTime, debounce } from '../../helpers';
import TextArea from './TextArea';
import Masonry from './Masonry';
import { useState, useRef, useMemo, useEffect } from 'react';
import useMasonResize from '../hooks/useMasonResize';
import UserStrip from './contentStrips/UserStrip';
import MessageStrip from './contentStrips/MessageStrip';
import ChatMenuStrip from './menuStrips/ChatMenuStrip';

// TODO allow marking messages as favorites, then in menu allow to show only favorites

// OPENED CHAT COMPONENT ---
// Manages the active chat interface, message history, member lists, and chat state (archived, muted, punished).
// Handles real-time message seen status, automatic scrolling, and infinite history loading.
function OpenedChat(props) {
	const {
		scrollDir,
		modes,
		setModes,
		chatObj,
		openedChat,
		openedChatRef,
		brain,
		chatMan,
		bottomScroll,
		setScrollDir,
		inform,
		setInform,
		menuView,
		isWrapped,
		viewSwitch,
		getPunishmentStatus,
		curView,
	} = props;
	const { id, members = [], messages = [], cursors, type, ended, hidden, muted, archived, punishNotifs = [] } = chatObj || {};

	const [activeStripMenuId, setActiveStripMenuId] = useState(null),
		[currentTimeTick, setCurrentTimeTick] = useState(0);

	const infinityMessagesTriggerRef = useRef(null),
		menuWrapperRef = useRef(null),
		messWrapperRef = useRef(null),
		menuButtonRef = useRef(null),
		historyWrapperHeightRef = useRef(0),
		lastSeenMessageIdSentRef = useRef(null),
		lastAutoScrolledMessageIdRef = useRef(null);

	const lastMessageObject = messages?.length ? messages[messages.length - 1] : null;

	// TIME TICKER FOR RELATIVE TIME UPDATES ---
	// Updates local state every minute to force re-renders of humanized time strings.
	useEffect(() => {
		if (!openedChat) return;
		const tickerInterval = setInterval(() => setCurrentTimeTick(Date.now()), 60 * 1000);
		return () => clearInterval(tickerInterval);
	}, [openedChat]);

	// CHAT CHANGE STATE RESET ---
	// Resets seen tracking when switching between different chats.
	useEffect(() => {
		lastSeenMessageIdSentRef.current = null;
	}, [id, openedChat]);

	// IMMEDIATE MESSAGE SEEN NOTIFICATION ---
	// Notifies server that the most recent message has been viewed upon opening the chat.
	useEffect(() => {
		if (!openedChat || !lastMessageObject) return;
		const lastMessageNumericId = Number(lastMessageObject.id);
		// Validate message ID and prevent redundant updates for own messages
		if (
			!Number.isFinite(lastMessageNumericId) ||
			lastMessageNumericId <= 0 ||
			lastMessageObject.user?.toString() === brain.user.id.toString() ||
			lastSeenMessageIdSentRef.current === lastMessageNumericId
		)
			return;

		lastSeenMessageIdSentRef.current = lastMessageNumericId;
		chatMan({ mode: 'messSeen', chatID: id, messID: lastMessageNumericId });
	}, [openedChat, id, chatMan, brain.user.id, lastMessageObject]);

	// SCROLL-BASED MESSAGE SEEN TRACKING ---
	// Monitors message container scroll position to mark messages as seen when they enter the viewport.
	useEffect(() => {
		if (!openedChat || !messWrapperRef.current || !messages.length) return;

		let seenScrollDebounceTimeout;
		const processSeenOnScroll = () => {
			clearTimeout(seenScrollDebounceTimeout);
			seenScrollDebounceTimeout = setTimeout(() => {
				const container = messWrapperRef.current;
				if (!container || chatObj.seen) return;

				// Check if user has scrolled to the bottom of the message list
				const isAtBottom = container.scrollTop + container.clientHeight >= container.scrollHeight - 50;
				const newestMessageId = messages.slice(-1)[0]?.id;

				if (isAtBottom && newestMessageId && lastSeenMessageIdSentRef.current !== Number(newestMessageId)) {
					lastSeenMessageIdSentRef.current = Number(newestMessageId);
					chatMan({ mode: 'messSeen', chatID: id, messID: newestMessageId });
				}
			}, 150);
		};

		const container = messWrapperRef.current;
		container.addEventListener('scroll', processSeenOnScroll, { passive: true });
		processSeenOnScroll();

		return () => {
			clearTimeout(seenScrollDebounceTimeout);
			container.removeEventListener('scroll', processSeenOnScroll);
		};
	}, [openedChat, messages, chatObj?.seen, id, chatMan]);

	// AUTOMATIC BOTTOM SCROLL ON NEW MESSAGES ---
	// Ensures the view stays anchored to the latest message when it arrives.
	useEffect(() => {
		if (!openedChat || !bottomScroll?.current || !lastMessageObject?.id) return;
		if (lastAutoScrolledMessageIdRef.current === lastMessageObject.id) return;
		lastAutoScrolledMessageIdRef.current = lastMessageObject.id;

		// Use RAF to ensure DOM has updated before scrolling
		const scrollRaf = requestAnimationFrame(() => {
			bottomScroll.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
		});
		return () => cancelAnimationFrame(scrollRaf);
	}, [openedChat, lastMessageObject, bottomScroll]);

	// MASONRY LAYOUT CALCULATION ---
	// Dynamically adjusts member strip grid columns based on available container width.
	const masonryDependencyArray = useMemo(() => [chatObj?.id, scrollDir, modes?.menu, openedChat, currentTimeTick], [chatObj?.id, scrollDir, modes?.menu, openedChat, currentTimeTick]);
	const [masonryColumnCount] = useMasonResize({
		wrapper: openedChatRef,
		brain,
		contType: 'userStrips',
		deps: masonryDependencyArray,
		contLength: members?.length || 1,
	});

	// USER PUNISHMENT STATUS DERIVATION ---
	// Calculates current user's restrictions and punishment details for UI feedback.
	const currentUserMemberObject = members?.find(member => member.id == brain.user.id);
	const otherUserMemberObject = type === 'private' ? members?.find(member => member.id != brain.user.id) : null;
	const { punish, until, active, expired, who, mess: punishmentReason } = getPunishmentStatus(currentUserMemberObject || {});

	// Format punishment timestamps and metadata for display
	const punishmentExpirationTimestamp = until ? (typeof until === 'number' ? until : new Date(until).getTime()) : null;
	const punishmentRemainingLabel = active && punishmentExpirationTimestamp ? humanizeDateTime({ dateInMs: punishmentExpirationTimestamp, getGranularPast: true }) : null;
	const punishmentExpirationLabel = active && punishmentExpirationTimestamp ? humanizeDateTime({ dateInMs: punishmentExpirationTimestamp }) : null;
	const punishmentAdministratorObject = who && members?.find(member => member.id == who);

	// INTERACTION MANAGEMENT ---
	// Handles closing menus when clicking outside and ensures initial scroll position.
	useEffect(() => {
		if (!openedChat) return;
		const closeMenuOnClickOutside = event => {
			if (!menuWrapperRef.current?.contains(event.target) && menuButtonRef.current && !menuButtonRef.current.contains(event.target)) setModes(prev => ({ ...prev, menu: false, members: false }));
		};
		document.addEventListener('mousedown', closeMenuOnClickOutside);
		if (bottomScroll.current) bottomScroll.current.scrollIntoView();
		return () => document.removeEventListener('mousedown', closeMenuOnClickOutside);
	}, [openedChat, setScrollDir, setModes, bottomScroll]);

	// DEBOUNCED INFINITE SCROLL OBSERVER ---
	// Loads historical messages as user scrolls up towards the top of the chat history.
	useEffect(() => {
		const debouncedLoadMoreMessages = debounce(() => chatMan({ mode: 'getMessages' }), 500);
		const infiniteObserver = new IntersectionObserver(
			entries =>
				entries.forEach(entry => {
					// Trigger load if sentinel is visible and more messages are available
					if (entry.isIntersecting && cursors !== 'gotAll' && messages.length >= 20) {
						historyWrapperHeightRef.current = messWrapperRef.current.scrollHeight;
						debouncedLoadMoreMessages();
					}
				}),
			{ root: messWrapperRef.current || null, rootMargin: '0px', threshold: 0 }
		);
		// Maintain scroll position after loading older messages
		if (infinityMessagesTriggerRef.current) infiniteObserver.observe(infinityMessagesTriggerRef.current);
		if (messWrapperRef.current) Object.assign(messWrapperRef.current, { scrollTop: messWrapperRef.current.scrollHeight - historyWrapperHeightRef.current + 35 });

		return () => infiniteObserver.disconnect();
	}, [id, openedChat, messages, cursors, chatMan]);

	return (
		<opened-chat ref={openedChatRef} class={` ${openedChat ? 'w50' : 'w100'}  miw18  grow mhvh100  h100  sideBors   posRel shaComment bInsetBlueLong   `}>
			{/* CHAT HEADER AND MENU SECTION --- */}
			<chat-menu ref={menuWrapperRef} class={` w100 marAuto ${modes.menu ? 'bgWhite' : ''}  marTopM  posAbs topCen zinMax  block `}>
				{/* MENU TOGGLE BUTTON --- */}
				{Boolean(chatObj.id && (modes.menu || scrollDir === 'up' || punish === 'block' || ended || archived)) && (
					<button
						ref={menuButtonRef}
						onClick={() => (setActiveStripMenuId(null), setModes(prev => ({ ...prev, menu: !prev.menu, members: false })))}
						className={`${modes.menu ? 'sideBors posRel tDarkBlue zinMaXl' : 'allOff'} flexCen fs18 pointer xBold bgTransXs textSha zinMax w50 bHover marAuto boRadXxs xBold wrap miw36`}>
						<inner-wrapper class={'flexCen'}>
							<span className={`${muted ? 'tRed' : ''} fs18 xBold marBotXxxs marRigXxs`}>
								{chatObj?.type !== 'private'
									? chatObj?.name
									: otherUserMemberObject?.first || otherUserMemberObject?.last
									? `${otherUserMemberObject?.first || ''} ${otherUserMemberObject?.last || ''}`
									: 'Neznámý uživatel'}
							</span>
							<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='currentColor' className='w100 mw4 textSha borBotLight padHorXs posRel'>
								<path fillRule='evenodd' d='M4 5h16a1 1 0 010 2H4a1 1 0 010-2zm0 6h16a1 1 0 010 2H4a1 1 0 010-2zm0 6h16a1 1 0 010 2H4a1 1 0 010-2z' clipRule='evenodd' />
							</svg>
							{Boolean(muted) && <img src='/icons/mute.png' className='marRigXs marHorXxs mw2' style={{ filter: 'hue-rotate(145deg) brightness(0.8) saturate(1.2)' }} alt='' />}
						</inner-wrapper>
					</button>
				)}

				{/* EXPANDED MENU CONTENT --- */}
				{modes.menu && (
					<menu-wrapper class={'zinMaXl thickBors'}>
						<ChatMenuStrip
							brain={brain}
							chatMan={chatMan}
							setModes={setModes}
							modes={modes}
							isOpened={id === openedChat}
							obj={chatObj}
							getPunishmentStatus={getPunishmentStatus}
							curView={curView}
						/>
						{/* CHAT MEMBERS STRIPS LIST --- */}
						{modes.members && (
							<members-wrapper class='block shaBot mhvh80 overAuto w100 fPadHorXS padBotS posRel shaBotLongDown marAuto'>
								<blue-divider class={` hr1 borTop block bInsetBlueTopXl borTop bgTrans w100 marAuto `} />
								<inner-wrapper class='block fPadHorXxs w100 '>
									<Masonry
										config={{ numOfCols: Math.min(masonryColumnCount, 3), contType: 'userStrips' }}
										content={(Array.isArray(members) ? members : [])
											.filter(m => m.flag !== 'del' && m.punish !== 'kick') // Exclude inactive or removed members
											.sort((a, b) => {
												const rolePriorityMap = { VIP: 1, admin: 2, guard: 3, member: 4, undefined: 5 };
												const priorityA = rolePriorityMap[a.role] || rolePriorityMap['undefined'],
													priorityB = rolePriorityMap[b.role] || rolePriorityMap['undefined'];
												return priorityA !== priorityB ? priorityA - priorityB : a.id - b.id;
											})
											.map(memberObject => (
												<UserStrip
													key={memberObject.id}
													{...{
														stripMenu: activeStripMenuId,
														setStripMenu: setActiveStripMenuId,
														isChatMember: true,
														obj: memberObject,
														chatObj,
														brain,
														menuView,
														superMan: chatMan,
														getPunishmentStatus,
													}}
												/>
											))}
										status={'idle'}
										contView={'userStrips'}
										brain={brain}
									/>
								</inner-wrapper>
							</members-wrapper>
						)}
					</menu-wrapper>
				)}
			</chat-menu>

			{/* MESSAGE LIST CONTAINER --- */}
			<mess-wrapper ref={messWrapperRef} class={`${modes.menu ? 'padTopXs maskTop borTop' : ''} w100 overAuto  block posRel h100 `}>
				<messages-strips class={`${messages.length > 20 ? 'mihvh110' : 'mihvh100'} block fPadHorXxs ${punish === 'kick' ? 'opacityXs' : ''}  w100 `}>
					<infinity-trigger class='block' ref={infinityMessagesTriggerRef} />
					<empty-div class={`block ${modes.menu ? 'hr16' : 'hr10'}`} />
					{/* MESSAGE PROCESSING AND GROUPING --- */}
					{(() => {
						let [processedGroups, activeGroupArray, lastMessageAuthorId, wasPreviousDeleted, previousMessageTimestamp] = [[], [], null, null, null];
						const messageSeenMap = new Map();
						// Build map of message IDs to members who have seen them
						for (const member of Array.isArray(members) ? members : []) {
							if (String(member.id) === String(brain.user.id)) continue;
							if (!messageSeenMap.has(member.seenId)) messageSeenMap.set(member.seenId, []);
							messageSeenMap.get(member.seenId).push(member);
						}
						// Slice message array based on pagination cursors
						const currentVisibleMessages =
							cursors === 'gotAll'
								? messages
								: messages.slice(
										Math.max(
											0,
											messages.findIndex(m => m.id >= (Array.isArray(cursors) ? cursors[1] : 0))
										)
								  );

						currentVisibleMessages.forEach(messageItem => {
							const authorMemberObject = members?.find(m => Number(m.id) === Number(messageItem.user)) || brain.users?.[Number(messageItem.user)] || { id: Number(messageItem.user) };
							const hasBeenRemoved = authorMemberObject?.flag === 'del' || authorMemberObject?.punish === 'kick';
							const baseAuthorName = authorMemberObject
								? authorMemberObject.first || authorMemberObject.last
									? `${authorMemberObject.first || ''} ${authorMemberObject.last || ''}`
									: 'Neznámý uživatel'
								: 'Neznámý uživatel';
							const displayAuthorName = hasBeenRemoved ? `${baseAuthorName} (bývalý člen)` : baseAuthorName;

							const messageCreatedMs = typeof messageItem.created === 'number' ? messageItem.created : Date.parse(messageItem.created);
							const previousCreatedMs = previousMessageTimestamp
								? typeof previousMessageTimestamp === 'number'
									? previousMessageTimestamp
									: Date.parse(previousMessageTimestamp)
								: null;

							// Trigger new group if author changes, long time gap occurs, or previous message was deleted
							const isLargeGap = previousCreatedMs !== null && messageCreatedMs - previousCreatedMs > 1000 * 60 * 30;
							const shouldStartNewGroup = String(messageItem.user) !== String(lastMessageAuthorId) || isLargeGap || wasPreviousDeleted;

							if (shouldStartNewGroup && activeGroupArray.length > 0) processedGroups.push([...activeGroupArray]), (activeGroupArray = []);

							// GENERATE MESSAGE STRIP COMPONENT ---
							activeGroupArray.push(
								<MessageStrip
									key={messageItem.id}
									{...{
										chatObj,
										obj: { ...messageItem, ...(type !== 'private' ? { authorRole: members.find(m => Number(m.id) === Number(messageItem.user))?.role } : {}) },
										brain,
										userName: displayAuthorName,
										stripMenu: activeStripMenuId,
										setStripMenu: setActiveStripMenuId,
										seenBy: messageSeenMap.get(messageItem.id) || [],
										isFirst: activeGroupArray.length === 0,
										prevCreated: previousCreatedMs ?? messageCreatedMs,
										chatMan,
										getPunishmentStatus,
									}}
								/>
							);
							[lastMessageAuthorId, wasPreviousDeleted, previousMessageTimestamp] = [messageItem.user, messageItem.content === null, messageCreatedMs];
						});

						if (activeGroupArray.length > 0) processedGroups.push([...activeGroupArray]);

						// TRANSFORM GROUPS INTO JSX ---
						const renderedGroupJSX = processedGroups.map((group, index) => (
							<message-group
								key={group[0].props.obj.id}
								class={`${String(group[0].props.obj.user) === String(brain.user.id) ? 'bgLightBlue' : 'bgLightTeal'} boRadXs marBotXxs flexCol ${
									group?.[0]?.props.obj.user !== processedGroups[index - 1]?.[0]?.props.obj.user ? 'marBotS' : ''
								}`}>
								{group}
							</message-group>
						));

						// RENDER EPHEMERAL PUNISHMENT NOTIFICATIONS ---
						const ephemeralNotifsJSX = (punishNotifs || []).map(notif => {
							const target = members?.find(m => m.id == notif.userID),
								author = members?.find(m => m.id == notif.who);
							const notifUntilMs = notif.until ? (typeof notif.until === 'number' ? notif.until : new Date(notif.until).getTime()) : null;
							const notifUntilLabel = notifUntilMs ? humanizeDateTime({ dateInMs: notifUntilMs }) : null;
							const labelMap = { ban: 'zabanován', gag: 'umlčen', kick: 'vykopnut', unban: 'odbanován', ungag: 'odumlčen' };
							return (
								<punishment-notif key={notif.ts} class='flexRow padVerXxs padHorS marBotXxs bgTransXxs boRadXxs textLeft'>
									<span className='fs6 tDarkGray'>
										<strong className='tRed'>{target?.first || 'Uživatel'}</strong> byl {labelMap[notif.how] || notif.how}
										{author && (
											<>
												{' '}
												(<strong className='tBlue'>{author.first || 'mod'}</strong>){' '}
											</>
										)}
										{notif.mess && <>– &quot;{notif.mess}&quot;</>}
										{notifUntilLabel && !notif.how?.startsWith('un') && <> – trest skončí {notifUntilLabel}</>}
									</span>
								</punishment-notif>
							);
						});

						return [...renderedGroupJSX, ...ephemeralNotifsJSX];
					})()}
					<empty-div class='hvh10 mih10 block' />

					{/* AUTO BOTTOM SCROLL --- */}
					<bottom-scroll ref={bottomScroll} class='block mih1' />
				</messages-strips>
				{/* THROTTLE WARNING OVERLAY --- */}
				{inform.includes('throttled') && (
					<div className='block posAbs marBotXxl tRed fsF textSha block xBold'>Zpráva byla odeslána, ale z důvodu přetížení serveru nebyla zobrazena. Zkuste to znovu později.</div>
				)}
			</mess-wrapper>

			{/* INTERACTION AND STATE PANELS --- */}
			<bottom-panels
				class={`${punish === 'block' || punish === 'kick' || ended || currentUserMemberObject?.flag === 'del' ? 'bInsetRed' : 'bInsetBlue'} bgTransXs zinMenu posAbs botCen block w100`}>
				{/* CHAT STATUS MESSAGES --- */}
				{(scrollDir === 'up' || punish === 'kick' || currentUserMemberObject?.flag === 'del' || (punish === 'block' && who != brain.user.id)) &&
					Boolean(currentUserMemberObject?.flag === 'del' || ended || punish || archived || hidden) && (
						<message-cutoff class={`borTop padVerXs ${archived || hidden ? 'bInsetBlue' : 'bInsetRed '} bgWhite block w100 textAli`}>
							<span
								className={`${
									(active && !hidden) || punish === 'kick' || currentUserMemberObject?.flag === 'del' ? 'tRed' : expired ? 'tDarkGreen' : 'tDarkBlue'
								} fs19 marBotXxs marTopXs textSha block xBold`}>
								{hidden
									? 'TENTO CHAT JE SKRYTÝ'
									: archived
									? 'TENTO CHAT JE ARCHIVOVÁN'
									: ended
									? 'TENTO CHAT BYL UKONČEN'
									: currentUserMemberObject?.flag === 'del'
									? 'NEJSI ÚČASTNÍKEM CHATU'
									: punish === 'block'
									? who === brain.user.id
										? 'CHAT JE BLOKOVANÝ'
										: 'UŽIVATEL NENÍ DOSTUPNÝ'
									: punish === 'kick'
									? 'BYL JSI VYKOPNUT Z CHATU'
									: punish && expired
									? 'TREST VYPRŠEL'
									: punish === 'ban'
									? !until
										? 'JSI PERMANENTNĚ ZABANOVÁN'
										: 'JSI DOČASNĚ ZABANOVÁN'
									: punish === 'gag'
									? active
										? 'JSI DOČASNĚ UMLČEN'
										: 'TREST VYPRŠEL'
									: 'UPOZORNĚNÍ!!!'}
							</span>

							<info-messages class='flexInline wrap justCen'>
								{punish !== 'kick' && (
									<span className='marRigXs fs8'>
										{hidden ? (
											'V chatech se zobrazí jen když přijdou nové zprávy, po jejichž přečtení bude při dalším načtení Ministerry opět skrytý.'
										) : ended ? (
											'Všichni účastníci byli převedeni na pozorovatele a psaní nových zpráv bylo deaktivováno.'
										) : currentUserMemberObject?.flag === 'del' ? (
											<>
												Zobrazené zprávy jsou po datum zrušení tvého členství.{' '}
												{messages.length > 0 && <strong>Poslední zpráva: {humanizeDateTime({ dateInMs: messages.slice(-1)[0]?.created })}</strong>}
											</>
										) : punish === 'gag' ? (
											!until ? (
												'Tvůj trest je permanentní a další zprávy už posílat nemůžeš.'
											) : expired ? (
												'Tvůj trest vypršel, můžeš znovu vstoupit do chatu.'
											) : (
												`Opět posílat nové zprávy budeš moci za ${punishmentRemainingLabel}`
											)
										) : punish === 'ban' ? (
											!until ? (
												'Tvůj trest je permanentní.'
											) : expired ? (
												'Tvůj trest vypršel, můžeš znovu vstoupit do chatu.'
											) : (
												`Znovu vstoupit budeš moci za ${punishmentRemainingLabel}`
											)
										) : archived ? (
											'Upozornění na nové zprávy v archivovaných chatech chodí maximálně 1x za hodinu'
										) : (
											`Zobrazené zprávy jsou po datum poslední zprávy v momentě ${punish === 'block' ? 'zablokování chatu' : 'tvého zabanování.'}`
										)}
									</span>
								)}

								{!ended && !hidden && currentUserMemberObject?.flag !== 'del' && (
									<info-messages>
										{(currentUserMemberObject?.flag !== 'ok' || punish === 'block' || punish === 'kick') && (
											<span className={`marRigXs ${punish === 'kick' ? 'fs7' : ''}`}>
												{!archived && messages.length > 0 && punish !== 'kick' && (
													<strong className='marRigXs'>{humanizeDateTime({ dateInMs: messages.slice(-1)[0]?.created })}</strong>
												)}
												{archived ? (
													'Pro zaslání nové zprávy'
												) : punish && punish !== 'block' && punishmentAdministratorObject ? (
													<>
														Trest ti udělil {punishmentAdministratorObject.role === 'guard' ? 'hlídač' : punishmentAdministratorObject.role === 'admin' ? 'admin' : 'VIP'}
														<strong className='fs10 padHorXs'>{punishmentAdministratorObject.first || ''}</strong>
														{punishmentReason?.length ? (
															<>
																s odůvodněním: <strong className='fs10 padHorXs'>&quot;{punishmentReason}&quot;</strong>
															</>
														) : (
															''
														)}
													</>
												) : type === 'private' ? (
													'Pro napsání zprávy'
												) : (
													'Pro zobrazení nových zpráv'
												)}
											</span>
										)}
										{punish !== 'kick' && (
											<strong>
												{punish === 'kick'
													? 'Klikni na tlačítko níže pro opětovný vstup.'
													: punish === 'gag' || punish === 'ban'
													? active
														? !until
															? 'Trest je nastaven bez omezení.'
															: `Trest skončí ${punishmentExpirationLabel || 'brzy'}.`
														: 'Klikni na tlačítko níže pro opětovný vstup.'
													: punish === 'block'
													? who === brain.user.id
														? 'nejdříve chat odblokuj'
														: ''
													: ' chat nejdříve odarchivuj'}
											</strong>
										)}
									</info-messages>
								)}
							</info-messages>
						</message-cutoff>
					)}

				{/* PRIMARY ACTION BUTTONS --- */}
				{currentUserMemberObject?.flag === 'del' || Boolean(archived) || (punish && (punish !== 'block' || String(who) === String(brain.user.id))) ? (
					(() => {
						const [isChatBlocked, hasPunishmentExpired, isActionByCurrentUser] = [punish === 'block', expired, String(who) === String(brain.user.id)];
						return (
							<red-strip
								class={`flexRow aliCen gapXxs padBotXs w80 boRadM noBakcground  ${
									punish === 'kick' || currentUserMemberObject?.flag === 'del' ? 'borderRed' : ''
								} marAuto  textAli w100 `}>
								{Boolean(isWrapped) && (
									<button onClick={() => viewSwitch('chatsList')} className='padHorXxxs tWhite hr4 imw5 padHorS fs12 boldM borTop h100 bHover'>
										<img src='/icons/back.png' alt='arrow left' />
									</button>
								)}
								{isChatBlocked && isActionByCurrentUser && (
									<button
										onClick={() => isActionByCurrentUser && chatMan({ mode: 'unblockChat', chatID: id, targetUserID: otherUserMemberObject?.id })}
										className='bDarkRed tWhite mw60 boRadS fsC xBold posRel padAllXs'>
										{isActionByCurrentUser ? 'odblokovat chat' : 'chat je blokován'}
									</button>
								)}
								{Boolean(archived) && (
									<button onClick={() => chatMan({ mode: 'unarchiveChat', chatID: id })} className='bDarkBlue marAuto w100 tWhite mw60 boRadXs fs12 bold posRel padAllXxs'>
										Odarchivovat chat
									</button>
								)}
								{punish && punish !== 'block' && (
									<button
										onClick={() => hasPunishmentExpired && chatMan({ mode: 'reenterChat', chatID: id })}
										disabled={!hasPunishmentExpired}
										className={`${hasPunishmentExpired ? 'bDarkRed pointer' : 'bDarkRed'} tWhite mw80 boRadS w100 fsD xBold posRel marAuto padAllXs`}>
										{punish === 'kick'
											? 'Pardón, polepším se, slibuju!'
											: !hasPunishmentExpired
											? !until
												? 'Trest nemá konec'
												: `Trest skončí ${punishmentExpirationLabel}`
											: 'Znovu vstoupit do chatu'}
									</button>
								)}
							</red-strip>
						);
					})()
				) : (!ended && !punish) || Boolean(hidden) ? (
					<hidden-chat class={'block w100 noBackground'}>
						{Boolean(hidden) && (
							<button onClick={() => chatMan({ mode: 'unhideChat', chatID: id })} className='bDarkBlue tWhite borderBot mw40 marBotXxs w100 marAuto boRadXxs fs7 bold posRel padAllXxs'>
								Přesunout do aktivních
							</button>
						)}
						<TextArea superMan={chatMan} thisIs={'newMessage'} showBackButton={isWrapped} viewSwitch={viewSwitch} inform={inform} setInform={setInform} />
					</hidden-chat>
				) : isWrapped ? (
					<button onClick={() => viewSwitch('chatsList')} className='bDarkBlue tWhite mw40 marAuto boRadS fsC xBold posRel padAllXs marBotXs'>
						← zpět na chaty
					</button>
				) : null}
			</bottom-panels>
		</opened-chat>
	);
}
export default OpenedChat;
