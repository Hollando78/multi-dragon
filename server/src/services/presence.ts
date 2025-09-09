import { getRedis } from './redis.js';

const WORLD_SET = (seed: string) => `presence:world:${seed}`; // set of userIds
const USER_SOCKS = (uid: string) => `presence:user_sockets:${uid}`; // set of socketIds

export async function addPresence(seed: string, userId: string, socketId: string) {
  const redis = await getRedis();
  if (!redis) return;
  await redis.sAdd(USER_SOCKS(userId), socketId);
  // if first socket, add to world set
  const count = await redis.sCard(USER_SOCKS(userId));
  if (count > 0) await redis.sAdd(WORLD_SET(seed), userId);
}

export async function removePresence(seed: string, userId: string, socketId: string) {
  const redis = await getRedis();
  if (!redis) return;
  await redis.sRem(USER_SOCKS(userId), socketId);
  const remain = await redis.sCard(USER_SOCKS(userId));
  if (remain === 0) {
    await redis.del(USER_SOCKS(userId));
    await redis.sRem(WORLD_SET(seed), userId);
  }
}

export async function listOnline(seed: string): Promise<string[]> {
  const redis = await getRedis();
  if (!redis) return [];
  const ids = await redis.sMembers(WORLD_SET(seed));
  return ids;
}

