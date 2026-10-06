# Identity authenticated transport

I07 mounts the I06 login/session backend when `IDENTITY_ENABLED=true` and configuration passes validation. Identity remains disabled by default; Foundation-only installations need no new secrets and expose no auth routes. Follow [local setup](identity-local-email.md), [manual bootstrap](identity-bootstrap.md) and [verification evidence](identity-verification.md). I08 supplies [customer login controls](identity-customer-login.md); I09 supplies [management login and access checks](identity-management-login.md).

## Endpoints and shared contracts

All paths below are under `/api/v1/auth`. Public DTOs live in `packages/contracts`; password fields exist only in `LoginInput`. Session tokens are never returned in JSON.

| Method/path | Input | Result |
| --- | --- | --- |
| `GET /csrf` | Optional existing anonymous cookie; exact allowed Origin if present | Anonymous CSRF token; sets a short-lived HttpOnly cookie when needed; no database mutation |
| `POST /login` | JSON email/password/optional rememberMe; anonymous cookie and `X-CSRF-Token`; exact allowed Origin | Own account, session CSRF and expiry; sets a new opaque session cookie and clears the anonymous cookie |
| `GET /session` | Session cookie; exact allowed Origin if present | Current own account, session CSRF, authentication time and expiry |
| `POST /logout` | Empty JSON object; session cookie, matching session CSRF, exact Origin | 204; revokes current session and clears its cookie |
| `POST /logout-all` | Same as logout | 204; atomically increments account session version and revokes all sessions |

Every auth response is `Cache-Control: no-store`. Missing/foreign Origin or CSRF failures return `{ code: 'FORBIDDEN' }` (403). Invalid or expired sessions return 401. Login credentials fail generically; shared throttles return 429 with Retry-After. Parser errors are bounded and sanitized; database/native failures return 503 without raw SQL, bodies or secrets. Disabled Identity returns 404 for these paths. GET never logs in, logs out, consumes a token or modifies account/session records.

## Origin, cookie and CSRF boundaries

Validated `WEB_ORIGINS` is captured as an immutable allowlist. Each Origin must match exactly, including scheme and port; null origins, suffixes, paths, multiple origins and missing mutation origins are denied. A supplied foreign Origin is also denied on reads. Same-origin browser GET requests may omit Origin. Referer and forwarded headers never substitute for it.

Auth-specific CORS permits credentials only for allowed origins, with GET/POST/OPTIONS and Content-Type/X-CSRF-Token. It runs after the Origin guard and before body parsing. Preflight grants no account authority. Auth requests never fall through to Foundation's public CORS/parser/error logger. Mutations require application/json and a custom CSRF header; the auth parser retains its 2 KiB bound.

Before login, `/csrf` issues a random nonce plus an absolute 15-minute expiry authenticated with HMAC-SHA-256. Its domain-separated `identity-anonymous-csrf-v1` key use shares the existing subject-HMAC secret, not an encryption key. The signed token must match the browser's host-only HttpOnly `conecta_csrf` cookie and the request header. Forged matching cookie/header pairs still fail signature validation. Existing valid tokens are reused without extending expiry; the exact expiry instant is denied. Login clears the anonymous cookie and creates a fresh session rather than converting anonymous state to authentication. Anonymous tokens are stateless and reusable until expiry; clearing the cookie is not server-side one-time revocation, and these tokens never authorize session operations.

Authenticated mutations resolve current account/status/version and compare the header with the session-bound CSRF from I06. Anonymous CSRF, another session's token, and missing headers cannot substitute. Session revocation remains authoritative in PostgreSQL. Tokens travel only in response bodies, cookies and headers, never URLs or application logs. The client retains no authentication token in local/session storage.

Both cookies use path `/`, HttpOnly and SameSite Lax, with Secure on the configured HTTPS origin. Cookies do not isolate ports: development uses localhost:5173, localhost:5174 and their `/api` proxies; production initially requires both frontends and API under one HTTPS host. Roles come from current server-side records, regardless of which frontend port sent the request. The API continues using the actual socket peer for login throttling; no forwarded-header or generic proxy trust was added. Configure a reviewed known-proxy strategy before deployment behind a proxy.

## Shared API client

`createApiClient()` adds `getSession`, `login`, `logout`, `logoutAll` and the I09 `getManagementAccess` read while preserving public settings/overview calls. Login bootstraps anonymous CSRF; logout operations read the current session before sending its CSRF. All requests include credentials, support AbortSignal, reject redirects and expose stable allowlisted errors. Mutations are never automatically retried. A malformed bootstrap cannot cause credentials to be sent; 204 is handled without JSON parsing. Configure only a trusted API base URL, not one supplied through user input.

Expiry, logout or concurrent account changes may invalidate a token between the read and mutation. The server denies the mutation; future UI work must handle the current authentication state instead of silently retrying it. New anonymous registration/recovery endpoints must explicitly use anonymous protection; new protected mutations must use session protection. Adding a route does not grant it an automatic exemption.

## Verification and remaining work

Focused tests exercise the shared client and real application through disposable PostgreSQL, including exact origins, CORS preflights, missing/forged/swapped tokens, cookie flags, revocation, safe failures and disabled mode. Chromium tests use the actual shared client, both frontend proxies and direct credentialed API reads. They verify host-only cookie sharing, HttpOnly behavior and shared logout without adding a login screen.

I08 supplies accessible bilingual customer login controls; I09 supplies management login and server-enforced administrative access. No registration, recovery, account administration, production provider or deployment is included. The user authorized a changed-file Graphify refresh after I08, including I07's transport changes. PDF snapshots and product rules remain unchanged.

Sources: [OWASP CSRF prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html), [Express CORS middleware](https://expressjs.com/en/resources/middleware/cors.html), [Node crypto](https://nodejs.org/api/crypto.html) and the [approved implementation plan](identity-plan.md).
