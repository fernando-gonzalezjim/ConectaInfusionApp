# Foundation implementation tasks

Status: approved with [the plan](plan.md) on October 1, 2026; implementation and technical verification complete; ready for user review. These tasks implement [SPEC-foundation.md](../SPEC-foundation.md), not later business modules.

See [current verification evidence](foundation-verification.md) and [toolchain](toolchain.md). Checked tasks have local evidence; unchecked tasks include partial implementations or blocked acceptance checks. The root db:migrate command now invokes Flyway after successful live verification. Each task must leave existing behavior working. When a task exceeds roughly five substantive file changes, split it before implementation; mechanical relocation of unchanged files is tracked separately from behavior changes.

## F01 — Resolve and pin tooling

- [x] Confirm actual Node/npm/Docker availability; resolve compatible Tailwind v4, shadcn/ui, Playwright/axe and Flyway versions using official sources. Record versions and prerequisites without installing unrelated tooling.
- Acceptance: exact Flyway tag/digest and dependency versions are recorded; Docker readiness is demonstrated or explicitly blocked; compatibility with existing React/Vite is checked.
- Verify: `node --version`, `npm --version`, `docker version`; inspect package peer constraints and image availability.
- Depends on: none. Files: `tasks/toolchain.md`. Scope: S.

## F02 — Establish the fresh-database Flyway path

- [x] Add pinned one-shot Flyway Compose service, V1 migration and db:validate/db:info wrappers; replace db:migrate execution only after fresh/repeat migration succeeds.
- Acceptance: no implicit baseline or clean; credentials externalized; repeated migrate preserves schema and rows.
- Verify: `npm run db:up`, `npm run db:migrate`, `npm run db:validate`, `npm run db:info` against an empty isolated database.
- Depends on: F01. Files: `compose.yaml`, `database/migrations/V1__initial.sql`, `package.json`, `.env.example`. Scope: M.

### Checkpoint 1 — Tooling and fresh migration

- [x] Real PostgreSQL migration succeeds and reruns safely; existing API checks still pass. Report prerequisite blockers before continuing database tasks.

## F03 — Prove safe legacy adoption

- [x] Create isolated legacy/mismatched fixtures and schema-comparison/adoption instructions; retain legacy history and source as provenance while retiring the old executable runner.
- Acceptance: original rows survive verified baseline at V1 and subsequent migration; drift prevents adoption; normal application databases are never reset or auto-baselined.
- Verify: migration integration tests covering fresh, repeated, tampered, matching-legacy and mismatched states; inspect the schema report and preserved fixture rows.
- Depends on: F02. Files: `apps/api/test/migrations.integration.test.mjs`, `scripts/test-integration.mjs`, `docs/database-migrations.md`, `apps/api/src/migrate.ts`, `apps/api/package.json`. Scope: M. Baseline of any real existing database still requires its own approval.

## F04 — Relocate the current frontend

- [x] Move unchanged `apps/web` sources to `apps/customer-web`; rename the workspace to @conecta/customer-web and update the root dev invocation/lockfile.
- Acceptance: the previous overview still loads at 5173; existing web path is retired; no unrelated UI redesign.
- Verify: `npm run typecheck`, `npm run build`, launch customer dev and verify API proxy.
- Depends on: F01. Files: mechanical frontend directory relocation, its `package.json`, root `package.json`, `package-lock.json`. Scope: M substantive edits; record unchanged renames separately.

## F05 — Add a separate management entry point

- [x] Create the management frontend bootstrap using the existing React/Vite versions and a distinct 5174 development server.
- Acceptance: management has an independent entry point; no imports from customer-web; no operational staff data or fake authorization is introduced.
- Verify: `npm run build -w @conecta/management-web` and a browser smoke at 5174.
- Depends on: F04. Files: management `package.json`, `index.html`, `src/main.tsx`, `tsconfig.json`, `vite.config.ts`. Scope: M. Lockfile regeneration belongs to F06.

### Checkpoint 2 — Migration safety and app boundaries

- [x] Legacy migration tests pass without data loss; each frontend launches independently. Review implementation evidence, not just generated configuration.

## F06 — Wire both apps into the workspace lifecycle

- [x] Update root dev/build orchestration, lockfile, documented paths and allowed development origins.
- Acceptance: one npm run dev starts all three processes; shutdown stops siblings; unknown origins are not added through a wildcard. CORS is explicitly not authorization.
- Verify: `npm ci`, `npm run typecheck`, `npm run build`, `npm run dev`; check both /api proxies and coordinated shutdown.
- Depends on: F05. Files: root `package.json`, `package-lock.json`, `apps/api/src/app.ts`, `apps/api/.env.example`, `README.md`. Scope: M.

## F07 — Define Foundation API types and client

- [x] Add public-settings and stable-error types; add a React-independent API client with configurable base URL, cancellation, and error mapping.
- Acceptance: API client exports resolve from a workspace; transport never contains business calculations or server secrets; non-JSON/error responses are handled without leaking raw internals.
- Verify: focused client tests with success, failure and abort; `npm run typecheck`.
- Depends on: F06. Files: contracts `index.d.ts`, api-client `package.json`, `src/index.ts`, `test/client.test.mjs`, `tsconfig.json`. Scope: M.

## F08 — Persist Foundation settings and audit records

- [x] Add V2 for units, business settings defaults and audit records, plus a typed audit append function using an existing transaction.
- Acceptance: initial MX/MXN/es-MX/16 values; stable studio/cafe codes; append-only correction semantics and allowed audit payloads.
- Verify: `npm run db:migrate`, `npm run db:validate`; PostgreSQL integration tests for defaults, audit append/correction and forbidden secret fields.
- Depends on: F03, F07. Files: `database/migrations/V2__foundation.sql`, foundation `audit.ts`, `types.ts`, `apps/api/test/foundation.integration.test.mjs`. Scope: M.

### Checkpoint 3 — Shared contracts and persistent defaults

- [x] Both apps still build; migrations validate; settings/audit tests run against real PostgreSQL; dependency directions remain clean.

## F09 — Deliver validated settings reads and atomic internal updates

- [x] Implement the settings service and public GET route; keep writes and audit reads internal until identity exists.
- Acceptance: allowlisted response; invalid settings rejected; induced audit failure rolls back the settings update; protected operations have no public endpoint.
- Verify: focused API and real PostgreSQL tests including outage, validation, rollback, response privacy and rejected public writes.
- Depends on: F08. Files: foundation `settings.ts`, `routes.ts`, `apps/api/src/app.ts`, `apps/api/test/foundation.integration.test.mjs`, `apps/api/test/database-unavailable.test.mjs`. Scope: M.

## F10 — Establish shared brand components

- [x] Set up @conecta/ui with the pinned Tailwind/shadcn source configuration, approved CSS variables, a button and labeled input.
- Acceptance: explicit package exports and React peer dependencies; dark readable controls with pastel accents; no app/server imports.
- Verify: build/type checks; inspect generated component provenance and configuration against official docs.
- Depends on: F07. Files: UI `package.json`, `components.json`, `src/styles.css`, `src/button.tsx`, `src/input.tsx`. Scope: M; additional primitives receive focused follow-up tasks rather than bulk generation.

## F11 — Render shared UI in both apps

- [x] Configure both Vite builds to include shared Tailwind sources; consume shared styles and primitives in the two shells.
- Acceptance: same components render correctly at both origins; no duplicate React errors; customer/staff navigation remains distinct.
- Verify: `npm run build`; browser smoke checks for both origins, including computed colors and missing CSS.
- Depends on: F10. Files: both `vite.config.ts` files, both `src/main.tsx` files, `package-lock.json`. Scope: M; dependency manifest additions are completed in F10/F06 or split as needed.

### Checkpoint 4 — Actual brand rendering

- [x] Public settings endpoint works against PostgreSQL; brand components render in both app builds; no private routes are exposed.

## F12 — Implement shared language and formatting behavior

- [x] Add @conecta/i18n with Spanish/English messages, browser-persisted locale, document language and money/business-time formatting.
- Acceptance: es-MX fallback for absent/invalid storage; unavailable browser storage does not crash the UI; changing locale does not convert monetary values.
- Verify: focused tests for 15000 MXN minor units, timezone conversion and persistence fallback; type checks.
- Depends on: F07. Files: i18n `package.json`, `src/messages.ts`, `src/index.tsx`, `test/i18n.test.mjs`, `tsconfig.json`. Scope: M.

## F13 — Build the customer settings-to-screen slice

- [x] Consume real public settings, shared client, UI and locale provider in the customer shell; show truthful loading/empty/error/retry behavior.
- Acceptance: language switch preserves location and entered values; business display values come from the API; failed fetch does not reset form state. No finished public homepage or booking workflow is claimed.
- Verify: customer browser flow with success/outage/retry and both languages; build customer workspace.
- Depends on: F09, F11, F12. Files: customer `package.json`, `src/main.tsx`, `src/App.tsx`, `src/styles.css`, `package-lock.json`. Scope: M.

## F14 — Build the management settings-to-screen slice

- [x] Consume the same contracts, language and shared UI in the management shell without exposing financial records or administrative actions.
- Acceptance: independent Spanish/English preference, meaningful loading/error/retry, no write controls pretending authorization exists.
- Verify: management browser flow and independent build; inspect the absence of privileged API routes.
- Depends on: F13. Files: management `package.json`, `src/main.tsx`, `src/App.tsx`, `package-lock.json`. Scope: M.

### Checkpoint 5 — Both bilingual vertical slices

- [x] Both apps display real settings; each persists language and handles API failure; no business rules have changed.

## F15 — Add reusable dialog and feedback states

- [x] Add shared dialog, alert and field-error primitives for the Foundation shells/component test fixture.
- Acceptance: focus enters and returns correctly; errors are associated with fields; keyboard actions and Spanish/English text work. No new business forms.
- Verify: focused browser fixture checks with keyboard and translated long labels.
- Depends on: F11, F12. Files: UI `src/dialog.tsx`, `src/alert.tsx`, `src/field-error.tsx`, `package.json`, `package-lock.json`. Scope: M.

## F16 — Establish executable verification commands

- [x] Wire unit, isolated integration and Playwright/axe commands; configure real API plus two web servers and prevent tests from targeting the application database.
- Acceptance: missing Docker/database yields a clear failed integration run; test reports are ignored; browser projects target the two distinct origins.
- Verify: `npm test`, `npm run test:integration`, `npx playwright install chromium`, `npm run test:e2e -- --project=chromium` after F17 adds scenarios.
- Depends on: F14, F15. Files: root `package.json`, `package-lock.json`, `playwright.config.ts`, `scripts/test-integration.mjs`, `.gitignore`. Scope: M.

## F17 — Verify responsive and accessible behavior

- [x] Add browser scenarios for both shells and the shared component fixture, with locale, unsaved input, network failure/retry, focus and viewport coverage.
- Acceptance: no page overflow at 360/768/1440; money/time remain correct; no serious automated accessibility findings; manual keyboard and color-pair review recorded. Automated checks alone do not certify all WCAG requirements.
- Verify: `npm run test:e2e -- --project=chromium`; manual focus/contrast inspection at both origins.
- Depends on: F16. Files: `tests/e2e/foundation.spec.ts`, `tests/e2e/components.spec.ts`, test-only fixture, `tasks/foundation-verification.md`. Scope: M.

### Checkpoint 6 — Acceptance evidence

- [x] Migration, atomicity, privacy, both builds and browser checks pass. Track role-based access evidence as pending Identity, never as a passed mock authorization check.

## F18 — Handoff and setup documentation

- [x] Update setup and architecture docs with actual commands, ports, pinned tooling and known limits; map each Foundation acceptance criterion to evidence.
- Acceptance: a fresh checkout can follow the documented sequence; public-home/identity work is clearly distinguished from Foundation shells; no automatic PDF regeneration.
- Verify: `npm ci`, `npm run typecheck`, `npm run build`, `npm test`, `npm run test:integration`, `npm run test:e2e -- --project=chromium`; review local documentation links. Reuse unchanged passing evidence rather than rerunning without cause.
- Depends on: F17. Files: `README.md`, `docs/architecture.md`, `docs/database-migrations.md`, `tasks/foundation-verification.md`, this checklist. Scope: M.

### Final checkpoint — Human review

- [ ] Present runnable Foundation, verification evidence, remaining identity/design dependencies and any environment limitations. Do not mark blocked checks passed or begin the next module without its specification.
