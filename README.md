# Conecta Infusion

Two React/Vite frontends, a Node.js/Express API, PostgreSQL, and npm workspaces for a studio and café. Foundation includes bilingual branded shells, shared packages, validated settings and transactional audit infrastructure. PostgreSQL/Flyway and live browser verification now run through the isolated integration suite. See [verification evidence](tasks/foundation-verification.md).

## Local setup

Use Node.js 24 and Docker Desktop with Linux containers. From the project root:

```powershell
npm ci
# Copy only if each file does not already exist:
Copy-Item .env.example .env
Copy-Item apps/api/.env.example apps/api/.env
```

Match the API DATABASE_URL to the Compose credentials. Read [migration instructions](docs/database-migrations.md) before initializing or adopting a database. After isolated integration checks pass, a fresh empty database can use:

```powershell
npm run db:up
npm run db:migrate
npm run db:validate
npm run dev
```

Customer: http://localhost:5173. Management: http://localhost:5174. API: http://localhost:3001. Both frontend development servers proxy /api to the backend. Ports are strict. Without a migrated database the shells show an unavailable state with retry.

`db:migrate` uses Flyway. The legacy executable has been retired; original SQL and existing history remain provenance. Existing databases require schema comparison and explicit baseline approval; never reset data to resolve migration errors. `db:flyway:migrate` remains an alias for compatibility.

## Structure

| Location | Responsibility |
| --- | --- |
| apps/customer-web | Customer shell and future public/customer workflows |
| apps/management-web | Separate staff shell; protected operations await Identity |
| apps/api | PostgreSQL access, public settings/overview, internal settings/audit service |
| packages/ui | Tailwind tokens and shadcn/ui components |
| packages/i18n | Spanish/English messages, locale, money and timezone formatting |
| packages/contracts | Shared API types |
| packages/api-client | React-independent HTTP client |
| database/migrations | Versioned Flyway SQL; original SQL retained as provenance |

## Verification and operations

```powershell
npm run typecheck
npm run build
npm test
npx playwright install chromium
npm run test:integration
npm run test:e2e -- --project=chromium
```

Unit tests need no PostgreSQL. Integration tests require Docker and Chromium, use isolated temporary storage on port 55432, and run both frontends against the real API/database. The separate test:e2e suite intercepts API responses to exercise controlled loading/error states and accessibility. Ports 3001, 5173 and 5174 must be free. No lint command is configured.

npm start runs the compiled backend. Frontend outputs are apps/customer-web/dist and apps/management-web/dist. Production hosting and authentication are not configured. Development component fixtures are not application entry points or included in production builds.

Public GET endpoints: /api/v1/health, /api/v1/ready, /api/v1/settings/public and /api/v1/studio/overview. Settings writes and audit reads have no public HTTP endpoints. Language preference persists independently per frontend origin. Business timezone is America/Mexico_City; switching language never converts MXN amounts.

See [architecture](docs/architecture.md), [toolchain](tasks/toolchain.md), [Foundation specification](SPEC-foundation.md), [tasks](tasks/todo.md), [visual direction](docs/design/visual-direction.md), [intent](docs/intent/conecta-infusion.md), and business rules in [English](docs/requirements/agreed-business-rules.md) / [Spanish](docs/requirements/agreed-business-rules.es.md). The Spanish PDF is regenerated only on request.

Project MCP connections are in .codex/config.toml; see [MCP setup](docs/mcp-setup.md).

## Identity development

Identity is opt-in. Follow [local configuration](docs/identity-local-email.md), [manual bootstrap](docs/identity-bootstrap.md) and the [Identity checklist](tasks/identity-todo.md). Both frontends share account/session controls; administrative access is checked on the server. I11/I12 supply [customer registration, confirmation and resend endpoints and bilingual screens](docs/identity-registration.md); personnel invitations remain later tasks. I13/I14 provide [password recovery endpoints and shared bilingual screens](docs/identity-recovery.md).

I10 provides single-use action tokens and encrypted email delivery. With local Mailpit settings already loaded, `npm run identity:deliver` runs one bounded delivery tick. See [the delivery guide](docs/identity-action-delivery.md) for private env-file usage, retries, cleanup and the production boundary. No background delivery scheduler or production sending is enabled.
