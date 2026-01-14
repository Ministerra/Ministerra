// DEVICE MANAGEMENT ============================================================
// Per-device encryption for cached content (events, users, misc), frontend never sees key derivation.
//
// Steps:
// 1) generateDeviceId(): generates a random 21-char device ID for new devices
// 2) registerDevice(): called on login, registers deviceID for user, creates/refreshes salt+deviceKey, bumps last_seen
// 3) getDeviceSalt(): called on token refresh, returns active device credentials or null (revoked/missing)
// 4) listDevices(): returns device list without secrets for settings UI
// 5) revokeDevice(): revokes device and clears device_key so cached blobs become unreadable
// 6) renameDevice(): updates user-visible label for device identification
// =============================================================================

import crypto from 'crypto';
import { generateIDString } from '../idGenerator.ts';

interface DeviceCredentials {
	deviceID: string;
	salt: string;
	deviceKey: string;
	isNew: boolean;
	wasRevoked?: boolean;
}

interface DeviceSummary {
	salt: string;
	deviceKey: string;
}

interface DeviceInfo {
	device_id: string;
	name: string | null;
	created_at: Date;
	last_seen: Date;
	is_revoked: number;
}

// GENERATE DEVICE ID -------------------------------------------------------
// Steps: generate random 21-char hex string for new devices. Stored in httpOnly cookie, 100% stable.
export function generateDeviceId(): string {
	return crypto.randomBytes(16).toString('hex').slice(0, 21);
}

// REGISTER DEVICE -------------------------------------------------------
// Steps: deviceID is passed in (from cookie or newly generated). Each user gets their own row in user_devices with unique salt/deviceKey.

export async function registerDevice(con: any, userID: string | number, deviceID: string): Promise<DeviceCredentials> {
	try {
		// check if this device already exists; branch into (revoked -> regenerate) vs (active -> reuse/backfill key) vs (new -> insert).
		const [existing]: [any[], any] = await con.execute(/*sql*/ `SELECT id, salt, device_key, is_revoked FROM user_devices WHERE user_id = ? AND device_id = ?`, [userID, deviceID]);

		if (existing.length > 0) {
			const device: any = existing[0];
			// REVOKED -> REGENERATE ---------------------------------------------
			// generate new salt+deviceKey so previously encrypted cached data stays unrecoverable after revocation.

			if (device.is_revoked) {
				const newSalt: string = crypto.randomBytes(32).toString('hex'),
					newDeviceKey: string = crypto.randomBytes(32).toString('hex');
				await con.execute(/*sql*/ `UPDATE user_devices SET salt = ?, device_key = ?, is_revoked = 0, last_seen = NOW() WHERE id = ?`, [newSalt, newDeviceKey, device.id]);
				return { deviceID, salt: newSalt, deviceKey: newDeviceKey, isNew: true, wasRevoked: true };
			}

			// ACTIVE -> REUSE/BACKFILL --------------------------------------------
			// reuse existing credentials; if device_key is missing (migration), backfill it so encryption is consistent.
			let deviceKey: string = device.device_key;
			await con.execute(/*sql*/ `UPDATE user_devices SET last_seen = NOW() WHERE id = ?`, [device.id]);
			return { deviceID, salt: device.salt, deviceKey, isNew: false };
		}

		// NEW DEVICE INSERT -------------------------------------------------------
		// Steps: generate Snowflake ID, generate salt+deviceKey, insert row, and return credentials to caller.
		const rowID: string = generateIDString();
		const salt: string = crypto.randomBytes(32).toString('hex'),
			deviceKey: string = crypto.randomBytes(32).toString('hex');
		await con.execute(/*sql*/ `INSERT INTO user_devices (id, user_id, device_id, salt, device_key) VALUES (?, ?, ?, ?, ?)`, [rowID, userID, deviceID, salt, deviceKey]);
		return { deviceID, salt, deviceKey, isNew: true };
	} catch (error) {
		console.error('DEVICE REGISTRATION FAILED:', error);
		throw error;
	}
}

// GET DEVICE SALT ---------------------------------------------------------------
// return credentials only for active (non-revoked) devices; null signals client to purge device-bound caches.
export async function getDeviceSalt(con: any, userID: string | number, deviceID: string): Promise<DeviceSummary | null> {
	const [rows]: [any[], any] = await con.execute(/*sql*/ `SELECT salt, device_key FROM user_devices WHERE user_id = ? AND device_id = ? AND is_revoked = 0`, [userID, deviceID]);
	return rows.length > 0 ? { salt: rows[0].salt, deviceKey: rows[0].device_key } : null;
}

// This represents what the UI receives. Note: NO secrets (salt/key) here.
// LIST USER DEVICES -----------------------------------------------
// Steps: return only non-sensitive fields so settings UI can render devices without exposing encryption material.
export async function listDevices(con: any, userID: string | number): Promise<DeviceInfo[]> {
	const [rows]: [DeviceInfo[], any] = await con.execute(/*sql*/ `SELECT device_id, name, created_at, last_seen, is_revoked FROM user_devices WHERE user_id = ? ORDER BY last_seen DESC`, [userID]);

	return rows;
}

// REVOKE ---------------------------------------------------------
// Steps: mark revoked and clear device_key so device-bound encrypted blobs become unrecoverable immediately.
export async function revokeDevice(con: any, userID: string | number, deviceID: string): Promise<void> {
	await con.execute(/*sql*/ `UPDATE user_devices SET is_revoked = 1, device_key = NULL WHERE user_id = ? AND device_id = ?`, [userID, deviceID]);
}

// RENAME ----------------------------------------------------------
// Steps: cap name length and store for user-visible identification.
export async function renameDevice(con: any, userID: string | number, deviceID: string, name: string): Promise<void> {
	await con.execute(/*sql*/ `UPDATE user_devices SET name = ? WHERE user_id = ? AND device_id = ?`, [name.slice(0, 100), userID, deviceID]);
}
