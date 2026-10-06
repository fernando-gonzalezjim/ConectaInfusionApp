# Account deactivation

I36 implements the backend account-deactivation workflow from [the approved Identity specification](SPEC-identity.md). Deactivation preserves people, accounts, roles, bookings, payments and audit references. It does not erase personal data. I37 provides reactivation; I38 adds [customer and management lifecycle controls](identity-lifecycle-ui.md).

## Private API

Both routes require the existing allowed Origin, current session cookie and session CSRF token. They return `Cache-Control: no-store`. Mutation guards run before the bounded 8 KiB JSON parser; GET never performs deactivation.

- `POST /api/v1/accounts/:id/deactivation/preview`
- `POST /api/v1/accounts/:id/deactivation`

Preview accepts `confirmation: true`, optional `creditChoice` (`keep` or `leave-family`) and optional `dependentPersonIds` (explicit joint deactivation). Self-deactivation requires a currently assigned customer role, recent authentication within ten minutes and an explicit credit choice, even for a customer with additional personnel roles. Other-account deactivation requires administrator/manager authority. Management cannot donate another customer's credits; an omitted choice defaults to `keep`.

The preview returns only `{status: 'ready', revision}` or `{status: 'blocked', reasons}`. Execution requires the same choices plus a UUID `idempotencyKey` and the preview's `expectedRevision`. Successful execution returns only `{code: 'APPLIED', operationId}`. Altered choices/revisions, stale identity/domain state or unsafe guardian/admin outcomes conflict. Unknown coordinators/schema and unsupported legacy obligations remain blocked. No profile fields, mail tokens or passwords are accepted.

Matching management retries return the original receipt only after fresh authorization. Self-deactivation revokes its own session, so the old session cannot retry or retrieve a receipt. A reactivated actor must not reuse a previous receipt with changed choices. State/version checks apply before new work; completed receipts retain their original immutable intent. Preview revisions are not authorization credentials.

## Guardian and family effects

When another active, confirmed customer guardian remains, the dependent stays active, its bookings remain valid and only the departing guardian's authorization ends. A pending invitation is insufficient. An already accepted transfer uses this same path. Joint guardian/dependent deactivation is permitted only for explicitly selected active dependents currently guarded by the target, with no other eligible guardian. Missing explicit joint choices block a sole guardian's deactivation; unrelated, already inactive or independent people cannot be supplied as joint dependents.

Joint dependent status changes run before ending guardian relationships, allowing V10 to snapshot the exact immediately prior guardians for future reactivation provenance. Other guardians and historical authorization rows remain preserved. Account sessions are revoked, the account session version increments and the required deactivation timestamp is recorded. Retained roles grant no access while the account/person is inactive.

Memberships of the deactivated account and joint dependents end with preserved provenance. A departing responsible member loses responsibility; an already accepted successor remains responsible. A family closes when no current members remain. The coordinator must preserve the original purchaser, value, expiry and reservation facts; closure returns eligible unused/unreserved credits to original purchasers even when the initiating choice was to leave credits with the group. No refund, expiration extension or lost historical reference is introduced.

## Coordination and concurrency

The service owns the transaction and calls [the I35 lifecycle guard](identity-lifecycle.md). It takes the shared final-administration lock before discovering related accounts, people, guardians and families, locks the discovered scope canonically and rechecks it after locking. A newly discovered account/relationship conflicts rather than acquiring a late account lock. The internal 100-person mutation and 1,000-person lock-scope bounds are transaction safeguards, not approved family-size limits.

Remaining administrator/manager accounts must be active, confirmed and capable of normal login. The same development-fixture eligibility check is shared with role administration. Concurrent deactivation and demotion cannot remove all administration. Current roles, session/version, expiry and self recent-authentication are rechecked under locks; expiry is checked again after coordinator waits. Identity changes, domain effects, receipts and account/dependent/family audit events commit atomically or roll back together.

Trusted coordinators receive the canonical affected attendee person IDs plus `deactivation.accountId` and the explicit normalized credit choice. They must inspect current locked obligations and apply within the restricted shared transaction. Credits-bookings owns future paid/complimentary attendance cancellations, the two-hour cutoff evaluated at execution time, value/expiry/reservations and purchaser disposition. Acting guardian references must not cause cancellation of a still-active dependent's bookings. Studio-catalog owns explicit teaching reassignment/cancellation; instructor-payroll preserves accrued amounts owed and later payment recording. External payouts and independent commits are prohibited.

**Default application composition has no success adapters.** Even an empty development database returns an integration-required preview; execution cannot bypass it. The optional `createApplication({identityLifecycle})` composition is a trusted code-level dependency, never an environment switch or HTTP input. Test adapters exist only in disposable regression tests and do not implement the future financial modules.

## Audit and manual verification

Account, joint dependent and family changes have reference/status audit records. The operational audit now explicitly projects `identity.lifecycle_applied` with a lifecycle receipt target and `dependent.deactivated`, with Spanish/English labels and safe reference-only snapshots. Domain coordinators must audit their own cancellation and financial outcomes. The generic receipt does not prove those owning modules have been implemented.

Existing fictional demo customers, instructors, families and guardians are sufficient for manual blocked-preview checks. No new seed data, manufactured consent or successful lifecycle adapter is added to the demo. Use an authenticated session and its CSRF token to call the preview route; expect `INTEGRATION_REQUIRED`. A sole guardian without an explicit joint choice instead receives a conflict. No destructive database reset or PDF update is required. See [verification evidence](identity-verification.md).
