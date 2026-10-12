# Spec: Studio Catalog

Module id: `studio-catalog`. Dependency: `identity`.

Status: approved by the user on October 11, 2026. All seven interview topics and the consolidated specification are approved. The [implementation plan](studio-catalog-plan.md) and [ordered checklist](studio-catalog-todo.md) were approved by the user on October 11, 2026; C01-C06 implementation is complete; C07-C09 is the next batch. Work branch: `feature/studio-catalog`.

Sources: [approved capability map](../../CAPABILITY-MAP.md), [English business rules](../requirements/agreed-business-rules.md) / [Spanish business rules](../requirements/agreed-business-rules.es.md), [accepted Identity specification](../idntityImplementation/SPEC-identity.md), [Identity handoff](../idntityImplementation/identity-setup.md), [Foundation specification](../../SPEC-foundation.md) and [visual direction](../design/visual-direction.md).

## Objective and scope

Let Conecta Infusion management maintain the customer-facing studio catalog and schedule in the existing management frontend, and let customers discover disciplines, classes and scheduled sessions in the customer frontend. Yoga is one discipline among ballet, functional training, K-pop and others. Success means staff no longer need code changes to maintain approved class information, schedules and studio offers, while customers see the published information in Spanish and English.

This module owns disciplines, class descriptions/media, instructor catalog information/assignment, schedules, capacity and single-class/package offers. It supplies authoritative catalog facts to payments and credits-bookings. Account creation, roles and personal profiles remain Identity responsibilities. Attendance/completion, credit allocation, reservations/cancellations and instructor earnings stay outside this module.

## Confirmed requirements

- Management maintains customer-facing descriptions, photos/videos and schedules.
- Only administrators/managers may create, edit, publish or archive disciplines, class descriptions/media and scheduled sessions. Ordinary staff and instructors may view the catalog and their relevant schedules; their personal-profile permissions do not grant catalog editing rights. Staff may edit class colors only; class creation remains management-only.
- Spanish is primary; English is supported. The existing brand direction, shared UI and language conventions apply to both apps.
- Start with one business operating in Mexico/MXN. Future country/provider support does not become implemented merely by configuring a setting.
- Default class capacity is initially 16 and configurable by management. Changes affect existing future sessions except those on the change date in the studio business timezone. See the confirmed capacity decisions below.
- The current single-class price is 150 MXN, editable by authorized management.
- Only admins/managers/owners may change prices. No self-profile or instructor invitation permission grants catalog/pricing authority.
- Studio packages offer a number of class credits at a discounted value and are usable for any discipline. The entry/test offer is three classes for the price of two, not three for one.
- Offer-specific validity (ordinary/returning 30 days; longer quarterly/semester terms), qualifying renewal, original credit value and family sharing remain credits-bookings responsibilities. Catalog offers supply the purchased facts without calculating balances here. Long-term credits retain their fixed expiry; qualifying purchases renew only eligible 30-day credits.
- Staff/instructor free attendance, replacement by paying customers and notifications belong to credits-bookings. An apparently full session's catalog presentation must not bypass that module's eventual availability decision.
- Parent/dependent bookings, child name/age collection and enforcement of explicit age eligibility limits belong to credits-bookings; Studio Catalog owns the audience and eligibility facts.
- Management must resolve upcoming teaching sessions before instructor/account deactivation. Studio Catalog will need a trusted transactional contract for reassignment or explicit cancellation; financial effects cannot be invented or skipped.

## Confirmed class structure and audiences

Confirmed October 6, 2026:

- Each discipline contains reusable class definitions; each class can have scheduled sessions. For example, Ballet can contain Children's Ballet and Adult Ballet, each with its own sessions.
- Each class has a discipline, name, description, audience, level and duration. Translation and media requirements will be resolved in their own topic.
- Audience categories are children and adults only. Children's classes support minimum and maximum ages; no numeric age boundaries have been agreed.
- Explicit age eligibility limits are defined when needed; otherwise the audience is guidance. Booking enforcement belongs to credits-bookings.
- Levels are beginner, intermediate, advanced and all levels. They are guidance; no enforced prerequisites have been agreed.
- All classes and their sessions last 55 minutes. There is no per-class or per-session duration override.
- Audience, age range and level belong to the reusable class and cannot be overridden per session. Management may edit these class properties even when sessions already have reservations; a separate class is not required. Existing reservations remain valid when eligibility changes; new explicit limits apply to new bookings.

## Confirmed scheduling

Confirmed October 6, 2026:

- Support individual sessions and weekly recurrence on selected weekdays. Recurring schedules require start and end dates and produce a bounded set of sessions.
- Management can skip dates or change an individual occurrence without changing the entire series. Series edits can target one session or future sessions; past sessions are preserved. Changes affecting reservations follow the confirmed publication/change rules.
- Each session has one instructor. Unassigned drafts are allowed, but publication requires an assigned instructor.
- Management specifies the disciplines each instructor teaches; session assignments must match.
- Studio time slots are exclusive: the first class scheduled into a time slot blocks it for other classes. This refers to management scheduling, not customer reservations. No parallel teaching spaces are introduced.
- Block overlapping assignments for the same instructor, including across spaces if spaces are introduced later.
- Require five minutes between sessions in the same teaching space, allowing 55-minute classes to start hourly.
- Customers see a weekly calendar with sessions placed on their assigned days/times and can switch between the current and next calendar week, even when management has scheduled further ahead. This October 11 clarification replaces the rolling seven-day window. Booking eligibility remains governed by credit validity in credits-bookings. Weeks run Monday-Sunday; default to the current week and allow switching to next week.
- Display schedules in the configured studio business timezone, clearly identified, even when customers travel.

## Confirmed capacity

Confirmed October 6, 2026:

- Initial default capacity and studio maximum are both 16, configurable by management.
- Default-capacity changes affect already scheduled future sessions starting the next business-local day. Same-day and past sessions retain their capacities and history.
- Preserve explicit custom session-capacity overrides when the default changes, subject to the studio maximum.
- Management can change capacity for one occurrence or future occurrences in a recurring schedule; past sessions are preserved. Capacity increases after reservations are allowed and existing reservations remain valid.
- Ordinary session-capacity reductions below existing reservations are blocked until management resolves the reservations through credits-bookings; never silently cancel or displace anyone.
- If a default-capacity reduction conflicts with reservations in an affected future session, offer management a choice: explicitly cancel the session or preserve its higher capacity as a custom session override. Cancellation follows the confirmed publication/change rules; credit-expiry details and downstream contracts remain to be specified.
- The studio maximum initially is 16. Maximum reductions apply starting the next business-local day and do not change same-day sessions. Management may explicitly preserve a higher custom capacity for an existing affected session, even above the reduced maximum. This is a session-specific exception, not permission to exceed the maximum for other sessions or to add places beyond the preserved capacity.
- Show numeric remaining places only when fewer than five places are available; otherwise omit the count. Show Full when no booking is available under authoritative credits-bookings availability, including replacement of complimentary reservations.

The user confirmed the explicit existing-session exception on October 6, 2026. It supersedes the earlier unconditional hard-maximum wording; the maximum still applies to other sessions.

## Confirmed publication and changes

Confirmed October 11, 2026:

- Disciplines and reusable classes have draft, published and archived states. Customers see published content only; archives preserve history.
- Publishing a session requires a published discipline/class, an assigned instructor and valid scheduling/capacity. Management can publish a recurring series after validating every occurrence; customer visibility remains current/next calendar week.
- Published names, descriptions and media may be edited immediately with an audit record; these edits preserve reservations.
- Management may change audience, age eligibility and level even when reservations exist. This supersedes the recommendation to require a separate class. Existing reservations remain valid; new eligibility limits apply to new bookings. Notify booked attendees of audience, age-limit or level changes and allow cancellation without loss of their credit.
- Management may change a booked session's date/start time with explicit confirmation, customer notification and coordinated booking checks. Customers unable to attend may cancel without losing their credit; credit handling belongs to credits-bookings.
- Instructor replacement requires a qualified, available instructor; retain reservations and notify affected customers.
- Studio cancellation cancels reservations, releases reserved credits without penalty and notifies attendees. Whether expired credits receive extended validity remains an explicit credits-bookings decision.
- Management may cancel one occurrence or all future occurrences with confirmation showing affected sessions/reservations; preserve history.
- Block discipline/class archiving until future sessions are explicitly cancelled or moved to an appropriate published class; never silently cancel reservations.
- Notify attendees about cancellation, date/time changes, instructor replacement and relocation if locations are introduced. Description/media edits do not require notifications. Audience, age-limit and level changes also notify booked attendees and allow cancellation without loss of their credit.
- No fixed operational change/cancellation cutoff; require a reason for changes affecting booked sessions and audit the actor.

## Weekly calendar and class colors

Confirmed October 11, 2026:

- Each reusable class has a color selected at creation, or randomly generated when omitted. Store the generated color once and reuse it across the class's sessions.
- Management creates classes and may select their color at creation. Staff have limited permission to edit class colors; they cannot create classes or edit other catalog properties. Confirmed October 11, 2026.
- Use readable text contrast and class labels so information does not depend on color alone.
- Selected calendar: DayPilot Lite React. Its official [React documentation](https://doc.daypilot.org/calendar/react/) and [Lite weekly tutorial](https://code.daypilot.org/42221/react-weekly-calendar-tutorial) document week views, custom rendering and CSS customization. [React WeekView](https://github.com/yusufff/react-weekview) provides a headless hook for greater layout freedom but requires more surrounding implementation. DayPilot Lite is selected for configurable scheduling behavior with customizable presentation; verify keyboard/mobile behavior during implementation. No dependency has been installed in this requirements phase.

## Confirmed languages and media

Confirmed October 11, 2026:

- Require Spanish names/descriptions for publication. English is optional, with Spanish fallback when missing. Management supplies and reviews translations manually in the first version.
- Photos/videos belong to the reusable class and are shared across sessions.
- Management can upload JPEG, PNG and WebP photos, up to 5 MB each; optimize for display. Allow up to five photos per class, with a selected cover and management-controlled ordering.
- Support YouTube video links and uploaded MP4 files. No maximum video count: when a class has more than three videos (links and uploads combined), show an advisory that too many videos may make the class page harder to browse; do not block saving or publication. No product file-size limit: show an advisory when an MP4 exceeds 200 MB, without rejecting it for size. Uploaded videos have a five-minute duration limit. Vimeo support is not inferred. Upload architecture must accommodate large files; infrastructure limits and recovery behavior must be documented during planning rather than silently imposed as product policy.
- Neither photos nor videos are required for publication; use a branded placeholder when no cover exists.
- Require Spanish alternative text for meaningful photos; English translation is optional. Captions are not required for linked or uploaded videos, and caption upload is not required. This supersedes the earlier caption recommendation; do not claim caption-related accessibility acceptance for uncaptioned speech videos.
- Only management may add, replace, reorder or remove media. Staff color permission does not grant media permissions.
- Removing media immediately removes it from the public class page and preserves an audit record; storage cleanup belongs in the implementation plan.
- Customers see an approved instructor public display name, optional biography and optional public photo. Keep private Identity information separate.
- Published uploaded catalog photos may be accessed without login; draft media remains restricted. Management uploads only material authorized for public use. Define equivalent playback access for uploaded video during planning.

## Studio offer decisions

Confirmed October 11, 2026. Authoritative matching English/Spanish catalog tables and policies are in [business rules section 3.1](../requirements/agreed-business-rules.md#31-studio-offer-catalog) / [Spanish section 3.1](../requirements/agreed-business-rules.es.md#31-catálogo-de-ofertas-del-estudio).

- Include all 16 listed offers at launch, individually publishable and usable across disciplines: single class; ordinary 4/8/12/16/20; first visit; returning 8/12/16; quarterly 24/36/48; semester 48/72/96 total credits.
- Ordinary prices are current normal prices, not an assumed temporary opening promotion. The returning discount adds five percentage points to the corresponding ordinary discount, giving 10%/15%/17% off the undiscounted 150 MXN base for 8/12/16 credits.
- Correct arithmetic errors as requested. The semester 72-credit offer is 7,020 MXN, not 8,640; every other supplied amount matches the stated percentage.
- Quarterly/semester offers grant all credits upfront after confirmed payment, with no monthly allocation or consumption cap. Remind staff/management/instructors to explain that spending the credits early requires a new package.
- Payment is upfront. Any interest-free installments are a card/payment-provider feature, not a studio installment plan or promised provider capability.
- Ordinary, first-visit and returning credits retain 30-day validity. Quarterly credits expire three calendar months and semester credits six calendar months after payment confirmation, at the corresponding purchase-time anniversary. Month-end/timezone edge calculations belong to credits-bookings. Remind purchasers that unused quarterly/semester credits expire within their purchased term.
- Returning offers share one annual gate per purchaser across all variants: eligibility returns on the anniversary of the last returning-package purchase. There is no attendance-gap condition or January 1 reset. Semester offers have no continuous-customer restriction. First visit is once per customer who has never attended a class.
- Present available offers in a menu/chart before purchase, without a complex management approval process. Enforce agreed simple eligibility; per-purchaser eligibility does not restrict family sharing. All packages, including quarterly/semester, follow existing family-sharing rules; no additional sales quotas.
- Management maintains names/descriptions, credit counts and discounts. Percentage-based totals derive from the current single-class price and applicable discount; three-for-two follows twice that price. Base-price changes automatically recalculate prices for future purchases only, superseding the fixed-total recommendation. Display discount/effective per-class values and preserve original purchased facts.
- Offer states are draft/published/retired, with optional availability dates. Retirement stops new sales and preserves purchases/credits. Purchased price, quantity, full allocation, validity and renewal facts are immutable; later edits affect new purchases only.
- Before purchase, show total price, total credits, immediate full allocation, validity, eligibility and renewal conditions.
- Ordinary/returning and quarterly/semester package purchases renew eligible 30-day credits for 30 days. First-visit and single-class purchases do not renew existing credits. Quarterly/semester credits keep their original fixed expiry despite later purchases; never shorten or extend them through purchase renewal.

### Downstream precision and implementation boundaries

Month-end/leap-day handling, credit-ledger timestamp details, family/reserved-credit renewal scope and rounding/apportionment remain credits-bookings/payments specification work. They do not authorize new catalog policy. Preserve original per-credit values and audit facts. Define catalog price rounding before implementing base-price edits that yield fractions of a minor unit.

Credit issuance/expiry/renewal and payment processing remain downstream work, not runtime functionality implemented by this draft. No new demo fixtures or implementation-step counter changes are needed for requirements editing.

## Existing implementation and compatibility

Direct source inspection confirms a minimal studio read model, not a full managed catalog:

- [Studio repository](../../apps/api/src/modules/studio/repository.ts) exposes up to 20 future sessions through the existing public overview. It joins instructors and counts confirmed/attended bookings.
- [V1 schema](../../database/migrations/V1__initial.sql) already has instructor/session IDs, titles, timestamps, duration, capacity and historical booking references. [V3](../../database/migrations/V3__identity_accounts.sql) links domain identities to people without claiming legacy records; verify linking constraints during planning.
- [Shared contracts](../../packages/contracts/index.d.ts) use the historical `YogaClass` name despite supporting multiple disciplines. Any contract evolution must preserve consumers deliberately.
- Foundation supplies settings, business timezone, business-unit identifiers and audit infrastructure. Identity supplies server-authorized accounts/roles, private profile photos and conservative lifecycle contracts.

Preserve existing IDs and history. Use forward Flyway migrations; do not rewrite applied migrations, reset existing databases or silently claim legacy instructors. Define published/public DTOs separately from internal management records. The current overview's booking count is not the final free-attendance displacement algorithm.

## Interview topic completion

Discuss one topic at a time and present all questions for that topic together, with recommendations. This is the user-requested interview format for each remaining topic; recommendations are not agreed rules until confirmed.

1. **Permissions (confirmed):** Only management may create/edit/publish/archive catalog content and scheduled sessions. Ordinary staff/instructors have viewing access; price changes remain management-only.
2. **Class structure and audiences (confirmed):** Discipline -> reusable class -> scheduled session; children/adults, children's minimum/maximum ages, guidance versus explicit eligibility limits, four guidance levels and fixed 55-minute duration. Sessions inherit audience, age range and level.
3. **Scheduling (confirmed):** Individual sessions and bounded weekly recurrence, exceptions and one/future-session edits, one discipline-qualified instructor with unassigned drafts, exclusive first-scheduled studio slots, instructor conflict blocking, five-minute gaps, current/next calendar-week visibility and explicit business timezone.
4. **Capacity (confirmed):** Default and maximum initially 16; changes apply from the next business-local day; preserve custom overrides; support occurrence/future edits and increases; block ordinary reductions below reservations; offer explicit cancellation or preservation of higher capacity, including explicit existing-session exceptions above a reduced maximum; show counts below five and authoritative Full.
5. **Publication and changes (confirmed):** Publication/archive guards, audited edits including audience/age/level with reservations, preserved existing eligibility, coordinated rescheduling, replacement, cancellation and notifications with penalty-free cancellation for affected attendees. Class creation remains management-only; staff may edit colors. Calendar weeks run Monday-Sunday with current-week default.
6. **Languages and media (confirmed):** Required Spanish with optional manually translated English/fallback; class-owned photos (five, 5 MB each) and YouTube/MP4 video; unlimited video count with an advisory above three; no file-size limit with an advisory above 200 MB; uploaded videos limited to five minutes; no required captions; optional media, management permissions, audited removal and separate public instructor information. Identity private photo storage is not automatically a public-media solution.
7. **Studio offers (confirmed):** All 16 offers and corrected totals; full upfront allocation/payment; 30-day and three/six-calendar-month validity; shared returning purchase-anniversary gate without inactivity restrictions; unrestricted semester eligibility; menu/publication/retirement; immutable purchases; fixed long-term expiry with eligible 30-day renewal; no single-class renewal; future prices automatically follow base-price changes.

No new business rule, package amount, booking policy or publication permission is inferred from these open questions.

## Acceptance criteria for the implementation plan

These are required verification scenarios for future implementation, not claims of passing runtime checks.

1. Management can maintain discipline/class/session records; staff can edit class colors only. Direct API requests cannot bypass these boundaries or gain pricing/media rights through profile permissions.
2. Classes support children/adults, class-level age eligibility and four guidance levels; every session lasts 55 minutes. Existing bookings survive eligibility edits, while new bookings use new limits through the downstream contract. Affected attendees receive the agreed cancellation option and notification.
3. Individual and bounded weekly recurrence support exceptions and one/future edits while preserving history. Instructor assignment must match teaching disciplines; unassigned drafts cannot publish.
4. Conflicting studio slots/instructor assignments are rejected, including concurrent scheduling attempts; five-minute gaps are respected. The calendar displays business-local current/next Monday-Sunday weeks, colored class events and labels.
5. Capacity edits preserve same-day/past sessions; default changes retain custom overrides. Above-maximum existing-session exceptions require explicit management action. Ordinary reductions cannot silently displace reservations; default-change conflicts offer the agreed cancellation/preservation choices.
6. Numeric availability appears only below five. Full uses authoritative booking availability including replaceable complimentary reservations; catalog booking counts cannot bypass that decision.
7. Publication and archive guards enforce parent/instructor validity and preserve history. Booked-session changes, cancellation and replacement coordinate reservations/credits/audit/notification requirements; unfinished downstream coordination must be disclosed rather than claimed as implemented.
8. Spanish content is required and missing English falls back to Spanish. Both app languages preserve readable labels, keyboard interactions, loading/error/retry states and responsive layouts.
9. Validate five-photo/5 MB/type limits, selected cover/order and Spanish alternative text. YouTube and five-minute MP4 support must preserve restricted drafts, authorized writes and published playback. Video-count/file-size advisories are nonblocking; randomly generated class colors persist. Do not claim caption accessibility for uncaptioned speech video.
10. The initial 16 offers reproduce the verified catalog totals, including semester 72 credits at 7,020 MXN. Discounts and three-for-two recalculate from base price for future purchases; purchased facts remain immutable.
11. Offer facts express full upfront allocation, 30-day or three/six-calendar-month validity, fixed long-term expiry, qualifying renewal and reminders. Customer/staff presentation must not imply monthly allocation caps or studio installment collection.
12. Eligibility facts express first visit once before first attendance, one returning purchase per anniversary across variants, no inactivity/semester continuity restriction and per-purchaser family sharing. Purchase enforcement belongs downstream; the offer menu cannot be mistaken for completed payment or eligibility enforcement.
13. Forward migrations preserve legacy IDs/history and do not silently link legacy instructors. Audit rollback and public/private DTO separation are verified; demo data needs are assessed in each implementation step with repeat-safe seeding.

Whole-specification approval precedes the implementation plan; plan/task approval precedes runtime edits. The plan must identify catalog-only behavior, downstream-dependent behavior, evidence and demo fixtures per step. No PDF regeneration is part of this work.

## Commands and project structure

Use the existing npm workspace, Node.js/TypeScript/Express API, PostgreSQL/Flyway, React/Vite frontends, Tailwind CSS and shadcn/ui. Exact dependency changes and migrations belong in the later approved plan, not this requirements draft.

```powershell
npm run dev:demo
npm run typecheck
npm run build
npm test
npm run test:integration
npm run test:e2e -- --project=chromium
```

Demo configuration/bootstrap is described in [the Identity handoff](../idntityImplementation/identity-setup.md). No lint command is configured. Integration uses disposable PostgreSQL/Mailpit and real Chromium; it does not reset the demo database.

| Location | Responsibility |
| --- | --- |
| `apps/api/src/modules/studio/` | Existing studio reads and proposed catalog-owned backend behavior |
| `apps/management-web/src/` | Authorized catalog, schedule and offer maintenance |
| `apps/customer-web/src/` | Published catalog and schedule discovery |
| `packages/contracts`, `packages/api-client`, `packages/ui`, `packages/i18n` | Shared types, HTTP client, components and bilingual presentation |
| `database/migrations/` | Forward, history-preserving schema changes |
| `apps/api/test/`, `tests/e2e/`, `tests/integration/` | Unit, PostgreSQL/HTTP, controlled and live browser verification |
| `scripts/development-demo.mjs` | Repeat-safe fictional fixtures when implementation steps require new manual-test data |
| `docs/studioCatalogImplementation/` | This specification and future approved plan/checklist/evidence/guides |

## Code style and testing strategy

Follow existing TypeScript interfaces, parameterized PostgreSQL queries, explicit server authorization and transaction-bound audit. For example, the current repository declares its public return type:

```typescript
export async function getStudioOverview(): Promise<StudioOverview> {
  // Existing implementation reads the bounded studio and cafe overview.
}
```

The snippet illustrates the existing declaration style, not a proposed stub or replacement implementation. Write identifiers and technical documentation in English; product copy supports Spanish and English.

Provisional verification areas: direct API permission denials; safe public/private field separation; stable legacy IDs; published catalog/schedule behavior; price-change history; timezone and capacity boundaries; stale-edit/concurrent update handling; transaction/audit rollback; media validation; future lifecycle coordinator rollback; bilingual keyboard/loading/error flows and responsive interfaces. Make these concrete acceptance scenarios after the open topics are resolved. Do not invent a numeric coverage threshold or treat controlled browser responses as proof of real authentication.

## Boundaries and approval

Always preserve history, enforce permissions in the API, reuse shared packages and approved visuals, audit management changes, and synchronize English/Spanish agreed rules when confirmed decisions change. Assess demo fixtures at each implementation step and preserve guarded reset compatibility.

Clarify unresolved permissions, catalog/scheduling behavior and downstream effects before treating them as settled. Obtain specification approval before the implementation plan, and plan/task approval before code implementation. Catalog implementation is proceeding under the approved plan in three-step batches. Provider provisioning, production data changes and real notifications are outside the current batch.

Never implement payments, credits, bookings or payroll inside the catalog; disclose private Identity/audit data in public catalog DTOs; erase history during catalog cleanup; relax blocked financial coordination; or regenerate the on-demand PDFs without a request.

Graphify has a bounded changed-source refresh through C04. Shared files overlapping the current batch and later request-cancellation fixes are deferred to the next C07 boundary; current source and this approved specification remain authoritative. Snapshot relationships do not prove runtime acceptance.
