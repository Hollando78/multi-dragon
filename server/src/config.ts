import dotenv from 'dotenv';
dotenv.config();

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3004', 10),
  jwt: {
    accessSecret: process.env.JWT_SECRET || 'dev_access_secret_change_me',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'dev_refresh_secret_change_me',
    accessTtlSec: parseInt(process.env.JWT_ACCESS_TTL_SEC || '900', 10), // 15m
    refreshTtlSec: parseInt(process.env.JWT_REFRESH_TTL_SEC || '1209600', 10) // 14d
  },
  redisUrl: process.env.REDIS_URL || '',
  databaseUrl: process.env.DATABASE_URL || '',
  chunkSize: parseInt(process.env.CHUNK_SIZE || '64', 10)
  , maxPlayersPerChunk: parseInt(process.env.MAX_PLAYERS_PER_CHUNK || '200', 10)
};
