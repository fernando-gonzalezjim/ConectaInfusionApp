# Single-use actions and email delivery

I10 provides internal token issuance/redemption and a bounded encrypted-outbox worker using the existing V5 tables. It does not add registration, recovery, invitation or confirmation routes/UI; those remain later tasks. No account is automatically activated, and opening a link never redeems it. Follow [local configuration](identity-local-email.md) and see [verification evidence](identity-verification.md).

## Transaction and authorization contract

`issueAction(client, config, binding, locale)` and `consumeAction(client, token, binding, apply)` run on the caller's PostgreSQL transaction. The caller must open `BEGIN`, commit only after all required domain/audit work succeeds, and roll back on any exception. These helpers do not authorize a user or commit independently. Route-level Origin/CSRF and abuse protections still apply when the later endpoints are added.

`ActionBinding` is authoritative server context: purpose, normalized recipient, nullable account/person/relationship target IDs, account session version and expected domain version. Callers must derive it from current account/target state and validate the intended actor, recipient and consent; never accept it wholesale from a request or reuse stored expected versions as proof that the domain is unchanged. Redemption hashes the supplied random token and matches every binding field, active person/account context, validity interval and unused/unrevoked state under locks. Pending accounts may complete setup/confirmation; inactive accounts/people cannot gain access through these helpers. Domain status changes happen only in `apply`, on the same client as consumption and audit.

The caller establishes the complete lock order, including other affected accounts. Family invitation commands first lock participating accounts/people in stable UUID order, then roles/session and family/invitation rows, followed by send locks, token and outbox. The action helpers recheck account/person binding on the already-owned transaction; they must not introduce a conflicting account-after-family order in new commands. If the domain write fails, token consumption and cancellation of pending delivery roll back too. Concurrent redemption applies only once. Account version changes invalidate old actions; future security/lifecycle commands must increment that version transactionally. Relationship domains must check their own current version and eligibility.

## Lifetimes and resend

| Purpose | Fixed lifetime |
| --- | --- |
| Email confirmation, password setup, email change, dependent transition | 24 hours |
| Password recovery | 1 hour |
| Family invitation, group successor, guardian invitation/reactivation | 7 days |

Expiry is exclusive: the exact expiration instant is invalid. Tokens contain 32 cryptographically random bytes; only SHA-256 hashes enter action-token records. Issuance returns delivery metadata (`id`, `expiresAt`), never the raw token.

Each recipient/purpose has a shared 60-second minimum between sends and a fixed one-hour window of at most five sends, including the initial send. PostgreSQL transaction locks serialize concurrent sends. The counters use domain-separated HMAC subjects. A replacement revokes the previous unused link for the same logical account/person/target and scrubs its pending delivery atomically. Other targets retain their links while sharing the recipient/purpose limit. Failed issuance rolls back counters, replacement and outbox together. Public resend endpoints must return enumeration-safe responses; those endpoints are not part of I10.

## Delivery and secrets

The outbox encrypts recipient, purpose, language and raw token with the existing AES-256-GCM envelope. Row/token/recipient/kind metadata is authenticated as associated data. The worker verifies recipient and token hashes against the current action record before constructing a fixed application link. Spanish is the default product language; English is supported by the issuer's explicit locale.

Links use the configured origin and `/auth/action`, with purpose/token in the URL fragment, not a server query string. I12 implements the deliberate email-confirmation landing flow; setup and other action purposes remain later UI tasks. This fragment choice does not authorize an action or make client-side confirmation sufficient. All landing pages must read the fragment without persisting/logging it, remove it from browser history promptly and submit the token through the protected POST workflow. Do not add analytics or third-party content to a secret-bearing landing screen.

Only committed outbox rows can be claimed. Workers use `FOR UPDATE SKIP LOCKED`, 60-second leases and conditional acknowledgement; preparation and renewal delays cannot let a stale worker send its cached payload. SMTP attempts have a 20-second total deadline, shorter per-operation limits and explicit socket cancellation. After a transient failure, retry delays are 30, 60, 120 and 240 seconds, with at most five claimed attempts including abandoned claims. Permanent SMTP rejection or invalid payload ends delivery; unavailable encryption keys may retry within the same bound.

Successful, failed, cancelled or expired rows clear ciphertext, nonce, tag and key ID together. Each tick also cleans at most 100 expired/invalid/exhausted rows, including unused pending payloads. Action delivery is cancelled when its token is consumed/revoked or account/person access becomes invalid. I20 also delivers allowlisted `email_changed` security notifications to the prior mailbox using the same lease/retry/scrubbing controls. These records have no action-token reference, contain an encrypted recipient/event/locale payload, and are not cancelled by the session-version change they report.

SMTP is **at-least-once**, not exactly-once. If SMTP accepts a message and its database acknowledgement fails, a later claim may deliver the same message again. Stable message IDs help correlation but do not promise provider deduplication. A duplicate email still carries one single-use action. Resend or expiry may invalidate a link in an already in-flight email; it cannot redeem the revoked action. No SQL transaction is held open during SMTP.

Raw tokens, addresses, bodies, SMTP credentials and raw server failures are never log/audit fields. Worker/command failures expose stable codes or counts only. Retain encryption keys for pending rows; keep the subject-HMAC key stable until both throttle windows and all dependent pending deliveries are drained. Replacing that key prematurely changes recipient verification and throttle identities.

## Run one local delivery tick

The operator command accepts an optional `--once`, defaults to one tick and processes at most ten eligible messages. It is limited to local development/test PostgreSQL targets and the loopback Mailpit configuration; Mailpit recipients must use a reserved `.test` domain. It does not run on API startup, create accounts or apply migrations.

From the project root, with the private configuration described in the local setup guide:

```powershell
npm run build -w @conecta/api
node --env-file=.local/identity/email.env scripts/identity-delivery.mjs --once
```

If the same settings are already in the process environment or a private root `.env`, `npm run identity:deliver` builds and runs one tick. Start the optional Mailpit service as described in the local guide. Rerun the command after a retry becomes due; no background scheduler is installed. A later deployment must explicitly schedule ticks, monitor pending/failed delivery metadata and coordinate shutdown and key rotation. The validated authenticated TLS SMTP adapter exists, but this local command cannot enable production sending, and no provider connection is provisioned or verified here.

I11 now uses these primitives for [customer registration and confirmation](identity-registration.md). I12 adds the customer-facing confirmation flow; I13 also uses these primitives for the [password recovery backend](identity-recovery.md), with shared recovery/reset screens delivered in I14. Business rules and PDF snapshots are unchanged; Graphify refresh status is recorded in the implementation evidence.

Implementation references: [node-postgres transactions](https://node-postgres.com/features/transactions), [PostgreSQL locking clauses](https://www.postgresql.org/docs/17/sql-select.html#SQL-FOR-UPDATE-SHARE), [Nodemailer SMTP options](https://nodemailer.com/smtp) and [pre-created SMTP sockets](https://nodemailer.com/extras/smtp-connection).

I24 adds [family invitations](identity-families.md). Before delivery, the worker additionally checks the invitation/token identity, unaccepted state, active family and live sender authority. A pending invitation never creates membership. Family acceptance is an authenticated, deliberate POST; I25 adds the bilingual browser landing screen, which removes the fragment and requires separate review and acceptance actions.

I26 adds family-responsibility offers with the same consent link policy. Before SMTP delivery the worker checks `identity_family_successor_valid`: current family version, pending offer, active recipient membership, recipient/issuer eligibility and current nomination authority. Acceptance and decline are separate authenticated POST decisions. Neither opening nor reviewing the link grants authority. Pending/declined offers do not block departure. See [responsibility boundaries and manual checks](identity-families.md).
