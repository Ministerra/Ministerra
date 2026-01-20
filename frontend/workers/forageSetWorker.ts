/**
 * FORAGE SET WORKER - Local Storage with Multi-Layer Encryption (AES-GCM)
 *
 * Security layers:
 * 1. Device print - binds data to specific device hardware (12 stable signals)
 * 2. PDK (password-derived key) - Argon2id with 64MB memory, per-device salt
 * 3. DEK (device encryption key) - backend-controlled, GDPR-compliant, 24h TTL heartbeat
 * 4. Auth rotation - limits exposure window to 30 days
 * 5. AES-GCM authenticated encryption - detects tampering
 *
 * GDPR COMPLIANCE:
 * - DEK is generated/stored ONLY on backend - frontend NEVER sees key derivation
 * - Remote revocation: backend nullifies DEK → all device-bound data becomes unrecoverable
 * - Device change (fingerprint drift): backend returns null DEK → automatic data prune
 *
 * OFFLINE ATTACK MITIGATION:
 * - DEK expires after 24h without server validation (heartbeat)
 * - Stolen device going offline can only access device-bound data for max 24h
 */

import localforage from 'localforage';

const delEveProps = ['own', 'inter', 'mark', 'awards', 'commsData', 'commsSyncedAt', 'cursors', 'userIDs', 'invited', 'invites', 'distance'],
	delUserProps = ['mark', 'awards', 'linked', 'trusts', 'note', 'message', 'unavail', 'distance'],
	needEncryption = new Set(['user', 'chat', 'comms', 'alerts', 'past']), // PDK-encrypted (user-bound)
	deviceBoundItems = new Set(['events', 'eve', 'users', 'use']), // DEK-encrypted (device-bound) - includes aliases
	unencryptedItems = new Set(['token', 'miscel']), // Stored unencrypted (token is signed JWT, miscel is public metadata)
	isNotJSON = new Set(['token', 'auth']),
	itemKeys = { events: 'eve', users: 'use', chats: 'chat' };

let auth: string | null = null,
	userID: string | null = null,
	devicePrint: string | null = null,
	pdkSalt: string | null = null, // Server-issued salt for PDK encryption - prevents offline brute-force
	pdk: string | null = null,
	dek: string | null = null, // Device Encryption Key - backend-controlled, GDPR-compliant
	wipeMode = false;

// AES-GCM CRYPTO HELPERS ------------------------------------------------------------
const encoder = new TextEncoder(),
	decoder = new TextDecoder(),
	hasSubtle = typeof crypto !== 'undefined' && crypto.subtle;

// SECURE CONTEXT GUARD ---
// Throws in production if WebCrypto is unavailable (HTTP context).
const ensureSecureContext = () => {
	if (hasSubtle) return;
	if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') return console.warn('Using insecure crypto fallback on localhost');
	throw new Error('SECURE_CONTEXT_REQUIRED');
};

// DERIVE CRYPTO KEY ---
// Steps: hash key material to fixed length, then import as AES-GCM key.
const deriveKey = async keyString => {
	if (!hasSubtle) return keyString;
	const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(keyString));
	return crypto.subtle.importKey('raw', hashBuffer, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
};

// ENCRYPT WITH AES-GCM ---
// Returns base64 string: [12-byte IV][ciphertext+tag]
const encryptGCM = async (keyString, plaintext) => {
	ensureSecureContext();
	if (!hasSubtle)
		return btoa(
			plaintext
				.split('')
				.map((c, i) => String.fromCharCode(c.charCodeAt(0) ^ keyString.charCodeAt(i % keyString.length)))
				.join('')
		);

	const key = await deriveKey(keyString),
		iv = crypto.getRandomValues(new Uint8Array(12)),
		ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoder.encode(plaintext)),
		combined = new Uint8Array(iv.length + ciphertext.byteLength);

	combined.set(iv), combined.set(new Uint8Array(ciphertext), iv.length);
	const chunks: string[] = [];
	for (let offset = 0; offset < combined.length; offset += 8192) chunks.push(String.fromCharCode.apply(null, Array.from(combined.subarray(offset, offset + 8192))));
	return btoa(chunks.join(''));
};

// DECRYPT WITH AES-GCM ---
// Steps: decode base64, split IV, decrypt with key; throws on tampering.
const decryptGCM = async (keyString, ciphertextB64) => {
	ensureSecureContext();
	if (!hasSubtle)
		return atob(ciphertextB64)
			.split('')
			.map((c, i) => String.fromCharCode(c.charCodeAt(0) ^ keyString.charCodeAt(i % keyString.length)))
			.join('');

	const key = await deriveKey(keyString),
		combined = Uint8Array.from(atob(ciphertextB64), c => c.charCodeAt(0)),
		iv = combined.slice(0, 12),
		ciphertext = combined.slice(12),
		plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);

	return decoder.decode(plaintext);
};

// PDK STORAGE - encrypted with print + pdkSalt for device-binding ---------------------------
// Security: print binds to device hardware, pdkSalt from server prevents offline brute-force.
// Print change triggers rekey modal where user re-enters password to re-derive PDK.
const PDK_KEY = '_encPDK';
const getPdkEncKey = (print, salt) => `${print}:${salt}`;
const storePDKEncrypted = async (pdkValue, print, salt) => {
	if (!pdkValue || !print || !salt) return;
	await localforage.setItem(PDK_KEY, await encryptGCM(getPdkEncKey(print, salt), pdkValue));
};
const loadPDKEncrypted = async (print, salt) => {
	if (!print || !salt) return null;
	const encrypted = await localforage.getItem(PDK_KEY);
	if (!encrypted) return null;
	try {
		return await decryptGCM(getPdkEncKey(print, salt), encrypted);
	} catch {
		throw new Error('fingerprintChanged');
	}
};
const clearPDKEncrypted = () => localforage.removeItem(PDK_KEY);

// DEK STORAGE - backend-controlled device encryption key, encrypted with device print ---------------------------
// GDPR: DEK never derived on frontend - backend generates/stores/revokes it.
// Print change: DEK can't be decrypted locally, backend sends fresh DEK on next foundation call.
// HEARTBEAT: DEK expires after 24h without server validation to limit offline attack window.
const DEK_KEY = '_encDEK';
const DEK_TS_KEY = '_dekTimestamp';
const DEK_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

const storeDEKEncrypted = async (dekValue, print) => {
	if (!dekValue || !print) return;
	await localforage.setItem(DEK_KEY, await encryptGCM(print, dekValue));
	await localforage.setItem(DEK_TS_KEY, Date.now());
};

const loadDEKEncrypted = async (print): Promise<string | null> => {
	if (!print) return null;
	const encrypted = await localforage.getItem(DEK_KEY);
	if (!encrypted) return null;

	// DEK HEARTBEAT CHECK - require server refresh after TTL expires ---
	const timestamp = (await localforage.getItem(DEK_TS_KEY)) as number | null;
	if (!timestamp || Date.now() - timestamp > DEK_TTL_MS) {
		console.warn('DEK expired (heartbeat timeout) - requires server refresh');
		return null;
	}

	try {
		return await decryptGCM(print, encrypted);
	} catch {
		console.warn('DEK decryption failed - fingerprint changed, will get fresh DEK from backend');
		return null;
	}
};

const refreshDEKTimestamp = async () => {
	await localforage.setItem(DEK_TS_KEY, Date.now());
};

const clearDEKEncrypted = async () => {
	await localforage.removeItem(DEK_KEY);
	await localforage.removeItem(DEK_TS_KEY);
};

// PRUNE ALL DEVICE-BOUND DATA - called when DEK is null (device revoked or deviceID changed) ---------------------------
const pruneDeviceBoundData = async () => {
	const keys = await localforage.keys();
	const deviceBoundPrefixes = ['eve_', 'use_', 'miscel', 'token', DEK_KEY, DEK_TS_KEY];
	for (const key of keys) {
		if (deviceBoundPrefixes.some(prefix => key.startsWith(prefix))) {
			await localforage.removeItem(key);
		}
	}
	dek = null;
};

// COMBINE KEYS - print + pdk for stronger encryption ---------------------------
// Steps: require both print and PDK, then concatenate to derive a combined key used to decrypt the auth hash used for user-bound storage.
const getCombinedKey = () => {
	if (!devicePrint || !pdk) return null;
	return `${devicePrint}:${pdk}`;
};

// GET ENCRYPTION KEY ----------------------------------------------------------------
// Steps: decide which key applies to this “what” bucket (unencrypted/auth/user-bound/device-bound), return null for “store as-is”.
const getKey = async what => {
	// UNENCRYPTED ITEMS (token is already a signed JWT) ---------------------------
	if (unencryptedItems.has(what)) return null;

	// AUTH STORAGE - encrypted with combined key (print + pdk) ---------------------------
	if (what === 'auth') return getCombinedKey();

	// USER-BOUND DATA (needsEncrypt) - encrypted with auth hash derived from PDK ---------------------------
	if (needEncryption.has(what)) {
		const combinedKey = getCombinedKey();
		if (!auth || !combinedKey) return null;
		try {
			return await decryptGCM(combinedKey, auth);
		} catch {
			return null;
		}
	}

	// DEVICE-BOUND DATA - encrypted with DEK (backend-controlled, GDPR-compliant) ---------------------------
	if (deviceBoundItems.has(what)) return dek || null;

	return null; // Unknown items - no key
};

// ENCRYPT / DECRYPT with AES-GCM ----------------------------------------------------
// Steps: stringify objects deterministically, then encrypt with selected key; decrypt reverses and JSON-parses when appropriate.
const encrypt = async (what, data) => {
	const key = await getKey(what);
	const plaintext = typeof data === 'object' ? JSON.stringify(data) : data.toString();
	if (!key) return plaintext; // Unencrypted items stored as-is
	return encryptGCM(key, plaintext);
};

const decrypt = async (what, data) => {
	try {
		const key = await getKey(what);
		if (!key) return isNotJSON.has(what) ? data : JSON.parse(data || '{}'); // Unencrypted items
		const decrypted = await decryptGCM(key, data);
		return isNotJSON.has(what) ? decrypted : JSON.parse(decrypted || '{}');
	} catch (error) {
		console.error('Decrypt error:', what, error.message);
		return null;
	}
};

// TRIM CURSORS ----------------------------------------------------------------------
// Steps: trim chat/alerts/comms arrays to cursor windows so persisted payload stays bounded while still keeping “own recent” messages for UX.
const trimAfterCursor = (data, cursors, syncedAt?) => {
	if (!data) return [];
	if (cursors === 'gotAll') return data;
	return data.filter(
		({ id, own, created }) =>
			id >= cursors[1] ||
			(cursors.recent && id >= (cursors.recent[0] !== 'new' ? cursors.recent[2] : cursors.recent[1])) ||
			(cursors.oldest && id <= (cursors.oldest[0] !== 'old' ? cursors.oldest[2] : cursors.oldest[1])) ||
			(own && created > syncedAt)
	);
};

// DELETE SENSITIVE PROPS ------------------------------------------------------------
// Steps: strip user-specific overlays before persisting shared entities so device storage remains privacy-safe and smaller (own/inter/marks/etc are stored in user-bound buckets).
const deleteSensitiveProps = (what, val) => {
	const props = ['events', 'eve'].includes(what) ? delEveProps : ['users', 'use'].includes(what) ? delUserProps : [];
	if (props.length) for (const item of val) for (const prop of props) delete item[prop];
	return val;
};

// RE-ENCRYPT DURING ROTATION --------------------------------------------------------
// Steps: when auth epoch rotates, decrypt old user-bound buckets with old hash and re-encrypt with new hash; on failure, caller clears stale buckets to avoid partial corruption.
const reEncryptStores = async (oldAuthHash, newAuthHash) => {
	if (!userID) return;
	const allKeys = await localforage.keys();

	for (const storeType of needEncryption) {
		const keys = allKeys.filter(k => k.startsWith(`${userID}_${storeType}`));
		for (const key of keys) {
			try {
				const encrypted = await localforage.getItem(key);
				if (!encrypted) continue;
				const decrypted = await decryptGCM(oldAuthHash, encrypted);
				if (decrypted) await localforage.setItem(key, await encryptGCM(newAuthHash, decrypted));
			} catch (e) {
				console.error(`Re-encrypt failed for ${key}:`, e.message);
				throw e; // Propagate to trigger data cleanup
			}
		}
	}
};

// STORAGE KEY HELPER ----------------------------------------------------------------
// Steps: build stable per-user keys for user-bound buckets and stable global keys for device-bound buckets; itemKeys normalizes plural buckets to per-item prefixes.
const getStorageKey = (what, itemId) => {
	const base = needEncryption.has(what) ? `${userID}_${what}` : itemKeys[what] || what;
	return `${base}${itemId ? `_${itemId}` : ''}`;
};

// MAIN WORKER HANDLER ---------------------------------------------------------------
self.addEventListener('message', async ({ data: { mode, what, id, val, reqId } }) => {
	const respond = payload => self.postMessage({ ...payload, reqId });
	try {
		if (mode === 'init') return self.postMessage({ inited: true });
		if (mode === 'wipe') return (wipeMode = Boolean(val)), respond({ data: wipeMode });
		if (mode === 'clearPDK') return await clearPDKEncrypted(), (pdk = null), (pdkSalt = null), respond({ data: true });
		if (mode === 'clearDEK') return await pruneDeviceBoundData(), respond({ data: true });
		if (mode === 'status') {
			const keys = await localforage.keys();
			return respond({
				data: {
					keysCount: keys.length,
					hasDEK: !!dek,
					hasPDK: !!pdk,
					hasUserData: keys.some(k => /^eve_|^use_|^\d+_(user|chat|comms|alerts|past)/.test(k) || k === 'miscel'),
				},
			});
		}
		// KEY AVAILABILITY GUARDS ---
		if (needEncryption.has(what) && !auth) return respond({ data: null });
		if (deviceBoundItems.has(what) && !dek) return respond({ data: null });

		let data;
		// GET DATA ----------------------------------------------------------------------
		if (mode === 'get') {
			if (what === 'auth') data = auth;
			else if (what === 'past' && !id) {
				data = {};
				const keys = await localforage.keys(),
					prefix = getStorageKey('past', '');
				for (const key of keys) if (key.startsWith(prefix)) data[key.split('_')[2]] = await decrypt('past', await localforage.getItem(key));
			} else if (Array.isArray(id)) {
				data = [];
				for (let i = 0; i < id.length; i += 100) {
					const batch = await Promise.all(
						id.slice(i, i + 100).map(async itemId => {
							const item = await localforage.getItem(getStorageKey(what, itemId));
							return item ? await decrypt(what, item) : null;
						})
					);
					data.push(...batch.filter(Boolean));
				}
			} else {
				const item = await localforage.getItem(getStorageKey(what, id));
				if (item) data = await decrypt(what, item);
			}

			// SET DATA ----------------------------------------------------------------------
		} else if (mode === 'set') {
			if (wipeMode) return respond({ data: null });

			if (what === 'auth') {
				userID = id;
				if (typeof val !== 'object' || !val.print) return respond({ error: 'invalidAuthFormat' });

				const { auth: authStr, print, pdk: newPdk, pdkSalt: newPdkSalt, deviceKey: newDek, epoch, prevAuth } = val,
					newAuthHash = authStr.split(':')[1];
				devicePrint = print;

				// PDK SALT LIFECYCLE - server-controlled, required for PDK encryption/decryption ---
				if (newPdkSalt) pdkSalt = newPdkSalt;
				else if (!pdkSalt) return respond({ error: 'noPdkSalt' });

				// PDK LIFECYCLE - encrypted with print + pdkSalt for device-binding ---
				if (newPdk) (pdk = newPdk), await storePDKEncrypted(newPdk, print, pdkSalt);
				else {
					try {
						pdk = await loadPDKEncrypted(print, pdkSalt);
					} catch {
						return respond({ error: 'fingerprintChanged' });
					}
					if (!pdk) return respond({ error: 'noPDK' });
				}

				// DEK LIFECYCLE - encrypted with print, shared across all users on device ---
				// Print change: DEK can't be decrypted locally, backend sends fresh DEK on next foundation call.
				// HEARTBEAT: newDek from server refreshes TTL; expired local DEK requires server refresh.
				if (newDek) (dek = newDek), await storeDEKEncrypted(newDek, print);
				else if (newDek === null) {
					console.warn('DEK revoked, pruning device-bound data'), await pruneDeviceBoundData();
					return respond({ status: 'device_revoked' });
				} else {
					dek = await loadDEKEncrypted(print);
					// DEK loaded from cache successfully - refresh heartbeat timestamp (server validated session) ---
					if (dek) await refreshDEKTimestamp();
				}

				const combinedKey = getCombinedKey();
				if (!combinedKey) return respond({ error: 'noCombinedKey' });

				// AUTH ROTATION & USER-BOUND RE-ENCRYPTION ---
				if (prevAuth) {
					const oldAuthHash = prevAuth.split(':')[1],
						userKeys = (await localforage.keys()).filter(k => k.startsWith(`${id}_`) && needEncryption.has(k.split('_')[1]));
					if (userKeys.length > 0) {
						respond({ status: 'reencrypting', count: userKeys.length });
						try {
							await reEncryptStores(oldAuthHash, newAuthHash), respond({ status: 'reencrypted' });
						} catch (e) {
							console.warn('Re-encryption failed, clearing stale data');
							await Promise.all(userKeys.map(key => localforage.removeItem(key)));
							respond({ status: 'cleared_stale' });
						}
					}
				}

				auth = await encryptGCM(combinedKey, newAuthHash);
				await localforage.setItem('authEpoch', epoch);
			} else {
				data = ['events', 'eve', 'users', 'use'].includes(what) ? deleteSensitiveProps(what, Array.isArray(val) ? val : [val]) : val;

				if (what === 'user') {
					['blocks', 'requests'].forEach(cat => (delete data.galleryIDs?.[cat], delete data.noMore?.gallery?.[cat]));
					['alerts', 'pastEve'].forEach(prop => delete data[prop]);
				} else if (what === 'chat') data.messages = trimAfterCursor(data.messages, data.cursors);
				else if (what === 'alerts') data.data = trimAfterCursor(data.data, data.cursors);
				else if (what === 'comms' && data.commsData?.length) {
					data.commsData = trimAfterCursor(data.commsData, data.cursors, data.commsSyncedAt);
					data.commsData.forEach(c => c.repliesData?.length && (c.repliesData = trimAfterCursor(c.repliesData, c.cursors, c.repliesSyncedAt)));
				}

				const store = async (itemId, itemData) => localforage.setItem(getStorageKey(what, itemId), await encrypt(what, itemData));
				if (Array.isArray(data)) for (const item of data) await store(item.id, item);
				else await store(id, data);
			}

			// DELETE DATA -------------------------------------------------------------------
		} else if (mode === 'del') {
			if (what === 'everything') await localforage.clear(), (auth = userID = devicePrint = pdkSalt = pdk = dek = null);
			else if (what === 'user') {
				const keys = (await localforage.keys()).filter(k => userID && k.startsWith(userID));
				for (const key of keys) await localforage.removeItem(key);
				await clearPDKEncrypted(), await clearDEKEncrypted(), (auth = userID = pdkSalt = pdk = dek = null);
			} else {
				const ids = Array.isArray(id) ? id : [id];
				for (const itemId of ids) await localforage.removeItem(getStorageKey(what, itemId));
			}
		}

		if (needEncryption.has(what)) await localforage.setItem(`${userID}_Last`, Date.now());
		respond({ data });
	} catch (error) {
		console.error('ForageWorker error:', error), respond({ error: error.message });
	}
});
