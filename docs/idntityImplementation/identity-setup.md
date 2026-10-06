# Identity setup and handoff

I01-I40 deliver the locally implemented Identity capability under the [approved specification](SPEC-identity.md) and [plan](identity-plan.md). Runtime regression evidence is in [I39 verification](identity-verification.md#i39-verification-runner-and-regression-october-5-2026). The user accepted Identity for the current scope on October 5, 2026, and authorized merge into develop; this is not production approval. Some older step guides describe their state at delivery time; this guide records the current handoff.

## Start the existing development demo

Use Node.js 24, Docker Desktop with Linux containers and installed Chromium for browser tests. The ignored root `dev.env` holds private database, Identity, photo and inbox settings. Do not print it, commit it or replace its encryption keys while messages are pending. For another checkout, prepare private configuration using [local email setup](identity-local-email.md), [the API example](../../apps/api/.env.example) and [demo configuration](../development-demo.md); `dev.env` is intentionally not distributed through Git. Node env-file values do not override existing process environment values, so remove conflicting overrides before running commands.

The existing demo uses Docker project `conecta-demo`, database `conecta_dev`, PostgreSQL port 5433 and local inbox ports 1026/8026. From the root:

```powershell
npm ci
npm run db:up:demo
npm run db:migrate:demo
npm run build -w @conecta/api
```

For a fresh database only, generate the first administrator SQL, review it privately and apply it manually. Migrations, startup and demo seeding never create the first administrator:

```powershell
node --env-file=dev.env scripts/identity-bootstrap.mjs admin-sql --development --operator local-developer --output .local/identity/first-demo-admin.sql
# Review the generated file in your editor before applying it to the intended local database.
Get-Content -Raw .local/identity/first-demo-admin.sql | docker compose --env-file dev.env -p conecta-demo exec -T db psql -U conecta -d conecta_dev --set=ON_ERROR_STOP=1
```

The generated file contains a password hash and must stay private. Output files are never overwritten; existing administration is not reset. If administration already exists, skip this bootstrap. See [manual bootstrap](identity-bootstrap.md) for safeguards, normal credentials and conflict recovery. Optional requested development `testuser` creation, after the approved fixture administrator exists:

```powershell
node --env-file=dev.env scripts/identity-bootstrap.mjs testuser --development
```

Then seed fictional data and start the API and both frontends:

```powershell
npm run db:seed:demo
npm run dev:demo
```

Customer: `http://localhost:5173`; management: `http://localhost:5174`; API: `http://localhost:3001`; demo inbox: `http://127.0.0.1:8026`. Close other app servers first. Sign in with email, not display name:

| Local account | Password | Use |
| --- | --- | --- |
| `admin@conecta.example.test` | `admin` | Manually bootstrapped development administrator |
| `testuser@conecta.example.test` | `testuser` | Optional separately created development customer |
| `manager@demo.conecta.example.test` | `ConectaDemo!2026` | Management and customer workflows |
| `reception@demo.conecta.example.test` | `ConectaDemo!2026` | Customer invitations and own profile; no management authority |
| `instructor.yoga@demo.conecta.example.test` | `ConectaDemo!2026` | Instructor invitation and own-profile permissions |
| `customer.profile@demo.conecta.example.test` | `ConectaDemo!2026` | Profile/photo and guardian checks |

The [dataset guide](../development-demo.md) lists all fixtures and dependent scenarios. Pending/inactive accounts cannot sign in. Reseeding preserves manual edits, credentials, ended relationships and transitions. `db:clean:demo` deletes the entire development public schema, including manually created administration and audit history; it is not a routine setup or troubleshooting step. No reset or new fictional records are needed for I40.

## Deliver local action emails

Invitations and registration commit encrypted outbox records; starting the app does not send them. In a second terminal, after building the API:

```powershell
node --env-file=dev.env scripts/identity-delivery.mjs --once
```

This processes one bounded batch of up to ten records. Repeat after further actions or when a retry becomes due. Open the message in the demo inbox and deliberately confirm the action in the app; viewing a link alone does not accept an invitation. Only fictional reserved `.test` recipients are supported by local Mailpit. The delivery command rejects nonlocal databases and production SMTP. See [delivery/retry and key-rotation details](identity-action-delivery.md) and [inbox configuration](identity-local-email.md).

## Security configuration and operating boundaries

| Area | Current contract |
| --- | --- |
| Identity enablement | `IDENTITY_ENABLED=true` explicitly enables routes; disabled Foundation installations need no Identity keys. Invalid enabled configuration fails before listening. |
| Origins and transport | `WEB_ORIGINS` is an exact allowlist; `IDENTITY_PUBLIC_ORIGIN` supplies action-link URLs. Development frontends use the same loopback hostname and `/api` proxies. HttpOnly host-only sessions are shared across ports; a management URL grants no permission. Production initially requires one HTTPS host. |
| Sessions and mutations | Opaque session and CSRF hashes are stored server-side. Cookie access, account activity, roles, versions and expiry are checked by the API. Logout, reset, role changes and deactivation invalidate access as specified. Origin/CSRF checks and bounded inputs protect mutations. |
| Secrets | `IDENTITY_OUTBOX_KEYS` maps key IDs to independent random 32-byte base64 keys; `IDENTITY_OUTBOX_ACTIVE_KEY_ID` chooses the writing key. `IDENTITY_THROTTLE_KEY` is separate. Keep old outbox keys until encrypted pending records no longer need them; never disclose secrets in logs/audit. |
| Passwords and fixtures | Normal passwords use Argon2id and the recorded 15-128-code-point policy. Short public fixture passwords require explicit development provenance/opt-in and an approved local database; copied fixtures are rejected outside development. |
| Profile photos | `IDENTITY_PHOTO_DIRECTORY` is an absolute private path, under `.local` when inside this workspace. Missing storage makes photo operations unavailable. Authorized JPEG/PNG/WebP uploads are bounded, re-encoded and served privately; see [storage/cleanup limits](identity-photos.md). |
| Audit and retention | Admin/management can read allowlisted operational audit; ordinary personnel cannot. Mutations and sanitized audit commit together. Deactivation preserves history, not an assertion of personal-data erasure. Production retention and erasure handling remain to be defined. |

## Approved-specification coverage

Numbers below match the ten [specification acceptance scenarios](SPEC-identity.md#acceptance-scenarios). Tests and step-by-step evidence remain in the [verification record](identity-verification.md); a graph relationship is not proof of implementation.

| Scenario | Delivered and verified locally | Remaining boundary |
| --- | --- | --- |
| 1: Bootstrap and fixtures | Reviewed offline SQL generation/manual insertion, explicit confirmation exemption, email logins, guarded repeat-safe fixture creation, nondevelopment rejection. | Production operator bootstrap and secrets require separate review. |
| 2: Self-registration | Customer-only pending account, one-use confirmation, expiry/resend and duplicate protection. | Production email delivery. |
| 3: Instructor administration | Management account/profile and role administration; direct unauthorized target/field changes denied. Invite an account, complete password setup, then assign personnel roles through management. | Instructor catalog, media, rates and schedules belong to studio-catalog; deactivation needs domain coordination. |
| 4: Staff and customer permissions | Staff/instructors can invite customers and edit themselves; only management edits other accounts or changes roles. Exempt creation requires management, audited provenance and password setup. | Whole-account deactivation remains coordinated, as below. |
| 5: Self-service and final administration | Own-profile protection, role denials, concurrent final-administration protection, explicit self-deactivation preview/confirmation and management retries. | Default deactivation is blocked until all required domain adapters exist. |
| 6: Invitations | Email required, recipient consent/password setup, normal and management-exempt flows, all personnel invitation roles, no self-promotion. | Real recipients and production SMTP are not authorized by local verification. |
| 7: Sessions | Login/logout/reset/revocation, shared real browser cookies, Origin/CSRF checks across both frontends and stale-session races. | Production HTTPS/reverse-proxy configuration. |
| 8: Atomic lifecycle/history | Transaction-bound coordinators, read-only previews, immutable retry receipts, version checks, history/provenance and complete rollback on failure. | Real two-hour cancellation/credit effects at before/exact/inside cutoff, refunds/expiry and teaching/payroll effects require their owning modules. Test adapters do not complete these rules. |
| 9: Bilingual accessible account flows | Spanish/English controlled and live Chromium, keyboard/error/loading checks; Foundation layouts at 360/768/1440 and targeted Identity accessibility checks. | Future domain interfaces need their own responsive/accessibility checks; this is not an exhaustive accessibility certification. |
| 10: Families and dependents | One active family, invitation acceptance, successor consent/authority, no-login dependents, saved child details, authorized guardians, last-guardian concurrency, independent transition and prior-guardian renewal/reactivation. | Family credit sharing/disposition, public departure/closure execution and parent/dependent booking behavior require credits-bookings. No standalone dependent-deactivation endpoint is invented. |

## Domain integration and production handoff

Identity supplies active roles, staff-attendance eligibility, membership and guardian facts. It does not implement purchases, free attendance reservations/displacement notifications, consumed-credit valuation or instructor earnings. Removing personnel eligibility must coordinate future free bookings while preserving paid bookings; teaching sessions require explicit reassignment/cancellation and earned pay remains owed. See [roles](identity-roles.md), [lifecycle contracts](identity-lifecycle.md), [deactivation](identity-deactivation.md) and [reactivation](identity-reactivation.md).

Account lifecycle previews remain blocked under default application composition without every required coordinator, even for apparently empty domain tables. Family leave/close controls explain their unavailable state and have no invented public success route. Do not unblock them by removing guards or assuming zero obligations. Credits-bookings must implement credit ownership, unused/unreserved withdrawal or donation, family closure returns, reservation preservation, expiry and the two-hour cancellation rule transactionally. Studio-catalog and instructor-payroll must implement teaching resolution and retained earnings. Customer/instructor scoped transaction and payment-history screens also belong to the future financial modules; the operational audit viewer is not a substitute.

Before production, review SMTP provider/sender/domain and delivery scheduling, HTTPS/same-host routing and trusted proxy policy, secrets/rotation, reviewed normal-admin bootstrap, durable private photo storage/backups/cleanup monitoring, and personal-data retention/erasure handling. Native/mobile transport and multiple hosts require a separate design. No real invitations, production deployment or automated payout is authorized by this handoff.

## Human review and verification

Use the existing fictional fixtures to review: management versus staff/instructor/customer permissions; customer invitations and inbox setup; profile/email/photo editing; family invitations and responsibility transfer; guardian consent/removal/independent transition; blocked deactivation and access-only restoration. Repeat in Spanish and English and confirm denied direct API operations using the detailed guides. The user accepted this coverage and the [recorded evidence](identity-verification.md) for the current Identity scope and authorized merge into develop on October 5, 2026. Future domain integrations and production readiness require their own verification and review.

I39 passed workspace typecheck/build, 70 unit/client/translation checks, 163 backend integration tests, 166 controlled Chromium cases and 35 live Chromium workflows, including migrations and teardown. Commands remain:

```powershell
npm run typecheck
npm run build
npm test
npm run test:integration
npm run test:e2e -- --project=chromium
```

Integration uses its own temporary test database and inbox; it does not reset the demo. Graphify remains the I38 snapshot with two completed steps since refresh (I39/I40). New handoff documents are not yet graphed; the next approved capability step triggers the scheduled changed-source refresh. See [cadence and snapshot limits](../../tasks/graphify-refresh.md). English/Spanish business rules and the two on-demand PDF snapshots are unchanged.
