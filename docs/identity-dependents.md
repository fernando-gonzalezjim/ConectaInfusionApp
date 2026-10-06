# Dependent persistence, backend and screens (I28-I31)



[V10](../database/migrations/V10__identity_dependents.sql) adds Identity-owned persistence for the approved [dependent and guardian rules](../SPEC-identity.md). It creates no real profiles, accounts, fabricated emails, invitations or bookings. Existing people, accounts, families and booking rows retain their identifiers and history. Profile endpoints are implemented in I29 and customer screens in I30; invitation consent is I31, guardian removal is I32, independent transition is I33, and account/dependent lifecycle coordination comes later.



## Identity and authorization records



`dependent_profiles.person_id` points to the same `people` identity used for the attendee. The person's name, locale and active/inactive state stay in `people`; `age_text` is a bounded free-text value, without a new minimum-age policy or a fabricated date of birth. The profile records its creating parent account, creation time and version. It has no email, password or login. Deferred state checks reject any account for a dependent until the independent transition is completed atomically with verified credentials and all guardian authorizations ended. Transition records retain the same person/profile and historical relationships. Pending transition requests must not create a login account early.



`dependent_guardians` records each authorization separately from family membership. Multiple current guardians are supported, with one current relationship per guardian/profile pair. The initial parent relationship has creation provenance; later relationships identify the invitation and accepting guardian. I31 verifies and consumes the intended guardian's live token before inserting an accepted relationship. A family relationship, pending token or historical guardian row never substitutes for current guardian authorization. No pending-invitation relationships are created by I28.



Guardian identity, acceptance, source and authorization time are immutable. Ending a relationship adds an end time/reason; ended rows cannot be rewritten, reopened, deleted or truncated. Profiles preserve creator identity and creation time; changes increment their version. A current active dependent must have at least one current guardian whose account and person are active, whose confirmation is verified/exempt and who retains the customer role. Deferred checks cover profile/guardian changes and account, person and role eligibility changes. A parent profile lock serializes guardian changes; concurrent removals cannot commit an active orphan. I32/I36 still need authoritative permission checks, canonical lock order and domain coordination, rather than relying on a database constraint to authorize an operation.



## Prior-guardian provenance



When `people.status` changes from active to inactive for a dependent, a status trigger locks its profile and samples time after the lock. It increments `deactivation_sequence` and records a `dependent_deactivations` entry and its `dependent_prior_guardians` set from the current authorizations immediately before the change. Guardians removed earlier are excluded. Only that nested status-trigger operation may insert snapshot/provenance rows; later direct additions are rejected, including backdated new guardian relationships. Snapshots cannot be updated, deleted or truncated, and ending a relationship cannot backdate its end before an existing snapshot.



The caller must update the dependent person's status directly within its transaction **before** ending the final guardian authorizations. The same transaction may then end those authorizations and append the actor/reason audit; failures roll everything back. Do not invoke this update indirectly from another trigger or use an uncoordinated deactivation route. This persistence mechanism does not authorize deactivation or cancel bookings. Those operations remain unavailable until the approved lifecycle/credits coordinator exists.



I37 must use the latest deactivation sequence, require a still-active guardian from that captured set to accept renewed authorization, and require management to reactivate. An unrelated guardian or somebody removed before deactivation cannot qualify through an older relationship. The snapshot is historical evidence, not renewed access; reactivation eligibility and consent remain later service work. Snapshot records do not restore credits, bookings, login, family membership or guardian access automatically.



## Reusable child details and attendance history



`saved_child_details` belongs to the booking customer's account and stores bounded `child_name`/`age_text` fields without requiring a dependent profile. Its optional profile link can be added once during conversion and cannot later be replaced or removed. Owner identity and creation time stay fixed; editable details increment the version. Creating a saved detail does not create a login, confer guardianship or allocate family credits.



Nullable fields on legacy `bookings` reserve separate `acting_account_id`, optional `attendee_person_id`, optional `saved_child_details_id`, and child name/age snapshots. New child snapshots require an acting account and both child fields. A saved-detail reference must belong to that acting account. Once a booking exists, these identity/snapshot fields cannot change, including changing all-null legacy fields into a claimed identity. Child snapshot bookings cannot be deleted; truncation is rejected when any such booking exists. Status changes remain possible. Later edits to reusable details do not rewrite attendance. A saved-detail-to-profile link preserves the route from earlier booking history to the same child identity while retaining the original booking-time text and nullable attendee snapshot.



The legacy required `member_id` and uniqueness rule remain intact. This does **not** implement child booking routes or resolve the future credits-bookings model; no child is inserted into legacy `members` with an invented email. The booking domain must check actual guardian authority, attendee/session eligibility, capacity, financial obligations and cancellation rules when it implements both approved booking paths. Database identity references alone do not authorize booking or reveal a child's profile.



The migration follows PostgreSQL's [deferred constraint-trigger semantics](https://www.postgresql.org/docs/17/sql-createtrigger.html) so related records can be created or changed together without committing invalid state. Existing migration checksums remain unchanged.



## Fictional development checks



The guarded [demo script](../scripts/development-demo.mjs) adds one no-login **Demo Dependent Child**, with `customer.profile` as initial parent and `customer01` as an additional guardian, plus two reusable child-detail records. The second is **Demo Saved Child**, owned by `customer18`, without a profile. Additional guardian acceptance is clearly synthetic fixture provenance; no email, invitation/token, child booking or financial mutation is generated. The fixture is not a real-user consent bypass.



After migrating the local development database, run `npm run db:seed:demo`. Inspect `dependent_profiles`, `dependent_guardians` and `saved_child_details` through your local database tool; use the customer dependent screens described below. Reseeding preserves manual child name/age edits, conversions, inactive/independent states and ended guardian history, and does not restore access. The guarded full reset remains compatible and is tested only against a disposable database. See [the development guide](development-demo.md).



The [persistence tests](../apps/api/test/integration/identity-dependents.test.mjs) verify multiple guardians, no fabricated login/member emails, provenance protection, concurrent last-guardian changes, deactivation snapshots, retrospective manufacture denial, reusable detail ownership/conversion, immutable booking snapshots and additive/repeated/failed migrations. I29 tests verify the service permission matrix; booking/financial integrations remain future work.



## Private profile and saved-detail endpoints (I29)



Both `/api/v1/dependents` and `/api/v1/child-details` require an active confirmed account with the customer role and a live session cookie. A staff member or instructor with customer access uses the same parent permissions. GET responses disable caching. POST requires an allowed Origin and the session CSRF header before parsing a JSON body limited to 2 KiB. No personal details are exposed through the public Foundation routes.



| Method/path (relative to `/api/v1`) | Input | Access/result |

| --- | --- | --- |

| GET `/dependents` | Optional `limit` (1–50), UUID `cursor` | Current guardian's active profiles, bounded page |

| GET `/dependents/:id` | Profile UUID | Current authorized guardian only |

| POST `/dependents` | `fullName`, `ageText`, optional `preferredLocale` | Creates a no-login profile and initial guardian relationship for the caller |

| POST `/dependents/:id` | `fullName`, `ageText`, `expectedVersion`, optional `preferredLocale` | Current guardian edits with optimistic concurrency |

| GET `/child-details` | Optional `limit` (1–50), UUID `cursor` | Owner's reusable details, bounded page |

| GET `/child-details/:id` | Saved-detail UUID | Owner only |

| POST `/child-details` | `childName`, `ageText` | Saves reusable details without creating a profile |

| POST `/child-details/:id` | `childName`, `ageText`, `expectedVersion` | Owner edits reusable details |

| POST `/child-details/:id/convert` | `expectedVersion` | Owner converts once, becoming the initial guardian |



Names are trimmed and bounded to 120 characters; age text to 40. Control characters, unsupported locales, unknown fields and invalid versions are rejected. Missing/inaccessible records return the same `NOT_FOUND`; stale versions and repeat conversion return `CONFLICT`. Profiles expose only their identifier, name, age text, locale, version and current guardian identifiers/names. Saved details expose only their identifier, child name, age text, optional profile link and version. Neither exposes emails, credentials or invitation tokens.



Family membership and management roles do not grant child profile access. Management assistance with guardian invitations is I31, not a shortcut around current guardianship. Ending authorization removes subsequent profile access. Saved-detail ownership alone never grants access to a linked dependent profile. Editing linked saved details changes that reusable record only; it does not change the profile or earlier bookings.



Conversion locks the owner and saved detail, creates the person/profile/initial guardian, and links the saved record in one audited transaction. Concurrent conversions have one winner; an audit failure rolls back the entire operation. Earlier booking actor and attendee snapshots stay unchanged. The link provides the route from earlier history to the new profile; conversion neither creates an account nor books a class. Audit history identifies actor, action, target and reference/version changes, with child names and ages excluded from audit projections. Its action labels are available in Spanish and English.



For manual API checks, start `npm run dev:demo` and sign in as `customer.profile` or `customer01` to inspect the seeded dependent; another family member has no access unless actually authorized as a guardian. `customer18` owns the unconverted saved child. Use the browser's existing authenticated API session and CSRF header to test the operations above. Capture current versions before writes. I30 adds the customer screens described below. These existing I28 fixtures cover I29, so no new seed identities or manufactured consent are needed. Reseeding preserves manual conversions and edits.



The [backend integration tests](../apps/api/test/integration/identity-child-details.test.mjs) cover unrelated family-member/manager denial, multiple accepted guardians, ended authorization, bounded pagination, ownership, concurrent conversion, historical booking snapshots, atomic audit rollback, private HTTP guards, input limits and revoked sessions. Guardian invitations/removal, independent login, deactivation/reactivation and booking/payment integration remain later approved steps.



## Customer screens (I30)



The signed-in customer account area now offers **Children and dependents** / **Menores y dependientes**. Staff and instructors with the customer role use this same customer screen for their own authorized children; their personnel roles grant no additional guardian access. The management app does not acquire a child profile editor merely through management permissions.



The dialog separates **Saved child details** from **Dependent profiles**. Both load only the current account's authorized records in pages of ten. Failed reads remain unknown and expose a refresh action instead of treating failure as an empty list. Empty states explain what can be created. Each record shows child name and age text; profiles additionally list the current authorized guardians by name, without their emails. Pagination and refresh avoid unbounded fetching.



Save reusable name/age details without creating a profile. Edit those saved details later; a linked record explains that its edit does not alter the dependent profile or earlier bookings. An unlinked record offers **Convert to profile**, followed by an explicit confirmation explaining that the caller becomes the initial guardian and no login is created. Linked records cannot offer a second conversion. The profiles list also offers direct creation, profile name/age/locale editing and the current guardian list. Forms send only approved fields and the loaded version, while the server remains the authority for access and conflicts.



Conflicting versions require a fresh read. A missing/inaccessible record clears the displayed record and requires refresh. Authentication or customer-access loss clears the private dialog and account state. Reads and writes are aborted on unmount; obsolete reads cannot replace a newer page. Pending writes disable other mutations and dialog dismissal. An uncertain outcome is never retried automatically: refresh and inspect the records before deciding on another action. No contact, password, guardian invitation/removal, independent-login, deletion or booking control is added by I30.



### Manual checks with the existing demo data



1. Run `npm run dev:demo` after the existing migration/seed setup. Sign in on the customer app with `customer.profile@demo.conecta.example.test` or `customer01@demo.conecta.example.test`, using the demo password from [the development guide](development-demo.md). Open **Menores y dependientes**, then **Perfiles de dependientes**. Both are current guardians of **Demo Dependent Child**, and both names appear.

2. Edit the profile name/age and select its profile language. Close/reopen or refresh to verify persistence. Another family member without guardian authorization should not see it. Management access alone does not grant this screen access to another person's child.

3. Sign in as `customer18@demo.conecta.example.test`. Open **Children and dependents** and inspect **Demo Saved Child**. Edit its reusable details, then choose **Convert to profile**. Review and confirm before creation; the profile appears under **Dependent profiles** and the saved record remains linked.

4. Create a separate saved detail or a direct profile to test both paths. Toggle the app language to review Spanish and English labels; child names and age text remain user-entered data. Check keyboard navigation, focus return, paging and refresh. A stale edit from another guardian should return a conflict and require refresh.

5. Rerun `npm run db:seed:demo` only if desired: it preserves manual child edits, conversions, ended authorizations and inactive states. Existing I28 fixtures cover all I30 paths, so the step creates no extra seed identities or manufactured consent.



### Design and verification boundaries



The screen uses existing shared dialogs, buttons, inputs, focus styles and approved brand tokens. Its primary action follows the active list: save details or create a profile. Lists remain single-column, with wrapped action labels and a scrollable modal on narrow viewports. Required states are loading, unknown/error, empty, paginated, editing, explicit conversion confirmation, pending, conflict, uncertain write and access loss. Do not add booking buttons before the booking capability exists or infer guardian permissions from family membership.



Read cancellation follows [React's effect cleanup guidance](https://react.dev/reference/react/useEffect); the shared modal uses the project's [Radix dialog behavior](https://www.radix-ui.com/primitives/docs/components/dialog) for focus containment and dismissal. Chrome DevTools MCP is unavailable in this session, so runtime verification uses the existing Playwright Chromium suites and axe checks. The [controlled browser tests](../tests/e2e/identity-dependents.spec.ts) exercise both languages, mobile/desktop layout, multiple guardians, creation/conversion/editing, conflict, access loss, pagination and error recovery. The [live tests](../tests/integration/identity-dependents.spec.ts) verify browser-to-PostgreSQL conversion and edits, no child login, audit privacy and unchanged historical booking actor/attendee snapshots. Final results are recorded in [Identity verification](../tasks/identity-verification.md).


## Guardian invitation consent (I31)

[V11](../database/migrations/V11__identity_guardian_invitations.sql) adds pending invitation records. Opening or reviewing a link grants no profile access. The intended confirmed customer explicitly accepts; the same transaction consumes the token, records acceptance, creates the guardian relationship and appends safe audit references. Failure rolls everything back. Acceptance grants no personnel role, family membership, credits, child login or booking.

| Method/path (relative to `/api/v1/dependents`) | Input | Access/result |
| --- | --- | --- |
| POST `/:id/guardian-invitations` | `email` only | Current guardian or administrator/manager; opaque `202 ACCEPTED` |
| POST `/guardian-invitations/preview` | `token` only | Intended confirmed customer; child ID/name and expiry only |
| POST `/guardian-invitations/accept` | `token` only | Intended recipient's single-use consent; returns `dependentId` |
| GET `/guardian-invitations/for-account/:accountId` | Optional `limit` (1-50), UUID `cursor` | Administrator/manager assistance: IDs/names of this eligible customer's active dependents only |

Writes retain Origin/session/CSRF checks before bounded JSON parsing. Management assistance exposes only child names needed to select an invitation target; it grants neither age/profile-editor access nor the guardian roster. Management cannot accept for somebody else. Staff/instructors with customer access use ordinary guardian permissions. Family membership alone grants neither issuance nor acceptance rights.

Links last seven days, measured after the send lock. Resending invalidates the prior link, requires 60 seconds and allows five sends per hour per recipient/purpose. A generic receipt never claims email delivery or consent. Ineligible recipients and existing guardians receive the same receipt; an unknown mailbox may receive a link but must register, confirm and sign in with that address. Issuance never creates an account. Email contains no child name/age. Tokens remain in encrypted delivery payloads and transient action-page memory; fragments/query strings are stripped before rendering, without automatic preview/redemption.

Issuer authority, confirmation/status/session version, known recipient mailbox/account version and the dependent's active status/deactivation sequence remain live checks. Ending issuer guardianship or management authority invalidates the link. Old-cycle links cannot restore access after reactivation. Delivery suppresses obsolete links; acceptance rechecks expiry after blocking locks and before commit. Role/session/account changes may require a fresh invitation. Child profile edits alone do not invalidate consent.

The database binds new accepted-invitation guardian rows to accepted invitations, consumed tokens, dependents and accepting accounts. Existing V10 rows remain unchanged with immutable `pre_v11` exceptions, recording legacy provenance rather than proof of email consent. Synthetic demo/test relationships require explicit `development_fixture` exceptions, restricted to allowlisted local development/disposable database names. The guarded seed rejects production/remote targets. No HTTP writer exposes exceptions. SQL/migration credentials remain privileged. Reseeding never manufactures real acceptance, sends emails or replaces manual edits.

### Manual invitation checks

1. Run `npm run db:migrate:demo`, then `npm run dev:demo`. As customer.profile or customer01, open **Children and dependents**, **Dependent profiles**, then **Invite guardian** for their child.
2. Invite `customer02@demo.conecta.example.test`. The roster stays unchanged and the receipt explains that acceptance is required. Use fictional local addresses only.
3. Run `node --env-file=dev.env scripts/identity-delivery.mjs --once` after building the API. Open Mailpit using [the development guide](development-demo.md). In a separate browser profile, sign in as customer02 and open/review the link. The complete child profile stays unavailable before acceptance.
4. Choose **Accept and become guardian**. The recipient can now see/edit the child from the customer app. Reusing the link fails safely. Verify Spanish/English, keyboard navigation and narrow layout.
5. As the demo manager, choose an active customer's **Assist with guardians** action. Choose a dependent name and invite another guardian; management cannot edit the child in this dialog or bypass acceptance.

Existing fixtures cover I31; no extra seeded accounts, invitations or consent are needed. I32 adds the separate removal workflow below; independence (I33) and lifecycle/booking integration remain separate. See [backend tests](../apps/api/test/integration/identity-guardian-invitations.test.mjs), [controlled Chromium tests](../tests/e2e/identity-guardians.spec.ts) and [live inbox tests](../tests/integration/identity-guardians.spec.ts).

## Guardian removal (I32)

Current guardians may end their own authorization. Only administrators and managers may remove another guardian. Family membership and ordinary personnel roles grant no removal authority. This operation ends the specific authorization record, preserves its consent/provenance and appends an atomic sanitized audit event; it never deletes the child, cancels/transfers bookings, changes family membership or moves credits.

| Method/path (relative to `/api/v1/dependents`) | Input | Access/result |
| --- | --- | --- |
| GET `/:id/guardians` | Optional `limit` (1-50), UUID `cursor` | Current guardian or administrator/manager; bounded current relationship ID, account ID, name and `canRemove` only |
| POST `/:id/guardians/:relationshipId/remove` | Empty object | Self or administrator/manager; returns `dependentId` and the ended `guardianRelationshipId` |

The roster is a separate authorized removal view, not a general profile editor. Requests target immutable relationship IDs: an old screen cannot remove a newly accepted replacement for the same person. Stable account/person locks precede current role, session, profile and relationship checks. Concurrent removal cannot leave an active dependent without an active confirmed customer guardian; pending invitations never count. A changed roster that introduces an unlocked account returns a conflict instead of taking a late account lock. Revoked sessions, lost customer/management authority and stale targets fail safely. Audit failure rolls back the authorization change. Ending an issuing guardian's relationship invalidates their outstanding invitations through the existing live authority predicate.

The customer profile offers **Manage guardian access**. Select **End access**, review the named guardian and preserved-history explanation, then explicitly confirm. Ordinary guardians only receive controls for themselves. After success the parent list reloads and clears the child immediately if access ended. Management uses the selected customer's **Assist with guardians** dialog, chooses a dependent and opens the same removal confirmation without receiving an age/profile editor. Pending writes prevent dismissal. Conflict or uncertain outcomes block repeat submission until a fresh roster loads; failed reads never imply an empty roster or expose stale controls.

### Manual removal checks

1. Use the existing **Demo Dependent Child** shared by `customer.profile@demo.conecta.example.test` and `customer01@demo.conecta.example.test`. Both existing fictional relationships support removal testing; no new seed rows or manufactured consent are needed.
2. Sign in as either guardian, open **Children and dependents**, **Dependent profiles**, then **Manage guardian access**. Only your own relationship offers **End access**. Cancel the confirmation first to verify no change, then confirm if desired. The child disappears from your list, while the other guardian retains access.
3. As the remaining guardian, attempt self-removal. The conflict explains that an active guardian must remain; refresh is required before another attempt. A pending invitation does not replace a current guardian.
4. As the demo manager/admin, choose a customer's **Assist with guardians**, select their child and inspect removal controls. You may remove another guardian only while a different eligible guardian remains. The ordinary reception/instructor role alone cannot do this.
5. Restore removed access only through a new accepted invitation (I31). Reseeding preserves ended histories and does not restore a removed guardian or manufacture consent. Repeat tests using a new profile if the existing demo child has already been edited. Review the operational audit as management; no child name/age is exposed in removal snapshots.

See [backend permission/concurrency/history tests](../apps/api/test/integration/identity-guardians.test.mjs), [controlled browser tests](../tests/e2e/identity-guardian-removal.spec.ts) and [live consent/removal tests](../tests/integration/identity-guardians.spec.ts). Existing demo seed/reset checks remain applicable. No schema migration or PDF regeneration is needed for I32. Account/dependent deactivation and financial/booking lifecycle composition remain later steps.


## I33: Independent account transition

An active, confirmed customer with current guardianship can request independent login from the dependent profile. Management alone cannot initiate this transition. The recipient explicitly confirms the invited email and sets a normal-policy password using the email link. Opening the link performs no mutation. There is no minimum age, manual approval or automatic sign-in.

- `POST /api/v1/dependents/:id/transition`: `{email}` with session CSRF; opaque `202 {code:"ACCEPTED"}` even if the mailbox is unavailable.
- `POST /api/v1/dependents/transitions/complete`: `{token,email,password}` with anonymous CSRF; `200 {code:"TRANSITIONED"}`. The API never returns account IDs, passwords or tokens.

V12 adds the live transition predicate to the existing action-token persistence. Each 24-hour action binds the issuer account/session version, exact guardian relationship, dependent person/profile version and invited email. Reissuing to an available mailbox replaces outstanding links for that dependent. Cooldowns and persistent public action limits still apply. Profile edits, ended/replaced issuing authorization, issuer suspension or credential changes invalidate the link; another current guardian can request a fresh one. Delivery uses the same predicate, encrypted outbox and fictional Mailpit restrictions.

Under ordered account/person/profile/guardian/token locks, confirmation rechecks email uniqueness and expiry after waiting. One transaction consumes the action, creates a verified customer account on the same person, sets `independent_at`, increments the profile version, ends every current guardian with `transitioned`, and appends reference-only audit history. Failure or a competing confirmation rolls back all effects. Unique account/person constraints prevent duplicate identities and mailbox races. Existing bookings, child snapshots, saved details, family membership and credit ownership are not modified. Guardian accounts retain their own access, but cannot manage or book for this person through the ended relationships. Booking/financial composition belongs to the later owning modules.

The shared bilingual request dialog explains the consequences before sending. The confirmation screen removes the token fragment from browser history, requires email/password/password confirmation, clears secrets after submission and prevents retry after an uncertain result. It exposes no dependent name or age to an anonymous recipient.

### Manual verification

1. Migrate the local demo with `npm run db:migrate:demo`, then start `npm run dev:demo`.
2. Sign in as a demo guardian, open **Children and dependents**, then **Dependent profiles** and **Independent account** for Demo Dependent Child. Use a new fictional mailbox such as `independent.child@example.test`.
3. Run `node --env-file=dev.env scripts/identity-delivery.mjs --once`. Open the Mailpit link in a separate browser context. Confirm that opening it leaves guardianship unchanged.
4. Enter the invited mailbox and a password of 15-128 characters. Confirm explicitly, then sign in with the new login. Both former guardians should no longer find the dependent; history and saved child information remain.
5. Reopen the link to verify rejection. A normal demo reseed preserves the transition and does not restore guardianship; use another manually created fictional dependent for another run. The full development reset is optional and destructive, as described in [demo documentation](development-demo.md).

Reactivation of inactive profiles uses the separate [I37 renewal workflow](identity-reactivation.md); ordinary guardian invitations cannot substitute for immediately prior guardian provenance.
