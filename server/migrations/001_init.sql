-- Players (extended)
CREATE TABLE IF NOT EXISTS players (
  user_id TEXT PRIMARY KEY,
  game_id TEXT,
  colour TEXT,
  character_name TEXT,
  level INT DEFAULT 1,
  experience BIGINT DEFAULT 0,
  position_x INT DEFAULT 0,
  position_y INT DEFAULT 0,
  current_poi TEXT,
  vitality INT DEFAULT 0,
  agility INT DEFAULT 0,
  wit INT DEFAULT 0,
  spirit INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  last_active TIMESTAMPTZ DEFAULT now()
);

-- Dragons
CREATE TABLE IF NOT EXISTS dragons (
  id TEXT PRIMARY KEY,
  owner_id TEXT REFERENCES players(user_id) ON DELETE SET NULL,
  world_seed TEXT NOT NULL,
  species TEXT NOT NULL,
  name TEXT,
  level INT DEFAULT 1,
  stats JSONB DEFAULT '{}',
  bond INT DEFAULT 0,
  personality TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_dragons_owner_seed ON dragons(owner_id, world_seed);

-- Quests
CREATE TABLE IF NOT EXISTS quests (
  id TEXT PRIMARY KEY,
  player_id TEXT REFERENCES players(user_id) ON DELETE CASCADE,
  template_id TEXT NOT NULL,
  status TEXT NOT NULL,
  objectives JSONB DEFAULT '[]',
  completed_at TIMESTAMPTZ
);

-- NPCs global state per seed
CREATE TABLE IF NOT EXISTS npcs (
  id TEXT PRIMARY KEY,
  world_seed TEXT NOT NULL,
  npc_id TEXT NOT NULL,
  global_state JSONB DEFAULT '{}',
  quest_states JSONB DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_npcs_seed ON npcs(world_seed);

-- POI Interiors
CREATE TABLE IF NOT EXISTS poi_interiors (
  id TEXT PRIMARY KEY,
  world_seed TEXT NOT NULL,
  poi_id TEXT NOT NULL,
  layout JSONB NOT NULL,
  entities JSONB DEFAULT '[]',
  discovered_by JSONB DEFAULT '[]'
);
CREATE INDEX IF NOT EXISTS idx_poi_seed_poi ON poi_interiors(world_seed, poi_id);

-- Player Inventories
CREATE TABLE IF NOT EXISTS player_inventories (
  player_id TEXT REFERENCES players(user_id) ON DELETE CASCADE,
  item_id TEXT NOT NULL,
  quantity INT NOT NULL,
  equipment_slot TEXT,
  PRIMARY KEY (player_id, item_id)
);

-- World States
CREATE TABLE IF NOT EXISTS world_states (
  world_seed TEXT PRIMARY KEY,
  shared_state JSONB DEFAULT '{}',
  event_history JSONB DEFAULT '[]'
);

-- Guilds
CREATE TABLE IF NOT EXISTS guilds (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  leader_id TEXT REFERENCES players(user_id) ON DELETE SET NULL,
  description TEXT,
  level INT DEFAULT 1,
  experience BIGINT DEFAULT 0,
  treasury JSONB DEFAULT '[]',
  achievements JSONB DEFAULT '[]'
);

-- Guild Members
CREATE TABLE IF NOT EXISTS guild_members (
  guild_id TEXT REFERENCES guilds(id) ON DELETE CASCADE,
  player_id TEXT REFERENCES players(user_id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member',
  joined_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (guild_id, player_id)
);

-- Trade (escrow)
CREATE TABLE IF NOT EXISTS trade (
  id TEXT PRIMARY KEY,
  seller_id TEXT REFERENCES players(user_id) ON DELETE SET NULL,
  buyer_id TEXT REFERENCES players(user_id) ON DELETE SET NULL,
  items JSONB NOT NULL,
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_trade_status_created ON trade(status, created_at);

