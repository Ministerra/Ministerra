import { forage, getDeviceFingerprint } from '../../helpers';

// GET TOKEN (AUTH + EXPIRY) ---------------------------------------------------
// Steps: read stored token string (sessionStorage for authToken, IndexedDB for normal token), split into fields, compute expiry, then only compute fingerprint when expired so we avoid unnecessary entropy work.
export async function getToken(getAuthToken = false) {
	let token, expiry, reprint, print;
	// STORAGE READ -------------------------------------------------------------
	// Steps: pick the correct storage based on getAuthToken because authToken is session-scoped while token is persisted for normal navigation.
	const storedStr = getAuthToken ? sessionStorage.getItem('authToken') : await forage({ mode: 'get', what: 'token' });
	const parts = (storedStr || '').split(':');
	if (getAuthToken) {
		[token, expiry] = parts;
	} else {
		// Format is: TOKEN:EXPIRY:REPRINT
		[token, expiry, reprint] = parts;
	}

	// EXPIRY CHECK -------------------------------------------------------------
	// Steps: compute expired flag from expiry timestamp; if expired, compute print so refresh endpoints can re-bind session to device.
	const isExpired = expiry ? Date.now() >= Number(expiry) : false;
	if (isExpired) print = getDeviceFingerprint();
	return { token, expiry: Number(expiry) || null, reprint, print, expired: isExpired || (getAuthToken && !token) };
}
