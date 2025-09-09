import type { Namespace, Socket } from 'socket.io';
import { config } from '../config.js';
import { logger } from '../logger.js';
import { getChunkId } from '../utils/chunk.js';
import type { MovePlayerEvent, PlayerState, ChatMessage, TradeRequest, TradeUpdate, ChunkState, BreedRequest, BreedResult, TradeOffer } from './types.js';
import jwt from 'jsonwebtoken';
import { withLock, getPOIState, setPOIState, getChunkState } from '../services/dynamicState.js';
import { getChunkPOIIds, getChunkNPCIds } from '../services/worldMap.js';
import crypto from 'crypto';
import { startTrade, acceptTrade, cancelTrade, confirmTrade, cancelUserTrades, setOffer } from '../services/trade.js';
import { attemptBreed } from '../services/breeding.js';
import { addPresence, removePresence } from '../services/presence.js';
import { getDb } from '../services/db.js';
import { manifestForSeed } from '../services/worldManifest.js';
import { wsEvents, wsConnections } from '../metrics.js';
import { validateMovement } from '../utils/collision.js';
import { wsRateLimit } from '../services/rateLimit.js';
import { generateVillageInterior } from '../procgen/villageInterior.js';
import { generateTownInterior } from '../procgen/townInterior.js';
import { generateDarkCave } from '../procgen/caveInterior.js';
import { generateRuinedCastle } from '../procgen/ruinedCastleInterior.js';
import { generateWizardsTower } from '../procgen/wizardsTowerInterior.js';
import { generateLighthouse } from '../procgen/lighthouseInterior.js';
import { generateDragonGrounds } from '../procgen/dragonGroundsInterior.js';
import { generateAncientCircle } from '../procgen/ancientCircleInterior.js';
import { getRedis } from '../services/redis.js';

type PlayersMap = Map<string, PlayerState>; // key by socket.id

const MAX_SPEED = 100; // pixels per second (reasonable game speed)
const BROADCAST_HZ = 12; // 10-15 Hz
const BROADCAST_INTERVAL = 1000 / BROADCAST_HZ;

export function attachWorldNamespace(io: Namespace) {
  const players: PlayersMap = new Map();
  const moveBudget = new Map<string, number>();

  let lastBroadcast = 0;

  function broadcastLoop(now: number) {
    if (now - lastBroadcast >= BROADCAST_INTERVAL) {
      lastBroadcast = now;
      // Broadcast positions per chunk room for efficiency
      const byChunk = new Map<string, PlayerState[]>();
      for (const p of players.values()) {
        if (!byChunk.has(p.chunkId)) byChunk.set(p.chunkId, []);
        byChunk.get(p.chunkId)!.push(p);
      }
      for (const [chunk, list] of byChunk) {
        const payload = list.slice(0, 200).map(({ userId, name, position }) => ({ userId, name, position }));
        io.to(chunk).emit('player-moved', payload);
      }
    }
    setImmediate(() => broadcastLoop(Date.now()));
  }
  // Start loop
  setImmediate(() => broadcastLoop(Date.now()));

  io.use((socket, next) => {
    // Optional auth via query token or header
    const token = (socket.handshake.auth?.token as string) || (socket.handshake.query?.token as string) || '';
    if (!token) return next();
    try {
      const payload = jwt.verify(token, config.jwt.accessSecret) as { sub: string; name?: string };
      (socket.data as any).userId = payload.sub;
      (socket.data as any).name = payload.name;
      return next();
    } catch (e) {
      logger.warn('ws_auth_failed');
      return next();
    }
  });

  // Index sockets by userId for targeted messages (trades, invites)
  const socketsByUser = new Map<string, Set<string>>();

  io.on('connection', (socket: Socket) => {
    wsConnections.inc({ namespace: socket.nsp.name });
    const seed = socket.nsp.name.split('/world/')[1] || 'default';
    const userId: string = (socket.data as any).userId || `guest:${socket.id}`;
    const name: string | undefined = (socket.data as any).name;
    
    // Get spawn point from world generation
    const worldManifest = manifestForSeed(seed);
    const spawnPoint = worldManifest.world?.spawnPoint || { x: 128, y: 128 };
    const start = { x: spawnPoint.x * 8, y: spawnPoint.y * 8 }; // Convert world tiles to pixel coordinates
    
    const chunkId = getChunkId(start.x, start.y, config.chunkSize);
    socket.join(chunkId);

    const state: PlayerState = {
      userId,
      name,
      position: start,
      lastUpdate: Date.now(),
      chunkId,
    };
    players.set(socket.id, state);
    if (!socketsByUser.has(userId)) socketsByUser.set(userId, new Set());
    socketsByUser.get(userId)!.add(socket.id);

    logger.info({ seed, userId, socket: socket.id }, 'player_connected');

    socket.emit('welcome', { seed, you: { userId, name, position: state.position } });

    socket.on('move-player', (data: MovePlayerEvent) => {
      const nowTs = Date.now();
      const last = moveBudget.get(socket.id) || 0;
      if (nowTs - last < 50) return; // throttle ~20Hz
      moveBudget.set(socket.id, nowTs);
      wsEvents.inc({ namespace: socket.nsp.name, event: 'move-player' });
      const now = Date.now();
      const prev = players.get(socket.id);
      if (!prev) return;
      const dt = Math.max(0.016, (now - prev.lastUpdate) / 1000);
      const dx = data.x - prev.position.x;
      const dy = data.y - prev.position.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const maxDist = MAX_SPEED * dt;
      let newX, newY;
      if (dist > maxDist) {
        // Clamp movement to max speed to prevent teleport
        const ratio = maxDist / dist;
        newX = prev.position.x + dx * ratio;
        newY = prev.position.y + dy * ratio;
      } else {
        newX = data.x;
        newY = data.y;
      }
      
      // Validate movement with collision detection (allow dev testing override)
      const testing = (socket.data as any).testing || {};
      const ignoreTerrain = config.env !== 'production' && testing.ignoreTerrain === true;
      const validatedPosition = ignoreTerrain
        ? { x: newX, y: newY }
        : validateMovement(prev.position.x, prev.position.y, newX, newY, seed);
      prev.position.x = validatedPosition.x;
      prev.position.y = validatedPosition.y;
      prev.lastUpdate = now;

      // Chunk transitions
      const newChunk = getChunkId(prev.position.x, prev.position.y, config.chunkSize);
      if (newChunk !== prev.chunkId) {
        // Enforce per-chunk cap
        const occupancy = Array.from(players.values()).filter(p => p.chunkId === newChunk).length;
        if (occupancy >= config.maxPlayersPerChunk) {
          socket.emit('chunk-full', { chunkId: newChunk, cap: config.maxPlayersPerChunk });
        } else {
          socket.leave(prev.chunkId);
          socket.join(newChunk);
          prev.chunkId = newChunk;
          // Send selective sync for the new chunk
          sendChunkState(seed, newChunk, socket);
        }
      }
    });

    // Testing flags (dev only)
    socket.on('testing-flags', (flags: { ignoreTerrain?: boolean }) => {
      if (config.env === 'production') return;
      (socket.data as any).testing = { ...(socket.data as any).testing, ...flags };
      logger.info({ userId, flags }, 'testing_flags_updated');
    });

    socket.on('chat-message', async (msg: ChatMessage) => {
      wsEvents.inc({ namespace: socket.nsp.name, event: 'chat-message' });
      const text = (msg?.message || '').toString().slice(0, 300);
      const channel = msg?.channel || 'local';
      const payload = { from: { userId, name }, channel, message: text, ts: Date.now() };
      if (channel === 'local') {
        io.to(state.chunkId).emit('chat-message', payload);
      } else if (channel === 'guild') {
        try {
          const db = getDb();
          if (!db) return;
          const { rows: guilds } = await db.query(`SELECT guild_id FROM guild_members WHERE player_id=$1`, [userId]);
          if (!guilds.length) return;
          const guildIds = guilds.map((r: any) => r.guild_id);
          const { rows: members } = await db.query(`SELECT player_id FROM guild_members WHERE guild_id = ANY($1)`, [guildIds]);
          const memberIds = members.map((r: any) => r.player_id);
          for (const uid of memberIds) {
            const targets = socketsByUser.get(uid);
            for (const sid of targets || []) io.sockets.get(sid)?.emit('chat-message', payload);
          }
        } catch {}
      } else {
        io.emit('chat-message', payload);
      }
    });

    // On initial connect, send the current chunk state
    sendChunkState(seed, chunkId, socket);

    function sendChunkState(seed: string, chunkId: string, sock: Socket) {
      const poiIds = getChunkPOIIds(seed, chunkId);
      const npcIds = getChunkNPCIds(seed, chunkId);
      getChunkState(seed, poiIds, npcIds).then((data) => {
        const payload: ChunkState = { chunkId, pois: data.pois, npcs: data.npcs };
        sock.emit('chunk-state', payload);
      }).catch(() => {});
    }

    socket.on('disconnect', (reason) => {
      players.delete(socket.id);
      socketsByUser.get(userId)?.delete(socket.id);
      const noneLeft = !socketsByUser.get(userId) || socketsByUser.get(userId)!.size === 0;
      if (noneLeft) {
        socketsByUser.delete(userId);
        cancelUserTrades(userId).catch(() => {});
        removePresence(seed, userId, socket.id).catch(() => {});
      }
      wsConnections.dec({ namespace: socket.nsp.name });
      logger.info({ userId, reason }, 'player_disconnected');
    });

    // Developer: force regenerate a POI interior by clearing cache
    socket.on('regenerate-poi', async ({ poiId }: { poiId: string }) => {
      if (config.env === 'production') return; // safety: dev only
      if (!(await wsRateLimit(userId, 'regenerate-poi', 5, 10))) return;
      try {
        const redis = await getRedis();
        if (redis) {
          await redis.del(`world:${seed}:poi:${poiId}:interior`);
        }
        socket.emit('poi-regenerated', { poiId, ok: true });
      } catch (e) {
        socket.emit('poi-regenerated', { poiId, ok: false, error: 'error' });
      }
    });

    // POI interaction: basic lock + mutate + broadcast
    socket.on('interact-poi', async ({ poiId, action, templateIdx, templateHash }: { poiId: string; action: string; templateIdx?: number; templateHash?: string }) => {
      // rate limit
      if (!(await wsRateLimit(userId, 'interact-poi', 30, 10))) return;
      wsEvents.inc({ namespace: socket.nsp.name, event: 'interact-poi' });
      const lockKey = `${seed}:poi:${poiId}`;
      try {
        await withLock(lockKey, 3000, async () => {
          // Optional client template verification
          if (typeof templateIdx === 'number' && templateHash) {
            const mf = manifestForSeed(seed);
            const expected = mf.world.poiTemplates[templateIdx]?.hash;
            if (expected && expected !== templateHash) {
              socket.emit('poi-interaction', { poiId, error: 'template_mismatch' });
              return;
            }
          }
          const cur = (await getPOIState(seed, poiId)) || { entities: [], discovered_by: [] };
          // Simple demo rule: mark discovered_by
          if (action === 'discover' && !cur.discovered_by.includes(userId)) {
            cur.discovered_by.push(userId);
          }
          await setPOIState(seed, poiId, cur);
          io.to(state.chunkId).emit('poi-interaction', { poiId, result: cur });
        });
      } catch (e) {
        socket.emit('poi-interaction', { poiId, error: 'locked' });
      }
    });

    // Village entry handler
    socket.on('enter-poi', async ({ poiId }: { poiId: string }) => {
      logger.info({ userId, poiId }, 'enter_poi_request_received');
      
      if (!(await wsRateLimit(userId, 'enter-poi', 5, 30))) {
        logger.warn({ userId, poiId }, 'enter_poi_rate_limited');
        return;
      }
      wsEvents.inc({ namespace: socket.nsp.name, event: 'enter-poi' });
      
      try {
        // Validate POI exists and is close to player
        const worldManifest = manifestForSeed(seed);
        const poi = worldManifest.world.pois.find((p: any) => p.id === poiId);
        if (!poi) {
          socket.emit('poi-entry-error', { error: 'poi_not_found' });
          return;
        }
        
        // Check distance (server-side validation)
        const playerState = players.get(socket.id);
        if (!playerState) return;
        
        const poiPixelX = poi.position.x * 8;
        const poiPixelY = poi.position.y * 8;
        // Special rule: Lighthouse requires being at the external door (south side)
        if (poi.type === 'lighthouse') {
          const doorX = poiPixelX;
          const doorY = poiPixelY + 8;
          const dx = Math.abs(playerState.position.x - doorX);
          const dy = playerState.position.y - poiPixelY; // south of center
          const d = Math.hypot(playerState.position.x - doorX, playerState.position.y - doorY);
          const atDoor = dx <= 12 && dy >= 0 && d <= 16;
          if (!atDoor) {
            socket.emit('poi-entry-error', { error: 'door_required' });
            return;
          }
        } else {
          const distance = Math.hypot(playerState.position.x - poiPixelX, playerState.position.y - poiPixelY);
          if (distance > 24) { // Same as client INTERACTION_DISTANCE
            socket.emit('poi-entry-error', { error: 'too_far' });
            return;
          }
        }
        
        // Check if interior already exists in cache/database
        let interior = await getPOIState(seed, `${poiId}:interior`);
        
        if (!interior) {
          // Generate new interior
          if (poi.type === 'village') {
            interior = generateVillageInterior(poiId, poi.seed, (poi as any).rarity || 'common');
          } else if (poi.type === 'town') {
            interior = generateTownInterior(poiId, poi.seed, (poi as any).rarity || 'common');
          } else if (poi.type === 'dark_cave') {
            // Generate cave with guaranteed egg for the special "Egg Cavern"
            const guaranteedEgg = poi.name === 'Egg Cavern';
            interior = generateDarkCave(poiId, poi.seed, { guaranteedEgg, rarity: (poi as any).rarity || 'common' });
          } else if (poi.type === 'ruined_castle') {
            interior = generateRuinedCastle(poiId, poi.seed, (poi as any).rarity || 'common');
          } else if (poi.type === 'wizards_tower') {
            interior = generateWizardsTower(poiId, poi.seed, (poi as any).rarity || 'common');
          } else if (poi.type === 'lighthouse') {
            interior = generateLighthouse(poiId, poi.seed, (poi as any).rarity || 'common');
          } else if (poi.type === 'dragon_grounds') {
            interior = generateDragonGrounds(poiId, poi.seed, (poi as any).rarity || 'common');
          } else if (poi.type === 'ancient_circle') {
            interior = generateAncientCircle(poiId, poi.seed, (poi as any).rarity || 'common');
          }
          
          if (interior) {
            // Try to cache the generated interior (fallback if Redis fails)
            try {
              await setPOIState(seed, `${poiId}:interior`, interior);
            } catch (e) {
              logger.warn({ poiId, seed, error: (e as Error).message }, 'failed_to_cache_interior');
            }
            logger.info({ poiId, seed }, 'generated_village_interior');
          } else {
            socket.emit('poi-entry-error', { error: 'unsupported_poi_type' });
            return;
          }
        }
        
        // Send interior data to client
        socket.emit('poi-interior', { poiId, interior });
        
      } catch (e) {
        logger.error({ poiId, error: (e as Error).message }, 'enter_poi_error');
        socket.emit('poi-entry-error', { error: 'server_error' });
      }
    });

    // Enter nested building interior within a POI (e.g., town buildings)
    socket.on('enter-building', async ({ poiId, buildingId, buildingType }: { poiId: string; buildingId: string; buildingType: string }) => {
      try {
        const worldManifest = manifestForSeed(seed);
        const poi = worldManifest.world.pois.find((p: any) => p.id === poiId);
        if (!poi) { socket.emit('building-entry-error', { error: 'poi_not_found' }); return; }
        // Basic rate limit
        if (!(await wsRateLimit(userId, 'enter-building', 5, 20))) return;
        let interior = await getPOIState(seed, `${poiId}:building:${buildingId}:interior`);
        if (!interior) {
          // Generate based on building type
          const { generateBuildingInterior } = await import('../procgen/buildingInteriors.js');
          interior = generateBuildingInterior(poiId, buildingId, poi.seed, buildingType);
          try { await setPOIState(seed, `${poiId}:building:${buildingId}:interior`, interior); } catch {}
        }
        socket.emit('building-interior', { poiId, buildingId, interior });
      } catch (e) {
        socket.emit('building-entry-error', { error: 'server_error' });
      }
    });

    // Trade request/accept/confirm/cancel with persistence
    socket.on('trade-request', async (req: TradeRequest) => {
      if (!(await wsRateLimit(userId, 'trade-request', 10, 10))) return;
      wsEvents.inc({ namespace: socket.nsp.name, event: 'trade-request' });
      try {
        const targets = socketsByUser.get(req.targetPlayerId);
        if (!targets || targets.size === 0) {
          socket.emit('trade-update', { tradeId: req.tradeId || 'na', status: 'cancelled', details: { reason: 'target_offline' } });
          return;
        }
        const tradeId = await startTrade(userId, req.targetPlayerId, req.items || []);
        const payload: TradeUpdate = { tradeId, status: 'pending', details: { from: userId, items: req.items } };
        for (const sid of targets) io.sockets.get(sid)?.emit('trade-update', payload);
        socket.emit('trade-update', payload);
      } catch (e) {
        socket.emit('trade-update', { tradeId: req.tradeId || 'na', status: 'cancelled', details: { reason: 'error' } });
      }
    });

    socket.on('trade-accept', async ({ tradeId, fromPlayerId }: { tradeId: string; fromPlayerId: string }) => {
      if (!(await wsRateLimit(userId, 'trade-accept', 20, 10))) return;
      wsEvents.inc({ namespace: socket.nsp.name, event: 'trade-accept' });
      try {
        await acceptTrade(tradeId, userId);
        const payload: TradeUpdate = { tradeId, status: 'accepted', details: { by: userId } };
        const fromSockets = socketsByUser.get(fromPlayerId);
        for (const sid of fromSockets || []) io.sockets.get(sid)?.emit('trade-update', payload);
        socket.emit('trade-update', payload);
      } catch {}
    });

    socket.on('trade-cancel', async ({ tradeId, otherPlayerId }: { tradeId: string; otherPlayerId: string }) => {
      if (!(await wsRateLimit(userId, 'trade-cancel', 20, 10))) return;
      wsEvents.inc({ namespace: socket.nsp.name, event: 'trade-cancel' });
      try { await cancelTrade(tradeId, userId); } catch {}
      const payload: TradeUpdate = { tradeId, status: 'cancelled', details: { by: userId } };
      const toSockets = socketsByUser.get(otherPlayerId);
      for (const sid of toSockets || []) io.sockets.get(sid)?.emit('trade-update', payload);
      socket.emit('trade-update', payload);
    });

    socket.on('trade-confirm', async ({ tradeId, otherPlayerId }: { tradeId: string; otherPlayerId: string }) => {
      if (!(await wsRateLimit(userId, 'trade-confirm', 20, 10))) return;
      wsEvents.inc({ namespace: socket.nsp.name, event: 'trade-confirm' });
      try {
        const state = await confirmTrade(tradeId, userId);
        const payload: TradeUpdate = { tradeId, status: state === 'completed' ? 'confirmed' : 'accepted', details: { by: userId } };
        const toSockets = socketsByUser.get(otherPlayerId);
        for (const sid of toSockets || []) io.sockets.get(sid)?.emit('trade-update', payload);
        socket.emit('trade-update', payload);
      } catch {}
    });

    socket.on('trade-offer', async ({ tradeId, items }: TradeOffer) => {
      wsEvents.inc({ namespace: socket.nsp.name, event: 'trade-offer' });
      try {
        await setOffer(tradeId, userId, items || []);
        socket.emit('trade-update', { tradeId, status: 'accepted', details: { offerUpdated: true } });
      } catch {
        socket.emit('trade-update', { tradeId, status: 'cancelled', details: { reason: 'offer_error' } });
      }
    });

    socket.on('direct-message', async ({ toUserId, message }: { toUserId: string; message: string }) => {
      wsEvents.inc({ namespace: socket.nsp.name, event: 'direct-message' });
      try {
        const text = (message || '').toString().slice(0, 300);
        if (!text) return;
        const db = getDb();
        if (db) {
          const { rows } = await db.query(
            `SELECT 1 FROM friends WHERE (user_id=$1 AND friend_id=$2) OR (user_id=$2 AND friend_id=$1) LIMIT 1`,
            [userId, toUserId]
          );
          if (!rows.length) return; // not friends
        }
        const targets = socketsByUser.get(toUserId);
        if (!targets || targets.size === 0) return;
        const payload = { from: userId, to: toUserId, message: text, ts: Date.now() };
        for (const sid of targets) io.sockets.get(sid)?.emit('direct-message', payload);
        socket.emit('direct-message', payload);
      } catch {}
    });

    // Breeding center: validate parents, enforce cooldown, persist offspring
    socket.on('breed-request', async (req: BreedRequest) => {
      if (!(await wsRateLimit(userId, 'breed-request', 5, 30))) return;
      wsEvents.inc({ namespace: socket.nsp.name, event: 'breed-request' });
      try {
        const r = await attemptBreed(seed, userId, req.parentAId, req.parentBId);
        if ('error' in r) {
          socket.emit('breed-result', { poiId: req.poiId, error: r.error, cooldownMs: r.cooldownMs });
        } else {
          const result: BreedResult = { poiId: req.poiId, offspring: r.offspring, cooldownMs: r.cooldownMs } as any;
          socket.emit('breed-result', result);
        }
      } catch {
        socket.emit('breed-result', { poiId: req.poiId, error: 'error' });
      }
    });

    // Add to presence once connected
    addPresence(seed, userId, socket.id).catch(() => {});

    // Territory updates: listen to claim API via DB triggers in future; here we expose a manual notify event
    socket.on('territory-notify', ({ regionId, guildId }: { regionId: string; guildId: string }) => {
      wsEvents.inc({ namespace: socket.nsp.name, event: 'territory-notify' });
      io.emit('territory-update', { seed, regionId, guildId, ts: Date.now() });
    });
  });
}
