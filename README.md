# Multiplayer Dragon Isle — MMORPG Server

A comprehensive multiplayer dragon collection MMORPG featuring real-time gameplay, territory control, and social systems. Built with Node.js, TypeScript, Socket.IO, PostgreSQL, and Redis.

## What’s Included
- Backend: Node.js + TypeScript Express API and Socket.IO server
  - Health endpoints: `GET /healthz`, `GET /readyz`
  - Auth scaffolding: JWT access/refresh with `POST /auth/refresh`
  - World manifest placeholder: `GET /worlds/:seed/manifest`
  - WebSocket namespace: `/world/:seed` with events
    - `move-player` (server-authoritative speed clamp, chunk rooms)
    - `player-moved` broadcast at ~12 Hz per chunk
    - `chat-message` (local/world channels)
    - `enter-poi`/`poi-interior` for POI interiors (villages, towns, caves, ruins, towers, lighthouses, dragon grounds, ancient circles)
    - `enter-building`/`building-interior` for nested Town buildings (tavern, blacksmith, alchemist, bank, library, market, guardhouse, temple)
  - Optional Redis adapter for Socket.IO (if `REDIS_URL` is set)
  - Service stubs for Redis and Postgres
- Data: Initial SQL migrations for Players, Dragons, Quests, NPCs, POIInteriors, PlayerInventories, WorldStates, Guilds, Trade
- Local stack: `docker-compose.yml` for API, Redis, Postgres
- Test client: `server/public/index.html` simple canvas + chat to exercise movement/chat
  - Shows chunk-state logs on chunk enter, can trigger POI interaction and demo breeding.
  - Debug tools: Ignore Terrain toggle (dev only) and Regenerate POI button
- Phase 3 (initial):
  - Territory control: claim API and WS territory updates
  - Races: track CRUD and leaderboard endpoints
  - Marketplace: basic listings and buy flow
  - Guild facilities: build and upgrade at owned regions
  - Territory battles: start/complete, contested states, seasonal reset
  - Auctions: create/bid with snipe guard and periodic settlement
  - Tournaments: participants, bracket start, report results
 - Races anti-cheat: min time and telemetry flags
 - POIs (implemented): Village, Town, Dark Cave (Egg Cavern), Ruined Castle, Wizard’s Tower, Lighthouse, Dragon Grounds, Ancient Circle
 - Roads (aesthetic): Deterministic per seed; connect towns and villages; constrained to landmasses; minimal crossings; merge-friendly routing
 - Phase 4 (foundations):
   - Security: helmet, API rate limiting, GDPR delete `DELETE /me`
   - Observability: Prometheus `/metrics`, WS/HTTP metrics, request IDs
   - WS backpressure: move throttle (~20 Hz), capped broadcast payloads
   - Reverse proxy: Nginx at `localhost:8000` forwarding to API
   - Economy: wallets + ledger integrated into market/auctions

## CI / Load Tests
- CI workflow at `.github/workflows/ci.yml` (type-check and lint placeholder).
- Artillery scenario at `loadtests/artillery-move-and-chat.yml` for basic WS load.

## Quick Start

- With Docker Compose:
  - `docker compose up --build`
  - Open `http://localhost:3004` → click Connect to join world `alpha`

- Without Docker (after installing deps):
  - `cd server && npm install`
  - Copy `.env.example` → `.env` and adjust
  - `npm run dev`
  - Open `http://localhost:3004`

## Deployment Status

### Current Configuration
- **API Server**: `http://127.0.0.1:3004` (Direct access)
- **Nginx Proxy**: `http://127.0.0.1:8000` (Recommended for production)
- **PostgreSQL Database**: `127.0.0.1:5400`
- **Redis Cache**: `127.0.0.1:6300`
- **Test Client**: Available at root URL

### Port Assignments
All ports are managed via `portman.py` to avoid conflicts:
- `3004` - Express API Server
- `8000` - Nginx Reverse Proxy
- `5400` - PostgreSQL Database
- `6300` - Redis Cache

## Environment Variables
- `PORT` (default `3004`)
- `JWT_SECRET`, `JWT_REFRESH_SECRET` (required for real auth)
- `REDIS_URL` (default `redis://localhost:6300`)
- `DATABASE_URL` (default `postgres://postgres:postgres@localhost:5400/dragon`)
- `CHUNK_SIZE` (default `64`)
- `MAX_PLAYERS_PER_CHUNK` (default `200`)

## Next Steps (Phase 2 Targets)
- World manifest with deterministic parameters and template hashes (added)
- Chunk-based broadcasting and POI interaction events (added)
- Server-authoritative POI/NPC state stored in Redis with periodic flush to Postgres (added)
- Trade event skeleton for request/accept/confirm/cancel (added; persistence later)
- Trade persistence: Redis-backed state + Postgres status updates (added)
- Guild CRUD endpoints: create, invite, join/leave (added)
- Presence API: `GET /worlds/:seed/online` (added)
- Friends API: `GET /friends`, `POST /friends/:playerId`, `DELETE /friends/:playerId` (added)
- Profiles API: `GET /profiles/:userId`, `PATCH /profiles/me` (added)
- Offline import: `POST /offline/import` to link offline progress (added)
 - Chat: local/world/guild channels; DMs via `direct-message` WS event.

 Completed:
 - Dark Cave POI system with procedural cave generation
 - Egg Cavern special location with guaranteed Dragon Egg collectible
 - Interior coordinate system for POI exploration
 - Cave rendering with collision detection and entity placement
 - Cellular automata cave generation algorithm
 - BFS pathfinding for optimal Dragon Egg placement

 Upcoming:
 - Inventory integration and true trade escrow (item transfer & rollback)
 - Breeding center UI and stricter rule validation
 - Player profiles (stats/cosmetics) and social presence UI
 - Territory battles and seasonal resets
 - Auctions and snipe guard mechanics
 - Tournament brackets and anti-cheat thresholds

## API Endpoints

### Health & Monitoring
- `GET /healthz` - Health check endpoint
- `GET /readyz` - Readiness check endpoint  
- `GET /metrics` - Prometheus metrics

### Authentication
- `POST /auth/refresh` - Refresh JWT tokens

### World Management
- `GET /worlds/:seed/manifest` - Get world generation parameters
- `GET /worlds/:seed/online` - List online players in world

### Player Management
- `GET /players/:userId` - Get player info
- `GET /profiles/:userId` - Get player profile
- `PATCH /profiles/me` - Update own profile
- `POST /offline/import` - Import offline progress

### Social Features
- `GET /friends` - List friends
- `POST /friends/:playerId` - Add friend
- `DELETE /friends/:playerId` - Remove friend

### Guilds
- `GET /guilds` - List all guilds
- `POST /guilds` - Create guild
- `POST /guilds/:id/invite` - Send guild invite
- `POST /guilds/:id/join` - Join guild
- `DELETE /guilds/:id/leave` - Leave guild

### Territory System
- `GET /territory` - List territories
- `POST /territory/claim` - Claim territory
- `GET /territory-battles` - Active battles
- `POST /territory-battles/start` - Start battle
- `GET /territory-queue` - Battle queue status

### Economy
- `GET /market` - Marketplace listings
- `POST /market` - Create listing
- `GET /auctions` - Active auctions
- `POST /auctions` - Create auction
- `POST /auctions/:id/bid` - Place bid

### Competitive
- `GET /races` - List races
- `POST /races` - Create race
- `GET /races/:id/leaderboard` - Race leaderboard
- `GET /tournaments` - List tournaments
- `POST /tournaments/:id/join` - Join tournament

### WebSocket Events

#### Client → Server
- `move-player` - Update player position
- `chat-message` - Send chat message
- `interact-poi` - Interact with POI
- `enter-poi` - Enter POI interior
- `enter-building` - Enter nested building interior (inside a Town)
- `trade-request` - Initiate trade
- `dragon-action` - Dragon actions
- `direct-message` - Send DM

#### Server → Client  
- `welcome` - Initial connection data
- `player-moved` - Player position updates
- `chat-message` - Chat messages
- `poi-interaction` - POI interaction results
- `poi-interior` - POI interior layout and data
- `building-interior` - Nested building interior layout and data (Town buildings)
- `trade-update` - Trade status updates
- `world-event` - World events
- `territory-update` - Territory changes

## Roads and POIs

- Roads are deterministic, aesthetic polylines connecting settlements (villages and towns). They are limited to each landmass (no ocean-spanning roads), with minimal crossings and merge-friendly routing. Exposed in the manifest as `world.roads`.
- Towns are larger settlements with numerous houses and advanced buildings; buildings enforce at least one-tile spacing. Inside a Town, stand at a building door and press Space to enter its interior; press Space inside to exit back to town.
- Lighthouses spawn on prominent headlands; enter from the exterior south door (press Space). The interior guarantees a corridor from the door into the tower; outbuildings are placed away from the entry corridor.
- Dragon Grounds appear at the edge of mountains or deep hills; contain guarded entrances, chambers (and dungeons at higher rarity), a dragon lair, and gold hoards.
- Ancient Circles contain rings of standing stones, an altar, druids, and a portal at higher rarities.

### Rarity

POIs scale with rarity (`common`, `rare`, `epic`, `legendary`) to adjust size, floors/chambers, loot/guards, and special features. Towns place more houses and advanced buildings with higher rarity; towers gain more floors; caves and dragon grounds expand; lighthouses gain floors and boat chance; ancient circles add rings/druids and portals.

## Deployment Instructions

### Prerequisites
- Docker and Docker Compose installed
- Ports 3004, 8000, 5400, 6300 available
- 2GB+ RAM recommended

### Production Deployment

1. Clone the repository:
```bash
git clone <repository-url>
cd multi-dragon
```

2. Configure environment:
```bash
cp .env.example .env
# Edit .env with production values (JWT secrets, etc.)
```

3. Build and start services:
```bash
docker compose up -d --build
```

4. Apply database migrations:
```bash
for file in server/migrations/*.sql; do
  cat "$file" | docker compose exec -T postgres psql -U postgres -d dragon
done
```

5. Verify deployment:
```bash
curl http://127.0.0.1:3004/healthz
# Should return: {"status":"ok"}
```

### Development Setup

1. Install dependencies:
```bash
cd server
npm install
```

2. Run TypeScript build:
```bash
npm run build
```

3. Start development server:
```bash
npm run dev
```

## Troubleshooting

### Common Issues

#### Port Conflicts
- Check port usage: `docker compose ps`
- Free ports using portman: `python3 /root/project/portman.py free <port>`

#### Database Connection Errors
- Verify PostgreSQL is running: `docker compose ps postgres`
- Check connection: `docker compose exec postgres psql -U postgres -d dragon -c "SELECT 1;"`

#### Redis Connection Issues
- Verify Redis is running: `docker compose ps redis`
- Test connection: `docker compose exec redis redis-cli ping`

#### Build Failures
- Clear Docker cache: `docker compose build --no-cache`
- Check TypeScript errors: `cd server && npm run build`

#### Migration Errors
- Check migration order in `server/migrations/`
- Manually apply failed migrations using psql

### Logs

View service logs:
```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f api
docker compose logs -f postgres
docker compose logs -f redis
docker compose logs -f nginx
```

### Performance Monitoring

- Metrics endpoint: `http://127.0.0.1:3004/metrics`
- Monitor active connections, request latency, and database performance
- Use Prometheus/Grafana for visualization

## Dark Cave System

The Dark Cave system provides procedurally generated cave interiors with collectible Dragon Eggs near spawn points.

### Features

- **Procedural Generation**: Caves created using cellular automata algorithms
- **Guaranteed Dragon Eggs**: Special "Egg Cavern" contains collectible Dragon Eggs
- **Creature Population**: Bats and slimes spawn in caves for atmosphere
- **Container System**: Treasure chests placed at cave dead-ends
- **Dual Coordinate Systems**: Grid-based interior movement with pixel-perfect rendering

### Technical Implementation

#### Cave Generation (`server/src/procgen/caveInterior.ts`)
1. **Initial Seed**: 48x36 grid with ~55% floor probability
2. **Cellular Automata**: 4 iterations of neighbor-based smoothing
3. **Connectivity**: Flood-fill ensures all areas accessible from entrance
4. **Entrance**: Center-top positioning with guaranteed corridor
5. **Dragon Egg Placement**: BFS algorithm finds farthest walkable cell

#### Coordinate Systems
- **World Map**: Pixel coordinates (8px per tile) for overworld movement
- **Interiors**: Grid coordinates (1 unit per cell) for precise navigation
- **Rendering**: Grid converted to pixels (16px per cell) for display

#### Client Features
- **Movement**: Separate physics for interior vs overworld
- **Collision**: Layout-based walkability checking
- **Camera**: Direct follow mode in interiors, deadzone in overworld
- **Interaction**: Spacebar to enter/exit POIs and collect items

### File Structure
```
server/src/procgen/
├── caveInterior.ts       # Cave generation algorithm
├── worldGenerator.ts     # POI placement logic  
├── constants.ts          # POIInterior interface
└── rng.ts               # Deterministic RNG

server/public/index.html  # Client rendering & interaction
```

## Architecture Notes

- **Server-authoritative**: All game state validated server-side
- **Chunked world**: Players grouped by geographic chunks for efficient broadcasting
- **Hybrid persistence**: Redis for hot data, PostgreSQL for cold storage
- **Deterministic generation**: Worlds generated from seeds for consistency
- **Rate limiting**: API and WebSocket throttling to prevent abuse
- **Dual coordinate systems**: Pixel coordinates for overworld, grid coordinates for interiors

Refer to `ACTION_PLAN.md` for detailed implementation milestones and `AGENTS.md` for development guidelines.
