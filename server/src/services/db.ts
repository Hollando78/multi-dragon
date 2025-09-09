import pg from 'pg';
import { config } from '../config.js';
import { logger } from '../logger.js';
import { Registry } from 'prom-client';
import { registry as defaultRegistry } from '../metrics.js';

let pool: pg.Pool | null = null;

export function getDb() {
  if (!config.databaseUrl) return null;
  if (!pool) {
    pool = new pg.Pool({ connectionString: config.databaseUrl });
    pool.on('error', (err: Error) => logger.error(err, 'pg_pool_error'));
    // Monkey-patch query to record latency metric
    try {
      const orig = pool.query.bind(pool) as any;
      const reg: Registry = defaultRegistry;
      // lazy import to avoid circular - use sync import since we're not in async context
      const { httpDuration } = require('../metrics.js');
      const hist = httpDuration;
      (pool as any).query = async (text: any, params?: any) => {
        const start = Date.now();
        try {
          const res = await orig(text, params);
          const ms = (Date.now() - start) / 1000;
          (hist as any).observe({ method: 'PG', route: 'query', status: 'ok' }, ms);
          return res;
        } catch (e) {
          const ms = (Date.now() - start) / 1000;
          (hist as any).observe({ method: 'PG', route: 'query', status: 'error' }, ms);
          throw e;
        }
      };
    } catch {}
  }
  return pool;
}
