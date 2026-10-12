# Studio Catalog implementation decisions

Status: C01 completed October 11, 2026, under the approved plan. See [verification evidence](studio-catalog-verification.md).

## Verified tooling choices

- DayPilot Lite React 6.1.0, Apache-2.0, React/react-dom peers >=18. Registry metadata verified against installed React 19.3.0. Integrity: `sha512-v6ps3np3y7Bq4yD0LCiPl1j5kGaHU5NskxWRI7Aj+KOieggai30Mqgd5+3CZN3pp8w2I+kGHNkbeJFz5IEfojA==`. Install/lockfile and actual calendar rendering remain C12; no package installed now.
- Windows development ffprobe: existing Shutter Encoder `app/Library/ffprobe.exe`, build `N-121198-g56c14f2311`, SHA256 `B40DD213A4B9C4BE8D54C0CA32B915D842618EEB3694A422197D74B24249E4D5`. Companion ffmpeg SHA256 `C1F0980142D994E9A4C4E8B1DF916726EA970313FFBF06A0C693F6DD34A0195D`. Absolute executable path is configuration, not a portable hardcoded default.
- Linux development ffprobe: Debian `ffmpeg=7:5.1.9-0+deb12u1`, probe SHA256 `0e598fe6d247bfe63757f5c839dc145a166b3f876f2875ca88a306a5b8ec5a58`, tested in disposable `node@sha256:0e0ff40c39bc087845bfb27465a0df4ea419520094bc35842ff83dd8cbe6f9b6`. Both platforms probed the same generated H.264 High/yuv420p, one-second MP4 successfully. Chromium 153.0.8010.12 loaded and played it on Windows. No Firefox/WebKit or production-host claim.
- Initial MP4 compatibility: H.264 8-bit yuv420p with optional AAC audio. Verify actual MP4 signature/brand, streams and finite duration <=300 seconds; generic ffprobe MP4-family naming alone is insufficient. Unsupported codecs receive conversion guidance. No arbitrary executable/PATH/client filename or remote input.

## Security Auditor decisions

- Separate absolute private root `.local/catalog-media` for local development, never Identity photos or public static storage. Server-owned opaque IDs, exclusive writes, canonical-path/symlink checks and reference-aware cleanup.
- Streaming/resume uses bounded chunks/backpressure, persisted committed offsets/leases and bounded concurrent writers/probes. Chunk, stall and disk-reserve controls are infrastructure controls, not total product file-size limits. Above 200 MB/three videos remains advisory only.
- On interruption recover only a verified staging file to its committed offset. DB and filesystem states are separate; finalization rechecks management authorization before ready/publication. Disk exhaustion is explicit and resumable, never a fabricated product size restriction.
- Probe via fixed absolute executable with argument arrays, shell disabled, file-only protocol allowlist, local server-generated path and bounded wall time/output. Range serving is publication-aware on each request and permits only valid bounded single ranges.
- Binary chunks need catalog-specific Origin/current-session/constant-time-CSRF middleware accepting only the chosen binary content type, mounted before JSON parsing. Preserve shared Identity JSON mutation guards and narrow upload CORS headers.
- Resolve-before-write authorization is insufficient. Initial discipline operations reuse `createAccountService.withManagementRead` as the locked transaction-authorized capability boundary; despite its historical name, its callback has the authorized transaction client. No independent nested commit or pool write. Actor account/person/session locks precede catalog locks; audit shares the transaction.
- Serialize discipline mutations with a stable catalog advisory lock before row locks so later class/session publication writers can use the same guard. Strict field allowlists, revisions, bounded text and sanitized errors. Staff color-only permission never grants discipline/media/pricing writes.

## Persistence, pricing and fixtures

- Add catalog links/state to legacy sessions without adopting or changing IDs/title/duration/bookings. Only new catalog-owned sessions require 55 minutes; no-instructor state is limited to catalog drafts/cancelled drafts. Reconciliation is explicit, never name-based claiming.
- Percentage prices use integer minor units/basis points, rounded once to nearest minor unit, half upward, as proposed in the approved plan. Three-for-two uses twice the base price. Ledger apportionment remains downstream.
- C01 needs no new seed data. Generated fictional clips/reproduction script stay ignored under `.local/studio-tooling-smoke/`. No real customer media. Later fixtures cover H.264/AAC, 300/300.1 seconds, invalid/truncated/unsupported files and an opt-in genuine encoded file over 200 MB.

## Primary sources and scope

[DayPilot React](https://doc.daypilot.org/calendar/react/), [ffprobe](https://ffmpeg.org/ffprobe.html), [FFmpeg distribution sources](https://ffmpeg.org/download.html), [PostgreSQL locking](https://www.postgresql.org/docs/17/explicit-locking.html), [MDN codec guidance](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Formats/Video_codecs).

The existing Test Engineer persona supplied real platform/playback smoke evidence. The Security Auditor identified and addressed binary-CSRF and transaction-authorization design gaps. Later storage/upload/capacity/notification runtime behavior is not implemented by this decision record.

## C02-C03 compatibility follow-through

V15's exact discipline/class/reconciliation relation names are recognized by Identity composition as known schema; this does not provide a domain coordinator. Required baseline tables, declared coordinator tables, unknown relations, legacy obligations and absent domain checks remain intact. A regression proves no-coordinator blocking, explicit adapter declaration and unknown-relation rejection. C18 remains unimplemented.

Mutation authorization rechecks session wall-clock expiry after waiting for the catalog/row lock. Existing actor/session locks protect role/revocation races; they do not stop time advancing. The deterministic lock-wait test retains V5 seven-day lifetime constraints while positioning the fixture at its expiry boundary.

## C04-C06 catalog and public portrait decisions

Reusable class facts and colors are versioned and audited. Management writes require current administrator/manager authority; staff reads/color-only writes use current locked staff authority. Instructor maintenance locks actor and target account/person rows in deterministic order and rechecks the target's explicit link, active status and instructor role. Self-target maintenance still requires current management authority. Class mutation expiry is checked again after parent locks and validation, immediately before writing.

Eligibility edits affecting recorded reservations fail closed until C16 supplies the approved grandfathering/notification/cancellation coordination. This is the staged boundary already authorized in the plan; it does not change the business permission to edit those facts once coordination exists. Future archive/unpublication/qualification-removal guards preserve teaching/history.

C05 includes optional approved public portraits rather than deferring its photo requirement to class media. V16 stores explicit public profiles and discipline qualifications; V17 stores small optimized WebP portraits in a dedicated catalog table, independent of Identity photo references and files. For these bounded portraits, transactional database bytes make approval/removal and audit atomic. This technical storage choice is limited to portraits; class photos and streamed MP4 storage remain the approved later filesystem design. Input JPEG/PNG/WebP is at most 5 MB, decoded/optimized with the existing pure image encoder (16 megapixels, one frame, at most 512 pixels, metadata stripped, bounded decoding concurrency). No private storage or account photo is adopted. Spanish alternative text is required; English is optional.

Portrait JSON has a separate 7 MB parser mounted before the generic 40 KB instructor router, with Origin/session-CSRF guards before parsing. Public and management preview routes send WebP, `nosniff` and `no-store`. Public access rechecks published profile, active linked instructor account/person/current role and a published teaching discipline on each request. Removal immediately makes later public requests return 404. Metadata exposes only canonical catalog routes and alternative text; clients reject external URLs. Portrait uploads and other new forms abort on unmount; a file-read completion cannot dispatch under a newly signed-in account.

Public list/detail queries use explicit DTO columns and a single publication snapshot, with keyset pagination up to 50 rows per page and field-level Spanish fallback. Customer discovery and legacy overview stay separate. Management and public paging deduplicate inserted rows; stale reads cannot replace a newer filter/language selection. Class labels and calculated black/white foreground keep stored colors readable.

Identity recognizes only the exact new V16/V17 relation names as known schema. Missing financial coordinators, unknown tables and legacy obligation guards remain blocked; C18 is still pending.
