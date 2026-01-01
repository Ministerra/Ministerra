import { Streamer } from '../systems';
import { getLogger } from './loggers';

const logger = getLogger('StreamUtils');
const LOW_POWER_STREAMS = process.env.STREAM_LOW_POWER === '0';
const METRICS_ENABLED = !LOW_POWER_STREAMS && process.env.STREAM_METRICS !== '0';

// ENV NUM PARSER --------------------------------------------------------------
// Reads a numeric env var and enforces "positive number" semantics.
// This prevents accidental 0/NaN values from silently disabling limits.
// Steps: parse Number, validate finite + >0, otherwise return provided default.
function getEnvNum(name, def) {
	// Parse env var as positive number with fallback ---------------------------
	const v = Number(process.env[name]);
	return Number.isFinite(v) && v > 0 ? v : def;
}

// METRICS INCREMENT -----------------------------------------------------------
// Best-effort metrics updates stored in Redis hashes, disabled in low-power mode.
// Steps: hincrby fields in one pipeline, swallow errors (metrics must not break the stream consumer).
async function incMetrics(redis, streamName, increments = {}) {
	if (!METRICS_ENABLED) return;
	try {
		const key = `metrics:streams:${streamName}`;
		const pipe = redis.pipeline();
		for (const [field, delta] of Object.entries(increments)) {
			if (!Number.isFinite(delta) || delta === 0) continue;
			pipe.hincrby(key, field, delta);
		}
		await pipe.exec();
	} catch (e) {
		logger.debug('streamUtils.incMetrics_failed', { error: e?.message });
	}
}

// DRAIN STREAM ----------------------------------------------------------------
// Higher-level stream consumer built on Streamer():
// - loops multiple batches within a time budget
// - optionally adapts readCount based on pending backlog
// - returns { items, ack, warn } so callers can acknowledge and emit capacity warnings
// Steps: repeatedly read batches within a time budget, optionally increase readCount under backlog, return ack/warn helpers so caller controls finalization timing.
export async function drainStream({
	redis,
	streamName,
	group,
	consumer,
	logPrefix = '[stream]',
	readCount = getEnvNum('STREAM_READ_COUNT', LOW_POWER_STREAMS ? 250 : 1000),
	maxBatches = LOW_POWER_STREAMS ? 1 : getEnvNum('STREAM_MAX_BATCHES', 5),
	maxLoopMs = LOW_POWER_STREAMS ? 150 : getEnvNum('STREAM_MAX_LOOP_MS', 500),
	claimIdleMs = getEnvNum('STREAM_CLAIM_IDLE_MS', 0),
	claimCount = getEnvNum('STREAM_CLAIM_COUNT', LOW_POWER_STREAMS ? 100 : 500),
}) {
	const items = [];
	const ids = [];
	const start = Date.now();
	for (let i = 0; i < maxBatches && Date.now() - start < maxLoopMs; i++) {
		const res = await Streamer({
			redis,
			streamName,
			logPrefix,
			group,
			consumer,
			count: readCount,
			blockMs: 0,
			claimIdleMs,
			claimCount,
		});
		if (!res.processed) break;
		items.push(...res.items);
		if (Array.isArray(res.ids)) ids.push(...res.ids);
		if (res.processed < readCount) break;

		// Adaptive backpressure: increase readCount within ceiling under lag
		// Steps: when pending backlog exceeds current readCount, increase readCount gradually up to ceiling so consumers can catch up without spiking CPU instantly.
		if (!LOW_POWER_STREAMS) {
			try {
				const pend = await redis.xpending(streamName, group).catch(() => null);
				const pendCnt = Array.isArray(pend) ? Number(pend[0] || 0) : 0;
				const ceil = getEnvNum('STREAM_READ_COUNT_MAX', Math.max(readCount, 5000));
				const step = getEnvNum('STREAM_READ_COUNT_STEP', 500);
				if (pendCnt > readCount && readCount < ceil) readCount = Math.min(ceil, readCount + step);
			} catch (e) {
				logger.debug('streamUtils.backpressure_calc_failed', { error: e?.message });
			}
		}
	}

	// ACK WITH RETRY -----------------------------------------------------------
	// Acks collected IDs with a small retry loop; failure is logged but not thrown.
	// Steps: xack all IDs, retry a few times with small delay; log on final failure and continue.
	async function ackWithRetry() {
		if (ids.length === 0) return;
		let attempts = 0;
		while (attempts < 3) {
			try {
				await redis.xack(streamName, group, ...ids);
				await incMetrics(redis, streamName, { acked: ids.length });
				return;
			} catch (error) {
				attempts++;
				if (attempts >= 3) {
					logger.error('streamUtils.ack_retry_failed', { error, streamName, logPrefix });
					return;
				}
				await new Promise(r => setTimeout(r, 150 * attempts));
			}
		}
	}

	// WARN IF NEAR CAP ---------------------------------------------------------
	// Emits warnings when stream length or pending backlog approaches configured limits.
	// Steps: check xlen and xpending, emit alerts when thresholds are crossed, and increment metrics for later diagnosis.
	async function warnIfNearCap() {
		if (!METRICS_ENABLED) return;
		try {
			const STREAM_MAXLEN = Number(process.env.STREAM_MAXLEN) || 0;
			const STREAM_XLEN_WARN_RATIO = Number(process.env.STREAM_XLEN_WARN_RATIO) || 0.8;
			const STREAM_XPENDING_WARN = Number(process.env.STREAM_XPENDING_WARN) || 0;
			const [len, pending] = await Promise.all([redis.xlen(streamName).catch(() => 0), redis.xpending(streamName, group).catch(() => null)]);
			const pendCnt = Array.isArray(pending) && typeof pending[0] === 'number' ? pending[0] : 0;
			if (STREAM_XPENDING_WARN && pendCnt >= STREAM_XPENDING_WARN) {
				logger.alert('streamUtils.pending_backlog_threshold', { streamName, pending: pendCnt, logPrefix });
				await incMetrics(redis, streamName, { xpending_warns: 1 });
			}
			if (STREAM_MAXLEN && len / STREAM_MAXLEN >= STREAM_XLEN_WARN_RATIO) {
				logger.alert('streamUtils.stream_near_maxlen', {
					streamName,
					length: len,
					ratio: Number((len / STREAM_MAXLEN).toFixed(2)),
					logPrefix,
				});
				await incMetrics(redis, streamName, { xlen_warns: 1 });
			}
		} catch (e) {
			logger.alert('streamUtils.alertIfNearCap_failed', { error: e?.message });
		}
	}

	if (items.length) await incMetrics(redis, streamName, { processed: items.length });

	return { items, ack: ackWithRetry, warn: warnIfNearCap };
}
