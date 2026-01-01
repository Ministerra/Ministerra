import { memo } from 'react';

/** ----------------------------------------------------------------------------
 * ContentControls Component
 * UI for selecting card view design and column count on home page.
 * --------------------------------------------------------------------------- */
const eventCols = [1, 2, 3, 4], usersCols = [3, 4, 5];

function ContentControls({ brain, snap, avail, contView, numOfCols, maxCols, viewCols, setViewCols, showAllThumbs, setCardsToContent }) {
	if (viewCols && maxCols >= (contView === 'events' ? eventCols : usersCols)[0]) {
		// COLUMNS NUMBER SELECTOR ---------------------------
		return (
			<columns-number class='flexCen marAuto posRel marBotS halo bPadXxs fsC zin100 bor2 borTopLight growAll fitContent'>
				{(contView === 'events' ? eventCols : usersCols).filter(col => col <= maxCols).map(num => (
					<button
						key={num}
						onClick={async () => {
							brain.user.cols[contView] = num, setCardsToContent(null, num), setViewCols(false);
							setTimeout(() => window.scrollTo({ top: document.querySelector('#content').offsetTop - 20, behavior: 'smooth' }), 500);
						}}
						className={`${numOfCols === num ? 'bBlue boRadXs xBold tWhite' : ''} grow bHover miw20 mw20`}>
						{`${num} ${num !== numOfCols ? '' : numOfCols === 1 ? 'sloupec' : numOfCols > 4 ? 'sloupců' : 'sloupce'}`}
					</button>
				))}
			</columns-number>
		);
	}

	// VIEW DESIGN SELECTOR ---------------------------
	return (
		<view-bs class={`${maxCols === 1 ? 'flexCen' : 'flexRow spaceBet'} posRel downTiny gapXs ${numOfCols === 1 ? 'mw140' : maxCols === 1 ? 'mw60' : ''} marAuto w99`}>
			{maxCols > 1 && (
				<button onClick={e => (e.stopPropagation(), setViewCols(!viewCols))} className='bInsetBlueTopS posRel zinMax borTop padAllXs bgTrans tDarkBlue mw35 grow boldM fs13 boRadXxs'>
					{`${numOfCols} sloupce`}
				</button>
			)}
			{contView === 'users' && snap.types.length !== avail.types.length && (
				<button
					onClick={async () => { brain.user.settings.showAllThumbs = !brain.user.settings.showAllThumbs; setCardsToContent(null); }}
					className='shaSubtle padAllXs zinMax bgTransXs borRed bHover mw30 grow boldM tDarkBlue posRel fsB shaComment boRadXxs'>
					{showAllThumbs ? 'Všechny' : 'Zvolené'}
				</button>
			)}
			<button
				onClick={async e => (
					e.stopPropagation(),
					(brain.user.cardsView[contView] = brain.user.cardsView[contView] === 1 ? 2 : brain.user.cardsView[contView] === 2 ? (contView === 'events' ? 3 : 1) : 1),
					setCardsToContent(null)
				)}
				className='bInsetBlueTopXs posRel zinMax padAllXs bgTrans tDarkBlue mw35 borTop grow boldM fs13 boRadXxs'>
				{`design ${brain.user.cardsView[contView]}`}
			</button>
		</view-bs>
	);
}

export default memo(ContentControls);

