# Customer invitations

I15 implements the opt-in invitation backend. I16 provides Spanish-first/English invitation controls in the management frontend and a shared password-setup landing screen on both frontends.

All requests require an exact configured Origin and JSON. Invitation mutations require a valid session cookie and its `X-CSRF-Token`. The server resolves current roles and rechecks account, person, session and roles inside the database transaction.

| POST endpoint | Body | Success |
| --- | --- | --- |
| `/api/v1/accounts/invitations` | `email`, `fullName`; optional `phone`, `preferredLocale`, `waiveConfirmation`, `reason` | 202 `{ "code": "ACCEPTED" }` |
| `/api/v1/accounts/invitations/resend` | `email` | 202 `{ "code": "ACCEPTED" }` |
| `/api/v1/auth/setup` | `token`, `password` | 200 `{ "code": "PASSWORD_SET" }` |

Administrator, manager, reception, café staff and instructor roles can invite customers. Multiple roles are supported. Customer-only accounts cannot invite. Every invitation assigns only the customer role; role, password, verification, person ID and other extra fields are rejected. Email is required and normalized. Locale defaults to `es-MX`, with `en` supported. Full name is trimmed and limited to 120 characters; phone is optional and limited to 40 characters.

Only administrators and managers may set `waiveConfirmation: true`. They must supply a nonempty reason of at most 500 characters. The pending account records management exemption source, actor, reason and timestamp; it does not falsely record mailbox verification. Exempt customers still receive a secure password-setup link and cannot sign in before setting their password. Staff cannot assign a password. Development fixture passwords are confined to the separate development bootstrap process.

Creation never overwrites an existing account or claims a legacy person. Duplicate and reserved development addresses receive generic acceptance. Creation and resend do not return account IDs, profiles, existence or verification status. Resend only replaces a pending, passwordless, non-fixture customer-only account's setup link; it does not change its personal details or exemption. Unknown, active and inactive recipients receive the same generic response. Use the dedicated resend endpoint to request another link.

Setup links expire after 24 hours, are purpose-bound and tied to the current account/person/version/email. Resending waits at least 60 seconds, allows five sends per recipient and purpose per hour including the first send, and revokes the old link. Invitation creation and resend share the durable registration-IP budget of 30 requests per 15 minutes; setup shares the action-IP budget of 30 requests per 15 minutes with confirmation/reset. Recipient resend throttling returns generic acceptance; IP throttling returns 429 with `Retry-After`. Proxy headers are not trusted for IP identity.

A normal setup verifies the mailbox, sets an Argon2id password and activates the account. An exempt setup activates the account while preserving exemption provenance and an empty mailbox-verification timestamp. Passwords follow the normal 15–128 Unicode-code-point policy. Links can succeed only once, including under concurrent submissions. Setup increments the session version, revokes any existing sessions and creates no automatic login session.

Account creation, customer-role assignment, encrypted email outbox insertion and audit history commit together. Exemptions have a separate audit event. Password setup, link consumption and its audit event are also atomic. Passwords, hashes and raw action tokens are never recorded in audit events. Bodies are limited to 2 KB and responses use `Cache-Control: no-store`. Database/native failures return safe `UNAVAILABLE` responses.

Mail delivery uses the configured encrypted-outbox worker described in [local email configuration](identity-local-email.md). I15 tests exercise real HTTP/PostgreSQL behavior; I16 verifies the complete invitation inbox-to-browser journey with synthetic `.test` recipients and Mailpit. Production provider configuration, delivery scheduling and hosting remain deployment work.

## Browser flow and manual testing

Start the development environment following [local configuration](identity-local-email.md). Sign in to the management frontend at `http://localhost:5174` with an administrator, manager, reception, café-staff or instructor account. Select **Invite customer** (Spanish: **Invitar cliente**), enter the required email/name, optional phone and preferred account language, then send. Only administrators and managers see **Waive email confirmation** and its required reason. A generic result is displayed; no existing customer details, IDs or verification states are loaded. The form clears its fields after successful submission or closure. **Resend invitation** requests another link using only an email address and preserves the account's existing data.

Deliver queued messages using the configured local outbox command and open the message in Mailpit. The setup link opens `/auth/action` and immediately removes query/fragment metadata from browser history. It is not redeemed until the customer submits matching passwords that satisfy the normal password policy. On success, follow the fixed home/sign-in link and sign in explicitly; setup creates no session automatically. Expired or consumed links tell the customer to ask the team for a new invitation. Reloading the stripped URL has no token and cannot repeat setup. Action tokens and passwords are not stored in browser storage.

Invitation creation/resend use freshly read session CSRF; setup uses anonymous CSRF. Client mutations are never automatically retried. Pending controls prevent duplicate submissions, closing/unmounting cancels requests, and replacing a setup link cancels the previous request and discards its feedback. Authentication or permission failures block the invitation form and instruct the actor to sign in or refresh. The server remains authoritative even if an older browser role snapshot displays a control.
