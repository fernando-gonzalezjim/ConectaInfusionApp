# Identity implementation tasks

Status: approved by the user on October 3, 2026. Implementation branch: `feature/identity-implementation`. I01–I18 are complete. The user approved the I03, I06, I12 and I15 human-review checkpoints and authorized continuation through I18. The human-review checkpoint after I18 remains pending; I19 administration UI is next. The user authorized an incremental Graphify refresh and commit/push after I18. Follow [identity-plan.md](identity-plan.md) and [approved specification](../SPEC-identity.md). Preserve the existing Foundation plan and verification evidence.

Task paths are likely areas, not permission to change entire directories. Each task is Small (1–2 substantive files) or Medium (3–5); split further before coding when a slice exceeds five files. Establish actual focused test commands as files are added. API denial tests are mandatory; UI visibility alone is not authorization.

## Phase 1: Safe persistence and admin login

### I01: Resolve technical choices

- [x] **Acceptance:** Pin compatible hashing/mail/photo dependencies and local image; record password, recent-auth, upload limits and storage decisions without changing product rules.
- [x] **Verification:** Windows/Linux dependency smoke checks; review chosen limits. Run focused checks and typecheck/build for affected work. See [decisions](../docs/identity-decisions.md) and [evidence](identity-verification.md).

**Dependencies:** None. **Estimated scope:** Medium, at most five substantive files; split if necessary.

**Likely paths:** `package.json`, `apps/api/package.json`, `docs/identity-decisions.md`.

### I02: Account persistence

- [x] **Acceptance:** Add forward migration for people/accounts/roles and explicit legacy links; preserve IDs and produce collision/reconciliation report without automatic claiming.
- [x] **Verification:** Fresh/repeated/populated PostgreSQL migration tests. Run focused checks and typecheck/build for affected work. See [verification evidence](identity-verification.md).

**Dependencies:** I01. **Estimated scope:** Medium, at most five substantive files; split if necessary.

**Likely paths:** `database/migrations/`, `apps/api/src/modules/identity/accounts.ts`, `apps/api/test/integration/identity-accounts.test.mjs`.

### I03: Identity audit

- [x] **Acceptance:** Permit customer actors through a forward migration; sanitized identity events use the caller transaction and retain append-only protection.
- [x] **Verification:** Rollback, forbidden mutation and secret-exclusion integration tests. Run focused checks and typecheck/build for affected work. See [verification evidence](identity-verification.md).

**Dependencies:** I02. **Estimated scope:** Medium, at most five substantive files; split if necessary.

**Likely paths:** `database/migrations/`, `apps/api/src/modules/identity/audit.ts`, `apps/api/test/integration/identity-audit.test.mjs`.

### Checkpoint after I03

- [x] Changed tests pass, affected builds succeed, and the completed slice is demonstrated through isolated persistence/audit scenarios.
- [x] Record evidence and security/domain integration limits in `tasks/identity-verification.md`.
- [x] Human reviewed I01–I03 and approved continuation to I04. User authorized an incremental Graphify refresh for the implementation changes.

### I04: Password and bootstrap

Execute as three small sub-slices: I04a password module/unit tests (2 files); I04b operator/bootstrap logic and PostgreSQL integration tests (2 files); I04c CLI, CLI tests, operator guide and ignored local SQL output (at most 4 files). Scope and permissions are unchanged.

- [x] **Acceptance:** Implement approved hashing and manual first-admin procedure; opt-in local-only testuser fixture never overwrites accounts or runs at startup. See [operator guide](../docs/identity-bootstrap.md).
- [x] **Verification:** Correct/wrong password tests; reject fixtures outside development and conflicting reruns. Typecheck, build, unit, PostgreSQL and Foundation browser regression checks passed; see [evidence](identity-verification.md).

**Dependencies:** I03. **Estimated scope:** Medium, at most five substantive files; split if necessary.

**Likely paths:** `apps/api/src/modules/identity/passwords.ts`, `scripts/identity-bootstrap.mjs`, `docs/identity-bootstrap.md`, `apps/api/test/identity-passwords.test.mjs`.

### I05: Session and delivery persistence

Execute as small sub-slices: I05a V5 schema/PostgreSQL tests (2 files); I05b validated configuration/unit tests (2 files); I05c encryption/unit tests (2 files); I05d startup validation/API environment example (2 files); I05e Mailpit Compose files, inbox test and setup guide (4 files). Tracking updates are documentation only. No login route, token redemption or delivery worker is added in this persistence task.

- [x] **Acceptance:** Migrate hashed sessions/action tokens/throttles/encrypted outbox; configure loopback Mailpit and validated env secrets. See [local setup](../docs/identity-local-email.md).
- [x] **Verification:** Migration constraints, invalid config, encryption/tampering and real local inbox smoke checks passed, together with workspace typecheck/build/unit and isolated integration/browser regressions. See [evidence](identity-verification.md).

**Dependencies:** I04. **Estimated scope:** Medium, at most five substantive files; split if necessary.

**Likely paths:** `database/migrations/`, `compose.yaml`, `.env.example`, `apps/api/src/modules/identity/config.ts`, `apps/api/test/identity-config.test.mjs`.

### I06: Login backend

Execute as small sub-slices: I06a login throttle/PostgreSQL tests (2 files); I06b session service/PostgreSQL tests (2 files); I06c unmounted auth router/HTTP integration tests (2 files); I06d setup/decision/evidence documentation. The auth router is not mounted in the application until I07 supplies the shared transport and CSRF/Origin checks. No new frontend or production deployment is included.

- [x] **Acceptance:** Implement opaque sessions, fixed expiry, session-version checks, logout/all-device logout and generic failures; role/status checked server-side.
- [x] **Verification:** Expiry boundaries, revoked sessions, multi-role denial, concurrency and rollback checks passed. See [evidence](identity-verification.md) and [backend guide](../docs/identity-login-backend.md).

**Dependencies:** I05. **Estimated scope:** Medium, at most five substantive files; split if necessary.

**Likely paths:** `apps/api/src/modules/identity/sessions.ts`, `apps/api/src/modules/identity/auth-routes.ts`, `apps/api/test/integration/identity-sessions.test.mjs`.

### Checkpoint after I06

- [x] Changed tests pass, affected builds succeed, and the completed slice is demonstrated.
- [x] Record evidence and security/domain integration limits in `tasks/identity-verification.md`.
- [x] User approved the completed I04–I06 slice and continuation. The authorized incremental Graphify refresh includes I05 and I06.

### I07: Authenticated transport

Execute as small sub-slices: I07a shared DTOs/client and focused client tests (3 files); I07b validated origin config, CSRF middleware and denial tests (4 files); I07c app/server integration, router/shared model changes and real PostgreSQL transport tests (5 files); I07d isolated Chromium config/transport check and disabled-mode test wording (3 files); I07e documentation/evidence. Keep Identity opt-in. Login UI remains I08/I09. No graph refresh or commit is implied by this checkpoint approval.

- [x] **Acceptance:** Shared DTOs/client mutations, exact origins, credentials and anonymous/session-bound CSRF protection integrated in the opt-in application. See [transport guide](../docs/identity-auth-transport.md).
- [x] **Verification:** Direct missing/foreign CSRF denials, cookie/error contracts, workspace checks, PostgreSQL scenarios and real Chromium transport verified. See [evidence](identity-verification.md).

**Dependencies:** I06. **Estimated scope:** Medium, at most five substantive files; split if necessary.

**Likely paths:** `packages/contracts/index.d.ts`, `packages/api-client/src/index.ts`, `apps/api/src/app.ts`, `apps/api/src/modules/identity/csrf.ts`, `apps/api/test/integration/identity-transport.test.mjs`.

### I08: Customer login slice

Execute as small sub-slices: I08a shared sign-in form, bilingual labels, customer session container and header integration (4 files); I08b controlled Chromium UI, isolated Foundation auth fixtures and real PostgreSQL browser login tests (3 files); I08c documentation/evidence and authorized changed-file Graphify refresh. Management login remains I09.

- [x] **Acceptance:** Spanish/English sign-in, Remember me and own-account/current-device/all-device logout implemented with shared accessible components. See [customer login guide](../docs/identity-customer-login.md).
- [x] **Verification:** Real local administrator/customer form login, fixed lifetimes, reload restoration, keyboard/validation, failure states and responsive accessibility verified. See [evidence](identity-verification.md).

**Dependencies:** I07. **Estimated scope:** Medium, at most five substantive files; split if necessary.

**Likely paths:** `apps/customer-web/src/`, `packages/ui/src/`, `packages/i18n/src/`, `tests/e2e/identity-login.spec.ts`.

### I09: Management login slice

Execute as small sub-slices: I09a shared access contract/client/test (3 files); I09b authorization module/application and PostgreSQL denial tests (3 files); I09c shared account/session controls, customer wrapper and i18n copy adapter (3 files); I09d management UI/copy/controlled browser checks (4 files); I09e real cross-frontend browser tests and documentation/evidence. No account-administration mutation, role assignment, graph refresh or production deployment is included.

- [x] **Acceptance:** Reuse shared session controls and enforce management API/UI capabilities; keep public Foundation behavior working.
- [x] **Verification:** Both-port shared login/logout and direct non-manager API denial in real Chromium. Workspace, PostgreSQL and both-port Chromium checks passed; see [evidence](identity-verification.md) and [management guide](../docs/identity-management-login.md).

**Dependencies:** I08. **Estimated scope:** Medium, at most five substantive files; split if necessary.

**Likely paths:** `apps/management-web/src/`, `apps/api/src/modules/identity/authorization.ts`, `tests/e2e/identity-management.spec.ts`.

### Checkpoint after I09

- [x] Changed tests pass, affected builds succeed, and the completed slice is demonstrated.
- [x] Record evidence and security/domain integration limits in `tasks/identity-verification.md`.
- [x] User approved continuation after I09 by requesting I10. Graphify remains stale for I09 and later changes.

## Phase 2: Registration and account administration

### I10: Single-use action delivery

Execute as small sub-slices: I10a internal token contract/issuance/redemption and real PostgreSQL tests (2 files); I10b bounded outbox worker/SMTP adapter, delivery tests and existing Mailpit scenario (3 files); I10c operator command/scripts/tests (3 files); I10d operator guides/README; I10e tracking/evidence. No registration/invitation route, real-user email, graph refresh or developer database migration is included.

- [x] **Acceptance:** Implement purpose/recipient/version-bound links, encrypted transactional outbox, bounded retry and scrubbing; GET never consumes. See [delivery guide](../docs/identity-action-delivery.md).
- [x] **Verification:** Concurrent consumption/resend, SMTP outage recovery, stale-worker denial, socket deadline and secret-free operator output passed. Workspace checks, PostgreSQL/Mailpit scenarios and Chromium regressions passed; see [evidence](identity-verification.md).

**Dependencies:** I09. **Estimated scope:** Medium, at most five substantive files; split if necessary.

**Likely paths:** `apps/api/src/modules/identity/action-tokens.ts`, `apps/api/src/modules/identity/email-outbox.ts`, `apps/api/test/integration/identity-actions.test.mjs`.

### I11: Customer registration backend

Execute as small sub-slices: I11a registration/confirmation/resend service and real PostgreSQL tests (2 files); I11b auth-router/application composition (2 files), extending the same tests for actual HTTP denial checks; I11c guide/README and evidence/checklist. No registration UI, migration, production mail or real-user account creation is included. After verification, perform the user-authorized changed-file Graphify refresh, including the stale I09/I10 sources.

- [x] **Acceptance:** Register customer-only pending accounts; confirm email on deliberate POST; apply 24-hour expiry, enumeration-safe replies and resend limits. See [registration contract](../docs/identity-registration.md).
- [x] **Verification:** Role injection denial, exact expiry, 60-second/five-per-hour limits, concurrency, rollback and direct HTTP guards passed. Workspace and integration/browser regressions passed; see [evidence](identity-verification.md).

**Dependencies:** I10. **Estimated scope:** Medium, at most five substantive files; split if necessary.

**Likely paths:** `apps/api/src/modules/identity/registration.ts`, `apps/api/src/modules/identity/auth-routes.ts`, `apps/api/test/integration/identity-registration.test.mjs`.

### I12: Registration UI

Delivered as small sub-slices: typed client/contracts and unit test; customer screens and translations; controlled browser regressions; shared disposable email test configuration and real inbox flows; documentation and evidence. No backend behavior, migration or business rule was changed.

- [x] **Acceptance:** Expose bilingual registration/confirmation/resend with pending-state explanations and retry.
- [x] **Verification:** Real inbox confirmation flow; expired/used link and keyboard checks. Run focused checks and typecheck/build for affected work.

**Dependencies:** I11. **Estimated scope:** Medium, at most five substantive files; split if necessary.

**Likely paths:** `apps/customer-web/src/`, `packages/i18n/src/`, `tests/e2e/identity-registration.spec.ts`.

### Checkpoint after I12

- [x] Changed tests pass, affected builds succeed, and the completed slice is demonstrated.
- [x] Record evidence and security/domain integration limits in `tasks/identity-verification.md`.
- [x] Human reviews completed slice before the next group; remind user to update Graphify after meaningful changes.

### I13: Recovery backend

Execute as small sub-slices: I13a service and real PostgreSQL tests with shared public-action limit extraction; I13b HTTP routes/application composition and denial tests; I13c recovery guide and tracking/evidence. Preserve existing registration behavior. No recovery UI, migration, business-rule change, production sending or graph refresh is included.

- [x] **Acceptance:** Implement one-hour password reset, generic public responses and all-session revocation; inactive accounts remain inactive.
- [x] **Verification:** Concurrent reuse denied; expiry boundary and disabled-account recovery tests. Run focused checks and typecheck/build for affected work.

**Dependencies:** I12. **Estimated scope:** Medium, at most five substantive files; split if necessary.

**Likely paths:** `apps/api/src/modules/identity/recovery.ts`, `apps/api/src/modules/identity/auth-routes.ts`, `apps/api/test/integration/identity-recovery.test.mjs`.

### I14: Recovery UI

Delivered as typed client/contract/test, shared recovery and action-page components, frontend integration/translation, controlled browser tests, real inbox/session tests, and documentation slices. Initial invitation setup remains I15/I16, since its backend does not exist in I13; unsupported setup purposes stay blocked. The user also authorized a changed-file Graphify refresh including stale I13 sources.

- [x] **Acceptance:** Provide recovery/password reset pages without login-token leakage or arbitrary redirects.
- [x] **Verification:** Real inbox reset; both-frontends prior sessions stop working. Run focused checks and typecheck/build for affected work.

**Dependencies:** I13. **Estimated scope:** Medium, at most five substantive files; split if necessary.

**Likely paths:** `packages/ui/src/`, `apps/customer-web/src/`, `apps/management-web/src/`, `packages/i18n/src/`, `tests/e2e/identity-recovery.spec.ts`.

### I15: Customer invitations backend

- [x] **Acceptance:** Allow all specified staff/instructors to send customer-only invitations; only privileged accounts may waive confirmation, with secure password setup and provenance.
- [x] **Verification:** Actor matrix, missing email, forged exemption/role and consumed setup tests. Run focused checks and typecheck/build for affected work.

**Dependencies:** I14. **Estimated scope:** Medium, at most five substantive files; split if necessary.

**Likely paths:** `apps/api/src/modules/identity/account-invitations.ts`, `apps/api/src/modules/identity/account-routes.ts`, `apps/api/test/integration/identity-invitations.test.mjs`.

### Checkpoint after I15

- [x] Changed tests pass, affected builds succeed, and the completed slice is demonstrated.
- [x] Record evidence and security/domain integration limits in `tasks/identity-verification.md`.
- [x] Human reviews completed slice before the next group; remind user to update Graphify after meaningful changes. I15 approved October 4, 2026; graph refresh remains pending.

### I16: Invitation UI

- [x] **Acceptance:** Offer permitted creation controls and confirmation/setup landing flow; ordinary inviters cannot inspect/edit private customer records.
- [x] **Verification:** Staff/instructor invite flow and management exemption flow in both languages. Run focused checks and typecheck/build for affected work.

**Dependencies:** I15. **Estimated scope:** Medium, at most five substantive files; split if necessary.

**Likely paths:** `apps/management-web/src/`, `packages/ui/src/`, `packages/i18n/src/`, `tests/e2e/identity-invitations.spec.ts`.

### I17: Account administration backend

- [x] **Acceptance:** Implement privileged personnel/customer listing and edits with field allowlists; own-profile writes never promote privileges.
- [x] **Verification:** Full actor/target matrix and direct IDOR/mass-assignment tests. Run focused checks and typecheck/build for affected work.

**Dependencies:** I16. **Estimated scope:** Medium, at most five substantive files; split if necessary.

**Likely paths:** `apps/api/src/modules/identity/account-routes.ts`, `apps/api/src/modules/identity/accounts.ts`, `apps/api/test/integration/identity-permissions.test.mjs`.

### I18: Role administration

- [x] **Acceptance:** Apply privileged role assignments, revoke sessions and serialize last-active-admin checks; expose future free-booking eligibility hooks.
- [x] **Verification:** Two concurrent admin removals leave one; self-demotion and customer-role preservation tests. Run focused checks and typecheck/build for affected work.

**Dependencies:** I17. **Estimated scope:** Medium, at most five substantive files; split if necessary.

**Likely paths:** `apps/api/src/modules/identity/roles.ts`, `apps/api/src/modules/identity/account-routes.ts`, `apps/api/test/integration/identity-roles.test.mjs`.

### Checkpoint after I18

- [x] Changed tests pass, affected builds succeed, and the completed slice is demonstrated.
- [x] Record evidence and security/domain integration limits in `tasks/identity-verification.md`.
- [ ] Human reviews completed slice before the next group; remind user to update Graphify after meaningful changes.

### I19: Administration UI

- [ ] **Acceptance:** Provide authorized account details/roles with clear denial/conflict handling; do not present unintegrated lifecycle as available.
- [ ] **Verification:** Role changes invalidate active browsers; customer/instructor cannot administer others. Run focused checks and typecheck/build for affected work.

**Dependencies:** I18. **Estimated scope:** Medium, at most five substantive files; split if necessary.

**Likely paths:** `apps/management-web/src/`, `packages/i18n/src/`, `tests/e2e/identity-administration.spec.ts`.

### I20: Self profile and email change

- [ ] **Acceptance:** Allow own approved fields; verify new email before login replacement, notify prior address and revoke sessions after completion.
- [ ] **Verification:** Uniqueness races, ownership denial, old/new address behavior and recent-auth tests. Run focused checks and typecheck/build for affected work.

**Dependencies:** I19. **Estimated scope:** Medium, at most five substantive files; split if necessary.

**Likely paths:** `apps/api/src/modules/identity/profiles.ts`, `apps/api/src/modules/identity/auth-routes.ts`, `packages/ui/src/`, `packages/i18n/src/`, `apps/api/test/integration/identity-profiles.test.mjs`.

### I21: Profile photos

- [ ] **Acceptance:** Add bounded verified/re-encoded uploads, private storage identifiers and authorized serving using I01 decisions.
- [ ] **Verification:** Spoofed types, pixel limits, metadata stripping and cross-account access tests. Run focused checks and typecheck/build for affected work.

**Dependencies:** I20. **Estimated scope:** Medium, at most five substantive files; split if necessary.

**Likely paths:** `apps/api/src/modules/identity/photos.ts`, `apps/api/src/modules/identity/profile-routes.ts`, `packages/ui/src/`, `apps/api/test/identity-photos.test.mjs`.

### Checkpoint after I21

- [ ] Changed tests pass, affected builds succeed, and the completed slice is demonstrated.
- [ ] Record evidence and security/domain integration limits in `tasks/identity-verification.md`.
- [ ] Human reviews completed slice before the next group; remind user to update Graphify after meaningful changes.

### I22: Operational audit views

- [ ] **Acceptance:** Expose paginated privileged sanitized audit and bilingual management view; personal transaction/pay histories remain domain-owned.
- [ ] **Verification:** Customer/staff denial, pagination and no secret exposure. Run focused checks and typecheck/build for affected work.

**Dependencies:** I21. **Estimated scope:** Medium, at most five substantive files; split if necessary.

**Likely paths:** `apps/api/src/modules/identity/audit-routes.ts`, `packages/contracts/index.d.ts`, `apps/management-web/src/`, `packages/i18n/src/`, `apps/api/test/integration/identity-audit-view.test.mjs`.

## Phase 3: Families and dependents

### I23: Family persistence

- [ ] **Acceptance:** Migrate historical memberships and responsible-member state; define transactional membership commands distinct from credit disposition.
- [ ] **Verification:** Constraint and concurrent duplicate-membership tests. Run focused checks and typecheck/build for affected work.

**Dependencies:** I22. **Estimated scope:** Medium, at most five substantive files; split if necessary.

**Likely paths:** `database/migrations/`, `apps/api/src/modules/identity/families.ts`, `apps/api/test/integration/identity-families.test.mjs`.

### I24: Family invitation backend

- [ ] **Acceptance:** Create customer families and seven-day invitations requiring acceptance; management assistance does not bypass consent.
- [ ] **Verification:** Pending grants no rights; expired/duplicate/concurrent acceptance tests. Run focused checks and typecheck/build for affected work.

**Dependencies:** I23. **Estimated scope:** Medium, at most five substantive files; split if necessary.

**Likely paths:** `apps/api/src/modules/identity/family-invitations.ts`, `apps/api/src/modules/identity/family-routes.ts`, `apps/api/test/integration/identity-family-invitations.test.mjs`.

### Checkpoint after I24

- [ ] Changed tests pass, affected builds succeed, and the completed slice is demonstrated.
- [ ] Record evidence and security/domain integration limits in `tasks/identity-verification.md`.
- [ ] Human reviews completed slice before the next group; remind user to update Graphify after meaningful changes.

### I25: Family UI

- [ ] **Acceptance:** Expose group creation, accepted membership and invite/accept views without granting guardianship.
- [ ] **Verification:** Customer/management assistance flow; pending and unrelated member denial. Run focused checks and typecheck/build for affected work.

**Dependencies:** I24. **Estimated scope:** Medium, at most five substantive files; split if necessary.

**Likely paths:** `apps/customer-web/src/`, `apps/management-web/src/`, `packages/i18n/src/`, `tests/e2e/identity-families.spec.ts`.

### I26: Successor responsibility

- [ ] **Acceptance:** Support voluntary nomination and acceptance; decline does not block departure; departed creator loses authority and last-member fallback applies.
- [ ] **Verification:** Pending/declined offers grant no closure; membership changes invalidate obsolete offers. Run focused checks and typecheck/build for affected work.

**Dependencies:** I25. **Estimated scope:** Medium, at most five substantive files; split if necessary.

**Likely paths:** `apps/api/src/modules/identity/family-responsibility.ts`, `apps/api/src/modules/identity/family-routes.ts`, `apps/customer-web/src/`, `apps/api/test/integration/identity-successor.test.mjs`.

### I27: Membership lifecycle contracts

- [ ] **Acceptance:** Define leave/remove/close preview and transaction contracts; authorized closure and original-purchaser/keep-donate semantics are obligations for domain coordinators.
- [ ] **Verification:** Denied actors and unavailable/unknown obligations cause no partial membership mutation. Run focused checks and typecheck/build for affected work.

**Dependencies:** I26. **Estimated scope:** Medium, at most five substantive files; split if necessary.

**Likely paths:** `apps/api/src/modules/identity/family-lifecycle.ts`, `packages/contracts/index.d.ts`, `apps/api/test/integration/identity-family-lifecycle.test.mjs`.

### Checkpoint after I27

- [ ] Changed tests pass, affected builds succeed, and the completed slice is demonstrated.
- [ ] Record evidence and security/domain integration limits in `tasks/identity-verification.md`.
- [ ] Human reviews completed slice before the next group; remind user to update Graphify after meaningful changes.

### I28: Dependent persistence

- [ ] **Acceptance:** Migrate no-login dependent people, guardian history, reusable child details and prior-guardian provenance; preserve attendee versus actor.
- [ ] **Verification:** Multiple guardians, historical rows and no invented-email tests. Run focused checks and typecheck/build for affected work.

**Dependencies:** I27. **Estimated scope:** Medium, at most five substantive files; split if necessary.

**Likely paths:** `database/migrations/`, `apps/api/src/modules/identity/dependents.ts`, `apps/api/test/integration/identity-dependents.test.mjs`.

### I29: Dependent profile backend

- [ ] **Acceptance:** Allow authorized guardian profile management; saved child name/age without profile is reusable and can convert without losing history.
- [ ] **Verification:** Unrelated family member denied; attendee/actor snapshots remain distinct. Run focused checks and typecheck/build for affected work.

**Dependencies:** I28. **Estimated scope:** Medium, at most five substantive files; split if necessary.

**Likely paths:** `apps/api/src/modules/identity/dependent-routes.ts`, `apps/api/src/modules/identity/child-details.ts`, `apps/api/test/integration/identity-child-details.test.mjs`.

### I30: Dependent UI

- [ ] **Acceptance:** Offer child name/age reuse and optional profiles, clearly showing authorized guardians.
- [ ] **Verification:** Guardian flows in both languages; booking integration remains unavailable until its module exists. Run focused checks and typecheck/build for affected work.

**Dependencies:** I29. **Estimated scope:** Medium, at most five substantive files; split if necessary.

**Likely paths:** `apps/customer-web/src/`, `packages/ui/src/`, `packages/i18n/src/`, `tests/e2e/identity-dependents.spec.ts`.

### Checkpoint after I30

- [ ] Changed tests pass, affected builds succeed, and the completed slice is demonstrated.
- [ ] Record evidence and security/domain integration limits in `tasks/identity-verification.md`.
- [ ] Human reviews completed slice before the next group; remind user to update Graphify after meaningful changes.

### I31: Guardian consent

- [ ] **Acceptance:** Implement seven-day existing-guardian invitations and management assistance; only accepted relationships authorize access.
- [ ] **Verification:** Pending grants no access; duplicate acceptance and wrong-target tests. Run focused checks and typecheck/build for affected work.

**Dependencies:** I30. **Estimated scope:** Medium, at most five substantive files; split if necessary.

**Likely paths:** `apps/api/src/modules/identity/guardian-invitations.ts`, `apps/api/src/modules/identity/dependent-routes.ts`, `apps/api/test/integration/identity-guardian-invitations.test.mjs`.

### I32: Guardian removal

- [ ] **Acceptance:** Allow self-removal and privileged removal of another guardian; serialize checks so active dependents retain an active guardian.
- [ ] **Verification:** Sequential/concurrent last-guardian removal rollback and pending-does-not-count tests. Run focused checks and typecheck/build for affected work.

**Dependencies:** I31. **Estimated scope:** Medium, at most five substantive files; split if necessary.

**Likely paths:** `apps/api/src/modules/identity/guardians.ts`, `apps/api/src/modules/identity/dependent-routes.ts`, `apps/customer-web/src/`, `apps/api/test/integration/identity-guardians.test.mjs`.

### I33: Independent account transition

- [ ] **Acceptance:** Guardian requests email/password transition; confirmation completes automatically, without minimum age/manual approval; end every guardian's access and preserve identity/family history.
- [ ] **Verification:** Duplicate-email/concurrent transition tests; former guardians denied after completion. Run focused checks and typecheck/build for affected work.

**Dependencies:** I32. **Estimated scope:** Medium, at most five substantive files; split if necessary.

**Likely paths:** `apps/api/src/modules/identity/dependent-transition.ts`, `apps/api/src/modules/identity/dependent-routes.ts`, `apps/customer-web/src/`, `apps/api/test/integration/identity-transition.test.mjs`.

### Checkpoint after I33

- [ ] Changed tests pass, affected builds succeed, and the completed slice is demonstrated.
- [ ] Record evidence and security/domain integration limits in `tasks/identity-verification.md`.
- [ ] Human reviews completed slice before the next group; remind user to update Graphify after meaningful changes.

### I34: Family/dependent review

- [ ] **Acceptance:** Complete management assistance and consent UI; verify specification coverage and identify remaining owning-module obligations.
- [ ] **Verification:** Real inbox successor/guardian/transition flows; direct API permission matrix. Run focused checks and typecheck/build for affected work.

**Dependencies:** I33. **Estimated scope:** Medium, at most five substantive files; split if necessary.

**Likely paths:** `apps/management-web/src/`, `packages/i18n/src/`, `tests/e2e/identity-relationships.spec.ts`, `tasks/identity-verification.md`.

## Phase 4: Lifecycle and handoff

### I35: Lifecycle composition guard

- [ ] **Acceptance:** Provide transaction/idempotency/preview coordinator contracts; detect legacy obligations and fail closed when unavailable; never treat missing tables as proof of no obligation.
- [ ] **Verification:** Legacy booking, stale preview, coordinator failure and rollback integration tests. Run focused checks and typecheck/build for affected work.

**Dependencies:** I34. **Estimated scope:** Medium, at most five substantive files; split if necessary.

**Likely paths:** `apps/api/src/modules/identity/lifecycle.ts`, `apps/api/src/composition/identity-lifecycle.ts`, `apps/api/test/integration/identity-lifecycle.test.mjs`.

### I36: Account deactivation

- [ ] **Acceptance:** Implement privileged/self deactivation through composition guard; accepted guardian transfer or allowed joint dependent deactivation; revoke sessions and preserve history.
- [ ] **Verification:** Other guardian/dependent stays active; teaching/pay obligations block unsafe changes; cancellation outcomes use coordinator contract. Run focused checks and typecheck/build for affected work.

**Dependencies:** I35. **Estimated scope:** Medium, at most five substantive files; split if necessary.

**Likely paths:** `apps/api/src/modules/identity/deactivation.ts`, `apps/api/src/modules/identity/account-routes.ts`, `apps/api/test/integration/identity-deactivation.test.mjs`.

### Checkpoint after I36

- [ ] Changed tests pass, affected builds succeed, and the completed slice is demonstrated.
- [ ] Record evidence and security/domain integration limits in `tasks/identity-verification.md`.
- [ ] Human reviews completed slice before the next group; remind user to update Graphify after meaningful changes.

### I37: Reactivation

- [ ] **Acceptance:** Privileged reactivation restores access only; relationships need new accepted invitations; dependent restoration requires active accepting prior guardian provenance.
- [ ] **Verification:** All prior guardians inactive blocks restoration; unrelated former guardian denied; no booking/expired-credit resurrection. Run focused checks and typecheck/build for affected work.

**Dependencies:** I36. **Estimated scope:** Medium, at most five substantive files; split if necessary.

**Likely paths:** `apps/api/src/modules/identity/reactivation.ts`, `apps/api/src/modules/identity/account-routes.ts`, `apps/api/test/integration/identity-reactivation.test.mjs`.

### I38: Lifecycle UI

- [ ] **Acceptance:** Show preview, explicit choices and honest integration-required states; implement family departure/closure and account/dependent controls only where coordinator proves safety.
- [ ] **Verification:** No partial mutation; accessible confirm/retry in Spanish/English; unsafe actions remain unavailable. Run focused checks and typecheck/build for affected work.

**Dependencies:** I37. **Estimated scope:** Medium, at most five substantive files; split if necessary.

**Likely paths:** `apps/customer-web/src/`, `apps/management-web/src/`, `packages/i18n/src/`, `tests/e2e/identity-lifecycle.spec.ts`.

### I39: Verification runner and regression

- [ ] **Acceptance:** Include every Identity integration test in isolated runner; finish live Chromium, concurrency and Foundation regression coverage with recorded evidence.
- [ ] **Verification:** Run typecheck/build/unit/integration/Chromium commands from plan; record failures and limitations, never skip invariants. Run focused checks and typecheck/build for affected work.

**Dependencies:** I38. **Estimated scope:** Medium, at most five substantive files; split if necessary.

**Likely paths:** `scripts/test-integration.mjs`, `playwright.config.ts`, `tests/e2e/identity-regression.spec.ts`, `tasks/identity-verification.md`.

### Checkpoint after I39

- [ ] Changed tests pass, affected builds succeed, and the completed slice is demonstrated.
- [ ] Record evidence and security/domain integration limits in `tasks/identity-verification.md`.
- [ ] Human reviews completed slice before the next group; remind user to update Graphify after meaningful changes.

### I40: Documentation and handoff

- [ ] **Acceptance:** Document bootstrap/local inbox/security configuration and unresolved production/domain integration; review approved-spec coverage and remind user graph is stale.
- [ ] **Verification:** Local links/checklist review; human review before module sign-off; PDFs unchanged and bilingual rules synchronized only if changed. Run focused checks and typecheck/build for affected work.

**Dependencies:** I39. **Estimated scope:** Medium, at most five substantive files; split if necessary.

**Likely paths:** `README.md`, `docs/identity-setup.md`, `tasks/identity-verification.md`, `tasks/identity-todo.md`, `CAPABILITY-MAP.md`.

### Final checkpoint after I40

- [ ] Human reviews specification coverage and recorded verification evidence.
- [ ] Outstanding booking, credit, scheduling and payroll integrations are explicit; no incomplete lifecycle workflow is marked production-ready.
- [ ] Remind the user to refresh Graphify. Rebuild only when authorized.
