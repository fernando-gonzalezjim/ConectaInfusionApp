# Conecta Infusion

React + Vite web app, Node.js + Express API, TypeScript, and PostgreSQL.

## Run locally

Requires Node.js 24 and PostgreSQL 17+ (local, Docker Desktop, or hosted).

```powershell
npm install
# Only if apps/api/.env does not already exist:
Copy-Item apps/api/.env.example apps/api/.env
# With Docker Desktop installed and running:
npm run db:up
npm run db:migrate
npm run dev
```

For an existing or hosted database, set DATABASE_URL in apps/api/.env and skip db:up. Follow the provider's TLS configuration; certificate verification is not disabled. The included credentials are only for local development.

Open http://localhost:5173. The dashboard reads upcoming classes and active products from PostgreSQL. A new database starts empty. Authentication, booking, sales, and editing screens are future work. The API currently exposes read-only studio data.

## Structure

- apps/web: React frontend, with /api proxied to port 3001 during development.
- apps/api/src/db.ts: PostgreSQL connection pool and query timeouts.
- apps/api/src/migrate.ts: transactional initial migration runner.
- apps/api/src/modules/studio: PostgreSQL queries.
- packages/contracts: shared API types for web and future mobile clients.
- database/001_initial.sql: members, instructors, classes, bookings, products, sales.
- compose.yaml: local PostgreSQL with a persistent volume.

## Verification and operations

```powershell
npm run typecheck
npm run build
npm test
npm start
```

npm start runs the compiled backend. Deploy apps/web/dist through a static host with /api routed to the backend. Changing the API port also requires updating the Vite proxy.

- /api/v1/health: process liveness.
- /api/v1/ready: database and initial schema readiness; 503 when unavailable.
- /api/v1/studio/overview: up to 20 upcoming classes and 100 active products; 503 rather than demo data on database errors.

Run migrations explicitly with npm run db:migrate. The runner records the initial migration and uses a transaction and advisory lock to prevent concurrent initialization. Compose only creates the database. If you previously applied the SQL manually, compare and baseline that schema before using the runner, or use a new empty development database. Do not delete existing data to resolve migration errors.

npm test verifies database-unavailable behavior without needing PostgreSQL. Live integration still requires a running PostgreSQL instance: migrate twice, verify readiness, and load the dashboard. PostgreSQL and Docker were unavailable during setup, so live verification remains outstanding.

See the [confirmed product intent](docs/intent/conecta-infusion.md) and [agreed business rules](docs/requirements/agreed-business-rules.md) for the first-release requirements. These describe intended behavior, not completed features. The [architecture notes](docs/architecture.md) describe the initial scaffold.

Project MCP connections for Codex are configured in `.codex/config.toml`. See [MCP setup](docs/mcp-setup.md) for OpenAI Docs and GitHub authentication.
