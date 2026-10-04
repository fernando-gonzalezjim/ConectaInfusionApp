# Password recovery

I13 provides opt-in password recovery endpoints. I14 supplies shared Spanish-first/English recovery and password reset screens in both frontends, verified with real inbox delivery and independent sessions. Existing registration and login screens remain available.

All endpoints require the exact configured Origin, anonymous CSRF cookie/header from `GET /api/v1/auth/csrf`, bounded JSON and credentialed requests. Responses use `Cache-Control: no-store`. Opening a link or sending GET never resets a password. Tokens belong in the POST body, never query parameters or logs.

| Endpoint | Allowed request | Success |
| --- | --- | --- |
| `POST /api/v1/auth/recovery` | `email` | HTTP 202 `{ "code": "ACCEPTED" }` |
| `POST /api/v1/auth/recovery/reset` | `token`, `password` | HTTP 200 `{ "code": "PASSWORD_RESET" }` |

Requests normalize email with the existing trimmed lowercase comparison. Recovery is available to active accounts with active people, completed credentials and verified or explicitly exempt confirmation. It supports every role, including admin/management-created exempt accounts, without changing roles or falsely recording mailbox verification. Unknown, pending, inactive and recipient-throttled requests receive the same acceptance body and status. Acceptance does not guarantee email delivery; identical wall-clock timing is not claimed. The approved local fixture guard also applies: copied development accounts cannot recover outside the opted-in local development database.

The existing encrypted transactional outbox sends Spanish/English links using the account's language preference. A reset link expires after one hour, is single-use, and binds the current account/person/email and session version. A new request replaces the previous link, with the existing 60-second wait and five sends per fixed hour. Recipient throttling is hidden behind generic acceptance. Email delivery uses the [explicit local worker](identity-action-delivery.md); no production provider or background scheduler is installed.

Reset validates the normal Argon2id password policy of 15-128 Unicode code points, without a development-password exception. Password hashing is bounded and performed before opening the domain transaction. Under account/person/token locks, successful reset updates only the password hash, timestamps and session version; revokes every existing session; consumes the link and cancels its pending delivery; and appends a sanitized `account.password_set` audit event. All writes commit together or roll back together. No password, hash or token enters the audit or response. No session is created. Old credentials and sessions cease working; the customer must sign in separately. Reset cannot activate a pending/deactivated account, restore relationships or change roles. Concurrent redemption succeeds only once; stale account versions invalidate older links.

Recovery requests have a persistent 30-attempt limit per direct socket IP per 15 minutes. Reset shares the existing `action_ip` limit with email confirmation, preventing either endpoint from bypassing the shared public-action budget. Counters are committed before password/domain work and survive rejected actions or process restarts. Forwarded IP headers are not trusted. HTTP 429 `THROTTLED` includes `Retry-After`; invalid request shape/password returns 400 `INVALID_REQUEST`; unusable links return 400 `INVALID_ACTION`; infrastructure/overload failures return generic 503 `UNAVAILABLE`. The 2 KiB JSON limit and field allowlist reject oversized input and mass assignment.

See [Identity verification](../tasks/identity-verification.md) and [implementation tasks](../tasks/identity-todo.md). Production HTTPS/proxy configuration, email scheduling and wider abuse monitoring remain launch work.

Primary references: [OWASP password recovery](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html), [OWASP sessions](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html) and [node-postgres transactions](https://node-postgres.com/features/transactions).

## Recovery screens

Anonymous customer and management home pages offer **Forgot password** alongside sign-in. The email dialog gives generic acceptance, explains the one-hour link, spam folder and resend limits, and permits explicit repeat requests. Labeled controls, autofocus, Escape/focus restoration, pending states and safe validation/outage/throttle feedback use the shared branded components. Closing a pending dialog aborts its request; a later response cannot alter a reopened request.

Both frontends serve the shared `/auth/action` landing page. It removes query and fragment from history immediately and keeps only the purpose/token in memory. Loading the page never redeems a link. Reset requires matching passwords meeting the normal policy and an explicit **Reset password** submission. Password fields clear after settled attempts; unusable links offer a new recovery request, while transient failures permit retry. Refreshing the cleaned URL cannot recover its token. A fragment-only replacement synchronously cancels the old request, invalidates callbacks and remounts the form with empty password fields. An older response cannot clear the new link or report success for it.

After success, the page explains that all sessions ended and offers a fixed `/` sign-in link. It creates no session and accepts no caller-provided redirect. The delivery worker currently emits the configured customer origin; both frontends support the same protected action contract. Production hosts must serve their SPA for `/auth/action` and exclude third-party analytics/content from this secret-bearing page.

Initial invitation password setup is deliberately unavailable until I15 supplies its backend and I16 implements its invitation landing flow. I14 implements recovery/password reset; unsupported setup and relationship purposes remain blocked. This clarifies the earlier I14 checklist's broad ?password setup? wording without introducing an unbacked account-activation flow.
