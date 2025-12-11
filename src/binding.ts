import { KVNamespace, D1Database } from '@cloudflare/workers-types';

export type Bindings = {
  DB: D1Database;
  SESSION_KV: KVNamespace;
};
