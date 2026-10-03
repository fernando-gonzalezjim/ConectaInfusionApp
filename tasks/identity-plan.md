# Implementation plan: Identity and access

Status: approved by the user on October 3, 2026, together with its ordered task list. Implementation will use branch `feature/identity-implementation` until completed. This approval authorizes local implementation; production deployment, real accounts and real email sending remain separate work.

Module: `identity`; dependency: `foundation`. Sources: [approved specification](../SPEC-identity.md), [capability map](../CAPABILITY-MAP.md), [business rules](../docs/requirements/agreed-business-rules.md) / [Spanish rules](../docs/requirements/agreed-business-rules.es.md). Tasks: [identity-todo.md](identity-todo.md).

The existing [Foundation plan](plan.md), [tasks](todo.md) and [verification evidence](foundation-verification.md) remain intact, including the unchecked human-review checkpoint. Identity uses separate files so completed evidence and outstanding review are not overwritten.

## Deliverable and boundaries

Deliver email-based authentication, shared sessions across both frontends, server-side permissions, profile/account administration, invitations, family membership, dependent profiles, guardian authorization and account lifecycle. Keep Spanish primary and English available in the product; implementation and technical documentation use English.

Identity will provide active-account/role/guardian facts and transactional membership/lifecycle contracts. It will not implement purchases, credit valuation, attendance booking, café sales, instructor scheduling or payroll. The approved consequences for credits, bookings, teaching sessions and earnings must be enforced with those owning modules before the affected workflows are available for real use. A partially integrated account-deletion button is not a completed feature.

## Evidence informing this plan

The Graphify snapshot has 840 nodes, 1,051 edges and 50 communities. The query using `identity foundation authorization session audit membership credits migration` connects Identity with Foundation audit, the capability map and credits-bookings. Its truncation and [integrity warnings](../graphify-out/graph-health.json) mean direct source checks are required; this plan does not rely on graph-derived claims of implementation.

Direct checks found:

- `apps/api/src/app.ts` has public Foundation endpoints, explicit origins and JSON parsing, but no authentication or credentials-aware cookie flow.
- `packages/api-client/src/index.ts` supports GET reads only; it needs authenticated mutations, stable auth errors and CSRF handling.
- `members.email` is mandatory in V1; dependents therefore need a separate person/profile representation rather than invented email addresses.
- Existing bookings and sales reference member IDs; existing teaching sessions reference instructor IDs. Preserve these IDs and history through explicit links, never merge by matching names or email alone.
- `audit_events.actor_type` currently accepts only staff/system, and the existing writer only records settings changes. Customer self-service requires a forward migration and a dedicated allowlisted audit writer, not a forged staff actor.
- The isolated Docker integration runner currently executes only Foundation tests. Identity tests must be explicitly added so new tests are actually run.

## Architecture decisions proposed for approval

| Area | Proposed implementation | Reason and verification |
| --- | --- | --- |
| Account versus attendee | `people` holds identity/profile data; `accounts` holds email, password hash, access status and session version, with a unique person link. Dependents have people records without accounts. | A child can later gain a login without duplicating their profile or losing booking history. |
| Existing domain records | Add explicit nullable person links to existing members/instructors in forward migrations. Build a reconciliation report for existing rows. | Preserve FK targets; no silent name-based or email-based account claiming. Legacy rows remain usable by Foundation until safely linked. |
| Roles | Role assignment table supporting administrator, manager, reception, café staff, instructor and customer; owner authority maps to privileged administration as defined in the spec. | Multiple roles on one account; calculate capabilities from all active roles. Changing roles revokes existing sessions. |
| Passwords | Maintained `argon2` Node package, Argon2id, at least 19 MiB memory / 2 iterations / parallelism 1, benchmarked on Node 24 and supported Windows/Linux builds. | Follow [OWASP password storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html) and [node-argon2 documentation](https://github.com/ranisalt/node-argon2). Pin versions in I01; no weak fallback if native loading fails. |
| Password input | Proposed normal policy: 15–128 characters, permit spaces/Unicode, no mandatory composition rules, no silent truncation; only tagged development fixtures get the approved shorter-password exception. | Validate against [OWASP authentication guidance](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html). This is a technical policy proposal, not a new agreed business rule. |
| Sessions | Random opaque tokens, hash stored in PostgreSQL; HttpOnly cookies, Secure on HTTPS, SameSite Lax, fixed 7-day expiry or 30 days with Remember me. No browser storage of auth tokens. | Server checks status/session version per request; logout, all-device logout and reset invalidate sessions. Follow [OWASP session guidance](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html). |
| Shared frontend login | Preserve same-host development ports and `/api` proxies; host-only cookie with path `/` shared across localhost ports. Production must route both frontends and `/api` under one HTTPS host initially. | Cookies do not isolate by port. Verify that management's port alone never grants management authority. Independent production hosts require a reviewed transport change before deployment. |
| CSRF and CORS | Exact configured frontend origins, credentials-aware CORS only where needed, server-issued session-bound CSRF token plus Origin checks for mutations, including login/registration protections. | Preserve explicit allowlists; configure proxy trust only for known proxies. No wildcard credential origins, GET mutations or cross-origin secret leakage. |
| Action links | Purpose-bound random single-use tokens stored as hashes, target/recipient/version checked atomically. Approved 24-hour / 1-hour / 7-day lifetimes and resend limits. | GET landing page does not consume a link; deliberate POST does. Concurrent redemption/resend must not double-apply actions. |
| Email | `nodemailer` SMTP adapter; Mailpit as a local-only Docker inbox. Production uses configurable authenticated SMTP with TLS, no provider account provisioned during implementation. | [Nodemailer SMTP](https://nodemailer.com/smtp) permits provider substitution through configuration; [Mailpit Docker](https://mailpit.axllent.org/docs/install/docker/) documents the local service. Pin its image and bind inbox ports to loopback in I01/I05. |
| Delivery reliability | Transactional email outbox and bounded retry worker; encrypted token-bearing payloads, environment-held key, delivery payload scrubbed after terminal delivery/expiry. | SMTP runs after commit; failure cannot activate an account or silently lose an invitation. Never log email-link secrets or put plaintext tokens in audit. |
| Audit | Extend the actor constraint forward to include customer actions; dedicated identity writer with allowlisted before/after fields and correlation IDs, on the caller's transaction. | Preserve append-only trigger and settings writer behavior; raw secrets never become audit data. Admin/management reads are paginated and scoped server-side. |
| Concurrency | PostgreSQL transactions; serialize last-admin changes with a database advisory lock, lock families/dependents and affected accounts in a documented stable order. | Test concurrent role removal, guardian removal, invitation acceptance, departure and closure with real PostgreSQL barriers. Never rely on a preflight count outside the transaction. |
| Photos | Bounded JPEG/PNG/WebP uploads, verify actual content, strip metadata and re-encode via a maintained image library; controlled storage IDs and authorized serving. | No remote URL fetching, SVG/HTML uploads or filesystem paths supplied by clients. Pin library, size/pixel limits and storage strategy in I01; this remains a local-ready flow until production storage is configured. |

Use existing parameterized `pg` queries, TypeScript and workspace packages; no ORM, Redis, external identity service or new frontend application is required. Approving this plan authorizes these technical choices for local implementation, not production deployment or real customer invitations.

## Persistence and migration sequence

Reserve the next available Flyway versions during implementation; V3+ below are illustrative until checked against the working tree. Never edit V1/V2.

1. Accounts, people, role assignments and domain links; no default passwords or automatic admin.
2. Session/token/throttle/outbox tables and customer-capable identity audit support.
3. Families, accepted membership history, responsibility-transfer invitations and one current responsible member when present.
4. Dependents, guardian relationship history, pre-deactivation guardian provenance, reusable child details and independent-account transition state.

Define explicit constraints, FK indexes and active-record uniqueness. Preserve historical relationship rows rather than deleting them. Before linking any legacy row to a login, require a reviewed mapping and proof of authority; email collisions produce a report and block unsafe migration. Rehearse each forward migration against fresh, repeated and populated legacy fixtures. Integration databases are disposable; developer data is never reset or auto-baselined.

## Manual bootstrap and development accounts

Provide an operator-reviewed SQL bootstrap procedure using the same hash generator and transaction/audit format as normal accounts. The operator inserts the first administrator manually, with email-confirmation exemption recorded separately from actual verification. No app startup or migration creates it. Production credentials are separately supplied; no secrets are committed or echoed.

Development only: `admin@conecta.example.test` / `admin`, administrator; `testuser@conecta.example.test` / `testuser`, customer. After manual administrator creation, a separate explicitly enabled local fixture helper uses trusted admin creation logic for testuser. Require development environment, opt-in and verified disposable/local target; reject staging/production/unknown environments, existing conflicting records and fixture-marked accounts in non-development deployments. Repeated setup must not reset credentials or overwrite real accounts.

## API and frontend contracts

Use the existing `/api/v1` prefix. Define DTOs before routes; credential fields exist only in request types. Return public account/profile/capability data, never hashes, session tokens or raw action tokens. Proposed endpoint families:

| Family | Operations | Authorization |
| --- | --- | --- |
| `/auth` | registration, login, logout, logout-all, current session, confirm, resend, recover/reset, password setup, email change | Public flows with abuse controls; session ownership for protected flows. |
| `/me` | own profile, photo, reusable child details, deactivation preview/commit | Active verified or explicitly exempt account; target derived from session. |
| `/accounts` | personnel/customer creation, filtered listing, authorized profile edits, roles, deactivate/reactivate | Admin/management except staff customer invitations through a separate scoped command. |
| `/families` | create/read, invite/accept, leave/remove, nominate/accept successor, close | Accepted membership and exact agreed operation rights; guardianship is a different permission. |
| `/dependents` | profile management, guardian invites/removal, transition invitation, deactivate/reactivate | Authorized guardians or specified management operations; no access from family membership alone. |
| `/audit` | paginated operational audit | Admin/management only; personal transaction/pay views belong to owning modules. |

Use stable existing-style `{ code }` errors, with 401 unauthenticated, 403 denied, 409 conflicting state/integration unavailable, 429 throttled and 503 infrastructure unavailable. Public registration/recovery/resend responses must not reveal account existence. New email does not replace current login until confirmed; reject duplicate identity claims, notify the prior address and revoke existing sessions after completion. Password/security changes require recent authentication; define its concrete timeout in I01. Browser redirects are limited to configured local application paths.

Extend the shared API client with method/body, credentials, CSRF, cancellation and safe error mapping. Product controls explain actual account state without exposing technical internals. Reuse shared UI and i18n; no import from one frontend into the other.

Build thin slices: manual-admin login in both frontends first, then customer registration/confirmation, recovery, customer invitation, administration, family/guardian operations and lifecycle. Each backend slice precedes its corresponding UI and denial tests. Existing Foundation overview and outage behavior continue working.

## Integration safety before credits/bookings and payroll exist

Use an application composition layer for future cross-module coordinators. Identity accepts an existing transaction in internal membership/lifecycle commands and does not import credit calculations or repositories. The coordinator reads affected domain state, locks rows, applies cancellations/disposition and membership/access changes atomically, and appends audit. Commands are idempotent and re-check preview state at commit; stale previews cannot authorize a changed outcome.

Until owning modules are implemented, only enable operations whose absence of affected bookings/credits/pay obligations can be positively established. Existing legacy bookings, unknown financial state or unavailable coordinator must return a clear integration-required conflict, with no partial mutation. Do not equate “no credits table yet” with “no obligations.” Full new-user flows may run in controlled empty fixtures; lifecycle routes cannot be advertised as production-ready.

Record these later integration acceptance checks explicitly: two-hour cancellation boundaries; dependent bookings surviving a departing guardian; retained reserved credits; customer keep/donate choice; management and forced-removal default return; closure returns to original purchasers; free bookings cancelled on lost eligibility without credit charges; teaching reassignment/explicit cancellation; accrued payroll preservation. These are specification obligations, not tasks to implement financial modules inside Identity.

## Ordered phases and verification

The [task checklist](identity-todo.md) contains small units, dependencies, likely paths and acceptance checks. Each substantive task targets at most five files; split before implementation if discovery exceeds that bound. New migrations, dependency changes and shared contracts are sequential. Use existing skills for incremental implementation, tests, API design, security and review; create custom skills only for a repeated project workflow. No parallel agent implementation is required by this plan.

| Phase | Tasks | Review evidence |
| --- | --- | --- |
| 1. Safe persistence and admin login | I01–I09 | Verified migrations, hashing, sessions, manual fixture bootstrap and both-frontends login. |
| 2. Registration and account administration | I10–I22 | Email flows, permission denials, role concurrency, profile/photo and audit UI. |
| 3. Families and dependents | I23–I34 | Invitation consent, ownership boundaries, successor fallback, guardian invariants and independent transition. |
| 4. Lifecycle and handoff | I35–I40 | Coordinator safety, deactivation/reactivation, isolated integration/browser evidence, updated setup and graph reminder. |

Run focused Node tests for changed behavior, real PostgreSQL integration for invariants and rollback, and real Chromium for cookie sharing and UI flows. Clock control must cover exact expiry/cutoff boundaries. Controlled-response browser tests supplement but never substitute for real authentication tests. Cover Spanish/English, keyboard flow and existing 360/768/1440 viewports. No guessed coverage threshold and no skipped assertions to get green.

Final local commands: `npm run typecheck`, `npm run build`, `npm test`, `npm run test:integration`, `npm run test:e2e -- --project=chromium`. Add focused test entrypoints during implementation; until then no invented runnable commands. Record meaningful results in `tasks/identity-verification.md`. Reuse unchanged Foundation evidence, but rerun affected suites after schema/session/audit changes.

## Risks, limits and launch prerequisites

| Risk | Mitigation |
| --- | --- |
| A legacy customer/instructor record is claimed by the wrong login | Explicit mapping, collision report and reviewed linking; never auto-merge email or name. |
| Wrong role or target grants private access | API allowlists and direct request tests across every actor/target pair, including multi-role accounts. |
| Creator departure or guardian deactivation leaves unauthorized access | Transactional membership/version checks; consent remains required; revoked relationships remain historical only. |
| Pending reactivation leaves a dependent accessible without an active prior guardian | Acceptance records no access; privileged atomic completion validates prior guardian provenance and activity. |
| Long sessions or mail links remain usable after access changes | Server version/status checks, single-use consumption, revocation and tests for races. |
| Domain obligations are skipped while financial modules are absent | Integration-required failures and separately tracked owning-module acceptance checks. |
| Outbox/photo storage exposes personal data or secrets | Encryption, retention of delivery metadata only, bounded uploads, metadata removal and access checks. |
| Graph references requirements as implemented code | Validate sources and status; preserve graph limitations and stale reminder. |

Before production: choose SMTP provider/sender/domain and verify delivery, configure HTTPS/same-host routes/proxy trust, choose photo storage, production bootstrap and secret rotation, define personal-data handling/retention and review independent accounts for minors under the launch process. This plan does not invent a legal minimum age or retention period. Financial module integration and history screens must be verified before their operations ship.

## Graphify and documentation workflow

Use the current graph automatically for context where helpful. After changes to relationships, schema, contracts, module boundaries, specification or business rules, record “graph may be stale” and remind the user to update it. This new plan is meaningful graph content: update reminder is due now, but no rebuild is authorized merely by asking for the plan. No automatic hooks.

Keep English/Spanish business rules synchronized if a product rule changes during implementation. Both PDFs remain explicit-request snapshots. This plan adds technical decisions without changing approved product permissions. Record approved deviations before coding the affected slice.

## Approval requested

Review the local implementation approach, dependency additions, migration strategy, separate task files and integration safety boundary. After plan approval, start I01 and proceed through the checkpoints. Production deployment, real-user email, schema adoption on real databases and financial-module implementation remain separate work.
