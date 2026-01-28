import { useEffect, useRef, useState } from 'react';
const MenuButtons = props => {
	const { isCardOrStrip, nowAt, src, thisIs, selButton, setSelButton, isChatsList, modes, copied, protocol, isSearch, setMode, isBlocked, galleryMode, notifDots = {} } = props;
	const scrollTarget = useRef();
	const [showAdditionalActions, setShowAdditionalActions] = useState(false);

	// SCROLL INTO VIEW --------------------------------------------------------
	useEffect(() => {
		thisIs !== 'message' && thisIs !== 'chat' && thisIs !== 'user' && scrollTarget.current.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' }); // SKIP SCROLL FOR CHAT MENU (wrapped view issue) ------
	}, []);

	// HIDDEN ACTIONS CONFIGURATION --------------------------------------------
	const hiddenButtons =
		nowAt === 'event' && !galleryMode
			? []
			: [
					// ...(thisIs !== 'message' ? ['editovat', 'smazat'] : []),
					'zrušit',
					'opustit',
					'ukončit',
					'odpojit',
					'blokovat',
					'oddůvěřit',
					...(!isBlocked ? ['nahlásit', 'potrestat'] : []), // POTRESTAT ADDED ------
					...(galleryMode === 'pastSurMay' ? ['skrýt'] : []),
				];

	// Filter buttons based on whether additional actions are shown
	const primaryButtons = Object.keys(src).filter(b => src[b] && (nowAt === 'editor' || !hiddenButtons.includes(b)));
	const additionalButtons = Object.keys(src).filter(b => src[b] && hiddenButtons.includes(b));
	const visibleButtons = showAdditionalActions && nowAt !== 'editor' ? additionalButtons : primaryButtons;
	const hasHiddenButtons = additionalButtons.length > 0;

	// VISUAL STYLES CONFIG ----------------------------------------------------
	const classes = {
		img: {
			user: 'mw2-5 w40',
			message: 'w16 mw2-5',
			chat: 'mw3-5 miw2-5 w40',
			chatsList: 'mw3-5 w80',
			event: isCardOrStrip || nowAt === 'home' ? 'mw3 w80' : 'mw5 w80',
			chatsMenu: 'mw6 w33',
			comment: 'mw2-5 w25',
		},
		bs: {
			user: ' w100 hvh6 mh5',
			chat: 'hvh6 mh6',
			chatsList: 'hvh6 mh6',
			event: isCardOrStrip || nowAt === 'home' ? 'hvh6 mh6' : 'hvh25 mh9',
			chatsMenu: 'hvh6 mh5 ',
			message: 'hvh6 mh5',
		},
	};

	// RENDER ------------------------------------------------------------------
	return (
		<menu-strip ref={scrollTarget} onClick={e => e.stopPropagation()} class={`${classes.bs[thisIs]} ${selButton ? 'marBotXs' : ''} flexCen  wrap	  posRel aliStretch     gapXxxs  boRadXs  zinMenu  w100`}>
			{visibleButtons.map((b, index) => (
				<button
					key={b}
					onClick={async e => {
						e.stopPropagation();
						if (['opustit', 'ukončit'].includes(b)) return setSelButton(selButton === b ? null : b);
						else if (selButton !== b) setSelButton(null);
						await src[b](e);
					}}
					className={`${
						selButton === b ||
						(b === 'editovat' && modes.textArea) ||
						(b === 'profil' && modes.profile) ||
						(b === 'účast' && modes.inter) ||
						(b === 'pozvat' && modes.invites) ||
						(b === 'nahlásit' && protocol === 'report') ||
						(b === 'náhled' && modes.evePreview) ||
						(b === 'ukončit' && selButton === b) ||
						(b === 'poznámka' && modes.protocol === 'note') ||
						(b === 'tresty' && modes.protocol === 'punish') ||
						(b === 'potrestat' && modes.protocol === 'punish') ||
						(b === 'opustit' && selButton === b) ||
						(b === 'připojit' && modes.protocol === 'link') ||
						(b === 'důvěřovat' && modes.trust) ||
						(b === 'účastníci' && modes.members)
							? `${!['zpět', 'kopírovat'].includes(b) ? 'arrowDown1' : ''} borTo8 bgTrans xBold  arrowDown1    fs10  `
							: b === 'odvolat'
								? 'tRed xBold fs8'
								: b === 'kopírovat' && copied
									? 'xBold fs10 shaBot  bInsetBlueTopS'
									: ' bInsetBlueTopXs bBor bold   '
					} ${nowAt === 'event' && thisIs === 'event' ? 'fs8' : nowAt === 'editor' ? 'fs8' : 'fs7'} posRel zinMaXl miw2 grow  h100 bHover`}>
					<img className={`${classes.img[thisIs]}`} src={`/icons/indicators/${index + 1}.png`} alt="" />
					{b === 'archiv' && notifDots?.archive > 0 && <span className="miw2 hr2 bDarkRed round posAbs upLittle" />}
					{b === 'kopírovat' ? (!copied ? 'kopírovat' : copied === 'info' ? 'Užij CTRL + V' : 'zkopírováno') : b}
				</button>
			))}

			{/* Additional Actions Button */}
			{hasHiddenButtons && nowAt !== 'editor' && (
				<button
					key="additional-actions"
					onClick={e => {
						e.stopPropagation();
						setShowAdditionalActions(!showAdditionalActions);
						setSelButton(null);
					}}
					className={`${showAdditionalActions ? 'thickBors shaBot xBold posRel bBor2 boRadXxs bRed tWhite shaComment' : 'shaBlue posRel  bold'} ${nowAt === 'event' && thisIs === 'event' ? 'fs10' : 'fs11'} posRel zinMaXl shaBlue miw5 hvh6 mh5 mw8 zinMaXl  grow h100 ${classes.bs[thisIs]} bHover`}>
					<span className={`${classes.img[thisIs]} flexCen marBotXxxs fs25 boldM`}>{showAdditionalActions ? '←' : '⋯'}</span>
					{showAdditionalActions ? 'zpět' : 'další'}
				</button>
			)}
		</menu-strip>
	);
};
export default MenuButtons;
