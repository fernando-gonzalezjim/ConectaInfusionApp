# Implementation plan: Foundation

Status: plan and tasks approved by the user on October 1, 2026; implementation and technical verification complete; see foundation-verification.md. This document preserves the approved plan.
Module: `foundation`. Date: October 1, 2026.
Source: [approved specification](../SPEC-foundation.md), [visual direction](../docs/design/visual-direction.md), [capability map](../CAPABILITY-MAP.md).
Task list: [tasks/todo.md](todo.md). No existing plan or task list was present. GitHub issue #1 remains deferred product work, not this plan's task tracker.

## Deliverable

Two independently runnable React frontends in the npm workspace, consuming shared branded UI, localization, API types/client, and a public settings endpoint. The backend gains validated settings and transactional audit infrastructure. Docker PostgreSQL and Flyway provide a verified migration path for both empty and previously initialized databases.

This is Foundation only: no authentication implementation, customer bookings, credits, payroll, café sales, or finished marketing homepage. Existing read-only overview functionality must remain working during the restructure. Foundation shells demonstrate actual settings and reusable states; they must not present unimplemented operational actions as working.

## Decisions and dependency graph

| Component | Decision |
| --- | --- |
| Applications | `@conecta/customer-web` on 5173, `@conecta/management-web` on 5174, existing `@conecta/api` on 3001; strict development ports |
| Source migration | Move existing apps/web to customer-web first; add management-web separately; no third frontend remains |
| Shared packages | `@conecta/contracts` remains type-only; `@conecta/api-client` has no React dependency; `@conecta/i18n` provides common translations/formatting and locale integration; `@conecta/ui` owns React components and brand styles |
| Package consumption | Explicit exports and TypeScript configuration; React as a peer of UI/provider packages; Vite compiles shared frontend source. API imports contracts as types only. No cross-app imports |
| Styling | Tailwind v4 Vite integration and shadcn/ui source components, adapted to npm workspaces; do not introduce a new package manager or replace the repo with a generated template |
| Browser checks | Playwright for both frontends, axe integration for automated accessibility checks plus manual keyboard/contrast review |
| Server checks | Existing Node test runner; real PostgreSQL integration tests with an isolated test database |
| Locale | es-MX/en, browser persistence per origin, business timezone America/Mexico_City; no cross-origin preference synchronization until identity exists |
| Migrations | Official Flyway Docker runtime invoked as a one-shot Compose service; pin tested exact image tag/digest before committing tooling; never floating latest |

Dependency outline:

```text
toolchain verification → Flyway fresh path → legacy adoption → settings/audit schema
web relocation → management shell → shared contracts/client
settings/audit schema → audited internal settings service → public settings endpoint
shared UI + localization + client + endpoint → bilingual settings screens in both apps
all slices → integration/browser verification → handoff
```

API-client depends on contracts. UI does not fetch settings or import app routes. Locale is supplied by each app; shared components receive translated text. The server never imports UI or browser modules. Authentication and actual role tests remain explicitly tracked dependencies of identity.

## Settings and audit slice

Add stable studio/cafe unit records, a single business-settings record, and append-only audit records through a new migration after the baseline. Proposed internal configuration includes name, MX/MXN, business timezone, locale list/default, and default capacity 16. Validate supported values and positive integer capacity. Until broader operational support is specified, reject country/currency changes outside the supported initial configuration rather than promise foreign payment support.

Expose only `GET /api/v1/settings/public`, with an allowlisted response containing display name, display locale/timezone/currency, supported locales and public unit labels. Capacity stays internal until a consumer requires it. Public settings failures return a stable error code, not credentials or database diagnostics.

The internal settings mutation accepts trusted actor context and a transaction; its audit append shares that transaction. Use parameterized SQL, explicit field allowlists, before/after values limited to settings, and a correlation ID. Audit corrections append references to prior events. No audit update/delete API and no scheduled retention job are introduced. Actor references remain opaque until identity owns users. No settings-write or audit-read HTTP route ships before authorization exists.

This slice proves atomicity through an induced audit failure: neither the settings mutation nor partial history persists. It does not implement a financial ledger.

## Flyway transition

1. Preserve `database/001_initial.sql` as a legacy reference; copy its schema unchanged into `database/migrations/V1__initial.sql`. Flyway owns new migration history; later changes use V2 and higher.
2. Fresh database: explicit Flyway migrate, followed by validate and info. Repeat migrate to establish that it is a no-op. Keep `baselineOnMigrate` disabled and `clean` disabled.
3. Existing database: first take a backup and inspect tables, columns, types, defaults, constraints, indexes, and legacy history. Compare with a database created from V1, not merely a list of table names. Unknown drift stops adoption.
4. A fixture initialized with the old SQL/runner must preserve sample rows through verified adoption. The legacy history table may remain as archived provenance; do not drop it or run the legacy runner again.
5. Baseline at version 1 only after a schema-match report and explicit approval for the specific existing database. Do not baseline on normal app startup. Migrate subsequent versions after baseline.
6. Tests use isolated empty/legacy/mismatched fixtures. Never run reset/clean against the developer's configured application database. Keep database credentials in ignored environment configuration; the container JDBC URL uses service `db`, while host Node uses localhost.

All migration SQL initially stays transactional (ordinary PostgreSQL DDL). Nontransactional operations require a separately reviewed migration strategy. Application processes do not auto-run migrations.

## Commands to establish

Existing commands remain valid until their replacement task is verified. These target commands are proposed contracts, not currently installed functionality:

| Command | Target behavior |
| --- | --- |
| `npm ci` | Reproduce the committed workspace dependencies |
| `npm run db:up` | Start Docker PostgreSQL and wait for readiness |
| `npm run db:migrate` | Run Flyway migrate against the configured development database |
| `npm run db:validate` | Flyway validate |
| `npm run db:info` | Flyway migration status |
| `npm run dev` | Start API and both frontends with coordinated shutdown |
| `npm run dev -w @conecta/customer-web` | Customer development server on 5173 |
| `npm run dev -w @conecta/management-web` | Management development server on 5174 |
| `npm run typecheck` | Check all apps and shared packages |
| `npm run build` | Build the API and both frontend distributions |
| `npm test` | Unit/API tests that do not need a real database |
| `npm run test:integration` | Real PostgreSQL migration/settings/audit tests; fail clearly if unavailable |
| `npx playwright install chromium` | Install the selected browser for verification |
| `npm run test:e2e -- --project=chromium` | Both frontends, language persistence, responsive UI, error states, keyboard checks |

Compose Flyway service commands underneath the npm wrappers: `docker compose run --rm flyway migrate`, `validate`, and `info`. A separate documented baseline procedure is intentionally not part of routine dev scripts. Tests require explicit test-only database configuration and must reject the normal application database target.

## Verification and traceability

| Specification criteria | Evidence |
| --- | --- |
| A01 | Migration defaults, real settings read, rejected invalid capacity |
| A02–A03 | Both-app browser language tests; formatting tests for MXN and timezone |
| A04–A05 | PostgreSQL commit/rollback and correction-history tests; secret-field exclusion |
| A06 | Public response allowlist and absence of administrative routes; authenticated role enforcement completed in identity |
| A07 | Browser checks at 360/768/1440, keyboard/dialog focus, axe checks and actual contrast review |
| A08–A09 | Fresh/repeat/tampered/legacy/drift migration fixtures, row preservation |
| A10 | Independent builds, runtime smoke, package import boundaries and frontend artifact review |
| A11 | Both-app locale/shared-component checks now; customer-versus-staff authorization tests explicitly deferred to identity |

Do not mark the future identity evidence complete in this module. No numeric coverage threshold has been agreed. Existing database-outage tests remain useful but are not a substitute for successful PostgreSQL integration.

## Risks and unresolved details

- Docker was not found on PATH during planning. Installing/running a local Docker environment or providing a suitable test PostgreSQL environment is a prerequisite for database acceptance, not a reason to skip it.
- Resolve compatible exact Tailwind/shadcn/Playwright versions and the Flyway image in the first tooling task, record them in lockfiles/configuration, and test actual compatibility. Existing versions are not upgraded casually.
- Shared Tailwind source discovery and duplicate React instances can break monorepos: verify actual rendered components in both apps, not only TypeScript output.
- Parent UI state must survive language changes and retries; do not key/remount full pages by locale.
- Final fonts, semantic status colors and original logo asset remain design follow-ups. Use the approved working palette and local system font for Foundation; do not fabricate a logo or choose a new brand identity.
- Audit retention and production database privileges need an explicit later policy; do not add deletion behavior now.
- How settings may change after financial transactions exist remains open; the internal foundation contract must not rewrite history or expose an unrestricted admin UI.
- Production domains, session strategy, cross-origin login, and deployment are outside this plan.
- English/Spanish business rules remain synchronized if a rule changes. The Spanish PDF is an on-demand snapshot and must not be regenerated here.

## Documentation sources for implementation

- [Tailwind Vite installation](https://tailwindcss.com/docs/installation/using-vite): Vite integration.
- [shadcn/ui monorepos](https://ui.shadcn.com/docs/monorepo) and [Tailwind v4](https://ui.shadcn.com/docs/tailwind-v4): shared component configuration and supported stack direction.
- [Flyway Docker](https://documentation.red-gate.com/fd/flyway-docker-321585710.html) and [baseline](https://documentation.red-gate.com/flyway/reference/commands/baseline): container runtime and explicit adoption mechanics.
- [Playwright web servers](https://playwright.dev/docs/test-webserver): launch multiple application servers for browser verification.

## Review gate

Review this plan and the task list together before implementation. Checkpoints after every two or three tasks report evidence and unresolved blockers. This request creates planning documents only; it does not install tools, migrate databases, modify application code, commit, or deploy.
