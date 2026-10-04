# Manual Identity bootstrap

I04 implements operator tools, not login endpoints. Follow the approved [specification](../SPEC-identity.md) and [implementation plan](../tasks/identity-plan.md). Accounts become usable through the app only after the session/login tasks are implemented.

## Prepare the local database

Build the API with `npm run build -w @conecta/api`. Start the local PostgreSQL service and apply reviewed forward migrations through the existing `npm run db:up` / `npm run db:migrate` workflow. Never reset or baseline an existing database automatically. Bootstrap requires the Identity tables and audit support from V3/V4; migrations and app startup create no accounts.

Set these values in the PowerShell terminal used for local fixture commands. Use your actual local database connection; this example uses the project's public development defaults:

```powershell
$env:NODE_ENV = 'development'
$env:IDENTITY_DEV_FIXTURES = 'true'
$env:DATABASE_URL = 'postgresql://conecta:conecta_local@127.0.0.1:5432/conecta'
```

For an existing private env file, Node also supports `--env-file=apps/api/.env`; fixture opt-in must still be explicit. Do not commit actual env files.

The fixture commands require a loopback host (`localhost`, `127.0.0.1`, or `::1`) and a known local database name: `conecta`, `conecta_dev`, `foundation_browser`, or an isolated `test_` database with a 32-character hexadecimal suffix. Unknown/staging/production environments, remote hosts, URL query overrides and unknown database names fail closed. Do not point these tools at a tunnel to a real database. No production fixture procedure is supported.

## First administrator: generate, review, insert manually

```powershell
node scripts/identity-bootstrap.mjs admin-sql --development --operator 'your-operator-name' --output .local/identity/first-admin.sql
```

Generation creates a new SQL file, never connects to PostgreSQL or inserts the administrator. It uses the normal Argon2id format for the approved local `admin@conecta.example.test` / `admin` fixture. The account has the administrator role, a development-fixture marker and an explicit manual-bootstrap confirmation exemption; it does not claim the mailbox was verified.

Review the file, confirm the intended database and apply it manually using your SQL client. With `psql`, use error stopping:

```powershell
psql --dbname="$env:DATABASE_URL" --set=ON_ERROR_STOP=1 --file=.local/identity/first-admin.sql
```

For the default Docker service when `psql` is not installed locally:

```powershell
Get-Content -Raw .local/identity/first-admin.sql | docker compose exec -T db psql -U conecta -d conecta --set=ON_ERROR_STOP=1
```

Adjust the database/user arguments if your local settings differ. The SQL checks its development database name, locks bootstrap operations transactionally and refuses an existing administrator/manager role. It inserts the person, account, administrator role and sanitized operator audit event together. A failed manual execution must be rolled back; close the SQL-client connection or execute `ROLLBACK` before proceeding. Do not replay the script as a recovery or password-reset tool.

Existing output files are never overwritten. SQL includes a password hash and must remain in a private operator directory; `.local/` is ignored by Git. Unix creation modes are restrictive; on Windows, use a directory with private inherited NTFS permissions. Do not print the generated file into logs, commit it, or store it under `database/migrations`.

## Development testuser: requires that existing administrator

After manually applying the administrator SQL:

```powershell
node scripts/identity-bootstrap.mjs testuser --development
```

The command asks for the development administrator's password without echoing it. It verifies the target database, active administrator/person, approved admin fixture provenance, administrative role and password before creating `testuser@conecta.example.test` / `testuser` with the customer role. Creation is transactional with admin-attributed audit and a distinct management confirmation exemption.

A healthy unchanged fixture returns `already_exists` without changing its hash, roles or audit. A matching real/pending/inactive account, changed credentials/roles or conflicting provenance causes an error without overwriting or reactivating it. No ordinary customer's password can be set to their account name through this command.

The helper is operator-only and cannot bypass regular invitation/password setup rules. Future normal account-creation routes will reuse the approved permission/audit conventions, not the fixture's shorter-password exception. I06 must reject development fixture identities outside development even if a fixture database is copied.

## Normal administrator credentials

For a separately approved normal bootstrap, the generator accepts explicit account details and prompts twice for a private password:

```powershell
node scripts/identity-bootstrap.mjs admin-sql --email 'owner@example.test' --name 'Studio owner' --operator 'your-operator-name' --output .local/identity/owner-admin.sql
```

This offline generator does not provision production accounts or deliver email. Normal passwords follow the [recorded policy](identity-decisions.md): 15–128 Unicode code points with no trimming or normalization. Reserved fixture email identities cannot be generated as untagged normal accounts. Password arguments, environment-password shortcuts and piped passwords are unsupported; use the hidden interactive prompt. Production bootstrap/application requires its separate operator review and launch configuration.

## Verification and errors

Build first, then run `node --test apps/api/test/identity-passwords.test.mjs apps/api/test/identity-bootstrap-command.test.mjs`. The existing `npm run test:integration` discovers the bootstrap PostgreSQL tests automatically in the disposable database.

Errors identify configuration, authentication, conflicting fixture or existing output without printing credentials, connection strings, SQL or raw database failures. `PASSWORD_WORK_BUSY` indicates bounded hash work; retry after current operations finish. Do not lower hash costs or disable guards to clear it.

References: [node-argon2 options](https://github.com/ranisalt/node-argon2/wiki/Options), [node-postgres transactions](https://node-postgres.com/features/transactions), [verification evidence](../tasks/identity-verification.md).
