# Repository Guidelines

## Project Structure & Module Organization
- `server/src/` — TypeScript Express + Socket.IO server (routes in `routes/`, services in `services/`, WS in `ws/`).
- `server/public/` — minimal browser client for local testing.
- `server/migrations/` — SQL schema migrations (apply in order).
- `nginx/` — reverse proxy config (`nginx.conf`).
- `loadtests/` — Artillery scenarios for basic WS load.
- Root: `docker-compose.yml`, `.env.example`, GitHub Actions in `.github/workflows/`.

## Build, Test, and Development Commands
- Local dev (API): `cd server && npm install && npm run dev` (watches `src/`).
- Build: `cd server && npm run build` → outputs to `dist/`.
- Run built server: `cd server && npm start`.
- Compose stack: `docker compose up --build` (API+Redis+Postgres+Nginx).
- Metrics: `GET /metrics` (Prometheus), Health: `GET /healthz`.

## Coding Style & Naming Conventions
- TypeScript strict mode; prefer explicit types for public functions.
- 2‑space indentation, single quotes in TS/JS, trailing commas where valid.
- Filenames: kebab-case for routes/services (e.g., `territory-battles.ts`), PascalCase for types.
- Logging via `pino` (`server/src/logger.ts`). Avoid one‑letter identifiers.

## Testing Guidelines
- Framework: add Jest for unit tests; place in `server/src/**/__tests__/`.
- Name tests `*.test.ts`; focus on pure services (validators, generators) first.
- For WS/HTTP integration, prefer lightweight Artillery scenarios in `loadtests/`.

## Commit & Pull Request Guidelines
- Commits: present‑tense, scoped messages (e.g., `feat(trade): add escrow settlement`).
- PRs: include summary, linked issue, testing notes, and any API changes. Add screenshots or logs when UI/metrics change.

## Security & Configuration Tips
- Required envs: `JWT_SECRET`, `JWT_REFRESH_SECRET`, `DATABASE_URL`, `REDIS_URL` (see `.env.example`).
- Rate limits and `helmet` are enabled; keep secrets out of logs. Use `/features` for canaries/flags.

## Architecture Overview
- Server‑authoritative dynamic state (Redis + Postgres) with client‑generated static world.
- Namespaces: `/world/:seed`; per‑chunk broadcasting with throttled movement.
- Periodic workers: state flush, seasons, auctions, territory matchmaking/upkeep.

