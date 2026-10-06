# Customer registration and confirmation

I11 provides opt-in backend endpoints; I12 adds Spanish-first and English customer registration, email confirmation and resend screens.

All endpoints use `/api/v1/auth`, exact configured Origin, credentialed anonymous CSRF from `GET /csrf`, bounded JSON and `Cache-Control: no-store`. Send the bootstrap cookie and `X-CSRF-Token`. Never place confirmation tokens in query parameters or logs.

| Endpoint | Request | Successful response |
| --- | --- | --- |
| `POST /register` | `fullName`, `email`, `password`; optional `phone` and `preferredLocale` (`es-MX` default or `en`) | HTTP 202 `{ "code": "ACCEPTED" }` |
| `POST /confirmation/resend` | `email` | HTTP 202 `{ "code": "ACCEPTED" }` |
| `POST /confirmation` | `token` | HTTP 200 `{ "code": "CONFIRMED" }` |

Unexpected fields are rejected, including roles, person IDs, confirmation exemptions and status. Names are trimmed and bounded to 120 characters; phone is nullable and bounded to 40; control characters are rejected. Email follows shared trimmed lowercase comparison. Passwords use the existing normal Argon2id policy (15–128 code points), without fixture exceptions. Photos remain the later upload slice. The JSON body limit is 2 KiB.

Registration creates a new person, pending account, customer role, sanitized audit event and encrypted confirmation outbox in one PostgreSQL transaction. It never attaches to legacy customer history by email similarity. Concurrent registration serializes by recipient; the unique email constraint also protects against other creation paths. Duplicate registration returns the same response without replacing credentials, profile, roles or historical links, and does not automatically resend. The reserved admin/testuser development addresses also receive generic acceptance without being created through public registration; they belong to the reviewed bootstrap path. Customers can request resend separately.

Pending accounts cannot sign in. Confirmation uses I10's purpose-, recipient-, person- and current-version-bound token, requires an active person and pending customer-only account, marks the mailbox verified and account active, increments the session version and appends audit in the same transaction. It creates no session. Reuse, stale versions, inactive accounts and exact 24-hour expiry return HTTP 400 `INVALID_ACTION`. GET is a non-consuming 404. Registration and confirmation cannot reactivate an inactive account.

Resend retains I10's 60-second wait and five sends per fixed hour, including the initial send. Successful resend revokes the previous link and scrubs its pending delivery. Unknown, active, inactive and recipient-throttled requests share HTTP 202 `ACCEPTED`, with no recipient-dependent `Retry-After`. These responses do not claim identical wall-clock timing or guarantee SMTP delivery.

Registration/resend share a persistent limit of 30 attempts per direct socket IP per 15 minutes; confirmation has a separate 30-attempt IP limit. Limits are reserved before password or token work, persist independently of failed domain transactions and return HTTP 429 `THROTTLED` with `Retry-After`. Forwarded IP headers are not trusted. Invalid input returns HTTP 400 `INVALID_REQUEST`; unavailable infrastructure or password-work overload returns generic HTTP 503 `UNAVAILABLE`, without SQL, passwords, tokens or stack traces. Production proxy configuration and wider abuse monitoring remain launch work.

Email remains an encrypted transactional outbox handled by the [I10 delivery worker](identity-action-delivery.md). There is no inline SMTP or automatic background scheduling. Local tests use reserved fixture addresses and disposable databases. Production delivery is not enabled by this slice.

## Customer screens

The anonymous customer home page offers **Create account** alongside sign-in. Registration collects name, email, optional phone and a password of 15–128 Unicode code points, and sends the current language preference. Pending-account feedback explains email confirmation, spam folders and resend limits without revealing whether an account already exists. Request failures allow deliberate retry; passwords are cleared after each settled attempt and are never persisted. Closing the dialog aborts its request. Keyboard focus, Escape, labeled inputs and pending controls use the shared accessible dialog components.

Email links open `/auth/action` with their purpose and token in the fragment. The page immediately removes the fragment and query from browser history and retains the token only in memory. Opening a link does not confirm the account: the customer must press **Confirm email**. Same-page replacement links abort prior requests and reset the screen. Invalid, expired, replaced or used links offer resend; transient failures permit retry. Refreshing the cleaned URL requires a new email link. Confirmation creates no session; the customer returns home to sign in separately. I14 shares this landing page with password recovery/reset; initial setup and relationship purposes remain unavailable until their owning tasks implement them.

Production frontend hosting must serve the SPA for `/auth/action`. Keep third-party analytics and content off this secret-bearing landing page. The existing explicitly invoked delivery worker must run to deliver pending email; these screens do not install a production scheduler or provider.

Verification is recorded in [Identity evidence](identity-verification.md), including real Spanish/English Mailpit delivery, resend, revoked and used links, keyboard navigation, accessible errors and responsive layouts. The user approved I12. I13/I14 now provide the recovery backend and shared recovery screens.

Primary references: [node-postgres transactions](https://node-postgres.com/features/transactions) and [OWASP authentication responses](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html).

UI references: [React StrictMode](https://react.dev/reference/react/StrictMode) and [History.replaceState](https://developer.mozilla.org/en-US/docs/Web/API/History/replaceState).
