import { Catcher, Sql } from '../systems/systems';
import { getLogger } from '../systems/handlers/logging/index';

// FEEDBACK MODULE --------------------------------------------------------------
// Stores per-user event feedback and maintains aggregated totals for event owners.
// Supports incremental updates by diffing previous submission against new payload.

const logger = getLogger('Feedback');

// HELPERS ---------------------------------------------------------------------

// CLAMP 0..10 ------------------------------------------------------------------
// Steps: normalize arbitrary input into numeric 0..10 so aggregates can be updated safely without trusting client input.
const clamp10 = val => {
	const num = Number(val);
	return Number.isFinite(num) ? Math.max(0, Math.min(10, num)) : null;
};
// SAFE JSON PARSER -------------------------------------------------------------
// Steps: parse JSON when present; on null/invalid payload return fallback so one bad row doesn’t break the whole handler.
const parseJson = (val, fallback) => {
	if (!val) return fallback;
	try {
		return JSON.parse(val);
	} catch (err) {
		return fallback;
	}
};

// TALLY COUNTS ----------------------------------------------------------------
// Steps: normalize old array format into {id:level}, then add/subtract levels into the bucket so totals can be updated by diffing prev vs next.
const tally = (bucket = {}, items = {}, sign = 1) => {
	if (Array.isArray(items)) items = items.reduce((acc, id) => ((acc[id] = 1), acc), {}); // Convert old array format
	Object.entries(items || {}).forEach(([key, level]) => {
		if (!key || !level) return;
		const lvl = Math.max(0, Math.min(3, Number(level) || 0)); // Clamp level 0-3
		bucket[key] = (bucket[key] || 0) + sign * lvl;
		if (bucket[key] <= 0) delete bucket[key];
	});
	return bucket;
};

// MERGE ASPECTS ---------------------------------------------------------------
// Steps: for each aspect key, subtract prev contribution, add next contribution, and delete empty buckets so stored totals stay small.
const mergeAspects = (bucket = {}, prev = {}, next = {}) => {
	const keys = Array.from(new Set([...Object.keys(prev || {}), ...Object.keys(next || {})]));
	keys.forEach(key => {
		const prevVal = clamp10(prev[key]);
		const nextVal = clamp10(next[key]);
		bucket[key] ||= { sum: 0, count: 0 };
		if (prevVal !== null) {
			bucket[key].sum -= prevVal;
			bucket[key].count = Math.max(0, bucket[key].count - 1);
		}
		if (nextVal !== null) {
			bucket[key].sum += nextVal;
			bucket[key].count += 1;
		}
		if (bucket[key].sum === 0 && bucket[key].count === 0) delete bucket[key];
	});
	return bucket;
};

// FEEDBACK HANDLER ------------------------------------------------------------

/** ----------------------------------------------------------------------------
 * FEEDBACK
 * Handles user feedback for events (ratings, praises, reprimands, aspects).
 * Manages both individual user submissions and aggregated totals.
 * -------------------------------------------------------------------------- */
async function Feedback(req, res) {
	const { mode, eventID, userID, payload } = req.body;
	if (!eventID || !['getMine', 'submit', 'getTotals'].includes(mode)) return res.status(400).json({ reason: 'badRequest' });
	let con;
	try {
		con = await Sql.getConnection();

		// EVENT META + ACCESS -------------------------------------------------
		// Steps: load owner/type/time window, enforce feedback window rules, then branch by mode (getMine/getTotals/submit).
		const [[eventMeta]] = await con.execute(/*sql*/ 'SELECT owner,type,starts,ends FROM events WHERE id=?', [eventID]);
		if (!eventMeta) return res.status(404).json({ reason: 'notFound' });
		if (eventMeta.type.startsWith('a')) return res.status(403).json({ reason: 'forbidden' });
		const feedbackBase = eventMeta.ends || eventMeta.starts;
		const feedbackBaseMs = feedbackBase ? new Date(feedbackBase).getTime() : 0; // Ensure numeric comparison
		const windowMs = 30 * 24 * 60 * 60 * 1000,
			now = Date.now(); // Capture once to avoid edge-case race
		const inWindow = feedbackBaseMs && now >= feedbackBaseMs && now <= feedbackBaseMs + windowMs;
		const isOwner = userID && String(userID) === String(eventMeta.owner); // IDs are strings
		if (mode === 'submit' && !inWindow) return res.status(403).json({ reason: 'forbidden' });
		if (mode === 'getTotals' && !isOwner) return res.status(403).json({ reason: 'forbidden' });
		if (mode === 'getMine' && !inWindow && !isOwner) return res.status(403).json({ reason: 'forbidden' });

		// READ OWN FEEDBACK ---------------------------------------------------
		// Steps: read user row + totals row, normalize legacy praise formats, then return both so client can render “mine vs totals”.
		if (mode === 'getMine') {
			const normLevels = val => {
				if (Array.isArray(val)) return val.reduce((acc, id) => ((acc[id] = 1), acc), {});
				return val || {};
			};
			const [[row]] = await con.execute('SELECT rating,praises,reprimands,aspects,payload,comment,ideas FROM eve_feedback_user WHERE event=? AND user=?', [eventID, userID || 0]);
			const [[totals]] = await con.execute('SELECT rating_sum,rating_count,praises,reprimands,aspects FROM eve_feedback_totals WHERE event=?', [eventID]);
			return res.status(200).json({
				feedback: row
					? {
							rating: row.rating,
							praises: normLevels(parseJson(row.praises, {})),
							reprimands: normLevels(parseJson(row.reprimands, {})),
							aspects: parseJson(row.aspects, {}),
							payload: parseJson(row.payload, {}),
							comment: row.comment || '',
							ideas: row.ideas || '',
					  }
					: {},
				totals: totals
					? {
							rating_sum: totals.rating_sum,
							rating_count: totals.rating_count,
							praises: parseJson(totals.praises, {}),
							reprimands: parseJson(totals.reprimands, {}),
							aspects: parseJson(totals.aspects, {}),
					  }
					: null,
			});
		}

		// READ TOTALS ---------------------------------------------------------
		// Steps: owner-only read; return parsed totals or a zeroed shape so UI doesn’t branch on null.
		if (mode === 'getTotals') {
			const [[totals]] = await con.execute('SELECT rating_sum,rating_count,praises,reprimands,aspects FROM eve_feedback_totals WHERE event=?', [eventID]);
			return res.status(200).json(
				totals
					? {
							rating_sum: totals.rating_sum,
							rating_count: totals.rating_count,
							praises: parseJson(totals.praises, {}),
							reprimands: parseJson(totals.reprimands, {}),
							aspects: parseJson(totals.aspects, {}),
					  }
					: { rating_sum: 0, rating_count: 0, praises: {}, reprimands: {}, aspects: {} }
			);
		}

		// SUBMIT / UPSERT -----------------------------------------------------
		// Steps: normalize payload, lock user row + totals row, upsert user row, update totals by diff(prev,next), then commit so totals are consistent.
		if (!userID) return res.status(401).json({ reason: 'unauthorized' });
		const safePayload = payload || {};
		const { rating, praises = {}, reprimands = {}, aspects = {}, comment = '', ideas = '' } = safePayload;
		const ratingNum = rating === null || rating === undefined ? null : Math.max(1, Math.min(10, Number(rating)));

		// NORMALIZE INPUTS ----------------------------------------------------
		// Steps: cap item counts, clamp levels, and stringify once so both user row and totals delta logic share the same normalized view.
		const normalizeLevels = val => {
			if (Array.isArray(val)) return val.slice(0, 64).reduce((acc, id) => ((acc[id] = 1), acc), {});
			return Object.entries(val || {})
				.slice(0, 64)
				.reduce((acc, [k, v]) => {
					const lvl = Math.max(0, Math.min(3, Number(v) || 0));
					if (lvl > 0) acc[k] = lvl;
					return acc;
				}, {});
		};
		const safePraises = normalizeLevels(praises),
			safeReprimands = normalizeLevels(reprimands);
		const safeAspects = Object.entries(aspects || {}).reduce((acc, [k, v]) => ((acc[k] = clamp10(v)), acc), {});
		const safePayloadJson = JSON.stringify({
			rating: ratingNum,
			praises: safePraises,
			reprimands: safeReprimands,
			aspects: safeAspects,
			comment: comment?.slice(0, 800) || '',
			ideas: ideas?.slice(0, 800) || '',
		});

		// TRANSACTION + LOCKS -------------------------------------------------
		// Steps: lock user row to compute a stable prev state, then lock totals row so concurrent submitters can’t corrupt aggregates.
		await con.beginTransaction();
		const [[prevRow]] = await con.execute('SELECT rating,praises,reprimands,aspects FROM eve_feedback_user WHERE event=? AND user=? FOR UPDATE', [eventID, userID]);
		const prevRating = prevRow?.rating || null;
		const prevPraises = normalizeLevels(parseJson(prevRow?.praises, {}));
		const prevReprimands = normalizeLevels(parseJson(prevRow?.reprimands, {}));
		const prevAspects = parseJson(prevRow?.aspects, {});

		await con.execute(
			`INSERT INTO eve_feedback_user (event,user,rating,praises,reprimands,aspects,payload,comment,ideas)
             VALUES (?,?,?,?,?,?,?,?,?)
             ON DUPLICATE KEY UPDATE rating=VALUES(rating), praises=VALUES(praises), reprimands=VALUES(reprimands), aspects=VALUES(aspects), payload=VALUES(payload), comment=VALUES(comment), ideas=VALUES(ideas)`,
			[eventID, userID, ratingNum, JSON.stringify(safePraises), JSON.stringify(safeReprimands), JSON.stringify(safeAspects), safePayloadJson, comment.slice(0, 800), ideas.slice(0, 800)]
		);

		// UPDATE AGGREGATES ---------------------------------------------------
		// Steps: load totals under lock, then apply rating/praise/reprimand/aspect deltas so totals reflect the new user submission.
		const [[totalsRow]] = await con.execute('SELECT rating_sum,rating_count,praises,reprimands,aspects FROM eve_feedback_totals WHERE event=? FOR UPDATE', [eventID]);
		const totals = totalsRow
			? {
					rating_sum: Number(totalsRow.rating_sum) || 0,
					rating_count: Number(totalsRow.rating_count) || 0,
					praises: parseJson(totalsRow.praises, {}),
					reprimands: parseJson(totalsRow.reprimands, {}),
					aspects: parseJson(totalsRow.aspects, {}),
			  }
			: { rating_sum: 0, rating_count: 0, praises: {}, reprimands: {}, aspects: {} };

		// RATING DELTAS -------------------------------------------------------
		// Steps: adjust sum/count based on transitions between null/non-null values.
		if (prevRating !== null) totals.rating_sum = Math.max(0, totals.rating_sum - prevRating);
		if (ratingNum !== null) totals.rating_sum += ratingNum;
		if (prevRating === null && ratingNum !== null) totals.rating_count += 1;
		if (prevRating !== null && ratingNum === null) totals.rating_count = Math.max(0, totals.rating_count - 1);

		tally(totals.praises, prevPraises, -1);
		tally(totals.reprimands, prevReprimands, -1);
		tally(totals.praises, safePraises, 1);
		tally(totals.reprimands, safeReprimands, 1);
		mergeAspects(totals.aspects, prevAspects, safeAspects);

		await con.execute(
			`INSERT INTO eve_feedback_totals (event,rating_sum,rating_count,praises,reprimands,aspects,updated_at)
             VALUES (?,?,?,?,?,?,NOW())
             ON DUPLICATE KEY UPDATE rating_sum=VALUES(rating_sum), rating_count=VALUES(rating_count), praises=VALUES(praises), reprimands=VALUES(reprimands), aspects=VALUES(aspects), updated_at=NOW()`,
			[eventID, totals.rating_sum, totals.rating_count, JSON.stringify(totals.praises), JSON.stringify(totals.reprimands), JSON.stringify(totals.aspects)]
		);

		await con.commit();
		return res.status(200).json({ ok: true, totals });
	} catch (error) {
		try {
			await con?.rollback();
		} catch (rollbackErr) {
			logger.error('Feedback rollback failed', { error: rollbackErr, eventID, userID });
		}
		logger.error('Feedback failed', { error, mode, eventID, userID });
		return Catcher({ origin: 'Feedback', error, res });
	} finally {
		try {
			con?.release();
		} catch (relErr) {
			logger.error('Feedback release failed', { error: relErr, eventID, userID });
		}
	}
}

export default Feedback;
