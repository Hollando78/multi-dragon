import { getRedis } from './redis.js';
import { getDb } from './db.js';
import { randomUUID } from 'crypto';

const ATT_Q = (seed: string, region: string) => `tbqueue:${seed}:${region}:attackers`;
const DEF_Q = (seed: string, region: string) => `tbqueue:${seed}:${region}:defenders`;

export async function enqueueTerritory(seed: string, regionId: string, userId: string, role: 'attacker'|'defender') {
  const redis = await getRedis();
  if (!redis) throw new Error('redis');
  const key = role === 'attacker' ? ATT_Q(seed, regionId) : DEF_Q(seed, regionId);
  await redis.sAdd(key, userId);
}

export async function matchTerritoryQueues() {
  const db = getDb();
  const redis = await getRedis();
  if (!db || !redis) return;
  // For demo, we scan keys naively
  const keys = await redis.keys('tbqueue:*:*:attackers');
  for (const akey of keys) {
    const [_, seed, region] = akey.split(':');
    const dkey = DEF_Q(seed, region);
    const [attackers, defenders] = await Promise.all([redis.sMembers(akey), redis.sMembers(dkey)]);
    if (attackers.length && defenders.length) {
      const attackerGuild = await guildOf(attackers[0]);
      const defenderGuild = await guildOf(defenders[0]);
      if (!attackerGuild || !defenderGuild || attackerGuild === defenderGuild) continue;
      // Start a battle
      const id = randomUUID().replace(/-/g, '');
      await db.query(
        `INSERT INTO territory_battles (id, world_seed, region_id, attackers, defenders, status, started_at)
         VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, 'active', now())`,
        [id, seed, region, JSON.stringify([attackerGuild]), JSON.stringify([defenderGuild])]
      );
      await db.query(`UPDATE territories SET contested=true, contested_by=$3 WHERE world_seed=$1 AND region_id=$2`, [seed, region, attackerGuild]);
      await Promise.all([
        redis.sRem(akey, attackers[0]),
        redis.sRem(dkey, defenders[0])
      ]);
    }
  }
}

async function guildOf(userId: string): Promise<string|null> {
  const db = getDb(); if (!db) return null;
  const { rows } = await db.query(`SELECT guild_id FROM guild_members WHERE player_id=$1 LIMIT 1`, [userId]);
  return rows.length ? rows[0].guild_id : null;
}

// randomUUID provided via crypto import
