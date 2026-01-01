// MISCELLANEOUS VARIABLES ------------------------------------------------------
// Steps: centralize “shared constants” used by multiple backend modules; keep them as computed helpers where time-based values would go stale in long-lived processes.
const getMaxLastLogin = (): number => new Date().setMonth(new Date().getMonth() - 1);

// EVENT COLUMNS ---------------------------------------------------------------
// Steps: define column lists once so SQL builders stay consistent across modules; these arrays also act as the canonical “basi vs deta” split for versioning.
const eveMetaCols: string[] = 'priv,owner,cityID,type,starts,surely,maybe,comments,score,basiVers,detaVers'.split(',');
const eveBasiCols: string[] = 'location,place,shortDesc,title,ends,cityID,imgVers,interrested'.split(',');
const eveDetaCols: string[] = 'meetHow,meetWhen,organizer,contacts,links,detail,fee,take'.split(',');
const eventsCols: string = ['id', ...eveMetaCols, ...eveBasiCols, ...eveDetaCols, 'flag']
	.map(column => `e.${column}`)
	.join(', ')
	.concat(',ST_Y(e.coords) as lat,ST_X(e.coords) as lng'.split(','));

// RETRIABLE MYSQL ERRORS -------------------------------------------------------
// Steps: list mysql errors that are safe to retry at the systems layer (deadlocks/timeouts/transient network); callers treat these as retriable failures.
const retrievableErrors: string[] = [
	'ER_LOCK_WAIT_TIMEOUT',
	'ER_LOCK_DEADLOCK',
	'ER_QUERY_TIMEOUT',
	'ER_CON_COUNT_ERROR',
	'ER_TOO_MANY_USER_CONNECTIONS',
	'ER_NET_READ_ERROR',
	'ER_NET_WRITE_ERROR',
	'ER_SERVER_SHUTDOWN',
];

export { getMaxLastLogin, eventsCols, retrievableErrors, eveMetaCols, eveBasiCols, eveDetaCols };
