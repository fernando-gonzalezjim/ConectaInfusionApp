# Studio Catalog implementation plan

Status: approved by the user on October 11, 2026, after specification approval. Both this plan and the checklist are approved; C01-C06 implementation is complete; C07-C09 is the next batch. No runtime changes, migrations, dependency installation, seeding or provider provisioning were performed while planning.

Module: `studio-catalog`. Work branch: `feature/studio-catalog`. Tasks: [C01-C33](studio-catalog-todo.md). Evidence: [verification ledger](studio-catalog-verification.md). Business rules: [English](../requirements/agreed-business-rules.md) / [Spanish](../requirements/agreed-business-rules.es.md). Existing Foundation and Identity plans remain in place.

## Outcome and scope

Deliver management maintenance of disciplines, reusable classes, qualified instructor assignments, schedules, capacity, media and the 16 agreed offers, together with customer discovery through the current/next-week calendar. Preserve legacy IDs, history, shared UI/i18n and server authorization.

Catalog owns versioned facts and its management operations. Payments owns monetary outcomes. Credits-bookings owns eligibility at purchase/booking time, credit issuance/renewal/expiry, family balances, availability, cancellation effects and attendance. Instructor-payroll owns earnings. The catalog must not become a payment processor or credit ledger to make demonstrations appear complete.

Local catalog functionality can be accepted independently, with downstream-dependent actions explicitly unavailable until trusted adapters exist. This is staged acceptance of the approved module, not a reduction of first-release requirements. Full acceptance of booked-session changes, notifications tied to reservations, financial lifecycle and authoritative availability requires later owning-module verification.

## Findings from graph and source inspection

- Queried the existing Graphify graph for studio/session/instructor/lifecycle/storage dependencies. The 2,221-node snapshot produced a truncated traversal; it is orientation, not completeness evidence. Confirmed relevant relationships directly in source. No refresh/rebuild occurred.
- `apps/api/src/modules/studio/repository.ts` has one legacy public overview: future sessions, mandatory instructor join, confirmed/attended booking counts and a 20-row limit. It mixes studio and cafe reads. Add explicit catalog reads rather than claiming this count is final availability or silently breaking existing consumers.
- V1 `class_sessions` contains legacy titles, instructor IDs, timestamps, duration and capacity; bookings refer to these IDs. V3 added nullable instructor/person links. V14 is currently the last migration; select the actual next version at each implementation step rather than preassigning conflicting filenames.
- Foundation settings include timezone and default capacity, but no studio maximum or delayed-effect capacity history. Its public DTO/validation must remain compatible.
- Identity exposes current-role authorization, CSRF protection, restricted profile-photo storage and transaction-bound lifecycle interfaces. Its composition remains conservative when financial coordinators are absent; a catalog adapter alone cannot unlock all lifecycle domains.
- Demo seeding has linked fictional instructors, three legacy sessions and 23 bookings. Preserve these fixtures and manual edits. Additional fixtures require stable IDs and insert-only/repeat-safe behavior, not automatic adoption of legacy records.
- Integration discovers `apps/api/test/integration/*.test.mjs` automatically, migrates a disposable database and runs live tests through `playwright.integration.config.ts`. `tests/e2e` is the controlled-browser suite, not proof of real API behavior.

## Proposed technical design

### Records and migrations

Introduce additive discipline and reusable-class tables with Spanish/English fields, publication state, persisted color, audience, optional child age bounds, guidance level and record version. Keep class duration fixed at 55 minutes for catalog-owned sessions. Add assignment records linking catalog instructors to supported disciplines; expose separately approved public instructor names/biographies/photos without copying private Identity photos automatically.

Extend existing session rows with nullable class/series links, draft/published/cancelled state, versions, capacity provenance and explicit maximum-exception provenance. Permit no instructor only for drafts. Historical and unadopted legacy rows retain their original duration/title/links and are not rewritten merely to satisfy new catalog constraints. New constraints distinguish catalog-owned records from preserved legacy history. Adoption requires explicit management mapping and a reviewed conflict report; no automatic linking by name.

Add bounded series metadata and materialized occurrences, policy revisions/effective timestamps for default/maximum capacity, ordered class media records/upload state, versioned offers and sanitized audit/change intents. Reserve Flyway versions incrementally. Rehearse fresh, repeated and populated legacy migrations. Do not reset the development database, rewrite applied SQL or alter booking ownership/status meanings.

### Authorization, audit and contracts

Reuse current session-role resolution and mutation CSRF/Origin protections. Management CRUD is administrator/manager only. Ordinary staff roles, including instructor roles, may change only class color; an allowlisted color endpoint cannot accept description/pricing/media fields. Customer access is published-data read access. An active instructor account alone does not grant catalog editing.

Export distinct public/management DTOs and additive client methods from shared packages; keep `YogaClass`/`StudioOverview` backward compatibility during migration. Add explicit record revisions for optimistic conflicts and stable pagination. Public responses exclude account IDs, emails, private media storage paths and audit internals. Mutation audit writes use the same transaction and sanitized before/after fields; cache policies must not serve draft/private data after authorization or publication changes.

Define provider-owned ports for availability and booked-session change coordination. Wire adapters at application composition rather than importing credits-bookings/payments into the catalog. Preview binds operation intent and revisions; execution rechecks authorization/current facts, applies catalog and downstream effects on one database transaction and emits durable notification intent only after a successful operation. Missing, stale or unknown downstream state blocks reservation-affecting operations. Test adapters prove contract rollback only; they are not production integration.

### Scheduling and capacity

Store UTC instants and explicit business-local scheduling intent; convert using configured business timezone. Weekly recurrence is bounded by start/end dates and selected weekdays. Show a preview before materialization, report conflicts per occurrence and avoid partial publication. Use versioned one/future edits and preserve past occurrences.

Serialize competing studio-slot operations using a stable studio lock and recheck interval conflicts inside the transaction. The exclusive interval includes the required five-minute turnaround after a 55-minute session. Draft scheduling also reserves the selected slot until explicitly moved/cancelled; new sessions cannot overlap unresolved legacy sessions. Serialize instructor assignment checks consistently. Follow [PostgreSQL locking documentation](https://www.postgresql.org/docs/current/explicit-locking.html); document lock order and test real concurrent writers.

Default/maximum reductions are effective at the next business-local midnight. Keep same-day/past capacities and explicit overrides. Preview affected future occurrences and persist effective policy revisions so sessions created after the edit use the correct date's policy. Before lowering below reservations, require explicit cancellation or preservation decisions for affected sessions; unknown downstream facts block unsafe execution. Preserve above-new-maximum capacity only through the approved existing-session exception with actor/reason/policy revision; it cannot authorize extra places beyond the preserved capacity or new-session exceptions.

Public reads accept only the current or next business-local Monday-Sunday week and return all relevant published sessions through complete bounded pagination, without the old 20-row truncation. Authoritative availability comes from its port, including replaceable complimentary attendance. When no adapter can establish availability, return an explicit unavailable state and suppress numeric/Full claims; do not manufacture remaining places from the legacy count.

### Calendar and presentation

Use `@daypilot/daypilot-lite-react`, pinned after compatibility/license checks. The [official React documentation](https://doc.daypilot.org/calendar/react/) describes Lite week views, configurable week start, CSS and custom JSX event content. Encapsulate it in a shared calendar adapter; customer drag/resizing/editing is disabled. Management uses accessible forms for 55-minute session editing, not uncontrolled resize actions.

Current week is the default, with only current/next navigation for customers. Show timezone, class label/color, instructor, session details and truthful availability. Spanish is required; English falls back to Spanish. Persist random colors once and calculate readable foreground contrast. Provide equivalent keyboard-accessible session links/list and narrow-screen layout when the seven-column widget cannot remain usable; preserve a week view rather than dropping days. The library choice does not certify accessibility.

### Photos and video

Keep catalog media storage separate from Identity private photos. Reuse existing Sharp dependency for decoded/validated JPEG/PNG/WebP photo processing, metadata stripping and display optimization. Enforce five photos, 5 MB each, selected cover/order and Spanish alternative text transactionally.

Parse YouTube URLs to approved canonical video IDs; do not fetch arbitrary remote URLs or embed user HTML. No Vimeo support is assumed. Uploaded MP4 files stream to opaque private staging IDs with backpressure and resumable upload offsets, not the global JSON parser or a whole-file memory buffer. Use authenticated upload creation/chunks/finalization with current authorization, revision/offset checks and cancellation cleanup. Serialize writes per upload, probe completed media and publish only validated assets. Separate filesystem staging/finalization state from DB state with recoverable pending/ready states; never claim filesystem writes roll back with PostgreSQL.

Propose a configured `ffprobe` executable to inspect actual MP4 container/video streams and enforce the five-minute duration limit; its [official documentation](https://ffmpeg.org/ffprobe.html) supports structured metadata output. Pin/test the executable source/version on Windows and Linux in C01. Invoke with argument arrays, local server-owned paths only, bounded process concurrency/time/output and no remote input. Define browser codec compatibility/error handling before allowing publication; do not reject a legitimate large file merely because its bytes exceed an arbitrary product threshold.

There is no product file-size or video-count cap. Display nonblocking advisories above 200 MB or three videos. Infrastructure can still fail due to disk/quota/network/process limits: report these honestly and support retry/resume; document configured limits, never disguise a 5/200 MB rejection as the approved product policy. Integration uses generated fictional fixtures and streamed upload checks; C21 must include a valid over-200 MB upload and interruption/resume evidence. No unlimited in-memory buffering, unlimited subprocess creation or arbitrary filesystem paths.

Published media is served through publication-aware routes with MP4 range support; drafts remain restricted. Removal immediately detaches it publicly and audits the change, followed by retry-safe unreferenced-file cleanup. Avoid permanent public static links that bypass draft/archive/removal state. Local filesystem storage is a development implementation, not a provisioned production/CDN service. Captions are not required; do not claim caption-based accessibility conformance for speech video.

### Offers and downstream purchase facts

Implement all 16 offers from business rules section 3.1, including 72 semester credits at 7,020 MXN. Represent percentage discounts in integer basis points, three-for-two as a separate formula, validity as 30 days or three/six calendar months, upfront allocation and explicit first-visit/returning eligibility policies. Seed draft/reference offers repeat-safely without overwriting management edits; publish through management actions.

Base-price edits automatically recalculate future displayed prices; existing quoted/accepted purchase facts must remain bound to their original version. Expose an internal revision-bound offer snapshot for consumers, not a fake checkout or purchase-success endpoint. Define exact integer minor-unit arithmetic and proposed rounding to the nearest minor unit, half upward, in C01; this is a plan choice pending approval. Credit-value apportionment, expiry anniversaries, leap-day rules, actual purchase eligibility/history and payment-confirmed issuance remain owning-module specifications.

Offer UI shows total credits/price, effective class price, expiry/renewal/eligibility, full upfront allocation and early-exhaustion reminders. No semester continuity block, attendance-gap block, monthly allocation cap or studio installments. Returning eligibility is a shared per-purchaser purchase-anniversary gate across variants; first visit is once before attendance. Single/first-visit purchases do not renew; qualifying packages renew eligible 30-day credits only; long-term credits retain fixed expiry. Catalog publishes these policy facts; only payments/credits-bookings can enforce them at purchase.

## Ordered delivery phases

| Phase | Tasks | Reviewable result |
| --- | --- | --- |
| A | C01-C03 | Technical decisions, additive persistence and authorized discipline maintenance |
| B | C04-C06 | Reusable-class maintenance, instructor qualification/public facts and public discovery |
| C | C07-C09 | Safe individual scheduling and bounded weekly recurrence |
| D | C10-C12 | Publication/archive guards, weekly API and customer calendar |
| E | C13-C15 | Effective capacity policy, management previews and truthful availability contract |
| F | C16-C18 | Reservation-sensitive change port, guarded management flows and Identity catalog coordinator |
| G | C19-C21 | Photo management, streamed MP4 storage and validation/publication-aware serving |
| H | C22-C24 | Media editor/player, bilingual/accessibility integration and cleanup recovery |
| I | C25-C27 | Exact offer calculations, versioned persistence and management offers |
| J | C28-C30 | Customer offer menu, consumer snapshots and downstream contract regression |
| K | C31-C33 | Isolated live acceptance, handoff and final scope/evidence review |

The checklist defines dependencies, acceptance, verification, likely files and fictional fixtures for each task. Implementation runs one task at a time. Tasks exceeding five substantive files must be decomposed before editing, including fixture/test/doc work; completion and Graphify counting stay at the parent task boundary. Checkpoints after every three tasks review evidence without resetting prior authorization or inserting unnecessary approval requests.

## Verification and coverage

| Specification acceptance | Planned evidence |
| --- | --- |
| 1 permissions | C03-C05, C22, C27, C31 direct API denials and real browser roles |
| 2 audiences/duration/edits | C04, C07, C16-C17; existing-booking eligibility integration remains downstream |
| 3 recurrence/instructors | C05, C08-C10 concurrency and series tests |
| 4 slots/calendar | C07-C09, C11-C12, C23 live week/timezone/keyboard scenarios |
| 5 capacity | C13-C14 transaction/revision/midnight/exception tests |
| 6 availability | C15 contract states; real replacement decision requires credits-bookings |
| 7 change coordination | C10, C16-C18, C30; final credit/payroll/recipient behavior requires owning adapters |
| 8 languages/layout | C06, C12, C22-C23, C28, C31 |
| 9 media/colors | C04, C19-C24 valid/invalid/big/interrupted uploads and publication privacy |
| 10 offer totals/history | C25-C27, C29-C30 all 16 prices and immutable snapshots |
| 11 allocation/terms | C26-C29 reminders and exported facts; actual issuance stays downstream |
| 12 eligibility/family | C26-C30 policies/consumer boundaries; purchase enforcement stays downstream |
| 13 migration/audit/demo | C02 and every mutation/fixture step, C30-C33 |

Commands available now:

```powershell
npm run typecheck
npm run build
npm test
npm run test:integration
npm run test:e2e -- --project=chromium
```

After API build, focused pure checks use `node --test apps/api/test/studio-*.test.mjs`. PostgreSQL/live tests use the isolated runner; do not run them against the demo/application database. New controlled browser files belong in `tests/e2e/studio-*.spec.ts`; real API/browser files belong in `tests/integration/studio-*.spec.ts`. Exact focused selectors are recorded when files exist; do not claim commands ran during planning. Run meaningful focused checks per change, then the full required suite at C31; broaden only for new failures/risks.

Manual demo setup follows the existing Identity guide. Per task, explicitly decide whether new fictional data is needed; extend `scripts/development-demo.mjs`, seed tests and the capability demo guide together when needed. Keep production guards, stable IDs, repeat-safe insertion, manual edits and `db:clean:demo` compatibility. Do not seed paid credits, invitations accepted on behalf of users or fabricated notification success. Use Mailpit/isolated recipients only; no real email sent under this plan.

## Risks, decisions and delivery limits

| Risk | Planned treatment |
| --- | --- |
| Legacy active sessions conflict with new rules | Explicit reconciliation, preserved IDs/history, no silent duration/identity claiming; prevent new overlap while unresolved |
| Concurrent reservations or capacity edits | Stable transaction locks, revisions, trusted consumer port and rollback; unknown state blocks sensitive changes |
| Calendar library keyboard/mobile limitations | Encapsulation, real browser inspection and equivalent accessible week/list controls; no paid Pro assumption |
| No video size cap versus bounded infrastructure | Streaming/resume, disk/process concurrency controls, honest capacity errors and over-200 MB evidence |
| Separate DB and filesystem state | Staging/finalization states, idempotent recovery and reference-aware cleanup; publication only after ready |
| Missing financial modules | Fail-closed coordination, explicit unavailable availability, staged acceptance with remaining integration checklist |
| Rounding/future price edits | Integer arithmetic, C01 rounding decision, immutable version-bound snapshots, later ledger apportionment |
| Delayed maximum changes | Effective policy history and explicit existing-session exceptions; boundary/race tests |

Before their dependent slices, C01 resolves executable/package pinning, local storage root and disk behavior, browser codec checks, base-price rounding and safe content bounds. These are technical choices within plan review, not invitations to invent business restrictions. If a choice changes approved product behavior, update the specification and both business-rule translations after user agreement.

## Tracking and approval

The specification, plan and checklist were approved October 11, 2026. No implementation tasks are marked complete. Plan approval authorizes local reversible implementation and the proposed technical approach, not production deployment, external account provisioning, commits/pushes or real notifications.

Graphify ledger remains at two completed tasks since I38 (I39/I40). The next completed implementation task C01 reaches the three-task boundary; refresh changed sources only then. Subsequent boundaries are C04, C07, C10, C13, C16, C19, C22, C25, C28 and C31, assuming no intervening implementation steps. Planning/approval edits do not increment the counter. Include new/changed docs in scheduled refreshes, preserve unchanged fragments, never perform a full rebuild or enable hooks.

Deferred precision: exact calendar/leap-day expiry and returning anniversaries, family/reserved-credit renewal scope, per-credit apportionment, restored/expired-credit cancellation effects, provider behavior and production media infrastructure. Record these in owning-module specs and handoff; do not silently resolve them in catalog runtime code.
