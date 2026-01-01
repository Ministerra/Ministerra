/**
 * SHARED CONSTANTS ---------------------------
 * Single source of truth for values used by both frontend and backend.
 * Steps: define enums/limits/keys once here, then import from both runtimes so data encoding and protocol assumptions never drift.
 *
 * USAGE:
 * - Backend:  import { PRIVACY, INTER, REDIS_KEYS, ... } from '../shared/constants';
 * - Frontend: import { PRIVACY, INTER, LIMITS, ... } from '../../shared/constants';
 *
 * SECTIONS:
 * 1. Privacy & Visibility
 * 2. Interaction Types
 * 3. Content States & Flags
 * 4. Chat System
 * 5. User Relationships
 * 6. Event Types & Categories
 * 7. Meta Array Indexes
 * 8. User Profile
 * 9. Validation Limits
 * 10. Time Intervals
 * 11. Redis Keys
 * 12. Error Codes
 * 13. Socket Events
 * 14. API Endpoints
 * 15. Rating System
 * 16. Storage Keys
 * 17. Score Thresholds
 * 18. UI Constants
 */

import { capitalize } from './utilities';

// ============================================================================
// SECTION 1: PRIVACY & VISIBILITY ---------------------------
// ============================================================================
export const PRIVACY = {
	PUBLIC: 'pub', // Visible to everyone
	LINKS: 'lin', // Visible to linked users (friends)
	TRUSTED: 'tru', // Visible to trusted users only
	INVITED: 'inv', // Visible to invited users only
	INDIVIDUAL: 'ind', // Per-user visibility (owner controls per attendee)
	OWNER: 'own', // Owner only
};
export const PRIVACY_VALUES = Object.values(PRIVACY);
export const PRIVS_SET = new Set(PRIVACY_VALUES);
export const ATTENDANCE_VISIBILITY = ['pub', 'lin', 'tru', 'own'];

// ============================================================================
// SECTION 2: INTERACTION TYPES ---------------------------
// ============================================================================
export const INTER = {
	SURE: 'sur', // Definitely attending
	MAYBE: 'may', // Maybe attending
	INTEREST: 'int', // Interested but not committing
	DELETE: 'del', // Remove interaction
};
export const INTER_VALUES = Object.values(INTER);
export const INTER_SET = new Set(INTER_VALUES);

// ============================================================================
// SECTION 3: CONTENT STATES & FLAGS ---------------------------
// ============================================================================
export const CONTENT_STATE = {
	META: 'meta', // Only metadata loaded (compact array)
	BASIC: 'basi', // Basic info loaded
	BASIC_DETAIL: 'basiDeta', // Both basic and detail loaded
	DETAIL_ONLY: 'Deta', // Only detail loaded (needs basic)
	DELETED: 'del', // Marked for deletion
};

export const FLAG = {
	OK: 'ok', // Active/normal
	DELETED: 'del', // Soft deleted
	CANCELED: 'can', // Event canceled
	FROZEN: 'fro', // User frozen
	ARCHIVED: 'arc', // Archived (chats)
	REQUEST: 'req', // Pending request
	REFUSED: 'ref', // Request refused
	ACCEPTED: 'acc', // Request accepted
};

// ============================================================================
// SECTION 4: CHAT SYSTEM ---------------------------
// ============================================================================
export const CHAT_ROLE = {
	MEMBER: 'member',
	PRIVATE: 'priv', // Private chat participant
	GUARD: 'guard',
	ADMIN: 'admin',
	VIP: 'VIP',
	SPECTATOR: 'spect',
};
export const CHAT_ROLE_VALUES = Object.values(CHAT_ROLE);

export const CHAT_TYPE = {
	PRIVATE: 'private',
	FREE: 'free',
	GROUP: 'group',
	VIP: 'VIP',
};

export const PUNISH = {
	BAN: 'ban',
	GAG: 'gag',
	BLOCK: 'block',
	UNBAN: 'unban',
	UNGAG: 'ungag',
};

// ============================================================================
// SECTION 5: USER RELATIONSHIPS ---------------------------
// ============================================================================
export const LINK = {
	OK: 'ok', // Linked (friends)
	TRUSTED: 'tru', // Trusted relationship
	DELETED: 'del', // Link removed
};

// ============================================================================
// SECTION 7a: META INDEXES (FROM BACKEND) ---------------------------
// ============================================================================
export const META_INDEXES_SOURCE = {
	event: { priv: 0, owner: 1, cityID: 2, type: 3, starts: 4, geohash: 5, surely: 6, maybe: 7, comments: 8, score: 9, basiVers: 10, detaVers: 11 } ,
	user: { priv: 0, age: 1, gender: 2, indis: 3, basics: 4, groups: 5, score: 6, imgVers: 7, basiVers: 8, attend: 9 } ,
};
export const EVENT_META_INDEXES = Object.fromEntries(Object.entries(META_INDEXES_SOURCE.event).map(([key, value]) => [`eve${capitalize(key)}Idx`, value]));
export const USER_META_INDEXES = Object.fromEntries(Object.entries(META_INDEXES_SOURCE.user).map(([key, value]) => [`user${capitalize(key)}Idx`, value]));

// ============================================================================
// SECTION 8: USER PROFILE ---------------------------
// ============================================================================
const GENDER = { male: 'm', female: 'f', other: 'o' };
export const GENDER_VALUES = Object.values(GENDER);

// ============================================================================
// SECTION 9: VALIDATION LIMITS ---------------------------
// ============================================================================
export const LIMITS = {
	// Message limits
	MESSAGE_MAX_LENGTH: 5000,
	MESSAGE_PREVIEW_LENGTH: 40,

	// Title/Name limits
	EVENT_TITLE_MAX: 40,
	DEVICE_NAME_MAX: 100,
	INVITE_NOTE_MAX: 200,
	CITY_NAME_DISPLAY: 15,

	// Array limits
	INVITE_EVENTS_MAX: 3,
	INVITE_USERS_MAX: 20,
	BEST_OF_EVENTS: 100,

	// Payload limits
	MAX_PAYLOAD_SIZE: 262144, // 256KB
	STREAM_MAXLEN_DEFAULT: 50000,
};

// ============================================================================
// SECTION 10: TIME INTERVALS ---------------------------
// ============================================================================
export const TIME = {
	// Auth
	AUTH_ROTATION_MS: 30 * 24 * 60 * 60 * 1000, // 30 days

	// Session
	ACCESS_TOKEN_TTL_MS: 60 * 1000, // 1 minute
	REFRESH_TOKEN_TTL_MS: 7 * 24 * 60 * 60 * 1000, // 7 days
	TOKEN_CACHE_TTL_MS: 20 * 60 * 1000, // 20 minutes

	// Requests
	LOGOUT_TIMEOUT_MS: 2000,
	FOUNDATION_MIN_INTERVAL_MS: 30000, // 30 seconds
	EMIT_TIMEOUT_MS: 10000, // 10 seconds

	// Cleanup
	TEN_MINUTES_MS: 10 * 60 * 1000,
	THREE_MONTHS_MS: 90 * 24 * 60 * 60 * 1000,
	SIX_MONTHS_MS: 180 * 24 * 60 * 60 * 1000,

	// UI debounce
	INTEREST_DEBOUNCE_MS: 4000,
	PRIVACY_HIDE_DELAY_MS: 1000,
	INFORM_DISPLAY_MS: 2000,
	MAP_UPDATE_DEBOUNCE_MS: 200,
	GALLERY_MODE_TIMEOUT_MS: 10 * 60 * 1000, // 10 minutes

	// Email tokens
	VERIFY_MAIL_EXPIRY_MIN: 30,
	RESET_PASS_EXPIRY_MIN: 5,
	REVERT_EMAIL_EXPIRY_DAYS: 14,

	// Redis TTL
	VERIFY_CODE_TTL_SEC: 1800, // 30 minutes

	// Event timing
	EVENT_CANCEL_WINDOW_MS: 30 * 60 * 1000, // 30 minutes after start
};

export const AUTH_ROTATION_INTERVAL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

// ============================================================================
// SECTION 11: REDIS KEYS ---------------------------
// Key prefixes for Redis data structures
// ============================================================================
export const REDIS_KEYS = Object.fromEntries(
	[
		'links',
		'blocks',
		'trusted',
		'invites',
		'userSummary',
		'userBasi',
		'userMetas',
		'userSetsLastChange',
		'userNameImage',
		'userChatRoles',
		'userActiveChats',
		'eveMetas',
		'eveBasi',
		'eveDeta',
		'eveCityIDs',
		'eveTitleOwner',
		'friendlyEveScoredUserIDs',
		'remEve',
		'remUse',
		'eveLastAttendChangeAt',
		'lastNewCommAt',
		'chatMembers',
		'chatLeftUsers',
		'lastMembChangeAt',
		'lastSeenChangeAt',
		'citiesData',
		'cityIDs',
		'cityFiltering',
		'cityMetas',
		'cityPubMetas',
		'refreshTokens',
		'verifyCode',
		'dailyLinkReqCounts',
		'dailyIpRegisterCounts',
		'chatMessages',
		'eveComments',
		'onlineUsers',
		'topEvents',
		'tempProfile',
	].map(key => [key, key])
);

// SQL retryable errors ---------------------------
export const RETRIABLE_SQL_ERRORS = [
	'ER_LOCK_WAIT_TIMEOUT',
	'ER_LOCK_DEADLOCK',
	'ER_QUERY_TIMEOUT',
	'ER_CON_COUNT_ERROR',
	'ER_TOO_MANY_USER_CONNECTIONS',
	'ER_NET_READ_ERROR',
	'ER_NET_WRITE_ERROR',
	'ER_SERVER_SHUTDOWN',
];

// ============================================================================
// SECTION 13: SOCKET EVENTS ---------------------------
// ============================================================================
export const SOCKET_EVENT = {
	// Messages
	MESSAGE: 'message',
	MESS_SEEN: 'messSeen',

	// Chat management
	JOIN_ROOM: 'joinRoom',
	PUNISHMENT: 'punishment',
	BLOCKING: 'blocking',

	// Auth
	REFRESH_AUTH: 'refreshAuth',

	// Notifications
	ALERT: 'alert',
	LINK: 'link',
	INVITE: 'invite',

	// System
	ERROR: 'error',
	DISCONNECT: 'disconnect',
	DISCONNECTING: 'disconnecting',
};

// Frontend mode -> socket event mapping ---------------------------
export const SOCKET_MODE_MAP = {
	postMessage: SOCKET_EVENT.MESSAGE,
	editMessage: SOCKET_EVENT.MESSAGE,
	deleteMessage: SOCKET_EVENT.MESSAGE,
	kick: SOCKET_EVENT.PUNISHMENT,
	ban: SOCKET_EVENT.PUNISHMENT,
	gag: SOCKET_EVENT.PUNISHMENT,
	unban: SOCKET_EVENT.PUNISHMENT,
	ungag: SOCKET_EVENT.PUNISHMENT,
	blockChat: SOCKET_EVENT.BLOCKING,
	unblockChat: SOCKET_EVENT.BLOCKING,
	messSeen: SOCKET_EVENT.MESS_SEEN,
};

// ============================================================================
// SECTION 14: API ENDPOINTS ---------------------------
// ============================================================================
export const API = {
	ENTRANCE: '/entrance',
	FOUNDATION: '/foundation',
	EDITOR: '/editor',
	EVENT: '/event',
	CONTENT: '/content',
	GALLERY: '/gallery',
	SEARCH: '/search',
	CHAT: '/chat',
	INTERESTS: '/interests',
	INVITES: '/invites',
	DISCUSSION: '/discussion',
	FEEDBACK: '/feedback',
	RATING: '/rating',
	REPORT: '/report',
	ALERTS: '/alerts',
	IMAGES: '/images',
	USER: '/user',
	SETUP: '/setup',
	DEVICES: '/devices',
};

// ============================================================================
// SECTION 15: RATING SYSTEM ---------------------------
// ============================================================================
export const RATING = {
	event: {
		rating: ['nelíbí', 'dobrý', 'skvělý', 'výtečný!'],
		awards: { en: ['Wasteful', 'Superficial', 'Hello', 'Nazdar', 'Educational', 'Beneficial'], cz: ['konzumní', 'zbytečné', 'záživné', 'morální', 'naučné', 'Prospěšné'] },
		awardsTexts: [
			'Plýtvá, nadměrná spotřebá, konzum, luxus.',
			'Primitivní, nemorální, hloupé, povrchní.',
			'Zábavné, vizuální a nebo interaktivní',
			'Podporuje slušné chování a rozumné myšlení ',
			'Zvyšuje inteligenci, vzdělanost a přehled.',
			'Prospívá procesům, přírodě, zvířatům či lidem',
		],
	},
	meeting: {
		rating: ['slabé', 'dobrý', 'skvělý', 'výtečný!'],
		awards: { en: ['dislike', 'sympathetic', 'interesting', 'témata'], cz: ['nelíbí', 'sympaťáci', 'zajímavé', 'témata'] },
		awardsTexts: [
			'Konzumní či povrchní témata, nevhodné aktivity, nesmyslné, škodlivé či zbytečné prvky',
			'...sympatická, charismatická či inteligentně působící partička lidí, které chceš potkat',
			'Unikátní náplň nebo prospěšné, či obohacující aktivity či jiné nadstandartní prvky',
			'Zajímavá konverzační či expertní témata nebo atraktivní skladba osobnostních indikátorů',
		],
	},
	user: {
		rating: ['dobrý', 'skvělý'],
		awards: { en: ['Sympatie', 'Zajímavá', 'Prospěšná', 'Expertní'], cz: ['Sympathetic', 'Intriguing', 'Beneficial', 'Expertní'] },
		awardsTexts: ['Příjemný vzled, charisma, líbí se mi.', '...témata, zábavná nebo záživná.', '...témata, pro zdravou společnost.', '...témata, užitečná pro hodně lidí.'],
	},
	comment: {
		rating: ['slabé', 'dobré', 'skvělé', 'super'],
		awards: { en: ['Bezobsažné', 'Povrchní', 'Zajímavé', 'Inspirativní'], cz: ['Bezobsažné', 'Povrchní', 'Zajímavé', 'Inspirativní'] },
		awardsTexts: ['Bezobsažné, nezajímavé, neinspirativní.', 'Povrchní, nekvalitní, nekonzistentní.', 'Zajímavé, kvalitní, hodnotné.', 'Inspirativní, motivující, obohacující.'],
	},
};

// ============================================================================
// SECTION 16: STORAGE KEYS ---------------------------
// IndexedDB / localStorage key names
// ============================================================================
export const STORAGE_KEY = {
	TOKEN: 'token',
	USER: 'user',
	EVENTS: 'events',
	USERS: 'users',
	CHATS: 'chat',
	ALERTS: 'alerts',
	COMMS: 'comms',
	PAST: 'past',
	MISCEL: 'miscel',
	CITIES: 'cities',
};

// ============================================================================
// SECTION 17: SCORE THRESHOLDS ---------------------------
// User reputation levels based on score
// ============================================================================
export const SCORE_THRESHOLD = {
	LEVEL_7: 4000, // Highest reputation
	LEVEL_6: 1500,
	LEVEL_5: 500,
	LEVEL_4: 100,
	LEVEL_3: 25,
	LEVEL_2: 5,
	LEVEL_1: 0, // Default
};

// ============================================================================
// SECTION 18: UI CONSTANTS ---------------------------
// Viewport and display settings
// ============================================================================
export const UI = {
	BASE_FONT_SIZE: 62.5, // 62.5% = 10px base (1rem = 10px)
	MIN_VIEWPORT_WIDTH: 320,
	MIN_SCALE: 0.55,
	MAX_RETRIES_CENTRAL_FLEX: 30, // 3 seconds max
	MAX_RATING_LEVEL: 3,

	// Default columns
	COLS: {
		topEvents: 1,
		events: 2,
		users: 4,
		pastUsers: 5,
		eveStrips: 3,
		userStrips: 5,
		chatStrips: 1,
		inviteStrips: 3,
		locaStrips: 4,
		alertStrips: 4,
	},
};

// ============================================================================
// SECTION 19: TOPIC MAPPINGS ---------------------------
// User interests and group categories
// ============================================================================

// INDIS: PERSONALITY INDICATORS --------------------------------------------
export const indis = new Map(
	Object.entries({
		1: { label: 'Pohodář', long: 'Jsi extrémně přátelský, nekonfliktní, tolerantní, rád poznáváš lidi a chceš aby tě oslovovali.', shortDesc: 'Přátelský a tolerantní' },
		2: { label: 'Znalec', long: 'Máš obrovské know-how o všem možném a rád ostatní obohacuješ svými znalostmi', shortDesc: 'Znalý a obohacující' },
		3: { label: 'Nezadaný', long: 'Hledáš primárně vztah. Nemáš zájem o sex, chceš se poznat s potenciální partnery.', shortDesc: 'Hledá vztah, ne sex' },
		4: { label: 'Intelektuál', long: 'Nebaví tě chit-chat. Chceš řešít VÝLUEČNĚ náročná a progresivní témata, která mají hloubku.', shortDesc: 'Náročný a přemýšlivý' },
		5: { label: 'Kritik', long: 'Jsi realista. Nespokojený. Umíš objektivně zhodnotit proč je něco špatně. Rád kritizuješ a hledáš chyby.', shortDesc: 'Realista a kritický' },
		6: { label: 'Bavič', long: 'Máš dar k tomu rozesmívat lidi a skutečně to umíš. Tuhle vlastnost pořád trénuješ.', shortDesc: 'Rozesmívá a trénuje' },
		7: { label: 'Divočák', long: 'Možná hledáš vztah, ale možné taky ne. Když se ovšem najde někdo na ... tak ...', shortDesc: 'Svolný k intimnostem.' },
		8: { label: 'Přírodář', long: 'Žiješ v souladu s přírodou. Jsi minimalista. Alternativní člověk, případně duchovně založený.', shortDesc: 'Minimalista či přírodář' },
		9: { label: 'Speaker', long: 'Your english is good enough for fluent and sophisticated disscusion.', shortDesc: 'Fluentní angličtinář' },
		10: { label: 'Podivín', long: 'Jsi jak z jiného světa a nebo máš problém navazovat kontakty. Lidé ti nerozumí, nemáš moc přátel.', shortDesc: 'Nepochopený, zvláštní, možná osamělý' },
	}).map(([key, value]) => [parseInt(key), value])
);

// MAPPING TOPICS TO NUMBERS ------------------------------------------------
export const basicsSrc = new Map(
	Object.entries({
		1: 'Vnitrostátní politika',
		2: 'Správná výchova dětí',
		3: 'Rozvoj České republiky',
		4: 'Respektuhodní lidé',
		5: 'Technologie a vynálezy',
		6: 'Ochrana planety',
		7: 'Kritika společnosti',
		8: 'Osobnostní růst',
		9: 'Prospěšné projekty ',
		10: 'Toxický mainstream',
		11: 'Zdravý životní styl',
		12: 'Mezilidské vztahy',
		13: 'Partnerské vztahy',
		14: 'Vzdálená budoucnost',
		15: 'Umělá inteligence',
		16: 'Migrace a mix kultur',
		17: 'Konzum a nadprodukce',
		18: 'Povrchní společnost,',
		19: 'Vzdělávání a věda',
		20: 'Rozvoj tvého města',
		21: 'Dění v Evropské unii',
		22: 'Náboženství a víra',
		23: 'Dopad sociálních sítí',
		24: 'Mentální (ne)zdraví',
		25: 'Budoucnost lidstva',
		26: 'Management a leadership',
		27: 'Život na low-budget',
		28: 'Investice a finance',
	}).map(([key, value]) => [parseInt(key), value.trim()])
);

export const groupsSrc = new Map(
	Object.entries({
		Expertise: new Map(
			Object.entries({
				a1: 'marketer',
				a2: 'elektrikář',
				a3: 'stavebník',
				a4: 'řidič',
				a5: 'ředitel',
				a6: 'truhlář',

				a7: 'psycholog',
				a8: 'designer',
				a9: 'programátor',
				a10: 'učitel',
				a11: 'kuchař',
				a12: 'zdravotník',
				a13: 'zahradník',
				a14: 'fotograf',
				a15: 'právník',
				a16: 'lékař',
				a17: 'farmář',
				a18: 'grafik',
				a19: 'architekt',
				a20: 'inženýr',
			})
		),
		Hobbies: new Map(
			Object.entries({
				b1: 'sport',
				b2: 'hudba',
				b3: 'cestování',
				b4: 'pejsci',
				b5: 'vaření',
				b6: 'kočky',
				b7: 'četba',
				b8: 'filmy',
				b9: 'malování',
				b10: 'keramika',
				b11: 'cyklistika',
				b12: 'plavání',
				b13: 'tanec',
				b14: 'divadlo',
				b15: 'yoga',
				b16: 'fotografování',
				b17: 'zahradničení',
				b18: 'pěší turistika',
				b19: 'počítačové hry',
				b20: 'kempování',
			})
		),
		Persona: new Map(
			Object.entries({
				c1: 'pohodový',
				c2: 'nervózní',
				c3: 'přísný',
				c4: 'cynický',
				c5: 'negativní',
				c6: 'veselý',
				c7: 'optimistický',
				c8: 'introvertní',
				c9: 'extravertní',
				c10: 'kreativní',
				c11: 'pracovitý',
				c12: 'vstřícný',
				c13: 'empatický',
				c14: 'ambiciózní',
				c15: 'přátelský',
				c16: 'upovídaný',
				c17: 'tichý',
				c18: 'konkurenční',
				c19: 'nespolehlivý',
				c20: 'zvídavý',
			})
		),
		Special: new Map(
			Object.entries({
				d1: 'zdravotní',
				d2: 'životní',
				d3: 'investor',
				d4: 'nezaměstnaný',
				d5: 'ženatý',
				d6: 'svobodný',
				d7: 'děti',
				d8: 'vdovec',
				d9: 'bez dětí',
				d10: 's přítelem',
				d11: 's přítelkyní',
				d12: 'oddaný',
				d13: 've vztahu',
				d14: 'sezdaný',
				d15: 'vdaná',
				d16: 'ovdovělý',
				d17: 'šťastný',
				d18: 'nespokojený',
				d19: 'bohatý',
				d20: 'chudý',
			})
		),
		Ethnics: new Map(
			Object.entries({
				e1: 'český',
				e2: 'slovenský',
				e3: 'rusko',
				e4: 'cikán',
				e5: 'černoch',
				e6: 'křesťan',
				e7: 'muslim',
				e8: 'žid',
				e9: 'americký',
				e10: 'německý',
				e11: 'francouzský',
				e12: 'italský',
				e13: 'španělský',
				e14: 'brazilský',
				e15: 'japonský',
				e16: 'čínský',
				e17: 'indický',
				e18: 'africký',
				e19: 'arabský',
				e20: 'turecký',
			})
		),
		Services: new Map(
			Object.entries({
				f1: 'vezmu jakoukoliv práci',
				f2: 'do startupu za podíl',
				f3: 'do projektu za mzdu',
				f4: 'testujuuuuu',
				f5: 'masér',
				f6: 'fotograf',
				f7: 'grafik',
				f8: 'designer',
				f9: 'programátor',
				f10: 'copywriter',
				f11: 'architekt',
				f12: 'inženýr',
				f13: 'stavebník',
				f14: 'elektrikář',
				f15: 'zahradník',
				f16: 'kuchař',
				f17: 'prodavač',
				f18: 'účetní',
				f19: 'recepci',
				f20: 'řidič',
			})
		),
	})
);

// ============================================================================
// SECTION 20: DATABASE COLUMNS ---------------------------
// Column lists for SQL queries
// ============================================================================

// Event columns ---------------------------
export const DB_COLS = {
	EVE_META: ['priv', 'owner', 'cityID', 'type', 'starts', 'surely', 'maybe', 'comments', 'score', 'basiVers', 'detaVers'],
	EVE_BASI: ['location', 'place', 'shortDesc', 'title', 'ends', 'cityID', 'imgVers', 'interrested'],
	EVE_DETA: ['meetHow', 'meetWhen', 'organizer', 'contacts', 'links', 'detail', 'fee', 'take'],
	USER_META: ['priv', 'birth', 'gender', 'indis', 'basics', 'groups', 'score', 'imgVers', 'basiVers'],
	USER_BASI: ['first', 'last', 'shortDesc', 'exps', 'favs'],
	USER_UTIL: ['cities', 'askPriv', 'defPriv'],
	USER_SETUP: ['first', 'image', 'age', 'id', 'last', 'favs', 'exps', 'cities', 'priv', 'defPriv', 'askPriv', 'basics', 'groups', 'indis', 'gender', 'location', 'shortDesc', 'birth', 'imgVers'],
};

export const USER_MINI_KEYS = ['id', 'first', 'last', 'imgVers'];
export const USER_META_KEYS = ['id', 'priv', 'birth', 'gender', 'indis', 'basics', 'groups', 'score', 'imgVers', 'basiVers'];
export const USER_BASI_KEYS = ['first', 'last', 'shortDesc', 'exps', 'favs'];
export const USER_GENERIC_KEYS = [...USER_META_KEYS, ...USER_BASI_KEYS];

export const USER_UTILITY_KEYS = ['cities', 'askPriv', 'defPriv'];
export const USER_PROFILE_KEYS = [...USER_GENERIC_KEYS, ...USER_UTILITY_KEYS];

// ============================================================================
// SECTION 21: ACTION FLAGS ---------------------------
// CRUD-like operation prefixes
// ============================================================================
export const ACTION = {
	NEW: 'new',
	EDIT: 'edi',
	DELETE: 'del',
};

// ============================================================================
// SECTION 22: ALERT TYPES ---------------------------
// Types of alerts/notifications
// ============================================================================
export const ALERT_TYPE = {
	LINK: 'link',
	INVITE: 'invite',
	COMMENT: 'comment',
	MESSAGE: 'message',
	RATING: 'rating',
};

// Offline alert status flag ---------------------------
export const OFFLINE_ALERT_STATUS = 1;

// ============================================================================
// SECTION 23: HASH ALGORITHMS ---------------------------
// Consistent hash settings
// ============================================================================
export const HASH = {
	DJB2_INIT: 5381, // djb2 hash initial value
	LOCATION_HASH_LENGTH: 10,
	GEOHASH_PRECISION: 9,
};

// ============================================================================
// SECTION 24: EVENT TITLES ---------------------------
// Friendly friendlyMeetings title templates (Czech)
// ============================================================================

export const friendlyMeetings = new Map(
	Object.entries({
		a1: { en: 'outdoors', cz: 'venku', quick: 'chci ven' },
		a2: { en: 'beer', cz: 'pivko', quick: 'na pivko' },
		a3: { en: 'coffee', cz: 'káva', quick: 'na kávu' },
		a4: { en: 'games', cz: 'hravé', quick: 'zahrajem' },
		a5: { en: 'indoors', cz: 'uvnitř', quick: 'zalézt' },
		a6: { en: 'party', cz: 'pařba', quick: 'zapařit' },
		a7: { en: 'discuss', cz: 'diskuzní', quick: 'diskuzi' },
		a8: { en: 'english', cz: 'anglicky', quick: 'speakřit' },
		a9: { en: 'exercise', cz: 'cvičení', quick: 'zacvičit' },
		a10: { en: 'dogs', cz: 's pejsky', quick: 's pejsky' },
		a11: { en: 'teens', cz: 'teens', quick: 'slezinu' },
		a12: { en: 'singles', cz: 'nezadaní', quick: 'seznámit' },
		a13: { en: 'business', cz: 'business', quick: 'business' },
		a14: { en: 'nature', cz: 'příroda', quick: 'do přírody' },
		a15: { en: 'seniors', cz: 'senioři', quick: 'se staršími' },
		a16: { en: 'gypsies', cz: 's romy', quick: 's romy' },
	})
);

export const beneficialEvents = new Map(
	Object.entries({
		b1: { en: 'volunteering', cz: 'dobrovolné' },
		b2: { en: 'wellbeing', cz: 'duševní' },
		b3: { en: 'critical', cz: 'kritické' },
		b4: { en: 'health', cz: 'zdravotní' },
		b5: { en: 'environment', cz: 'ekologické' },
		b6: { en: 'charity', cz: 'charitní' },
		b7: { en: 'social', cz: 'sociální' },
		b8: { en: 'animal', cz: 'zvířecí' },
		b9: { en: 'spiritual', cz: 'duchovní' },
		b10: { en: 'educational', cz: 'vzdělávací' },
		b11: { en: 'protest', cz: 'protestní' },
		b12: { en: 'fitness', cz: 'fitness' },
	})
);

export const culturalEvents = new Map(
	Object.entries({
		c1: { en: 'textile', cz: 'textil' },
		c2: { en: 'furniture', cz: 'nábytek' },
		c3: { en: 'transport', cz: 'doprava' },
		c4: { en: 'tourism', cz: 'turistika' },
		c5: { en: 'history', cz: 'historie' },
		c6: { en: 'deedjey', cz: 'dídžej' },
		c7: { en: 'food', cz: 'gastro' },
		c8: { en: 'funny', cz: 'zábavné' },
		c9: { en: 'family', cz: 'rodinné' },
		c10: { en: 'concert', cz: 'koncert' },
		c11: { en: 'dating', cz: 'seznamka' },
		c12: { en: 'festival', cz: 'festival' },
	})
);

export const professionalEvents = new Map(
	Object.entries({
		d1: { en: 'chemie', cz: 'chemistry' },
		d2: { en: 'environment', cz: 'prostředí' },
		d3: { en: 'physics', cz: 'fyzika' },
		d4: { en: 'technology', cz: 'technologie' },
		d5: { en: 'economy', cz: 'ekonomie' },
		d6: { en: 'finances', cz: 'finance' },
		d7: { en: 'marketing', cz: 'marketing' },
		d8: { en: 'psychology', cz: 'psychologie' },
		d9: { en: 'design', cz: 'design' },
		d10: { en: 'medicine', cz: 'medicína' },
		d11: { en: 'IT', cz: 'IT' },
		d12: { en: 'management', cz: 'management' },
	})
);

// ============================================================================
// SECTION 25: COMPONENT LISTS ---------------------------
// UI component configurations per section
// ============================================================================
export const COMPONENTS = {
	event: ['Image', 'TitleTexts', 'Content', 'Texts', 'BsEvent', 'RatingBs', 'TextArea', 'Entrance', 'Discussion', 'SortMenu'],
	home: ['Header', 'HeaderTexts', 'Quicks', 'CatFilter', 'Tools', 'Content'],
	setup: ['Personals', 'Cities', 'Indis', 'Basics', 'Favex', 'Picture', 'Groups'],
	editor: ['CatFilter', 'Filter', 'IntroTexts', 'Cropper', 'EventInfo'],
};

export const REGEXES = {
	name: /^[\p{L}\s'-]+$/u,
	favouriteExpertTopic: /^[\p{L}][\p{L}\s]*[\p{L}]$/u,
	email: /^(?=.{1,254})(?=.{1,64}@)[a-zA-Z0-9!#$%&'*+/=?^_`{|}~.-]+@(?:(?=[a-zA-Z0-9-]{1,63}\.)(xn--)?[a-zA-Z0-9]+(?:-[a-zA-Z0-9]+)*\.){1,8}(?=[a-zA-Z]{2,63})(xn--[a-zA-Z0-9]{1,59})?[a-zA-Z]{2,63}$/,
};

export const MAX_CHARS = {
	favourExpertTopics: 200,
	userShortDesc: 600,
};

export const MIN_CHARS = {
	favourExpertTopic: 3,
	password: 8,
};

export const MIN_COUNTS = {
	favouriteTopics: 2,
};

export const MAX_COUNTS = {
	cities: 4,
	indis: 5,
	basics: 8,
	groups: 10,
};
// Share platform options ---------------------------
export const SHARE_PLATFORMS = ['Facebook', 'Twitter', 'WhatsApp', 'Instagram', 'Email', 'Pozvat'];

// ============================================================================
// SECTION 26: VIEW MODES ---------------------------
// Default view/filter settings
// ============================================================================
export const DEFAULT_SHOW = {
	quick: false,
	tools: 'basic',
	filter: false,
	times: false,
	sorts: false,
	sherlock: false,
	history: false,
	map: false,
	views: false,
	view: 'cityEvents',
};

// ============================================================================
// SECTION 28: STREAM SETTINGS ---------------------------
// Redis stream configurations
// ============================================================================
export const STREAM = {
	XLEN_WARN_RATIO: 0.8, // Warn when stream reaches 80% of MAXLEN
	DEFAULT_READ_COUNT: 1000,
	DEFAULT_MAXLEN: 50000,
};

// ============================================================================
// SECTION 29: USER STATUS ---------------------------
// Account lifecycle states
// ============================================================================
export const USER_STATUS = {
	NOT_VERIFIED: 'notVerified', // Email not verified
	UNINTRODUCED: 'unintroduced', // Hasn't completed profile
	NEW_USER: 'newUser', // First 3 months
	USER: 'user', // Normal active user
	FROZEN: 'frozen', // Account frozen by user
};

// ============================================================================
// SECTION 30: FOUNDATION LOAD TYPES ---------------------------
// Types of data loads on app init/refresh
// ============================================================================
export const FOUNDATION_LOADS = { init: 'init', fast: 'fast', auth: 'auth', cities: 'cities', topEvents: 'topEvents' };

export const HOME_VIEWS = {
	cityEvents: 'cityEvents', // User's location
	topEvents: 'topEvents',
};

// ============================================================================
// SECTION 36: INVITE MODES ---------------------------
// Invitation operation modes
// ============================================================================
export const INVITE_MODE = {
	LIST: 'list', // List invitations
	INVITE_USERS: 'inviteUsers', // Invite users to event
	INVITE_EVENTS: 'inviteEvents', // Invite user to events
	ACCEPT: 'accept',
	REFUSE: 'refuse',
	CANCEL: 'cancel',
	DELETE: 'delete',
	CANCEL_ALL: 'cancelAll',
	DELETE_ALL: 'deleteAll',
};

// ============================================================================
// SECTION 37: EDITOR MODES ---------------------------
// Event editor operation modes
// ============================================================================
export const EDITOR_MODE = {
	CREATE: 'create',
	EDIT: 'edit',
	DELETE: 'delete',
	CANCEL: 'cancel',
};

// ============================================================================
// SECTION 38: ENTRANCE MODES ---------------------------
// Auth/entrance operation modes
// ============================================================================
export const ENTRANCE_MODE = {
	LOGIN: 'login',
	REGISTER: 'register',
	VERIFY_MAIL: 'verifyMail',
	RESET_PASS: 'resetPass',
	CHANGE_MAIL: 'changeMail',
	CHANGE_PASS: 'changePass',
	CHANGE_BOTH: 'changeBoth',
	VERIFY_NEW_MAIL: 'verifyNewMail',
	REVERT_EMAIL_CHANGE: 'revertEmailChange',
	RENEW_ACCESS_TOKEN: 'renewAccessToken',
	LOGOUT_DEVICE: 'logoutDevice',
	RESEND_MAIL: 'resendMail',
};

// ============================================================================
// SECTION 39: PRECISION VALUES ---------------------------
// Decimal precision for formatting
// ============================================================================
export const PRECISION = {
	COORDS: 6, // Lat/lng decimal places
	PERCENTAGE: 2, // Percentage display
	DISTANCE_KM: 1, // Distance in kilometers
	FONT_SIZE: 3, // CSS font size
};

// ============================================================================
// SECTION 40: ENCODING ---------------------------
// Encoding settings
// ============================================================================
export const ENCODING = {
	BASE36_RADIX: 36,
	HASH_SUBSTRING_LENGTH: 10,
};

// ============================================================================
// SECTION 41: MESSAGE MODES ---------------------------
// Chat message operation modes
// ============================================================================
export const MESSAGE_MODE = {
	POST: 'postMessage',
	EDIT: 'editMessage',
	DELETE: 'deleteMessage',
	NEW: 'new',
	EDI: 'edi',
	DEL: 'del',
};

// ============================================================================
// SECTION 42: CITY LOADING ---------------------------
// City content loading modes
// ============================================================================
export const CITY_LOAD = {
	EVENTS: 'events',
	USERS: 'users',
	METAS: 'metas',
};

// ============================================================================
// SECTION 43: DISTANCE THRESHOLDS ---------------------------
// Distance display thresholds (meters/km)
// ============================================================================
export const DISTANCE = {
	METERS_THRESHOLD: 1000, // Below this, show meters
	KM_ROUND_THRESHOLD: 5, // Above this, round to whole km
};

// ============================================================================
// SECTION 44: COOKIE NAMES ---------------------------
// HTTP cookie identifiers
// ============================================================================
export const COOKIE = {
	REFRESH_TOKEN: 'refreshToken',
	ACCESS_TOKEN: 'accessToken',
};

// ============================================================================
// SECTION 45: TIME FILTERS ---------------------------
// Event time filter options
// ============================================================================
export const TIME_FILTER = {
	ANYTIME: 'anytime',
	TODAY: 'today',
	TOMORROW: 'tomorrow',
	THIS_WEEK: 'thisWeek',
	THIS_WEEKEND: 'thisWeekend',
	NEXT_WEEK: 'nextWeek',
};

export const TIME_FILTER_LABELS = {
	[TIME_FILTER.ANYTIME]: 'kdykoliv',
	[TIME_FILTER.TODAY]: 'dnes',
	[TIME_FILTER.TOMORROW]: 'zítra',
	[TIME_FILTER.THIS_WEEK]: 'tento týden',
	[TIME_FILTER.THIS_WEEKEND]: 'víkend',
	[TIME_FILTER.NEXT_WEEK]: 'příští týden',
};

// ============================================================================
// SECTION 46: LOCATION MODES ---------------------------
// Event location specification modes
// ============================================================================
export const LOCATION_MODE = {
	EXACT: 'exact', // Exact coordinates
	CITY: 'city', // City only (no coords)
	RADIUS: 'radius', // City with radius
	NAMED: 'named', // Named location
};

// ============================================================================
// SECTION 47: CONTENT VIEW ---------------------------
// Main content view types
// ============================================================================
export const CONTENT_VIEW = {
	EVENTS: 'events',
	USERS: 'users',
};

// ============================================================================
// SECTION 48: IMAGE SIZES ---------------------------
// Image size suffixes for different contexts
// ============================================================================
export const IMAGE_SIZE = {
	SMALL: 'S', // Thumbnail (profile pics in lists)
	MEDIUM: 'M', // Medium size (cards)
	LARGE: 'L', // Full size (detail view)
};

// ============================================================================
// SECTION 49: SCROLL DIRECTION ---------------------------
// UI scroll state
// ============================================================================
export const SCROLL_DIR = {
	UP: 'up',
	DOWN: 'down',
};

// ============================================================================
// SECTION 50: CARD VIEW MODES ---------------------------
// Event/user card display styles
// ============================================================================
export const CARD_VIEW = {
	COMPACT: 1, // Compact card
	EXPANDED: 2, // Expanded with details
	FULL: 3, // Full card (events only)
};

// ============================================================================
// SECTION 51: NOTIFICATION DOTS ---------------------------
// Notification indicator keys
// ============================================================================
export const NOTIF_DOT = {
	CHATS: 'chats',
	ALERTS: 'alerts',
	ARCHIVE: 'archive',
};

// ============================================================================
// SECTION 53: EMAIL MODES ---------------------------
// Email notification types
// ============================================================================
export const EMAIL_MODE = {
	VERIFY_MAIL: 'verifyMail',
	RESET_PASS: 'resetPass',
	PASS_CHANGED: 'passChanged',
	CHANGE_MAIL: 'changeMail',
	CHANGE_PASS: 'changePass',
	CHANGE_BOTH: 'changeBoth',
	VERIFY_NEW_MAIL: 'verifyNewMail',
	REVERT_EMAIL_CHANGE: 'revertEmailChange',
};

// ============================================================================
// SECTION 54: ENV VARIABLES ---------------------------
// Environment variable names (for documentation)
// ============================================================================
export const ENV = {
	// Backend
	AUTH_CRYPTER: 'AUTH_CRYPTER',
	AJWT_SECRET: 'AJWT_SECRET',
	RJWT_SECRET: 'RJWT_SECRET',
	REGISTER_IP_LIMIT: 'REGISTER_IP_LIMIT',
	STREAM_MAXLEN: 'STREAM_MAXLEN',
	STREAM_READ_COUNT: 'STREAM_READ_COUNT',
	DAILY_RECALC_REDIS_USERSET_BATCH: 'DAILY_RECALC_REDIS_USERSET_BATCH',
	COOKIE_SECURE: 'COOKIE_SECURE',
	COOKIE_SAMESITE: 'COOKIE_SAMESITE',
	COOKIE_DOMAIN: 'COOKIE_DOMAIN',
	NODE_ENV: 'NODE_ENV',
	FRONT_END: 'FRONT_END',
	// Frontend
	VITE_BACK_END: 'VITE_BACK_END',
};

// ============================================================================
// SECTION 57: LINK REQUEST WHO ---------------------------
// Who initiated/confirmed the link
// ============================================================================
export const LINK_WHO = {
	initiator: 1, // User who sent request
	recipient: 2, // User who received request
	mutual: 3, // Both confirmed
};

// ============================================================================
// SECTION 59: PUBLIC PATHS ---------------------------
// Static asset path prefixes
// ============================================================================
export const PUBLIC_PATH = {
	USERS: '/public/users/',
	EVENTS: '/public/events/',
	ICONS: '/icons/',
};

// ============================================================================
// SECTION 60: TOKEN EXPIRY ---------------------------
// JWT token expiration values
// ============================================================================
export const REVERT_EMAIL_DAYS = 14;
export const EXPIRATIONS = {
	ACCESS_TOKEN: '20m', // Access token
	REFRESH_TOKEN: '7d', // Refresh token
	AUTH_TOKEN: '5m', // Temporary tokens (verify, reset)
	VERIFY_MAIL: '30m', // Unintroduced user token
	REVERT_EMAIL: `${REVERT_EMAIL_DAYS}d`, // Email revert window
};

export const ALLOWED_IDS = {
	indis: new Set(Array.from(indis.keys())),
	groups: new Set(Array.from(groupsSrc.values()).flatMap(group => Array.from(group.keys()))),
	basics: new Set(Array.from(basicsSrc.keys())),
	type: new Set(Array.from(friendlyMeetings.keys()).concat(Array.from(culturalEvents.keys()).concat(Array.from(professionalEvents.keys()).concat(Array.from(beneficialEvents.keys()))))),
};
