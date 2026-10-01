# Database migration transition

Status: configured, awaiting live PostgreSQL/Flyway verification. Docker was unavailable on October 1, 2026. Docker Desktop installation was canceled at the administrator prompt. No application database was migrated, baselined or reset by this work.

## Fresh database

Install/start Docker Desktop with Linux containers and install Chromium (`npx playwright install chromium`), then run `npm run test:integration`. This uses a separate Compose project with PostgreSQL on localhost:55432 and temporary storage. It never reads the application DATABASE_URL. Tests create disposable databases and cover fresh/repeated migrations, checksum rejection, legacy schema comparison/baseline, preserved rows, settings/audit atomicity and corrections. It then launches the real API and both frontends for two database-backed browser checks. Cleanup removes only the test project's containers and temporary data. Ports 55432, 3001, 5173 and 5174 must be free.

After these checks pass, an empty local application database can use:

```powershell
npm run db:up
npm run db:flyway:migrate
npm run db:validate
npm run db:info
```

Compose Flyway targets the Compose database, not apps/api/.env. Match root .env POSTGRES_* values to the API DATABASE_URL. Hosted migrations require a separately reviewed connection setup.

`db:migrate` still invokes the old initial-schema runner. The approved plan requires switching it to Flyway and retiring the old executable only after live migration checks pass. **Never run the old runner on a Flyway-managed database.** V1 copies the original SQL unchanged; V2 adds Foundation settings, units and audit records.

## Existing database adoption

1. Obtain approval for that specific database. Back up and verify restoration.
2. Inspect schema and legacy schema_migrations history; preserve history as provenance.
3. Create a separate V1 reference database. Use the read-only assertLegacySchemaMatches helper in scripts/compare-legacy-schema.mjs as demonstrated by the integration test. It compares relations, columns, defaults, constraints, indexes and triggers. Also review schema-only exports, functions, grants, extensions and objects outside public: the helper is not a complete database-equivalence or security audit.
4. Stop on differences. Specify a forward migration; never baseline or repair to hide drift.
5. After a match and approval, explicitly baseline at version 1 on the intended Flyway connection, then migrate, validate and info. Baseline records history; it neither checks schema nor executes V1.
6. Verify preserved rows and real API/browser behavior; retain backup and comparison evidence.

Auto-baseline and clean are disabled. Applied migrations are immutable; changes get new versions. PostgreSQL DDL here is intended to run transactionally under Flyway, but live rollback evidence is pending. Inspect failed migration history/database state before retrying; do not delete data.
