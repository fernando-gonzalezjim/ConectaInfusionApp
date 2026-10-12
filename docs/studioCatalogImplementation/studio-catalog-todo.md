# Studio Catalog implementation checklist

Status: approved by the user on October 11, 2026, together with the [plan](studio-catalog-plan.md). The [specification](SPEC-studio-catalog.md) is also approved. C01-C06 are complete. The next approved batch is C07-C09. Evidence goes in [the verification ledger](studio-catalog-verification.md).

Each task is a focused parent step. Likely paths are impact areas, not permission to edit entire directories. Scope is Medium (3-5 substantive files) per sub-slice; Small tasks have 1-2. If runtime, tests, contracts, fixtures and documentation exceed five files, write numbered sub-slices before editing and finish the complete parent before advancing. Required seed/test/guide work belongs to the same parent; it is never dropped to satisfy the size target. Sub-slices do not advance Graphify separately.

For every task: preserve transaction audit, server authorization, bilingual rules and applied migrations; run relevant focused checks/typecheck/build and inspect real browser flows where applicable. Record evidence and demo assessment without claiming blocked or unrun tests passed. No production seed or real messages.

## Batch execution agreement

The user authorized implementation October 11, 2026 using the existing personas as needed, in batches of three parent steps; an oversized parent may run alone. C04-C06 batch completed; next batch: C07-C09. No automatic commit/push or production action is requested.

Before editing, C02 is split into C02a migration/tests/reconciliation (three files), C02b demo helper/entrypoint/tests/guide (four files). C03 is split into C03a1 contracts/authorized callback context, C03a2 service/route/app/tests (four files), C03b1 client transport/tests, C03b2 UI/App/i18n wiring (three files), C03c real browser evidence/review/docs. C03d is the compatibility follow-through: exact V15 schema recognition in Identity composition plus regression tests, preserving all lifecycle guards. Parent completion requires all sub-slices; Graphify counts parents only.

## C01: Resolve implementation decisions

- [x] **Acceptance:** Document compatible DayPilot/ffprobe versions, local storage/upload recovery, browser codecs, integer rounding and verification commands. Record dependency choices without installing them prematurely or adding product caps.
- [x] **Verification:** Official-doc/Windows/Linux smoke evidence for selected tooling; review rounding and resource-failure behavior.
- [x] **Demo assessment:** No new seeded records. Identify reusable generated image/video fixtures; no real media or provider setup. If fixtures change, update the entrypoint, seed tests and [demo guide](studio-catalog-demo.md) within this parent step.

**Dependencies:** None. **Scope:** Small/Medium; split before editing if over five substantive files including fixtures. **Likely paths:** `docs/studioCatalogImplementation/studio-catalog-decisions.md`, `apps/api/test/studio-dependencies.test.mjs`.

## C02: Add catalog persistence

- [x] **Acceptance:** Add forward discipline/class/session metadata migration, preserving V1 IDs, titles, durations and bookings. Catalog-owned drafts can lack instructors; legacy adoption is explicit and reported.
- [x] **Verification:** Fresh/repeated/populated migration tests, foreign keys, constraint/rollback and legacy reconciliation checks in isolated PostgreSQL.
- [x] **Demo assessment:** Add fictional discipline/class references through the demo entrypoint and seed tests; leave existing legacy sessions unadopted until explicit action. If fixtures change, update the entrypoint, seed tests and [demo guide](studio-catalog-demo.md) within this parent step.

**Dependencies:** C01. **Scope:** Medium; split before editing if over five substantive files including fixtures. **Likely paths:** `database/migrations/`, `apps/api/test/integration/studio-migrations.test.mjs`, `docs/studioCatalogImplementation/studio-catalog-legacy.md`.

## C03: Maintain disciplines

- [x] **Acceptance:** Deliver management discipline CRUD with draft/published/archive states, versions and transaction audit. Deny ordinary staff/customer writes; archiving cannot bypass future-session guards.
- [x] **Verification:** Authorized/denied HTTP, stale revision and audit rollback tests; management create/edit browser flow.
- [x] **Demo assessment:** Reuse C02 disciplines/roles; add no new fixtures unless empty/state scenarios cannot be reproduced with current data. If fixtures change, update the entrypoint, seed tests and [demo guide](studio-catalog-demo.md) within this parent step.

**Dependencies:** C02. **Scope:** Medium; split before editing if over five substantive files including fixtures. **Likely paths:** `apps/api/src/modules/studio/discipline-routes.ts`, `apps/api/src/modules/studio/disciplines.ts`, `apps/management-web/src/studio/disciplines.tsx`, `packages/api-client/src/studio.ts`, `apps/api/test/integration/studio-disciplines.test.mjs`.

### Checkpoint after C03

- [x] Focused verification and affected builds pass; manual/runtime evidence and unresolved integration states are recorded.
- [x] Parent tasks' fictional fixtures remain repeat-safe and full-reset compatible; no manual edits are overwritten.
- [x] Review completed scope against the approved specification; continue within existing authorization unless a material decision needs clarification.

## C04-C06 execution slices

C04a: backend validation/authority/routes and integration tests; C04b: shared DTO/client transport and tests; C04c: management form and bilingual presentation; C04d: demo seed/test/guide plus changed-source Graphify boundary. C05a: additive instructor catalog migration/service/routes and integration tests; C05b: shared transport and management/own-instructor forms; C05c: repeat-safe explicit fictional qualifications/public facts and documentation; C05d: approved portrait migration/service/router/integration tests; C05e: portrait transport, approval UI, public metadata and runtime verification. C06a: publication-aware public list/detail reads and tests; C06b: public transport/customer discovery; C06c: real browser verification, review, documentation and final batch checks. Each sub-slice remains focused; parent steps count once only.

## C04: Maintain reusable classes

- [x] **Acceptance:** Deliver bilingual class CRUD, audience/child bounds/levels/fixed duration and stored class colors. Staff color-only writes reject extra fields; generation persists once and foreground text stays readable.
- [x] **Verification:** Field validation, repeat/stale writes, color-only API denial and management form checks; current booking-sensitive edits remain guarded.
- [x] **Demo assessment:** Extend seed with child/adult classes, four levels, missing English and explicit/generated colors; preserve edits and seed tests/docs in sub-slices. If fixtures change, update the entrypoint, seed tests and [demo guide](studio-catalog-demo.md) within this parent step.

**Dependencies:** C03. **Scope:** Medium; split before editing if over five substantive files including fixtures. **Likely paths:** `apps/api/src/modules/studio/classes.ts`, `apps/api/src/modules/studio/class-routes.ts`, `apps/management-web/src/studio/classes.tsx`, `packages/contracts/index.d.ts`, `apps/api/test/integration/studio-classes.test.mjs`.

## C05: Maintain instructor catalog facts

- [x] **Acceptance:** Allow management to assign instructor teaching disciplines and approved public name/biography/photo metadata. No private profile/photo adoption or silent legacy linking; inactive/unqualified instructors cannot publish teaching assignments.
- [x] **Verification:** Qualification/current-role denials, public/private separation and explicit legacy-link tests; instructor-read browser scenario.
- [x] **Demo assessment:** Extend fictional existing instructors with explicit catalog qualifications/public facts, retaining their IDs and manual profile edits. If fixtures change, update the entrypoint, seed tests and [demo guide](studio-catalog-demo.md) within this parent step.

**Dependencies:** C04. **Scope:** Medium; split before editing if over five substantive files including fixtures. **Likely paths:** `apps/api/src/modules/studio/instructors.ts`, `apps/api/src/modules/studio/instructor-routes.ts`, `apps/management-web/src/studio/instructors.tsx`, `apps/api/test/integration/studio-instructors.test.mjs`.

## C06: Expose published class discovery

- [x] **Acceptance:** Add public class/discipline detail/list DTOs and customer discovery with Spanish fallback, sanitized approved instructor facts and private drafts omitted.
- [x] **Verification:** Public filter/pagination/private-field tests and loading/empty/error/retry in both languages.
- [x] **Demo assessment:** Reuse classes; add draft/archive versus published examples only if absent. Publication must be explicit in fixtures. If fixtures change, update the entrypoint, seed tests and [demo guide](studio-catalog-demo.md) within this parent step.

**Dependencies:** C04, C05. **Scope:** Medium; split before editing if over five substantive files including fixtures. **Likely paths:** `apps/api/src/modules/studio/public-routes.ts`, `apps/api/src/modules/studio/public-read.ts`, `apps/customer-web/src/studio/catalog.tsx`, `packages/api-client/src/studio.ts`, `tests/integration/studio-catalog.spec.ts`.

### Checkpoint after C06

- [x] Focused verification and affected builds pass; manual/runtime evidence and unresolved integration states are recorded.
- [x] Parent tasks' fictional fixtures remain repeat-safe and full-reset compatible; no manual edits are overwritten.
- [x] Review completed scope against the approved specification; continue within existing authorization unless a material decision needs clarification.

## C07: Schedule individual sessions

- [ ] **Acceptance:** Create/edit management draft sessions with 55-minute duration, instructor qualification, studio exclusivity and five-minute gaps. Lock/recheck inside transaction; preserve legacy conflicts and IDs.
- [ ] **Verification:** Concurrent insert/move conflict barriers, boundary gaps, stale edits and instructor denial; individual scheduling browser flow.
- [ ] **Demo assessment:** Add repeat-safe current/next-week sessions and a visible legacy conflict; do not shift existing manual sessions on reseed. If fixtures change, update the entrypoint, seed tests and [demo guide](studio-catalog-demo.md) within this parent step.

**Dependencies:** C04, C05. **Scope:** Medium; split before editing if over five substantive files including fixtures. **Likely paths:** `apps/api/src/modules/studio/sessions.ts`, `apps/api/src/modules/studio/session-routes.ts`, `apps/management-web/src/studio/sessions.tsx`, `apps/api/test/integration/studio-sessions.test.mjs`.

## C08: Preview bounded weekly recurrence

- [ ] **Acceptance:** Implement business-timezone recurrence preview with selected weekdays/start/end dates and per-occurrence conflicts, keeping UTC/local intent clear and avoiding persistence before confirmation.
- [ ] **Verification:** Date/weekday boundaries and DST-zone cases; reject unbounded requests; preview empty/conflicting series without writes.
- [ ] **Demo assessment:** Reuse C07 sessions; recurrence preview needs no persisted new series. If fixtures change, update the entrypoint, seed tests and [demo guide](studio-catalog-demo.md) within this parent step.

**Dependencies:** C07. **Scope:** Medium; split before editing if over five substantive files including fixtures. **Likely paths:** `apps/api/src/modules/studio/recurrence.ts`, `apps/api/src/modules/studio/series-routes.ts`, `apps/management-web/src/studio/series-preview.tsx`, `apps/api/test/studio-recurrence.test.mjs`.

## C09: Apply recurrence and exceptions

- [ ] **Acceptance:** Materialize confirmed bounded series atomically; skip/move one or future occurrences with version checks. Preserve past sessions; booked changes defer to the change port.
- [ ] **Verification:** Partial failure rollback, concurrent slot claims, retries, series end and one/future/past boundaries.
- [ ] **Demo assessment:** Add stable future series/exception fixtures without repeatedly generating new occurrences or changing manual exceptions. If fixtures change, update the entrypoint, seed tests and [demo guide](studio-catalog-demo.md) within this parent step.

**Dependencies:** C08. **Scope:** Medium; split before editing if over five substantive files including fixtures. **Likely paths:** `apps/api/src/modules/studio/series.ts`, `apps/api/src/modules/studio/series-routes.ts`, `apps/management-web/src/studio/series-editor.tsx`, `apps/api/test/integration/studio-series.test.mjs`.

### Checkpoint after C09

- [ ] Focused verification and affected builds pass; manual/runtime evidence and unresolved integration states are recorded.
- [ ] Parent tasks' fictional fixtures remain repeat-safe and full-reset compatible; no manual edits are overwritten.
- [ ] Review completed scope against the approved specification; continue within existing authorization unless a material decision needs clarification.

## C10: Enforce publication and archive guards

- [ ] **Acceptance:** Publish individual/validated series only with published parents, instructor and valid capacity; archive only after future sessions are resolved. Keep reservations/history and fail closed when downstream state is unknown.
- [ ] **Verification:** Publication/partial-series rollback, unassigned drafts, archive denials and safe no-reservation cancellation.
- [ ] **Demo assessment:** Add unassigned/conflicting/published scenarios only where existing fixtures lack these states; never cancel seed bookings silently. If fixtures change, update the entrypoint, seed tests and [demo guide](studio-catalog-demo.md) within this parent step.

**Dependencies:** C06, C09. **Scope:** Medium; split before editing if over five substantive files including fixtures. **Likely paths:** `apps/api/src/modules/studio/publication.ts`, `apps/api/src/modules/studio/publication-routes.ts`, `apps/management-web/src/studio/publication.tsx`, `apps/api/test/integration/studio-publication.test.mjs`.

## C11: Read current and next calendar weeks

- [ ] **Acceptance:** Add server-bound current/next Monday-Sunday reads with business timezone and complete pagination. Public DTOs preserve compatibility and exclude drafts; no inherited 20-session truncation.
- [ ] **Verification:** Monday/Sunday/midnight and timezone cases; more than 20 sessions; reject outside-window reads; legacy overview regression.
- [ ] **Demo assessment:** Generate more-than-20 sessions in isolated tests; extend demo with week-boundary examples only, avoiding excessive seed data. If fixtures change, update the entrypoint, seed tests and [demo guide](studio-catalog-demo.md) within this parent step.

**Dependencies:** C10. **Scope:** Medium; split before editing if over five substantive files including fixtures. **Likely paths:** `apps/api/src/modules/studio/week-read.ts`, `apps/api/src/modules/studio/public-routes.ts`, `packages/contracts/index.d.ts`, `packages/api-client/src/studio.ts`, `apps/api/test/integration/studio-week.test.mjs`.

## C12: Render the customer weekly calendar

- [ ] **Acceptance:** Pin/install DayPilot Lite in the customer workspace and wrap it with current/next navigation, readable class colors/timezone/details. Disable customer moves/resizing and provide keyboard-accessible session links.
- [ ] **Verification:** Real browser current-week default, next/week bound, event duration/time mapping, keyboard/error/retry and 360/768/1440 viewports.
- [ ] **Demo assessment:** Reuse week/color fixtures; assess rather than automatically expand seeds. If fixtures change, update the entrypoint, seed tests and [demo guide](studio-catalog-demo.md) within this parent step.

**Dependencies:** C11. **Scope:** Medium; split before editing if over five substantive files including fixtures. **Likely paths:** `apps/customer-web/package.json`, `package-lock.json`, `apps/customer-web/src/studio/week-calendar.tsx`, `apps/customer-web/src/studio/week-calendar.css`, `tests/integration/studio-calendar.spec.ts`.

### Checkpoint after C12

- [ ] Focused verification and affected builds pass; manual/runtime evidence and unresolved integration states are recorded.
- [ ] Parent tasks' fictional fixtures remain repeat-safe and full-reset compatible; no manual edits are overwritten.
- [ ] Review completed scope against the approved specification; continue within existing authorization unless a material decision needs clarification.

## C13: Apply effective capacity policy

- [ ] **Acceptance:** Persist default/maximum policy versions effective next studio-local day, retaining same-day/past/custom capacities and explicit grandfathered exceptions. All affected-session writes are locked and revision-bound.
- [ ] **Verification:** Midnight/new-session boundary, retained overrides, concurrent policy edits and explicit-exception provenance tests.
- [ ] **Demo assessment:** Add same-day/next-day/custom session cases without overwriting existing settings; any policy fixture requires opt-in and repeat-safe preservation. If fixtures change, update the entrypoint, seed tests and [demo guide](studio-catalog-demo.md) within this parent step.

**Dependencies:** C07. **Scope:** Medium; split before editing if over five substantive files including fixtures. **Likely paths:** `database/migrations/`, `apps/api/src/modules/studio/capacity.ts`, `apps/api/test/integration/studio-capacity.test.mjs`, `packages/contracts/index.d.ts`.

## C14: Preview management capacity changes

- [ ] **Acceptance:** Present affected occurrences and cancellation/preserve-higher-capacity choices with actor/reason. Block ordinary below-reservation reductions and unresolved downstream changes; exceptions cannot create extra places.
- [ ] **Verification:** Preview/revision tampering, concurrent reservation-provider tests, exception limits and management form review.
- [ ] **Demo assessment:** Reuse existing booked fixtures; add full/below-reservation examples if needed, but no fictional paid-credit issuance. If fixtures change, update the entrypoint, seed tests and [demo guide](studio-catalog-demo.md) within this parent step.

**Dependencies:** C13. **Scope:** Medium; split before editing if over five substantive files including fixtures. **Likely paths:** `apps/api/src/modules/studio/capacity-routes.ts`, `apps/management-web/src/studio/capacity.tsx`, `packages/api-client/src/studio.ts`, `tests/integration/studio-capacity.spec.ts`.

## C15: Define authoritative availability integration

- [ ] **Acceptance:** Export a provider port for booking availability and explicit unavailable state. Only authoritative remaining counts below five and Full are rendered; replacement of complimentary reservations remains downstream.
- [ ] **Verification:** Adapter absent/unknown/zero/one/four/five and replaceable-full cases; client cannot infer final availability from booking counts.
- [ ] **Demo assessment:** Controlled adapters exercise numeric cases; demo default honestly shows unavailable until an owning adapter is installed. No fake production adapter. If fixtures change, update the entrypoint, seed tests and [demo guide](studio-catalog-demo.md) within this parent step.

**Dependencies:** C11, C14. **Scope:** Medium; split before editing if over five substantive files including fixtures. **Likely paths:** `apps/api/src/modules/studio/availability.ts`, `apps/api/src/modules/studio/week-read.ts`, `apps/customer-web/src/studio/session-availability.tsx`, `apps/api/test/studio-availability.test.mjs`.

### Checkpoint after C15

- [ ] Focused verification and affected builds pass; manual/runtime evidence and unresolved integration states are recorded.
- [ ] Parent tasks' fictional fixtures remain repeat-safe and full-reset compatible; no manual edits are overwritten.
- [ ] Review completed scope against the approved specification; continue within existing authorization unless a material decision needs clarification.

## C16: Define transaction-bound session changes

- [ ] **Acceptance:** Implement catalog preview/apply contract for reservation-sensitive reschedule/cancel/eligibility edits with idempotency and version binding. Export durable notification intent; no remote effects inside transaction.
- [ ] **Verification:** Stale preview, replay, injected consumer failure, audit/outbox rollback and absent-adapter denials; test double evidence explicitly labeled.
- [ ] **Demo assessment:** Use isolated fictional bookings/adapters for contract evidence; preserve production composition's integration-required behavior. If fixtures change, update the entrypoint, seed tests and [demo guide](studio-catalog-demo.md) within this parent step.

**Dependencies:** C10, C14. **Scope:** Medium; split before editing if over five substantive files including fixtures. **Likely paths:** `apps/api/src/modules/studio/change-coordination.ts`, `apps/api/src/modules/studio/changes.ts`, `apps/api/test/integration/studio-changes.test.mjs`, `docs/studioCatalogImplementation/studio-catalog-contracts.md`.

## C17: Deliver guarded management changes

- [ ] **Acceptance:** Expose explicit-confirmation changes/replacements/cancellation with reason and affected-session counts. Preserve existing attendee eligibility and provide penalty-free cancellation facts via the port; retain history.
- [ ] **Verification:** Direct route denial, qualified replacement, confirmation/retry conflicts and real browser integration-required feedback.
- [ ] **Demo assessment:** Add no-booking editable session if missing; booked demo actions must truthfully remain blocked without downstream coordination. If fixtures change, update the entrypoint, seed tests and [demo guide](studio-catalog-demo.md) within this parent step.

**Dependencies:** C16. **Scope:** Medium; split before editing if over five substantive files including fixtures. **Likely paths:** `apps/api/src/modules/studio/change-routes.ts`, `apps/management-web/src/studio/session-changes.tsx`, `packages/api-client/src/studio.ts`, `tests/integration/studio-changes.spec.ts`.

## C18: Provide the Identity catalog coordinator

- [ ] **Acceptance:** Implement the existing Identity lifecycle provider for studio obligations on the caller's transaction. Require upcoming teaching resolution; default composition still blocks missing credit/payroll domains.
- [ ] **Verification:** Identity preview/replay/rollback, legacy/unknown obligation and instructor-role/deactivation regression; catalog alone does not unlock financial actions.
- [ ] **Demo assessment:** Reuse instructor upcoming sessions and existing Identity fixtures; no automatic reassignment or deactivation in seeding. If fixtures change, update the entrypoint, seed tests and [demo guide](studio-catalog-demo.md) within this parent step.

**Dependencies:** C16. **Scope:** Medium; split before editing if over five substantive files including fixtures. **Likely paths:** `apps/api/src/modules/studio/identity-coordinator.ts`, `apps/api/src/composition/identity-lifecycle.ts`, `apps/api/test/integration/studio-identity-lifecycle.test.mjs`, `docs/studioCatalogImplementation/studio-catalog-contracts.md`.

### Checkpoint after C18

- [ ] Focused verification and affected builds pass; manual/runtime evidence and unresolved integration states are recorded.
- [ ] Parent tasks' fictional fixtures remain repeat-safe and full-reset compatible; no manual edits are overwritten.
- [ ] Review completed scope against the approved specification; continue within existing authorization unless a material decision needs clarification.

## C19: Manage class photos

- [ ] **Acceptance:** Add separate catalog photo records/storage and management API for validated five-photo/5 MB JPEG/PNG/WebP, alt text, cover/order and publication-aware reads. Recover filesystem/DB failures separately.
- [ ] **Verification:** Content spoofing, pixel/size/count/concurrent reorder limits, role denials, private drafts and remove-before-cleanup checks.
- [ ] **Demo assessment:** Add generated fictional catalog images through demo entrypoint/tests/guide in sub-slices; preserve Identity private fixtures. If fixtures change, update the entrypoint, seed tests and [demo guide](studio-catalog-demo.md) within this parent step.

**Dependencies:** C04. **Scope:** Medium; split before editing if over five substantive files including fixtures. **Likely paths:** `apps/api/src/modules/studio/photos.ts`, `apps/api/src/modules/studio/photo-routes.ts`, `database/migrations/`, `apps/api/test/integration/studio-photos.test.mjs`.

## C20: Stream resumable MP4 uploads

- [ ] **Acceptance:** Implement opaque authenticated upload sessions, offset-checked streamed chunks, interruption/resume and staging/finalization state. No whole-file buffering or product size cap; disk failures are explicit.
- [ ] **Verification:** Offset/replay/concurrent-write/path/role denial tests, disconnect/restart recovery and bounded memory during streaming.
- [ ] **Demo assessment:** Generate reusable local MP4 fixtures on demand; do not seed or regenerate large files automatically. If fixtures change, update the entrypoint, seed tests and [demo guide](studio-catalog-demo.md) within this parent step.

**Dependencies:** C01, C19. **Scope:** Medium; split before editing if over five substantive files including fixtures. **Likely paths:** `apps/api/src/modules/studio/video-uploads.ts`, `apps/api/src/modules/studio/video-upload-routes.ts`, `database/migrations/`, `apps/api/test/integration/studio-video-uploads.test.mjs`.

## C21: Validate and serve MP4 media

- [ ] **Acceptance:** Probe true MP4/container/duration with configured ffprobe; reject duration above five minutes and unsupported playback explicitly. Ready assets use publication-aware range reads and safe subprocess/path controls.
- [ ] **Verification:** Valid/invalid/duration/range/draft tests; record a valid over-200 MB upload plus interrupt/resume, memory/disk behavior and advisories without size rejection.
- [ ] **Demo assessment:** Add a small generated playable MP4 fixture and generation instructions; big fixture is opt-in verification only, never repository content. If fixtures change, update the entrypoint, seed tests and [demo guide](studio-catalog-demo.md) within this parent step.

**Dependencies:** C20. **Scope:** Medium; split before editing if over five substantive files including fixtures. **Likely paths:** `apps/api/src/modules/studio/videos.ts`, `apps/api/src/modules/studio/media-routes.ts`, `apps/api/test/integration/studio-videos.test.mjs`, `docs/studioCatalogImplementation/studio-catalog-media.md`.

### Checkpoint after C21

- [ ] Focused verification and affected builds pass; manual/runtime evidence and unresolved integration states are recorded.
- [ ] Parent tasks' fictional fixtures remain repeat-safe and full-reset compatible; no manual edits are overwritten.
- [ ] Review completed scope against the approved specification; continue within existing authorization unless a material decision needs clarification.

## C22: Build the class media editor

- [ ] **Acceptance:** Management can upload/order/cover/remove photos, add YouTube IDs and stream MP4 with progress/resume. More than three videos or 200 MB shows advisory only; staff cannot mutate media.
- [ ] **Verification:** Real role/API browser uploads, cancel/retry/remove/order and advisory checks; no arbitrary embed HTML/URL fetching.
- [ ] **Demo assessment:** Reuse generated image/video fixtures; add fourth-video scenario via manual demo steps or isolated tests, preserving unlimited-count policy. If fixtures change, update the entrypoint, seed tests and [demo guide](studio-catalog-demo.md) within this parent step.

**Dependencies:** C19, C21. **Scope:** Medium; split before editing if over five substantive files including fixtures. **Likely paths:** `apps/management-web/src/studio/media-editor.tsx`, `packages/api-client/src/studio-media.ts`, `apps/api/src/modules/studio/youtube.ts`, `tests/integration/studio-media.spec.ts`.

## C23: Integrate customer class presentation

- [ ] **Acceptance:** Display optional media/placeholder/public instructor facts with Spanish fallback and readable bilingual labels; ensure keyboard/media controls and week view remain usable across widths. No caption-conformance claim.
- [ ] **Verification:** Live public/draft/media removal, language switch, keyboard/focus/contrast and automated axe checks; network retry must preserve state.
- [ ] **Demo assessment:** Reuse published/draft/missing-English fixtures; add no new records unless display states are missing. If fixtures change, update the entrypoint, seed tests and [demo guide](studio-catalog-demo.md) within this parent step.

**Dependencies:** C06, C12, C22. **Scope:** Medium; split before editing if over five substantive files including fixtures. **Likely paths:** `apps/customer-web/src/studio/class-detail.tsx`, `apps/customer-web/src/studio/week-calendar.tsx`, `packages/i18n/src/messages.ts`, `tests/integration/studio-presentation.spec.ts`.

## C24: Recover detached media and notification intent

- [ ] **Acceptance:** Add idempotent unreferenced-media/staging cleanup and durable catalog notification-intent handoff. Reuse existing SMTP only through reviewed composition for known recipients; never claim missing downstream recipient delivery.
- [ ] **Verification:** Crash/retry/referenced-file protection, published removal and intent deduplication; Mailpit only when trusted test recipient adapter exists.
- [ ] **Demo assessment:** No real messages; interrupted uploads/notification intents are isolated test fixtures, not automatic demo side effects. If fixtures change, update the entrypoint, seed tests and [demo guide](studio-catalog-demo.md) within this parent step.

**Dependencies:** C16, C21. **Scope:** Medium; split before editing if over five substantive files including fixtures. **Likely paths:** `apps/api/src/modules/studio/media-cleanup.ts`, `apps/api/src/modules/studio/change-delivery.ts`, `apps/api/test/integration/studio-recovery.test.mjs`, `docs/studioCatalogImplementation/studio-catalog-media.md`.

### Checkpoint after C24

- [ ] Focused verification and affected builds pass; manual/runtime evidence and unresolved integration states are recorded.
- [ ] Parent tasks' fictional fixtures remain repeat-safe and full-reset compatible; no manual edits are overwritten.
- [ ] Review completed scope against the approved specification; continue within existing authorization unless a material decision needs clarification.

## C25: Calculate exact offer prices

- [ ] **Acceptance:** Implement integer minor-unit/basis-point pricing and three-for-two with the approved rounding decision. Verify all 16 initial totals and return calculated effective-price/discount facts.
- [ ] **Verification:** Pure all-offer arithmetic, future base changes, rounding/overflow/input cases; 72 semester credits must total 7,020 MXN.
- [ ] **Demo assessment:** No new database fixtures; arithmetic vectors are isolated tests. If fixtures change, update the entrypoint, seed tests and [demo guide](studio-catalog-demo.md) within this parent step.

**Dependencies:** C01. **Scope:** Medium; split before editing if over five substantive files including fixtures. **Likely paths:** `apps/api/src/modules/studio/offer-pricing.ts`, `apps/api/test/studio-offer-pricing.test.mjs`, `docs/studioCatalogImplementation/studio-catalog-decisions.md`.

## C26: Persist versioned offer policies

- [ ] **Acceptance:** Add offers/revisions/availability dates/validity and eligibility/renewal flags for full upfront credits. No credits ledger; preserve immutable consumer snapshots and historical revisions.
- [ ] **Verification:** Fresh/populated migrations, revision immutability, published-date boundaries and base-price concurrency.
- [ ] **Demo assessment:** Add all 16 reference/draft offers to repeat-safe demo seed without overwriting prices/publication changes; test full-reset compatibility. If fixtures change, update the entrypoint, seed tests and [demo guide](studio-catalog-demo.md) within this parent step.

**Dependencies:** C25. **Scope:** Medium; split before editing if over five substantive files including fixtures. **Likely paths:** `database/migrations/`, `apps/api/src/modules/studio/offers.ts`, `apps/api/test/integration/studio-offers.test.mjs`, `packages/contracts/index.d.ts`.

## C27: Maintain offers in management

- [ ] **Acceptance:** Management creates/edits/publishes/retires offers and single-class base price; future totals recalculate transactionally while historical facts remain unchanged. Staff/pricing denial is server-enforced.
- [ ] **Verification:** Base-price/revision races, retirement/date behavior, audit rollback, all-offer UI and direct API role denials.
- [ ] **Demo assessment:** Reuse C26 reference offers; do not republish or restore manager-edited prices on reseed. If fixtures change, update the entrypoint, seed tests and [demo guide](studio-catalog-demo.md) within this parent step.

**Dependencies:** C26. **Scope:** Medium; split before editing if over five substantive files including fixtures. **Likely paths:** `apps/api/src/modules/studio/offer-routes.ts`, `apps/management-web/src/studio/offers.tsx`, `packages/api-client/src/studio.ts`, `tests/integration/studio-offers.spec.ts`.

### Checkpoint after C27

- [ ] Focused verification and affected builds pass; manual/runtime evidence and unresolved integration states are recorded.
- [ ] Parent tasks' fictional fixtures remain repeat-safe and full-reset compatible; no manual edits are overwritten.
- [ ] Review completed scope against the approved specification; continue within existing authorization unless a material decision needs clarification.

## C28: Show the customer offer menu

- [ ] **Acceptance:** Present available offers with price/credits, upfront allocation, expiry, eligibility/renewal and early-exhaustion reminders. No semester continuity restriction or studio installment claim; no fake purchase completion.
- [ ] **Verification:** Both languages, correct prices/terms/retirement filters and responsive keyboard browsing; unavailable checkout is truthful.
- [ ] **Demo assessment:** Reuse published offer choices; instructions explicitly distinguish menu discovery from payment. If fixtures change, update the entrypoint, seed tests and [demo guide](studio-catalog-demo.md) within this parent step.

**Dependencies:** C27. **Scope:** Medium; split before editing if over five substantive files including fixtures. **Likely paths:** `apps/customer-web/src/studio/offers.tsx`, `packages/i18n/src/messages.ts`, `tests/integration/studio-offer-menu.spec.ts`.

## C29: Export immutable purchase facts

- [ ] **Acceptance:** Provide trusted consumer snapshot/revision and offer-policy contract for payments/credits-bookings. Identify purchaser eligibility as unknown without owning history; never accept client price or credit allocation.
- [ ] **Verification:** Snapshot tampering/stale-version tests and retained old price/expiry policy after base edits; no public fake payment endpoint.
- [ ] **Demo assessment:** Use isolated consumer fixtures; do not issue credits or purchase records in catalog demo. If fixtures change, update the entrypoint, seed tests and [demo guide](studio-catalog-demo.md) within this parent step.

**Dependencies:** C26, C28. **Scope:** Medium; split before editing if over five substantive files including fixtures. **Likely paths:** `apps/api/src/modules/studio/purchase-facts.ts`, `apps/api/test/studio-purchase-facts.test.mjs`, `docs/studioCatalogImplementation/studio-catalog-contracts.md`.

## C30: Verify consumer and compatibility boundaries

- [ ] **Acceptance:** Regression-test contract rollback/unknown states, legacy overview/IDs and public-private separation. Record which acceptance criteria still need real booking/payment/payroll adapters.
- [ ] **Verification:** PostgreSQL transaction/barrier tests, injected errors and original Identity/Foundation regressions; mocks labeled and missing providers stay blocked.
- [ ] **Demo assessment:** Reuse legacy/demo fixtures and ensure seed repeat/full-reset tests cover all catalog additions. If fixtures change, update the entrypoint, seed tests and [demo guide](studio-catalog-demo.md) within this parent step.

**Dependencies:** C15, C18, C24, C29. **Scope:** Medium; split before editing if over five substantive files including fixtures. **Likely paths:** `apps/api/test/integration/studio-contracts.test.mjs`, `apps/api/test/integration/studio-compatibility.test.mjs`, `docs/studioCatalogImplementation/studio-catalog-verification.md`.

### Checkpoint after C30

- [ ] Focused verification and affected builds pass; manual/runtime evidence and unresolved integration states are recorded.
- [ ] Parent tasks' fictional fixtures remain repeat-safe and full-reset compatible; no manual edits are overwritten.
- [ ] Review completed scope against the approved specification; continue within existing authorization unless a material decision needs clarification.

## C31: Run isolated live acceptance

- [ ] **Acceptance:** Run complete required suites and real API/browser journeys for management/staff/customer, media, calendar, prices and guards. Record manual keyboard/contrast/mobile/large-upload evidence and unresolved integration limits.
- [ ] **Verification:** npm run typecheck; npm run build; npm test; npm run test:integration; npm run test:e2e -- --project=chromium. Investigate failures; never weaken checks.
- [ ] **Demo assessment:** Verify current demo supports every manual catalog journey and preserves manually edited data across reseed; no runtime production seed. If fixtures change, update the entrypoint, seed tests and [demo guide](studio-catalog-demo.md) within this parent step.

**Dependencies:** C23, C28, C30. **Scope:** Medium; split before editing if over five substantive files including fixtures. **Likely paths:** `tests/integration/studio-acceptance.spec.ts`, `tests/e2e/studio-states.spec.ts`, `scripts/test-integration.mjs`, `docs/studioCatalogImplementation/studio-catalog-verification.md`.

## C32: Write setup and downstream handoff

- [ ] **Acceptance:** Document actual migrations/storage/ffprobe/upload recovery commands, fictional demo paths, verified/deferred acceptance and consumer integration instructions. Update project navigation without moving prior artifacts/PDFs.
- [ ] **Verification:** Local link/command review, clean setup rehearsal where safe and evidence mapping; no rerun of unchanged suites without cause.
- [ ] **Demo assessment:** No new fixtures unless setup reveals a missing manual state; document opt-in large-file generation and guarded reset. If fixtures change, update the entrypoint, seed tests and [demo guide](studio-catalog-demo.md) within this parent step.

**Dependencies:** C31. **Scope:** Medium; split before editing if over five substantive files including fixtures. **Likely paths:** `docs/studioCatalogImplementation/studio-catalog-setup.md`, `docs/studioCatalogImplementation/studio-catalog-demo.md`, `README.md`, `CAPABILITY-MAP.md`, `docs/studioCatalogImplementation/studio-catalog-verification.md`.

## C33: Present scope and acceptance evidence

- [ ] **Acceptance:** Present runnable catalog, passed evidence and exact downstream/production limits for human review. Do not claim complete booking, payments, instructor payroll or caption accessibility.
- [ ] **Verification:** Review all 13 acceptance mappings and remaining integration checklist; confirm PDFs/history unchanged and Graphify ledger accurate.
- [ ] **Demo assessment:** No new data; distinguish implemented catalog fixtures from hypothetical financial workflows. If fixtures change, update the entrypoint, seed tests and [demo guide](studio-catalog-demo.md) within this parent step.

**Dependencies:** C32. **Scope:** Medium; split before editing if over five substantive files including fixtures. **Likely paths:** `docs/studioCatalogImplementation/studio-catalog-todo.md`, `docs/studioCatalogImplementation/studio-catalog-verification.md`, `tasks/graphify-refresh.md`.

### Checkpoint after C33

- [ ] Focused verification and affected builds pass; manual/runtime evidence and unresolved integration states are recorded.
- [ ] Parent tasks' fictional fixtures remain repeat-safe and full-reset compatible; no manual edits are overwritten.
- [ ] Review completed scope against the approved specification; continue within existing authorization unless a material decision needs clarification.

## Final acceptance gates

- [ ] Catalog-only criteria have real persistence/API/browser evidence; contract doubles are separately identified.
- [ ] Downstream-required criteria remain open until credits-bookings/payments/payroll adapters and notification recipient/delivery behavior are verified.
- [ ] Production media/provider configuration is not presented as deployed or provisioned.
- [ ] PDFs are untouched; both business-rule languages match; local links work.
- [ ] Human review of the runnable scope/evidence is recorded without marking missing integrations complete.

