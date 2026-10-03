# Identity implementation tasks

Status: approved by the user on October 3, 2026. Implementation branch: `feature/identity-implementation`. I01 is complete; subsequent tasks are pending. Follow [identity-plan.md](identity-plan.md) and [approved specification](../SPEC-identity.md). Preserve the existing Foundation plan and verification evidence.

Task paths are likely areas, not permission to change entire directories. Each task is Small (1–2 substantive files) or Medium (3–5); split further before coding when a slice exceeds five files. Establish actual focused test commands as files are added. API denial tests are mandatory; UI visibility alone is not authorization.

## Phase 1: Safe persistence and admin login

### I01: Resolve technical choices

- [x] **Acceptance:** Pin compatible hashing/mail/photo dependencies and local image; record password, recent-auth, upload limits and storage decisions without changing product rules.
- [x] **Verification:** Windows/Linux dependency smoke checks; review chosen limits. Run focused checks and typecheck/build for affected work. See [decisions](../docs/identity-decisions.md) and [evidence](identity-verification.md).

**Dependencies:** None. **Estimated scope:** Medium, at most five substantive files; split if necessary.

**Likely paths:** `package.json`, `apps/api/package.json`, `docs/identity-decisions.md`.

### I02: Account persistence

- [ ] **Acceptance:** Add forward migration for people/accounts/roles and explicit legacy links; preserve IDs and produce collision/reconciliation report without automatic claiming.
- [ ] **Verification:** Fresh/repeated/populated PostgreSQL migration tests. Run focused checks and typecheck/build for affected work.

**Dependencies:** I01. **Estimated scope:** Medium, at most five substantive files; split if necessary.

**Likely paths:** `database/migrations/`, `apps/api/src/modules/identity/accounts.ts`, `apps/api/test/integration/identity-accounts.test.mjs`.

### I03: Identity audit

- [ ] **Acceptance:** Permit customer actors through a forward migration; sanitized identity events use the caller transaction and retain append-only protection.
- [ ] **Verification:** Rollback, forbidden mutation and secret-exclusion integration tests. Run focused checks and typecheck/build for affected work.

**Dependencies:** I02. **Estimated scope:** Medium, at most five substantive files; split if necessary.

**Likely paths:** `database/migrations/`, `apps/api/src/modules/identity/audit.ts`, `apps/api/test/integration/identity-audit.test.mjs`.

### Checkpoint after I03

- [ ] Changed tests pass, affected builds succeed, and the completed slice is demonstrated.
- [ ] Record evidence and security/domain integration limits in `tasks/identity-verification.md`.
- [ ] Human reviews completed slice before the next group; remind user to update Graphify after meaningful changes.

### I04: Password and bootstrap

- [ ] **Acceptance:** Implement approved hashing and manual first-admin procedure; opt-in local-only testuser fixture never overwrites accounts or runs at startup.
- [ ] **Verification:** Correct/wrong password tests; reject fixtures outside development and conflicting reruns. Run focused checks and typecheck/build for affected work.

**Dependencies:** I03. **Estimated scope:** Medium, at most five substantive files; split if necessary.

**Likely paths:** `apps/api/src/modules/identity/passwords.ts`, `scripts/identity-bootstrap.mjs`, `docs/identity-bootstrap.md`, `apps/api/test/identity-passwords.test.mjs`.

### I05: Session and delivery persistence

- [ ] **Acceptance:** Migrate hashed sessions/action tokens/throttles/encrypted outbox; configure loopback Mailpit and validated env secrets.
- [ ] **Verification:** Migration constraints, invalid config and local inbox smoke checks. Run focused checks and typecheck/build for affected work.

**Dependencies:** I04. **Estimated scope:** Medium, at most five substantive files; split if necessary.

**Likely paths:** `database/migrations/`, `compose.yaml`, `.env.example`, `apps/api/src/modules/identity/config.ts`, `apps/api/test/identity-config.test.mjs`.

### I06: Login backend

- [ ] **Acceptance:** Implement opaque sessions, fixed expiry, session-version checks, logout/all-device logout and generic failures; role/status checked server-side.
- [ ] **Verification:** Expiry boundaries, revoked sessions and multi-role denial tests. Run focused checks and typecheck/build for affected work.

**Dependencies:** I05. **Estimated scope:** Medium, at most five substantive files; split if necessary.

**Likely paths:** `apps/api/src/modules/identity/sessions.ts`, `apps/api/src/modules/identity/auth-routes.ts`, `apps/api/test/integration/identity-sessions.test.mjs`.

### Checkpoint after I06

- [ ] Changed tests pass, affected builds succeed, and the completed slice is demonstrated.
- [ ] Record evidence and security/domain integration limits in `tasks/identity-verification.md`.
- [ ] Human reviews completed slice before the next group; remind user to update Graphify after meaningful changes.

### I07: Authenticated transport

- [ ] **Acceptance:** Define DTOs and client mutations; integrate exact origins, credentials and CSRF/Origin validation including anonymous auth mutations.
- [ ] **Verification:** Direct missing/foreign CSRF tests; cookie flags and safe error contract tests. Run focused checks and typecheck/build for affected work.

**Dependencies:** I06. **Estimated scope:** Medium, at most five substantive files; split if necessary.

**Likely paths:** `packages/contracts/index.d.ts`, `packages/api-client/src/index.ts`, `apps/api/src/app.ts`, `apps/api/src/modules/identity/csrf.ts`, `apps/api/test/integration/identity-transport.test.mjs`.

### I08: Customer login slice

- [ ] **Acceptance:** Provide Spanish/English sign-in, Remember me and current-account/logout flow with shared accessible components.
- [ ] **Verification:** Real local admin/customer login, keyboard and validation flows. Run focused checks and typecheck/build for affected work.

**Dependencies:** I07. **Estimated scope:** Medium, at most five substantive files; split if necessary.

**Likely paths:** `apps/customer-web/src/`, `packages/ui/src/`, `packages/i18n/src/`, `tests/e2e/identity-login.spec.ts`.

### I09: Management login slice

- [ ] **Acceptance:** Reuse shared session controls and enforce management API/UI capabilities; keep public Foundation behavior working.
- [ ] **Verification:** Both-port shared login/logout and direct non-manager API denial in real Chromium. Run focused checks and typecheck/build for affected work.

**Dependencies:** I08. **Estimated scope:** Medium, at most five substantive files; split if necessary.

**Likely paths:** `apps/management-web/src/`, `apps/api/src/modules/identity/authorization.ts`, `tests/e2e/identity-management.spec.ts`.

### Checkpoint after I09

- [ ] Changed tests pass, affected builds succeed, and the completed slice is demonstrated.
- [ ] Record evidence and security/domain integration limits in `tasks/identity-verification.md`.
- [ ] Human reviews completed slice before the next group; remind user to update Graphify after meaningful changes.

## Phase 2: Registration and account administration

### I10: Single-use action delivery

- [ ] **Acceptance:** Implement purpose/recipient/version-bound links, encrypted transactional outbox, bounded retry and scrubbing; GET never consumes.
- [ ] **Verification:** Concurrent consumption/resend, SMTP outage recovery and secret-free logs. Run focused checks and typecheck/build for affected work.

**Dependencies:** I09. **Estimated scope:** Medium, at most five substantive files; split if necessary.

**Likely paths:** `apps/api/src/modules/identity/action-tokens.ts`, `apps/api/src/modules/identity/email-outbox.ts`, `apps/api/test/integration/identity-actions.test.mjs`.

### I11: Customer registration backend

- [ ] **Acceptance:** Register customer-only accounts; confirm email on deliberate POST; apply 24-hour expiry, enumeration-safe replies and resend limits.
- [ ] **Verification:** Role injection denial; exact expiry and 60-second/5-per-hour limits. Run focused checks and typecheck/build for affected work.

**Dependencies:** I10. **Estimated scope:** Medium, at most five substantive files; split if necessary.

**Likely paths:** `apps/api/src/modules/identity/registration.ts`, `apps/api/src/modules/identity/auth-routes.ts`, `apps/api/test/integration/identity-registration.test.mjs`.

### I12: Registration UI

- [ ] **Acceptance:** Expose bilingual registration/confirmation/resend with pending-state explanations and retry.
- [ ] **Verification:** Real inbox confirmation flow; expired/used link and keyboard checks. Run focused checks and typecheck/build for affected work.

**Dependencies:** I11. **Estimated scope:** Medium, at most five substantive files; split if necessary.

**Likely paths:** `apps/customer-web/src/`, `packages/i18n/src/`, `tests/e2e/identity-registration.spec.ts`.

### Checkpoint after I12

- [ ] Changed tests pass, affected builds succeed, and the completed slice is demonstrated.
- [ ] Record evidence and security/domain integration limits in `tasks/identity-verification.md`.
- [ ] Human reviews completed slice before the next group; remind user to update Graphify after meaningful changes.

### I13: Recovery backend

- [ ] **Acceptance:** Implement one-hour password reset, generic public responses and all-session revocation; inactive accounts remain inactive.
- [ ] **Verification:** Concurrent reuse denied; expiry boundary and disabled-account recovery tests. Run focused checks and typecheck/build for affected work.

**Dependencies:** I12. **Estimated scope:** Medium, at most five substantive files; split if necessary.

**Likely paths:** `apps/api/src/modules/identity/recovery.ts`, `apps/api/src/modules/identity/auth-routes.ts`, `apps/api/test/integration/identity-recovery.test.mjs`.

### I14: Recovery UI

- [ ] **Acceptance:** Provide recovery/password setup pages without login-token leakage or arbitrary redirects.
- [ ] **Verification:** Real inbox reset; both-frontends prior sessions stop working. Run focused checks and typecheck/build for affected work.

**Dependencies:** I13. **Estimated scope:** Medium, at most five substantive files; split if necessary.

**Likely paths:** `packages/ui/src/`, `apps/customer-web/src/`, `apps/management-web/src/`, `packages/i18n/src/`, `tests/e2e/identity-recovery.spec.ts`.

### I15: Customer invitations backend

- [ ] **Acceptance:** Allow all specified staff/instructors to send customer-only invitations; only privileged accounts may waive confirmation, with secure password setup and provenance.
- [ ] **Verification:** Actor matrix, missing email, forged exemption/role and consumed setup tests. Run focused checks and typecheck/build for affected work.

**Dependencies:** I14. **Estimated scope:** Medium, at most five substantive files; split if necessary.

**Likely paths:** `apps/api/src/modules/identity/account-invitations.ts`, `apps/api/src/modules/identity/account-routes.ts`, `apps/api/test/integration/identity-invitations.test.mjs`.

### Checkpoint after I15

- [ ] Changed tests pass, affected builds succeed, and the completed slice is demonstrated.
- [ ] Record evidence and security/domain integration limits in `tasks/identity-verification.md`.
- [ ] Human reviews completed slice before the next group; remind user to update Graphify after meaningful changes.

### I16: Invitation UI

- [ ] **Acceptance:** Offer permitted creation controls and confirmation/setup landing flow; ordinary inviters cannot inspect/edit private customer records.
- [ ] **Verification:** Staff/instructor invite flow and management exemption flow in both languages. Run focused checks and typecheck/build for affected work.

**Dependencies:** I15. **Estimated scope:** Medium, at most five substantive files; split if necessary.

**Likely paths:** `apps/management-web/src/`, `packages/ui/src/`, `packages/i18n/src/`, `tests/e2e/identity-invitations.spec.ts`.

### I17: Account administration backend

- [ ] **Acceptance:** Implement privileged personnel/customer listing and edits with field allowlists; own-profile writes never promote privileges.
- [ ] **Verification:** Full actor/target matrix and direct IDOR/mass-assignment tests. Run focused checks and typecheck/build for affected work.

**Dependencies:** I16. **Estimated scope:** Medium, at most five substantive files; split if necessary.

**Likely paths:** `apps/api/src/modules/identity/account-routes.ts`, `apps/api/src/modules/identity/accounts.ts`, `apps/api/test/integration/identity-permissions.test.mjs`.

### I18: Role administration

- [ ] **Acceptance:** Apply privileged role assignments, revoke sessions and serialize last-active-admin checks; expose future free-booking eligibility hooks.
- [ ] **Verification:** Two concurrent admin removals leave one; self-demotion and customer-role preservation tests. Run focused checks and typecheck/build for affected work.

**Dependencies:** I17. **Estimated scope:** Medium, at most five substantive files; split if necessary.

**Likely paths:** `apps/api/src/modules/identity/roles.ts`, `apps/api/src/modules/identity/account-routes.ts`, `apps/api/test/integration/identity-roles.test.mjs`.

### Checkpoint after I18

- [ ] Changed tests pass, affected builds succeed, and the completed slice is demonstrated.
- [ ] Record evidence and security/domain integration limits in `tasks/identity-verification.md`.
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
