import { getRedis } from './redis.js';

export async function wsRateLimit(userId: string, event: string, limit: number, windowSec: number): Promise<boolean> {
  const redis = await getRedis();
  if (!redis) return true; // if no redis, allow
  const key = `rl:ws:${event}:${userId}`;
  const n = await redis.incr(key);
  if (n === 1) await redis.expire(key, windowSec);
  return n <= limit;
}

