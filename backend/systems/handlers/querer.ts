import { RETRIABLE_SQL_ERRORS } from '../../../shared/constants';
import { getLogger } from './loggers';

const logger = getLogger('Querer');

// QUERER ----------------------------------------------------------------------

// QUERY SUMMARY ---------------------------------------------------------------
// Single shared formatter used for:
// - startup "plan" log
// - failure log context
// SUMMARIZE QUERY FOR LOGS -----------------------------------------------------
// Returns a safe, bounded representation of a query object:
// - trims SQL to a readable snippet
// - redacts JWT/bearer-like params
// - keeps rawSql/rawParams for actual execution
// Steps: build log-only snippets while preserving raw values for execution; never log token-like secrets verbatim.
function summarizeQueryForLogs(queryObj) {
	const sql = typeof queryObj === 'string' ? queryObj : queryObj?.query;
	const params = typeof queryObj === 'string' ? null : queryObj?.data;
	const name = typeof queryObj === 'string' ? undefined : queryObj?.name;

	// SQL SNIPPET ---
	const sqlSnippet = String(sql || '')
		.replace(/\s+/g, ' ')
		.trim()
		.slice(0, 600);

	// PARAMS SNIPPET ---
	const safeParam = value => {
		if (typeof value !== 'string') return value;
		const trimmed = value.trim();
		const looksLikeJwt = trimmed.split('.').length === 3 && trimmed.length > 40;
		if (looksLikeJwt || trimmed.toLowerCase().startsWith('bearer ')) return '[REDACTED]';
		return trimmed.length > 120 ? `${trimmed.slice(0, 120)}…` : trimmed;
	};
	const paramsSnippet =
		params == null
			? ''
			: Array.isArray(params)
			? params.slice(0, 3).map(safeParam).join(', ')
			: params && typeof params === 'object'
			? Object.entries(params)
					.slice(0, 6)
					.map(([key, value]) => `${key}=${safeParam(value)}`)
					.join(', ')
			: String(safeParam(params));

	return { name, sqlSnippet, paramsSnippet, rawSql: sql, rawParams: params };
}

// QUERY LIST FORMAT ------------------------------------------------------------
// Print a compact "plan" for the whole batch so logs read like a book.
// CREATE PLAN LOG --------------------------------------------------------------
// Produces a multi-line overview of the batch (task/mode + numbered query snippets).
// This is intentionally deterministic so repeated runs are easy to diff in logs.
// Steps: summarize each query into a stable single-line entry so logs read like an execution plan.
function createQuererPlanLog({ task, mode, queries }) {
	const list = Array.isArray(queries) ? queries : [];
	const header = `Querer running ${list.length} queries for task "${task}" in "${mode}" mode`;
	const lines = list.map((queryObj, index) => {
		const { name, sqlSnippet, paramsSnippet } = summarizeQueryForLogs(queryObj);
		const namePrefix = name ? `${name}: ` : '';
		return `${index + 1}. ${namePrefix}${sqlSnippet}${paramsSnippet ? ` — [${paramsSnippet}]` : ''}`;
	});
	return [header, ...lines].join('\n');
}

// EXECUTE QUERIES ---
// Modes:
// - 'atomic_seq': run queries sequentially within a single transaction
// - 'non_atomic': run queries individually with autocommit; collect per-query failures
// QUERER (BATCH EXECUTOR) ------------------------------------------------------
// Executes a list of SQL statements with optional transaction boundaries and retry logic.
// Retries are only attempted for known retriable error codes (see variables.js).
// Steps: log plan, run either (1) transactional sequential execution or (2) per-query non-atomic execution, then retry only on known retriable errors.
export async function Querer({ queries, con, task, maxRetries = 3, mode = 'atomic_seq' }) {
	logger.info(createQuererPlanLog({ task, mode, queries }));

	if (!['atomic_seq', 'non_atomic'].includes(mode)) throw new Error(`Invalid mode: ${mode}`);

	const isRetriableError = error => RETRIABLE_SQL_ERRORS.includes(error.code);
	const executeQuery = async queryObj => {
		const { name, sqlSnippet, paramsSnippet, rawSql, rawParams } = summarizeQueryForLogs(queryObj);

		// QUERY EXECUTION ---------------------------------------------------------
		// Steps: execute rawSql/rawParams, log bounded context on failure, then bubble to outer retry loop.
		if (typeof queryObj !== 'string' && !queryObj?.query) throw new Error('Invalid query format');
		try {
			if (typeof queryObj === 'string') return await con.execute(rawSql);
			return await con.execute(rawSql, rawParams || []);
		} catch (error) {
			logger.alert('querer.query_failed', { task, name, sql: sqlSnippet, paramsSnippet, error, __skipRateLimit: true });
			throw error;
		}
	};

	let inTransaction = false;

	// RETRY LOOP ---------------------------------------------------------------
	// Steps: retry only on known retriable errors; transactional mode retries the whole batch, non-atomic mode returns per-query failure flags.
	for (let attempt = 0; attempt < maxRetries; attempt++) {
		try {
			if (mode === 'atomic_seq') {
				await con.beginTransaction();
				inTransaction = true;
				for (const queryObj of queries) await executeQuery(queryObj);
				await con.commit();
				inTransaction = false;
				return {};
			} else if (mode === 'non_atomic') {
				const failed = {};
				for (const queryObj of queries) {
					try {
						await executeQuery(queryObj);
					} catch (error) {
						failed[queryObj.name || 'unknown'] = isRetriableError(error);
					}
				}
				return failed;
			}
		} catch (error) {
			try {
				if (inTransaction) {
					await con.rollback();
					inTransaction = false;
				}
			} catch {}

			if (!isRetriableError(error)) throw error;

			if (attempt >= maxRetries - 1) {
				// Last attempt failed, return error object
				return { [task]: true };
			}
			logger.alert('querer.transaction_retry', { task, attempt: attempt + 1, maxRetries, error, __skipRateLimit: true });
			await new Promise(resolve => setTimeout(resolve, Math.min(1000 * 2 ** (attempt + 1), 5000)));
		}
	}
	// Should not reach here, but return failure if loop exits unexpectedly
	return { [task]: true };
}
