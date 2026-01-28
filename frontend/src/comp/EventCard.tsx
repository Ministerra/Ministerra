// IMPORTS ----------------------------------------------------------------------
import { useState, useEffect, useRef, memo, useMemo } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { typesMap } from '../../sources';
import { FRIENDLY_MEETINGS, isEventPast } from '../../../shared/constants';
import EveMenuStrip from './menuStrips/EveMenuStrip';
import ContentIndis from './ContentIndis';
import { humanizeDateTime } from '../../helpers';
import EventBadges from './EventBadges';
import { showUsersProfile } from '../utils/userProfileUtils';
import EveActionsBs from './EveActionsBs';
import UserCard from './UserCard';
import Invitations from './Invitations';

// TODO consider rendering more portrait pictures, but put clear indications where sur portraits end and maybe portraits start
// TODO show number of comments in content indis
// TODO remove maxWidth when cols = 1. show basicaly fullscreen each card, but refactor CSS, so that everything is mutch bigger

// EVENT CARD COMPONENT DEFINITION ---
// Main display unit for events with multiple layout modes and deep interaction state
function EventCard(props: any) {
	// PROPS AND STATE INITIALIZATION ---
	const { obj, cols, brain: propsBrain, nowAt: propsNowAt, isPreview, cardsView = 1, isMapPopUp, setModes: userCardSetModes, isSearch, isFirstInCol } = props;
	// UNIFIED CHIP SIZING ---
	const chipFontClass = { 1: 'fs7', 2: 'fs7', 3: 'fs7', 4: 'fs6', 5: 'fs5' }[cols] || 'fs7';
	const chipClass = `${chipFontClass} bold textSha padHorXs hr1-5 boRadXxs tWhite`;
	const { nowAt = propsNowAt, brain = propsBrain }: any = useOutletContext() || {};
	const navigate = useNavigate();
	const protocolRef = useRef(null),
		cardRef = useRef(null),
		profileWrapperRef = useRef(null),
		invitesWrapperRef = useRef(null),
		// UI MODES STATE ---
		// Controls visibility of interactive overlays like share, actions, and menus
		[modes, setModes] = useState<any>({ share: false, actions: false, menu: false, protocol: false, privs: false, map: false }),
		// STABLE RANDOM FOR PLACEHOLDER ASSETS ---
		stableRandom = useRef((obj.id % 29) + 1),
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
		}),
		hideMenu = modes.menu && (modes.protocol || modes.evePreview || modes.invites || modes.delete || modes.cancel || modes.inter || modes.feedback || modes.deletePast || modes.invitees || modes.invitors),
		resetSubModes = (hideMenu = false) => setModes(prev => ({ ...prev, protocol: false, evePreview: false, invites: false, delete: false, cancel: false, inter: false, feedback: false, deletePast: false, invitees: false, invitors: false, profile: false, menu: !hideMenu })),
		isInactive = status.deleted || status.canceled,
		imgVers = obj.imgVers?.toString().split('_')[0] || 0,
		locationPrefix = obj.location?.startsWith('+') ? 'v okolí' : !obj.location && !obj.place ? 'kdekoliv v' : '',
		// IS PAST CHECK ---
		// Steps: use centralized isEventPast to handle missing ends with default duration so ongoing meetings remain interactive.
		isPast = isEventPast(obj);

	// INTERACTION HITBOXES ---
	// Clickable areas on the left and right sides of the card that trigger actions
	const InteractionHitboxes = () => (
		<open-event
			onClick={e => {
				e.stopPropagation();
				if (obj.notFound) return;
				if (hideMenu || modes.profile || modes.invites) return resetSubModes(true);
				navigate(`/event/${obj.id}`);
			}}
			class="posAbs topLeft h100 w100 pointer"
			style={{ zIndex: 10 }}
		/>
	);

	// INTERACTING USERS MEMOIZATION ---
	// Calculates list of users attending or interested in the event
	const interUsers = useMemo(() => {
		if (!status.isMeeting) return [];
		return [...(['sur', 'may'].includes(obj.inter) ? [brain.user] : []), ...Object.values(brain.users || {}).filter((user: any) => user?.eveInters?.some(([eveID]: [any]) => eveID == obj.id && user.state !== 'stale'))]
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

	useEffect(() => {
		if (modes.profile && profileWrapperRef.current) {
			profileWrapperRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
		}
	}, [modes.profile]);

	useEffect(() => {
		if (modes.invites && invitesWrapperRef.current) {
			invitesWrapperRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
		}
	}, [modes.invites]);

	// PROFILE PREVIEW OVERLAY ---
	// Displays user profile card overlay with blurred background images
	const profileWrapper = modes.profile && (
		<profile-wrapper ref={profileWrapperRef} onClick={e => e.stopPropagation()} class="block w100 marAuto  fPadHorXxs padBotXs   zinMaXl posRel">
			<blurred-imgs onClick={e => (e.stopPropagation(), setModes(prev => ({ ...prev, profile: false })))} class={`flexCen  aliStretch posAbs moveDown  mask h60  bInsetBlueTopXs topCen posRel w100`}>
				<div className="mih0-5 shaTop  posAbs topCen opacityS shaTop zin100 bgWhite w100 aliStart" />
				<img title="Profile picture" src={`${import.meta.env.VITE_BACK_END}/public/users/${obj.id === brain.user.id ? brain.user.id : stableRandom.current}_${modes.profile.imgVers}.webp`} className={`w50 `} />
				<img title="Profile picture" src={`${import.meta.env.VITE_BACK_END}/public/users/${obj.id === brain.user.id ? brain.user.id : stableRandom.current}_${modes.profile.imgVers}.webp`} className={`w50 `} style={{ transform: 'scaleX(-1)' }} />
			</blurred-imgs>
			<UserCard key={modes.profile.id} obj={modes.profile} showActions={true} isProfile={true} brain={brain} cardsView={brain.user.cardsView.users} setModes={setModes} isEventPreview={isPreview} />
		</profile-wrapper>
	);

	// ACTION BUTTONS SECTION (bottom of the card) ---------------------------
	const actionsComp = !modes.menu && !modes.profile && obj.state !== 'del' && <EveActionsBs {...{ fadedIn: ['BsEvent'], thisIs: 'event', brain, nowAt, obj, status, setModes, setStatus, modes, isInactive, isPast }} />;

	// EVENT TYPE INDICATOR ---
	// Renders event type icon with type name label
	const typeImg = (isWrapped = false) => (
		<type-img
			onClick={e => {
				e.stopPropagation();
				if (obj.notFound) return;
				if (hideMenu) return resetSubModes();
				setModes(prev => ({ ...prev, share: false, menu: !prev.menu, actions: false, protocol: false, profile: false, invites: false }));
				setStatus(prev => ({ ...prev, copied: false }));
			}}
			class={`bHover  selfEnd aliCen point ${cardsView === 1 && !status.isMeeting ? 'floatLeft' : ''} ${!status.isMeeting || cardsView === 2 ? (cardsView !== 2 ? '' : { 2: 'downLittle', 3: 'downLittle', 4: 'moveDownMore', 5: 'downEvenMore' }[cols] || 'downLittle') : 'upTiny'} ${isWrapped ? 'textRight' : 'textAli'}     boRadXxs ${modes.menu ? 'bsContentGlow boRadL upTinyBit    borBot8' : ''} pointer ${isWrapped ? 'w100' : ' w20'} posRel zin2500`}>
			<img className={`${cols === 1 ? 'mw22' : cols === 2 ? 'mw18' : cardsView === 2 ? 'mw14' : ' mw16'} w100  aspect1611 selfEnd zinMaXl `} src={`/icons/types/${obj.type}.png`} alt="" />
			{!hideMenu && !modes.menu && <span className="bold fs8 posRel posAbs padVerXxxxs bgTrans tShaWhiteXl padHorXs   w60 miw8 botCen textSha">{typesMap.get(obj.type)?.cz || 'NEEXISTUJUJÍCÍ TYP'}</span>}
			{modes.menu && <span className="bold fs8 posRel textAli posAbs padVerXxxxs bRed tWhite padHorXs w100 marBotXxxs miw8 botCen textSha">{hideMenu ? 'zpět na menu' : 'skrýt menu'}</span>}
		</type-img>
	);

	// LARGE EVENT TYPE ICON -------------------------------------------------
	// used in 3rd cards view design (centered layout)
	const typeImgLarge = (
		<type-img-large
			onClick={e => {
				e.stopPropagation();
				if (obj.notFound) return;
				if (hideMenu) return resetSubModes();
				setModes(prev => ({ ...prev, share: false, menu: !prev.menu, actions: false, protocol: false, profile: false, invites: false }));
				setStatus(prev => ({ ...prev, copied: false }));
			}}
			class={`flexCol point posAbs botCen aliCen justCen  marAuto aliCen textAli  ${modes.menu ? 'bsContentGlow  mw22 boRadL borBot8' : ' mw20 boRadL'} pointer marBotXs     zinMaXl`}>
			<img className={`cover ${cols === 1 ? 'mw24 miw14' : cols === 2 ? 'mw20 miw14' : 'mw16 miw10'}`} src={`/icons/types/${obj.type}.png`} alt="" />
			{!hideMenu && <span className="bold fs8  bgTrans padHorS boRadXxs textSha">{typesMap.get(obj.type)?.cz || 'NEEXISTUJÍCÍ TYP'}</span>}
			{hideMenu && <span className="bold fs8 bRed textAli w100 inlineBlock tWhite padHorS boRadXxs textSha">zpět na menu</span>}
		</type-img-large>
	);

	// PARTICIPANT PORTRAITS SECTION ----------------------------------------
	// used in 3rd cards view design (centered layout)
	const portraitImagesV3 = status.isMeeting && cardsView === 3 && interUsers.length > 0 && (
		<portraits-v3 class="flexCol aliCen w100 noPoint">
			<thumbs-wrapper class="flexRow justCen padTopXs bgTrans padHorXs posRel boRadXs wrap noPoint">
				{interUsers.map((user, i) => (
					<img
						key={user.id + i}
						loading="lazy"
						decoding="async"
						className={`${modes.profile?.id === user.id ? 'bsContentGlow  bigger3 zinMenu bor2White  arrowDown1 posRel' : 'bHover'}  mw10 miw7 zin3000 point`}
						onClick={e => (e.stopPropagation(), modes.profile?.id === user.id || obj.notFound ? setModes(prev => ({ ...prev, profile: false })) : showUsersProfile({ obj: user, brain, setModes, modes }), setModes(prev => ({ ...prev, menu: false })))}
						style={{ width: `${interUsers.length > 0 ? Math.floor(100 / interUsers.length) : 100}%`, aspectRatio: '16/10' }}
						src={`${import.meta.env.VITE_BACK_END}/public/users/${(user.id % 29) + 1}_${user.imgVers}S.webp`}
						alt=""
					/>
				))}
				{obj.surely + obj.maybe > interUsers.length && <span className="selfCen posAbs botCen  downTiny fs8 boldM bgTransXs boRadXxs marLefXs padVerXxxs zin3000 point padHorXxs bgTrans textSha">{`+${obj.surely + obj.maybe - interUsers.length}`}</span>}
			</thumbs-wrapper>
		</portraits-v3>
	);

	// PARTICIPANT THUMBNAILS COMPONENT ---
	const thumbsWrapper = (
		<thumbs-wrapper class={`flexRow padVerXxxs  posRel boRadS overHidden w100 wrap marBotXxs gapXxxxs  noPoint`}>
			{interUsers.map((user, i) => (
				<img
					key={user.id + i}
					loading="lazy"
					decoding="async"
					className={`${modes.profile?.id === user.id ? 'bsContentGlow  upLittle bigger3 arrowDown1 bor2White zinMenu  posRel' : 'bHover'} shaTop  ${cardsView === 2 ? 'mw16' : 'mw11'} zin3000 point`}
					onClick={e => (e.stopPropagation(), modes.profile?.id === user.id || obj.notFound ? setModes(prev => ({ ...prev, profile: false })) : showUsersProfile({ obj: user, brain, setModes, modes }), setModes(prev => ({ ...prev, menu: false })))}
					style={{ width: `${interUsers.length > 0 ? Math.floor(100 / interUsers.length) : 100}%`, aspectRatio: '16/10' }}
					src={`${import.meta.env.VITE_BACK_END}/public/users/${(user.id % 29) + 1}_${user.imgVers}S.webp`}
					alt=""
				/>
			))}
			{obj.surely + obj.maybe > interUsers.length && <span className="selfCen fs8 boldM posAbs cornerBotRight bgTransXs boRadXxs marRigXs marTopM zin3000 point padVerXxxs padHorXxs bgTrans textSha opacityL">{`+${obj.surely + obj.maybe - interUsers.length}`}</span>}
		</thumbs-wrapper>
	);

	// DYNAMIC TEXT STYLING CLASSES ---
	const titleClass = { 1: 'fs20', 2: 'fs18', 3: 'fs17', 4: 'fs16', 5: 'fs14' }[cols] || (status.embeded ? 'fs18 lh0-8 marBotXxxs' : 'fs14'),
		subTitleClass = { 1: 'fs11', 2: 'fs10', 3: 'fs9', 4: 'fs8', 5: 'fs9' }[cols] || 'fs9',
		shortClass = { 1: 'fs9', 2: 'fs9', 3: 'fs8', 4: 'fs7', 5: 'fs9' }[cols] || 'fs9';

	// EVENT METADATA SUBTITLE COMPONENT ---
	const subTitleElement = (centered = false) => (
		<date-indis-adress class={`flexRow  aliCen ${centered ? 'justCen' : ''} ${cardsView === 2 ? 'marBotXxs' : 'marBotXxs'} wrap ${subTitleClass} posRel`}>
			{/* EVENT TIME DETAILS --- */}
			<span className={`${subTitleClass} boldM marRigXs textSha`}>
				<span className={`${subTitleClass} boldM ${obj.starts >= Date.now() ? 'tDarkBlue' : 'tRed'}`}>{humanizeDateTime({ dateInMs: obj.starts })}</span>
				{obj.ends && (
					<>
						{' - '}
						<span className={`${subTitleClass} boldM ${obj.ends >= Date.now() ? 'tDarkBlue' : 'tRed'}`}>{humanizeDateTime({ dateInMs: obj.ends })}</span>
					</>
				)}
			</span>
			{/* CONTENT BADGES AND INDICATORS --- */}
			<ContentIndis brain={brain} status={status} obj={obj} thisIs={'event'} isCardOrStrip={true} nowAt={'home'} modes={modes} cols={cols} hideAttenRating={true} isSearch={isSearch} />
			{locationPrefix && <strong className={`marRigXs ${subTitleClass} tPurple xBold`}>{locationPrefix}</strong>}
			{obj.city && (brain.user.curCities.length > 0 || locationPrefix) && <strong className={`marRigXs ${subTitleClass} tDarkGreen boldM`}>{`${obj.city.slice(0, 15)}${obj.city.length > 15 ? '...' : ''}`}</strong>}
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
		<icon-title class={`${cardsView != 3 ? 'flexRow aliStart' : cardsView === 3 ? 'marTopS block' : ''} zinMaXl noBackground noPoint `}>
			{cardsView === 1 ? (
				<div className={`${cols <= 2 ? 'w15' : 'w20'}  selfStretch posRel noPoint`}>
					<div className="posAbs botRight  w100 noPoint">{typeImg(true)}</div>
				</div>
			) : (
				typeImg()
			)}
			<left-wrapper class={`${cardsView === 2 ? 'padTopXl posRel grow' : isPreview ? (obj.imgVers ? 'padTopXs ' : '') : ''} ${cols <= 2 ? 'w85' : 'w80'}   noPoint block ${!status.isMeeting ? 'padTopXs' : ''}`}>
				<text-wrapper class={`fPadHorXxxs block    w100`}>
					{cardsView === 1 && obj.type.startsWith('a') && thumbsWrapper}

					<span className={`${titleClass} block textSha marBotXxxs xBold lh0-9 wordBreak`}>
						{status.canceled && <strong className="xBold tRed marRigS inlineBlock">ZRUŠENO! </strong>}
						{obj.notFound && <strong className="xBold fs20 tRed marRigS inlineBlock">NENALEZENO! </strong>}
						{obj.title}
					</span>
					{subTitleElement(false)}

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
			class={`${cardsView !== 2 && cardsView !== 3 && !status.embeded && (modes.actions || modes.menu || modes.invites || modes.profile) ? 'boRadS  shaMega  boRadXxs' : ''} ${cardsView === 3 && (modes.actions || modes.menu || modes.invites || modes.profile) ? 'boRadS borTop8  shaBot boRadXxs' : ''} ${!status.embeded ? `${cardsView !== 2 ? 'shaBotLong ' : 'shaBotLongDown'} marBotXxl noBackground bHover` : 'bgWhite  borderLight'}  ${
				isMapPopUp ? 'mw100    w95 boRadXxs textLeft marTopM posRel bgWhite shrink0' : 'mw160 bgTrans w100 posRel boRadXxs marAuto'
			} ${modes.protocol ? 'borderLight ' : ''} marAuto zinMaXl  block boRadXs block ${obj.state === 'del' ? 'borderRed' : ''}    posRel boRadXxs`}>
			{cardsView === 2 && iconTitle}
			{modes.menu && cardsView === 2 && !modes.invites && <EveMenuStrip {...{ obj, status, setStatus, nowAt: 'home', setModes, brain, modes, thisIs: 'event', userCardSetModes, isCardOrStrip: true }} />}

			{/* MEDIA AND OVERLAYS SECTION --- */}
			<main-images class={`posRel block maskTopXxs aliStart flexCol zinMaXl   `}>
				<div className={`bgWhite topCen opacityXs shaCon h4  posAbs w100 zinMaXl`} />

				<InteractionHitboxes />
				{/* INTERACTIVE HINTS --- */}
				{(modes.profile || modes.invites) && (
					<info-strip
						// CLOSE PROFILE (DO NOT NAVIGATE) ---
						// This overlay is a "back" affordance; it must not bubble into the card's root click navigation.
						onClick={e => (e.stopPropagation(), resetSubModes(true))}
						class="posAbs topCen zin2500 w100 textAli">
						<arrow-down style={{ scale: '0.7', filter: 'brightness(1.2)' }} className="arrowDownRed posRel  zinMaXl  textAli   marAuto   inlineBlock   downLittle  s  xBold " />
						<span className="  tRed padTopXxs tShaWhiteXl  padHorM  marAuto posAbs topCen   textAli  zinMaXl padHorM marAuto   inlineBlock borTop bInsetBlueTopXs  fs10  xBold ">zpět na událost</span>
					</info-strip>
				)}

				{/* COVER IMAGE AND PARTICIPANT THUMBNAILS SECTION -------------------------------- */}
				{status.isMeeting ? (
					<cover-portraits class={` posRel aliEnd flexCol ${cardsView === 2 ? 'hvw12' : 'hvw13'}  mih25 w100 boRadS zinMaXl noPoint`}>
						<div className={`bgWhite topCen opacityXs shaCon h10  posAbs w100 zinMaXl`} />

						<img decoding="async" className={`w100 cover  boRadXxs maskLowXs ${cardsView === 3 ? 'hvw13' : cardsView === 1 ? 'hvw10' : 'hvw12'}    h100 `} src={`/covers/friendlyMeetings/${obj.type}.png`} alt="" />
						{/* PARTICIPANT THUMBNAILS --- */}
						{cardsView !== 3 && (
							<portraits-pics class={` posRel posAbs  boRadS shaTop  botLeft w100  flexRow noPoint`}>
								{cardsView === 1 && <view-one class="flexCol noPoint">{iconTitle}</view-one>}
								{cardsView === 2 && thumbsWrapper}
							</portraits-pics>
						)}
					</cover-portraits>
				) : (
					<img-wrapper class="posRel w100 shaCon  block">
						<div className={`bgWhite botCen opacityXs   hr1   posAbs w100 `} />
						<img decoding="async" className={`w100  boRadXxs ${cardsView === 3 ? 'maskLowXs ' : ' '} `} style={{ objectFit: 'cover', aspectRatio: '16/10' }} src={`${import.meta.env.VITE_BACK_END}/public/events/${!obj.own ? stableRandom.current : obj.id}_${imgVers}.webp`} alt="" />
					</img-wrapper>
				)}

				{!status.isMeeting && cardsView === 1 && iconTitle}
				{cardsView === 3 && typeImgLarge}
			</main-images>

			{/* UNDER IMAGE SECTION ---------------------------------- */}
			<under-image class={`block   posRel ${isMapPopUp ? '' : 'h100'} w100 ${status.embeded && status.isMeeting ? '' : !modes.actions ? (cardsView !== 2 ? '' : 'padTopXs ') : ''}`}>
				<InteractionHitboxes />
				{/* LAYOUT-SPECIFIC CONTENT VIEWS --- */}
				{cardsView === 1 && (
					<view-one ref={invitesWrapperRef}>
						{obj.shortDesc && !modes.profile && !modes.invites && <p className={`posRel borLeftThick padLeftXs marTopXs marBotXs   ${shortClass} lh1-1`}>{obj.shortDesc}</p>}
						{modes.menu && <EveMenuStrip {...{ obj, status, setStatus, nowAt: 'home', setModes, brain, modes, thisIs: 'event', userCardSetModes, isCardOrStrip: true }} />}
					</view-one>
				)}

				{cardsView === 2 && (
					<view-two ref={invitesWrapperRef}>
						{obj.shortDesc && !modes.invites && <p className={`posRel borLeftThick  marBotXs   ${shortClass} lh1-1`}>{obj.shortDesc}</p>}
						{modes.invites && <Invitations {...{ obj, status, setStatus, nowAt: 'home', setModes, brain, modes, thisIs: 'event', userCardSetModes, isCardOrStrip: true }} />}

						{obj.badges && <EventBadges obj={obj} />}
					</view-two>
				)}

				{cardsView === 3 && (
					<view-three class="flexCol aliCen textAli">
						<span className={`${titleClass} block textSha xBold marBotXxxs lh1 wordBreak`}>
							{status.canceled && <strong className="xBold tRed marRigS inlineBlock">ZRUŠENO! </strong>}
							{obj.title}
						</span>
						{subTitleElement(true)}

						<texts-wrapper class="flexCol aliCen textAli marTopS fPadHorXs w100">
							{obj.shortDesc && <p className={`${shortClass} marBotXxs lh1-2 textAli`}>{obj.shortDesc}</p>}
							{obj.badges && <EventBadges obj={obj} />}
						</texts-wrapper>

						{!modes.menu && portraitImagesV3}
						{modes.menu && (
							<menu-wrapper class="w100 block marBotXs">
								<EveMenuStrip {...{ obj, status, setStatus, nowAt: 'home', setModes, brain, modes, isCardOrStrip: true, userCardSetModes }} />
							</menu-wrapper>
						)}
					</view-three>
				)}
				<protocol-top ref={protocolRef} />
				{/* ALWAYS VISIBLE ACTIONS COMPONENT */}
				{actionsComp}
			</under-image>
			{profileWrapper}
			{obj.notFound && <span className={`xBold fs8 ${cardsView === 3 ? 'textAli' : ''} fPadHorXxxs tRed marBotXxxs inlineBlock`}>Tato událost byla pravděpodobně smazána a již není dostupná ... </span>}
		</event-card>
	);
}
// MEMOIZATION COMPARISON FUNCTION ----------------------------------------------
function areEqual(prevProps, nextProps) {
	return prevProps.obj === nextProps.obj && prevProps.cols === nextProps.cols && prevProps.isFirstInCol === nextProps.isFirstInCol && prevProps.cardsView === nextProps.cardsView && prevProps.obj.comments === nextProps.obj.comments && prevProps.obj.canceled === nextProps.obj.canceled && prevProps.obj.state === nextProps.obj.state; // CHECK CANCELED/DELETED ---
}

export default memo(EventCard, areEqual);
