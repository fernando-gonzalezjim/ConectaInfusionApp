# Identity implementation decisions

Recorded October 3, 2026 under the approved [Identity plan](../tasks/identity-plan.md). These are local implementation choices; they do not change the [approved account permissions](../SPEC-identity.md).

## Runtime and dependencies

Use Node 24.21.0 and npm 11.19.0 for reproducible local verification. The existing workspace engine range remains unchanged. API dependencies are pinned exactly in its manifest and the root lockfile:

| Dependency | Version | Purpose |
| --- | --- | --- |
| `argon2` | 0.45.1 | Argon2id password hashing and PHC verification |
| `nodemailer` | 10.0.14 | SMTP adapter; includes its own type declarations |
| `sharp` | 0.35.5 | Validate, rotate, resize and re-encode profile images |
| `axllent/mailpit` | v1.31.4 | Optional loopback local inbox configured in I05; no real delivery |

The selected npm artifacts include prebuilt native bindings/generated JavaScript. No install lifecycle script was needed on Windows x64 or Debian Linux x64. `.npmrc` defaults to `ignore-scripts=true`; use `npm ci --ignore-scripts`. Review package sources before authorizing a specific future build script; do not enable all scripts to work around a failing install. Never fall back to weak password hashing when a binding is unavailable.

Primary sources: [Argon2 release manifest](https://github.com/ranisalt/node-argon2/blob/v0.45.1/package.json), [Argon2 usage](https://github.com/ranisalt/node-argon2), [Sharp installation](https://sharp.pixelplumbing.com/install/), [Nodemailer SMTP](https://nodemailer.com/smtp), [Mailpit Docker](https://mailpit.axllent.org/docs/install/docker/) and [Mailpit v1.31.4 release](https://github.com/axllent/mailpit/releases/tag/v1.31.4). Installed package metadata and lockfile are authoritative for the pinned releases when the latest documentation differs.

## Passwords and recent authentication

- Normal passwords: 15–128 Unicode code points; allow spaces and Unicode, do not trim, normalize or silently truncate. No character-composition requirement. Reject excessive input before hashing. Only explicitly tagged, opt-in local development fixtures may use the approved `admin` / `testuser` shorter passwords.
- Argon2id: memory 19,456 KiB, time cost 2, parallelism 1, per-password random salt supplied by the library. Store the PHC string; parse parameters by name, never depend on their ordering. Rehash policy must not lower these parameters.
- Recent authentication: password verification within the last 10 minutes for changing a password/email and confirming self-deactivation. Confirmation/reset/setup token flows follow their dedicated single-use proof rules. This does not introduce another person's approval or replace authorization checks.
- Limit concurrent hash work and throttle login/recovery at their API boundaries before exposing endpoints. The measured smoke timings are compatibility evidence, not production capacity or an SLA.

Basis: [OWASP password storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html) and [authentication guidance](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html).

## Login/session implementation

I06's [backend checkpoint](identity-login-backend.md) records the internal service/router contract, fixed expiry, generic credential denials and fresh account/person/role checks. Login throttles are 10 attempts per normalized email and 30 per peer IP per fixed 15-minute window, using scope-separated HMAC subjects and atomic PostgreSQL counters. Raw forwarded/body IPs are not trusted. Deployment behind known proxies requires I07/launch transport review.

Session CSRF material uses a domain-separated hash of the random opaque cookie token, allowing a valid GET session read to recover the same CSRF value without a database mutation. Only token/CSRF hashes are persisted. The auth router requires an explicit mutation guard; I06 left it unmounted, and I07 adds the actual Origin/CSRF/client transport integration. Account locks serialize session issuance and all-device revocation; login rechecks its earlier credential/session-version snapshot before inserting.

I07's [authenticated transport](identity-auth-transport.md) captures validated frontend origins immutably, applies exact Origin checks before auth parsing/database work and enables credential-aware CORS only for those origins. Anonymous login protection uses a signed random nonce/15-minute expiry in an HttpOnly cookie plus a matching custom header; the HMAC key is the existing subject key with a distinct domain prefix. This stateless pre-login token grants no session authority. Login clears its cookie; protected logout operations require current session-bound CSRF instead. Identity remains disabled by default. Proxy trust and HTTPS routing remain launch configuration, not automatically enabled by I07.

## Photo input and storage

Accept a single JPEG, PNG or WebP image up to 5 MiB and 16 million decoded pixels. Validate decoded content independently of filename/MIME, reject animation/multiple pages and formats outside that allowlist, rotate from input orientation and re-encode to static WebP with at most 512 by 512 pixels, without enlargement. Do not preserve EXIF/GPS or other source metadata.

Local storage will use a configured directory outside public web assets, random server-generated IDs and authorized API serving; clients cannot supply storage paths or remote fetch URLs. Replace old assets only after the profile change commits; clean staged failures and superseded files. Production storage and retention require launch configuration. This task installs and checks the library; upload/storage routes are I21.

Basis: [Sharp input pixel limits](https://sharp.pixelplumbing.com/api-constructor/) and [output/metadata behavior](https://sharp.pixelplumbing.com/api-output/).

## Email and token storage

I05 binds Mailpit SMTP/inbox to loopback with its pinned image and a reserved `.test` recipient allowlist; no relay is configured. Its dedicated bridge supports published host ports on Docker Desktop; it is not an outbound firewall. See [local email setup](identity-local-email.md). Production SMTP configuration requires TLS and an explicitly configured sender/provider before enabling real invitations. No external provider account has been created.

Transactional outbox token payloads use authenticated AES-256-GCM with a random nonce per payload and a versioned 32-byte key supplied through environment/secret storage. I05 implements encryption, storage constraints and startup configuration checks. Fail closed when the key is unavailable or invalid; keep action-token hashes independently of delivery ciphertext. Scrub payloads after delivery or terminal expiry; retain only operational metadata. I10 implements the bounded delivery/retry/expiry worker; cleanup runs on each explicitly invoked tick. See [delivery contract](identity-action-delivery.md). Key rotation must retain keys for still-pending payloads and must not expose plaintext tokens in logs/audit.

## Trust boundaries and first abuse checks

| Boundary / asset | First checks |
| --- | --- |
| Browser to API / private accounts and sessions | Role/target allowlists, CSRF/Origin, enumeration-safe auth errors, no role injection |
| Token link to state mutation / consent | Explicit POST, purpose/recipient/version validation, expiry, one-time concurrent redemption |
| Account administration to PostgreSQL / administrative access | Parameterized transactions, last-admin serialization, atomic sanitized audit |
| Membership/lifecycle to financial modules / history and obligations | Coordinator proof, stale-preview checks and rollback; unknown obligations block mutation |
| Uploaded bytes to decoder/storage / personal photos | Byte/pixel bounds, actual format validation, metadata removal and authorized reads |
| Database outbox to SMTP / invitation secrets | Encryption, post-commit delivery, bounded retries, no plaintext secret telemetry |

I11's [registration contract](identity-registration.md) uses 30 registration/resend attempts per peer IP per fixed 15-minute window and a separate 30-attempt confirmation IP limit. Counters persist before expensive work, including unknown recipients, using existing V5 scopes. Recipient send limits remain 60 seconds and five per hour; their denials share generic HTTP 202 acceptance with unknown/inactive addresses. Duplicate registration never overwrites an account or automatically resends a link. These are local implementation controls; production proxy and abuse monitoring remain launch prerequisites.

Verification evidence: [identity-verification.md](../tasks/identity-verification.md). Refresh Graphify after these meaningful dependency/security decisions; no automatic rebuild is enabled.
