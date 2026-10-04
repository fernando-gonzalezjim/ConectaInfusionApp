# Identity persistence and local email setup

I05 adds storage and configuration under the [approved plan](../tasks/identity-plan.md). Login/session enforcement is implemented, I10 supplies token issuance/redemption and the retry/scrubbing worker, and I11 supplies [customer registration endpoints](identity-registration.md). Enabling configuration does not send queued messages; delivery requires an explicit tick. See [verification evidence](../tasks/identity-verification.md) and the separate [bootstrap procedure](identity-bootstrap.md).

## Local inbox

Start only the optional inbox from the project root:

```powershell
docker compose --profile identity up -d --wait mailpit
```

Open `http://127.0.0.1:8025`. SMTP listens on `127.0.0.1:1025`. The pinned `axllent/mailpit:v1.31.4` image has no relay configuration, uses a dedicated bridge network, and binds both published ports to loopback. It accepts only reserved `.test` recipient domains. Version checks and SMTP reverse DNS lookups are disabled. Messages use temporary storage, with a maximum of 100 messages and a 24-hour age limit; removing/recreating the container loses this development inbox. Do not put real customer data into it.

An internal-only network prevented Docker Desktop from creating the published port bindings during verification. The dedicated bridge fixes host access; it is not an outbound firewall. Local capture is enforced by the Mailpit transport, absent relay settings and reserved-domain recipient allowlist. Do not add relay credentials to this development service.

Optional Docker port overrides are `MAILPIT_SMTP_PORT` and `MAILPIT_UI_PORT`; adjust the API's `SMTP_PORT` to match. Tests use separate fixed ports 11025/18025 and remove their own disposable inbox. They do not start or delete your normal inbox.

Stop the local inbox without touching PostgreSQL:

```powershell
docker compose stop mailpit
```

## Private configuration

The [API environment example](../apps/api/.env.example) defaults `IDENTITY_ENABLED=false`, preserving Foundation installations without Identity secrets. When explicitly enabled, startup rejects invalid/missing keys, unknown environments, inconsistent frontend origins and unsafe mail settings before opening the HTTP listener.

For local development, use `NODE_ENV=development`, `IDENTITY_MAIL_TRANSPORT=mailpit`, a loopback SMTP host, an unprivileged SMTP port, a normalized sender email and same-host loopback frontend origins. No SMTP authentication/TLS override is accepted in this mode. Keep the encryption and subject-hash keys private and distinct; never use a shared committed development key.

This command creates an exclusive ignored environment file with fresh random keys, without printing their values or modifying an existing file:

```powershell
@'
import { randomBytes } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
const key = () => randomBytes(32).toString('base64');
mkdirSync('.local/identity', { recursive: true, mode: 0o700 });
const lines = [
  'PORT=3001',
  'DATABASE_URL=postgresql://conecta:conecta_local@localhost:5432/conecta',
  'WEB_ORIGINS=http://localhost:5173,http://localhost:5174',
  'IDENTITY_ENABLED=true', 'NODE_ENV=development', 'IDENTITY_MAIL_TRANSPORT=mailpit',
  'IDENTITY_PUBLIC_ORIGIN=http://localhost:5173', 'IDENTITY_OUTBOX_ACTIVE_KEY_ID=v1',
  'IDENTITY_OUTBOX_KEYS=' + JSON.stringify({ v1: key() }),
  'IDENTITY_THROTTLE_KEY=' + key(),
  'SMTP_HOST=127.0.0.1', 'SMTP_PORT=1025', 'SMTP_FROM=no-reply@conecta.example.test'
];
writeFileSync('.local/identity/email.env', lines.join('\n') + '\n', { flag: 'wx', mode: 0o600 });
console.log('Private local configuration created. No keys printed.');
'@ | node --input-type=module
```

The example database URI is for the existing default local Docker database only; edit it privately if your local configuration differs. On Windows, file privacy also depends on the containing directory's NTFS permissions. Do not commit, upload, log or paste the generated file. A second run refuses to overwrite it: existing pending ciphertext may depend on its keys.

Build and start the API with that file, from the project root:

```powershell
npm run build -w @conecta/api
node --env-file=.local/identity/email.env apps/api/dist/server.js
```

This does not apply migrations. V5 is a forward-only addition; existing data is never reset or automatically baselined. Follow the [migration guide](database-migrations.md) when intentionally applying it to your local database. Production database adoption remains separately reviewed.

## Storage and rotation

- Sessions retain SHA-256-sized token/CSRF hashes and the account session version, with fixed 168-hour or 720-hour expiry. Application checks for account activity, versions and expiry are implemented with login in I06.
- Action tokens retain hashes, explicit purpose, normalized recipient, target and expected versions. Lifetimes are bounded to one hour for recovery, 24 hours for confirmation/setup/change/transition and seven days for relationship invitations. I10 implements atomic consumption and resend invalidation; see [delivery contract](identity-action-delivery.md).
- Abuse counters retain HMAC subject hashes, scope, bounded counts and finite windows. Routes must enforce limits transactionally; persistence alone does not enforce throttling.
- Outbox payloads use AES-256-GCM, 12-byte random nonces, 16-byte tags and at most 16 KiB of ciphertext. Associated data authenticates the key version, outbox row, action-token reference, message kind and recipient hash. Recipients and message bodies belong inside the encrypted payload; the delivery row retains a keyed recipient hash, not a plaintext message/link.
- A terminal delivery state requires clearing ciphertext, nonce, tag and key ID together. The schema bounds retries to five attempts. I10 implements delivery/retry/expiry cleanup on each explicit operator tick. No background scheduler is installed; pending payloads require ticks to be scrubbed at expiry.

`IDENTITY_OUTBOX_KEYS` is a JSON map of version IDs to canonical base64 32-byte random keys (up to eight retained versions). `IDENTITY_OUTBOX_ACTIVE_KEY_ID` selects new encryption. Rotation adds a fresh version and retains old keys while any pending ciphertext still references them. Never replace a key's value under the same ID. Missing old keys fail closed; there is no plaintext fallback. Keep `IDENTITY_THROTTLE_KEY` stable and independent while throttle windows or pending delivery rows depend on it; changing it resets the pseudonymous counter identity and needs planned coordination.

Emails in the account/action-token records are personal data needed for recipient binding. Hashes, ciphertext, key IDs, attempts and timestamps are security/operational records. No raw tokens or SMTP failures are audit/log fields. Production retention, key rotation operations and SMTP deployment still require launch review.

## Production configuration boundary

Staging/production accept only explicit `IDENTITY_MAIL_TRANSPORT=smtp`, a configured DNS SMTP host, normalized `SMTP_FROM`, `SMTP_USER`/`SMTP_PASSWORD`, same-host HTTPS frontend origins, and verified TLS: `SMTP_TLS_MODE=implicit` with port 465 or `starttls` with port 587. Configuration validation does not authorize external sending; no production SMTP connection or provider has been provisioned. The I10 adapter uses these validated settings with certificate checks enabled and logging/debug output disabled; its operator command is local-only.

Primary references: [Mailpit Docker](https://mailpit.axllent.org/docs/install/docker/), [Mailpit runtime options](https://mailpit.axllent.org/docs/configuration/runtime-options/), [pinned image healthcheck](https://github.com/axllent/mailpit/blob/v1.31.4/Dockerfile), [Node authenticated encryption](https://nodejs.org/api/crypto.html#ciphersetaadbuffer-options), [Nodemailer SMTP/TLS](https://nodemailer.com/smtp) and [PostgreSQL constraints](https://www.postgresql.org/docs/17/ddl-constraints.html).
