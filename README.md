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
| apps/customer-web | Customer shell, account access, profiles, families and guardian workflows |
| apps/management-web | Protected management account, role and operational audit screens |
| apps/api | PostgreSQL access, public settings/overview, authenticated Identity and audit services |
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

npm start runs the compiled backend. Frontend outputs are apps/customer-web/dist and apps/management-web/dist. Identity authentication is implemented and locally verified when explicitly enabled; production hosting, email delivery and deployment security configuration remain outstanding. Development component fixtures are not application entry points or included in production builds.

Public GET endpoints: /api/v1/health, /api/v1/ready, /api/v1/settings/public and /api/v1/studio/overview. Settings writes have no public HTTP endpoint; when Identity is enabled, /api/v1/audit provides authenticated, server-authorized management reads. Language preference persists independently per frontend origin. Business timezone is America/Mexico_City; switching language never converts MXN amounts.

See [architecture](docs/architecture.md), [toolchain](tasks/toolchain.md), [Foundation specification](SPEC-foundation.md), [tasks](tasks/todo.md), [visual direction](docs/design/visual-direction.md), [intent](docs/intent/conecta-infusion.md), and business rules in [English](docs/requirements/agreed-business-rules.md) / [Spanish](docs/requirements/agreed-business-rules.es.md). The Spanish PDF is regenerated only on request.

Project MCP connections are in .codex/config.toml; see [MCP setup](docs/mcp-setup.md).

## Identity development

Start with the [Identity setup and handoff](docs/idntityImplementation/identity-setup.md): demo/bootstrap commands, explicit local email delivery, security settings, approved-spec coverage and unresolved domain/production integrations. I01-I40 are technically complete; the user accepted the current Identity scope on October 5, 2026, for merge into develop. Default account deactivation and family departure/closure remain blocked until trusted financial coordinators are implemented.

For fictional personnel, customer and booking records, see the [development demo dataset](docs/development-demo.md) and run `npm run db:seed:demo` after local configuration, migrations and administrator bootstrap.

Identity is opt-in. Follow [local configuration](docs/idntityImplementation/identity-local-email.md), [manual bootstrap](docs/idntityImplementation/identity-bootstrap.md) and the [Identity checklist](docs/idntityImplementation/identity-todo.md). Both frontends share account/session controls; administrative access is checked on the server. I11/I12 supply [customer registration, confirmation and resend endpoints and bilingual screens](docs/idntityImplementation/identity-registration.md). I13/I14 provide [password recovery endpoints and shared bilingual screens](docs/idntityImplementation/identity-recovery.md). I15/I16 add [customer invitation endpoints, management controls and bilingual password setup](docs/idntityImplementation/identity-invitations.md).

I17 adds [paginated management account listing and authorized personal profile edits](docs/idntityImplementation/identity-accounts.md). I18 adds [role administration and last-active-administration protection](docs/idntityImplementation/identity-roles.md). I19 provides [bilingual management account and role screens](docs/idntityImplementation/identity-administration.md). I20 provides [own-profile editing and confirmed email changes](docs/idntityImplementation/identity-profiles.md) in both frontends. I21 adds [private profile photos, replacement cleanup and a demo upload fixture](docs/idntityImplementation/identity-photos.md).

I22 adds [private management audit history](docs/idntityImplementation/identity-audit.md). I23/I24 add [historical family persistence, customer creation and consent-based invitation endpoints](docs/idntityImplementation/identity-families.md); I25 adds bilingual family creation, management assistance and explicit recipient acceptance screens. I26 adds successor responsibility offers with deliberate acceptance/decline and preserved creator identity. The demo seeder includes fictional family fixtures and preserves manual edits and responsibility transfers. Graphify refreshes changed sources automatically every three completed steps; progress is recorded in [the refresh ledger](tasks/graphify-refresh.md).

I27 adds guarded internal family lifecycle contracts; public leave/removal/closure still require credits-bookings integration. I28 adds [no-login dependent persistence, guardian history and reusable child details](docs/idntityImplementation/identity-dependents.md), with fictional demo fixtures and immutable prior-guardian/attendance snapshots. I29 adds private guardian-only profile and owner-only reusable-child endpoints, including atomic conversion; I30 provides bilingual customer child-detail/profile screens, with explicit conversion, current guardians and conflict/error recovery. I31 adds seven-day guardian invitations, explicit recipient consent, minimal management assistance and safe invitation audit history; pending invitations grant no access. I32 adds explicit guardian self-removal and administrator/manager removal of another guardian, with a last-active-guardian guard and preserved booking/family/authorization history. I33 adds guardian-requested independent login through explicit email/password confirmation, preserving the same person and history while ending every guardian authorization; no minimum age or management approval is required. I34 consolidates [relationship permissions, consent coverage and remaining module obligations](docs/idntityImplementation/identity-relationships-review.md). I35 provides [internal lifecycle coordination, stale-preview checks and immutable retry receipts](docs/idntityImplementation/identity-lifecycle.md), conservatively blocking unresolved schemas and owning-module obligations.

I36 adds [guarded account deactivation previews and execution](docs/idntityImplementation/identity-deactivation.md), including guardian/family history, session revocation and administrator protection. Default composition blocks execution until owning booking/credit, teaching and payroll adapters exist. Lifecycle screens follow in I38.

I10 provides single-use action tokens and encrypted email delivery. With local Mailpit settings already loaded, `npm run identity:deliver` runs one bounded delivery tick. See [the delivery guide](docs/idntityImplementation/identity-action-delivery.md) for private env-file usage, retries, cleanup and the production boundary. No background delivery scheduler or production sending is enabled.

Identity access restoration is documented in [reactivation](docs/idntityImplementation/identity-reactivation.md), including renewed prior-guardian consent and the repeat-safe inactive demo fixture. The shared customer/management lifecycle and renewal interfaces were delivered in I38.

Lifecycle screens and current coordination limits: [customer/management lifecycle guide](docs/idntityImplementation/identity-lifecycle-ui.md).
