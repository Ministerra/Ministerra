import { catsSrc, catTypesStructure, eventTitles } from '../../sources';
import { delUndef, inflectName, fetchOwnProfile, getTimeFrames } from '../../helpers';
const extraFieldsSrc = { cz: ['Detail', 'Sraz', 'Kontakt', 'Vstupné', 'S sebou', 'Odkazy', 'Pořadatel'], en: ['Detail', 'Meet', 'Contacts', 'Fee', 'Take', 'Links', 'Organizer'] };
const friendlyMeetingsHeaders = new Map(
	Object.entries({
		a1: 'venku',
		a2: 'na pivku',
		a3: 'na kávě',
		a4: 'u her',
		a5: 'uvnitř',
		a6: 'na pařbě',
		a7: 'na diskuzi',
		a8: 'anglicky',
		a9: 'na cvičení',
		a10: 's pejsky',
		a11: 'teenagerů',
		a12: 'nezadaných',
		a13: 'businessové',
		a14: 'v přírodě',
		a15: 'se seniory',
		a16: 's romy',
		a17: 'na výletě',
		a18: 'u jídla',
		a19: 'u hobby',
		a20: 'u sportu',
	})
);

import { useEffect, useState, useRef } from 'react';
import { useLoaderData, useNavigate, useOutletContext } from 'react-router-dom';
import useFadeIn from '../hooks/useFadeIn';
import CatFilter from '../comp/CatFilter';
import ImageCropper from '../comp/ImageCropper';
import axios from 'axios';
import Filter from '../comp/Filter';
import LocationPicker from '../comp/LocationPicker';
import DateTimePicker from '../comp/DateTimePicker';
import { forage } from '../../helpers';
import { findNearestCity, getDistance } from '../utils/locationUtils';
import EveMenuStrip from '../comp/menuStrips/EveMenuStrip';
import Invitations from '../comp/Invitations';
import { updateGalleryArrays } from '../comp/bottomMenu/Gallery/updateGalleryArrays';
import { notifyGlobalError } from '../hooks/useErrorsMan';
import EventHeaderImage from '../comp/EventHeaderImage';

function Editor(props: any) {
	const { quickType = null, showMan, nowAt, brain } = ((useOutletContext() as any) || props) as any;
	const loaderEvent = useLoaderData() as any,
		navigate = useNavigate(),
		event = quickType === null ? loaderEvent : null,
		[data, setData] = useState<any>(
			brain.editorData || {
				...(event
					? {
							...event,
							starts: new Date(event.starts),
							ends: event.ends ? new Date(event.ends) : null,
							meetWhen: event.meetWhen ? new Date(event.meetWhen) : null,
							locaMode: !event.location && !event.place ? 'city' : event.location?.startsWith('+') ? 'radius' : 'exact',
							location: event.location?.startsWith('+') ? event.location.slice(1) : event.location,
					  }
					: { inter: 'sur', priv: 'pub', type: quickType, locaMode: 'exact' }),
			}
		);
	const [snap, setSnap] = useState<any>({ cats: data.type ? catsSrc.cz.filter(cat => catTypesStructure.get(cat).ids.includes(data.type)) : [catsSrc.cz[0]], types: [data.type] }),
		{ title, image, meetHow, meetWhen, detail, starts, ends, contacts, fee, links, takeWith, organizer } = data,
		extraFields = { detail, meet: meetHow || meetWhen, contacts, fee, links, takeWith, organizer },
		[selExtraFields, setSelExtraFields] = useState<any[]>(event ? Object.keys(extraFields).filter(key => extraFields[key]) : []),
		isQuick = quickType !== null,
		[fadedIn, setFadedIn] = useFadeIn({ mode: isQuick ? 'quick' : 'editor' }) as any,
		[modes, setModes] = useState({ menu: false, invite: false }),
		[status, setStatus] = useState({ own: true }),
		[pendingInvitations, setPendingInvitations] = useState([]),
		[inviteStatus, setInviteStatus] = useState('idle'),
		extraFieldsTexts = useRef<any>({}),
		[inform, setInform] = useState([]),
		scrollTarget = useRef<any>(null);
	const shouldShowAttendanceButtons = isQuick || (!event && (data.type?.startsWith('a') || data.title));

	// INITIAL SCROLL--------------------------------------------------
	useEffect(() => {
		(async function initHandler() {
			if (!event && !(await forage({ mode: 'get', what: 'token' }))) return navigate('/entrance');
			if (!isQuick) window.scrollTo({ top: 0, behavior: 'smooth' });
			if (brain.editorData) delete brain.editorData;
			if (scrollTarget.current) setTimeout(() => window.scrollTo({ top: scrollTarget.current.getBoundingClientRect().top + window.scrollY - 100, behavior: 'smooth' }), isQuick ? 150 : 0);
		})();
	}, [window.location.pathname, scrollTarget.current]);

	useEffect(() => {
		if (isQuick && data.inter !== 'sur') setData(prev => ({ ...prev, inter: 'sur' }));
	}, [isQuick, data.inter]);

	// TODO before user confirms creatino of quick meeting, give him the option to choose from peopel or friendlyMeetings in the given radius
	// BUG check whether there is no date time shift after saving and drestoring dates from session storage
	// todo when editing event. need to show also the invited users for some  management. Or maybe just show the count and fetch data on some button click

	// MANAGER -------------------------------------------------------
	async function man(inp, val = null) {
		setInform([]);

		// VALUES SETTING -------------------------------------------
		if (inp === 'inter') setData(prev => ({ ...prev, inter: val }));
		else if (inp === 'image') setData(prev => ({ ...prev, image: val }));
		else if (inp === 'locaMode')
			setData(prev => {
				const next = { ...prev, locaMode: val };
				if (val === 'city') Object.assign(next, { location: '', lat: null, lng: null, place: null });
				else Object.assign(next, { city: null, cityID: null, location: '', lat: null, lng: null, place: null });
				return next;
			});
		else if (inp === 'location') setData(prev => ({ ...prev, ...(data.locaMode === 'city' ? { city: val, cityID: null } : val) }));
		else if (inp === 'types') setData(prev => ({ ...prev, type: val })), setSnap(prev => ({ ...prev, types: [val] }));
		else if (inp === 'cats') setSnap(prev => ({ ...prev, cats: [val] })), setData(prev => ({ ...prev, type: null }));
		else if (inp === 'extraFields') setSelExtraFields(prev => (prev.includes(val) ? prev.filter(item => item !== val) : [...prev, val]));
		else if (inp === 'pendingInvite') {
			setPendingInvitations(prev => {
				if (prev.some(user => user.id === val.id)) return prev.filter(user => user.id !== val.id);
				return [...prev, val];
			});
			return;
		} else if (inp !== 'submit') setData(prev => ({ ...prev, [inp]: val, ...(inp === 'cityID' && { city: null }) }));

		// SUBMITING ------------------------------------------
		if (inp === 'submit') {
			const newWarn = [];
			if (!data.type.startsWith('a') && (data.title || '').length < 2) newWarn.push((data.title || '').length === 0 ? 'noTitle' : 'shortTitle');
			if (!data.city && !data.cityID) newWarn.push('noCity');
			if (data.locaMode !== 'city' && (!data.location || data.lat === undefined || data.lng === undefined)) newWarn.push('noLocation');
			if (!data.starts) newWarn.push('noStarts');
			if (!data.type) newWarn.push('noType');
			if (newWarn.length > 0) return setInform(newWarn);

			try {
				const axiData = delUndef({ ...data }, event ? true : false, true);
				// bug probably just send empty strings instead of nulls

				// CITY LOOKUP --------------------------------------
				if (data.locaMode === 'city') {
					axiData.cityID ??= brain.cities.find(city => city.hashID === data.city.hashID)?.cityID;
					['lat', 'lng', 'location', 'place', 'country', 'region', 'county'].forEach(key => delete axiData[key]);
					if (axiData.cityID) delete axiData.city;
				} else if (data.locaMode === 'radius') axiData.location = `+${axiData.location}`;

				if (data.locaMode !== 'city' && !axiData.cityID) {
					const possibleCities = brain.cities
						.filter(city => city.city === data.city && getDistance(city.lat, city.lng, axiData.lat, axiData.lng) < 10)
						.sort((a, b) => a.distance - b.distance);
					if (possibleCities.length > 0) axiData.cityID = possibleCities[0].cityID;
					else {
						try {
							const nearestCityResult = await findNearestCity(data.city, { lat: data.lat, lng: data.lng });
							if (nearestCityResult) {
								const storedCityID = brain.cities.find(city => city.hashID === nearestCityResult.hashID)?.cityID;
								if (storedCityID) (axiData.cityID = storedCityID), delete axiData.city;
								else axiData.city = nearestCityResult;
							}
						} catch (err) {
							console.error('Error finding city with Mapy.cz API:', err);
						}
					}
				}
				// REMOVE DESELECTED EXTRA FIELDS FROM REQUEST (editing only) --------------------
				if (event) {
					const extraFieldKeys = {
						detail: ['detail'],
						meet: ['meetHow', 'meetWhen'],
						contacts: ['contacts'],
						fee: ['fee'],
						links: ['links'],
						takeWith: ['takeWith'],
						organizer: ['organizer'],
					};
					Object.entries(extraFieldKeys).forEach(([key, dbKeys]) => {
						if (!selExtraFields.includes(key)) dbKeys.forEach(dbKey => (event[dbKey] ? (axiData[dbKey] = null) : delete axiData[dbKey])); // null to clear existing db value, delete to skip newly typed value
					});
				}
				// DELETE IRRELEVANT DATA --------------------------------------------------------
				if (event) for (const key in axiData) !['id', 'cityID'].includes(key) && (axiData[key] === event[key] || ['label', 'imgVers'].includes(key)) && delete axiData[key];
				else delete axiData.locaMode;

				let navigateTo = event?.id;
				if (Object.keys(axiData).length) {
					// PROCESS DATES -----------------------------------------------------
					(function processDates() {
						if (Date.parse(event?.starts) === starts.getTime()) delete axiData.starts;
						if (Date.parse(event?.ends) === ends?.getTime() || starts.getTime() === ends?.getTime()) delete axiData.ends;
						['starts', 'ends', 'meetWhen'].filter(key => axiData[key]).forEach(time => (axiData[time] = new Date(axiData[time]).getTime()));
					})();

					// AXIOS CALL -----------------------------------------------------
					const { createdID, cityData, imgVers } = (await axios.post('editor', axiData)).data;

					navigateTo ??= createdID;

					// SEND PENDING INVITATIONS AFTER EVENT CREATION
					if (!event?.id && createdID && pendingInvitations.length > 0) {
						try {
							setInviteStatus('sending');
							await axios.post('invites', {
								mode: 'inviteUsers',
								targetEvent: createdID,
								userIDs: pendingInvitations.map(user => user.id),
								userID: brain.user.id,
							});
							setInviteStatus('success'), setPendingInvitations([]);
						} catch (inviteError) {
							notifyGlobalError(inviteError, 'Nepodařilo se odeslat pozvánky.');
							setInviteStatus('error');
						}
					}

					// FINALIZE DATA -------------------------------------------------------
					if (data.inter) (brain.user.unstableObj || brain.user).eveInters.push([createdID, data.inter, data.priv]);
					if (cityData) brain.cities.push(cityData), (axiData.cityID = cityData.cityID);
					if (imgVers) axiData.imgVers = imgVers;
					delete axiData.locaMode;

					// CRATE OR UPDATE EVENT OBJECT -------------------------------------------
					if (!event?.id) {
						if (data.type.startsWith('a')) (brain.user.eveUserIDs ??= {}), (brain.user.eveUserIDs[createdID] = [brain.user.id]);
						(function createEventObj() {
							brain.events[createdID] = {
								...axiData,
								id: createdID,
								own: true,
								state: 'basiDeta',
								inter: data.inter,
								cursors: 'gotAll',
								commsSyncedAt: Date.now(),
								city: cityData?.city || brain.cities.find(city => city.cityID === axiData.cityID)?.city,
								imgVers: axiData.imgVers || event?.imgVers || 0,
								...(axiData.hashID && { hashID: axiData.hashID }),
								score: 0,
								starts: Date.parse(data.starts),
								ends: data.ends ? Date.parse(data.ends) : null,
								meetWhen: data.meetWhen ? Date.parse(data.meetWhen) : null,
								owner: brain.user.id,
								surely: data.inter === 'sur' ? 1 : 0,
								maybe: data.inter === 'may' ? 1 : 0,
								rank: 0,
								interPriv: data.priv,
								commsData: [],
								basiVers: 1,
								detaVers: 1,
								sync: Date.now(),
							};
						})();

						// Update friendlyMeetings stats and snaps history
						(function updateStatsAndHistory() {
							if (data.type.startsWith('a')) {
								const stats = (brain.meetStats[axiData.cityID] ??= {});
								(stats[data.type] ??= { events: 0, people: 0 }), stats[data.type].events++, stats[data.type].people++;
							}
							// Determine which time frames the event belongs to
							const timeFrames = getTimeFrames();
							const belongsInto = Object.keys(timeFrames).filter(key => {
								const timeFrame = timeFrames[key];
								return starts >= timeFrame.start && starts <= timeFrame.end;
							});

							// Update user history and available types in time frames
							brain.user.history.forEach(snap => {
								if (snap.init || (snap.types.includes(data.type) && snap.cities.includes(axiData.cityID) && belongsInto.includes(snap.time))) {
									if (!snap.types.includes(data.type)) snap.types.push(data.type);
									const availObj = brain.citiesTypesInTimes[axiData.cityID];
									if (availObj) belongsInto.forEach(timeframe => !availObj[timeframe].includes(data.type) && availObj[timeframe].push(data.type));
								}
							});

							// UPDATE GALLERY ARRAYS --------------------------------------------
							updateGalleryArrays(brain, createdID, { addToOwn: true, addToInt: data.inter === 'int', addToSurMay: data.inter && data.inter !== 'int' });
						})();
					} else {
						// CLEAN axiData BEFORE ASSIGNING TO EVENT ------------
						const { city, locaMode, inter, ...cleanAxiData } = axiData; // remove non-serializable/transient props
						Object.assign(event, cleanAxiData);
					}
					const eveToStore = event?.id ? event : brain.events[createdID]; // pick correct event ref
					forage({ mode: 'set', what: 'events', val: [eveToStore] }), forage({ mode: 'set', what: 'user', val: brain.user });
				}

				navigate(`/event/${navigateTo}!${data.title ? encodeURIComponent(data.title.slice(0, 50)).replace(/%20/g, '_') : ''}`);
				if (isQuick) setTimeout(() => showMan('quick', false), 1000);
			} catch (err) {
				console.log('🚀 ~ file: Editor.jsx:74 ~ man ~ err:', err);
				const errorData = err.response?.data;
				const errorCode = typeof errorData === 'string' ? errorData : errorData?.code;
				const displayText = (typeof errorData === 'object' && errorData?.message) || errorCode || 'Něco se pokazilo.';
				setInform([[displayText]]);
				notifyGlobalError(err, displayText);
			}
		}
	}
	function generateTitle(name, eventType) {
		const { beforeName = [], afterName = [], instrumental = [] } = eventTitles[eventType] || {};
		const getRandom = arr => (Array.isArray(arr) && arr.length ? arr[Math.floor(Math.random() * arr.length)] : null);
		const [randomBefore, randomAfter, randomInstrumental] = [beforeName, afterName, instrumental].map(getRandom);
		const safeName = name || 'Kamarád',
			titleOne = randomInstrumental ? `${randomInstrumental} s ${inflectName(safeName)}?` : null,
			titleTwo = randomBefore && randomAfter ? `${randomBefore} ${safeName}${randomAfter}` : null;
		return (Math.random() > 0.5 ? titleOne || titleTwo : titleTwo || titleOne) || `${safeName}?`;
	}

	return (
		<create-event
			ref={scrollTarget}
			onClick={() => setModes(prev => ({ ...prev, menu: false, invite: false }))}
			class={`w100 block  ${isQuick ? '' : 'mihvh101'} marAuto zinMax posRel  posRel textAli`}>
			{/* QUICK FRIENDLY HEADER --------------------------------------------------------- */}
			{isQuick && (
				<>
					<header-div class={`  w100 block   posAbs topCen zin1 flexCol aliCen  marAuto`}>
						<div className={`bgWhite topCen opacityXs shaCon mih1 posAbs w100 zin10`} />
						<div className={`bgWhite topCen opacityM shaCon mih0-5 posAbs w100 zin20`} />
						<images-wrapper class={'hvh25 bgTransXs block round'}>
							<img loading='lazy' className='w100 maskLow hvw30 mh33 zin2 cover' src={`/covers/${quickType}.png`} alt='' />
							<img
								onClick={() => showMan('quick', false)}
								className='wvw50 posAbs topCen bgTrans   zinMax mw45  padHorL  pointer  boRadM   upExtra  hover padVerS    '
								src={`/icons/types/${quickType}.png`}
								alt=''
							/>
						</images-wrapper>
					</header-div>
					<empty-div class='block hvw20 mh18' />
				</>
			)}
			{/* CATEGORY + EVENT TYPE ---------------------- */}
			{!isQuick && !event && <CatFilter {...{ fadedIn, nowAt, snap, snapMan: man }} />}
			{!isQuick && !event && <Filter {...{ fadedIn, snapMan: man, nowAt, snap }} />}

			{/* EVENT IMAGE WITH TYPE ICON WHEN EDITING ---------------------- */}
			{data.id && <EventHeaderImage event={{ ...event, type: event.type }} fadedIn={fadedIn} />}

			{/* MENU BUTTON -------------------------------------------------*/}
			{event && (
				<editor-menu class={`zinMenu mw180 marAuto  block  ${modes.menu ? 'marBotXxxl' : ''}`}>
					{modes.menu && <empty-div class='block w100 hr5' />}
					<menu-comp onClick={e => (e.stopPropagation(), setModes(prev => ({ ...prev, menu: !prev.menu, invite: false })))} class={` flexCol w100`}>
						<menu-button class='shaBlue boRadXxs mw60 marAuto bgTransXxs padVerXxxs zinMaXl marTopS padHorXs bold'>
							<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='currentColor' className='w100 mw4'>
								<path fillRule='evenodd' d='M4 5h16a1 1 0 010 2H4a1 1 0 010-2zm0 6h16a1 1 0 010 2H4a1 1 0 010-2zm0 6h16a1 1 0 010 2H4a1 1 0 010-2z' clipRule='evenodd' />
							</svg>
						</menu-button>
						{modes.menu && (
							<>
								<EveMenuStrip {...{ obj: event, brain, nowAt: 'editor', modes, setModes, status, setStatus, isCardOrStrip: false, userCardSetModes: () => {} }} />
								<blue-divider class={` hr0-5 borTop block bInsetBlueTopXl borTop bgTrans  w100     marAuto   `} />
							</>
						)}
					</menu-comp>
				</editor-menu>
			)}

			{/* EVENT INFO ------------------*/}

			{data.type !== null && data.type !== undefined && (
				<event-info class={`fadingIn ${fadedIn.includes('EventInfo') || isQuick ? 'fadedIn' : ''}  w100 mw185  fPadHorS  textAli flexCol  marAuto labelM`}>
					{/* EVENT IMAGE / CROPPER ---------------*/}
					{!data.type?.startsWith('a') && (
						<event-pic class={`fadingIn ${fadedIn.includes('Cropper') ? 'fadedIn' : ''} mw180 w100 marAuto  marTopL`}>
							<ImageCropper data={data} superMan={man} nowAt={nowAt} image={image} />
						</event-pic>
					)}
					{/* PLACE AND ADRESS---------------------------------------------- */}
					{isQuick &&
						(() => {
							const headerTitle = friendlyMeetingsHeaders.get(quickType);
							const details = { title: headerTitle, description: '' };
							return (
								<quickmeet-title class='zinMax padTopS  w100 mw80 boRadM   marAuto fitContent  '>
									<span className='fs30  lh1  tShaWhiteXl  block  '>
										Setkání
										<strong className={'marLefS tShaWhite   fs42 xBold'}>{`${details?.title}`}</strong>
									</span>
									<span className='fs12 inlineBlock '>
										Toto je <strong className='xBold'>zkrácený formulář</strong>, pro plnou verzi
										<button onClick={() => ((brain.editorData = data), navigate('editor'))} className='borRed inline xBold padHorS borTopLight tGreen'>
											vytvoř událost.
										</button>
									</span>
								</quickmeet-title>
							);
						})()}

					{/* TITLE AND DESCRIPTION ---------------------------------------------- */}
					{(isQuick || data.type !== null || data.starts) && (
						<times-wrapper class={`block posRel noBackground ${!isQuick && data.starts ? 'marTopXxxl padTopM' : isQuick ? 'marTopXl' : 'marTopM'}    w100`}>
							{!data.starts && !isQuick && (
								<info-texts class='posRel  marTopXxxl marBotXs  block'>
									<span className='boldM block textSha marBotXxxs  opacityL fs16 tDarkBlue'>Začátek tvé události</span>
									<span className='fs7 inlineBlock marBotXxxs textSha opacityL'>{`začátek je povinný, konec je nepovinný. Vyber rok -> měsíc -> den -> hodinu -> minutu.`}</span>
								</info-texts>
							)}
							{!data.starts && !isQuick && <blue-divider class='hr0-3  zin1 block borRed bInsetBlueTopXl borTop bgTrans w80 marAuto' />}
							<DateTimePicker {...{ superMan: man, starts, ends, nowAt, meetWhen: data.meetWhen, ...(isQuick && { mode: 'week', noAutoHide: true }) }} />
						</times-wrapper>
					)}

					{/* LOCATION, CITY, PLACE ---------------------------------- */}
					{data.starts && (
						<place-wrapper class={`block   posRel   posRel noBackground marTopM  marAuto w100`}>
							<span className='xBold block textSha marBotXxs marTopXl opacityL fs16 tDarkBlue'>Místo či oblast setkání</span>
							<span className='fs10 inlineBlock marBotS textSha opacityL'>
								<strong>Doporučujeme:</strong> napiš stručně jak by sis setkání představoval, koho bys rád potkal apod. Je to nepovinné, ale zvýší to tvé události úspěšnost.
							</span>

							{/* LOCATION MODE ---------------------------------------------------------- */}
							{(isQuick || data.type.startsWith('a')) && (
								<loca-mode class='flexCen w100  marAuto borderLight  borBot2    posRel  bPadVerXs  mw135  marTopXxs'>
									{['radius', 'exact', 'city'].map(option => {
										return (
											<button
												key={option}
												className={`${data.locaMode === option ? 'bDarkGreen tWhite posRel  fs12 boldM' : 'bold fs12'} w50 xBold bHover `}
												onClick={() => man('locaMode', option)}>
												{option === 'exact' ? 'Na přesném místě' : option === 'radius' ? 'v okolí místa' : 'kdekoliv ve městě'}
											</button>
										);
									})}
								</loca-mode>
							)}
							{!inform.includes('noCity') && <blue-divider class='hr0-5  zin1 block borRed bInsetBlueTopXl borTop bgTrans w40 marAuto' />}

							{/* LOCAITON PICKER -------------------------------------------------- */}
							{(!isQuick || data.locaMode) && (
								<LocationPicker data={data} brain={brain} superMan={man} nowAt={'editor'} isEditing={!!event} isFriendly={data.type.startsWith('a')} eventCity={event?.cityID} />
							)}
						</place-wrapper>
					)}
					{(data.city || data.cityID) && (
						<title-descrip class='block w100    posRel posRel'>
							<info-texts class='posRel marBotXs marTopXxxl  block'>
								<span className='xBold block textSha marBotXxs marTopM opacityL fs16 tDarkBlue'>Titulek a úvodní slovo</span>
								<span className='fs10 inlineBlock marBotXxxs textSha opacityL'>
									<strong>Doporučujeme:</strong> napiš stručně jak by sis setkání představoval, koho bys rád potkal apod. Je to nepovinné, ale zvýší to tvé události úspěšnost.
								</span>
							</info-texts>
							{/* EVENT TITLE-------------------------------------------- */}
							{data.starts && (data.city || data.cityID) && (
								<input
									placeholder={`Titulek události ${data.type.startsWith('a') ? '(nepovinný)' : '(povinný)'} ...`}
									className='hr6 fs16 boldXs noBackground zinMax   w100'
									type='text'
									value={title}
									name='title'
									onChange={e => man('title', e.target.value)}
								/>
							)}

							{/* SHORT DESCRIPTION-------------------------------------------- */}
							{(data.title || (data.type.startsWith('a') && (data.city || data.cityID))) && (
								<short-description className='flexCol block shaBot bInsetBlueTopXs posRel'>
									<textarea
										defaultValue={data['shortDesc']}
										placeholder='nepovinný stručný popis události ...'
										className='textArea shaTopLight  w100  bInsetBlueTopXs noBackground   borTopLight padTopM fPadHorS padBotS textAli fs11'
										rows={6}
										onChange={e => man('shortDesc', e.target.value)}
									/>

									{/* AUTO FILL BUTTON ----------------------------------------------------- */}
									{snap.cats[0] === 'Přátelské' && (
										<button
											onClick={async () => {
												if (!brain.user.priv) await fetchOwnProfile(brain);
												man('title', generateTitle(brain.user.first, data.type));
												const exps = Array.isArray(brain.user.exps) ? brain.user.exps : [],
													favs = Array.isArray(brain.user.favs) ? brain.user.favs : []; // ------------------------ safe defaults for autofill
												let shortDescription = '';
												if (exps.length) shortDescription += `. Mé odborné znalosti: ${exps.join(', ')}. `;
												if (favs.length) shortDescription += `Rád si povídám o: ${favs.join(', ')}.`;
												if (brain.user.shortDesc) shortDescription += `${shortDescription ? ' +' : ''}Něco málo o mě: ${brain.user.shortDesc}`;
												man('shortDesc', shortDescription);
											}}
											className='w80  bDarkBlue tWhite posAbs arrowUp borRed botCen downLittle zinMax marAuto tBlue border mw40 fs10 bold padVerXxs boRadXxxs'>
											automaticky vyplnit
										</button>
									)}
								</short-description>
							)}
						</title-descrip>
					)}

					{/* COPY DATA AND GO TO EDITOR ------------------------------------------------- */}
					{isQuick && (data.hashID || data.cityID) && (
						<button
							onClick={() => ((brain.editorData = data), showMan('quick', false), navigate('/editor'))}
							className='bgTransXs bGlass shaBlue borderRed downLittle  borderBot bInsetGreenBot    tBlue zinMax  posRel padAllXs bold fs14  boRadXxs w80 marAuto mw60'>
							Přejí na plný formulář
						</button>
					)}

					{/* EXTRAS-ADD ---------------------------------------------- */}
					{!isQuick && ((data.type.startsWith('a') && (data.city || data.cityID)) || data.title) && (
						<extrafields-add class='marTopXxxl  block'>
							<info-texts class='posRel marBotXs block'>
								<span className='xBold block textSha marBotXxxs marTopM opacityL fs25 marBotXs'>Volitelné informace</span>
								{/* SHORT DESCRIPTION-------------------------------------------- */}
								<span className='fs10 inlineBlock marBotXxxs textSha opacityL'>
									<strong>Doporučujeme:</strong> Vyber si, které další informace chceš do popisku své události přidat.
								</span>
							</info-texts>
							<extras-toggles class='w100   posRel  flexCen  marAuto flexCen wrap'>
								{extraFieldsSrc.cz.map((item, i) => (
									<button
										key={item}
										name={extraFieldsSrc.en[i].toLowerCase()}
										className={`${
											selExtraFields.includes(extraFieldsSrc.en[i].toLowerCase()) ? 'xBold tSha10 bInsetBlueBotXl borTop2  boRadXxxs tWhite' : 'xBold'
										} grow  fs12  shaComment bHover padHorS shaBlue padVerXxs bgTrans  posRel  `}
										onClick={() => man('extraFields', extraFieldsSrc.en[i].toLowerCase())}>
										{item}
									</button>
								))}
							</extras-toggles>
						</extrafields-add>
					)}

					{/* EXTRA FIELDS -----------------------------------------------------*/}
					{selExtraFields.length > 0 && (
						<extra-fields class=' bInsetBlueTopS posRel w100   textAli marAuto'>
							<inner-wrapper class='w100 marTopXxxl flexCol aliCen mw160  marAuto gapXl'>
								{/* MEET */}
								{selExtraFields.includes('meet') && (
									<city-meet class='flexCol w100  marAuto'>
										<span className='fs16 textSha inlineBlock  lh1 xBold'>Kde a jak se potkáme?</span>
										<span className='  fs10  marAuto marBotXs'>
											<strong className='  '>Doporučujeme:</strong> níže popsat místo a způsob setkání, tedy i jak se poznáte.
										</span>
										<DateTimePicker {...{ superMan: man, starts: meetWhen, prop: 'meetWhen', maxDate: data.starts, mode: 'week' }} />
										<textarea
											defaultValue={meetHow}
											placeholder='Sem napiš detaily ke srazu = popis místa setkání, oblečení, jak se poznáte/najdete, kontakt ...'
											className='textArea w100 shaSubtle shaSubtleLong borBotLight borTopLight   boRadXs borderLight padAllS textAli fs15'
											rows={4}
											onChange={e => (man('meetHow', e.target.value), (extraFieldsTexts.current.meetHow = e.target.value))}
										/>
									</city-meet>
								)}
								{[
									{ field: 'detail', title: 'Detailní popis události', rows: 10 },
									{ field: 'takeWith', title: 'Vezměte si s sebou', rows: 3 },
									{ field: 'contacts', title: 'Důležité kontakty', rows: 3 },
									{ field: 'fee', title: 'Info ke vstupnému', rows: 3 },
									{ field: 'links', title: 'Odkazy a weby', rows: 3 },
									{ field: 'organizer', title: 'Pořadatel či značka', rows: 1 },
								].map(({ field, title, rows }) => {
									if (selExtraFields.includes(field)) {
										return (
											<div key={field} className='flexCol w100 marAuto'>
												<span className='fs14 inlineBlock lh1 xBold textSha marBotXs'>{title}</span>
												<textarea
													title={title}
													defaultValue={data[field]}
													className='textArea    w100 shaSubtle shaSubtleLong borBotLight borTopLight   boRadXs borderLight padAllS textAli fs15'
													rows={rows}
													onChange={e => man(field, e.target.value)}
												/>
											</div>
										);
									}
								})}
							</inner-wrapper>
						</extra-fields>
					)}
				</event-info>
			)}
			{(data.city || data.cityID) && (
				<other-info class={'marTopXxxl block'}>
					{/* EVENT VISIBILITY (PRIV) --------------------------------------------- */}
					{data.title && !isQuick && !event && data.type !== null && data.type !== undefined && (
						<privacy-settings class={'block '}>
							<span className='boldM block textSha marBotXxxs marTopXl opacityL fs16 tDarkBlue'>Kdo událost uvidí a dorazíš?</span>
							<span className='fs10 inlineBlock marBotS textSha opacityL'>
								<strong>Doporučujeme:</strong> napiš stručně jak by sis setkání představoval, koho bys rád potkal apod. Je to nepovinné, ale zvýší to tvé události úspěšnost.
							</span>
							<privacy-buttons class='flexCen w100 bw25 bPadXs mw130 marAuto marTopXs shaComment borderBot shaComment gapXxs posRel'>
								{['public', 'links', 'trusts', 'invited', 'owner'].map(button => (
									<button
										key={button}
										className={`${data.priv === button.slice(0, 3) ? `bInsetBlueBotXl tWhite boldS` : 'boldXs'} noBackground fs12   zin1`}
										onClick={() => man('priv', button.slice(0, 3))}>
										{button === 'links' ? 'spojenci' : button === 'trusts' ? 'důvěrní' : button === 'public' ? 'Celá komunita' : button === 'owner' ? 'jen já' : 'pozvaní'}
									</button>
								))}
								<blue-divider class={` hr0-5  block bInsetBlueTopXl borTop bgTrans  posAbs botCen w100     marAuto   `} />
							</privacy-buttons>
						</privacy-settings>
					)}

					{/* PENDING INVITATIONS FOR NEW EVENTS */}
					{!event && (data.city || data.cityID) && data.type !== null && data.type !== undefined && (data.type.startsWith('a') || data.title) && (
						<pending-invitations class='marTopM block'>
							<Invitations
								{...({
									brain,
									obj: null,
									mode: 'eventToUsers',
									isPreparation: true,
									selectedItems: pendingInvitations,
									superMan: man,
									pendingMode: true,
									onSuccess: () => {},
									downMargin: true,
								} as any)}
							/>

							{/* INVITE STATUS ------------------------------------------------- */}
							{['sending', 'success', 'error'].map(status => {
								const statusTexts = { sending: 'Odesílám pozvánky...', success: 'Pozvánky úspěšně odeslány!', error: 'Chyba při odesílání pozvánek' };
								if (inviteStatus === status) {
									return (
										<invite-status key={status} class='marTopXs'>
											<span className='fs14 tBlue xBold'>{statusTexts[status]}</span>
										</invite-status>
									);
								}
							})}
						</pending-invitations>
					)}

					{/* EXISTING EVENT INVITATIONS */}
					{event && <Invitations {...({ brain, obj: event, onSuccess: () => setModes(prev => ({ ...prev, invite: false, menu: false })), downMargin: true, setModes } as any)} />}

					{data.type.startsWith('a') && (
						<attendance-note class='block marTopXs marBotXxs textAli'>
							<span className='fs12 textSha boldM tGreen opacityL'>Na přátelských setkáních se s účastí z principu počítá</span>
						</attendance-note>
					)}

					{/* INTERREST BUTTONS ------------------------------------------------- */}
					{shouldShowAttendanceButtons && (
						<inter-sub class='flexCen w100 bw33 bPadXs mw130 marAuto marBotS   shaComment borderBot shaComment gapXxs'>
							{[
								{ inter: 'may', text: 'možná ', class: 'bBlue' },
								{ inter: 'sur', text: 'přijdu!', class: 'bDarkGreen' },
								{ inter: false, text: 'nepřijdu', class: 'bRed' },
							].map(button => {
								const isDisabled = data.type.startsWith('a') && button.inter !== 'sur';
								return (
									<button
										key={button.text}
										disabled={isDisabled}
										style={isDisabled ? { pointerEvents: 'none', opacity: 0.6 } : undefined}
										className={`${data.inter === button.inter ? `${button.class} xBold tWhite boldM` : 'boldM'} ${isDisabled ? 'opacityL' : ''} noBackground fsC boRadXs  zin1`}
										onClick={() => {
											if (isDisabled) return;
											man('inter', button.inter);
										}}>
										{button.text}
									</button>
								);
							})}
						</inter-sub>
					)}

					{/* WARNING MESSAGES ------------------------------------------------*/}
					{inform.length > 0 && (
						<inform-messages class='marBotXs block marTopS '>
							{(() => {
								const informTexts = {
									noType: 'Není zvolen typ události',
									noTitle: 'název události je povinný',
									shortTitle: 'Název musí mít alespoň 2 znaky',
									noCity: 'chybí místo konání',
									noStarts: 'vyplň začátek události',
									error: 'Zápis selhal! Za 20 vteřin zopakuj.',
								};
								const actualWarnings = Object.keys(informTexts).filter(warn => inform.includes(warn));
								return actualWarnings.map((inform, index) => (
									<span key={inform} className='tRed marRigXs xBold fsC  lh1 inlineBlock aliCen'>
										{`${index > 0 ? ' + ' : ''}${informTexts[inform]}`}
									</span>
								));
							})()}
						</inform-messages>
					)}

					{/* SUBMIT BUTTON ------------------------------ */}
					{(data.type.startsWith('a') || data.title || (isQuick && (data.city || data.cityID))) && data.type !== null && data.type !== undefined && (
						<button
							onClick={() => man('submit')}
							className={`fadingIn ${(isQuick && (data.city || data.cityID)) || fadedIn.includes('EventInfo') ? 'fadedIn' : ''} ${
								inform.length > 0 ? 'bRed' : 'bDarkGreen'
							} tWhite bHover xBold fs20 w95 mw80  posRel  marBotXxs marAuto  ${!shouldShowAttendanceButtons ? 'marTopXxxl' : ''} padVerS boRadS`}>
							{inform.length > 0 ? 'Vyplň povinné údaje!' : !event ? (isQuick ? 'Zveřejnit přátelské setkání' : 'Vytvořit událost!') : 'Uložit změny události'}
						</button>
					)}
				</other-info>
			)}
			{!isQuick && <empty-div class='block hvw14 mih20' />}
		</create-event>
	);
}

export default Editor;
