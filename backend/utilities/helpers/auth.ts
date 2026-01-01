// AUTHENTICATION HELPERS =======================================================
// Time-based rotating auth tokens for frontend encryption key derivation used in foundation loaders

import crypto from 'crypto';
import { AUTH_ROTATION_INTERVAL_MS } from '../../../shared/constants';

export interface AuthPayload {
	auth: string;
	epoch: number;
	expiry: number;
	previousAuth?: string;
	previousEpoch?: number;
}

export interface GetAuthOptions {
	clientEpoch?: number;
}

// GET AUTH TOKEN PAYLOAD -------------------------------------------------------
// Steps: compute current epoch from rotation interval, derive HMAC for that epoch, and optionally include a previous-epoch auth
// when the client reports it is behind so the client can re-encrypt without a hard failure.
export function getAuth(userID: number, options: GetAuthOptions = {}): AuthPayload {
	const now = Date.now();

	const currentEpoch = Math.floor(now / AUTH_ROTATION_INTERVAL_MS);
	const generateHash = (uid: number, ep: number): string => crypto.createHmac('sha256', process.env.AUTH_CRYPTER).update(`${uid}:${ep}`).digest('hex');

	const result: AuthPayload = {
		auth: `${userID}:${generateHash(userID, currentEpoch)}`,
		epoch: currentEpoch,
		expiry: (currentEpoch + 1) * AUTH_ROTATION_INTERVAL_MS,
	};

	// If client is behind current epoch, include previous auth for re-encryption ---------------------------
	const clientEpoch = options.clientEpoch;
	if (clientEpoch !== undefined && clientEpoch < currentEpoch) {
		result.previousAuth = `${userID}:${generateHash(userID, clientEpoch)}`;
		result.previousEpoch = clientEpoch;
	}
	return result;
}

export interface VerifyAuthResult {
	valid: boolean;
	expired?: boolean;
	epoch?: number;
	needsRotation?: boolean;
}

// VERIFY AUTH TOKEN ------------------------------------------------------------
// Steps: validate against current epoch first (fast success), then allow previous epoch during grace window so in-flight clients
// can rotate safely; use timingSafeEqual to avoid leaking correctness via timing.
export function verifyAuth(userID: number, providedHash: string, providedEpoch: number): VerifyAuthResult {
	const now = Date.now();

	const currentEpoch = Math.floor(now / AUTH_ROTATION_INTERVAL_MS);
	const generateHash = (uid: number, ep: number): string => crypto.createHmac('sha256', process.env.AUTH_CRYPTER).update(`${uid}:${ep}`).digest('hex');

	// Check current epoch first ---------------------------
	if (providedEpoch === currentEpoch) {
		const expectedHash = generateHash(userID, currentEpoch);
		// timingSafeEqual requires Buffers of equal length
		const providedBuffer = Buffer.from(providedHash);
		const expectedBuffer = Buffer.from(expectedHash);

		if (providedBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(providedBuffer, expectedBuffer)) {
			return { valid: true, expired: false, epoch: currentEpoch };
		}
	}

	// Allow previous epoch during grace period ---------------------------
	const prevEpoch = currentEpoch - 1;
	if (providedEpoch === prevEpoch) {
		const expectedHash = generateHash(userID, prevEpoch);
		const providedBuffer = Buffer.from(providedHash);
		const expectedBuffer = Buffer.from(expectedHash);

		if (providedBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(providedBuffer, expectedBuffer)) {
			return { valid: true, expired: true, epoch: prevEpoch, needsRotation: true };
		}
	}
	return { valid: false };
}
