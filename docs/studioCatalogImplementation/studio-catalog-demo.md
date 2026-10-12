# Studio Catalog fictional-data guide

Status: C02-C06 fixture coverage implemented October 11, 2026; scheduling/media/offer scenarios remain planned. Existing Identity demo setup remains documented in [identity-setup.md](../idntityImplementation/identity-setup.md).

C02 adds the original draft disciplines/classes; C04-C06 extend the catalog to three disciplines, six classes and two explicit instructor public profiles. Demo Yoga/Ballet stay draft; Demo Wellness and Demo Published Yoga are explicitly published examples, alongside draft and archived classes. All four levels, adult/child audiences, optional child bounds, selected/generated persisted colors and missing English fallback are represented. Children's ages 6-12 are fictional data, not agreed defaults. A small generated lilac portrait is clearly fictional, approved only for the seeded public Yoga profile, and separate from private account photos.

No catalog-owned sessions are seeded; the three existing 60-minute legacy sessions and 23 bookings retain their IDs and values. Reseeding preserves manual class/color/discipline/publication/profile edits. Qualifications and the portrait are inserted only with a new fictional profile, so removed manual qualifications/photos stay removed. Apply migrations through V17 using the existing guarded demo migration command before seeding; no developer database migration, seed or reset was run automatically during this implementation. Verification uses disposable databases only.

Sources: [plan](studio-catalog-plan.md), [checklist](studio-catalog-todo.md), [verification ledger](studio-catalog-verification.md).

## Existing demo entrypoint

The authorized local seeding entrypoint is `scripts/development-demo.mjs`, invoked by `npm run db:seed:demo` after the existing development migration/bootstrap procedure. It uses guarded local development configuration. Preserve existing manual edits and stable IDs; do not run seeding during planning or target production.

The existing guarded full reset is `npm run db:clean:demo`; it is destructive to development data and is not needed for this planning work. Catalog fixture changes must be tested for compatibility with it in an isolated environment rather than resetting the user's manually edited demo database.

## Planned fixture coverage

| Steps | Fictional scenarios |
| --- | --- |
| C02-C04 | Disciplines, child/adult reusable classes, levels, optional English, generated/selected colors and draft/public/archive states |
| C05 | Existing explicitly linked instructors, different teaching qualifications and separate approved public facts |
| C07-C10 | Current/next-week sessions, unassigned draft, legacy conflict, bounded recurrence and one-occurrence exception |
| C11-C12 | Monday/Sunday boundary, timezone display and color readability; more-than-20 coverage belongs mainly in isolated tests |
| C13-C18 | Same-day/next-day/default/custom/exception capacity and existing reservations; missing consumers remain visibly blocked |
| C19-C24 | Generated fictional photos and small playable MP4; fourth-video/advisory and interrupted upload cases; private draft/public removal |
| C25-C29 | All 16 offer definitions, published/retired choices, price revision and reminder presentation; no fake purchases or credits |
| C30-C33 | Repeat seeding/manual-edit preservation, isolated reset compatibility and complete runnable catalog journey |

Each implementation step records whether current fixtures suffice. When extending them, update the demo entrypoint, seed regression tests and this guide in the same parent step. Add scenario helpers only if necessary; they remain reachable through the existing entrypoint. Do not silently publish/adopt arbitrary existing records, regenerate edited sessions on every seed, auto-accept consent or send notifications.

## Large media verification

Provide an opt-in documented generator for a valid MP4 above 200 MB, no longer than five minutes, when video implementation reaches C20-C21. The generated file stays ignored/local and is not recreated by routine seeding. Record upload completion, over-size advisory, interrupted transfer/resume, bounded memory and cleanup evidence. No product size rejection is allowed solely because the file exceeds 200 MB.

Tooling paths, codecs, exact generator command and storage cleanup commands are pending C01/C20-C21 implementation. Do not pretend an unimplemented generator or current Identity photo fixture covers MP4 acceptance.

## Downstream boundaries

Controlled test adapters may exercise availability/change contract states in isolated tests, with clear labels. Demo/default application composition must not return fabricated credit balances, successful checkout, authoritative availability, financial lifecycle approval or notification delivery. Mailpit/fictional local recipients are the only delivery targets authorized by the plan.

## C03 manual discipline workflow

After applying demo migrations and repeat-safe fixtures through existing guarded commands, sign in to management as the demo manager. Open Studio disciplines (Disciplinas del estudio), create or edit a draft discipline, enter Spanish name/description before publishing, and optionally add English translation. Save uses the current revision and records a transaction-bound audit event. Staff/customer accounts cannot manage disciplines. Draft class fixtures remain unpublished and the legacy overview is unchanged.

Refresh loads current saved rows without resetting entered form fields. If a concurrent edit causes a conflict, review the refreshed row by reopening its editor before saving again. Archiving or unpublishing a discipline with unresolved future catalog sessions is rejected; no bookings are cancelled by this screen. Existing demo fixtures suffice for C03, so no additional seed records are needed.

## C04-C06 manual catalog workflow

Sign in as the fictional manager and open Studio classes. Create a reusable class under a discipline, choose children or adults, optional child age bounds and one of four guidance levels. Leave color blank to generate it once or enter a hex color. Publication needs a published discipline and Spanish name/description. Duration is always 55 minutes. Refresh and reopen after revision conflicts. Eligibility edits affecting recorded reservations remain blocked until C16 supplies coordinated notifications and penalty-free cancellation; the catalog never silently invalidates bookings.

Open Instructor public information, choose an explicitly linked active instructor, enter a separate approved public name/optional biography, and select teaching disciplines. A published profile needs published qualifications. Save first, then reopen to approve a JPEG/PNG/WebP portrait up to 5 MB with Spanish alternative text. Approval/removal increments the profile revision and audits the change. Private account photos are never adopted. Public photo URLs check current publication and instructor eligibility on every request; draft preview is management-only.

Sign in as reception or an instructor to see Class colors. Only color and the current revision are sent by this form; class creation/details remain management-only. Instructors also see their own approved catalog information without edit controls.

Open the customer app's Explore our classes section, filter a published discipline, load further pages and open class details with the keyboard. Missing English names/descriptions/biographies/photo alternative text fall back to Spanish. Draft/archive rows and private Identity information stay absent. Class media uses a branded placeholder until C19 onward; scheduling and booking are separate later steps. Seeded public examples are fictional and do not represent live reservations or credit balances.
