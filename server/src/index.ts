import express from 'express';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import { fileURLToPath } from 'url';
import { Server as IOServer } from 'socket.io';
import { config } from './config.js';
import healthRoutes from './routes/health.js';
import worldRoutes from './routes/world.js';
import authRoutes from './routes/auth.js';
import guildRoutes from './routes/guilds.js';
import playerRoutes from './routes/players.js';
import profileRoutes from './routes/profiles.js';
import offlineRoutes from './routes/offline.js';
import territoryRoutes from './routes/territory.js';
import raceRoutes from './routes/races.js';
import marketRoutes from './routes/market.js';
import facilitiesRoutes from './routes/facilities.js';
import battlesRoutes from './routes/territoryBattles.js';
import { checkAndRotateSeason } from './services/seasons.js';
import auctionRoutes from './routes/auctions.js';
import { settleEndedAuctions } from './services/auctions.js';
import territoryQueueRoutes from './routes/territoryQueue.js';
import { matchTerritoryQueues } from './services/territoryQueue.js';
import { enforceUpkeep } from './services/territoryUpkeep.js';
import { loadFlagsFromEnv, isFeatureEnabled } from './services/flags.js';
import rateLimit from 'express-rate-limit';
import { requestId } from './middleware/requestId.js';
import { registry, timedRoute } from './metrics.js';
import gdprRoutes from './routes/gdpr.js';
import featuresRoutes from './routes/features.js';
import tournamentRoutes from './routes/tournaments.js';
import { logger } from './logger.js';
import { attachWorldNamespace } from './ws/worldNamespace.js';
import { createClient } from 'redis';
import { createAdapter } from '@socket.io/redis-adapter';
import { getDb } from './services/db.js';
import { flushDirtyToDb } from './services/dynamicState.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  const app = express();
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "blob:"],
        connectSrc: ["'self'", "ws:", "wss:"],
      },
    },
  }));
  app.use(cors());
  app.use(express.json());
  app.use(requestId);
  // Basic API rate limit
  const limiter = rateLimit({ windowMs: 60_000, max: 300 });
  app.use(limiter);

  // Routes
  app.use('/', timedRoute('/healthz'), healthRoutes);
  app.use('/', timedRoute('/worlds/:seed/manifest'), worldRoutes);
  app.use('/', timedRoute('/auth/refresh'), authRoutes);
  app.use('/', timedRoute('/guilds'), guildRoutes);
  app.use('/', timedRoute('/players'), playerRoutes);
  app.use('/', timedRoute('/profiles'), profileRoutes);
  app.use('/', timedRoute('/offline/import'), offlineRoutes);
  app.use('/', timedRoute('/races'), raceRoutes);
  app.use('/', timedRoute('/market'), marketRoutes);
  // Gate territory-related routes behind feature flag
  loadFlagsFromEnv();
  if (isFeatureEnabled('territory')) {
    app.use('/', timedRoute('/facilities'), facilitiesRoutes);
    app.use('/', timedRoute('/territory-battles'), battlesRoutes);
    app.use('/', timedRoute('/territory-queue'), territoryQueueRoutes);
    app.use('/', timedRoute('/territory'), territoryRoutes);
  }
  app.use('/', timedRoute('/auctions'), auctionRoutes);
  app.use('/', timedRoute('/me'), gdprRoutes);
  app.use('/', timedRoute('/features'), featuresRoutes);

  // Metrics endpoint
  app.get('/metrics', async (_req, res) => {
    res.set('Content-Type', registry.contentType);
    res.end(await registry.metrics());
  });
  app.use('/', tournamentRoutes);

  // Static client (for quick testing)
  app.use(express.static(path.join(__dirname, '../public')));

  const server = http.createServer(app);
  const io = new IOServer(server, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
  });

  // Optional Redis adapter for scaling
  if (config.redisUrl) {
    try {
      const pubClient = createClient({ url: config.redisUrl });
      const subClient = pubClient.duplicate();
      await pubClient.connect();
      await subClient.connect();
      io.adapter(createAdapter(pubClient, subClient));
      logger.info('socketio_redis_adapter_enabled');
    } catch (e) {
      logger.warn('socketio_redis_adapter_failed');
    }
  }

  // World namespace with dynamic seed
  const worldNs = io.of(/^\/world\/.+$/);
  worldNs.on('connect', () => {}); // avoid TS unused var
  attachWorldNamespace(worldNs);

  server.listen(config.port, () => {
    logger.info({ port: config.port }, 'server_listening');
    logger.info({ url: `http://localhost:${config.port}` }, 'test_client');
  });

  // Periodic flush of dynamic state to Postgres
  const pool = getDb();
  if (pool) {
    setInterval(async () => {
      try {
        // In a multi-world server, derive seeds from namespaces
        const namespaces = Object.keys((io as any)._nsps || {});
        const seeds = namespaces
          .filter((n) => n.startsWith('/world/'))
          .map((n) => n.replace('/world/', ''));
        for (const seed of new Set(seeds)) {
          await flushDirtyToDb(seed, pool);
        }
        // Territory-related periodic tasks are gated
        if (isFeatureEnabled('territory')) {
          await checkAndRotateSeason();
          await matchTerritoryQueues();
          await enforceUpkeep();
        }
        await settleEndedAuctions();
      } catch (e) {
        logger.error('flush_interval_error', e as any);
      }
    }, 5000);
  }
}

main().catch((err) => {
  logger.error('fatal', err as any);
  process.exit(1);
});
