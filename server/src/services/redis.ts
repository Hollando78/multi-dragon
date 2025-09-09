import { createClient, RedisClientType } from 'redis';
import { config } from '../config.js';
import { logger } from '../logger.js';

let client: RedisClientType | null = null;

export async function getRedis(): Promise<RedisClientType | null> {
  if (!config.redisUrl) return null;
  if (!client) {
    client = createClient({ url: config.redisUrl });
    client.on('error', (err) => logger.error('redis_error', err as any));
    await client.connect();
  }
  return client;
}

