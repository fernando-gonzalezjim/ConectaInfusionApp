# Architecture

The [approved Foundation spec](../SPEC-foundation.md), [capability map](../CAPABILITY-MAP.md), and [business rules](requirements/agreed-business-rules.md) define scope. See [implementation evidence](../tasks/foundation-verification.md) for current limitations.

## Frontend boundaries

Customer and management are independent React/Vite applications in one npm workspace. They can evolve separate navigation and deployment while sharing design components, translations, API types and transport. Neither app imports the other. Both use Tailwind v4 and shared shadcn/ui source components, with logo-derived accents and darker accessible functional colors. The finished public homepage belongs to public-home.

Shared packages have explicit exports. UI/provider packages declare React peers. Vite compiles shared TypeScript source; the API consumes contracts only as types. Future native clients can reuse compatible contracts/transport, but web components are not native components.

## API and persistence

One Express backend owns PostgreSQL and business behavior. GET /api/v1/settings/public exposes only display name, currency, timezone, supported/default locales and translated business-unit labels. Capacity and payment credentials are not public settings. The existing overview endpoint reads classes/products. Missing data infrastructure returns failure, not sample business data.

Settings validation rejects unknown keys, unsupported country/currency/locales, invalid timezones and nonpositive capacities. Internal updates lock the singleton and append allowlisted before/after audit data in the same transaction. The current writer is settings-specific; later modules must supply typed allowed payloads and trusted actor context. Audit records support correction references and mutation-rejection triggers. This is not a financial ledger or protection against a database administrator.

No unauthenticated settings write or audit read routes exist. Separating frontends and restricting CORS do not provide authorization. Identity must supply server-side session and permission enforcement before protected workflows ship.

PostgreSQL runs in Compose; apps run on the host. Flyway migrations are configured, but live verification and retirement of the original runner remain pending. Follow [migration transition instructions](database-migrations.md); do not treat both runners as authorities. Initial domain tables remain a scaffold, not the final booking/credit/payroll schema.

## Language, money and dates

Spanish is the default, English an explicit choice stored separately for each browser origin. Switching language preserves screen state and updates document language. Money is integer minor units plus currency; formatting never performs conversion. Dates render in the business timezone regardless of device timezone. UI translation does not automatically translate class descriptions or media metadata.

## Verification boundaries

Node tests cover validation, formatting, transport and API outage behavior. Browser tests exercise shared controls and both frontends using intercepted responses. Isolated PostgreSQL integration tests cover migration and transactional behavior, but need Docker. Deployment, production authentication, financial workflows and full WCAG review remain future work or explicit outstanding checks.
