# Identity login backend: I06 checkpoint

I06 implements the backend service and a guarded router factory under the [approved plan](identity-plan.md). At the I06 checkpoint the application left auth routes unmounted. I07 adds shared DTOs/client transport, exact origins and anonymous/session-bound CSRF checks before mounting them for explicitly enabled Identity. See [authenticated transport](identity-auth-transport.md) and [verification evidence](identity-verification.md). No login UI, registration, recovery or account-administration route is implemented by I06.

## Session service

`createSessionService(pool, enabledConfig, options)` uses the [validated Identity configuration](identity-local-email.md), PostgreSQL and the existing Argon2id module. Its initialization prepares a random dummy password hash for generic credential verification. Production uses the real clock/environment; test-only callers can supply a clock to prove boundaries without sleeping.

| Operation | Behavior |
| --- | --- |
| `login(input, ip)` | Accepts email, password and optional boolean `rememberMe`; rejects extra fields. Normalizes email consistently with account persistence, preserves password whitespace/Unicode, reserves shared login counters before hashing, and checks active account/person plus confirmed or explicitly exempt credentials. |
| `resolve(token, requiredRoles?)` | Reads the account/person and current role assignments from PostgreSQL on every call; checks revocation, exact expiry, account session version, supported credentials and fixture eligibility. Required roles use any-of semantics. |
| `logout(token)` | Revokes one token's session. Missing/malformed/already-revoked tokens are harmless. It does not change another session or the account profile. |
| `logoutAll(token)` | Re-checks the caller's current session under an account lock, increments the account session version and revokes all its sessions atomically. No request-body account identifier is accepted. |

Sessions use fresh 32-byte random opaque tokens encoded as canonical base64url; PostgreSQL stores only their SHA-256 hashes. Expiry is fixed at 168 hours, or 720 hours with Remember me. Reads never extend it. An account's persisted `session_version` invalidates all earlier sessions when it changes; future password-reset, role-change and lifecycle commands must increment it in their own transactions. Those mutation flows remain in their later tasks. Permission checks always use current roles, including multi-role accounts; access to the management frontend's port does not grant a role.

CSRF tokens are derived using SHA-256 with the `identity-csrf-v1` domain prefix and the secret session token. Only their hashes are stored. The raw CSRF value can be returned again on a valid session read without rotating it or mutating state on GET. It is distinct from the login cookie and cannot recover that cookie. This supplies the session-bound material; actual request Origin/CSRF validation is I07.

Password verification occurs before long-lived account locks. Before creating a session, the service locks the account then person, re-reads credentials, status and roles, and compares the password hash and session version to the earlier credential snapshot. A concurrent revocation/version change denies that login; insertion/commit failure returns no successful session. All-device logout serializes on the same account lock. Private context fields are for server code only; handlers must never trust a caller-supplied actor or cached roles for an unrelated mutation.

The approved public development credentials work only for correctly tagged fixtures in explicitly enabled development on the matching verified local target. Copies in staging/production/test, disabled fixtures, unsafe/mismatched database URLs and untagged reserved fixture emails are denied both at login and session resolution. Accounts are not created by login or startup. Follow the [manual bootstrap guide](identity-bootstrap.md) separately; your developer database has not been provisioned by these tests.

## Login abuse controls

The technical limits are 10 attempts per normalized email and 30 per peer IP in a fixed 15-minute window, including successful and failed attempts. PostgreSQL UPSERT reserves each counter atomically across instances. Counts saturate at one beyond the limit; a throttled request returns a positive `Retry-After` and does not reach native password verification. Counters commit independently of failed authentication. This is a technical abuse limit, not a new product permission or a claim of full distributed capacity testing.

HMAC subject hashes use the independent configured subject key and scope/domain separation. Raw IPs/emails are not stored in counters or logged. This factory uses the socket's peer address and ignores forwarded/body IPs. Deployment behind proxies requires the reviewed trusted-proxy strategy before publishing routes; otherwise clients behind one proxy share its aggregate limit. Expired counter cleanup/production retention still need the later maintenance/launch work.

## Router factory contract

`createAuthRouter(service, config, mutationGuard)` requires an enabled config and an explicit mutation middleware; omitting the guard fails immediately. It is exported for I07 and isolated tests, not mounted by I06. The test harness supplies a clearly marked test-only guard and a protected role probe; neither is a production endpoint or a substitute for Origin/CSRF middleware.

| Method / relative path | Input / success | Failure |
| --- | --- | --- |
| `POST /login` | `{ email, password, rememberMe? }`; 200 with own public account, CSRF token and expiry; opaque session appears only in the cookie. | 400 malformed/extra fields; 401 generic credential rejection; 429 shared throttle; 503 infrastructure/overload. |
| `GET /session` | No body; 200 with own account, CSRF token, authentication time and fixed expiry. | 401 missing/invalid/expired/revoked session. |
| `POST /logout` | Empty body; 204, revoke one session and clear its cookie. | 400 extra/body fields; 503 infrastructure failure. |
| `POST /logout-all` | Empty body; 204, revoke all caller sessions and clear the cookie. | 400 extra/body fields; 401 invalid caller session; 503 infrastructure failure. |

Public errors contain stable `{ code }` only. Unknown/inactive/wrong-password cases share `INVALID_CREDENTIALS`; native/SQL errors never become response content or raw logs. JSON parsing is bounded to 2 KiB, and parser failures return safe 400/413 errors. All router responses use `Cache-Control: no-store`. Cookie parsing rejects duplicate session cookies, malformed escapes and oversized headers.

Cookies are host-only with path `/`, HttpOnly and SameSite Lax. They are Secure for a configured HTTPS origin and use the matching 7/30-day maximum age; PostgreSQL expiry remains authoritative. Cookies are cleared with the same attributes. A successful login always replaces the cookie with a newly generated token rather than accepting a caller-chosen session ID. CORS/client credentials, exact origins, anonymous CSRF and browser cookie sharing are I07/I08/I09 verification obligations, not completed browser login flows.

## Review and next step

The user approved the [I04–I06 checkpoint](identity-todo.md#checkpoint-after-i06) and continuation to I07. The Graphify refresh requested after I06 includes I05/I06 source changes; future meaningful changes need another authorized incremental refresh. Business rules and both on-demand PDF snapshots are unchanged.

Primary references: [PostgreSQL atomic UPSERT](https://www.postgresql.org/docs/17/sql-insert.html#SQL-ON-CONFLICT), [Node cryptographic randomness and hashes](https://nodejs.org/api/crypto.html), [Express 5 routing/cookies](https://expressjs.com/en/5x/api/) and the [approved session requirements](SPEC-identity.md).
