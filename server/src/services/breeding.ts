import { getDb } from './db.js';
import { getRedis } from './redis.js';
import crypto from 'crypto';

const COOLDOWN_KEY = (seed: string, uid: string) => `breed:cd:${seed}:${uid}`;

export async function attemptBreed(seed: string, userId: string, parentAId: string, parentBId: string) {
  const db = getDb();
  const redis = await getRedis();
  if (!db || !redis) throw new Error('infra_unavailable');
  const ttl = await redis.ttl(COOLDOWN_KEY(seed, userId));
  if (ttl && ttl > 0) {
    return { error: 'cooldown', cooldownMs: ttl * 1000 };
  }
  // Verify ownership of parents
  const { rows } = await db.query(`SELECT id FROM dragons WHERE id = ANY($1) AND owner_id=$2`, [[parentAId, parentBId], userId]);
  if (rows.length < 2) return { error: 'invalid_parents' };

  const hash = crypto.createHash('sha1').update(`${seed}:${parentAId}:${parentBId}`).digest('hex');
  const speciesPool = ['emberling', 'stormscale', 'glacia', 'verdant'];
  const species = speciesPool[parseInt(hash.slice(0, 2), 16) % speciesPool.length];
  const level = 1;
  const stats = { str: parseInt(hash.slice(2, 4), 16) % 10 + 5, agi: parseInt(hash.slice(4, 6), 16) % 10 + 5 };
  const offspringId = `d:${hash.slice(0, 12)}`;

  await db.query(
    `INSERT INTO dragons (id, owner_id, world_seed, species, name, level, stats, bond, personality)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 0, NULL) ON CONFLICT (id) DO NOTHING`,
    [offspringId, userId, seed, species, null, level, JSON.stringify(stats)]
  );

  // Set cooldown 30s
  await redis.setEx(COOLDOWN_KEY(seed, userId), 30, '1');
  return { offspring: { id: offspringId, species, level, stats }, cooldownMs: 30000 };
}

