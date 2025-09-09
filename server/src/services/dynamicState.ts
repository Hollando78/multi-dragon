import type { RedisClientType } from 'redis';
import { getRedis } from './redis.js';
import { logger } from '../logger.js';

// Keys
// POI state: world:{seed}:poi:{poiId} -> JSON string
// NPC state: world:{seed}:npc:{npcId} -> JSON string
// Dirty tracking: world:{seed}:dirty -> Set of keys
// Locks: lock:{key}

const DIRTY_SET = (seed: string) => `world:${seed}:dirty`;
const POI_KEY = (seed: string, poiId: string) => `world:${seed}:poi:${poiId}`;
const NPC_KEY = (seed: string, npcId: string) => `world:${seed}:npc:${npcId}`;
const LOCK_KEY = (key: string) => `lock:${key}`;

export async function getPOIState(seed: string, poiId: string) {
  const redis = await getRedis();
  if (!redis) return null;
  const key = POI_KEY(seed, poiId);
  const s = await redis.get(key);
  return s ? JSON.parse(s) : null;
}

export async function setPOIState(seed: string, poiId: string, state: any) {
  const redis = await getRedis();
  if (!redis) return false;
  const key = POI_KEY(seed, poiId);
  await redis.set(key, JSON.stringify({ ...state, updatedAt: Date.now() }));
  await redis.sAdd(DIRTY_SET(seed), key);
  return true;
}

export async function getNPCState(seed: string, npcId: string) {
  const redis = await getRedis();
  if (!redis) return null;
  const key = NPC_KEY(seed, npcId);
  const s = await redis.get(key);
  return s ? JSON.parse(s) : null;
}

export async function setNPCState(seed: string, npcId: string, state: any) {
  const redis = await getRedis();
  if (!redis) return false;
  const key = NPC_KEY(seed, npcId);
  await redis.set(key, JSON.stringify({ ...state, updatedAt: Date.now() }));
  await redis.sAdd(DIRTY_SET(seed), key);
  return true;
}

export async function getMany(redis: RedisClientType, keys: string[]): Promise<(any | null)[]> {
  if (keys.length === 0) return [];
  const vals = await redis.mGet(keys);
  return vals.map((s) => (s ? JSON.parse(s) : null));
}

export async function getChunkState(seed: string, poiIds: string[], npcIds: string[]) {
  const redis = await getRedis();
  if (!redis) return { pois: [], npcs: [] };
  const poiKeys = poiIds.map((id) => POI_KEY(seed, id));
  const npcKeys = npcIds.map((id) => NPC_KEY(seed, id));
  const [pois, npcs] = await Promise.all([getMany(redis, poiKeys), getMany(redis, npcKeys)]);
  const poiStates = poiIds.map((id, i) => ({ id, state: pois[i] || null }));
  const npcStates = npcIds.map((id, i) => ({ id, state: npcs[i] || null }));
  return { pois: poiStates, npcs: npcStates };
}

export async function withLock(key: string, ttlMs: number, fn: () => Promise<any>) {
  const redis = await getRedis();
  if (!redis) return await fn();
  const lockKey = LOCK_KEY(key);
  const ok = await redis.set(lockKey, '1', { NX: true, PX: ttlMs });
  if (!ok) throw new Error('locked');
  try {
    return await fn();
  } finally {
    await redis.del(lockKey).catch(() => {});
  }
}

export async function flushDirtyToDb(seed: string, pgPool: any) {
  const redis = await getRedis();
  if (!redis || !pgPool) return;
  const setKey = DIRTY_SET(seed);
  let key: string | null;
  while (true) {
    key = await redis.sPop(setKey) as unknown as string | null;
    if (!key) break;
    try {
      const json = await redis.get(key);
      if (!json) continue;
      if (key.includes(':poi:')) {
        const poiId = key.split(':poi:')[1];
        await pgPool.query(
          `INSERT INTO poi_interiors (id, world_seed, poi_id, layout, entities, discovered_by)
           VALUES ($1, $2, $3, COALESCE($4::jsonb, '{}'::jsonb), COALESCE($5::jsonb,'[]'::jsonb), COALESCE($6::jsonb,'[]'::jsonb))
           ON CONFLICT (id) DO UPDATE SET layout = EXCLUDED.layout, entities = EXCLUDED.entities, discovered_by = EXCLUDED.discovered_by`,
          [
            `${seed}:${poiId}`,
            seed,
            poiId,
            null,
            JSON.parse(json).entities || [],
            JSON.parse(json).discovered_by || [],
          ]
        );
      } else if (key.includes(':npc:')) {
        const npcId = key.split(':npc:')[1];
        await pgPool.query(
          `INSERT INTO npcs (id, world_seed, npc_id, global_state, quest_states)
           VALUES ($1, $2, $3, COALESCE($4::jsonb,'{}'::jsonb), COALESCE($5::jsonb,'{}'::jsonb))
           ON CONFLICT (id) DO UPDATE SET global_state = EXCLUDED.global_state, quest_states = EXCLUDED.quest_states`,
          [
            `${seed}:${npcId}`,
            seed,
            npcId,
            JSON.parse(json).global_state || {},
            JSON.parse(json).quest_states || {},
          ]
        );
      }
    } catch (e) {
      logger.error({ key, error: (e as Error).message }, 'flush_error');
      // Re-add to dirty set to retry later
      await redis.sAdd(setKey, key!);
    }
  }
}
