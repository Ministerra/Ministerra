import { forage, getDeviceFingerprint } from '../../helpers';

// GET TOKEN (AUTH + EXPIRY) ---------------------------------------------------
// Steps: read stored token string (sessionStorage for authToken, IndexedDB for normal token), split into fields, compute expiry, then only compute fingerprint when expired so we avoid unnecessary entropy work.
export async function getToken(getAuthToken = false) {
	let token: string | undefined, expiry: string | undefined, print;
	// STORAGE READ -------------------------------------------------------------
	// Steps: pick the correct storage based on getAuthToken because authToken is session-scoped while token is persisted for normal navigation.
	const storedStr = getAuthToken ? sessionStorage.getItem('authToken') : await forage({ mode: 'get', what: 'token' });
	const parts = (storedStr || '').split(':');

	// BOUNDS CHECK BEFORE DESTRUCTURE ------------------------------------------
	// Steps: validate parts array has expected length to prevent undefined access on malformed token strings.
	if (parts.length >= 2) {
		[token, expiry] = parts;
	} else if (parts.length === 1 && parts[0]) {
		token = parts[0];
	}

	// EXPIRY CHECK -------------------------------------------------------------
	// Steps: compute expired flag from expiry timestamp; if expired, compute print so refresh endpoints can re-bind session to device.
	const parsedExpiry = expiry ? Number(expiry) : null;
	const isExpired = parsedExpiry ? Date.now() >= parsedExpiry : false;
	// MISSING AUTH TOKEN ---
	// Steps: when getAuthToken=true but no token exists, mark as missing (not just expired) so callers don't attempt invalid refresh.
	const isMissing = getAuthToken && !token;
	if (isExpired && navigator.onLine) print = getDeviceFingerprint();
	return { token, expiry: parsedExpiry, print, expired: isExpired, missing: isMissing };
}
