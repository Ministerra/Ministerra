// CHAT CONFIGURATION INTERFACE ---
// Manages the creation and settings of various chat types (private, free, group, VIP).
import { EmptyDiv } from './EmptyDiv';
import { areEqual } from '../../helpers';
import Search from './bottomMenu/Search';
import TextArea from './TextArea';
import Masonry from './Masonry';
import UserStrip from './contentStrips/UserStrip';
import { useState, useRef } from 'react';
import useMasonResize from '../hooks/useMasonResize';

// ERROR AND INFORMATION MESSAGES ---
const informTexts = {
	noName: 'Název chatu je povinný',
	noMessage: 'první zpráva je povinná',
	shortName: 'název musí mít alespoň 2 znaky',
	shortMessage: 'zpráva musí mít alespoň 2 znaky',
	sameName: 'nový chat nesmí mít stejný název',
	noAdmin: 'řízený chat musí mít admina',
	noVIP: 'VIP chat musí mít VIP uživatele',
	notEnoughMembers: 'Přidej alespoň jednoho dalšího účastníka',
	privateMemberCount: 'Privátní chat musí mít přesně dva účastníky',
	serverError: 'Chyba serveru, zkuste to prosím znovu',
	createChatError: 'Nepodařilo se vytvořit chat',
	selfDelete: 'Nemůžete odstranit sami sebe z chatu',
	throttled: 'Příliš mnoho požadavků, prosím počkejte',
};

// CHAT SETUP COMPONENT ---
// Handles chat metadata editing, member management, and role assignment.
// CHAT SETUP COMPONENT DEFINITION ---
// Orchestrates chat creation and modification, including type selection and member management
function ChatSetup(props) {
	const { chatSetupData, chatObj, chatMan, foundSimilarChats, selSimilarChatID, informScroll, setSelOldChatID, brain, curView, inform, setInform, getPunishmentStatus } = props;
	const activeMembers = (chatSetupData?.members || []).filter(member => member.flag !== 'del'),
		usersSelected = activeMembers.length > 1;
	const [reset, setReset] = useState(0),
		wrapperRef = useRef(null),
		fullCapacity = chatSetupData.members?.length >= (chatSetupData.type === 'private' ? 2 : 20),
		[manageMode, setManageMode] = useState(chatSetupData.id ? 'manage' : null);

	// RESPONSIVE LAYOUT CALCULATION ---
	const [numOfCols] = useMasonResize({ wrapper: wrapperRef, brain, contType: 'userStrips', deps: [chatSetupData.members?.length, manageMode], contLength: chatSetupData.members?.length });

	return (
		<create-chat ref={wrapperRef} class={` mhvh100 hvh100 posRel padBotXl marAuto block overAuto fPadHorXs textAli `}>
			{/* NAVIGATION AND RESET CONTROLS --- */}
			<reset-button class={`flexCen zinMaXl boRadXxs overHidden gapXxxs growAll w90 posFix mw50 bmw35  marAuto topCen marTopS `}>
				<button onClick={() => chatMan({ mode: 'backToChats' })} className='boldM zinMenu bHover tRed borderTop borderLight bgTransXs boRadXs miw10 padTopXs padBotXxs fs7'>
					Zpět na chaty
				</button>
				{(!chatSetupData.id
					? usersSelected || chatSetupData?.type !== 'private'
					: chatObj.members.length !== chatSetupData.members.length ||
					  (chatSetupData.id &&
							chatObj.members.some(
								member =>
									!areEqual(
										member,
										chatSetupData.members.find(m => m.id === member.id)
									)
							)) ||
					  ['type', 'name'].some(key => chatSetupData[key] !== chatObj[key])) && (
					<button onClick={() => (setReset(prev => prev + 1), chatMan({ mode: 'resetSetup' }))} className='boldM zinMenu bHover tRed borderTop borderLight miw10 padTopXs padBotXxs fs7'>
						{chatSetupData.id ? 'Vrátit' : 'Resetovat'}
					</button>
				)}
			</reset-button>
			<EmptyDiv height={`hr14`} />

			{/* CHAT TYPE SELECTION --- */}
			<chat-type class={`aliCen block textAli w100 bw25`}>
				<span className='fs40 xBold w98 block textSha inlineBlock '>{chatSetupData.id ? `Nastavení "${chatObj.name}"` : 'Vytváříš nový chat'}</span>
				{!chatSetupData.id && (
					<span className='fs14 mw160 w98 inlineBlock marTopXs marBotM lh1-3 '>
						Níže vyber typ nového chatu a následně vyhledej účastníky, kterým v případě řízeného nebo VIP chatu také přiřaď administrátorské role.
					</span>
				)}

				{/* TYPE SELECTOR BUTTONS --- */}
				<bs-div class='flexCen posRel bPadL borTopLight shaBlue gapXxxs zinMax aliStretch wrap marAuto thickBors bw25 w100 iw40 growAll imw8'>
					{(() => {
						const lang = { private: 'privátní', free: 'volný', group: 'řízený', VIP: 'V.I.P' };
						const src = {
							privátní: 'Klasický chat jeden na jednoho. Nelze jej později převést na skupinový chat.',
							volný: 'Skupinový chat bez jakékoliv moderace. Všichni jsou si rovni. Nelze později převést na vyšší typ chatu.',
							řízený: 'S alespoň jedním administrátorem a hlídači, kteří moderují. Lze později převést na volný chat.',
							VIP: 'Stejný jako řízený, avšak navíc s jedním konkrétním majitelem. Lze později převést na řízený a nebo volný chat',
						};
						const template = [[], []];
						Object.keys(lang).forEach((val, i) => {
							const templateSlot = i <= 1 ? template[0] : template[1],
								isDisabled = chatSetupData.id && (Object.keys(lang).indexOf(val) > Object.keys(lang).indexOf(chatObj.type) || (val === 'private' && chatObj.type !== 'private'));
							templateSlot.push(
								<button
									key={val}
									name={val}
									onClick={() => !isDisabled && (chatMan({ mode: 'setType', chatType: val }), setManageMode('manage'))}
									className={`${chatSetupData.type === val ? 'bInsetBlue bor2' : ' '} bHover bInsetBlueTopXs posRel boRadXs h100 gapXxxs boldM`}>
									<img className={`${isDisabled ? 'opaque' : ''} marBotXxs`} src={`/icons/types/3.png`} alt='' />
									<span className={`${isDisabled ? 'tDis' : ''} fs14 tSha xBold marBotXxxs`}>{Object.keys(src)[i]} </span>
									<span className='fs8'>{Object.values(src)[i]}</span>
								</button>
							);
						});
						return template.map((_, i) => (
							<group-div key={i} class='flexCen aliStretch w32 w100 grow' style={{ flexBasis: 'calc(9rem * 2)' }}>
								<div className='flexCen w100 gapXxxs aliStretch aliStart'>{i === 0 ? template[0] : template[1]}</div>
							</group-div>
						));
					})()}
				</bs-div>

				{/* IRREVERSIBLE CHANGE WARNING --- */}
				{(() => {
					const changeToFree = chatSetupData.type === 'free' && ['VIP', 'group'].includes(chatObj.type),
						changeToGroup = chatObj.type === 'VIP' && chatSetupData.type === 'group';
					if (chatSetupData.id && (changeToFree || changeToGroup))
						return (
							<type-change-inform class='block w100 marAuto marBotL padVerM borderTop boRadS textAli'>
								<span className='tRed fsG marBotXxs textSha block xBold'>UPOZORNĚNÍ!!!</span>
								<span className='fsA bold'>Změna chatu na nižší typ je nevratnou akcí.</span>
							</type-change-inform>
						);
				})()}
			</chat-type>

			{/* MANAGEMENT MODE SWITCHER --- */}
			{chatSetupData.id && ['group', 'VIP'].includes(chatSetupData.type) && (
				<manage-modes class={'flexRow border marBotL w100 marAuto bPadVerS mw100'}>
					{Object.entries({ 'Přidat / odebrat': 'manage', 'Změnit role': 'roles', 'Řízení trestů': 'punish' }).map(([label, mode]) => (
						<button key={label} className={`${manageMode === mode ? 'bBlue arrowDown1 posRel tWhite fs8 boldM' : ' fs7 bold shaBlueLight'} w33`} onClick={() => setManageMode(mode)}>
							{label}
						</button>
					))}
				</manage-modes>
			)}

			{/* CAPACITY WARNING --- */}
			{fullCapacity && chatSetupData.type !== 'private' && (
				<capacity-warning class='marTopXl block'>
					<span className='fsG xBold textSha marBotXxs inlineBlock '>Kapacita chatu je plná (20)</span>
				</capacity-warning>
			)}

			{/* MEMBER SEARCH AND SELECTED MEMBERS LIST --- */}
			<selected-members class={`w100 marAuto flexCol  justCen aliCen ${(!chatSetupData.id && !fullCapacity) || chatSetupData.type === 'private' ? 'marTopXxl' : ''}`}>
				{/* MEMBER SEARCH --- */}
				{!fullCapacity && (!chatSetupData.id || (manageMode === 'manage' && (chatSetupData.type !== 'free' || ['VIP', 'group'].includes(chatObj.type)))) && (
					<search-members class={`w100 marAuto marBotXxl block `}>
						<span className='fs12 xBold w98 block textSha inlineBlock tDarkBlue  marBotXs'>Vyhledej účastníky </span>

						<Search
							brain={brain}
							reset={reset}
							cat={'users'}
							superMan={chatMan}
							isChatSetup={true}
							chatType={chatSetupData.type}
							selectedItems={chatSetupData.members}
							manageMode={manageMode}
						/>
					</search-members>
				)}

				{/* SELECTED MEMBERS --- */}
				{<span className='fs16 xBold w98 block textSha inlineBlock tDarkBlue  marBotXs'>Účastníci chatu </span>}
				<masonry-wrapper class='block w100 marAuto flexCol justCen aliCen padBotS  posRel '>
					<background-gradient class='block w100 h100 posRel posAbs topCen bInsetBlueTopS borTop mw140 ' />

					<Masonry
						content={chatSetupData.members.map(member => (
							<UserStrip
								key={member.id}
								obj={member}
								brain={brain}
								manageMode={manageMode}
								isChatSetup={true}
								superMan={chatMan}
								isSelected={true}
								chatObj={chatObj}
								chatType={chatSetupData.type}
								isNewUser={brain.chatSetupData?.id && chatObj.members && !chatObj.members.some(m => String(m.id) === String(member.id))}
								getPunishmentStatus={getPunishmentStatus}
							/>
						))}
						config={{ contType: 'userStrips', numOfCols, noPadTop: true }}
						brain={brain}
					/>
				</masonry-wrapper>
			</selected-members>
			{/* CHAT METADATA INPUTS --- */}
			{(chatSetupData.id || usersSelected) && (
				<name-message class={`flexCol w100 bInsetBlueTopXs2 mw140 posRel marTopXxl ${chatSetupData.id ? 'marBotM' : ''} marAuto `}>
					<inputs-div class={`${inform.includes('noMessage') ? 'borderRed' : ''} marAuto mw140 boRadL sideBors  shaCon w100`}>
						{chatSetupData.type !== 'private' && (
							<input
								type='text'
								placeholder='Název chatu'
								className={`${inform.includes('noName') ? 'borderRed' : ''} w100 fPadHorXs phXbold  marAuto bold mih5 padVerXs fs18`}
								onFocus={() => chatSetupData.id && !chatSetupData.name && chatMan({ mode: 'groupName', content: chatObj.name })}
								onChange={e => chatMan({ mode: 'groupName', content: e.target.value.replace(/^\s+/, '').replace(/\s{2,}/g, ' ') })}
								value={chatSetupData.name}
							/>
						)}
						{!chatSetupData.id && <TextArea isChatSetup={true} content={chatSetupData.content} superMan={chatMan} />}
					</inputs-div>
				</name-message>
			)}

			<inform-scroll class='block' ref={informScroll} />

			{/* SIMILAR CHATS RESOLUTION --- */}
			<old-chats class={`${!foundSimilarChats ? 'hide' : ''} fPadHorXs w100 marBotXs marAuto bInsetBlueTop flexCol aliCen imw14 textAli`}>
				{foundSimilarChats && (
					<chat-strips class='flexCol gapXxxs boRadM overHidden mw150 marTopM shaCon borderLight shaTopLight w98'>
						<blue-divider class={` hr1 borTop block bInsetBlueTopXl borTop bgTrans w100 zin1 marAuto `} />
						{foundSimilarChats.map(chat => (
							<found-chat
								onClick={() => setSelOldChatID(selSimilarChatID === chat.id ? null : chat.id)}
								key={chat.id}
								class={`${selSimilarChatID === chat.id ? 'shaComment shaTop bsContentGlow' : ''} border shaComment pointer padAllXs bHover flexCol w100 borTopLight `}>
								<span className='textAli fs9 lh1 aliCen'>{`Chat "${chat.name}"`}</span>
								{(selSimilarChatID === chat.id || foundSimilarChats.length === 1) && (
									<button
										className='bBlue mw40 padVerXxs marAuto marTopS w100 fsC tWhite boldM boRadXs border'
										onClick={() => (foundSimilarChats.length === 1 && setSelOldChatID(chat.id), setTimeout(() => chatMan({ mode: 'createChat' }), 150))}>
										Obnovit tento chat
									</button>
								)}
							</found-chat>
						))}
					</chat-strips>
				)}
			</old-chats>
			{/* INFORM / WARNING MESSAGES ------------------------------------------------- */}
			<inform-messages class=' mw170 marAuto marTopM marBotXxs block'>
				{(() => {
					const actualWarnings = Object.keys(informTexts).filter(warn => inform.includes(warn) && warn !== 'selfDelete');
					return actualWarnings.map((inform, index) => (
						<span key={inform} className='tRed marRigXs xBold fs12 marBotXs marTopS lh1  aliCen'>
							{`${index > 0 ? ' + ' : ''}${informTexts[inform]}`}
						</span>
					));
				})()}
			</inform-messages>
			{/* SUBMIT BUTTON ------------------------------------------------------------- */}
			{(foundSimilarChats || (usersSelected && curView === 'chatSetup')) && (
				<button
					className={`${inform.length > 0 && !inform.includes('selfDelete') ? 'bRed' : 'bDarkGreen'} fs20 w100 marAuto marBotXxl padVerXs mw80 tWhite boldM boRadS border`}
					onClick={e => {
						e.preventDefault(), e.stopPropagation();
						let newWarn = [...inform];
						if (chatSetupData.type !== 'private') {
							if (chatSetupData.type === 'VIP' && !activeMembers.some(u => u.role === 'VIP')) newWarn.push('noVIP');
							else if (chatSetupData.type === 'group' && !activeMembers.some(u => u.role === 'admin')) newWarn.push('noAdmin');
							if (activeMembers.length < 2) newWarn.push('notEnoughMembers');
							if (!chatSetupData.name?.trim() || chatSetupData.name.length < 2) newWarn.push('noName');
						}
						if (chatSetupData.type === 'private' && (activeMembers.length !== 2 || String(activeMembers[0].id) !== String(brain.user.id))) newWarn.push('privateMemberCount');
						if (!chatSetupData.id && (chatSetupData.content?.trim().length || 0) < 2) newWarn.push('noMessage');
						if (newWarn.length > 0) return setInform([...new Set(newWarn)]);
						setTimeout(() => chatMan({ mode: !chatSetupData.id ? 'createChat' : 'setupChat' }), 0);
					}}>
					{inform.length > 0 && !inform.includes('selfDelete') ? 'Oprav nedostatky výše!' : chatSetupData.id ? 'Uložit změny' : 'Vytvořit chat'}
				</button>
			)}
		</create-chat>
	);
}

export default ChatSetup;
