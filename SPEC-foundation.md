# Spec: Foundation

Module id: `foundation`.
Status: specification approved by the user on October 1, 2026. The subsequent plan and tasks were also approved; implementation is in progress. See tasks/foundation-verification.md for evidence and outstanding checks. Descriptions of the initial scaffold below record the pre-implementation baseline.
Date: October 1, 2026.
Dependencies: none. Consumers: all downstream modules through the [approved capability map](CAPABILITY-MAP.md).

Sources: [confirmed intent](docs/intent/conecta-infusion.md), [agreed business rules](docs/requirements/agreed-business-rules.md).

## Objective

Provide consistent business settings, studio/café identifiers, bilingual presentation, shared responsive UI, and an audit-record contract for the first Conecta Infusion release. Establish a repeatable development and database-migration workflow without implementing bookings, payments, or payroll prematurely.

Success means downstream modules can use these conventions without inventing conflicting language, money, time, business-unit, or audit behavior.

## Confirmed scope and approved defaults

Confirmed: one business initially; separate studio and café financial units; Spanish primary and English supported; Mexico/MXN initial operation; configurable class capacity initially 16; React web, Node.js, PostgreSQL.

Approved project structure: two React frontends (`customer-web` and `management-web`) in the existing npm workspace, shared packages, one Node.js API, and one PostgreSQL database. This structure is included in the approved specification.

Approved development tooling: PostgreSQL runs in Docker Compose; Flyway replaces the custom migration runner; both React frontends and the Node.js backend run locally during development. Full application containers and production hosting remain undecided. Runtime/image selection and migration transition details belong in planning.

Approved frontend tooling: use Tailwind CSS and shadcn/ui for both React frontends, with reusable components and shared brand styling in `packages/ui`. Verify compatible versions and workspace setup during technical planning. This approval records the stack choice; installation and scaffold migration belong to implementation.

Approved defaults:

- Default locale `es-MX`, alternative `en`; business timezone `America/Mexico_City`.
- Accessibility target for shared components: keyboard operation, visible focus, labeled controls, understandable errors, and WCAG 2.2 AA as the approved target to verify during design.
- Language choice persists in the browser before account preferences exist. Identity can later supply an account preference through the same locale interface.

## Tech stack and current state

Retain npm workspaces, TypeScript, React/Vite, Express, the `pg` driver, and PostgreSQL. Current manifests declare React ^19.3.0, Vite ^8.3.1, Express ^5.2.1, pg ^8.23.1, and TypeScript ^7.0.2; package-lock.json records resolved versions. The documented development Node version is 24 and Compose currently selects PostgreSQL 17. This specification does not request dependency upgrades.

Existing code has a PostgreSQL pool, read-only overview endpoint, basic initial-schema runner, and a responsive starter dashboard. It does not yet implement the foundation contracts below. Flyway is not installed or configured. No live PostgreSQL verification has been established by this work.

## Functional requirements

### FND-01: Settings and business units

- Identify the business as Conecta Infusion, with stable financial unit codes `studio` and `cafe`; display labels are translated separately.
- Store business name, country, currency, timezone, default locale, supported locales, and default class capacity in validated settings.
- Capacity must be a positive integer; country/currency/locale/timezone values must be validated against supported values.
- Payment credentials do not belong in public settings. Payment account configuration belongs to payments.
- A settings change must not rewrite historical currency, credit values, payroll rates, or transaction timestamps. Snapshot requirements are implemented by their owning modules.
- Changing default capacity supplies defaults for future sessions; whether existing sessions can be updated is decided in studio-catalog.
- Configurable country/currency does not imply support for foreign settlement or automatic currency conversion. Unsupported operational combinations must not be silently enabled.
- Administrative writes require authorization supplied by identity. Before identity exists, provide internal contracts only; do not expose an unauthenticated settings-write endpoint.

### FND-02: Locale, money, and time conventions

- New visitors see Spanish by default and can explicitly select English.
- Shared navigation, actions, empty/loading/error states, and validation messages have both translations. Do not use translated labels as identifiers.
- Switching languages preserves the current screen and unsaved values and updates the document language.
- API errors expose stable machine-readable codes; the UI maps them to localized messages without showing raw database errors.
- Format money according to the chosen display locale with its actual currency. Language switching never converts currency or changes an amount.
- Carry monetary amounts as integer minor units plus currency; rates and rounding for payroll belong in instructor-payroll.
- Persist event instants in UTC and display business dates in the configured business timezone, regardless of the viewer's device timezone. The exact 30-day and payroll cutoff rules remain in the relevant module specs.
- Translation of customer-facing class descriptions/media metadata needs an explicit content fallback policy in studio-catalog; UI translation must not be mistaken for automatic content translation.

### FND-03: Shared responsive interface

- Implement shared components with the approved Tailwind CSS + shadcn/ui stack in `packages/ui`, customized to the brand palette. Keep app-specific screens and navigation in their respective frontends. Verify accessibility on the finished components and screens rather than treating the tooling choice as proof of compliance.
- Use the supplied logo colors for both frontends as recorded in [visual direction](docs/design/visual-direction.md). The palette and functional companions are approved as the working visual baseline; exact logo matching and contrast still require verification.
- Define reusable colors, typography, spacing, buttons, inputs, dialogs, alerts, navigation, and loading/empty/error states.
- Shared components must support Spanish and English text lengths, keyboard use, focus restoration after dialogs, and errors associated with their controls.
- Approved verification viewports: 360, 768, and 1440 CSS pixels. Core navigation and forms must remain usable without horizontal page scrolling; wide data tables may use an explicitly contained scroll area.
- Error states must provide a useful next action where possible; loading and retry must not erase completed form entries.
- This is a shared component/shell contract. Public-home owns the actual public starting-page layout; each feature owns its customer/staff screens. Visual identity remains open for design review.

### FND-04: Audit contract

- Provide an internal append-only audit interface for downstream mutations, with event ID, timestamp, actor ID/type, action, target type/ID, optional business unit, approved change details, reason when required, and correlation ID.
- Identity provides authenticated actor context. Consumers supply business-specific actions and allowed audit fields; foundation must not trust client-supplied actor identity.
- Security-sensitive and financial mutations must commit their audit record in the same database transaction as the change. If audit persistence fails, the mutation rolls back.
- Do not store passwords, tokens, card details, or unrestricted request bodies in audit records. Each consumer selects necessary fields rather than logging arbitrary objects.
- Corrections append a new record referencing the original; application operations do not overwrite or delete historical audit entries.
- This audit trail is not the credit ledger, financial ledger, or a payroll calculation source. Those modules own their records and link them to audit events.
- Reading audit history requires consumer-specific authorization. Retention and administrative database access remain open decisions; append-only application behavior does not imply protection against database administrators.

## Provider interfaces

Proposed internal contracts; HTTP routes are defined only when a consumer and its authorization exist:

- Settings: read validated public settings separately from internal configuration; update validated settings within an authorized transaction and emit audit history.
- Formatting/localization: locale selection, message lookup, money formatting, business-time formatting.
- Audit: append a typed event using the caller's existing transaction and trusted actor context.
- Shared UI: accessible components with text provided through translation keys or translated content.

Example contract style (illustrative, not implemented):

```typescript
export type BusinessUnitCode = 'studio' | 'cafe';

export interface Money {
  amountMinor: number;
  currency: string;
}
```

Use camelCase for TypeScript values, PascalCase for types, explicit exported contracts, and stable kebab-case module identifiers. Follow existing single-quoted TypeScript imports and semicolons. Validate values at runtime; types alone do not validate requests. Use parameterized SQL for external values.

## Development and migration requirements

- Document a clean setup, environment variables, database startup, schema migration, and verification without embedding real credentials.
- Keep persistent development database storage; restarts must not delete data.
- Use the approved Flyway tooling: choose and pin its runtime during planning, establish its migration directory/history as authoritative, and update the npm command to invoke it. Do not run Flyway and the custom runner as independent migration authorities against the same schema.
- Support a fresh empty database and a database initialized by the existing runner. Compare existing schema before any baseline; never auto-baseline an unknown database or discard it to make migration succeed.
- Applied migrations are immutable. Schema changes use new versioned migrations; validation must detect unintended changes to applied migration content.
- A failed migration must return failure and preserve a diagnosable state. Transactional guarantees must be specified for the actual statements and PostgreSQL configuration used.
- Review the transition before retiring the existing `schema_migrations` runner/history. No destructive reset is part of normal startup or tests.

## Commands

Current commands, from the project root:

```powershell
npm ci
npm run db:up
npm run db:migrate
npm run dev
npm run typecheck
npm run build
npm test
```

`db:up` currently needs Docker; `db:migrate` currently invokes the custom TypeScript runner, not Flyway. `npm test` currently runs only API tests. These commands must be updated/documented when tooling changes. No lint, UI-test, or Flyway command is claimed to exist yet; the plan must select tooling and define executable commands before the corresponding implementation tasks.

## Project structure

Existing: `apps/api/src`, `apps/api/test`, `apps/web/src`, `packages/contracts`, `database`, and `compose.yaml`.

Approved target layout (not yet implemented):

```text
apps/
  customer-web/       Public home, schedules, purchases, bookings, family credits
  management-web/     Management, reception, caf? staff, instructor operations
  api/                One backend for both frontends
packages/
  ui/                 Shared React components and design tokens
  i18n/               Shared translations and locale/formatting utilities
  contracts/          API request/response types
  api-client/         Shared API communication and error handling
```

- Keep both frontends in the existing npm workspace; give each its own entry point, routes, navigation, build, and development server. Separate production deployments are possible but are not selected here.
- Instructors use management-web with permissions limited to their own assigned work and payment history. Customers use customer-web; the public home page lives there as well.
- Frontends consume shared packages, never import one another's source. Keep feature-specific workflows and screens in their owning app rather than forcing them into shared UI.
- Shared packages must not import either frontend or server implementations. Contracts remain types; api-client handles communication, not pricing, credit allocation, or payroll calculations.
- Backend business rules and authorization remain authoritative for both apps. Hiding a route or splitting apps is not access control. Identity must specify session handling, API origin policy, and users who have both staff and customer roles.
- Common translations live in i18n; app-specific messages can remain with their feature while using the shared translation interface.
- Add `apps/api/src/modules/foundation` for settings/audit adapters. Keep database access and secrets in the backend.
- During implementation, split/replace the existing apps/web scaffold without maintaining an accidental third frontend. Update workspace scripts, lockfile, build output paths, development proxies, documentation, and checks for both applications. Choose concrete ports and package names in the plan.
- Future native mobile can reuse compatible API contracts/client utilities; React web UI components are not assumed to be native-compatible.
- Select migration layout and frontend test locations during planning.

## Testing strategy and acceptance examples

Reuse Node's test runner for API/domain checks; test database behavior against real isolated PostgreSQL. Select a frontend test/browser tool during planning. There is no agreed numeric coverage threshold; every requirement needs observable evidence, including error and permission boundaries.

| ID | Scenario and expected result |
| --- | --- |
| FND-A01 | Fresh setup exposes Conecta Infusion, studio/cafe, es-MX, MXN, and capacity 16; invalid capacity is rejected without changing settings |
| FND-A02 | Switching Spanish to English preserves screen/form values, changes shared labels and document language, and survives reload |
| FND-A03 | 15000 minor MXN units always represent 150 MXN in either locale; a different device timezone does not alter the business session time |
| FND-A04 | A settings change and its audit append both commit, or neither commits on an induced audit failure |
| FND-A05 | A correction creates a second audit record; the original remains unchanged; credentials are absent from stored audit fields |
| FND-A06 | Public settings contain no payment credentials; an unauthenticated caller cannot mutate settings or read private audit history |
| FND-A07 | Shared forms/navigation work with keyboard and both languages at the proposed widths; loading, empty, failure, and retry states are exercised |
| FND-A08 | With Flyway: fresh migration succeeds, rerunning creates no duplicate schema, and modifying an applied migration fails validation |
| FND-A10 | Both frontends build and run separately in the npm workspace; shared packages resolve without cross-app imports; neither frontend bundles database code or credentials |
| FND-A11 | In each frontend, shared components and language switching pass the same responsive and locale checks; backend access tests reject customer access to staff-only data regardless of which frontend sends the request |
| FND-A09 | An existing initial-schema fixture transitions without losing rows; incompatible schema fails with an explicit error, not an automatic baseline |

A08/A09 apply to the selected migration implementation; they must not be marked passed based on mocks or unavailable Docker. Authorization integration is verified with identity before protected screens ship.

## Boundaries

- Always: preserve agreed business rules, validate settings, keep secrets out of public contracts/audits, document changed setup, and run checks relevant to changed behavior.
- Ask first: resolve the open product/tooling choices below, destructive migration or baseline actions against existing data, deployment, or a change to the agreed scope. Routine implementation within an approved plan does not require repeated confirmation.
- Never: silently enable unsupported country/payment combinations, expose unauthenticated administrative writes, rewrite historical financial records when settings change, bypass failed migration checks, or claim unexecuted database/browser checks passed.

## Approval and deferred details

1. **Approved:** Docker Compose for local PostgreSQL, Flyway for migrations, and both React apps plus the Node.js backend running locally during development.
2. **Approved:** es-MX by default with English available, America/Mexico_City business timezone, browser language persistence, responsive viewport checks, and the WCAG 2.2 AA accessibility target.
3. Refine typography, layouts, and functional color combinations around the approved logo palette in [visual direction](docs/design/visual-direction.md); also define the precise settings administrators may change after transactions exist.
4. Define audit retention and authorized viewers with identity and the financial modules.
5. **Approved:** Tailwind CSS + shadcn/ui for both frontends, with shared components and brand styling in `packages/ui`; exact versions and setup remain for technical planning.

The complete Foundation specification and linked visual direction are approved. Items 3 and 4 remain explicitly deferred details; approval does not supply missing typography, retention periods, or permission policies. The separately approved plan and task list are in tasks/plan.md and tasks/todo.md; implementation status is tracked there.
