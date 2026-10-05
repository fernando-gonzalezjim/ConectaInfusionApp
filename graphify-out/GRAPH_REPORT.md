# Graph Report - ConectaInfusionApp  (2026-10-05)

## Corpus Check
- 266 files · ~156,719 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 7 file(s) not represented in the graph (top: (none) 3, .example 2, .toml 1)

## Summary
- 1928 nodes · 4087 edges · 129 communities (98 shown, 31 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 55 edges (avg confidence: 0.85)
- Token cost: unavailable (host-agent extraction usage is not exposed; placeholder counters do not mean zero cost).

## Community Hubs (Navigation)
- Identity Implementation Plan
- Verification and Task Tracking
- Shared Interface Components
- Backend Configuration and Services
- Foundation Specification
- Shared API Contracts
- Shared API Contracts
- Shared Interface Components
- Shared Interface Components
- Verification and Task Tracking
- Verification and Task Tracking
- Verification and Task Tracking
- Backend Configuration and Services
- Shared API Contracts
- Shared API Contracts
- Customer Web Application
- Management Web Application
- Shared Interface Components
- Shared Interface Components
- Verification and Task Tracking
- Database Schema and Migrations
- Shared Interface Components
- Identity Accounts and Permissions
- Verification and Task Tracking
- Verification and Task Tracking
- Backend Configuration and Services
- Shared Interface Components
- Database Schema and Migrations
- Identity Implementation Plan
- Shared Interface Components
- Shared API Contracts
- Verification and Task Tracking
- Verification and Task Tracking
- scripts
- Shared API Contracts
- Languages and Display Formatting
- Shared Interface Components
- Customer Web Application
- Management Web Application
- Database Schema and Migrations
- Shared Interface Components
- Shared Interface Components
- Database Schema and Migrations
- Verification and Task Tracking
- Customer Web Application
- Management Web Application
- Database Schema and Migrations
- Database Schema and Migrations
- Bilingual Business Rules
- Bilingual Business Rules
- Shared Interface Components
- Identity Accounts and Permissions
- Languages and Display Formatting
- Module Boundaries and Dependencies
- package.json
- Verification and Task Tracking
- Shared API Contracts
- Backend Configuration and Services
- Database Schema and Migrations
- Database Schema and Migrations
- I07 authenticated transport
- Shared API Contracts
- Backend Configuration and Services
- Shared API Contracts
- Database Schema and Migrations
- Database Schema and Migrations
- Backend Configuration and Services
- Backend Configuration and Services
- Manual Identity bootstrap
- Verification and Task Tracking
- /graphify
- identity-families
- POST /api/v1/accounts/invitations creates pending passwordless
- Shared Interface Components
- Shared Interface Components
- graphify reference: query, path, explain
- graphify reference: incremental update and
- Verification and Task Tracking
- Backend Configuration and Services
- Shared Interface Components
- Identity login backend: I06 checkpoint
- Commit and push
- graphify reference: extra exports and
- graphify reference: extraction subagent prompt
- Database Schema and Migrations
- Verification and Task Tracking
- Backend Configuration and Services
- Backend Configuration and Services
- Verification and Task Tracking
- Module Boundaries and Dependencies
- Database migration transition
- Operational audit history
- Conecta Infusion: confirmed product intent
- Conecta Infusión: resumen de permisos
- Shared API Contracts
- graphify reference: add a URL
- graphify reference: GitHub clone and
- graphify reference: commit hook and
- graphify reference: transcribe video and
- Identity implementation decisions
- I05 persistence and local email
- MCP connections for Codex
- Shared Interface Components
- Verification and Task Tracking
- POST /api/v1/auth/recovery email -> generic
- Verification and Task Tracking
- Verification and Task Tracking
- Verification and Task Tracking
- commitAndPush.prompt.md
- Customer Web Application
- Customer Web Application
- Management Web Application
- POST /api/v1/accounts/invitations/resend accepts email only;
- Customer screens
- Bilingual Business Rules
- Bilingual Business Rules
- Bilingual Business Rules
- Bilingual Business Rules
- Verification and Task Tracking
- Shared Interface Components

## God Nodes (most connected - your core abstractions)
1. `pg` - 47 edges
2. `AuthError` - 37 edges
3. `@playwright/test` - 33 edges
4. `createApiClient()` - 33 edges
5. `identity-dependents` - 32 edges
6. `isolatedDatabase()` - 30 edges
7. `migrate()` - 30 edges
8. `Spec: Foundation` - 27 edges
9. `createAuthAccount()` - 24 edges
10. `authConfig()` - 23 edges

## Surprising Connections (you probably didn't know these)
- `Conecta Infusion: reglas de negocio acordadas (PDF snapshot)` --semantically_similar_to--> `Conecta Infusion: reglas de negocio acordadas`  [INFERRED] [semantically similar]
  docs/requirements/agreed-business-rules.es.pdf → docs/requirements/agreed-business-rules.es.md
- `Foundation human review pending` --conceptually_related_to--> `Document`  [INFERRED]
  tasks/todo.md → AGENTS.md
- `Settings update and audit atomic singleton lock` --semantically_similar_to--> `Transactional append-only sanitized audit`  [INFERRED] [semantically similar]
  docs/architecture.md → SPEC-foundation.md
- `Conecta Infusión: resumen de permisos (PDF snapshot)` --semantically_similar_to--> `Conecta Infusión: resumen de permisos`  [INFERRED] [semantically similar]
  docs/requirements/resumen-permisos.es.pdf → docs/requirements/resumen-permisos.es.md
- `LoginResult` --references--> `PublicAccount`  [EXTRACTED]
  apps/api/src/modules/identity/sessions.ts → packages/contracts/index.d.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Completed invitation creation, resend and deliberate password setup flow** — docs_identity_invitations_create, docs_identity_invitations_resend, docs_identity_invitations_setup, docs_identity_invitations_browser_safety [EXTRACTED 1.00]
- **Guarded operator-only development bootstrap** — docs_identity_bootstrap_development_testuser, docs_identity_bootstrap_local_target_guards, docs_identity_bootstrap_fixture_provenance, docs_identity_bootstrap_private_sql_output [EXTRACTED 1.00]
- **Explicit consent grants current authorization only** — docs_identity_dependents_i31, docs_identity_dependents_atomic_acceptance, docs_identity_dependents_pending_denial, docs_identity_dependents_guardian_boundary [EXTRACTED 1.00]
- **Removal binds exact authorization and preserves an active eligible guardian** — docs_identity_dependents_i32, docs_identity_dependents_exact_relationship, docs_identity_dependents_canonical_locks, docs_identity_dependents_last_guardian, docs_identity_dependents_removal_atomicity [EXTRACTED 1.00]
- **Shared customer and management authentication flow** — docs_identity_customer_login_customer_login, docs_identity_management_login_management_login, docs_identity_auth_transport_authenticated_transport, docs_identity_auth_transport_shared_host_cookie [EXTRACTED 1.00]

## Communities (129 total, 31 thin omitted)

### Community 0 - "Identity Implementation Plan"
Cohesion: 0.06
Nodes (5): development-demo, identity-dependents, README, identity-todo, identity-verification

### Community 1 - "Verification and Task Tracking"
Cohesion: 0.10
Nodes (29): ActionPurpose, createDevelopmentTestUser(), developmentDatabaseUrl(), generateFirstAdminSql(), literal(), text(), createEmailOutboxWorker(), finish() (+21 more)

### Community 2 - "Shared Interface Components"
Cohesion: 0.08
Nodes (34): api, App(), actions, fields, Key, OperationalAudit(), Text, value() (+26 more)

### Community 3 - "Backend Configuration and Services"
Cohesion: 0.10
Nodes (29): createApplication(), createAccountInvitationService(), actor(), createAccountRouter(), createAuditRouter(), createAuditViewService(), createAuthRouter(), failure() (+21 more)

### Community 4 - "Foundation Specification"
Cohesion: 0.04
Nodes (48): Architecture, Audit mutation rejection triggers, Business timezone independent device timezone, Controlled browser tests use intercepted responses, Docker integration verifies real migrations and live browser screens, Express backend owns PostgreSQL business behavior, Flyway sole migration runner, Foundation excludes production authentication financial workflows full WCAG certification (+40 more)

### Community 5 - "Shared API Contracts"
Cohesion: 0.12
Nodes (31): ActionBinding, ActionError, actionSubjectHash(), cancelActionDelivery(), consumeAction(), invalid(), issueAction(), lifetimes (+23 more)

### Community 6 - "Shared API Contracts"
Cohesion: 0.09
Nodes (36): AcceptedFamilyInvitation, actor(), checkFamilySessionInTransaction(), createFamilyInTransaction(), FamilyChange, FamilyContext, FamilyLifecycleInput, FamilyState (+28 more)

### Community 7 - "Shared Interface Components"
Cohesion: 0.12
Nodes (28): GuardianInviteTarget, GuardianRemovalTarget, GuardianRemovedResponse, IdentityPage, InvitationKey, DependentKey, Query, Row (+20 more)

### Community 8 - "Shared Interface Components"
Cohesion: 0.10
Nodes (28): api, CustomerAccess(), FoundationApp(), api, CustomerActionPage(), RegistrationAccess(), submit(), api (+20 more)

### Community 9 - "Verification and Task Tracking"
Cohesion: 0.08
Nodes (12): fixture(), account(), token(), closeFamilyInTransaction(), emptyFixtureCoordinator(), endFamilyMembershipInTransaction(), obligations, fixture() (+4 more)

### Community 10 - "Verification and Task Tracking"
Cohesion: 0.11
Nodes (8): authConfig(), createAuthAccount(), password, harness(), token(), digest(), load(), harness()

### Community 11 - "Verification and Task Tracking"
Cohesion: 0.07
Nodes (10): load(), config(), harness(), post(), env, dependencies, key(), secrets() (+2 more)

### Community 12 - "Backend Configuration and Services"
Cohesion: 0.09
Nodes (28): address(), object(), PendingAccount, personnel, createAccountService(), authorize(), profile(), LegacyInstructor (+20 more)

### Community 13 - "Shared API Contracts"
Cohesion: 0.10
Nodes (31): createDependentClient(), child(), dependent(), id(), page(), target(), identifier(), text() (+23 more)

### Community 14 - "Shared API Contracts"
Cohesion: 0.09
Nodes (27): appendSettingsAudit(), SettingsAudit, TrustedActor, readPublicSettings(), updateSettings(), updateSettingsInTransaction(), Settings, validateSettings() (+19 more)

### Community 15 - "Customer Web Application"
Cohesion: 0.06
Nodes (35): dependencies, @conecta/api-client, @conecta/contracts, @conecta/i18n, @conecta/ui, react, react-dom, devDependencies (+27 more)

### Community 16 - "Management Web Application"
Cohesion: 0.06
Nodes (35): dependencies, @conecta/api-client, @conecta/contracts, @conecta/i18n, @conecta/ui, react, react-dom, devDependencies (+27 more)

### Community 17 - "Shared Interface Components"
Cohesion: 0.10
Nodes (22): accessFailure(), AccessLost, AccountAdministration(), AccountEditor(), save(), AdministrationApi, errorKey(), Key (+14 more)

### Community 18 - "Shared Interface Components"
Cohesion: 0.14
Nodes (21): api, FamilyCreateInput, PhotoUploadInput, StudioOverview, Alert, AlertDescription, AlertTitle, alertVariants (+13 more)

### Community 19 - "Verification and Task Tracking"
Cohesion: 0.11
Nodes (12): dev, sharp, createDemoPhotoFixture(), hiddenPassword(), finish(), keypress(), parse(), runBootstrapCommand() (+4 more)

### Community 20 - "Database Schema and Migrations"
Cohesion: 0.11
Nodes (22): booking_child_snapshot_history, booking_child_snapshot_no_truncate, bookings_acting_account_idx, bookings_attendee_person_idx, bookings_saved_child_idx, dependent_deactivation_history, dependent_deactivation_no_truncate, dependent_deactivation_snapshot_only (+14 more)

### Community 21 - "Shared Interface Components"
Cohesion: 0.12
Nodes (15): familyId(), FamilyInvitationActionInput, FamilyInvitationInput, FamilyInvitationPreview, FamilyView, FamilyApi, familyError(), FamilyPanel() (+7 more)

### Community 22 - "Identity Accounts and Permissions"
Cohesion: 0.08
Nodes (28): Management-only bounded UUID-cursor account listing, Account listing and personal profile edits, Authorized canonical person name phone and locale edits, Locked session account person role authorization and atomic audit, Bilingual accessible management account and role screens, Management account screens, Pending mutation blocks dismissal and competing saves; uncertain outcomes require refresh, Actual role changes revoke target sessions and remount self session controls (+20 more)

### Community 23 - "Verification and Task Tracking"
Cohesion: 0.11
Nodes (10): load(), fixture(), account(), fixture(), account(), raw(), fixture(), account() (+2 more)

### Community 24 - "Verification and Task Tracking"
Cohesion: 0.12
Nodes (10): load(), cleanDevelopmentDatabase(), administrationStates, customers, demoPassword, id(), personnel, profileScenarios (+2 more)

### Community 25 - "Backend Configuration and Services"
Cohesion: 0.14
Nodes (17): Environment, IdentitySecrets, invalid(), loopback(), origin(), readIdentityConfig(), secret(), text() (+9 more)

### Community 26 - "Shared Interface Components"
Cohesion: 0.12
Nodes (18): EmailChangedResponse, EmailConfirmedResponse, PasswordResetInput, PasswordResetResponse, PasswordSetupResponse, ActionApi, ActionKey, changed() (+10 more)

### Community 27 - "Database Schema and Migrations"
Cohesion: 0.13
Nodes (17): audit_append_only, business_settings, business_units, audit_events_page_idx, enforce_family_state(), families, family_creation_membership_idx, family_current_membership_idx (+9 more)

### Community 29 - "Shared Interface Components"
Cohesion: 0.18
Nodes (12): Query, Read, Write, DependentProfileInput, DependentProfileView, SavedChildInput, SavedChildView, DependentApi (+4 more)

### Community 30 - "Shared API Contracts"
Cohesion: 0.16
Nodes (4): load(), harness(), load(), valid

### Community 31 - "Verification and Task Tracking"
Cohesion: 0.18
Nodes (7): addGuardian(), dependent(), transaction(), isolatedDatabase(), migrate(), load(), secrets

### Community 32 - "Verification and Task Tracking"
Cohesion: 0.14
Nodes (6): @axe-core/playwright, @playwright/test, account, family, fill(), profile

### Community 33 - "scripts"
Cohesion: 0.11
Nodes (19): scripts, build, db:clean:demo, db:flyway:migrate, db:info, db:migrate, db:migrate:demo, db:seed:demo (+11 more)

### Community 34 - "Shared API Contracts"
Cohesion: 0.17
Nodes (13): allowed, EligibilityChange, accountDto(), AccountRow, createSessionService(), eligible(), readSession(), csrfFor() (+5 more)

### Community 35 - "Languages and Display Formatting"
Cohesion: 0.11
Nodes (17): dependencies, @conecta/contracts, exports, ./format, @conecta/contracts, react, react-dom, name (+9 more)

### Community 36 - "Shared Interface Components"
Cohesion: 0.11
Nodes (17): react, react-dom, name, peerDependencies, react, react-dom, private, scripts (+9 more)

### Community 37 - "Customer Web Application"
Cohesion: 0.12
Nodes (16): aliases, components, hooks, lib, ui, utils, iconLibrary, rsc (+8 more)

### Community 38 - "Management Web Application"
Cohesion: 0.12
Nodes (16): aliases, components, hooks, lib, ui, utils, iconLibrary, rsc (+8 more)

### Community 39 - "Database Schema and Migrations"
Cohesion: 0.24
Nodes (11): enforce_guardian_invitation_binding(), guardian_consent_exception_guard, guardian_consent_exception_no_truncate, guardian_consent_exceptions, guardian_invitation_binding, guardian_invitation_history, guardian_invitation_no_truncate, guardian_invitations (+3 more)

### Community 40 - "Shared Interface Components"
Cohesion: 0.12
Nodes (16): aliases, components, hooks, lib, ui, utils, iconLibrary, rsc (+8 more)

### Community 41 - "Shared Interface Components"
Cohesion: 0.13
Nodes (13): name, private, type, version, @conecta/contracts, argon2, cors, helmet (+5 more)

### Community 42 - "Database Schema and Migrations"
Cohesion: 0.23
Nodes (15): identity_action_tokens, identity_action_tokens_account_idx, identity_action_tokens_expiry_idx, identity_action_tokens_person_idx, identity_action_tokens_recipient_idx, identity_action_tokens_target_idx, identity_email_outbox, identity_email_outbox_action_idx (+7 more)

### Community 43 - "Verification and Task Tracking"
Cohesion: 0.13
Nodes (10): Visual direction: Conecta Infusion, baseline, Flyway Docker, Playwright web servers, shadcn/ui monorepos, Tailwind v4, Tailwind Vite installation, Implementation plan: Foundation (+2 more)

### Community 44 - "Customer Web Application"
Cohesion: 0.13
Nodes (14): compilerOptions, allowImportingTsExtensions, esModuleInterop, jsx, lib, module, moduleResolution, noEmit (+6 more)

### Community 45 - "Management Web Application"
Cohesion: 0.13
Nodes (14): compilerOptions, allowImportingTsExtensions, esModuleInterop, jsx, lib, module, moduleResolution, noEmit (+6 more)

### Community 46 - "Database Schema and Migrations"
Cohesion: 0.24
Nodes (7): enforce_family_invitation_token(), family_invitation_history, family_invitation_no_truncate, family_invitation_token_binding, family_invitations, family_one_pending_invitation_idx, identity_family_invitation_valid()

### Community 47 - "Database Schema and Migrations"
Cohesion: 0.24
Nodes (7): enforce_family_successor_token(), family_one_pending_successor_idx, family_successor_history, family_successor_no_truncate, family_successor_offers, family_successor_token_binding, identity_family_successor_valid()

### Community 48 - "Bilingual Business Rules"
Cohesion: 0.13
Nodes (15): 10. Café, 11. Details to resolve during specification, 1. Studio, language, and settings, 2. Financial separation and payment collection, 3. Packages, credit value, expiration, and selection, 4. Booking, cancellation, and capacity, 5. Family sharing and leaving a family, 6. Manual adjustments and audit history (+7 more)

### Community 49 - "Bilingual Business Rules"
Cohesion: 0.13
Nodes (14): 10. Cafetería, 11. Detalles por resolver durante la especificación, 1. Estudio, idioma y configuración, 2. Separación financiera y cobro, 3. Paquetes, valor de los créditos, vencimiento y selección, 4. Reservas, cancelaciones y cupo, 5. Créditos compartidos y salida del grupo familiar, 6. Ajustes manuales e historial de auditoría (+6 more)

### Community 50 - "Shared Interface Components"
Cohesion: 0.13
Nodes (14): compilerOptions, allowImportingTsExtensions, esModuleInterop, jsx, lib, module, moduleResolution, noEmit (+6 more)

### Community 51 - "Identity Accounts and Permissions"
Cohesion: 0.13
Nodes (13): Acceptance scenarios, Boundaries and decisions still needed, Commands and structure, Confirmed account permissions, Deletion and family boundaries, Spec: Identity and access, Email sign-in, first-admin bootstrap and development accounts, Invitation acceptance required before family membership and sharing (+5 more)

### Community 52 - "Languages and Display Formatting"
Cohesion: 0.14
Nodes (13): compilerOptions, allowImportingTsExtensions, esModuleInterop, jsx, lib, module, moduleResolution, noEmit (+5 more)

### Community 53 - "Module Boundaries and Dependencies"
Cohesion: 0.28
Nodes (9): cafe-sales, credits-bookings, Capability map: Conecta Infusion, financial-reporting, identity, instructor-payroll, payments, public-home (+1 more)

### Community 54 - "package.json"
Cohesion: 0.15
Nodes (12): devDependencies, @axe-core/playwright, concurrently, @playwright/test, typescript, engines, node, name (+4 more)

### Community 55 - "Verification and Task Tracking"
Cohesion: 0.20
Nodes (4): admin, valid, assertLegacySchemaMatches(), schemaSnapshot()

### Community 56 - "Shared API Contracts"
Cohesion: 0.21
Nodes (9): app, pool, getStudioOverview(), port, server, stopPhotoCleanup, CafeProduct, YogaClass (+1 more)

### Community 57 - "Backend Configuration and Services"
Cohesion: 0.17
Nodes (11): compilerOptions, esModuleInterop, module, moduleResolution, noUncheckedIndexedAccess, outDir, rootDir, skipLibCheck (+3 more)

### Community 58 - "Database Schema and Migrations"
Cohesion: 0.32
Nodes (11): bookings, bookings_class_session_idx, class_sessions, class_sessions_starts_at_idx, instructors, members, members_email_unique, products (+3 more)

### Community 59 - "Database Schema and Migrations"
Cohesion: 0.32
Nodes (11): bookings, bookings_class_session_idx, class_sessions, class_sessions_starts_at_idx, instructors, members, members_email_unique, products (+3 more)

### Community 60 - "I07 authenticated transport"
Cohesion: 0.26
Nodes (8): I07 authenticated transport, Credentialed createApiClient authentication methods, Shared host-only HttpOnly frontend session cookie, I08 bilingual customer sign-in and account controls, Shared accessible SignInForm, Shared AccountAccess controls, GET management/access: current server administrator/manager capability, I09 management sign-in and access

### Community 61 - "Shared API Contracts"
Cohesion: 0.17
Nodes (11): dependencies, @conecta/contracts, exports, @conecta/contracts, name, private, scripts, test (+3 more)

### Community 62 - "Backend Configuration and Services"
Cohesion: 0.24
Nodes (7): Account, createGuardianService(), authorize(), checkSession(), transaction(), Person, Relationship

### Community 63 - "Shared API Contracts"
Cohesion: 0.18
Nodes (10): compilerOptions, allowImportingTsExtensions, lib, module, moduleResolution, noEmit, skipLibCheck, strict (+2 more)

### Community 64 - "Database Schema and Migrations"
Cohesion: 0.22
Nodes (8): dependent_deactivation_snapshot, dependent_person_state, dependent_profile_history, dependent_profile_no_truncate, dependent_profile_state, dependent_profiles, dependent_role_state, snapshot_dependent_deactivation()

### Community 65 - "Database Schema and Migrations"
Cohesion: 0.22
Nodes (9): dependent_account_state, dependent_creation_guardian_idx, dependent_current_guardian_idx, dependent_guardian_history, dependent_guardian_no_truncate, dependent_guardian_state, dependent_guardians, dependent_guardians_account_idx (+1 more)

### Community 66 - "Backend Configuration and Services"
Cohesion: 0.20
Nodes (10): dependencies, argon2, @conecta/contracts, cors, dotenv, express, helmet, nodemailer (+2 more)

### Community 67 - "Backend Configuration and Services"
Cohesion: 0.42
Nodes (9): createFamilyResponsibilityService(), authorize(), checkSession(), context(), family(), inspect(), now(), respond() (+1 more)

### Community 69 - "Verification and Task Tracking"
Cohesion: 0.20
Nodes (6): ﻿# Foundation verification, Flyway Docker/CLI, Playwright accessibility, shadcn monorepo, Tailwind Vite, Foundation toolchain evidence

### Community 70 - "/graphify"
Cohesion: 0.22
Nodes (9): /graphify, AST structural extraction, Community detection, Existing graph query fast path, Gemini optional host extraction fallback, Graph confidence audit trail, Interactive HTML GraphRAG JSON graph report, Parallel semantic extraction (+1 more)

### Community 71 - "identity-families"
Cohesion: 0.42
Nodes (9): Financial disposition membership and sanitized audit are atomic, Closure returns eligible credits to original purchasers, Required trusted same-client credits-bookings coordinator, identity-families, Removal donation requires independently verified purchaser consent, I27 guarded internal family lifecycle, Readonly preview; family and financial revision rechecked under locks, Lower-level membership and closure mutations are private (+1 more)

### Community 72 - "POST /api/v1/accounts/invitations creates pending passwordless"
Cohesion: 0.22
Nodes (5): Administrator, manager, reception, cafe_staff and instructor may invite; customer-only actors cannot, POST /api/v1/accounts/invitations creates pending passwordless customer-only accounts; generic ACCEPTED, I15 invitation backend and I16 bilingual management/setup screens implemented, POST /api/v1/auth/setup accepts token/password; single-use activation, Argon2id, session revocation and no automatic login, Create/resend share registration-IP 30/15min; setup shares confirmation/reset action-IP 30/15min; direct socket IP only

### Community 73 - "Shared Interface Components"
Cohesion: 0.33
Nodes (7): ActionAcceptedResponse, CustomerInvitationInput, CustomerInvitations(), changeOpen(), clear(), submit(), InvitationApi

### Community 74 - "Shared Interface Components"
Cohesion: 0.22
Nodes (9): dependencies, class-variance-authority, clsx, @conecta/contracts, lucide-react, @radix-ui/react-dialog, @radix-ui/react-slot, tailwind-merge (+1 more)

### Community 75 - "graphify reference: query, path, explain"
Cohesion: 0.25
Nodes (8): BFS broad neighbor context, DFS dependency path, Explain node, Graph-only evidence answers, graphify reference: query, path, explain, Persist query results, Shortest path, Vocabulary-constrained query expansion

### Community 76 - "graphify reference: incremental update and"
Cohesion: 0.25
Nodes (8): Cluster-only self-contained regeneration, Code-only semantic bypass, Deleted sources prune, graphify reference: incremental update and cluster-only, Incremental changed-file extraction, Manifest stamps only successful semantic outputs, Preserve directed graph semantics, Re-extracted sources replace

### Community 77 - "Verification and Task Tracking"
Cohesion: 0.25
Nodes (5): locale(), account, account, account, account()

### Community 78 - "Backend Configuration and Services"
Cohesion: 0.46
Nodes (7): createGuardianInvitationService(), authorize(), checkSession(), dependent(), inspect(), now(), transaction()

### Community 79 - "Shared Interface Components"
Cohesion: 0.43
Nodes (7): createPhotoService(), file(), reconcile(), clean(), removeUnreferenced(), storage(), save()

### Community 81 - "Identity login backend: I06 checkpoint"
Cohesion: 0.32
Nodes (5): Identity login backend: I06 checkpoint, Login abuse controls, Review and next step, Router factory contract, Session service

### Community 82 - "Commit and push"
Cohesion: 0.29
Nodes (7): Commit and push, Explicit reviewed staging, No force push no reset no hook bypass, Preserve unrelated work and staging, Scoped authorization commit and push, Validate relevant checks, Verify remote hash after push

### Community 83 - "graphify reference: extra exports and"
Cohesion: 0.29
Nodes (7): FalkorDB export, graphify reference: extra exports and benchmark, Graphify stdio MCP, Neo4j Cypher MERGE export, SVG GraphML exports, Token reduction benchmark, Wiki export

### Community 84 - "graphify reference: extraction subagent prompt"
Cohesion: 0.29
Nodes (7): Deterministic full relative path node identifiers, Extracted inferred ambiguous confidence provenance, graphify reference: extraction subagent prompt (compact), Hyperedges maximum three, Rationale node attributes, Semantic similarity inference, Verbatim absolute source file paths

### Community 85 - "Database Schema and Migrations"
Cohesion: 0.52
Nodes (6): account_roles, account_roles_assigned_by_idx, account_roles_role_idx, accounts, accounts_exemption_actor_idx, people

### Community 87 - "Backend Configuration and Services"
Cohesion: 0.33
Nodes (6): devDependencies, tsx, @types/cors, @types/express, @types/node, @types/pg

### Community 88 - "Backend Configuration and Services"
Cohesion: 0.33
Nodes (6): scripts, build, dev, start, test, typecheck

### Community 89 - "Verification and Task Tracking"
Cohesion: 0.33
Nodes (5): email(), object(), RegistrationError, language(), signIn()

### Community 93 - "Operational audit history"
Cohesion: 0.40
Nodes (4): GET /api/v1/audit management-only private operational history, Operational audit history, Allowlisted snapshots exclude secrets raw payloads free-text reasons and correlation IDs, Descending microsecond timestamp and UUID cursor pagination

### Community 94 - "Conecta Infusion: confirmed product intent"
Cohesion: 0.40
Nodes (3): Conecta Infusion Yoga on Instagram, GitHub issue #1, Conecta Infusion: confirmed product intent

### Community 95 - "Conecta Infusión: resumen de permisos"
Cohesion: 0.40
Nodes (3): Conecta Infusión: resumen de permisos, especificación de identidad — ../../SPEC-identity.md, Conecta Infusión: resumen de permisos (PDF snapshot)

### Community 96 - "Shared API Contracts"
Cohesion: 0.40
Nodes (4): name, private, types, version

### Community 97 - "graphify reference: add a URL"
Cohesion: 0.50
Nodes (4): Code watcher AST rebuild no LLM, Document watcher flags semantic update, graphify reference: add a URL and watch a folder, URL ingestion updates corpus

### Community 98 - "graphify reference: GitHub clone and"
Cohesion: 0.50
Nodes (4): Cross repository graph merge, GitHub clone reuse, graphify reference: GitHub clone and cross-repo merge, Local subfolder CLI output isolation

### Community 99 - "graphify reference: commit hook and"
Cohesion: 0.50
Nodes (4): Document image changes require manual update, graphify reference: commit hook and native CLAUDE.md integration, Native CLAUDE graph integration, Opt-in post-commit AST hook

### Community 100 - "graphify reference: transcribe video and"
Cohesion: 0.50
Nodes (4): Domain hint initial prompt, graphify reference: transcribe video and audio, Transcript documents semantic extraction, Whisper audio video transcription

### Community 101 - "Identity implementation decisions"
Cohesion: 0.50
Nodes (3): Argon2id 15?128 code point password policy; m=19456 t=2 p=1, Identity implementation decisions, Ten-minute recent password authentication

### Community 103 - "MCP connections for Codex"
Cohesion: 0.50
Nodes (4): Codex MCP configuration, GitHub MCP setup for Codex, OpenAI Docs MCP, MCP connections for Codex

### Community 104 - "Shared Interface Components"
Cohesion: 0.50
Nodes (4): exports, ./components/*, ./lib/utils, ./styles.css

### Community 106 - "POST /api/v1/auth/recovery email -> generic"
Cohesion: 0.67
Nodes (3): I13 recovery backend and I14 shared bilingual recovery/reset screens implemented, POST /api/v1/auth/recovery email -> generic 202 ACCEPTED; reset token/password -> PASSWORD_RESET, One-hour single-use version-bound reset; active eligible identities only; atomic password update/all-session revocation/audit; no activation/login

## Ambiguous Edges - Review These
- `Conecta Infusión: resumen de permisos` → `Identity specification pending in PDF; approved in Markdown`  [AMBIGUOUS]
  docs/requirements/resumen-permisos.es.pdf · relation: conceptually_related_to

## Knowledge Gaps
- **582 isolated node(s):** `TrustedActor`, `LegacyInstructor`, `LegacyMember`, `Environment`, `EncryptedOutboxPayload` (+577 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 818 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **31 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `Conecta Infusión: resumen de permisos` and `Identity specification pending in PDF; approved in Markdown`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **Why does `pg` connect `Verification and Task Tracking` to `Verification and Task Tracking`, `Shared API Contracts`, `Backend Configuration and Services`, `Shared API Contracts`, `Shared API Contracts`, `Shared Interface Components`, `Verification and Task Tracking`, `Backend Configuration and Services`, `Shared API Contracts`, `Verification and Task Tracking`, `Verification and Task Tracking`, `Verification and Task Tracking`, `Shared API Contracts`, `Backend Configuration and Services`, `Backend Configuration and Services`, `Verification and Task Tracking`?**
  _High betweenness centrality (0.054) - this node is a cross-community bridge._
- **Why does `@playwright/test` connect `Verification and Task Tracking` to `Verification and Task Tracking`, `Verification and Task Tracking`, `Verification and Task Tracking`, `Verification and Task Tracking`, `Verification and Task Tracking`, `Verification and Task Tracking`, `package.json`, `Verification and Task Tracking`?**
  _High betweenness centrality (0.031) - this node is a cross-community bridge._
- **Why does `scripts` connect `scripts` to `package.json`?**
  _High betweenness centrality (0.022) - this node is a cross-community bridge._
- **What connects `TrustedActor`, `LegacyInstructor`, `LegacyMember` to the rest of the system?**
  _582 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Identity Implementation Plan` be split into smaller, more focused modules?**
  _Cohesion score 0.06313497822931785 - nodes in this community are weakly interconnected._
- **Should `Verification and Task Tracking` be split into smaller, more focused modules?**
  _Cohesion score 0.09803921568627451 - nodes in this community are weakly interconnected._
## Incremental Update

Re-extracted only 42 changed source files; unchanged source fragments retained. Approved Identity plan is distinct from implemented code. No PDF regenerated.

## Integrity Limitations

Original extraction reported 16 dangling endpoints and 11 undirected edge collapses. This merged-graph check cannot restore missing information from the original extraction; verify findings against source files.

Fresh changed-file diagnostics: 249 dangling endpoints and 52 undirected edge collapses. The merged graph has 0 missing endpoints; synthesized endpoints do not prove implementations exist. Self-references include V3 accounts and AST name-resolution artifacts; verify call relationships against source. See `graph-health.json`.
