// CONTENT META ARRAYS ==========================================================
// Compact array format for event/user metadata (bandwidth optimization).
// Frontend unpacks these using the same index positions.
// =============================================================================

import { calculateAge } from '../../../shared/utilities';
import { getGeohash } from './location';

// META INDEXES ------------------------------------------
import { META_INDEXES_SOURCE } from '../../../shared/constants';
import { Inters, Privs, EventMeta, UserMeta } from '../../../shared/types';

let geohash: any;

export interface EventMetaInput {
	id: string;
	lat: number;
	lng: number;
	starts: string;
	priv: Privs;
	owner: string;
	geohash: string;
	cityID: number;
	type: string;
	surely: number;
	maybe: number;
	comments: number;
	score: number;
	basiVers: number;
	detaVers: number;
}

// CREATE EVENT META ARRAY ------------------------------------------------------
// Steps: lazily acquire geohash encoder, derive compact fields (geohash + base36 timestamp) first, then pack values into their
// fixed index positions so the frontend can decode without key names (bandwidth + CPU win).
export function createEveMeta(inp: EventMetaInput): any[] {
	const meta: any[] = [];
	geohash ??= getGeohash();
	const { lat, lng, ...rest } = inp;
	(rest.geohash = lat && lng ? geohash.encode(lat, lng, 9) : null), (rest.starts = new Date(rest.starts).getTime().toString(36));
	Object.keys(META_INDEXES_SOURCE.event).forEach(key => (meta[META_INDEXES_SOURCE.event[key]] = rest[key]));
	return meta as EventMeta;
}

export interface UserMetaInput {
	id: string;
	birth: string;
	today: number;
	priv: Privs;
	age: number;
	basics: string;
	indis: string;
	groups: string;
	score: number;
	imgVers: number;
	basiVers: number;
	attend: { eid: string; inter: Inters; ep?: Privs }[];
}

// CREATE USER META ARRAY -------------------------------------------------------
// Steps: compute derived fields first (age) so packing is single-pass, then pack into fixed index positions for frontend parity.
export function createUserMeta(inp: UserMetaInput): any[] {
	const meta: any[] = [];
	const { birth, today, ...rest } = inp;
	rest.age = calculateAge(birth, today);
	Object.keys(META_INDEXES_SOURCE.user).forEach(key => (meta[META_INDEXES_SOURCE.user[key]] = rest[key]));
	return meta as UserMeta;
}
