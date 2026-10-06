# Identity reactivation

I37 implements access restoration from [the approved Identity specification](SPEC-identity.md). Only administrators and managers may restore accounts or dependent profiles. All endpoints require the existing session, allowed Origin and CSRF token, return `Cache-Control: no-store`, and reject extra fields before applying changes. Mutation bodies are limited to 2 KiB.

## Account access

`POST /api/v1/accounts/:id/reactivation` accepts `{confirmation:true, expectedSessionVersion}`. The inactive account and person must match the supplied current version. Restoration retains the same IDs, email, password and confirmation state; it increments the session version and revokes old sessions. Accounts with confirmed email and usable credentials become active; otherwise they become pending and must complete their existing confirmation/password setup requirements. Reactivation never creates a development password.

Live family memberships or guardian authorizations left on an inactive account cause a conflict rather than silently restoring relationships. Ended memberships and authorizations remain ended. Bookings, credit value/expiry, payments and history are untouched. A previously cancelled booking stays cancelled. Financial modules remain responsible for their own workflows.

## Dependent consent

1. Management calls `POST /api/v1/dependents/:id/reactivation/invitations` with `{guardianAccountId, expectedDeactivationSequence}`. The recipient must be an active, confirmed customer who was authorized immediately before the latest dependent deactivation. An unrelated or previously removed guardian cannot qualify. If every prior guardian is inactive, restoration is blocked; an eligible prior guardian must regain account access first.
2. The recipient receives a seven-day, single-use local inbox invitation. Authenticated preview and acceptance use `POST /api/v1/dependents/reactivation-invitations/preview` and `/accept`, with `{token}`. Acceptance records renewed consent only; the child remains inactive and inaccessible.
3. Management calls `POST /api/v1/dependents/:id/reactivation` with `{confirmation:true, invitationId, expectedDeactivationSequence}`. The accepted recipient and issuing manager must still be eligible, and the latest profile/version must match. The transaction activates the same dependent and creates exactly one new guardian authorization linked to accepted renewal evidence.

No other old guardian or family relationship is restored. Additional guardians require fresh ordinary invitations. Independent profiles cannot use dependent restoration. Pending consent is insufficient. Resending supersedes the previous unaccepted link subject to existing cooldown/budgets; consumed consent and historical provenance remain immutable. Atomic audit failures roll back consent or access restoration. Concurrent restoration succeeds only once.

The token is bound to the active guardian's person, account/email/version, renewal record and latest prior-guardian snapshot. Delivery suppresses stale issuer/recipient/profile bindings. Tokens and recipient addresses are omitted from operational audit projections. PostgreSQL V14 enforces immutable renewal history, action binding and accepted guardian provenance; repeat migrations are no-ops.

## Development verification

Run `npm run db:migrate:demo` and `npm run db:seed:demo`. The repeat-safe script adds **Demo Inactive Dependent**, whose immediately prior guardian is `customer18@demo.conecta.example.test`. Reseeding preserves manual changes and never manufactures renewal acceptance, sends invitations or resets the database. Existing active demo guardians and customers remain available.

For direct API checks, use authenticated requests with their session CSRF token. Obtain fixture IDs/current sequence from the local development database, issue the renewal as the demo manager, then preview/accept the inbox token as customer18 and finalize as management. Verify that acceptance alone grants no child access and that only the new authorization exists after completion. Avoid recording tokens in documentation, logs or shell history.

I38 now provides the emailed `guardian_reactivation` action page, management renewal/finalization dialog and account access controls. Follow [the lifecycle screen guide](identity-lifecycle-ui.md) for browser verification. No business rules or PDF snapshots change.
