# Own profile and email changes

I20 provides the same profile editor in both frontends, inside **My account → Edit my profile**. Every active authenticated customer, staff member, instructor or manager can edit their own name, optional phone and preferred language. I21 adds [private profile photos](identity-photos.md) through separate bounded upload endpoints. No role, email, confirmation status or other account ID can be supplied through personal-details editing. The server derives the target from the session and retains the existing management-only rules for editing another person.

## API contracts

| Endpoint | Proof | Result |
| --- | --- | --- |
| `GET /api/v1/me` | Current session | Sanitized `AccountProfile` for the session owner |
| `POST /api/v1/me` | Current session, exact Origin, session CSRF | Updated profile; allowed fields match `AccountProfileInput` |
| `POST /api/v1/auth/email-change` | Current session, exact Origin, session CSRF, password authentication within the last 10 minutes | `{ "code": "ACCEPTED" }`; delivery queued to the new address |
| `POST /api/v1/auth/email-change/confirmation` | Exact Origin, anonymous CSRF, single-use mailbox token | `{ "code": "EMAIL_CHANGED" }`; no session issued |

All responses are `no-store`, request bodies are bounded to 2 KB, and unknown fields are rejected. Profile edits leave credentials and sessions intact. Preferred language is an account preference; changing it does not force the browser's selected display language.

## Email-change transaction

The current email remains the login address until confirmation. New addresses use the same normalization and unique account constraint as registration and login. Existing accounts cannot be merged or claimed through this workflow. Requesting another address replaces prior pending email-change links for that account. Links expire after 24 hours and are bound to the account, person, normalized recipient and current session version. Resend limits and persistent IP limits apply. A recent login is required to request the change; sign out and sign in again if `RECENT_AUTH_REQUIRED` is returned. Redeeming the link uses its single-use proof rather than requiring a current session.

Under account/person locks, confirmation rechecks activity, version and expiry, then atomically updates the email, records verified-mailbox provenance, removes the old confirmation exemption fields, increments session version, revokes every session, consumes the token, audits the change and queues an encrypted security notification to the prior address. Audit or queue failure rolls everything back. Competing claims for one new address produce one winner and a safe `CONFLICT`; the losing account retains its current address. Expiry and recent authentication are evaluated after lock waits. No new database migration is needed.

The existing outbox worker delivers both action links and the bounded `email_changed` security notification with the same lease, retry, expiry and scrubbing controls. The notification contains no action token or replacement-session credential. Local Mailpit delivery accepts only `.test` recipients; production SMTP remains separately configured. A queued notification is not a promise of immediate delivery.

Session cookies may remain in a browser after confirmation, but their server-side sessions are revoked. Both frontends remove private access on their next session read, focus refresh or reload. Sign in with the confirmed new email and existing password. Names, roles, person IDs, family/booking references and legacy history are preserved; historical `members.email` fields are not rewritten or used to attach another identity.

The explicitly tagged `admin` and `testuser` development fixtures have fixed addresses and short fixture-only passwords, so email changes return conflict for those accounts. Test with normal fictional demo accounts instead. Reserved fixture addresses cannot be selected as new login addresses.

## Local manual verification

Run `npm run db:seed:demo`, then `npm run dev:demo`. Sign in as `customer.profile@demo.conecta.example.test` with the development-only password documented in [demo setup](../development-demo.md). This dedicated fictional account has a synthetic verified state for testing, no bookings, and no development short-password exemption. Profile editing is also available to the other active demo accounts.

Change the name/phone/language, save, close and reopen the editor. Request a new fictional address such as `profile.changed@example.test`. Deliver queued email with `node --env-file=dev.env scripts/identity-delivery.mjs --once`; inspect the inbox at `http://localhost:8026`. See [local outbox configuration](identity-local-email.md). Opening the link must not apply the change. Press the confirmation button, run delivery again, and verify old sessions are rejected, the prior-address notification is delivered, the old email cannot sign in, and the new email works with the existing password. Reuse of the link must fail. Reseeding preserves the changed address and profile fields; it does not reset the account. The guarded full demo reset remains a separate explicit command.

Save requests block dialog dismissal until they settle. API failures show safe localized messages and do not retry POSTs automatically. An interrupted network response can leave an uncertain outcome; refresh the profile or sign in with the expected address before another attempt.

Graphify remains stale for I19/demo and I20–I21 source relationships and contracts. An incremental refresh is needed when authorized; no automatic rebuild or hooks were enabled.
