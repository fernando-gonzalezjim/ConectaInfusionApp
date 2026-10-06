# Identity family and dependent review

I34 reviews the approved [Identity specification](SPEC-identity.md), acceptance scenario 10 and the confirmed family/dependent decisions. It consolidates existing I24-I33 behavior; it does not add permissions, replace recipient consent, or sign off the later lifecycle module.

## Available management and consent flows

| Capability | Authority and consent | Implementation and evidence |
| --- | --- | --- |
| Create an own family | Active confirmed customer; one current family | `family-invitations.ts`, `families.ts`; family PostgreSQL and Chromium suites |
| View a customer's family for assistance | Administrator/manager only | `forAccount`, management account dialog; consolidated HTTP matrix |
| Invite family members | Current independent customer member or administrator/manager; recipient must explicitly accept with the invited confirmed account | `family-invitations.ts`, shared family/action UI; real inbox family suite |
| Offer group responsibility | Current responsible member or administrator/manager; successor must be an eligible current member and accept | `family-responsibility.ts`, shared successor UI; real inbox successor acceptance, rejection/expiry/concurrency PostgreSQL checks |
| Manage a no-login dependent | Active authorized customer guardian only; family membership or management role alone grants no profile editor | `child-details.ts`, dependent UI; consolidated HTTP matrix and real dependent suite |
| Save/reuse child details or convert to a profile | Owner only; conversion preserves the old saved record and booking snapshots | `child-details.ts`; PostgreSQL and real dependent suite |
| Help invite another guardian | Current authorized guardian or administrator/manager; recipient must accept before access | `guardian-invitations.ts`, shared guardian assistance; real inbox guardian suite |
| End guardian authority | Guardian may end their own authority; only administrator/manager may end another's; an active dependent must retain an eligible active guardian | `guardians.ts`, shared removal confirmation; permission/concurrency/rollback and real removal checks |
| Request independent login | Current authorized customer guardian only; recipient confirms invited email and sets password; no age minimum or administrative approval | `dependent-transition.ts`, shared transition UI; real inbox transition suite |
| Complete independent login | Single-use recipient link; preserves the person and historical references while ending all guardian relationships | V10/V12 invariants and transition service; competing completions, mailbox collisions, stale issuer and expiry-after-lock tests |

Opening a link or receiving `202 ACCEPTED` grants no family membership, responsibility, guardianship or independent login. Family invitations, guardian invitations and successor offers expire after seven days; independent-account links expire after 24 hours. Management assistance never accepts for the recipient. Profile/role administration is a separate permission, and family membership never implies guardian authority.

Management can select a customer's existing family or dependents, send invitations, offer successor responsibility and explicitly remove guardian access. It receives no general dependent profile editor or independent-transition control merely by being management. Customers with no group create their own family; the management assistance screen explains this instead of inventing a membership or accepting on their behalf.

## Consolidated direct API matrix

The PostgreSQL HTTP test covers eight actors: authorized guardian/responsible member, accepted family member with customer/instructor roles but no guardianship, unrelated customer, administrator, manager, reception, cafe staff and instructor. It checks family assistance/view/responsibility, dependent profile/roster/assistance, invitation issuance and independent-transition requests. It verifies that pending actions leave memberships, current responsibility, guardianship and the dependent's no-login state unchanged. Pure personnel/management accounts receive `403` for customer-only profile access; unrelated customer identities receive `404` for an inaccessible dependent. Both are denials, not equivalent access grants. The multi-role member retains customer family permissions without acquiring management or guardian permissions.

The matrix additionally checks that family closure and dependent deactivation routes are absent even for privileged actors. Individual service suites remain responsible for expiry, resend limits, exact mailbox/version binding, revoked sessions, replay, concurrent mutations and audit rollback. Consolidation does not replace those tests or weaken product rate limits; only the disposable matrix database's aggregate registration-IP test bucket is reset between actors to isolate permission assertions.

## Remaining implementation and owning-module obligations

| Obligation | Owner / planned step | Current boundary |
| --- | --- | --- |
| Transactional lifecycle preview, idempotency, stale-preview checks and unknown/legacy obligations | Identity composition, I35 | Existing internal family lifecycle contracts require a coordinator; no public departure/removal/closure endpoint |
| Self/privileged account deactivation, accepted guardian transfer and permitted joint dependent deactivation | Identity lifecycle, I36 | Preserve history; do not expose mutation until composition proves safety and the last-administrator/guardian constraints hold |
| Account/dependent reactivation with accepting prior-guardian provenance | Identity lifecycle, I37 | No automatic relationship restoration, booking resurrection or expired-credit restoration |
| Explicit lifecycle previews, confirmations and honest integration-required UI | Lifecycle UI, I38 | No fabricated success, uncoordinated family departure or independent delete action |
| Reserved credit disposition, ownership, family donation choices, expiration and two-hour cancellation | Credits/bookings module with Identity composition | Identity membership facts and booking snapshots are insufficient to implement these financial outcomes |
| Attendee/actor booking authority, staff free attendance/displacement and notifications | Scheduling/bookings | Ended guardian records are available for fresh checks; existing legacy/demo bookings do not implement customer booking decisions |
| Teaching obligations, consumed-credit instructor pay and historical payroll | Scheduling/instructor finance | Neither relationship changes nor deactivation may silently bypass these obligations |
| Full lifecycle regression and module handoff | I39-I40 | Relationship review is complete only for I24-I33 behavior; production/module sign-off remains later |

## Manual checks and data

Use [the existing fictional demo](../development-demo.md). Its family members, administrators/managers, two guardians and dependent cover this review; no new seeded identity or manufactured consent is required. Use new fictional `.test` mailbox addresses for invitations and confirm through Mailpit. Follow [family consent checks](identity-families.md) and [guardian/transition checks](identity-dependents.md). Reseeding preserves manual changes, accepted/ended relationships and independent transitions.

The bilingual business rules are unchanged. Their PDFs and the permissions-summary PDF remain on-demand snapshots. Verification results are recorded in [the Identity verification log](identity-verification.md).
