import { REDIS_KEYS } from '../../shared/constants';
// ANNOTATION STRATEGY: External types -----------------------------------------
import { Redis } from 'ioredis';

const { BLOCKS, LINKS, TRUSTED, INVITES } = REDIS_KEYS;
const redisKeys = { blocks: BLOCKS, lin: LINKS, tru: TRUSTED, inv: INVITES };
import { Privs } from '../../shared/types';

let redis: Redis;
// REDIS CLIENT SETTER ----------------------------------------------------------
// Steps: inject note-only redis dependency so filter helpers stay pure and testable.
const ioRedisSetter = (c: Redis) => (redis = c);

export interface CommentItem {
	id: number;
	user: string;

	[key: string]: any; // Allow other properties
}

export interface FilterCommentsInput {
	items: CommentItem[];
	blocks: Set<string>;
}

// FILTER COMMENTS ----------------------------------------------------------------------
// Steps: build a lookup map, then for each comment: drop if author is blocked, else walk the reply chain upwards; if any ancestor
// is blocked (or chain is corrupt), emit `{}` so blocked users cannot leak visibility through nested replies.
const filterComments = ({ items, blocks }: FilterCommentsInput): (CommentItem | {})[] => {
	const commentMap = new Map(items.map(c => [c.id, c])),
		filteredComms: (CommentItem | {})[] = [];

	for (const c of items) {
		// AUTHOR GATE ---
		// Steps: hard-drop early so we do not waste time walking reply chains for already-blocked authors.
		if (blocks.has(c.user)) {
			filteredComms.push({});
			continue;
		}
		let targetComm: CommentItem | undefined,
			targetCommID = c.target,
			blocked = false,
			visited = new Set<string | number>();

		if (!targetCommID) filteredComms.push(c);
		else {
			// ANCESTOR WALK ---
			// Steps: traverse `target` pointers until root, tracking visited IDs to avoid cycles.
			while (targetCommID && !visited.has(targetCommID)) {
				visited.add(targetCommID);
				targetComm = commentMap.get(targetCommID);
				// If parent missing or parent author blocked, mark chain as blocked
				if (!targetComm || blocks.has(targetComm.user)) {
					if (targetComm) blocked = true;
					break;
				}
				if (!targetComm.target) break; // Reached root
				targetCommID = targetComm.target;
			}
			// EMIT SHAPE ---
			// Steps: keep original comment only if chain was safe; emit `{}` otherwise to preserve positional array expectations upstream.
			if (!blocked && (!targetCommID || !visited.has(targetCommID) || !targetComm)) filteredComms.push(c);
			else filteredComms.push(blocked ? {} : c);
		}
	}
	return filteredComms;
};

export interface ContentItem {
	id: number | string;
	priv?: Privs;
	owner?: string;
	[key: string]: any;
}

export interface CheckAccessInput {
	items: (ContentItem | null | undefined)[];
	userID: string;
}

// CHECK REDIS ACCESS ------------------------------------------------------------
// Steps: pre-scan items to build membership queries (blocks/lin/tru/inv), run them in one pipeline, then re-map each item to
// either the original object (permitted) or `{}` (redacted) with blocks taking absolute precedence.
async function checkRedisAccess({ items, userID }: CheckAccessInput): Promise<(ContentItem | {})[]> {
	if (!Array.isArray(items) || !items.length) return items as any[];

	// We use 'Set<string | number>' to handle potentially mixed ID types
	const divided = { blocks: new Set<string | number>(), lin: new Set<string | number>(), tru: new Set<string | number>(), inv: new Set<string | number>() } as Record<
		Privs | 'blocks',
		Set<string | number>
	>;

	const owned = new Set<string | number>(),
		pub = new Set<string | number>(),
		privMap = new Map<string | number, { priv: Privs; id: string | number }>();

	// REQUEST BUILD ---
	// Steps: compute the minimal set membership checks required to decide access for the whole batch.
	for (const item of items) {
		if (!item) continue;
		const { id, priv, owner }: ContentItem = item,
			ownerId = owner ?? id;

		// ANNOTATION STRATEGY: Strict Comparisons -----------------------------
		// We cast to String for safety if we are unsure, but if types are aligned we can compare directly.
		if (ownerId === userID) {
			owned.add(id);
			continue;
		}
		divided.blocks.add(ownerId); // Always check blocks
		if (!priv || priv === 'pub') pub.add(id);
		else if (priv === 'lin' || priv === 'tru') {
			divided[priv].add(ownerId);
			privMap.set(id, { priv, id: ownerId });
		} else if (priv === 'inv') {
			divided.inv.add(id);
			privMap.set(id, { priv: 'inv', id });
		}
	}

	// PIPELINE MEMBERSHIP ---
	// Steps: call smismember once per permission set, then map results back into per-priv lookup maps.
	const pipe = redis.pipeline();

	const checks: { priv: Privs; ids: (string | number)[] }[] = (Object.entries(divided) as [Privs, Set<string | number>][]).filter(([, s]) => s.size).map(([priv, set]) => ({ priv, ids: [...set] }));

	checks.forEach(({ priv, ids }) => pipe.smismember(`${redisKeys[priv]}:${userID}`, ...ids));
	const perms = { blocks: new Map(), lin: new Map(), tru: new Map(), inv: new Map() } as Record<Privs | 'blocks', Map<string | number, boolean>>;

	if (checks.length) {
		const results = await pipe.exec();
		if (results) {
			results.forEach(([, vals], i) => {
				if (Array.isArray(vals)) {
					vals.forEach((v: number, idx: number) => {
						perms[checks[i].priv].set(checks[i].ids[idx], !!v);
					});
				}
			});
		}
	}

	// FINAL GATE ---
	// Steps: allow owned; allow public if not blocked; otherwise require matching membership in the corresponding set.
	return items.map(item => {
		if (!item) return {};
		const { id, priv, owner }: ContentItem = item,
			ownerId = owner ?? id;
		// Allow if owned OR (public AND not blocked)
		if (owned.has(id) || ((!priv || priv === 'pub' || pub.has(id)) && !perms.blocks.get(ownerId))) return item;
		if (perms.blocks.get(ownerId)) return {};

		const info = privMap.get(id);
		return info && perms[info.priv].get(info.id) ? item : {};
	});
}

export { filterComments, checkRedisAccess, ioRedisSetter };
