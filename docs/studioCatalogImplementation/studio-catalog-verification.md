# Studio Catalog verification ledger

Status: C01-C06 complete, October 11, 2026. Next batch: C07-C09. No later catalog runtime behavior is claimed.

Sources: [specification](SPEC-studio-catalog.md), [plan](studio-catalog-plan.md), [checklist](studio-catalog-todo.md).

## Planning evidence

- Inspected the existing Graphify snapshot and relevant studio repository, V1/V2/V3 schemas, migration inventory through V14, Identity lifecycle/authorization/composition, app route composition, photo processing, demo script, test runner, workspace commands and current browser configuration.
- Existing graph query was truncated and documentation paths may be stale; source and approved specification remain authoritative. No rebuild or refresh ran.
- All 16 offer prices were checked against 150 MXN and their stated discounts during requirements work. English/Spanish table values and section numbering matched; semester 72 credits is corrected to 7,020 MXN.
- Planning uses official DayPilot React, PostgreSQL locking and ffprobe documentation linked from the plan. Tool compatibility, dependency pinning and actual media processing remain C01/implementation verification, not passed checks.

## Evidence format for each completed task

Record task/sub-slice, date, changed scope, acceptance criteria, exact focused/full commands and outcomes, isolated database/browser configuration, manual observations, fictional-data assessment, repeat-seed/reset compatibility, regressions/limitations and next Graphify boundary. Do not record a blocked check as passed or a controlled browser response as real authentication/financial coordination.

## Pending runtime acceptance

The completed C01-C03 slices have evidence below; the 13 overall specification acceptance groups remain open until their remaining steps and downstream integration pass. The plan maps their future evidence to C01-C33. Add results here incrementally as implementation proceeds.

## Downstream integration acceptance remains separate

- Authoritative availability and paid replacement of complimentary attendance.
- Actual credit allocation, first-visit/returning eligibility at purchase, family sharing, payment confirmation and purchase idempotency.
- Month-end/leap-day expiry, annual anniversary precision, reserved/family-credit renewal scope and credit-value apportionment.
- Reservation-sensitive edits/cancellation and penalty-free credit effects, notification recipient resolution and actual delivery.
- Complete Identity financial lifecycle integration and instructor-payroll obligations.

These items cannot pass solely through catalog DTOs or injected test adapters. Keep them open until owning-module integration exists.

## Planning document checks

Record local link/anchor validation, task dependency ordering, C01-C33 coverage, specification acceptance mapping, untouched PDF snapshots and git diff whitespace checks after this document set is finalized. Runtime commands are not required for document-only planning.

## C01 completed: tooling and security decisions

- Read-only npm registry metadata verified DayPilot 6.1.0/license/peers/integrity; actual installation/rendering remains C12. Node 24.21.0 and React 19.3.0 detected.
- Test Engineer verified Windows installed ffprobe and exact Linux Debian probe pins in [decisions](studio-catalog-decisions.md). Disposable Linux image/package smoke used escalated Docker; container removed, no host dependency installed.
- Both probes read a generated 1,880-byte H.264 High/yuv420p MP4 as one second. Windows Chromium 153.0.8010.12 playback reached readyState 4, advanced to 0.101368 seconds, paused=false. Reproduction artifacts are ignored under `.local/studio-tooling-smoke/`. No Firefox/WebKit or DayPilot rendering claim.
- Security Auditor's binary-CSRF and authorization race findings were incorporated in the decision record. No new seed records needed.
- Commands: `npm view @daypilot/daypilot-lite-react@6.1.0 version license peerDependencies engines dist.integrity --json --offline=false`; installed ffmpeg generated fictional clip; ffprobe used `-protocol_whitelist file -show_entries format=format_name,duration:stream=codec_type,codec_name,pix_fmt,profile,duration -of json`. Linux exact package/hash details are recorded in decisions.
- C02 RED evidence prepared independently by Test Engineer: four focused PostgreSQL migration tests fail on missing catalog tables/columns/V15, proving the intended behavior is absent. No migration implemented at that RED point.

## C02 completed: additive persistence and fictional catalog

- V15 adds disciplines/classes and nullable catalog session metadata; preserves legacy session IDs/values/bookings and required legacy instructors. Reconciliation view exposes unadopted legacy rows only to authorized operators, not public HTTP.
- Test Engineer RED: four tests failed absent schema; GREEN focused `node --test --test-concurrency=1 apps/api/test/integration/studio-migrations.test.mjs`: 4/4 passed, including fresh/repeated/populated/rollback/constraint cases.
- Demo fixture RED missing catalog summary; GREEN combined discipline/demo run records repeat safety, preserved names/status/colors/custom discipline association, no session adoption and isolated full reset compatibility. Existing guarded production/remote refusal remains.
- Code Reviewer found a seed regression when a class moves discipline; root removed the immutable-association assumption and added a regression. No production or developer database seed/reset ran.

## C03 completed: authorized discipline maintenance

- Test Engineer independently wrote service/HTTP and real Spanish/English browser tests. Root added client transport RED/GREEN, actual lock-expiry and schema-awareness regressions.
- Focused service/demo checks passed, plus all affected Identity lifecycle checks (one expiry fixture initially violated V5 lifetime constraints; fixed fixture without weakening any constraint, then focused expiry passed).
- Code Reviewer fixes: preserve manually changed class discipline on reseed; truthful partial-update contract; post-render focus restoration; loading guards prevent list refresh/save races. Security fixes: recheck wall-clock session expiry after catalog lock and recognize exact V15 schema in two existing conservative Identity guards. Missing coordinators, unknown relations and legacy-obligation checks remain intact.
- Focused real API/Chromium Spanish+English journeys passed (2/2), including persisted published edits/version/audit, keyboard/cancel/focus, delayed refresh, widths 320/768/1440 and zero automated axe findings in main. Test readiness/route teardown errors were corrected; the status selector now has a distinct accessible label. Screenshots under ignored `.local/studio-disciplines-*.png` inspected visually against the existing UI. Browser smoke does not certify all accessibility criteria.
- Workspace typecheck and both production builds passed. Full workspace unit tests passed before final compatibility fixes; final command outcomes will be appended after the unchanged-code run. Full isolated suite was restarted after identifying schema-recognition regressions, without skipping tests or weakening assertions.
- Chrome DevTools MCP is not exposed in this session; actual runtime evidence comes from the repository's real Playwright/Chromium integration harness. No fake API responses were used for create/edit/persistence/audit; one deliberate delayed real GET exercises the loading race.


### C03 final checkpoint

- Fresh final `npm run typecheck`, `npm run build` and `npm test` passed after the compatibility/security fixes.
- Full `npm run test:integration` reached and passed its real-browser phase: the saved `.local/c03-integration-last-run.json` records passed with no failed tests, and both discipline screenshots were generated at the end of that run. The harness reaches that phase only after SQL/migration checks succeed. Its terminal session expired before final exit/totals could be recovered; no captured terminal exit or numerical full-suite total is claimed. Runner processes, temporary containers and ports 3001/5173/5174 were confirmed stopped afterward.
- C03 needs no additional demo records: reuse C02 draft disciplines and existing manager/denied roles. The demo guide includes the manual discipline workflow; repeat-safe seed/manual-edit/full-reset checks passed under C02.
- The controlled Identity administration fixture now supplies an empty discipline response, keeping account failure/retry assertions isolated from the new panel. Product errors and assertions remain unchanged.
- Code Reviewer and Security Auditor completed the implemented scope with their findings resolved. No dependency installation, production seed, commit/push or PDF regeneration occurred. Graphify completed-parent counter is two since C01; the next bounded changed-source refresh remains C04.

- Final controlled Chromium suite (`npm run test:e2e -- --project=chromium`): 166 passed in 29.7 seconds; persisted Playwright report passed with no failed tests. PowerShell redirection returned a nonzero wrapper status while the test report/log passed, so this evidence cites the runner results rather than claiming a captured zero shell exit.

## C04-C06 batch verification

Implementation and verification are complete; final broad results are recorded below. No later scheduling, class media, offers, bookings or financial coordination is claimed.

- C04: five actual PostgreSQL/HTTP tests pass, including strict audience/child bounds/level/55-minute validation, stored random color, published parent, bounded filtering/pagination, current staff color-only authority, field smuggling/customer denial, stale/concurrent single-winner revisions, future archive guard, reservation-history preservation and audit rollback. A parent-lock/session-expiry test reproduced a post-expiry write before the final check was added; the full focused suite then passed.
- C05: eight actual PostgreSQL instructor cases pass and verify, including explicit existing links, no private Identity adoption, current active teaching role, publication qualifications, future teaching preservation, audit rollback/concurrent revisions and role changes before transaction locking. Reviewer found the self-target exception in the shared authority helper; an explicit current-management-role check and mixed manager/instructor demotion regression resolve it.
- C05 portraits: three actual PostgreSQL/production Express cases pass. Valid PNG larger than the generic 40 KB parser succeeds via the dedicated route; invalid Origin/CSRF is denied before parsing; staff upload/preview is denied. Decoded WebP is resized and stripped of metadata. Draft privacy, current eligibility, canonical metadata, minimal security headers, immediate removal and failed-audit rollback are verified. New V16/V17 migrations are additive with no legacy adoption.
- C06: three actual PostgreSQL/HTTP cases pass: anonymous list/detail, publication parent chain, keyset limits, discipline filtering, field-level Spanish fallback, current qualified instructor facts, portrait alternative-text fallback, exact DTO privacy, generic draft/not-found replies and `no-store`.
- Client transport: two new tests pass, covering fresh session-CSRF, minimal class/public DTO projection, versions, input identifiers, malformed duration and pagination. Existing client/unit suites also pass; portrait binary validation is proven at the API/runtime boundary rather than by fake client data.
- Two real API/Chromium journeys pass in Spanish and English (exit 0): management class/instructor publication and database facts/audits, fixed duration/age/level/generated color, approved public portrait upload/render/Spanish alternative-text fallback/removal 404, customer detail fallback/privacy, staff color-only writes with preserved facts, readonly instructor review, invalid Origin and color-field smuggling denial. Keyboard focus and 320/768/1440 widths pass; main/dialog automated axe checks report no violations and no page errors. Root fixed the reproduced 320-pixel select overflow. Screenshots under ignored `.local/studio-catalog-*.png` were visually inspected. This is bounded browser evidence, not complete accessibility certification.
- Controlled tests cover create-then-page deduplication, bilingual loading/503/retry/empty/detail retry, stale selection fencing and cancel during delayed discipline refresh. A subsequent test reproduced missing choices during a pending filter; known options now remain available. Reviewer also identified delayed file-read completion after logout; portrait component lifetime cancellation and abort signals on new forms prevent a stale upload using another account's freshly fetched CSRF/session. The focused logout regression verifies no later session fetch or photo POST.
- Demo RED first exposed missing extended records; repeat-safe seed/isolated reset tests then passed. Final fixtures cover four levels, child/adult/boundless child guidance, explicit/generated colors, optional English, draft/published/archive rows, two explicitly qualified profiles and a small fictional portrait. Manual names/class moves/status/colors, removed qualifications and removed portraits survive reseeding. A late portrait-generator syntax error was caught in the broad run and corrected; the clean rerun's complete seed checks pass. No developer database migration, seed or reset was performed.
- Graphify refreshed only 12 isolated completed C02-C04 sources at the scheduled C04 boundary. Shared C05/C06 overlaps and post-refresh request-cancellation edits remain deferred to C07; frozen evidence records their snapshot limitations. No full rebuild, hooks or PDF updates occurred.

Final workspace `npm run typecheck` and `npm run build` pass after the filter/cancellation fixes. Workspace `npm test` passes. Complete controlled Chromium suite passes 172/172 (53.3 seconds, captured runner exit 0 in ignored `.local/c04-c06-controlled.exit`). Local document files/anchors, synchronized business-rule numbered sections and `git diff --check` pass; both PDF snapshots are byte-identical to HEAD. Final full-phase results are recorded below.

A final C05 regression reproduced an unchanged draft name/biography edit being blocked by future legacy teaching. The guard now targets archive, published-to-unpublished transitions and removed qualifications; metadata-only draft edits preserve session/booking facts. The eight-case focused instructor suite and the complete 192-case SQL run both passed.


### C04-C06 final checkpoint

- `npm run test:integration` completed all 192 SQL cases with 192 passed, zero failed/skipped/cancelled, including the final instructor metadata regression. Fresh migration, no-op repeat, validation and schema-info phases passed through V17. Its first complete browser phase passed 37/39; two recovery cases used a generic combobox locator that became ambiguous after adding the discipline filter. That invocation exited 1; it is not represented as a green full command.
- Updated only that test helper to locate the language dropdown by its exact accessible name. Reran the entire live-browser phase from a fresh disposable database using ignored `.local/run-c04-c06-browser-check.mjs`, which repeats migrations twice/validation/info and the unchanged repository Playwright integration configuration. All 39/39 journeys passed in 2.3 minutes; explicit runner exit 0 is retained in `.local/c04-c06-live-browser.exit`. The 192 passing SQL checks remain applicable because no runtime/SQL code changed for this selector fix. No test was skipped or weakened.
- All 172 controlled browser tests passed, with captured exit 0. Typecheck, production builds and workspace unit tests passed. Reviewer and Security Auditor findings are resolved; Test Engineer regressions verify the fixes.
- Live runner verified API and both frontend ports closed after teardown, removed disposable test containers and its guarded temporary private-photo directory. No developer/production database was seeded or reset, no commit/push occurred, and no PDF was regenerated.
- C04/C05/C06 each assessed fictional data and updated the same guarded demo entrypoint/test/guide. Repeat safety, preserved edits/removed media/qualifications, and full development reset compatibility pass in disposable tests.
- Parent tasks C01-C06 are complete. Graphify completed-step counter is two after the bounded C04 refresh; next scheduled changed-source boundary is C07. Next batch: C07-C09 (individual scheduling and bounded weekly recurrence).
