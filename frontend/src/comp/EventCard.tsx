// IMPORTS ----------------------------------------------------------------------
import { useState, useEffect, useRef, memo, useMemo } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { typesMap } from '../../sources';
import { FRIENDLY_MEETINGS } from '../../../shared/constants';
import EveMenuStrip from './menuStrips/EveMenuStrip';
import ContentIndis from './ContentIndis';
import { humanizeDateTime } from '../../helpers';
import EventBadges from './EventBadges';
import { showUsersProfile } from '../utils/userProfileUtils';
import EveActionsBs from './EveActionsBs';
import UserCard from './UserCard';

// TODO consider rendering more portrait pictures, but put clear indications where sur portraits end and maybe portraits start
// TODO show number of comments in content indis
// TODO remove maxWidth when cols = 1. show basicaly fullscreen each card, but refactor CSS, so that everything is mutch bigger

// EVENT CARD COMPONENT DEFINITION ---
// Main display unit for events with multiple layout modes and deep interaction state
function EventCard(props: any) {
	// PROPS AND STATE INITIALIZATION ---
	const { obj, cols, brain: propsBrain, nowAt: propsNowAt, isPreview, cardsView = 1, isMapPopUp, setModes: userCardSetModes, isSearch, isFirstInCol } = props;
	const { nowAt = propsNowAt, brain = propsBrain }: any = useOutletContext() || {};
	const navigate = useNavigate();
	const protocolRef = useRef(null),
		cardRef = useRef(null),
		// UI MODES STATE ---
		// Controls visibility of interactive overlays like share, actions, and menus
		[modes, setModes] = useState<any>({ share: false, actions: false, menu: false, protocol: false, privs: false, map: false }),
		// STABLE RANDOM FOR PLACEHOLDER ASSETS ---
		stableRandom = useRef((parseInt(String(obj.id).slice(-4), 36) % 30) + 1),
		// EVENT INTERACTION STATUS ---
		// Tracks user-specific data like ratings, attendance, and ownership
		[status, setStatus] = useState<any>({
			copied: false,
			shared: obj.shared,
			mark: obj.mark,
			awards: obj.awards || [],
			score: obj.score,
			interPriv: obj.interPriv,
			embeded: [isMapPopUp, isPreview].some(x => x),
			inter: obj.inter,
			canceled: obj.canceled,
			deleted: obj.deleted || obj.state === 'del',
			comments: obj.comments || [],
			own: obj.own,
			opened: brain.user.id && brain.user?.openEve?.includes(obj.id),
			surely: obj.surely,
			maybe: obj.maybe,
			isMeeting: FRIENDLY_MEETINGS.has(obj.type),
			invite: false,
		}),		isInactive = status.deleted || status.canceled,
		imgVers = obj.imgVers?.toString().split('_')[0] || 0,
		isPast = Date.now() > (obj.ends || obj.starts);

	// INTERACTION HITBOXES ---
	// Clickable areas on the left and right sides of the card that trigger actions
	const InteractionHitboxes = () => (
		<>
			<left-half
				onClick={e => {
					e.stopPropagation();
					navigate(`/event/${obj.id}`);
				}}
				class='posAbs topLeft h100 w50 pointer'
				style={{ zIndex: 10 }}
			/>
			<right-half
				class='posAbs topRight h100 w50 pointer'
				style={{ zIndex: 10 }}
				onClick={e => {
					e.stopPropagation();
					setModes(prev => ({ ...prev, actions: !prev.actions,  profile: false, menu: false }));
				}}
			/>
		</>
	);

	// INTERACTION GUIDES -------------------------
	// Visual aids shown for the first cards in each column to teach user interaction regions
	const InteractionGuides = () =>
		(isFirstInCol || status.embeded) &&
		!modes.menu && (
			<guide-indicators class={'w100 flexRow marTopXs spaceBet'}>
				<left-half className=' borWhite noBackground  posRel   bInsetBlueBotXs         zinMaXl flexRow aliCen   noPoint' style={{ zIndex: 60 }}>
					<img src='/icons/open.png' className='mw2-5 marRigXxs ' alt='' />
					<span className=' tDarkBlue  textSha boldM fs5 '>Otevřít = levá půlka</span>
				</left-half>
				<right-half className=' noBackground bInsetBlueBotXs borWhite posRel     shaBot     zinMaXl flexRow aliCen   noPoint' style={{ zIndex: 60 }}>
					<span className=' tDarkBlue textSha boldM fs5  '>pravá půlka = Možnosti</span>
					<img src='/icons/actions.png' className='mw2-5 ' alt='' />
				</right-half>
			</guide-indicators>
		);

	// INTERACTING USERS MEMOIZATION ---
	// Calculates list of users attending or interested in the event
	const interUsers = useMemo(() => {
		if (!status.isMeeting) return [];
		return [
			...(['sur', 'may'].includes(obj.inter) ? [brain.user] : []),
			...Object.values(brain.users || {}).filter((user: any) => user?.eveInters?.some(([eveID]: [any]) => eveID == obj.id && user.state !== 'stale')),
		]
			.sort((a: any, b: any) => {
				// Primary: 'sur' users before 'may' users
				const aIsSur = a.eveInters?.find(([eveID]: [any]) => eveID == obj.id)?.[1] === 'sur' ? 1 : 0;
				const bIsSur = b.eveInters?.find(([eveID]: [any]) => eveID == obj.id)?.[1] === 'sur' ? 1 : 0;
				if (bIsSur !== aIsSur) return bIsSur - aIsSur;
				// Secondary: higher score first
				return b.score - a.score;
			})
			.slice(0, 8);
	}, [status.isMeeting, obj.inter, obj.id, brain.user, brain.users]);

	// STATE SYNCHRONIZATION HOOK ---
	useEffect(() => {
		if (obj.canceled !== status.canceled || (obj.state === 'del') !== status.deleted) setStatus(prev => ({ ...prev, canceled: obj.canceled, deleted: obj.state === 'del' }));
	}, [obj.canceled, obj.state]);

	// PROFILE PREVIEW OVERLAY ---
	// Displays user profile card overlay with blurred background images
	const profileWrapper = modes.profile && (
		<profile-wrapper onClick={e => e.stopPropagation()} class='block w100 marAuto  fPadHorXxs padBotXs   zinMaXl posRel'>
			<blurred-imgs
				onClick={e => (e.stopPropagation(), setModes(prev => ({ ...prev, profile: false })))}
				class={`flexCen  aliStretch posAbs moveDown  mask h60  bInsetBlueTopXs topCen posRel w100`}>
				<div className='mih0-5 shaTop  posAbs topCen opacityS shaTop zin100 bgWhite w100 aliStart' />
				<img 
				title='Profile picture'
				src={`${import.meta.env.VITE_BACK_END}/public/users/${obj.id === brain.user.id ? brain.user.id : stableRandom.current}_${modes.profile.imgVers}.webp`} className={`w50 `} />
				<img
				title='Profile picture'
					src={`${import.meta.env.VITE_BACK_END}/public/users/${obj.id === brain.user.id ? brain.user.id : stableRandom.current}_${modes.profile.imgVers}.webp`}
					className={`w50 `}
					style={{ transform: 'scaleX(-1)' }}
				/>
			</blurred-imgs>
			<UserCard
				key={modes.profile.id}
				obj={modes.profile}
				showActions={true}
				isProfile={true}
				brain={brain}
				cardsView={brain.user.cardsView.users}
				setModes={setModes}
				isEventPreview={isPreview}
			/>
		</profile-wrapper>
	);

	// ACTION BUTTONS SECTION (bottom of the card) ---------------------------
	const actionsComp = <EveActionsBs {...{ fadedIn: ['BsEvent'], thisIs: 'event', brain, nowAt, obj, status, setModes, setStatus, modes, isInactive, isPast }} />;

	// EVENT TYPE INDICATOR ---
	// Renders event type icon with type name label
	const typeImg = (
		<type-img
			onClick={e => (
				e.stopPropagation(), setModes(prev => ({ ...prev, share: false, menu: !prev.menu, actions: false, protocol: false, profile: false, invites:false })), setStatus(prev => ({ ...prev, copied: false }))
			)}
			class={`bHover selfEnd aliCen point ${cardsView === 1 && !status.isMeeting ? 'floatLeft' : ''} ${
				!status.isMeeting || cardsView === 2 ? (cardsView !== 2 ? 'moveUp' : { 2: 'moveDown', 3: 'moveDown', 4: 'moveDownMore', 5: 'downEvenMore' }[cols] || '') : 'upTiny'
			} textAli     boRadXxs ${modes.menu ? 'bsContentGlow boRadL  borBot8' : ''} pointer marRigS posRel   zinMaXl`}>
			<img className={`${cols === 2 ? 'miw8 mw14' : 'miw8 mw12'} aspect1611 selfEnd zinMaXl `} src={`/icons/types/${obj.type}.png`} alt='' />
			{!modes.menu && <span className='bold fs8 posRel posAbs padVerXxxxs bgTrans tShaWhiteXl padHorXs   w60 miw8 botCen textSha'>{typesMap.get(obj.type)?.cz || 'NEEXISTUJÍCÍ TYP'}</span>}
		</type-img>
	);

	// LARGE EVENT TYPE ICON -------------------------------------------------
	// used in 3rd cards view design (centered layout)
	const typeImgLarge = (
		<type-img-large
			onClick={e => (
				e.stopPropagation(), setModes(prev => ({ ...prev, share: false, menu: !prev.menu, actions: false, protocol: false, profile: false, invites:false })), setStatus(prev => ({ ...prev, copied: false }))
			)}
			class={`flexCol point posAbs botCen  marAuto aliCen textAli boRadXs ${modes.menu ? 'bsContentGlow mw22 boRadL borBot8' : ' mw20 boRadL'} pointer marBotXs     zinMaXl`}>
			<img className={`cover ${cols <= 2 ? 'mw20 miw14' : 'mw16 miw10'}`} src={`/icons/types/${obj.type}.png`} alt='' />
			<span className='bold fs8  bgTrans padHorS boRadXxs textSha'>{typesMap.get(obj.type)?.cz || 'NEEXISTUJÍCÍ TYP'}</span>
		</type-img-large>
	);


	console.log(modes, 'MODES')

	// PARTICIPANT PORTRAITS SECTION ----------------------------------------
	// used in 3rd cards view design (centered layout)
	const portraitImagesV3 = status.isMeeting && cardsView === 3 && interUsers.length > 0 && (
		<portraits-v3 class='flexCol aliCen w100 zinMaXl noPoint'>
			<thumbs-wrapper class='flexRow justCen padTopXs bgTrans padHorXs posRel boRadXs wrap zin3000 point'>
				{interUsers.map((user, i) => (
					<img
						key={user.id + i}
						loading='lazy'
						decoding='async'
						className={`${modes.profile?.id === user.id ? 'bsContentGlow bigger3 zinMenu bor2White  arrowDown1 posRel' : 'bHover'} mw10 miw7 zin3000 point`}
						onClick={e => (
							e.stopPropagation(),
							modes.profile?.id === user.id ? setModes(prev => ({ ...prev, profile: false })) : showUsersProfile({ obj: user, brain, setModes, modes }),
							setModes(prev => ({ ...prev, menu: false }))
						)}
						style={{ width: `${interUsers.length > 0 ? Math.floor(100 / interUsers.length) : 100}%`, aspectRatio: '16/10' }}
						src={`${import.meta.env.VITE_BACK_END}/public/users/${(parseInt(String(user.id).slice(-4), 36) % 30) + 1}_${user.imgVers}S.webp`}
						alt=''
					/>
				))}
				{obj.surely + obj.maybe > interUsers.length && (
					<span className='selfCen posAbs botCen  downTiny fs8 boldM bgTransXs boRadXxs marLefXs padVerXxxs zin3000 point padHorXxs bgTrans textSha'>{`+${
						obj.surely + obj.maybe - interUsers.length
					}`}</span>
				)}
			</thumbs-wrapper>
		</portraits-v3>
	);

	// PARTICIPANT THUMBNAILS COMPONENT ---
	const thumbsWrapper = (
		<thumbs-wrapper class={`flexRow padVerXxxs bgTrans posRel boRadXs wrap  shaTop zin3000 point`}>
			{interUsers.map((user, i) => (
				<img
					key={user.id + i}
					loading='lazy'
					decoding='async'
					className={`${modes.profile?.id === user.id ? 'bsContentGlow  bigger3 arrowDown1 bor2White zinMenu  posRel' : 'bHover'} mw12 miw7 zin3000 point`}
					onClick={e => (
						e.stopPropagation(),
						modes.profile?.id === user.id ? setModes(prev => ({ ...prev, profile: false })) : showUsersProfile({ obj: user, brain, setModes, modes }),
						setModes(prev => ({ ...prev, menu: false }))
					)}
					style={{ width: `${interUsers.length > 0 ? Math.floor(100 / interUsers.length) : 100}%`, aspectRatio: '16/10' }}
					src={`${import.meta.env.VITE_BACK_END}/public/users/${user.id}_${user.imgVers}S.webp`}
					alt=''
				/>
			))}
			{obj.surely + obj.maybe > interUsers.length && (
				<span className='selfCen fs8 boldM posAbs cornerBotRight bgTransXs boRadXxs marRigXs marTopM zin3000 point padVerXxxs padHorXxs bgTrans textSha opacityL'>{`+${
					obj.surely + obj.maybe - interUsers.length
				}`}</span>
			)}
		</thumbs-wrapper>
	);

	// DYNAMIC TEXT STYLING CLASSES ---
	const titleClass = { 1: 'fs17', 2: 'fs15', 3: 'fs15', 4: 'fs12', 5: 'fs10' }[cols] || (status.embeded ? 'fs17' : 'fs14'),
		subTitleClass = { 1: 'fs11', 2: 'fs10', 3: 'fs9', 4: 'fs8', 5: 'fs7' }[cols] || 'fs9',
		shortClass = { 1: 'fs10', 2: 'fs9', 3: 'fs8', 4: 'fs7', 5: 'fs6' }[cols] || 'fs9';

	// EVENT METADATA SUBTITLE COMPONENT ---
	const subTitleElement = (centered = false) => (
		<date-indis-adress class={`flexRow  aliCen ${centered ? 'justCen' : ''} ${cardsView === 2 ? 'marBotXxs' : 'marBotXxs'} wrap ${subTitleClass} posRel`}>
			{/* EVENT TIME DETAILS --- */}
			<span className={`${subTitleClass} ${obj.starts >= Date.now() ? 'tDarkBlue' : 'tRed'} boldM marRigS textSha`}>{humanizeDateTime({ dateInMs: obj.starts })}</span>
			{obj.ends && <span className={`${subTitleClass} ${obj.ends >= Date.now() ? 'tDarkBlue' : 'tRed'} boldM marRigS textSha`}>{` - ${humanizeDateTime({ dateInMs: obj.ends })}`}</span>}
			{/* CONTENT BADGES AND INDICATORS --- */}
			<ContentIndis brain={brain} status={status} obj={obj} thisIs={'event'} isCardOrStrip={true} nowAt={'home'} modes={modes} cols={cols} />
			{/* GEOGRAPHIC CONTEXT --- */}
			{!isSearch && (obj.location?.startsWith('+') || (!obj.location && !obj.place)) && (
				<around-indi class='boRadXxs marRigXxs marLefS posRel'>
					<span className='boldS padHorXxs fs6 textSha tWhite flewRow bPurple textSha'>{obj.location?.startsWith('+') ? 'v okolí' : 'kdekoliv v'}</span>
				</around-indi>
			)}
			{brain.user.curCities.length > 0 && obj.city && <strong className={`marRigXs ${subTitleClass} tDarkGreen boldM`}>{`${obj.city.slice(0, 15)}${obj.city.length > 15 ? '...' : ''}`}</strong>}
			<span className={`${subTitleClass} textSha marRigXs`}>{obj.place || obj.location?.slice(1)}</span>
			{/* DISTANCE FROM USER LOCATION --- */}
			{Number.isFinite(obj.distance) && (
				<span className={`${subTitleClass} marLefXs textSha`}>
					{(() => {
						const d = obj.distance;
						return d < 1 ? `${Math.round(d * 1000)} m` : d > 5 ? `${Math.round(d)} km` : `${d.toFixed(1)} km`;
					})()}
				</span>
			)}
		</date-indis-adress>
	);

	// ICON AND TITLE SECTION ------------------------------------------------
	// event type  icon on the left, title, subtitle, badges, shortDesc on the right
	const iconTitle = (
		<icon-title class={`${cardsView != 3 ? 'flexRow aliStart' : cardsView === 3 ? 'marTopS block' : ''} zinMaXl noPoint `}>
			{typeImg}
			<left-wrapper class={`${cardsView === 2 ? 'padTopXl posRel grow' : isPreview ? (obj.imgVers ? 'padTopXs ' : '') : ''} noPoint block ${!status.isMeeting ? 'padTopXs' : ''}`}>
				<text-wrapper class={`    w100`}>
					{cardsView === 1 && thumbsWrapper}

					<span className={`${titleClass} block textSha xBold lh0-9`}>
						{status.canceled && <strong className='xBold tRed marRigS inlineBlock'>ZRUŠENO! </strong>}
						{obj.title}
					</span>
					{subTitleElement(false)}

					{/* {obj.shortDesc && cardsView === 1 && (
						<span className={`${shortClass} lh1-1 marTopS ${modes.actions ? 'marBotS' : ''} ${status.isMeeting ? 'inlineBlock' : 'block'}`}>{obj.shortDesc}</span>
					)} */}
					{cardsView !== 2 && obj.badges && <EventBadges obj={obj} />}
				</text-wrapper>
			</left-wrapper>
		</icon-title>
	);

	// CARD CONTAINER RENDERING ---
	return (
		<event-card
			id={`card_${obj.id}`}
			ref={cardRef}
			onClick={() => navigate(`/event/${obj.id}`)}
			class={`${cardsView !== 2 && cardsView !== 3 && !status.embeded && (modes.actions || modes.menu || modes.invites || modes.profile) ? 'boRadS  shaMega  boRadXxs' : ''} ${
				cardsView === 3 && (modes.actions || modes.menu || modes.invites || modes.profile) ? 'boRadS borTop8  shaBot boRadXxs' : ''
			} ${!status.embeded ? `${cardsView !== 2 ? 'shaBotLong' : 'shaBotLongDown'} marBotXxl noBackground bHover` : 'bgWhite  borderLight'}  ${
				isMapPopUp ? 'mw100 shaBotLongDown bBor2 w95 boRadXxs mhvh65 textLeft marTopM overX posRel bgWhite shrink0' : 'mw160 bgTrans w100 posRel boRadXxs marAuto'
			} ${modes.protocol ? 'borderLight ' : ''} marAuto zinMaXl block boRadXs block ${isMapPopUp ? '' : 'grow'}   posRel boRadXxs`}>
			{cardsView === 2 && iconTitle}
			{modes.menu && cardsView === 2 && <EveMenuStrip {...{ obj, status, setStatus, nowAt: 'home', setModes, brain, modes, thisIs: 'event', userCardSetModes, isCardOrStrip: true }} />}

			{/* MEDIA AND OVERLAYS SECTION --- */}
			<main-images class={`posRel block maskTopXxs aliStart flexCol zinMaXl  `}>
				<InteractionHitboxes />
				{/* INTERACTIVE HINTS --- */}
				<hint-spans class={`posAbs zinMaXl textAli noPoint w100  `}>
					{(modes.profile || modes.invites) && (
						<info-strip
							// CLOSE PROFILE (DO NOT NAVIGATE) ---
							// This overlay is a "back" affordance; it must not bubble into the card's root click navigation.
							onClick={e => (e.stopPropagation(), setModes(prev => ({ ...prev, profile: false, invites: false })))}
							class='posAbs topCen zinMaXl w100 textAli'>
							<arrow-down style={{ scale: '0.7', filter: 'brightness(1.2)' }} className='arrowDownRed posRel  zinMaXl  textAli   marAuto   inlineBlock   downLittle  s  xBold ' />
							<span className='  tRed tShaWhiteXl  padHorM padVerXxs marAuto posAbs topCen   textAli   padHorM marAuto  padVerXxxs inlineBlock borTop bInsetBlueTopXs  fs12  xBold '>
								zpět na událost
							</span>
						</info-strip>
					)}
					{/* ACTIONS GUIDE INDICATOR --- */}
					{modes.actions && (
						<info-strip class='posAbs topRight zinMaXl noPoint textAli' style={{ top: '0.5rem', right: '0.5rem' }}>
							{/* GUIDE ARROW --- */}
							<arrow-down style={{ scale: '0.7', filter: 'brightness(1.2)' }} className='arrowDownRed posRel  zinMaXl  textAli   marAuto   inlineBlock   downLittle  s  xBold ' />
							{/* GUIDE CAPTION --- */}
							<span className='tRed tShaWhiteXl padHorM padVerXxs posRel textAli padHorM padVerXxxs inlineBlock borTop bInsetBlueTopXs fs12 xBold'>
								zpět na událost
							</span>
						</info-strip>
					)}
				</hint-spans>

				{/* COVER IMAGE AND PARTICIPANT THUMBNAILS SECTION -------------------------------- */}
				{status.isMeeting ? (
					<cover-portraits class={` posRel aliEnd flexCol hvw13   boRadS zinMaXl noPoint`}>
						<img decoding='async' className={`w100 cover  boRadXxs maskLowXs   hvw10 h100 `} src={`/covers/friendlyMeetings/${obj.type}.png`} alt='' />
						{/* PARTICIPANT THUMBNAILS --- */}
						{cardsView !== 3 && (
							<portraits-pics class={` posRel posAbs  boRadS shaTop  botLeft  flexRow zin3000 point`}>
								{cardsView === 1 && <view-one class='flexCol'>{iconTitle}</view-one>}
								{cardsView === 2 && thumbsWrapper}
							</portraits-pics>
						)}
					</cover-portraits>
				) : (
					<img
						decoding='async'
						className={`w100 boRadXxs ${cardsView === 3 ? 'maskLowXs ' : 'shaBotLongDown '} `}
						style={{ objectFit: 'cover', aspectRatio: '16/10' }}
						src={`${import.meta.env.VITE_BACK_END}/public/events/${!obj.own ? stableRandom.current : obj.id}_${imgVers}.webp`}
						alt=''
					/>
				)}

				{cardsView === 3 && typeImgLarge}
			</main-images>

			{/* UNDER IMAGE SECTION ---------------------------------- */}
			<under-image
				class={`block marBotXxxs fPadHorXxxs  posRel ${isMapPopUp ? '' : 'h100'} w100 ${
					status.embeded && status.isMeeting ? '' : !modes.actions ? (cardsView !== 2 ? '' : 'padTopXs ') : ''
				}`}>
				<InteractionHitboxes />
				{/* LAYOUT-SPECIFIC CONTENT VIEWS --- */}
				{cardsView === 1 && (
					<view-one>
						{obj.shortDesc && !modes.profile && !modes.invites && <p className={`posRel borLeftThick padLeftXs marTopXs marBotS   ${shortClass} lh1-1`}>{obj.shortDesc}</p>}
						{modes.menu && <EveMenuStrip {...{ obj, status, setStatus, nowAt: 'home', setModes, brain, modes, thisIs: 'event', userCardSetModes, isCardOrStrip: true }} />}
					</view-one>
				)}

				{cardsView === 2 && (
					<view-two>
						{obj.shortDesc && <p className={`posRel borLeftThick    ${shortClass} lh1-1`}>{obj.shortDesc}</p>}
						{obj.badges && <EventBadges obj={obj} />}
						{modes.actions && actionsComp}
					</view-two>
				)}

				{cardsView === 3 && (
					<view-three class='flexCol aliCen textAli'>
						{modes.menu && (
							<menu-wrapper class='w100 block marBotXs'>
								<EveMenuStrip {...{ obj, status, setStatus, nowAt: 'home', setModes, brain, modes, isCardOrStrip: true, userCardSetModes }} />
							</menu-wrapper>
						)}
						<span className={`${titleClass} block textSha xBold marBotXxxs lh1`}>
							{status.canceled && <strong className='xBold tRed marRigS inlineBlock'>ZRUŠENO! </strong>}
							{obj.title}
						</span>
						{subTitleElement(true)}

						<texts-wrapper class='flexCol aliCen textAli marTopS fPadHorXs w100'>
							{obj.shortDesc && <p className={`${shortClass} marBotXxs lh1-2 textAli`}>{obj.shortDesc}</p>}
							{obj.badges && <EventBadges obj={obj} />}
						</texts-wrapper>

						{portraitImagesV3}
					</view-three>
				)}
				<protocol-top ref={protocolRef} />
				{(isFirstInCol || status.embeded) && !modes.actions && !modes.profile && <InteractionGuides />}
			</under-image>
			{modes.actions && actionsComp}
			{profileWrapper}
		</event-card>
	);
}
// MEMOIZATION COMPARISON FUNCTION ----------------------------------------------
function areEqual(prevProps, nextProps) {
	return (
		prevProps.obj === nextProps.obj &&
		prevProps.cols === nextProps.cols &&
		prevProps.isFirstInCol === nextProps.isFirstInCol &&
		prevProps.cardsView === nextProps.cardsView &&
		prevProps.obj.comments === nextProps.obj.comments &&
		prevProps.obj.canceled === nextProps.obj.canceled &&
		prevProps.obj.state === nextProps.obj.state
	); // CHECK CANCELED/DELETED ---
}

export default memo(EventCard, areEqual);
