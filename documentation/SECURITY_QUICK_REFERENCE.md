# Security Quick Reference

## Key Commands

### Device Management (Backend)

```typescript
import { registerDevice, revokeDevice, revokeUserDevice, revokeAllUserDevices } from './utilities/helpers/device';

// Register new device on login
const creds = await registerDevice(con, userID, deviceID);
// Returns: { deviceID, salt, deviceKey, pdkSalt, isNew }

// Revoke single user session on device
await revokeUserDevice(con, userID, deviceID);

// Wipe entire device (all users)
await revokeDevice(con, deviceID);

// Logout user everywhere
await revokeAllUserDevices(con, userID);
```

### Frontend Encryption

```typescript
import { forage, getDeviceFingerprint, deriveKeyFromPassword } from './helpers';

// Derive PDK from password
const pdk = await deriveKeyFromPassword(password, userID + deviceSalt);

// Get device fingerprint
const print = getDeviceFingerprint();

// Store encrypted data
await forage({ mode: 'set', what: 'user', val: userData, id: userID });

// Get encrypted data
const userData = await forage({ mode: 'get', what: 'user', id: userID });

// Clear user data on logout
await forage({ mode: 'del', what: 'user' });

// Clear everything (nuclear option)
await forage({ mode: 'del', what: 'everything' });
```

---

## Data Categories

| What | Encryption | Key | Scope |
|------|------------|-----|-------|
| `token` | None | - | Device |
| `miscel` | None | - | Device |
| `user` | AES-GCM | Auth hash | User |
| `chat` | AES-GCM | Auth hash | User |
| `comms` | AES-GCM | Auth hash | User |
| `alerts` | AES-GCM | Auth hash | User |
| `past` | AES-GCM | Auth hash | User |
| `eve_*` | AES-GCM | DEK | Device |
| `use_*` | AES-GCM | DEK | Device |

---

## Error Codes

| Error | Meaning | Action |
|-------|---------|--------|
| `fingerprintChanged` | Device hardware/browser changed | Show rekey modal |
| `noPDK` | PDK not found in storage | Redirect to login |
| `noPdkSalt` | Salt missing from backend | Re-register device |
| `noCombinedKey` | Missing print or PDK | Re-authenticate |
| `device_revoked` | DEK nullified by backend | Data pruned automatically |
| `SECURE_CONTEXT_REQUIRED` | Not HTTPS | Deploy with TLS |

---

## Worker Modes

```typescript
// Initialize worker
forage({ mode: 'init' });

// Set wipe mode (blocks all writes)
forage({ mode: 'wipe', val: true });

// Clear PDK from storage
forage({ mode: 'clearPDK' });

// Clear DEK and prune device data
forage({ mode: 'clearDEK' });

// Get storage status
const status = await forage({ mode: 'status' });
// Returns: { keysCount, hasDEK, hasPDK, hasUserData }
```

---

## Database Tables

### devices
```sql
device_id VARCHAR(21) PRIMARY KEY  -- Device identifier
device_key VARCHAR(64)             -- DEK (256-bit hex)
is_revoked TINYINT DEFAULT 0       -- Remote wipe flag
```

### user_devices
```sql
user_id BIGINT                     -- User FK
device_id VARCHAR(21)              -- Device FK
salt VARCHAR(64)                   -- deviceSalt for PDK
pdk_salt VARCHAR(64)               -- pdkSalt for PDK storage
is_revoked TINYINT DEFAULT 0       -- User-device revocation
```

---

## Fingerprint Signals

```typescript
const signals = [
  hardwareConcurrency,  // CPU cores
  deviceMemory,         // RAM GB
  maxTouchPoints,       // Touch hardware
  platform,             // OS type
  colorDepth,           // Display
  timeZone,             // Location
  language,             // Primary locale
  languages,            // All locales
  pdfViewerEnabled,     // Browser feature
  cookieEnabled,        // Cookie setting
  webdriver,            // Automation flag
  maxChannelCount,      // Audio channels
];
```

---

## Security Parameters

| Parameter | Value | Purpose |
|-----------|-------|---------|
| Argon2 memory | 64 MB | GPU resistance |
| Argon2 iterations | 3 | Time cost |
| Argon2 parallelism | 4 | CPU utilization |
| PBKDF2 iterations | 100,000 | Fallback security |
| DEK TTL | 24 hours | Offline attack limit |
| Auth rotation | 30 days | Key exposure limit |
| AES key size | 256-bit | Encryption strength |
| IV size | 12 bytes | GCM standard |

---

## API Endpoints

| Endpoint | Mode | Purpose |
|----------|------|---------|
| `POST /entrance` | `login` | Authenticate, get keys |
| `POST /entrance` | `rekeyDevice` | New pdkSalt on fingerprint change |
| `POST /entrance` | `logoutDevice` | Revoke current device |
| `POST /entrance` | `logoutEverywhere` | Revoke all devices |
| `POST /foundation` | `auth` | Validate session, refresh DEK |
| `POST /devices` | `revoke` | Revoke specific user-device |
| `POST /devices` | `wipeDevice` | Revoke entire device (admin) |
