import { useState, useRef, memo } from 'react';
const lang = { Expertise: 'Odbornost', Services: 'Služby', Hobbies: 'Zájmy', Persona: 'Osobnost', Special: 'Speciální', Ethnics: 'Etnicita' };
import useCentralFlex from '../hooks/useCentralFlex';
import { USER_TRAITS } from '../../../shared/constants';
import { MAX_COUNTS } from '../../../shared/constants';

function Traits({ data = {}, superMan, nowAt, avail = {}, sherMode }: any) {
	const topEdge = useRef(null);
	const [activeCat, setActiveCat] = useState(Array.from(USER_TRAITS.keys())[0]);
	const [design, setDesign] = useState(1),
		[invertButton, setInvertButton] = useState(null),
		invertTimeout = useRef(null),
		bWidth = (useCentralFlex as any)('traitsCats', [], nowAt, Array.from(USER_TRAITS.keys()).length);

	// MANAGER -----------------------------------------------------------------------------
	function man(inp, cat) {
		let [curTraits, newTraits] = [[...(data.traits || [])], null];
		const tarTraits = cat ? Array.from(USER_TRAITS.get(cat).keys()).filter(key => nowAt === 'setup' || avail.traits.includes(key)) : [];
		if (inp === 'noneAll') {
			if (!cat) newTraits = curTraits.length > 0 ? [] : avail.traits;
			else
				newTraits = !data.traits?.some(trait => tarTraits.includes(trait))
					? Array.from(new Set(curTraits.concat(tarTraits.filter(key => nowAt === 'setup' || avail.traits.includes(key)))))
					: curTraits.filter(trait => !tarTraits.includes(trait));
		} else {
			if (invertButton === inp)
				clearTimeout(invertTimeout.current), setInvertButton(null), (newTraits = [...curTraits.filter(item => !tarTraits.includes(item)), ...tarTraits.filter(item => item !== inp)]);
			else if (
				(nowAt !== 'setup' || data.id) &&
				sherMode !== 'strict' &&
				data.traits &&
				(tarTraits.every(key => data.traits.includes(key)) || tarTraits.every(key => !data.traits.includes(key))) &&
				tarTraits.length > 1
			)
				setInvertButton(inp), (newTraits = [...curTraits.filter(item => !tarTraits.includes(item)), inp]), (invertTimeout.current = setTimeout(() => setInvertButton(null), 2000));
			else newTraits = curTraits.includes(inp) ? curTraits.filter(topic => topic !== inp) : curTraits.length >= MAX_COUNTS.traits && nowAt === 'setup' ? curTraits : [...curTraits, inp];
		}
		// SETUP LIMIT CLAMP -----------------------------------------------------------
		// Hard cap selection size to prevent abuse.
		if (nowAt === 'setup' && Array.isArray(newTraits) && newTraits.length > MAX_COUNTS.traits) newTraits = Array.from(new Set(newTraits)).slice(0, MAX_COUNTS.traits);
		superMan(
			'traits',
			newTraits.sort((a, b) => a - b)
		);
	}

	return (
		<traits-comp class={`block marAuto mw170 w100 posRel`} ref={topEdge}>
			{nowAt === 'setup' && (
				<title-texts class='posRel block'>
					{/* SECTION DESCRIPTION (EXISTING USERS ONLY) --- */}
					{data.id && (
						<>
							<span className='xBold marBotXxs inlineBlock fs15'>{'Zájmové skupiny'}</span>
							<p className='fs8 marBotXs mw160 lh1 marAuto'>{'Pomůže ti to lépe vyhledávat lidi a zvýší šance na seznámení.'}</p>
						</>
					)}
					{/* LIMIT WARNING (ALL USERS) --- */}
					{Array.isArray(data.traits) && data.traits.length >= MAX_COUNTS.traits && (
						<span className='fs16 tRed xBold textSha marBotXs block'>
							Dosažen limit: {MAX_COUNTS.traits}/{MAX_COUNTS.traits}
						</span>
					)}
				</title-texts>
			)}
			{/* DESIGN CHANGE BUTTON -------------------------------------------------------*/}
			<button
				className={`w80 mw40 fs7 borRed  arrowDown1 posRel hr3 boldM boRadXs tDarkBlue shaTopLight borTopLight boRadXs marBotXxs marAuto`}
				onClick={() => setDesign(design === 1 ? 2 : 1)}>{`Změnit zobrazení`}</button>
			{/* CATEGORIES VIEW -------------------------------------------------- */}
			{design === 1 && (
				<categories-view>
					{/* CATEGORIES BUTTONS -------------------------------------- */}
					<traits-cats class='flexCen w100 marAuto imw4 wrap'>
						{Array.from(USER_TRAITS.keys()).map(cat => {
							const keys = Array.from(USER_TRAITS.get(cat).keys()).filter(key => nowAt === 'setup' || avail.traits?.includes(key));
							const isCategoryEmpty = nowAt !== 'setup' && !keys.some(trait => avail.traits.includes(trait));
							const selectedCount = keys.filter(trait => data.traits?.includes(trait))?.length;
							return (
								<button
									style={{ width: '100%', ...(bWidth && { maxWidth: `${bWidth}px` }) }}
									className={`${
										activeCat === cat ? 'bInsetBlueTopXs2 posRel fs17  sideBors borTop  xBold' : selectedCount > 1 ? 'boldM  tBlue' : 'bgTrans boldS shaSubtle'
									} padVerXs fs11 textSha `}
									key={cat}
									onClick={() => setActiveCat(cat)}>
									<div className={`${isCategoryEmpty ? 'tDis' : ''} ${activeCat === cat ? 'arrowDown1' : 'tDarkBlue'} flexCen gapXxs`}>
										{selectedCount > 0 && (
											<span className='boRadXs shaCon tDarkBlue borderBot miw3 fs9 boldM'>
												{selectedCount}
												{avail.traits && `/${avail.traits.filter(trait => keys.includes(trait)).length}`}
											</span>
										)}
										{lang[cat] ? lang[cat] : cat}
									</div>
								</button>
							);
						})}
					</traits-cats>
					{/* GROUPS BUTTONS ---------------------------------------------- */}
					<traits-bs class='flexCen  bInsetBlueTopXs posRel growAll marAuto wrap'>
						<blue-divider class={`hr1 borTop zinMin block bInsetBlueTopXl bgTrans posRel w90 mw80 marAuto`} />
						<bs-wrapper class='marTopXxs flexCen wrap w100 marTopS marAuto'>
							{Array.from(USER_TRAITS.get(activeCat).entries()).map(([key, type]) => (
								<button
									className={`${invertButton === key ? 'boldM' : ''} ${nowAt !== 'setup' && !avail.traits.includes(key) ? 'tDis' : ''} ${
										data.traits?.includes(key) ? 'bInsetBlueTopS borTop xBold fs7 posRel' : 'shaBlue fs7 borBotLight'
									} padHorS mw14 bHover  padVerXxs`}
									key={key}
									onClick={() => (nowAt === 'setup' || avail.traits.includes(key) || data.traits.includes(key)) && man(key, activeCat)}>
									{invertButton === key ? 'invert?' : type}
								</button>
							))}
						</bs-wrapper>
					</traits-bs>
				</categories-view>
			)}
			{/* CLOUD VIEW ---------------------------------------------------------*/}
			{design === 2 && (
				<collapsed-view class='flexCen marTopS gapXxxs marAuto wrap'>
					{Array.from(USER_TRAITS.keys()).flatMap((cat, idx) => {
						const keys = Array.from(USER_TRAITS.get(cat).keys()).filter(key => nowAt === 'setup' || avail.traits.includes(key));
						const someTraitSelected = data.traits?.some(trait => keys.includes(trait));
						if (keys.length > 0)
							return [
								// CATEGORY NAME -------------------------------------
								<span key={cat} className={`${idx > 0 ? 'marLefM' : ''} textAli fs10 marRigS inlineBlock xBold`}>
									{lang[cat] ? lang[cat] : cat}
								</span>,
								// SELECT / DESELECT CAT BUTTON -------------------------------------
								keys.length > 1 && (sherMode !== 'strict' || (sherMode === 'strict' && someTraitSelected)) && (
									<button className={`${someTraitSelected ? 'tRed' : 'tBlue '} padAllXxs miw4 padVerXxs fs9 xBold borderLight boRadXs`} onClick={() => man('noneAll', cat)}>
										{someTraitSelected ? 'nic' : 'vše'}
									</button>
								),
								// GROUPS BUTTONS -------------------------------------
								Array.from(USER_TRAITS.get(cat).entries()).map(
									([key, type]) =>
										(nowAt === 'setup' || avail.traits.includes(key)) && (
											<button
												key={key}
												disabled={nowAt !== 'setup' && !avail.traits.includes(key)}
												className={`${invertButton === key ? 'boldM' : ''} ${
													data.traits?.includes(key) ? ' bInter bGlassSubtle borTop   fs7  posRel bold shaCon ' : 'fs7 borderLight '
												} padHorS padVerXxs fs7 bHover mw14`}
												onClick={() => man(key, cat)}>
												{invertButton === key ? 'invert?' : type}
											</button>
										)
								),
							].filter(Boolean);
					})}
				</collapsed-view>
			)}

			{/* SELECT / DESELECT CAT BUTTON -------------------------------------------*/}
			{((nowAt !== 'setup' &&
				(sherMode !== 'strict' || data.traits?.length > 0) &&
				(design === 1 ? Array.from(USER_TRAITS.get(activeCat).keys()).some(key => data.traits?.includes(key)) : data.traits?.length === 0)) ||
				data.traits?.length > 0) && (
				<button
					className={`${data.traits?.length > 0 ? 'tRed' : 'tBlue'} padAllXxs posAbs botCen moveDown miw16 fs11 xBold marAuto inlineBlock marTopXs borderLight boRadXs`}
					onClick={() => man('noneAll', design === 1 ? activeCat : null)}>
					{sherMode === 'strict' ||
					(design === 1
						? Array.from(USER_TRAITS.get(activeCat).keys()).some(key => data.traits?.includes(key))
						: nowAt === 'setup' || avail.traits?.some(trait => data.traits?.includes(trait)))
						? 'nic'
						: 'vše'}
				</button>
			)}
		</traits-comp>
	);
}
export default memo(Traits);
