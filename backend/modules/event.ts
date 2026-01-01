import { eventsCols, eveBasiCols, eveDetaCols } from '../variables';
import { Sql, Catcher } from '../systems/systems';
import { getLogger } from '../systems/handlers/logging/index';
import { createEveMeta } from '../utilities/helpers/metasCreate';
import { checkRedisAccess } from '../utilities/contentFilters';
import { encode, decode } from 'cbor-x';
import { calculateAge, delFalsy } from '../../shared/utilities';
import { LRUCache } from 'lru-cache';

// META INDEXES ------------------------------------------
import { EVENT_META_INDEXES, REDIS_KEYS } from '../../shared/constants';
const { evePrivIdx, eveOwnerIdx, eveStartsIdx, eveTypeIdx, eveBasiVersIdx, eveDetaVersIdx } = EVENT_META_INDEXES;

let redis;
// REDIS CLIENT SETTER ----------------------------------------------------------
// Event handler uses redis for metas/basi/deta caches and past-event cache buckets.
export const ioRedisSetter = redisClient => (redis = redisClient);
const logger = getLogger('Event');

// LOCAL CACHE -----------------------------------------------------------------
// Steps: cache the heaviest event components in-process so repeated reads avoid redis round-trips; invalidation is explicit so stale data can be dropped after writes.
const eventCache = new LRUCache({
	max: 1000, // Top 1000 active events
	ttl: 5 * 60 * 1000, // 5 minutes matching task cycle
	updateAgeOnGet: false,
});

// SQL QUERIES -----------------------------------------------------------------

const QUERIES = {
	rating: `SELECT ei.inter, ei.priv AS interPriv, er.mark, er.awards FROM eve_inters ei LEFT JOIN eve_rating er ON ei.event = er.event AND er.user = ? WHERE ei.event = ? AND ei.user = ?`,
	pastUsers: `SELECT u.id, ei.priv, u.score, u.imgVers, u.first, u.last, u.birth FROM users u JOIN eve_inters ei ON u.id = ei.user WHERE ei.event = ? AND ei.inter IN ('sur', 'may') ORDER BY CASE ei.inter WHEN 'sur' THEN 1 WHEN 'may' THEN 2 END, u.score DESC`,
};

// HELPERS ---------------------------------------------------------------------

// IS EVENT PAST ----------------------------------------------------------------
// Steps: read starts from compact meta (base36) and compare with now; avoids parsing full objects for a cheap “past vs future” branch.
const isEventPast = meta => parseInt(meta[eveStartsIdx], 36) < Date.now();
// GET EVENT RATING -------------------------------------------------------------
// Steps: read user-specific overlay (inter/priv/mark/awards) from SQL; when userID is missing, return empty overlay.
const getEventRating = async (connection, userID, eventID) => (userID ? (await connection.execute(QUERIES.rating, [userID, eventID, userID]))[0][0] || {} : {});

// HANDLERS --------------------------------------------------------------------

// CACHE PAST EVENT ------------------------------------------------------------
// Steps: read event row from SQL, build meta + basi + deta payloads, write them into redis, and clear future caches so past representation becomes the source of truth.
async function cachePastEvent(eventID, connection) {
	const [[eventData]] = await connection.execute(`SELECT ${eventsCols} FROM events e WHERE id = ?`, [eventID]);
	if (!eventData) throw new Error('notFound');

	const [meta, basicData, detailData, pipeline] = [createEveMeta(eventData), {}, {}, redis.pipeline()];
	eveBasiCols.forEach(col => (basicData[col] = eventData[col]));
	eveDetaCols.forEach(col => (detailData[col] = eventData[col]));

	// CACHE UPDATE -----------------------------------------------------------
	// Steps: store encoded meta/basi/deta in one hash, track cachedAt in zset, then delete future hashes so clients don’t mix “future” and “past” shapes.
	pipeline
		.hset(`pastEve:${eventID}`, 'meta', encode(meta), 'basi', encode(basicData), 'deta', encode(detailData))
		.zadd(`pastEveCachedAt`, Date.now() + 604800000, eventID)
		.del(`${REDIS_KEYS.eveBasi}:${eventID}`, `${REDIS_KEYS.eveDeta}:${eventID}`);

	// USER LIST CACHING ------------------------------------------------------
	// Steps: for friend-type events, cache an attendee snapshot so past event pages can render without recomputing user lists each request.
	if (eventData.type.startsWith('a')) {
		const [users] = await connection.execute(QUERIES.pastUsers, [eventID]);
		pipeline.hset(`pastEve:${eventID}`, 'users', encode(users.map(user => ({ ...user, age: calculateAge(new Date(user.birth)) }))));
	}
	await pipeline.exec();
	return meta;
}

// INVALIDATE CACHE -----------------------------------------------------------
// Steps: clear in-process cache entries so the next read falls back to redis/SQL and sees the latest versions.
export const invalidateEventCache = eventID => {
	eventCache.delete(`basi:${eventID}`);
	eventCache.delete(`deta:${eventID}`);
	eventCache.delete(`past:${eventID}`);
};

// GET PAST EVENT --------------------------------------------------------------
// Steps: pick keys to fetch, read from local cache or redis, rebuild from SQL on cache miss, apply rating overlay + privacy filter for users list, then return event blob + users.
async function getPastEvent({ eventID, getBasi, getDeta, gotSQL, con, userID, isFriendly, isOwn, gotUsers }) {
	const keysToFetch = [getBasi && 'basi', getDeta && 'deta', isFriendly && !gotUsers && 'users'].filter(Boolean);

	// LOCAL/REDIS FETCH ------------------------------------------------------
	// Steps: serve from local cache when present; otherwise hmget from redis; keep the key list explicit so we only fetch what caller needs.
	let cachedData = [];
	const localKey = `past:${eventID}`;
	const localHit = eventCache.get(localKey);

	if (localHit) {
		// Reconstruct format expected by rest of function from local cache
		cachedData = keysToFetch.map(k => localHit[k]);
	} else if (keysToFetch.length) {
		cachedData = await redis.hmgetBuffer(`pastEve:${eventID}`, ...keysToFetch);
	}

	// CACHE MISS HANDLING ----------------------------------------------------
	// Steps: if any requested field is missing, rebuild the past event entry from SQL so redis becomes complete again.
	if (cachedData.some(value => !value)) {
		await cachePastEvent(eventID, con);
		cachedData = keysToFetch.length ? await redis.hmgetBuffer(`pastEve:${eventID}`, ...keysToFetch) : [];
	}

	// POPULATE LOCAL CACHE ---------------------------------------------------
	// Steps: cache the fetched buffers under `past:${eventID}` so repeated reads can avoid redis (past events are effectively immutable).
	if (!localHit && cachedData.length) {
		// We only cache if we fetched something meaningful.
		// Note: We can't easily cache partial fetches without complexity,
		// so we only cache if we likely fetched everything or use what we have.
		// For simplicity, we skip complex partial caching logic here to avoid staleness issues.
		// Full caching would require fetching ALL fields every time which defeats the purpose.
		// However, if we DID fetch multiple fields, we could store them.
		// Let's rely on Redis for primary storage and only use local cache if we fetched full object previously?
		// Better approach: Since 'past' events are static, let's just cache what we got if it covers standard cases.
	}

	// DECODE ---------------------------------------------------------------
	// Steps: decode only requested buffers; default missing users to [] and missing blobs to {} so merge logic stays stable.
	const decodedData = keysToFetch.reduce((acc, key, index) => ({ ...acc, [key]: cachedData[index] ? decode(cachedData[index]) : key === 'users' ? [] : {} }), {});

	// STORE BUFFERS ---------------------------------------------------------
	// Steps: store buffers (not decoded objects) so local path stays consistent with redis path.
	if (!localHit) {
		const toCache = eventCache.get(localKey) || {};
		keysToFetch.forEach(k => (toCache[k] = cachedData[keysToFetch.indexOf(k)])); // Store BUFFERS to avoid re-encoding for consistency? No, we decoded above.
		// Actually we should store the BUFFERS to mimic Redis response if we want to share logic,
		// OR store decoded and adjust logic. Storing buffers is safer for consistency with Redis path.
		eventCache.set(localKey, toCache);
	}

	const [rating, users] = await Promise.all([
		gotSQL ? {} : getEventRating(con, userID, eventID),
		!isOwn && isFriendly ? checkRedisAccess({ items: decodedData.users || [], userID }) : decodedData.users || [],
	]);
	return [{ ...decodedData.basi, ...decodedData.deta, ...rating }, users.filter(user => user?.id)];
}

// GET FUTURE EVENT ------------------------------------------------------------
// Steps: read basi/deta from local cache or redis hashes, optionally overlay rating from SQL for unstable devices, then merge into a single event object.
async function getFutureEvent({ eventID, getBasi, getDeta, devIsStable, userID, gotSQL, con }) {
	// LOCAL CACHE KEYS -------------------------------------------------------
	// Steps: compute cache keys once; basi/deta are cached independently so partial reads stay cheap.
	const basiKey = `basi:${eventID}`;
	const detaKey = `deta:${eventID}`;

	let basicData = getBasi ? eventCache.get(basiKey) : undefined;
	let detailData = getDeta ? eventCache.get(detaKey) : undefined;

	const promises = [];
	if (getBasi && !basicData) promises.push(redis.hgetall(`${REDIS_KEYS.eveBasi}:${eventID}`).then(d => (eventCache.set(basiKey, d), d)));
	else promises.push(basicData || {});

	if (getDeta && !detailData) promises.push(redis.hgetall(`${REDIS_KEYS.eveDeta}:${eventID}`).then(d => (eventCache.set(detaKey, d), d)));
	else promises.push(detailData || {});

	if (!devIsStable && !gotSQL) promises.push(getEventRating(con, userID, eventID));
	else promises.push({});

	const [resBasi, resDeta, ratingData] = await Promise.all(promises);
	return { ...resBasi, ...resDeta, ...ratingData };
}

// GET FUTURE ATTENDEES --------------------------------------------------------
// Steps: compare lastUsersSync with redis change watermark; if stale, read attendee ids, then filter by privacy (unless owner) and return ids + fresh sync time.
async function getFutureAttendees({ eventID, userID, isOwn, lastUsersSync }) {
	const lastChange = await redis.hget(REDIS_KEYS.eveLastAttendChangeAt, eventID);
	// SYNC CHECK ---
	// If client has up-to-date list, return sync timestamp only
	if (lastUsersSync && lastChange && lastUsersSync >= Number(lastChange)) return { usersSync: Number(lastChange) };

	// FETCH & FILTER ---
	// Get all scored users, filter by privacy access
	const rawItems = (await redis.zrange(`${REDIS_KEYS.friendlyEveScoredUserIDs}:${eventID}`, 0, -1)).map(item => {
		const [id, priv] = item.split('_');
		return { id, priv };
	});
	const visibleItems = isOwn ? rawItems : await checkRedisAccess({ items: rawItems, userID });
	return { userIDs: (visibleItems || []).map(item => item?.id).filter(Boolean), usersSync: Date.now() };
}

// ROUTER ----------------------------------------------------------------------

// EVENT DISPATCHER ---
// Steps: load meta (redis or past cache), decide past/future, enforce access, decide which parts are stale by version/state, fetch event data and (optional) users list, then respond with a minimal payload.
export async function Event(req, res) {
	let connection;
	try {
		const { eventID, userID, gotUsers, devIsStable, state, basiVers, detaVers, getBasiOnly, gotSQL, lastUsersSync } = req.body;

		// META LOAD -----------------------------------------------------------
		// Steps: try meta from redis first; if missing or event is past, open SQL and ensure past cache is hydrated.
		let meta = await redis.hgetBuffer(REDIS_KEYS.eveMetas, eventID).then(buffer => (buffer ? decode(buffer) : null));
		if ((!meta && userID) || (meta && isEventPast(meta))) {
			connection = await Sql.getConnection();
			if (!meta) meta = (await redis.hgetBuffer(`pastEve:${eventID}`, 'meta').then(buffer => (buffer ? decode(buffer) : null))) || (await cachePastEvent(eventID, connection));
		}
		if (!meta) throw new Error('notFound');

		// ACCESS CONTROL ------------------------------------------------------
		// Steps: derive priv/owner/type from meta, compute isOwn/isFriendly, then enforce privacy gates using redis-backed access checks.
		const [priv, owner, type, curBasiVers, curDetaVers] = [evePrivIdx, eveOwnerIdx, eveTypeIdx, eveBasiVersIdx, eveDetaVersIdx].map(idx => meta[idx]);
		const [isFriendly, isOwn] = [type.startsWith('a'), owner === userID];

		if ((!isOwn && !(await checkRedisAccess({ items: [{ id: eventID, priv, owner }], userID })).length) || (!isOwn && !userID && (priv !== 'pub' || isFriendly))) throw new Error('unauthorized');

		// FETCH SHAPE ---------------------------------------------------------
		// Steps: compute which blobs (basi/deta/users) are needed based on client versions and requested state; avoids over-fetching.
		const fetchProps = {
			eventID,
			getBasi: (basiVers && curBasiVers !== basiVers) || getBasiOnly || (state && !state.includes('basi')),
			getDeta: (detaVers && curDetaVers !== detaVers) || (!getBasiOnly && state && !state.includes('Deta')),
			devIsStable,
			userID,
			lastUsersSync,
			gotSQL,
			isOwn,
			con: connection,
			isFriendly,
		};

		if (!gotSQL && !devIsStable && !connection) connection = await Sql.getConnection();
		fetchProps.con = connection; // Ensure connection is passed if created

		// ROUTE EXECUTION -----------------------------------------------------
		// Steps: for past events, read past cache + optional users; for future, read hashes + optional attendees list (for friendly events).
		const [eventData, { userIDs, usersSync } = {}, pastUsers] = isEventPast(meta)
			? [...(await getPastEvent(fetchProps))]
			: [await getFutureEvent(fetchProps), isFriendly && !gotUsers && (await getFutureAttendees(fetchProps))];

		if (!eventData) throw new Error('badRequest');

		res.status(200).json(
			delFalsy({
				eventData,
				eveMeta: state === 'noMeta' ? meta : null,
				userIDs,
				pastUsers,
				usersSync,
			})
		);
	} catch (error) {
		logger.error('Event', { error: error, ...req.body });
		Catcher({ origin: 'Event', error: error, res });
	} finally {
		// CLEANUP --------------------------------------------------------------
		// Steps: release SQL connection when acquired so the pool stays healthy.
		connection?.release();
	}
}
