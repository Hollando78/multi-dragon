# Multiplayer Dragon Isle — Actionable Implementation Plan

## Guiding Principles
- Server-authoritative dynamic state; client-generated static world.
- Deterministic seeds per world; chunked networking and persistence.
- Ship iteratively: multiplayer foundation → core systems → advanced features → polish/scale.

## Milestones
- Phase 1 (Weeks 1–4): Infra + baseline realtime
- Phase 2 (Weeks 5–12): Core multiplayer gameplay + social
- Phase 3 (Weeks 13–20): Territory, competition, economy v2
- Phase 4 (Weeks 21–24): Perf, security, launch prep

## Phase 1: Infrastructure & Baseline Realtime
- Repos & CI/CD
  - Create mono/workspace or two-repo layout; set up CI (lint, test, build).
  - Dockerize services; add docker-compose for local stack (Postgres, Redis, Nginx).
  - Add environments: dev, staging, prod configs with secrets via .env or vault.
- Backend skeleton
  - Scaffold Node.js/TypeScript API (Express), WebSocket server (Socket.IO) with Redis adapter.
  - Add JWT dual-token auth; sessions in Redis; middleware for world/room auth.
  - Health endpoints /healthz, /readyz; structured logging; request ID propagation.
- Database & migrations
  - Create migrations for extended Player and new tables: Dragons, Quests, NPCs, POIInteriors, PlayerInventories, WorldStates, Guilds, Trade.
  - Add indices on worldSeed, playerId, guildId, status.
  - Implement DB access layer with transactions and row-level validation.
- Realtime baseline
  - Define Socket.IO namespaces: /world/:seed; rooms per chunkId.
  - Implement move-player, player-moved with server throttling (10–20 Hz) and reconciliation.
  - Implement chat-message with channels: local, world, guild, party.
- Frontend wiring
  - Integrate Socket.IO client; connection and reconnection flows with exponential backoff.
  - Add MultiplayerGameScene in Phaser; render remote player avatars with nameplates.
  - Set up state store (Zustand) with serverState and localState; optimistic movement with server correction.
- Acceptance
  - 20+ players in one world see smooth movement and chat.
  - Load test shows <100 ms move round-trip p50, no data loss.

## Phase 2: Core Multiplayer Gameplay
- Shared world generation
  - Expose /worlds/:seed/manifest to fix deterministic params: biomes, POIs, NPC templates, chunk size.
  - Client generates static terrain and POIs from seed; server verifies integrity via hashes on POI/NPC templates.
  - Implement chunk subscription: enter/leave chunk streams when crossing chunk boundaries.
- Dynamic POI/NPC state
  - Server-authoritative POI/NPC state store in Redis with periodic flush to Postgres.
  - Events: interact-poi → poi-interaction; conflict resolution on simultaneous interactions.
- Dragon system (multiplayer v1)
  - Define dragon-action server handlers with validation (cooldowns, ownership).
  - Implement P2P dragon trading: trade-request, escrow table, two-phase commit; audit log.
  - Add breeding centers as POIs; cross-player breeding with fees and cooldowns; server-side validation of offspring generation.
- Social foundations
  - Guild CRUD: create, invite, join/leave; guild chat and roster cache.
  - Player profiles: basic stats, cosmetics; persistence and privacy settings.
  - Friends list and direct messaging; presence in Redis.
- Offline/online bridge (initial)
  - Add offline profile linking; create a migration job to upload offline inventory/dragons.
  - Conflict policy: server-wins for dynamic, newer timestamp for inventory deltas, manual review queue for clashes.
- Acceptance
  - Players can trade and breed dragons safely; guilds operate; POIs/NPCs have shared state across clients.

## Phase 3: Advanced Features
- Territory control
  - Region/claim model on world grid; claim costs, upkeep; claimTerritory, getTerritoryBenefits.
  - Territory visibility (map overlays), contested states, decay; seasonal reset hooks.
  - Defend/attack flows: queued battle instances or timed control events; matchmaker per region.
- Competitive events
  - Dragon races: track definitions, checkpoints, anti-cheat (telemetry thresholds).
  - Tournaments: brackets, ELO-like seeding; reporting and rewards.
  - Leaderboards with time-window partitions; anti-abuse duplicate detection.
- Economy v2 (market + auction)
  - Marketplace listings with fees/taxes; search filters; pagination and secondary indices.
  - Auctions: minimum increments, snipe guard, extension windows; escrow on highest bid; failure recovery.
  - Dynamic pricing inputs: transaction volumes, velocity; monitoring dashboards for inflation/hoarding.
- Guild facilities
  - Facilities at claimed territory: breeding_center, market_stall, training_ground; construction queue and upgrade rules.
  - Buff calculation and radius; persistence; UI integration.
- Acceptance
  - Territory wars run seasonally; market and auction volume stable; no dupes; events complete with rewards distributed.

## Phase 4: Performance, Security, Launch
- Performance & scaling
  - World chunk tuning: entity cap per chunk; backpressure for crowded chunks; soft instancing for hotspots.
  - Multi-world server assignment: shard by worldSeed; dynamic scaling; session stickiness.
  - Asset CDN; sprite and tile atlas optimization; mobile FPS profiling and culling.
- Security & anti-cheat
  - Strict server validation for all economic and dragon actions; signature on client packets if needed.
  - Rate limits per event; abuse detection (anomaly scores on trades, speed, teleport).
  - Permissions for sharing sharingPermissions (private/guild/public); GDPR deletion flow.
- Observability
  - Metrics: connect count, event rates, dropped frames, server ticks, Redis/DB latencies; SLO alerts.
  - Distributed tracing for interact-poi, trade, breeding flows.
  - Audit logs for economy and admin actions; redaction and retention policies.
- Testing & QA
  - Unit tests for validators and generators; property tests for deterministic generation.
  - Integration tests for websocket flows (join → move → interact → update).
  - Synthetic load: 1k virtual users per seed; chaos tests (Redis/DB failover).
- Launch plan
  - Feature flags per system; canary worlds; staged rollouts.
  - Closed alpha (guild + trading), open beta (territory + events), 1.0.
  - Community tools: moderation, reports, mute/ban; CS dashboards.
- Acceptance
  - Meets performance SLOs at target concurrency; audited economy; green security and stability checklists.

## Detailed Implementation Tasks (Ticket-Ready)
- BE-01: Scaffold API Express app, Socket.IO, Redis adapter; /healthz, /readyz.
- BE-02: JWT auth; refresh token rotation; Redis session store.
- BE-03: DB migrations (Players+, Dragons, Quests, NPCs, POIInteriors, PlayerInventories, WorldStates, Guilds, Trade).
- BE-04: Define WS namespaces /world/:seed, rooms by chunkId; join/leave on movement.
- BE-05: Implement move-player validation (speed caps, collisions), throttling, broadcast player-moved.
- FE-01: Integrate Socket.IO client; reconnection UI; connection status in store.
- FE-02: Create MultiplayerGameScene; render remote players; interpolate with dead reckoning.
- FE-03: Zustand store with serverState and localState; optimistic movement + reconciliation.
- BE-06: World manifest endpoint; seed lock; client hash verification for POIs/NPC templates.
- BE-07: POI/NPC dynamic state in Redis; periodic Postgres flush workers.
- BE-08: Trade flow: endpoints, WS events, escrow table, two-party confirmation, rollback on disconnect.
- BE-09: Breeding center: rules, cooldowns, offspring generation deterministic on parents+seed; audit.
- BE-10: Guild CRUD; invites; guild chat; role model (leader/officer/member).
- FE-04: Trade UI, breed UI; guild UI (roster, invites, chat).
- BE-11: Territory schema; claim/decay; benefits; seasonal reset job.
- BE-12: Race/tournament services; matchmaker; results persistence; anti-cheat thresholds.
- BE-13: Marketplace + auctions; search; snipe-guard; recovery semantics.
- OPS-01: Nginx, TLS, sticky sessions; autoscaling policies; dashboards (Grafana) and alerts.
- SEC-01: WS rate limits per IP/user; server-side validation for all economy ops; anomaly detection job.
- QA-01: Integration tests for move-player, interact-poi, trade, breed; load test scripts.

## Data Model Notes
- Add composite indices: Trade(status, createdAt), Dragons(ownerId, worldSeed), POIInteriors(worldSeed, poiId).
- Version all dynamic states with version/updatedAt for conflict handling and idempotency.
- Store world/chunk snapshot hashes for verification and client-side caching.

## Networking & Sync Details
- Movement: client → server at 20 Hz; server authoritative; broadcast at 10–15 Hz with interpolation; drop updates if queue backlog > N.
- State sync tiers:
  - Immediate: positions, chat, POI locks.
  - Near-real-time (1–5s): inventory, quest state.
  - Periodic (30–60s): dragon stats, bond, XP.
  - Batch (5–15m): market analytics, leaderboards.

## Acceptance & Demos Per Phase
- Phase 1 demo: 10–20 players moving/chatting, chunk room transitions, responsive reconnection.
- Phase 2 demo: Shared POI interaction, trading, breeding across players; guild chat.
- Phase 3 demo: Territory claims and races functioning with results and rewards; market live with search and escrow.
- Phase 4 demo: 1k CCU load test on staging with SLOs; security checks; canary world rollout.
