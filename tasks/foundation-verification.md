# Foundation verification

October 1, 2026. Foundation implementation and technical verification are complete; ready for user review. The Docker blocker is resolved. This is not a production launch or an Identity/booking implementation.

## Executed evidence

| Check | Result |
| --- | --- |
| npm run typecheck | All six typed workspaces passed |
| npm run build | API and both frontend production builds passed |
| npm test | 10 Node tests passed |
| npm run test:integration | 3 PostgreSQL scenarios and 2 live Chromium scenarios passed |
| npm run test:e2e -- --project=chromium | 12 UI/keyboard/accessibility scenarios passed |
| Root database commands | db:up, db:migrate twice, db:validate and db:info passed on the isolated Compose project |
| Root development lifecycle | npm run dev started API and both frontends; all three ports closed after browser teardown |
| Clean installation | Previous unchanged-lockfile npm ci evidence retained; no dependency versions changed in this continuation |

## Database and API evidence

Verified with Docker Desktop 4.93.0 / Engine 29.8.1, PostgreSQL 17.11 and Flyway 13.9.0. Image digests are recorded in [toolchain.md](toolchain.md).

- Fresh V1/V2 migration succeeds. Repeating migrate is a no-op; validate and info succeed. Deliberate checksum mismatch is rejected.
- A legacy fixture requires explicit baseline. Schema comparison rejects an unexpected column; matching adoption preserves the customer row and original schema_migrations entry.
- A conflicting preexisting table causes V2 to fail. Earlier DDL from V2 rolls back while V1 history remains intact.
- Persisted defaults are MX/MXN, America/Mexico_City, es-MX and capacity 16; both business units are returned.
- Invalid capacity and an extra secret field are rejected without audit persistence. Stored audit change fields match the settings allowlist.
- A settings change and its audit record commit together. An induced audit failure rolls the setting back. Correction records reference the original, which remains unchanged.
- Audit UPDATE, DELETE and TRUNCATE attempts fail.
- Both browser origins read real settings through their Vite proxies. Public response keys are allowlisted; settings writes and audit reads remain absent HTTP routes.

The integration runner invokes root npm database commands with COMPOSE_FILE/COMPOSE_PROJECT_NAME scoped to compose.test.yaml and conecta-foundation-tests. Databases use temporary storage on port 55432. The browser database is explicitly isolated; application DATABASE_URL is never used. Test containers/network were removed on completion. No application database was migrated, baselined or reset.

## Browser and visual evidence

The 12 controlled UI scenarios cover both origins at 360/768/1440, Spanish/English with reload persistence, input retention during loading/retry, class capacity and money display, empty/error states, dialog keyboard operation/focus trap/restoration, associated field errors and long translated labels. They intercept responses to make those states deterministic. The separate 2 integration scenarios use real PostgreSQL/API responses.

Agent-guided keyboard walkthrough: Tab reaches the skip link, brand link and language selector in order on both apps at all three widths; the selector has a solid visible outline. Dialog Enter/Tab/Escape and focus return pass. Captured Spanish mobile focus states were visually inspected in both apps: the focus ring is visible and unclipped, content remains readable, and controls fit. Earlier customer/management desktop and mobile layout review is retained. Local screenshots are ignored test-results artifacts.

Color-pair review: body text/white 13.64:1; muted text/blush 6.08:1; white/primary 7.40:1; error text/white 7.38:1; input boundary/white 4.18:1 (non-text boundary). axe reports no violations under configured WCAG 2/2.1/2.2 A/AA tags for tested loaded states, field fixture and open dialog. These targeted checks do not certify every WCAG requirement or replace future assistive-technology review of completed feature screens.

## Acceptance mapping

| Criterion | Evidence |
| --- | --- |
| A01 settings/defaults | Real persisted defaults and invalid-change rejection pass |
| A02 locale preservation | Both browser origins pass switch/reload/input checks |
| A03 money/time | Formatter tests and UI fixture rendering pass |
| A04 atomic audit | Successful change and induced rollback pass on PostgreSQL |
| A05 corrections/privacy | Correction reference, original preservation, payload allowlist and mutation rejection pass |
| A06 public boundary | Real allowlisted responses and absent write/audit routes pass; no authentication claim |
| A07 shared components | Responsive, keyboard, visual focus, field-error, loading and retry checks pass |
| A08 fresh/repeat/checksum | Real Flyway execution, no-op repeat, checksum rejection and failed-DDL rollback pass |
| A09 legacy adoption/drift | Matching fixture preserves rows/history; drift rejected; real database adoption still requires its own approval |
| A10 workspace separation | Builds, shared packages, both proxies and root lifecycle pass |
| A11 both apps / roles | Shared presentation passes for both apps; role authorization remains an explicit Identity dependency |

## Handoff

- db:migrate now invokes Flyway; db:flyway:migrate is a compatibility alias. The legacy executable/API-workspace command were removed after successful live acceptance. Original SQL/history remain provenance.
- Follow [database migration instructions](../docs/database-migrations.md) for a fresh local database or separately approved existing-database adoption.
- User review is next. Public-home and Identity need their own specifications before implementation. Authentication, bookings, payments, credits, payroll, audit retention and downstream typed audit events remain with their owning modules.
- This continuation did not change business rules or regenerate the Spanish PDF. Changes have not been committed or pushed in this continuation.
