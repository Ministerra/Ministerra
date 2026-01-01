import { delFalsy } from '../../shared/utilities';
import { createEveMeta, createUserMeta } from './helpers/metasCreate';
import { encode, decode } from 'cbor-x';
import { getLogger } from '../systems/handlers/logging/index';
import { REDIS_KEYS } from '../../shared/constants';
import { RedisKey } from '../../shared/types';

const logger = getLogger('ContentHelpers');

// CONSTANTS & INDICES --------------------------------------------------------
import { EVENT_META_INDEXES, USER_META_INDEXES } from '../../shared/constants';
const { evePrivIdx, eveCityIDIdx, eveOwnerIdx, eveTypeIdx, eveSurelyIdx, eveMaybeIdx } = EVENT_META_INDEXES;
const { userPrivIdx, userScoreIdx } = USER_META_INDEXES;

let redis;
// REDIS CLIENT SETTER ----------------------------------------------------------
const ioRedisSetter = c => (redis = c);

// HELPERS ---------------------------------------------------------------------
// Steps: keep allocation patterns centralized (Map-of-Map, Map-of-Array) so downstream loops stay dense and consistent.
const getMap = (m, k) => m.get(k) || m.set(k, new Map()).get(k);
const getArr = (m, k) => m.get(k) || m.set(k, []).get(k);

// STATE MANAGEMENT -------------------------------------------------------------
// Steps: allocate a fresh state container used by boot rebuild + recalc tasks; these maps get progressively filled, then flushed into Redis.
const getStateVariables = () => ({
	cityMetas: new Map(),
	cityPubMetas: new Map(),
	cityFiltering: new Map(),
	eveCityIDs: new Map(),
	friendlyEveScoredUserIDs: new Map(),
	eveMetas: new Map(),
	eveBasics: new Map(),
	eveDetails: new Map(),
	userMetas: new Map(),
	userBasics: new Map(),
	best100EveIDs: new Set(),
	remEve: new Set(),
});

// NEW EVENTS PROCESSING --------------------------------------------------------
// Steps: for each DB event row, split heavy vs indexable fields, build compact meta array, then populate basi/deta maps;
// mutate `data` in-place into `[id, metaArray]` so downstream processors can be generic and avoid re-destructuring.
async function processNewEvents({ data, state: { eveBasics, eveDetails, eveCityIDs, best100EveIDs }, newEventsProcessor }) {
	data.forEach((event, idx) => {
		// ROW SPLIT ---
		// Steps: isolate meta-critical fields first, then keep the remainder for basi/deta payloads.
		const { id, priv, cityID, type, starts, lat, lng, surely, maybe, score, comments, basiVers, detaVers, ...rest } = event;
		const owner = rest.owner?.startsWith('orphaned') ? null : rest.owner;
		const { meetHow, meetWhen, organizer, contacts, links, detail, fee, take, place, location, hashID, ...basic } = rest;

		if (basic.flag === 'can') basic.canceled = true;

		// META PACKING ---
		// Steps: pack into fixed index positions so privacy filtering is array-index based rather than object-key based.
		data[idx] = [id, createEveMeta({ priv, owner, cityID, type, starts, lat, lng, surely, maybe, comments, score, basiVers, detaVers })];

		// PAYLOAD MAPS ---
		// Steps: store compact “basi” and “deta” payloads with falsy stripping to reduce Redis+RAM footprint.
		eveBasics.set(id, delFalsy({ ...basic, basiVers: Number(basiVers), ...(place || location ? { ...(place ? { place } : { location }), hashID } : {}), ends: Number(new Date(basic.ends)) }));
		eveDetails.set(id, delFalsy({ meetHow, meetWhen, organizer, contacts, location, links, detail, fee, take, detaVers: Number(detaVers), ...(place ? { location } : {}) }));
		eveCityIDs.set(id, cityID);

		// BEST-OF CANDIDATES ---
		// Steps: opportunistically fill best100 set from public, non-archive-ish event types to avoid a second pass.
		if (best100EveIDs.size < 100 && priv === 'pub' && !type.startsWith('a')) best100EveIDs.add(id);
	});
	await newEventsProcessor({ data });
}

// NEW USERS PROCESSING ---------------------------------------------------------
// Steps: derive computed fields (age + attendance arrays), pack into compact user meta arrays, then store basi payloads;
// attendance parsing is done here to avoid repeated joins/expansion during hot path reads.
async function processNewUsers({ data, state: { userBasics }, userMetasProcessor }) {
	const today = Date.now();
	data.forEach((user, idx) => {
		const { id, priv, score, birth, gender, basiVers, imgVers, eveInterPriv, indis, basics, groups, ...basic } = user;
		// ATTENDANCE PARSE ---
		// Steps: parse SQL GROUP_CONCAT string into compact tuples; keep per-event privacy only for ind users.
		const attend =
			eveInterPriv?.split(',').map(e => {
				const [eid, inter, ep] = e.split(':');
				return [eid, inter, ...(priv === 'ind' && ep !== 'pub' ? [ep] : [])];
			}) ?? [];

		data[idx] = [id, createUserMeta({ priv, birth, today, gender, indis, basics, groups, score, imgVers, basiVers, attend })];
		userBasics.set(id, { ...basic, basiVers });
	});
	await userMetasProcessor({ data, is: 'new' });
}

// EVENT META PROCESSING HELPERS ---------------------------------------------
// Steps: unify all “event meta” build variants so city maps + filtering maps are updated identically (only owner label differs).
const processEveMetas = (data, { eveMetas, cityMetas, cityPubMetas, cityFiltering, eveCityIDs }, metaType) =>
	data.forEach(([id, meta]) => {
		if (metaType === 'orp') meta[eveOwnerIdx] = 'orphaned';
		const [strMeta, cID, p, o] = [encode(meta), meta[eveCityIDIdx], meta[evePrivIdx], meta[eveOwnerIdx]];

		// CITY ROUTING ---
		// Steps: public metas go into pub map; everything else goes into private map, and filtering map records the gate string.
		getMap(p === 'pub' ? cityPubMetas : cityMetas, cID).set(id, strMeta);
		getMap(cityFiltering, cID).set(id, metaType === 'orp' ? `${p}:orphaned` : `${p}:${o}`);
		eveMetas.set(id, strMeta);
		if (metaType === 'new') eveCityIDs.set(id, cID);
	});

// CONTEXT WRAPPERS ------------------------------------------------------------
// Steps: keep callsites readable by binding the `metaType` once.
const processOrpEveMetas = p => processEveMetas(p.data, p.state, 'orp'),
	processRecEveMetas = p => processEveMetas(p.data, p.state, 'rec'),
	processNewEveMetas = p => processEveMetas(p.data, p.state, 'new');

// REMOVED EVENTS PROCESSING -------------------------------------------------
// Steps: remove event from city maps + event keys, then for scored events recalc impacted users by re-processing their metas.
const keys = [REDIS_KEYS.eveMeta, REDIS_KEYS.eveBasi, REDIS_KEYS.eveDeta, REDIS_KEYS.friendlyEveScoredUserIDs],
	hKeys = [REDIS_KEYS.eveTitleOwner, REDIS_KEYS.eveCityIDs, REDIS_KEYS.eveLastCommentAt, REDIS_KEYS.eveLastAttendChangeAt, REDIS_KEYS.topEvents, 'newEveCommsCounts'] as RedisKey[];

async function processRemEveMetas({ data, state: { remEve, eveCityIDs, cityMetas, cityPubMetas, cityFiltering }, deletionsPipe: pipe, userMetasProcessor }) {
	for (const [id, meta] of data) {
		const [eventCityID, eventType] = [meta[eveCityIDIdx], meta[eveTypeIdx]];
		remEve.add(id);

		// DELETE QUEUE ---
		// Steps: delete from memory first, then queue Redis deletions into the caller pipeline for atomic-ish flush.
		[cityMetas, cityPubMetas, cityFiltering].forEach(map => map.get(eventCityID)?.delete(id));
		[REDIS_KEYS.CITY_METAS, REDIS_KEYS.cityPubMetas, REDIS_KEYS.cityFiltering].forEach(k => pipe.hdel(`${k}:${eventCityID}`, id));
		keys.forEach(k => pipe.del(`${k}:${id}`));
		hKeys.forEach(k => pipe.hdel(k, id));

		// USER RECALC (SCORED EVENTS) ---
		// Steps: scored events have user meta ties; rebuild those users so derived indexes remain consistent.
		if (eventType.startsWith('a')) {
			try {
				const userIDs = (await redis.zrange(`${REDIS_KEYS.friendlyEveScoredUserIDs}:${id}`, 0, -1)).map(s => s.split('_')[0]);
				if (!userIDs.length) continue;
				const users = (await redis.hmgetBuffer(REDIS_KEYS.userMetas, ...userIDs)).map((mb, i) => (mb ? [userIDs[i], decode(mb)] : null)).filter(Boolean);
				eveCityIDs.set(id, eventCityID);
				if (users.length) await userMetasProcessor({ data: users, is: 'rec' });
			} catch (e) {
				logger.error('contentHelpers.process_event_users_failed', { error: e, eventId: id });
			}
		}
	}
}

// USER META PROCESSING ------------------------------------------------------
// Updates user metas, handles attendance changes, and syncs city lists
const userKeys = [REDIS_KEYS.USER_BASI, REDIS_KEYS.tempProfile, REDIS_KEYS.blocks, REDIS_KEYS.links, REDIS_KEYS.invites, REDIS_KEYS.userSummary, REDIS_KEYS.trusted, REDIS_KEYS.userActiveChats],
	userMapKeys = [REDIS_KEYS.userMetas, REDIS_KEYS.userNameImage, REDIS_KEYS.userChatRoles];

// Helper: Add user score to Redis sorted set
const addScored = (meta, eveID, id, inter, priv, map) =>
	getArr(map, eveID).push(
		inter === 'sur' ? 1 + meta[userScoreIdx] / 1000 : meta[userScoreIdx] / 1000,
		`${id}${priv ? `_${priv}` : !['pub', 'ind'].includes(meta[userPrivIdx]) ? `_${meta[userPrivIdx]}` : ''}`
	);

async function processUserMetas({ data, is, newAttenMap, privUse, state, redis, pipe }) {
	// USER META PIPELINE ---
	// Steps: for each user meta, detach attendance array, apply diffs (newAttenMap / removals / priv changes), rebuild scored sets,
	// then fan the user meta back into per-city maps and filtering indexes.
	const { eveCityIDs, remEve, cityMetas, cityPubMetas, userMetas, friendlyEveScoredUserIDs, cityFiltering } = state,
		missed = new Set(),
		localPipe = pipe || redis?.pipeline();

	for (const [id, meta] of data) {
		try {
			// Extract attendance (last item in meta array)
			let attend = meta.length ? meta[meta.length - 1] : [],
				newAtt = newAttenMap?.get(id);
			if (meta.length && Array.isArray(attend)) meta.length--; // Detach for processing

			// Update attendance if changed or new
			if (newAtt || is !== 'rec') {
				// Process existing attendances (reverse loop for safe splice)
				for (let i = attend.length - 1; i >= 0; i--) {
					const [eveID, inter, evePriv] = attend[i],
						city = eveCityIDs.get(eveID);
					if (!city) {
						missed.add(eveID);
						continue;
					}

					if (newAtt) {
						// Handle intersection with new data
						const [newInter, newPriv] = newAtt.get(eveID) || [];
						if (!newInter) continue;
						newAtt.delete(eveID);
						if (!['sur', 'may'].includes(newInter)) {
							attend.splice(i, 1);
							localPipe?.zrem(`${REDIS_KEYS.friendlyEveScoredUserIDs}:${eveID}`, `${id}${evePriv || !['pub', 'ind'].includes(meta[userPrivIdx]) ? `_${meta[userPrivIdx]}` : ''}`);
						} else {
							attend[i] = [eveID, newInter, ...(meta[userPrivIdx] === 'ind' && newPriv ? [newPriv] : [])];
							addScored(meta, eveID, id, newInter, newPriv, friendlyEveScoredUserIDs);
						}
					} else if (remEve.has(eveID)) attend.splice(i, 1); // Remove deleted events
					else if (is === 'rem') {
						// Decrement event counts if removed
						let em = state.eveMetas.get(eveID);
						if (!em) {
							const b = await redis.hgetBuffer(REDIS_KEYS.eveMetas, eveID);
							if (b) (em = decode(b)), em[inter === 'sur' ? eveSurelyIdx : eveMaybeIdx]--, state.eveMetas.set(eveID, em);
						} else em[inter === 'sur' ? eveSurelyIdx : eveMaybeIdx]--;
						localPipe?.zrem(`${REDIS_KEYS.friendlyEveScoredUserIDs}:${eveID}`, `${id}${evePriv ? `_${evePriv}` : ''}`);
					} else if (is === 'new') addScored(meta, eveID, id, inter, evePriv, friendlyEveScoredUserIDs);
				}
				// Add completely new attendances
				if (newAtt?.size)
					for (const [eventID, [inter, interPriv]] of newAtt) {
						if (['sur', 'may'].includes(inter)) {
							attend.push([eventID, inter, ...(meta[userPrivIdx] === 'ind' && interPriv ? [interPriv] : [])]);
							addScored(meta, eventID, id, inter, interPriv, friendlyEveScoredUserIDs);
						}
					}
			}

			// Finalize user meta and distribute to cities
			if (is !== 'rem' && attend.length) {
				// Backfill missing city IDs
				if (missed.size && redis)
					try {
						(await redis.hmget(REDIS_KEYS.eveCityIDs, ...missed)).forEach((c, i) => c && eveCityIDs.set([...missed][i], c));
					} catch (e) {
						logger.error('contentHelpers.fetch_city_ids_failed', { error: e });
					}

				const filtered = new Map(),
					newPriv = privUse?.get(id);
				// Partition attendance by city
				for (const arr of attend) {
					const cityID = eveCityIDs.get(arr[0]);
					if (!cityID) continue;
					if (is === 'pri') {
						const [eventID, interest, attenPriv] = arr,
							key = attenPriv ? `${id}_${attenPriv}` : id;
						if (attenPriv && newPriv === 'ind') arr.pop();
						localPipe?.zrem(`${REDIS_KEYS.friendlyEveScoredUserIDs}:${eventID}`, key);
						addScored(meta, eventID, id, interest, attenPriv, friendlyEveScoredUserIDs);
					}
					getArr(filtered, cityID).push(arr);
				}

				if (is === 'pri') meta[userPrivIdx] = newPriv;
				userMetas.set(id, encode(meta.concat([attend])));

				// Store filtered metas per city
				filtered.forEach((cityAtten, cityID) => {
					const uniquePrivs = [...new Set(cityAtten.filter(([, , p]) => p && p !== 'pub').map(([, , p]) => p))];
					const finalPriv =
						meta[userPrivIdx] === 'ind' && cityAtten && uniquePrivs.length
							? uniquePrivs.length === 1
								? uniquePrivs[0]
								: `ind:${uniquePrivs.join(',')}`
							: meta[userPrivIdx] === 'ind'
							? 'pub'
							: meta[userPrivIdx];

					getMap(finalPriv === 'pub' ? cityPubMetas : cityMetas, cityID).set(id, encode(meta.concat([cityAtten ?? []])));
					getMap(cityFiltering, cityID).set(id, finalPriv);
				});
			} else if (redis) {
				// Cleanup user if no attendance remains
				const cityIDs = new Set(attend.map(a => eveCityIDs.get(a[0])).filter(Boolean));
				for (const cityID of cityIDs) {
					[cityMetas, cityPubMetas, cityFiltering].forEach(map => map.get(cityID)?.delete(id));
					[REDIS_KEYS.CITY_METAS, REDIS_KEYS.cityPubMetas, REDIS_KEYS.cityFiltering].forEach(k => localPipe?.hdel(`${k}:${cityID}`, id));
				}
				userKeys.forEach(k => localPipe?.del(`${k}:${id}`));
				userMapKeys.forEach(k => localPipe?.hdel(k, id));
			}
		} catch (e) {
			logger.error('contentHelpers.process_user_meta_failed', { error: e, userId: id });
		}
	}
	if (!pipe && localPipe)
		try {
			await localPipe.exec();
		} catch (e) {
			logger.error('contentHelpers.process_user_metas_transaction_failed', { error: e });
		}
}

// PIPELINE FILLING ----------------------------------------------------------
// Steps: flatten accumulated state maps into Redis hset/zadd operations; caller controls pipeline lifetime and exec timing.
function fillContentPipeline({ eveMetas, eveCityIDs, userMetas, friendlyEveScoredUserIDs, cityMetas, cityPubMetas, cityFiltering, best100EveIDs }, metasPipe, attenPipe, mode) {
	if (mode === 'serverStart' && best100EveIDs.size) {
		const bestEntries = [...best100EveIDs]
			.map(id => [id, eveMetas.get(id)])
			.filter(([, m]) => m)
			.flat();
		if (bestEntries.length) metasPipe.hset(REDIS_KEYS.topEvents, ...bestEntries);
	}
	[eveMetas, eveCityIDs, userMetas].forEach((map, k) => map.size && metasPipe.hset([REDIS_KEYS.eveMetas, REDIS_KEYS.eveCityIDs, REDIS_KEYS.userMetas][k], ...[...map].flat()));
	for (const [eve, uids] of friendlyEveScoredUserIDs) attenPipe.zadd(`${REDIS_KEYS.friendlyEveScoredUserIDs}:${eve}`, ...uids);
	[cityMetas, cityPubMetas, cityFiltering].forEach((map, i) =>
		map.forEach((m, c) => m.size && metasPipe.hset(`${[REDIS_KEYS.CITY_METAS, REDIS_KEYS.cityPubMetas, REDIS_KEYS.cityFiltering][i]}:${c}`, ...[...m].flat()))
	);
}

function fillBasiDetaPipe({ eveBasics, eveDetails, userBasics }, pipe) {
	// BASI/DETA FLATTEN ---
	// Steps: write object payloads as alternating field/value pairs into per-ID hashes.
	Object.entries({ [REDIS_KEYS.eveBasi]: eveBasics, eveDeta: eveDetails, [REDIS_KEYS.USER_BASI]: userBasics }).forEach(([k, map]) =>
		map.forEach((data, id) => pipe.hset(`${k}:${id}`, ...Object.entries(data)))
	);
}

// UTILITY: CLEAR STATE ------------------------------------------------------
// CLEAR STATE ---
// Steps: clear all Map/Set containers except the ones explicitly kept; this prevents memory growth during streaming rebuilds.
function clearState(state, keep = []) {
	if (!state) return logger.alert('contentHelpers.clear_null_state_requested', { __skipRateLimit: true });
	try {
		const keepSet = new Set(keep);
		Object.entries(state).forEach(([k, v]) => {
			if (keepSet.has(k)) return;
			(v instanceof Map || v instanceof Set) && v.clear();
		});
	} catch (e) {
		logger.error('contentHelpers.clear_state_failed', { error: e });
	}
}

export {
	getStateVariables,
	processNewEvents,
	processNewUsers,
	processRecEveMetas,
	processOrpEveMetas,
	processNewEveMetas,
	processRemEveMetas,
	processUserMetas,
	fillContentPipeline,
	fillBasiDetaPipe,
	clearState,
	ioRedisSetter,
};
