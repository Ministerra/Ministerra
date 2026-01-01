import { useState, useRef } from 'react';
import { humanizeDateTime } from '../../helpers';
import { showUsersProfile } from '../utils/userProfileUtils';
import UserCard from './UserCard';

// TODO put smazat under "sprava" and create option to hide event but keep the data.
const MenuStrip = props => {
	const { obj = {}, superMan, thisIs, modes = {}, status = {}, setStatus, setModes, nowAt, brain, showActions = false } = props,
		{ created, id, content } = obj,
		[selButton, setSelButton] = useState(null),
		[{ own, copied }, { protocol }] = [status, modes],
		scrollTarget = useRef(),
		stableRandom = useRef((parseInt(String(obj.user || obj.id || 1).slice(-4), 36) % 30) + 1);

	const src = {
		chatsMenu: { archiv: () => superMan({ mode: 'getArchivedChats' }), neaktivní: () => superMan({ mode: 'getInactiveChats' }) },
		comment: {
			profil:
				!obj.own && brain
					? async () => {
							await showUsersProfile({
								obj,
								brain,
								setModes: callback => {
									// showUsersProfile calls setModes with a callback function
									// Execute the callback to get the new state, then preserve menu: true
									const newState = callback({});
									setModes(prev => ({ ...prev, ...newState, menu: true }));
								},
								modes,
								setStatus,
							});
					  }
					: null,
			editovat: created && own && Date.now() - new Date(created).getTime() < 1000 * 60 * 15 ? () => superMan({ mode: 'showEdit' }) : null,
			smazat: own ? () => superMan({ mode: 'delete', isNew: Date.now() - new Date(created).getTime() < 1000 * 20 }) : null,
			nahlásit: !obj.own ? () => setModes(prev => ({ ...prev, protocol: prev.protocol ? false : 'report', textArea: false, rate: false })) : null,
			sdílet: () => superMan({ mode: 'share', id }),
			kopírovat: () => {
				const formattedData = `Uživatel: ${obj.first} ${obj.last}\n` + `Kdy: ${humanizeDateTime({ dateInMs: created })}\n` + `Komentář: ${content}\n`;
				navigator.clipboard.writeText(formattedData).catch(err => console.error('Could not copy text: ', err));
				setStatus(prev => ({ ...prev, copied: !prev.copied ? true : 'info' }));
			},
		},
	};

	const classes = {
		img: {
			comment: 'mw4 w25',
		},
	};

	return (
		<menu-strip ref={scrollTarget} onClick={e => e.stopPropagation()} class={` flexCol  ${modes.menu && modes.replies ? 'marBotS' : ''} marAuto textAli  borBotLight   aliCen w100 `}>
			<menu-bs class={` hvh8 mh10 flexCen w100 bInsetBlueTopXs borderTop  gapXxxs    posRel padTopXxxs aliStretch    bPadVerXs`}>
				{Object.keys(src[thisIs])
					.filter(button => src[thisIs][button])
					.map((button, index) => (
						<button
							key={index}
							id={index === 0 ? 'firstButton' : ''}
							onClick={async e => {
								e.stopPropagation();
								const newSelButton = selButton === button ? null : button;
								if (thisIs === 'chat' && !['odmlčet', 'účastníci', 'nastavit', 'kick', 'profil'].includes(button))
									return setSelButton(newSelButton), setModes(prev => ({ ...prev, members: false }));
								await src[thisIs][button](e), button === 'účastníci' && setSelButton(newSelButton);
							}}
							className={`${
								selButton === button || (button === 'kopírovat' && copied) || (button === 'nahlásit' && protocol === 'report') || (button === 'profil' && modes.profile)
									? 'arrowDown1 thickBors shaBot xBold posRel borRed boRadS zinMaXl fs8 shaComment '
									: ' shaBlue posRel bold'
							} ${nowAt === 'event' && thisIs === 'event' ? 'fs7 ' : 'fs6'} posRel zinMaXl    shaBlue  noBackground w100 grow h100  bHover `}>
							<img className={`${classes['img'][thisIs] || 'mw5'} miw3`} src={`/icons/indicators/${index + 1}.png`} alt='' />
							{button === 'kopírovat' ? (!copied ? 'kopírovat' : copied === 'info' ? 'Užij CTRL + V' : 'zkopírováno') : button}
						</button>
					))}
			</menu-bs>
			{modes.profile && brain && (
				<profile-wrapper class='block w100 marAuto zinMaXl posRel'>
					<blurred-imgs onClick={() => setModes(prev => ({ ...prev, profile: false }))} class='flexCen aliStretch posAbs mask h60 bInsetBlueTopXs topCen posRel w100'>
						<div className='mih0-5 shaTop posAbs topCen opacityS shaTop zin100 bgWhite w100 aliStart' />
						<img src={`${import.meta.env.VITE_BACK_END}/public/users/${stableRandom.current}_${modes.profile.imgVers}.webp`} className='w50' />
						<img src={`${import.meta.env.VITE_BACK_END}/public/users/${stableRandom.current}_${modes.profile.imgVers}.webp`} className='w50' style={{ transform: 'scaleX(-1)' }} />
					</blurred-imgs>
					<UserCard
						key={modes.profile.id}
						obj={{ ...modes.profile, ...(obj.first ? obj : {}) }}
						cardsView={brain.user.cardsView?.users}
						isProfile={true}
						brain={brain}
						setModes={setModes}
						showActions={showActions}
					/>
				</profile-wrapper>
			)}
		</menu-strip>
	);
};

export default MenuStrip;
