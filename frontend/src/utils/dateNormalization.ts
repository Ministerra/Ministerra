// DATE NORMALIZATION (FRONTEND) ----------------------------------------------
// Centralizes date parsing/serialization so the app can operate on ms timestamps.
// Converts ONLY known date keys to avoid breaking non-date fields like `birth` (YYYY-MM-DD).
// Steps: parse only when the parent key is a known datetime-like field, then normalize to ms so UI and API layers can treat timestamps uniformly.

// INTERNAL: DATE KEY MATCHER --------------------------------------------------
// NOTE: `birth` is treated like a date field (normalized to ms). UI layers that
// need YYYY-MM-DD for inputs must derive it from ms.
const isDateKeyName = key => /^(created|changed|starts|ends|meetWhen|until|birth)$/i.test(key) || /_at$/i.test(key) || /At$/.test(key);

// INTERNAL: BINARY/FORMDATA GUARDS -------------------------------------------
const isNonJsonPayload = value =>
	typeof FormData !== 'undefined' && value instanceof FormData
		? true
		: typeof Blob !== 'undefined' && value instanceof Blob
		? true
		: typeof ArrayBuffer !== 'undefined' && value instanceof ArrayBuffer
		? true
		: ArrayBuffer.isView(value);

// NORMALIZE INCOMING DATE FIELDS TO MS ---------------------------------------
// Steps: walk incoming JSON-ish payloads, convert known date fields into ms timestamps, and leave everything else untouched (including binary/FormData).
export function normalizeIncomingDateFieldsToMs(value, parentKey = null) {
	// GUARDS ------------------------------------------------------------------
	if (value === null || value === undefined) return value;
	if (isNonJsonPayload(value)) return value;

	// FAST PATHS --------------------------------------------------------------
	if (typeof value === 'number' && Number.isFinite(value)) return value;
	if (typeof value === 'string') {
		// KEY FILTER ----------------------------------------------------------
		// Only parse when the key is a known datetime-like field.
		if (!parentKey) return value;
		const key = String(parentKey);

		const isDateKey = isDateKeyName(key);
		if (!isDateKey) return value;

		// MYSQL DATETIME (NO TZ) ----------------------------------------------
		// Treat as UTC: 'YYYY-MM-DD HH:mm:ss[.SSS]' -> ms
		const mysqlDateTime = /^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}(\.\d{1,6})?$/.test(value);
		if (mysqlDateTime) {
			const parsed = Date.parse(`${value.replace(' ', 'T')}Z`);
			return Number.isFinite(parsed) ? parsed : value;
		}

		// DATE-ONLY (NO TZ) ----------------------------------------------------
		// Treat as UTC midnight: 'YYYY-MM-DD' -> ms
		const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
		if (dateOnly) {
			const parsed = Date.parse(`${value}T00:00:00Z`);
			return Number.isFinite(parsed) ? parsed : value;
		}

		// ISO WITH TZ ----------------------------------------------------------
		// Only parse if timezone is explicit to avoid locale-dependent parsing.
		const isoWithTz = /^\d{4}-\d{2}-\d{2}T/.test(value) && (/[zZ]$/.test(value) || /[+-]\d{2}:?\d{2}$/.test(value));
		if (isoWithTz) {
			const parsed = Date.parse(value);
			return Number.isFinite(parsed) ? parsed : value;
		}
		return value;
	}

	// ARRAYS ------------------------------------------------------------------
	if (Array.isArray(value)) {
		for (let i = 0; i < value.length; i++) value[i] = normalizeIncomingDateFieldsToMs(value[i], parentKey);
		return value;
	}

	// OBJECTS -----------------------------------------------------------------
	if (typeof value === 'object') {
		for (const [key, child] of Object.entries(value)) value[key] = normalizeIncomingDateFieldsToMs(child, key);
		return value;
	}

	return value;
}

// NORMALIZE OUTGOING DATE FIELDS TO MS ---------------------------------------
// Ensures backend receives ms timestamps for known datetime keys.
// Converts:
// - Date -> ms
// - numeric string -> ms number
// - MySQL DATETIME string -> ms (UTC)
// - ISO string with explicit TZ -> ms
// Steps: walk outgoing payload, coerce known date fields into ms numbers so backend does not have to guess parsing semantics.
export function normalizeOutgoingDateFieldsToMs(value, parentKey = null) {
	// GUARDS ------------------------------------------------------------------
	if (value === null || value === undefined) return value;
	if (isNonJsonPayload(value)) return value;

	// DATE OBJECT -------------------------------------------------------------
	if (value instanceof Date) return parentKey && isDateKeyName(String(parentKey)) ? value.getTime() : value;

	// FAST PATHS --------------------------------------------------------------
	if (typeof value === 'number' && Number.isFinite(value)) return value;
	if (typeof value === 'string') {
		if (!parentKey) return value;
		const key = String(parentKey);
		if (!isDateKeyName(key)) return value;

		// NUMERIC STRING (MS) ------------------------------------------------
		if (/^\d{10,13}$/.test(value)) {
			const num = Number(value);
			return Number.isFinite(num) ? num : value;
		}

		// MYSQL DATETIME (NO TZ) ----------------------------------------------
		const mysqlDateTime = /^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}(\.\d{1,6})?$/.test(value);
		if (mysqlDateTime) {
			const parsed = Date.parse(`${value.replace(' ', 'T')}Z`);
			return Number.isFinite(parsed) ? parsed : value;
		}

		// DATE-ONLY (NO TZ) ----------------------------------------------------
		const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
		if (dateOnly) {
			const parsed = Date.parse(`${value}T00:00:00Z`);
			return Number.isFinite(parsed) ? parsed : value;
		}

		// ISO WITH TZ ----------------------------------------------------------
		const isoWithTz = /^\d{4}-\d{2}-\d{2}T/.test(value) && (/[zZ]$/.test(value) || /[+-]\d{2}:?\d{2}$/.test(value));
		if (isoWithTz) {
			const parsed = Date.parse(value);
			return Number.isFinite(parsed) ? parsed : value;
		}

		return value;
	}

	// ARRAYS ------------------------------------------------------------------
	if (Array.isArray(value)) {
		for (let i = 0; i < value.length; i++) value[i] = normalizeOutgoingDateFieldsToMs(value[i], parentKey);
		return value;
	}

	// OBJECTS -----------------------------------------------------------------
	if (typeof value === 'object') {
		for (const [key, child] of Object.entries(value)) value[key] = normalizeOutgoingDateFieldsToMs(child, key);
		return value;
	}

	return value;
}
