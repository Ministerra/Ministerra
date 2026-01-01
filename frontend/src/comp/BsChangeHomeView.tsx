import { useState } from 'react';
import useCentralFlex from '../hooks/useCentralFlex';

// HOME VIEW SELECTOR COMPONENT ---
// Toggles between different home screen views like local events or top national content
function BsChangeHomeView({ show, fadedIn, showMan }) {
	const [expanded, setExpanded] = useState(false);
	const views = {
		cityEvents: { title: 'Události a účastníci', desc: 'Dokonalý přehled o Tvých lokalitách' },
		topEvents: { title: 'TOP 100 dnes v ČR', desc: 'Nejpopulárnější a nejlépe hodnocené' },
	};
	const currentView = views[show.view] || views.cityEvents,
		currentKey = show.view || 'cityEvents',
		buttonWidth = useCentralFlex('changeHomeView', [expanded], 'home', Object.keys(views).length);

	// COMPONENT RENDERING ---
	// Renders the view switcher container with expansion support
	return (
		<change-home class={`${fadedIn.includes('CatFilter') ? 'fadedIn' : ''} ${expanded ? 'marBotS' : ''} marTopS fadingIn aliStretch zinMenu posRel flexCen w100 fPadHorXs   marAuto`}>
			{!expanded ? (
				// COLLAPSED VIEW STATE ---
				// Shows currently active category with prompt to expand
				<button onClick={() => setExpanded(true)} className='posRel padBotS     shaBlueLight borBotLight padBotXxs bgTrans boRadXxxs  zinMaXl bHover w100 mw90  '>
					{/* COLLAPSED CONTENT WRAPPER --- */}
					{/* Contains icon and descriptive labels for the active view */}
					<content-wrapper class='posRel flexCol overHidden w100'>
						<img src={`/icons/${currentKey === 'cityEvents' ? 'event' : 'topEvents'}.png`} alt='' className='bgTransXs marAuto aspect169    maskLowXs mw12 downTinyBit posRel' />
						<span className='boldM fs17 tDarkBlue textSha inlineBlock lh1'>
							<span className=' fs17'>Prohlížíš sekci:</span> {currentView.title}
						</span>
						<span className='fs8  posRel inlineBlock '>Klikni sem pro přepnutí na jinou sekci.</span>
					</content-wrapper>
				</button>
			) : (
				// EXPANDED SELECTION LIST ---
				// Maps through all available views to provide selection buttons
				Object.entries(views).map(([key, { title, desc }]) => (
					<button
						key={key}
						onClick={() => (showMan('homeView', key), setExpanded(false))}
						style={{ width: '100%', ...(buttonWidth && { maxWidth: `${buttonWidth}px` }) }}
						className={`${show.view === key ? 'xBold' : ''} posRel bgTrans padTopS  padBotM boRadXxxs maskLowXs bHover grow`}>
						{/* SELECTION OPTION CONTENT --- */}
						{/* Displays visual and textual information for each view option */}
						<content-wrapper class='posRel flexCol overHidden w100'>
							<img src={`/icons/${key === 'cityEvents' ? 'event' : 'topEvents'}.png`} alt='' className='bgTransXs   maskLowXs marAuto mw10 wvw12 posRel' />
							<span className={`${show.view === key ? 'xBold fs19' : 'boldXs fs19'} tDarkBlue marBotXxxxs textSha lh1`}>{title}</span>
							<span className='fs9  posRel inlineBlock '>{desc}</span>
						</content-wrapper>
					</button>
				))
			)}
		</change-home>
	);
}
export default BsChangeHomeView;
