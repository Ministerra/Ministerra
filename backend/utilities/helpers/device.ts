// DEVICE MANAGEMENT ============================================================
// Two-tier device encryption: device-scoped DEK (shared cache) + user-device-scoped salts (PDK derivation).
//
// Architecture:
// - `devices` table: device_id → device_key (DEK), shared by ALL users on that device
// - `user_devices` table: user_id + device_id → salt, pdk_salt (per-user encryption salts)
//
// Steps:
// 1) generateDeviceId(): generates a random 21-char device ID for new devices
// 2) ensureDevice(): creates device row if missing, returns shared DEK
// 3) registerUserDevice(): called on login, registers user's salts for this device
// 4) getDeviceKey(): returns device's DEK or null if revoked
// 5) getUserDeviceSalts(): returns user's salt + pdkSalt for PDK derivation
// 6) listUserDevices(): returns device list without secrets for settings UI
// 7) revokeUserDevice(): revokes user's session on device (clears user-device row)
// 8) revokeDevice(): revokes entire device (clears DEK, affects all users)
// 9) renameDevice(): updates user-visible label for device identification
// =============================================================================

import crypto from 'crypto';
import { generateIDString } from '../idGenerator.ts';

// DEVICE CREDENTIALS ---
// Returned on login: combines device-scoped DEK with user-scoped salts.
interface DeviceCredentials {
	deviceID: string;
	salt: string;
	deviceKey: string;
	pdkSalt: string;
	isNew: boolean;
	wasRevoked?: boolean;
}

// USER DEVICE SALTS ---
// User-specific encryption salts for PDK derivation.
interface UserDeviceSalts {
	salt: string;
	pdkSalt: string;
}

// FULL DEVICE SUMMARY ---
// Combines device DEK with user salts for foundation responses.
interface DeviceSummary {
	salt: string;
	deviceKey: string;
	pdkSalt: string;
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

// ENSURE DEVICE EXISTS -------------------------------------------------------
// Steps: check if device exists in `devices` table; if not, create with new DEK. Returns shared DEK.
export async function ensureDevice(con: any, deviceID: string): Promise<{ deviceKey: string; isNew: boolean }> {
	const [existing]: [any[], any] = await con.execute(/*sql*/ `SELECT device_key, is_revoked FROM devices WHERE device_id = ?`, [deviceID]);
	if (existing.length > 0) {
		const device = existing[0];
		// REVOKED -> REGENERATE DEK ---
		if (device.is_revoked) {
			const newDeviceKey = crypto.randomBytes(32).toString('hex');
			await con.execute(/*sql*/ `UPDATE devices SET device_key = ?, is_revoked = 0 WHERE device_id = ?`, [newDeviceKey, deviceID]);
			return { deviceKey: newDeviceKey, isNew: true };
		}
		return { deviceKey: device.device_key, isNew: false };
	}
	// NEW DEVICE ---
	const deviceKey = crypto.randomBytes(32).toString('hex');
	await con.execute(/*sql*/ `INSERT INTO devices (device_id, device_key) VALUES (?, ?)`, [deviceID, deviceKey]);
	return { deviceKey, isNew: true };
}

// REGISTER USER DEVICE -------------------------------------------------------
// Steps: ensure user has salts for this device. Device DEK is separate (handled by ensureDevice).
export async function registerUserDevice(con: any, userID: string | number, deviceID: string, deviceKey: string): Promise<DeviceCredentials> {
	try {
		const [existing]: [any[], any] = await con.execute(/*sql*/ `SELECT id, salt, pdk_salt, is_revoked FROM user_devices WHERE user_id = ? AND device_id = ?`, [userID, deviceID]);
		if (existing.length > 0) {
			const userDevice = existing[0];
			// USER-DEVICE REVOKED -> REGENERATE SALTS ---
			if (userDevice.is_revoked) {
				const newSalt = crypto.randomBytes(32).toString('hex'), newPdkSalt = crypto.randomBytes(32).toString('hex');
				await con.execute(/*sql*/ `UPDATE user_devices SET salt = ?, pdk_salt = ?, is_revoked = 0, last_seen = NOW() WHERE id = ?`, [newSalt, newPdkSalt, userDevice.id]);
				return { deviceID, salt: newSalt, deviceKey, pdkSalt: newPdkSalt, isNew: true, wasRevoked: true };
			}
			// ACTIVE -> REUSE SALTS ---
			await con.execute(/*sql*/ `UPDATE user_devices SET last_seen = NOW() WHERE id = ?`, [userDevice.id]);
			return { deviceID, salt: userDevice.salt, deviceKey, pdkSalt: userDevice.pdk_salt, isNew: false };
		}
		// NEW USER-DEVICE ROW ---
		const rowID = generateIDString(), salt = crypto.randomBytes(32).toString('hex'), pdkSalt = crypto.randomBytes(32).toString('hex');
		await con.execute(/*sql*/ `INSERT INTO user_devices (id, user_id, device_id, salt, pdk_salt) VALUES (?, ?, ?, ?, ?)`, [rowID, userID, deviceID, salt, pdkSalt]);
		return { deviceID, salt, deviceKey, pdkSalt, isNew: true };
	} catch (error) {
		console.error('USER DEVICE REGISTRATION FAILED:', error);
		throw error;
	}
}

// REGISTER DEVICE (COMBINED) -------------------------------------------------------
// Steps: wrapper that ensures device exists then registers user-device. Backward-compatible signature.
export async function registerDevice(con: any, userID: string | number, deviceID: string): Promise<DeviceCredentials> {
	const { deviceKey } = await ensureDevice(con, deviceID);
	return await registerUserDevice(con, userID, deviceID, deviceKey);
}

// GET DEVICE KEY ---------------------------------------------------------------
// Steps: return device's DEK if not revoked; null signals client to purge all device-bound caches.
export async function getDeviceKey(con: any, deviceID: string): Promise<string | null> {
	const [rows]: [any[], any] = await con.execute(/*sql*/ `SELECT device_key FROM devices WHERE device_id = ? AND is_revoked = 0`, [deviceID]);
	return rows.length > 0 ? rows[0].device_key : null;
}

// GET USER DEVICE SALTS ---------------------------------------------------------------
// Steps: return user's salt + pdkSalt for PDK derivation; null if user-device revoked.
export async function getUserDeviceSalts(con: any, userID: string | number, deviceID: string): Promise<UserDeviceSalts | null> {
	const [rows]: [any[], any] = await con.execute(/*sql*/ `SELECT salt, pdk_salt FROM user_devices WHERE user_id = ? AND device_id = ? AND is_revoked = 0`, [userID, deviceID]);
	return rows.length > 0 ? { salt: rows[0].salt, pdkSalt: rows[0].pdk_salt } : null;
}

// GET DEVICE SALT (COMBINED) ---------------------------------------------------------------
// Steps: backward-compatible function that combines device DEK with user salts.
export async function getDeviceSalt(con: any, userID: string | number, deviceID: string): Promise<DeviceSummary | null> {
	const deviceKey = await getDeviceKey(con, deviceID);
	if (!deviceKey) return null;
	const userSalts = await getUserDeviceSalts(con, userID, deviceID);
	if (!userSalts) return null;
	return { salt: userSalts.salt, deviceKey, pdkSalt: userSalts.pdkSalt };
}

// This represents what the UI receives. Note: NO secrets (salt/key) here.
// LIST USER DEVICES -----------------------------------------------
// Steps: return only non-sensitive fields so settings UI can render devices without exposing encryption material.
export async function listDevices(con: any, userID: string | number): Promise<DeviceInfo[]> {
	const [rows]: [DeviceInfo[], any] = await con.execute(/*sql*/ `SELECT device_id, name, created_at, last_seen, is_revoked FROM user_devices WHERE user_id = ? ORDER BY last_seen DESC`, [userID]);

	return rows;
}

// REVOKE USER DEVICE ---------------------------------------------------------
// Steps: revoke user's session on this device; user-bound data (PDK-encrypted) becomes inaccessible.
export async function revokeUserDevice(con: any, userID: string | number, deviceID: string): Promise<void> {
	await con.execute(/*sql*/ `UPDATE user_devices SET is_revoked = 1 WHERE user_id = ? AND device_id = ?`, [userID, deviceID]);
}

// REVOKE DEVICE (ENTIRE) ---------------------------------------------------------
// Steps: revoke device's DEK; affects ALL users on this device, device-bound cache becomes unrecoverable.
export async function revokeDevice(con: any, deviceID: string): Promise<void> {
	await con.execute(/*sql*/ `UPDATE devices SET is_revoked = 1, device_key = NULL WHERE device_id = ?`, [deviceID]);
}

// REVOKE ALL USER DEVICES ---------------------------------------------------------
// Steps: revoke all devices for a user (logout everywhere).
export async function revokeAllUserDevices(con: any, userID: string | number): Promise<void> {
	await con.execute(/*sql*/ `UPDATE user_devices SET is_revoked = 1 WHERE user_id = ?`, [userID]);
}

// RENAME ----------------------------------------------------------
// Steps: cap name length and store for user-visible identification.
export async function renameDevice(con: any, userID: string | number, deviceID: string, name: string): Promise<void> {
	await con.execute(/*sql*/ `UPDATE user_devices SET name = ? WHERE user_id = ? AND device_id = ?`, [name.slice(0, 100), userID, deviceID]);
}
