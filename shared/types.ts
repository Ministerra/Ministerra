import { REDIS_KEYS } from './constants';

export type Privs = 'pub' | 'lin' | 'tru' | 'inv' | 'ind' | 'own';
export type ContentFilteringSets = 'links' | 'blocks' | 'invites' | 'trusted';
export type RedisKey = keyof typeof REDIS_KEYS;
export type Inters = 'sur' | 'may' | 'int';
export type InterFlags = Inters | 'surMay' | 'surInt' | 'maySur' | 'mayInt' | 'intSur' | 'intMay' | 'minSur' | 'minMay' | 'minInt' | 'surPriv' | 'mayPriv' | 'intPriv' | 'del';

export type EventMeta = [Privs, string, number, string, string, string, number, number, number, number, number, number];
export type UserMeta = [Privs, number, string, string, string, string, number, number, number, { eid: string; inter: Inters; ep?: Privs }[]];
