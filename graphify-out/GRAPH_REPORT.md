# Graph Report - ConectaInfusionApp  (2026-10-11)

## Corpus Check
- 344 files · ~212,354 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 7 file(s) not represented in the graph (top: (none) 3, .example 2, .toml 1)

## Summary
- 2304 nodes · 4914 edges · 163 communities (109 shown, 54 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 67 edges (avg confidence: 0.85)
- Token cost: unavailable historically; this pure-code refresh uses structural AST extraction, with no semantic host call or external API.

## Community Hubs (Navigation)
- Studio Catalog Content and Authorization
- Identity Accounts and Consent
- Identity Accounts and Consent
- Identity Accounts and Consent
- Shared Contracts and Clients
- Shared Contracts and Clients
- Identity Accounts and Consent
- Spec: Foundation
- Shared Contracts and Clients
- Identity Accounts and Consent
- Studio Catalog Content and Authorization
- Shared Contracts and Clients
- Identity Accounts and Consent
- Studio Catalog Content and Authorization
- Database Schema and Migrations
- Identity Accounts and Consent
- Identity Accounts and Consent
- Identity Accounts and Consent
- Shared Contracts and Clients
- customer-web/package.json
- management-web/package.json
- Studio Catalog Content and Authorization
- Shared Contracts and Clients
- Identity Accounts and Consent
- Shared Contracts and Clients
- Bilingual Business Rules
- scripts
- Identity Accounts and Consent
- Identity Accounts and Consent
- Verification and Task Tracking
- Bilingual Business Rules
- Identity Accounts and Consent
- Shared Contracts and Clients
- Studio Catalog Content and Authorization
- Verification and Task Tracking
- Backend Services and Authorization
- Database Schema and Migrations
- Shared Contracts and Clients
- Identity Accounts and Consent
- Identity Accounts and Consent
- Backend Services and Authorization
- Identity Accounts and Consent
- i18n/package.json
- customer-web/components.json
- management-web/components.json
- ui/components.json
- Identity Accounts and Consent
- Database Schema and Migrations
- Database Schema and Migrations
- Database Schema and Migrations
- Identity Accounts and Consent
- Studio Catalog Content and Authorization
- compilerOptions
- compilerOptions
- Database Schema and Migrations
- Database Schema and Migrations
- Studio Catalog Content and Authorization
- ui/package.json
- compilerOptions
- Identity Accounts and Consent
- Studio Catalog Content and Authorization
- compilerOptions
- Identity Accounts and Consent
- Backend Services and Authorization
- Identity Accounts and Consent
- Studio Catalog Content and Authorization
- Backend Services and Authorization
- Backend Services and Authorization
- Backend Services and Authorization
- Database Schema and Migrations
- Database Schema and Migrations
- Identity Accounts and Consent
- Identity Accounts and Consent
- Shared Contracts and Clients
- Shared Contracts and Clients
- Backend Services and Authorization
- Backend Services and Authorization
- /graphify
- Database Schema and Migrations
- Studio Catalog Content and Authorization
- Database Schema and Migrations
- Shared Contracts and Clients
- dependencies
- graphify reference: query, path, explain
- graphify reference: incremental update and
- Backend Services and Authorization
- Backend Services and Authorization
- Backend Services and Authorization
- Capability map: Conecta Infusion
- Commit and push
- graphify reference: extra exports and
- graphify reference: extraction subagent prompt
- Studio Catalog Content and Authorization
- Database Schema and Migrations
- Studio Catalog Content and Authorization
- Backend Services and Authorization
- Backend Services and Authorization
- Backend Services and Authorization
- Database Schema and Migrations
- Backend Services and Authorization
- Conecta Infusion: confirmed product intent
- Shared Contracts and Clients
- graphify reference: add a URL
- graphify reference: GitHub clone and
- graphify reference: commit hook and
- graphify reference: transcribe video and
- Agent instructions
- Backend Services and Authorization
- Backend Services and Authorization
- MCP connections for Codex
- exports
- peerDependencies
- commitAndPush.prompt.md
- components.html
- customer-web/index.html
- management-web/index.html
- Identity Accounts and Consent
- Identity Accounts and Consent
- Identity Accounts and Consent
- Identity Accounts and Consent
- Identity Accounts and Consent
- Identity Accounts and Consent
- Identity Accounts and Consent
- Identity Accounts and Consent
- Identity Accounts and Consent
- Identity Accounts and Consent
- Identity Accounts and Consent
- Identity Accounts and Consent
- Identity Accounts and Consent
- Identity Accounts and Consent
- Identity Accounts and Consent
- Identity Accounts and Consent
- Identity Accounts and Consent
- Identity Accounts and Consent
- Identity Accounts and Consent
- Identity Accounts and Consent
- Identity Accounts and Consent
- Identity Accounts and Consent
- Identity Accounts and Consent
- Identity Accounts and Consent
- Identity Accounts and Consent
- Identity Accounts and Consent
- Identity Accounts and Consent
- Identity Accounts and Consent
- Identity Accounts and Consent
- Identity Accounts and Consent
- Identity Accounts and Consent
- Identity Accounts and Consent
- Identity Accounts and Consent
- Identity Accounts and Consent
- shadcn/ui source attribution

## God Nodes (most connected - your core abstractions)
1. `pg` - 59 edges
2. `AuthError` - 45 edges
3. `Studio Catalog implementation checklist` - 45 edges
4. `Spec: Studio Catalog` - 40 edges
5. `isolatedDatabase()` - 39 edges
6. `migrate()` - 39 edges
7. `@playwright/test` - 39 edges
8. `createApiClient()` - 35 edges
9. `Conecta Infusion: reglas de negocio acordadas` - 33 edges
10. `Conecta Infusion: agreed business rules` - 33 edges

## Surprising Connections (you probably didn't know these)
- `Conecta Infusion: reglas de negocio acordadas (PDF snapshot)` --semantically_similar_to--> `Conecta Infusion: reglas de negocio acordadas`  [INFERRED] [semantically similar]
  docs/requirements/agreed-business-rules.es.pdf → docs/requirements/agreed-business-rules.es.md
- `Settings update and audit atomic singleton lock` --semantically_similar_to--> `Transactional append-only sanitized audit`  [INFERRED] [semantically similar]
  docs/architecture.md → SPEC-foundation.md
- `LoginResult` --references--> `PublicAccount`  [EXTRACTED]
  apps/api/src/modules/identity/sessions.ts → packages/contracts/index.d.ts
- `submit()` --indirect_call--> `token()`  [INFERRED]
  packages/ui/src/components/password-recovery.tsx → apps/api/test/integration/identity-invitations.test.mjs
- `submit()` --indirect_call--> `locale()`  [INFERRED]
  packages/ui/src/components/dependent-access.tsx → apps/api/src/modules/identity/child-details.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Next-day capacity policy and existing-session exception preserve bookings** — docs_studiocatalogimplementation_spec_studio_catalog_capacity_effective_date, docs_studiocatalogimplementation_spec_studio_catalog_capacity_exception, docs_studiocatalogimplementation_spec_studio_catalog_authoritative_availability [EXTRACTED 1.00]
- **Catalog facts coordinate with downstream ownership without fabricating financial outcomes** — docs_studiocatalogimplementation_spec_studio_catalog_catalog_ownership, docs_studiocatalogimplementation_spec_studio_catalog_authoritative_availability, docs_studiocatalogimplementation_spec_studio_catalog_notification_coordination, docs_studiocatalogimplementation_spec_studio_catalog_offer_allocation [EXTRACTED 1.00]

## Communities (163 total, 54 thin omitted)

### Community 0 - "Studio Catalog Content and Authorization"
Cohesion: 0.06
Nodes (35): address(), object(), PendingAccount, personnel, createAccountService(), authorize(), profile(), LegacyInstructor (+27 more)

### Community 1 - "Identity Accounts and Consent"
Cohesion: 0.08
Nodes (11): input, addGuardian(), dependent(), transaction(), isolatedDatabase(), migrate(), ready, load() (+3 more)

### Community 2 - "Identity Accounts and Consent"
Cohesion: 0.06
Nodes (13): load(), load(), config(), harness(), post(), env, dependencies, key() (+5 more)

### Community 3 - "Identity Accounts and Consent"
Cohesion: 0.05
Nodes (24): dev, admin, valid, sharp, assertLegacySchemaMatches(), schemaSnapshot(), cleanDevelopmentDatabase(), administrationStates (+16 more)

### Community 4 - "Shared Contracts and Clients"
Cohesion: 0.10
Nodes (36): ActionBinding, ActionError, ActionPurpose, actionSubjectHash(), cancelActionDelivery(), consumeAction(), invalid(), issueAction() (+28 more)

### Community 5 - "Shared Contracts and Clients"
Cohesion: 0.11
Nodes (33): GuardianInviteTarget, GuardianRemovalTarget, GuardianRemovedResponse, IdentityPage, PublicAccount, FamilyLifecycleUnavailable(), LifecycleKey, LifecycleText (+25 more)

### Community 6 - "Identity Accounts and Consent"
Cohesion: 0.08
Nodes (33): child(), ApiError, createApiClient(), accountMutation(), anonymousAction(), csrfToken(), familyMutation(), familyPreview() (+25 more)

### Community 7 - "Spec: Foundation"
Cohesion: 0.04
Nodes (48): Architecture, Audit mutation rejection triggers, Business timezone independent device timezone, Controlled browser tests use intercepted responses, Docker integration verifies real migrations and live browser screens, Express backend owns PostgreSQL business behavior, Flyway sole migration runner, Foundation excludes production authentication financial workflows full WCAG certification (+40 more)

### Community 8 - "Shared Contracts and Clients"
Cohesion: 0.07
Nodes (35): actions, fields, Key, OperationalAudit(), Text, value(), Read, Write (+27 more)

### Community 9 - "Identity Accounts and Consent"
Cohesion: 0.07
Nodes (21): locale(), @axe-core/playwright, @playwright/test, overview, settings, actor, target, row (+13 more)

### Community 10 - "Studio Catalog Content and Authorization"
Cohesion: 0.10
Nodes (24): api, Api, empty, Text, empty, Text, PublicSettings, StudioOverview (+16 more)

### Community 11 - "Shared Contracts and Clients"
Cohesion: 0.09
Nodes (36): AcceptedFamilyInvitation, actor(), checkFamilySessionInTransaction(), createFamilyInTransaction(), FamilyChange, FamilyContext, FamilyLifecycleInput, FamilyState (+28 more)

### Community 12 - "Identity Accounts and Consent"
Cohesion: 0.10
Nodes (30): api, CustomerAccess(), FoundationApp(), api, CustomerActionPage(), RegistrationAccess(), submit(), api (+22 more)

### Community 13 - "Studio Catalog Content and Authorization"
Cohesion: 0.05
Nodes (43): Studio Catalog implementation checklist, Batch execution agreement, C01: Resolve implementation decisions, C02: Add catalog persistence, C03: Maintain disciplines, C04: Maintain reusable classes, C05: Maintain instructor catalog facts, C06: Expose published class discovery (+35 more)

### Community 14 - "Database Schema and Migrations"
Cohesion: 0.09
Nodes (33): booking_child_snapshot_history, booking_child_snapshot_no_truncate, bookings_acting_account_idx, bookings_attendee_person_idx, bookings_saved_child_idx, dependent_creation_guardian_idx, dependent_current_guardian_idx, dependent_deactivation_history (+25 more)

### Community 15 - "Identity Accounts and Consent"
Cohesion: 0.11
Nodes (24): Environment, invalid(), loopback(), origin(), readIdentityConfig(), secret(), text(), createEmailOutboxWorker() (+16 more)

### Community 16 - "Identity Accounts and Consent"
Cohesion: 0.08
Nodes (29): email(), DependentTransitionInput, DependentTransitionResponse, EmailChangedResponse, EmailConfirmedResponse, PasswordResetInput, PasswordResetResponse, PasswordSetupResponse (+21 more)

### Community 17 - "Identity Accounts and Consent"
Cohesion: 0.09
Nodes (28): createIdentityLifecycleComposition(), inspect(), foundationTables, identityTables, Account, transaction(), discover(), Guardian (+20 more)

### Community 18 - "Shared Contracts and Clients"
Cohesion: 0.10
Nodes (23): familyId(), ActionAcceptedResponse, CustomerInvitationInput, FamilyCreateInput, FamilyInvitationActionInput, FamilyInvitationInput, FamilyInvitationPreview, FamilyView (+15 more)

### Community 19 - "customer-web/package.json"
Cohesion: 0.06
Nodes (35): dependencies, @conecta/api-client, @conecta/contracts, @conecta/i18n, @conecta/ui, react, react-dom, devDependencies (+27 more)

### Community 20 - "management-web/package.json"
Cohesion: 0.06
Nodes (35): dependencies, @conecta/api-client, @conecta/contracts, @conecta/i18n, @conecta/ui, react, react-dom, devDependencies (+27 more)

### Community 21 - "Studio Catalog Content and Authorization"
Cohesion: 0.06
Nodes (36): Credits-bookings supplies authoritative availability including paying replacement of complimentary attendance; numeric remaining places only below five; Full only when no booking available, One-off and bounded weekly recurrence; required start/end dates; selected weekdays; one/future edits preserve past; skip exceptions, Initial default/maximum 16; reductions effective next studio-local day; preserve same-day/past and explicit custom overrides, Explicit existing-session preservation may exceed reduced maximum only at preserved capacity; ordinary reductions below reservations blocked; conflicting default reduction offers cancel or preserve, Catalog owns disciplines, reusable classes, schedules, capacity, public instructor facts, media and offer facts; Identity owns accounts; payments and credits-bookings own purchases and balances, Discipline contains reusable classes containing scheduled sessions; children/adults only; optional explicit child age bounds; guidance levels; catalog duration fixed at 55 minutes, Spec: Studio Catalog, Management may edit audience, age limits and level with existing bookings; preserve those reservations; apply new limits to new bookings; notify and permit penalty-free cancellation (+28 more)

### Community 22 - "Shared Contracts and Clients"
Cohesion: 0.09
Nodes (19): CsrfResponse, GuardianInvitationAccepted, GuardianInvitationPreview, LoginInput, LoginResponse, SessionResponse, AccountAccess(), mutate() (+11 more)

### Community 23 - "Identity Accounts and Consent"
Cohesion: 0.09
Nodes (9): fixture(), account(), raw(), fixture(), account(), invite(), input, fixture() (+1 more)

### Community 24 - "Shared Contracts and Clients"
Cohesion: 0.11
Nodes (19): accessFailure(), AccessLost, AccountAdministration(), AccountEditor(), save(), AdministrationApi, errorKey(), Key (+11 more)

### Community 25 - "Bilingual Business Rules"
Cohesion: 0.06
Nodes (31): Conecta Infusion: reglas de negocio acordadas, Clase suelta, Ordinario 12, Ordinario 16, Ordinario 20, Ordinario 4, Ordinario 8, Primera visita, tres por dos (+23 more)

### Community 26 - "scripts"
Cohesion: 0.06
Nodes (31): devDependencies, @axe-core/playwright, concurrently, @playwright/test, typescript, engines, node, name (+23 more)

### Community 27 - "Identity Accounts and Consent"
Cohesion: 0.10
Nodes (6): authConfig(), password, harness(), token(), input, harness()

### Community 28 - "Identity Accounts and Consent"
Cohesion: 0.10
Nodes (8): closeFamilyInTransaction(), emptyFixtureCoordinator(), endFamilyMembershipInTransaction(), obligations, fixture(), actorContext(), token(), transaction()

### Community 29 - "Verification and Task Tracking"
Cohesion: 0.07
Nodes (17): Database migration transition, Visual direction: Conecta Infusion, ﻿# Foundation verification, baseline, Flyway Docker, Playwright web servers, shadcn/ui monorepos, Tailwind v4 (+9 more)

### Community 30 - "Bilingual Business Rules"
Cohesion: 0.07
Nodes (30): Conecta Infusion: agreed business rules, First visit, three for two, Ordinary 12, Ordinary 16, Ordinary 20, Ordinary 4, Ordinary 8, Quarterly 12-class reference (+22 more)

### Community 31 - "Identity Accounts and Consent"
Cohesion: 0.15
Nodes (13): createDevelopmentTestUser(), developmentDatabaseUrl(), generateFirstAdminSql(), literal(), text(), boundedWork(), hashDevelopmentFixturePassword(), hashPassword() (+5 more)

### Community 32 - "Shared Contracts and Clients"
Cohesion: 0.12
Nodes (20): appendSettingsAudit(), SettingsAudit, TrustedActor, readPublicSettings(), updateSettings(), updateSettingsInTransaction(), Settings, validateSettings() (+12 more)

### Community 33 - "Studio Catalog Content and Authorization"
Cohesion: 0.17
Nodes (13): createAccountRouter(), createAuditRouter(), createAuthRouter(), failure(), readSessionCookie(), requireEmptyBody(), sessionCookieName, IdentityConfig (+5 more)

### Community 34 - "Verification and Task Tracking"
Cohesion: 0.07
Nodes (27): Checkpoint 1 — Tooling and fresh migration, Checkpoint 2 — Migration safety and app boundaries, Checkpoint 3 — Shared contracts and persistent defaults, Checkpoint 4 — Actual brand rendering, Checkpoint 5 — Both bilingual vertical slices, Checkpoint 6 — Acceptance evidence, F01 — Resolve and pin tooling, F02 — Establish the fresh-database Flyway path (+19 more)

### Community 35 - "Backend Services and Authorization"
Cohesion: 0.17
Nodes (18): createApplication(), createAuditViewService(), createDeactivationService(), createDeactivationRouter(), createGuardianReactivationService(), inspect(), profile(), rawToken() (+10 more)

### Community 36 - "Database Schema and Migrations"
Cohesion: 0.13
Nodes (17): audit_append_only, business_settings, business_units, audit_events_page_idx, enforce_family_state(), families, family_creation_membership_idx, family_current_membership_idx (+9 more)

### Community 37 - "Shared Contracts and Clients"
Cohesion: 0.17
Nodes (13): Query, Read, Write, DependentProfileInput, DependentProfileView, SavedChildInput, SavedChildView, DependentAccess() (+5 more)

### Community 38 - "Identity Accounts and Consent"
Cohesion: 0.13
Nodes (5): fixture(), account(), fixture(), account(), token()

### Community 39 - "Identity Accounts and Consent"
Cohesion: 0.12
Nodes (19): Delivery and secrets, Lifetimes and resend, Run one local delivery tick, Single-use actions and email delivery, Transaction and authorization contract, Browser flow and manual testing, Customer invitations, Identity persistence and local email setup (+11 more)

### Community 40 - "Backend Services and Authorization"
Cohesion: 0.17
Nodes (13): appendIdentityAudit(), boundedString(), fail(), familyFields, IdentityAudit, readIdentityAuditSnapshot(), roles, sanitizedSnapshot() (+5 more)

### Community 41 - "Identity Accounts and Consent"
Cohesion: 0.12
Nodes (17): Audit and family testing, Dependent backend testing, Fictional development dataset, Full development reset, I36 deactivation verification, I37 reactivation verification, Profile photo testing, Family persistence, invitations, responsibility and lifecycle (I23-I27) (+9 more)

### Community 42 - "i18n/package.json"
Cohesion: 0.11
Nodes (17): dependencies, @conecta/contracts, exports, ./format, @conecta/contracts, react, react-dom, name (+9 more)

### Community 43 - "customer-web/components.json"
Cohesion: 0.12
Nodes (16): aliases, components, hooks, lib, ui, utils, iconLibrary, rsc (+8 more)

### Community 44 - "management-web/components.json"
Cohesion: 0.12
Nodes (16): aliases, components, hooks, lib, ui, utils, iconLibrary, rsc (+8 more)

### Community 45 - "ui/components.json"
Cohesion: 0.12
Nodes (16): aliases, components, hooks, lib, ui, utils, iconLibrary, rsc (+8 more)

### Community 46 - "Identity Accounts and Consent"
Cohesion: 0.13
Nodes (13): name, private, type, version, @conecta/contracts, argon2, cors, helmet (+5 more)

### Community 47 - "Database Schema and Migrations"
Cohesion: 0.25
Nodes (11): enforce_guardian_invitation_binding(), guardian_consent_exception_guard, guardian_consent_exception_no_truncate, guardian_consent_exceptions, guardian_invitation_binding, guardian_invitation_history, guardian_invitation_no_truncate, guardian_invitations (+3 more)

### Community 48 - "Database Schema and Migrations"
Cohesion: 0.23
Nodes (15): identity_action_tokens, identity_action_tokens_account_idx, identity_action_tokens_expiry_idx, identity_action_tokens_person_idx, identity_action_tokens_recipient_idx, identity_action_tokens_target_idx, identity_email_outbox, identity_email_outbox_action_idx (+7 more)

### Community 49 - "Database Schema and Migrations"
Cohesion: 0.23
Nodes (10): dependent_account_state, enforce_dependent_state(), enforce_guardian_reactivation_consent(), guardian_reactivation_authorization, guardian_reactivation_binding, guardian_reactivation_history, guardian_reactivation_invitations, guardian_reactivation_no_truncate (+2 more)

### Community 50 - "Identity Accounts and Consent"
Cohesion: 0.20
Nodes (3): createAuthAccount(), harness(), load()

### Community 51 - "Studio Catalog Content and Authorization"
Cohesion: 0.16
Nodes (7): color(), createClassService(), fields, identifier(), input(), StudioClass, text()

### Community 52 - "compilerOptions"
Cohesion: 0.13
Nodes (14): compilerOptions, allowImportingTsExtensions, esModuleInterop, jsx, lib, module, moduleResolution, noEmit (+6 more)

### Community 53 - "compilerOptions"
Cohesion: 0.13
Nodes (14): compilerOptions, allowImportingTsExtensions, esModuleInterop, jsx, lib, module, moduleResolution, noEmit (+6 more)

### Community 54 - "Database Schema and Migrations"
Cohesion: 0.24
Nodes (7): enforce_family_invitation_token(), family_invitation_history, family_invitation_no_truncate, family_invitation_token_binding, family_invitations, family_one_pending_invitation_idx, identity_family_invitation_valid()

### Community 55 - "Database Schema and Migrations"
Cohesion: 0.24
Nodes (7): enforce_family_successor_token(), family_one_pending_successor_idx, family_successor_history, family_successor_no_truncate, family_successor_offers, family_successor_token_binding, identity_family_successor_valid()

### Community 56 - "Studio Catalog Content and Authorization"
Cohesion: 0.13
Nodes (5): Studio Catalog implementation decisions, Persistence, pricing and fixtures, Primary sources and scope, Security Auditor decisions, Verified tooling choices

### Community 57 - "ui/package.json"
Cohesion: 0.13
Nodes (14): react, react-dom, name, private, scripts, typecheck, type, version (+6 more)

### Community 58 - "compilerOptions"
Cohesion: 0.13
Nodes (14): compilerOptions, allowImportingTsExtensions, esModuleInterop, jsx, lib, module, moduleResolution, noEmit (+6 more)

### Community 59 - "Identity Accounts and Consent"
Cohesion: 0.14
Nodes (14): Customer screens (I30), Dependent persistence, backend and screens (I28-I31), Design and verification boundaries, Fictional development checks, Guardian invitation consent (I31), Guardian removal (I32), Identity and authorization records, Manual checks with the existing demo data (+6 more)

### Community 60 - "Studio Catalog Content and Authorization"
Cohesion: 0.14
Nodes (14): Studio Catalog implementation plan, Authorization, audit and contracts, Calendar and presentation, Findings from graph and source inspection, Offers and downstream purchase facts, Ordered delivery phases, Outcome and scope, Photos and video (+6 more)

### Community 61 - "compilerOptions"
Cohesion: 0.14
Nodes (13): compilerOptions, allowImportingTsExtensions, esModuleInterop, jsx, lib, module, moduleResolution, noEmit (+5 more)

### Community 62 - "Identity Accounts and Consent"
Cohesion: 0.19
Nodes (3): load(), digest(), load()

### Community 63 - "Backend Services and Authorization"
Cohesion: 0.21
Nodes (8): createDependentRouter(), Account, createGuardianService(), authorize(), checkSession(), transaction(), Person, Relationship

### Community 64 - "Identity Accounts and Consent"
Cohesion: 0.15
Nodes (10): Approved-specification coverage, Deliver local action emails, Domain integration and production handoff, Human review and verification, Identity setup and handoff, Security configuration and operating boundaries, Start the existing development demo, Graphify incremental refresh cadence (+2 more)

### Community 65 - "Studio Catalog Content and Authorization"
Cohesion: 0.21
Nodes (9): app, pool, getStudioOverview(), port, server, stopPhotoCleanup, CafeProduct, YogaClass (+1 more)

### Community 66 - "Backend Services and Authorization"
Cohesion: 0.26
Nodes (9): createManagementRouter(), requireManagement(), createPhotoService(), file(), reconcile(), clean(), removeUnreferenced(), storage() (+1 more)

### Community 67 - "Backend Services and Authorization"
Cohesion: 0.29
Nodes (8): IdentitySecrets, associatedData(), decryptOutboxPayload(), EncryptedOutboxPayload, encryptOutboxPayload(), invalid(), OutboxContext, uuid()

### Community 68 - "Backend Services and Authorization"
Cohesion: 0.17
Nodes (11): compilerOptions, esModuleInterop, module, moduleResolution, noUncheckedIndexedAccess, outDir, rootDir, skipLibCheck (+3 more)

### Community 69 - "Database Schema and Migrations"
Cohesion: 0.32
Nodes (11): bookings, bookings_class_session_idx, class_sessions, class_sessions_starts_at_idx, instructors, members, members_email_unique, products (+3 more)

### Community 70 - "Database Schema and Migrations"
Cohesion: 0.32
Nodes (11): bookings, bookings_class_session_idx, class_sessions, class_sessions_starts_at_idx, instructors, members, members_email_unique, products (+3 more)

### Community 71 - "Identity Accounts and Consent"
Cohesion: 0.18
Nodes (12): Endpoints and shared contracts, Identity authenticated transport, Origin, cookie and CSRF boundaries, Shared API client, Verification and remaining work, Accessibility and layout, Customer sign-in and account controls, Interaction and states (+4 more)

### Community 72 - "Identity Accounts and Consent"
Cohesion: 0.17
Nodes (12): API and frontend contracts, Approval requested, Architecture decisions proposed for approval, Deliverable and boundaries, Evidence informing this plan, Graphify and documentation workflow, Implementation plan: Identity and access, Integration safety before credits/bookings and payroll exist (+4 more)

### Community 73 - "Shared Contracts and Clients"
Cohesion: 0.17
Nodes (11): dependencies, @conecta/contracts, exports, @conecta/contracts, name, private, scripts, test (+3 more)

### Community 74 - "Shared Contracts and Clients"
Cohesion: 0.18
Nodes (10): compilerOptions, allowImportingTsExtensions, lib, module, moduleResolution, noEmit, skipLibCheck, strict (+2 more)

### Community 75 - "Backend Services and Authorization"
Cohesion: 0.20
Nodes (10): dependencies, argon2, @conecta/contracts, cors, dotenv, express, helmet, nodemailer (+2 more)

### Community 76 - "Backend Services and Authorization"
Cohesion: 0.42
Nodes (9): createFamilyResponsibilityService(), authorize(), checkSession(), context(), family(), inspect(), now(), respond() (+1 more)

### Community 77 - "/graphify"
Cohesion: 0.22
Nodes (9): /graphify, AST structural extraction, Community detection, Existing graph query fast path, Gemini optional host extraction fallback, Graph confidence audit trail, Interactive HTML GraphRAG JSON graph report, Parallel semantic extraction (+1 more)

### Community 78 - "Database Schema and Migrations"
Cohesion: 0.25
Nodes (5): dependent_deactivation_snapshot, dependent_person_state, dependent_role_state, snapshot_dependent_deactivation(), identity_dependent_transition_valid()

### Community 79 - "Studio Catalog Content and Authorization"
Cohesion: 0.36
Nodes (5): Api, StudioDisciplines(), failed(), more(), save()

### Community 80 - "Database Schema and Migrations"
Cohesion: 0.33
Nodes (6): class_sessions_catalog_idx, studio_classes, studio_classes_discipline_idx, studio_disciplines, studio_disciplines_status_idx, studio_legacy_session_reconciliation

### Community 81 - "Shared Contracts and Clients"
Cohesion: 0.47
Nodes (9): createDependentClient(), child(), dependent(), id(), page(), target(), identifier(), text() (+1 more)

### Community 82 - "dependencies"
Cohesion: 0.22
Nodes (9): dependencies, class-variance-authority, clsx, @conecta/contracts, lucide-react, @radix-ui/react-dialog, @radix-ui/react-slot, tailwind-merge (+1 more)

### Community 83 - "graphify reference: query, path, explain"
Cohesion: 0.25
Nodes (8): BFS broad neighbor context, DFS dependency path, Explain node, Graph-only evidence answers, graphify reference: query, path, explain, Persist query results, Shortest path, Vocabulary-constrained query expansion

### Community 84 - "graphify reference: incremental update and"
Cohesion: 0.25
Nodes (8): Cluster-only self-contained regeneration, Code-only semantic bypass, Deleted sources prune, graphify reference: incremental update and cluster-only, Incremental changed-file extraction, Manifest stamps only successful semantic outputs, Preserve directed graph semantics, Re-extracted sources replace

### Community 85 - "Backend Services and Authorization"
Cohesion: 0.39
Nodes (7): createChildDetailsService(), audit(), authorize(), checkSession(), createDependent(), dependent(), transaction()

### Community 86 - "Backend Services and Authorization"
Cohesion: 0.39
Nodes (6): anonymousCookie(), anonymousCsrfCookieName, createCsrfProtection(), sign(), valid(), equal()

### Community 87 - "Backend Services and Authorization"
Cohesion: 0.46
Nodes (7): createGuardianInvitationService(), authorize(), checkSession(), dependent(), inspect(), now(), transaction()

### Community 88 - "Capability map: Conecta Infusion"
Cohesion: 0.25
Nodes (6): Approval and next step, Approved boundary decisions, Approved modules, Approved specification/build order, Capability map: Conecta Infusion, Starting assumptions for review

### Community 90 - "Commit and push"
Cohesion: 0.29
Nodes (7): Commit and push, Explicit reviewed staging, No force push no reset no hook bypass, Preserve unrelated work and staging, Scoped authorization commit and push, Validate relevant checks, Verify remote hash after push

### Community 91 - "graphify reference: extra exports and"
Cohesion: 0.29
Nodes (7): FalkorDB export, graphify reference: extra exports and benchmark, Graphify stdio MCP, Neo4j Cypher MERGE export, SVG GraphML exports, Token reduction benchmark, Wiki export

### Community 92 - "graphify reference: extraction subagent prompt"
Cohesion: 0.29
Nodes (7): Deterministic full relative path node identifiers, Extracted inferred ambiguous confidence provenance, graphify reference: extraction subagent prompt (compact), Hyperedges maximum three, Rationale node attributes, Semantic similarity inference, Verbatim absolute source file paths

### Community 93 - "Studio Catalog Content and Authorization"
Cohesion: 0.33
Nodes (5): useCatalogList(), handle(), more(), classTextColor(), StudioClasses()

### Community 94 - "Database Schema and Migrations"
Cohesion: 0.52
Nodes (6): account_roles, account_roles_assigned_by_idx, account_roles_role_idx, accounts, accounts_exemption_actor_idx, people

### Community 95 - "Studio Catalog Content and Authorization"
Cohesion: 0.29
Nodes (7): Studio Catalog verification ledger, C01 completed: tooling and security decisions, Downstream integration acceptance remains separate, Evidence format for each completed task, Pending runtime acceptance, Planning document checks, Planning evidence

### Community 96 - "Backend Services and Authorization"
Cohesion: 0.33
Nodes (6): devDependencies, tsx, @types/cors, @types/express, @types/node, @types/pg

### Community 97 - "Backend Services and Authorization"
Cohesion: 0.33
Nodes (6): scripts, build, dev, start, test, typecheck

### Community 99 - "Database Schema and Migrations"
Cohesion: 0.47
Nodes (3): identity_lifecycle_operations, identity_lifecycle_receipt_history, identity_lifecycle_receipt_no_truncate

### Community 100 - "Backend Services and Authorization"
Cohesion: 0.50
Nodes (3): createDependentTransitionService(), checkSession(), lock()

### Community 102 - "Conecta Infusion: confirmed product intent"
Cohesion: 0.40
Nodes (3): Conecta Infusion Yoga on Instagram, GitHub issue #1, Conecta Infusion: confirmed product intent

### Community 103 - "Shared Contracts and Clients"
Cohesion: 0.40
Nodes (4): name, private, types, version

### Community 104 - "graphify reference: add a URL"
Cohesion: 0.50
Nodes (4): Code watcher AST rebuild no LLM, Document watcher flags semantic update, graphify reference: add a URL and watch a folder, URL ingestion updates corpus

### Community 105 - "graphify reference: GitHub clone and"
Cohesion: 0.50
Nodes (4): Cross repository graph merge, GitHub clone reuse, graphify reference: GitHub clone and cross-repo merge, Local subfolder CLI output isolation

### Community 106 - "graphify reference: commit hook and"
Cohesion: 0.50
Nodes (4): Document image changes require manual update, graphify reference: commit hook and native CLAUDE.md integration, Native CLAUDE graph integration, Opt-in post-commit AST hook

### Community 107 - "graphify reference: transcribe video and"
Cohesion: 0.50
Nodes (4): Domain hint initial prompt, graphify reference: transcribe video and audio, Transcript documents semantic extraction, Whisper audio video transcription

### Community 110 - "Backend Services and Authorization"
Cohesion: 0.50
Nodes (3): createProfileService(), recent(), transaction()

### Community 111 - "MCP connections for Codex"
Cohesion: 0.50
Nodes (4): Codex MCP configuration, GitHub MCP setup for Codex, OpenAI Docs MCP, MCP connections for Codex

### Community 112 - "exports"
Cohesion: 0.50
Nodes (4): exports, ./components/*, ./lib/utils, ./styles.css

### Community 113 - "peerDependencies"
Cohesion: 0.67
Nodes (3): peerDependencies, react, react-dom

## Knowledge Gaps
- **827 isolated node(s):** `Environment`, `DeliveryCode`, `DeliveryMessage`, `OutboxRow`, `TerminalStatus` (+822 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 1107 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **54 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `pg` connect `Identity Accounts and Consent` to `Shared Contracts and Clients`, `Studio Catalog Content and Authorization`, `Studio Catalog Content and Authorization`, `Backend Services and Authorization`, `Shared Contracts and Clients`, `Identity Accounts and Consent`, `Identity Accounts and Consent`, `Identity Accounts and Consent`, `Backend Services and Authorization`, `Shared Contracts and Clients`, `Identity Accounts and Consent`, `Identity Accounts and Consent`, `Identity Accounts and Consent`, `Studio Catalog Content and Authorization`, `Backend Services and Authorization`?**
  _High betweenness centrality (0.069) - this node is a cross-community bridge._
- **Why does `@playwright/test` connect `Identity Accounts and Consent` to `scripts`, `Identity Accounts and Consent`, `Identity Accounts and Consent`, `Identity Accounts and Consent`?**
  _High betweenness centrality (0.019) - this node is a cross-community bridge._
- **Why does `@conecta/contracts` connect `Identity Accounts and Consent` to `ui/package.json`?**
  _High betweenness centrality (0.016) - this node is a cross-community bridge._
- **What connects `Environment`, `DeliveryCode`, `DeliveryMessage` to the rest of the system?**
  _827 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Studio Catalog Content and Authorization` be split into smaller, more focused modules?**
  _Cohesion score 0.058445353594389245 - nodes in this community are weakly interconnected._
- **Should `Identity Accounts and Consent` be split into smaller, more focused modules?**
  _Cohesion score 0.07676767676767676 - nodes in this community are weakly interconnected._
- **Should `Identity Accounts and Consent` be split into smaller, more focused modules?**
  _Cohesion score 0.0602322206095791 - nodes in this community are weakly interconnected._
## C04 Scheduled Incremental Refresh

Changed-source structural extraction covers only 12 isolated, completed C02-C04 runtime/test sources. C04 completed after PostgreSQL, client, demo and live bilingual browser verification. Shared runtime, contracts, clients, translations, seed helpers and current delivery documents also contain in-progress C05/C06 changes, so their existing graph fragments and manifest hashes are deliberately retained unstamped until C07. C05/C06 are excluded; this graph does not certify them complete. No full rebuild, hooks, PDF extraction or PDF regeneration.

Untouched node identities are preserved. Historical raw detection discrepancies, dangling AST endpoints and undirected edge collapses remain limitations. Synthesized endpoint nodes do not prove implementations exist. Consult current source and approved specification. Exact paths, hashes, diagnostic counts and exclusions appear in c04-refresh-evidence.json.
