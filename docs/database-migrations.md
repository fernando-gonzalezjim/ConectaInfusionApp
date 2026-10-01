# Database migration transition

Status: verified with Docker Desktop 4.93.0, PostgreSQL 17.11 and Flyway 13.9.0 on October 1, 2026. All adoption and failure tests used disposable databases. No application database was migrated, baselined or reset by this work.

## Fresh database

Install/start Docker Desktop with Linux containers and install Chromium (`npx playwright install chromium`), then run `npm run test:integration`. This uses a separate Compose project with PostgreSQL on localhost:55432 and temporary storage. It never reads the application DATABASE_URL. Tests create disposable databases and cover fresh/repeated migrations, checksum rejection, legacy schema comparison/baseline, preserved rows, settings/audit atomicity and corrections. It then launches the real API and both frontends for two database-backed browser checks. Cleanup removes only the test project's containers and temporary data. Ports 55432, 3001, 5173 and 5174 must be free.

An empty local application database can use:

```powershell
npm run db:up
npm run db:migrate
npm run db:validate
npm run db:info
```

Compose Flyway targets the Compose database, not apps/api/.env. Match root .env POSTGRES_* values to the API DATABASE_URL. Hosted migrations require a separately reviewed connection setup.

`db:migrate` invokes Flyway; `db:flyway:migrate` is a compatibility alias. The old executable and API-workspace migration command were removed after live migration checks passed. V1 copies the original SQL unchanged; V2 adds Foundation settings, units and audit records. Preserve original SQL and legacy schema_migrations rows as provenance, not a second migration authority.

## Existing database adoption

1. Obtain approval for that specific database. Back up and verify restoration.
2. Inspect schema and legacy schema_migrations history; preserve history as provenance.
3. Create a separate V1 reference database. Use the read-only assertLegacySchemaMatches helper in scripts/compare-legacy-schema.mjs as demonstrated by the integration test. It compares relations, columns, defaults, constraints, indexes and triggers. Also review schema-only exports, functions, grants, extensions and objects outside public: the helper is not a complete database-equivalence or security audit.
4. Stop on differences. Specify a forward migration; never baseline or repair to hide drift.
5. After a match and approval, explicitly baseline at version 1 on the intended Flyway connection, then migrate, validate and info. Baseline records history; it neither checks schema nor executes V1.
6. Verify preserved rows and real API/browser behavior; retain backup and comparison evidence.

Auto-baseline and clean are disabled. Applied migrations are immutable; changes get new versions. A real PostgreSQL failure test creates a conflicting legacy table before V2: Flyway fails, rolls back V2's earlier table creation, and preserves V1 history. Inspect failed migration history/database state before retrying; do not delete data. This verifies the DDL currently used, not arbitrary future nontransactional SQL.
