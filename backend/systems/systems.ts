import { Writer } from './handlers/writer';
import { Catcher } from './handlers/catcher';
import { Cacher } from './handlers/cacher';
import { Socket } from './socket/socket';
import { Sql } from './mysql/mysql';
import { Redis } from './redis/redis';
import { Streamer } from './handlers/streamer';
import { Querer } from './handlers/querer';
import { Emitter } from './handlers/emitter';
import { drainStream } from './handlers/streamUtils';

// SYSTEM EXPORT AGGREGATOR -----------------------------------------------------
// Single import surface for core infrastructure services (SQL, Redis, sockets, stream IO).
// This reduces import sprawl and keeps policy-wrapped services (Writer/Querer/Catcher) consistent.
export { Writer, Catcher, Sql, Redis, Socket, Streamer, Querer, Cacher, Emitter, drainStream };
