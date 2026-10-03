# Identity verification evidence

Branch: `feature/identity-implementation`. Specification and implementation plan approved October 3, 2026. This file records completed checks without claiming the whole module is implemented.

## I01 — dependency and technical decisions

Completed October 3, 2026. Exact pins and limits are recorded in [identity-decisions.md](../docs/identity-decisions.md).

- Clean Windows x64 install: Node 24.21.0, npm 11.19.0, `npm ci --ignore-scripts`; passed.
- Windows dependency tests: `node --test apps/api/test/identity-dependencies.test.mjs`; 3 passed, none skipped.
- Clean Linux x64 install: disposable `node:24.21.0-bookworm-slim` container, project mounted read-only; root lockfile and every workspace manifest copied into container-local temporary storage, `npm ci --ignore-scripts`; passed. Image digest: `sha256:0e0ff40c39bc087845bfb27465a0df4ea419520094bc35842ff83dd8cbe6f9b6`.
- Linux dependency tests against that clean install: 3 passed, none skipped.
- Checks prove password verification rejects a wrong password, SMTP message construction works without external delivery, and image decoding/re-encoding removes EXIF metadata.
- Argon2id hash plus two verifications: approximately 47 ms on Windows and 62 ms in the Linux container. These are smoke timings, not load/capacity benchmarks.
- `npm run typecheck`, `npm run build`, `npm test`: passed; 13 unit tests total including the 3 dependency checks.
- Installation audit and `npm audit --omit=dev`: no known vulnerabilities reported. This is not proof against unknown malicious packages.

Initial checks found a test assuming a fixed PHC parameter order. The library emits `m,p,t`; the corrected assertion checks each parameter/value independently. Both platforms then passed. An initial sandboxed Node test spawn was denied; the normal test invocation was run with required execution permissions.

No database migration, account, session, SMTP connection or upload route exists from I01. Database and browser suites will be required when their behavior changes; unchanged Foundation evidence is preserved.

## Graph snapshot

The authorized incremental refresh before I01 re-extracted six changed documents and retained unchanged source fragments: 844 nodes, 1,120 edges, 53 communities. The report preserves the original full-extraction integrity warnings. Host semantic token usage was not exposed and is reported as unavailable, not zero.

I01–I03 introduced dependencies, tests, security decisions, persistence and audit code after that snapshot. **Graph may be stale; remind the user to update Graphify.** The earlier refresh does not authorize continuous rebuilding or hooks.

## I02 — account persistence

Completed October 3, 2026. V3 adds people, accounts, role assignments and nullable explicit member/instructor links. It does not seed identities, set passwords or claim legacy records. Normalized account emails are unique; confirmation proof/exemption provenance are distinct, and active accounts require password setup and verification or exemption. Historical domain references remain intact.

Three real PostgreSQL scenarios passed: fresh/no-op-repeat migration and constraints; populated legacy bookings/sales/instructors preserved with read-only collision/ownership reporting; intentional DDL conflict proving V3 rollback preserves legacy rows. The first red run failed on absent accounts/module as expected; scenarios passed after implementation. Reconciliation never writes or grants ownership; existing matching emails and inconsistent reviewed links are flagged.

The integration runner now discovers all `*.test.mjs` files, so Identity tests cannot be silently omitted. This small runner change was pulled forward from I39 because every new integration slice must actually run.

## I03 — customer-capable sanitized audit

Completed October 3, 2026. V4 extends actor types without changing V2 or its append-only trigger. The internal writer accepts only known account actions and typed allowlisted snapshots, derives no actor from an HTTP body, and uses the caller's transaction. No public mutation route is introduced.

Real PostgreSQL checks passed for customer attribution, secret/unknown-field rejection, nested-payload rejection, domain-plus-audit commit and failed-audit rollback. DELETE/UPDATE/TRUNCATE remain rejected. Existing Foundation settings audit tests also passed with the new actor constraint. Initial red run failed on the absent Identity writer as expected.

## First checkpoint — I01–I03

- `npm run typecheck`, `npm run build`, `npm test`: passed after persistence/audit changes; 13 unit tests, none skipped.
- `npm run test:integration`: passed; 7 PostgreSQL tests, Flyway migrate/repeat/validate/info, and 2 real Chromium Foundation regression flows through both frontend proxies. Test service used PostgreSQL 17.11 and Flyway 13.9.0.
- Browser teardown confirmed API/customer/management ports close; disposable Docker database/network removed. Developer databases were not migrated or reset.
- No login UI, sessions, real account creation, fixture bootstrap or real email exists yet. Those are later tasks; the approved admin/testuser credentials become usable only after bootstrap/login implementation.
- PDFs remain the earlier explicit-request snapshots. This implementation changed no agreed product rule and required no new translation.

Human review is pending at the checkpoint required by the approved [task list](identity-todo.md). After review, I04 implements password validation and the manual first-admin/development fixture workflow.

Primary references: [PostgreSQL 17 constraints](https://www.postgresql.org/docs/17/ddl-constraints.html) and [node-postgres transactions](https://node-postgres.com/features/transactions).
