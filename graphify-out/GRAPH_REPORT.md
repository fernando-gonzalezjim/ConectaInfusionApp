# Graph Report - ConectaInfusionApp  (2026-10-05)

## Corpus Check
- 301 files · ~175,895 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 7 file(s) not represented in the graph (top: (none) 3, .example 2, .toml 1)

## Summary
- 2221 nodes · 4893 edges · 136 communities (111 shown, 25 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 71 edges (avg confidence: 0.85)
- Token cost: unavailable (host-agent extraction usage is not exposed; placeholder counters do not mean zero cost).

## Community Hubs (Navigation)
- Backend Configuration and Services
- Verification and Task Tracking
- Shared Interface Components
- Verification and Task Tracking
- Shared Interface Components
- Shared API Contracts
- Shared Interface Components
- Foundation Specification
- Shared API Contracts
- Verification and Task Tracking
- Dependent persistence, backend and screens
- Verification and Task Tracking
- Shared API Contracts
- Database Schema and Migrations
- Verification and Task Tracking
- Shared Interface Components
- Shared Interface Components
- Backend Configuration and Services
- Customer Web Application
- Management Web Application
- Shared Interface Components
- Verification and Task Tracking
- Shared API Contracts
- scripts
- Backend Configuration and Services
- Verification and Task Tracking
- Shared Interface Components
- Shared Interface Components
- Backend Configuration and Services
- Backend Configuration and Services
- Database Schema and Migrations
- Verification and Task Tracking
- Verification and Task Tracking
- Identity Implementation Plan
- Identity Implementation Plan
- Backend Configuration and Services
- Identity Implementation Plan
- Bilingual Business Rules
- Bilingual Business Rules
- Languages and Display Formatting
- Identity Implementation Plan
- Customer Web Application
- Management Web Application
- Identity Accounts and Permissions
- Shared Interface Components
- Shared Interface Components
- Verification and Task Tracking
- Shared Interface Components
- Database Schema and Migrations
- Database Schema and Migrations
- Verification and Task Tracking
- Database Schema and Migrations
- Customer Web Application
- Management Web Application
- Database Schema and Migrations
- Database Schema and Migrations
- Shared Interface Components
- Shared Interface Components
- Role administration
- Languages and Display Formatting
- Shared API Contracts
- Module Boundaries and Dependencies
- Own profile and email changes
- Verification and Task Tracking
- Backend Configuration and Services
- Backend Configuration and Services
- Database Schema and Migrations
- Database Schema and Migrations
- I07 authenticated transport
- Shared API Contracts
- Shared API Contracts
- Identity Implementation Plan
- Identity Implementation Plan
- Backend Configuration and Services
- Manual Identity bootstrap
- Verification and Task Tracking
- Identity Implementation Plan
- /graphify
- Database Schema and Migrations
- identity-families
- POST /api/v1/accounts/invitations creates pending passwordless
- Shared Interface Components
- Identity Implementation Plan
- graphify reference: query, path, explain
- graphify reference: incremental update and
- Backend Configuration and Services
- Backend Configuration and Services
- Backend Configuration and Services
- Shared Interface Components
- Identity login backend: I06 checkpoint
- identity-relationships-review
- Commit and push
- graphify reference: extra exports and
- graphify reference: extraction subagent prompt
- Backend Configuration and Services
- Shared Interface Components
- Backend Configuration and Services
- Database Schema and Migrations
- Backend Configuration and Services
- Backend Configuration and Services
- Database Schema and Migrations
- Backend Configuration and Services
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
- Backend Configuration and Services
- Identity implementation decisions
- I05 persistence and local email
- MCP connections for Codex
- Shared Interface Components
- Backend Configuration and Services
- POST /api/v1/auth/recovery email -> generic
- Shared Interface Components
- commitAndPush.prompt.md
- Customer Web Application
- Customer Web Application
- Management Web Application
- POST /api/v1/accounts/invitations/resend accepts email only;
- Customer screens
- Shared Interface Components

## God Nodes (most connected - your core abstractions)
1. `Identity implementation tasks` - 58 edges
2. `pg` - 56 edges
3. `AuthError` - 43 edges
4. `Identity verification evidence` - 40 edges
5. `@playwright/test` - 38 edges
6. `isolatedDatabase()` - 36 edges
7. `migrate()` - 36 edges
8. `createApiClient()` - 34 edges
9. `createAuthAccount()` - 30 edges
10. `authConfig()` - 28 edges

## Surprising Connections (you probably didn't know these)
- `Conecta Infusion: reglas de negocio acordadas (PDF snapshot)` --semantically_similar_to--> `Conecta Infusion: reglas de negocio acordadas`  [INFERRED] [semantically similar]
  docs/requirements/agreed-business-rules.es.pdf → docs/requirements/agreed-business-rules.es.md
- `Foundation human review pending` --conceptually_related_to--> `Document`  [INFERRED]
  tasks/todo.md → AGENTS.md
- `Conecta Infusión: resumen de permisos (PDF snapshot)` --semantically_similar_to--> `Conecta Infusión: resumen de permisos`  [INFERRED] [semantically similar]
  docs/requirements/resumen-permisos.es.pdf → docs/requirements/resumen-permisos.es.md
- `Settings update and audit atomic singleton lock` --semantically_similar_to--> `Transactional append-only sanitized audit`  [INFERRED] [semantically similar]
  docs/architecture.md → SPEC-foundation.md
- `LoginResult` --references--> `PublicAccount`  [EXTRACTED]
  apps/api/src/modules/identity/sessions.ts → packages/contracts/index.d.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Completed invitation creation, resend and deliberate password setup flow** — docs_identity_invitations_create, docs_identity_invitations_resend, docs_identity_invitations_setup, docs_identity_invitations_browser_safety [EXTRACTED 1.00]
- **Guarded operator-only development bootstrap** — docs_identity_bootstrap_development_testuser, docs_identity_bootstrap_local_target_guards, docs_identity_bootstrap_fixture_provenance, docs_identity_bootstrap_private_sql_output [EXTRACTED 1.00]
- **Shared customer and management authentication flow** — docs_identity_customer_login_customer_login, docs_identity_management_login_management_login, docs_identity_auth_transport_authenticated_transport, docs_identity_auth_transport_shared_host_cookie [EXTRACTED 1.00]
- **Lifecycle safety across completed I35-I38** — tasks_identity_verification_lifecycle_fail_closed, tasks_identity_verification_deactivation_atomicity, tasks_identity_verification_reactivation_provenance, tasks_identity_verification_i38_verified_ui [EXTRACTED 1.00]
- **Verified lifecycle handoff preserves integration boundaries** — tasks_identity_verification_i38_verified_ui, tasks_identity_verification_i38_verification_results, tasks_identity_verification_production_boundaries [EXTRACTED 1.00]

## Communities (136 total, 25 thin omitted)

### Community 0 - "Backend Configuration and Services"
Cohesion: 0.10
Nodes (39): address(), object(), PendingAccount, personnel, ActionBinding, ActionError, actionSubjectHash(), cancelActionDelivery() (+31 more)

### Community 1 - "Verification and Task Tracking"
Cohesion: 0.06
Nodes (13): fixture(), account(), token(), fixture(), account(), raw(), fixture(), account() (+5 more)

### Community 2 - "Shared Interface Components"
Cohesion: 0.08
Nodes (35): api, CustomerAccess(), api, FoundationApp(), api, CustomerActionPage(), RegistrationAccess(), api (+27 more)

### Community 3 - "Verification and Task Tracking"
Cohesion: 0.12
Nodes (12): authConfig(), createAuthAccount(), password, harness(), isolatedDatabase(), migrate(), token(), load() (+4 more)

### Community 4 - "Shared Interface Components"
Cohesion: 0.15
Nodes (31): IdentityPage, FamilyLifecycleUnavailable(), LifecycleKey, LifecycleText, Button, ButtonProps, buttonVariants, InvitationKey (+23 more)

### Community 5 - "Shared API Contracts"
Cohesion: 0.08
Nodes (34): child(), ApiError, createApiClient(), accountMutation(), anonymousAction(), csrfToken(), familyMutation(), familyPreview() (+26 more)

### Community 6 - "Shared Interface Components"
Cohesion: 0.07
Nodes (36): actions, fields, Key, OperationalAudit(), Text, value(), Read, Write (+28 more)

### Community 7 - "Foundation Specification"
Cohesion: 0.04
Nodes (48): Architecture, Audit mutation rejection triggers, Business timezone independent device timezone, Controlled browser tests use intercepted responses, Docker integration verifies real migrations and live browser screens, Express backend owns PostgreSQL business behavior, Flyway sole migration runner, Foundation excludes production authentication financial workflows full WCAG certification (+40 more)

### Community 8 - "Shared API Contracts"
Cohesion: 0.11
Nodes (20): createDevelopmentTestUser(), developmentDatabaseUrl(), generateFirstAdminSql(), literal(), text(), boundedWork(), hashDevelopmentFixturePassword(), hashPassword() (+12 more)

### Community 9 - "Verification and Task Tracking"
Cohesion: 0.07
Nodes (21): locale(), submit(), @axe-core/playwright, @playwright/test, overview, settings, actor, target (+13 more)

### Community 10 - "Dependent persistence, backend and screens"
Cohesion: 0.07
Nodes (29): Existing fixtures for I38 verification, Guarded full development reset, Fictional development dataset, Demo Inactive Dependent, Preserved family history and credit disposition, Account deactivation, Guarded account deactivation APIs, Authorized immutable deactivation retries (+21 more)

### Community 11 - "Verification and Task Tracking"
Cohesion: 0.08
Nodes (30): ActionPurpose, Environment, invalid(), loopback(), origin(), readIdentityConfig(), secret(), text() (+22 more)

### Community 12 - "Shared API Contracts"
Cohesion: 0.09
Nodes (36): AcceptedFamilyInvitation, actor(), checkFamilySessionInTransaction(), createFamilyInTransaction(), FamilyChange, FamilyContext, FamilyLifecycleInput, FamilyState (+28 more)

### Community 13 - "Database Schema and Migrations"
Cohesion: 0.09
Nodes (33): booking_child_snapshot_history, booking_child_snapshot_no_truncate, bookings_acting_account_idx, bookings_attendee_person_idx, bookings_saved_child_idx, dependent_creation_guardian_idx, dependent_current_guardian_idx, dependent_deactivation_history (+25 more)

### Community 14 - "Verification and Task Tracking"
Cohesion: 0.07
Nodes (11): load(), config(), harness(), post(), env, dependencies, key(), load() (+3 more)

### Community 15 - "Shared Interface Components"
Cohesion: 0.10
Nodes (23): accessFailure(), AccessLost, AccountAdministration(), AccountEditor(), save(), AdministrationApi, errorKey(), Key (+15 more)

### Community 16 - "Shared Interface Components"
Cohesion: 0.10
Nodes (19): GuardianInvitationAccepted, GuardianInvitationPreview, LoginInput, LoginResponse, PublicAccount, SessionResponse, AccountAccess(), mutate() (+11 more)

### Community 17 - "Backend Configuration and Services"
Cohesion: 0.09
Nodes (28): createIdentityLifecycleComposition(), inspect(), foundationTables, identityTables, Account, transaction(), discover(), Guardian (+20 more)

### Community 18 - "Customer Web Application"
Cohesion: 0.06
Nodes (35): dependencies, @conecta/api-client, @conecta/contracts, @conecta/i18n, @conecta/ui, react, react-dom, devDependencies (+27 more)

### Community 19 - "Management Web Application"
Cohesion: 0.06
Nodes (35): dependencies, @conecta/api-client, @conecta/contracts, @conecta/i18n, @conecta/ui, react, react-dom, devDependencies (+27 more)

### Community 20 - "Shared Interface Components"
Cohesion: 0.07
Nodes (26): email(), DependentTransitionInput, DependentTransitionResponse, EmailChangedResponse, EmailConfirmedResponse, PasswordResetInput, PasswordResetResponse, PasswordSetupResponse (+18 more)

### Community 21 - "Verification and Task Tracking"
Cohesion: 0.09
Nodes (10): fixture(), account(), closeFamilyInTransaction(), emptyFixtureCoordinator(), endFamilyMembershipInTransaction(), obligations, fixture(), actorContext() (+2 more)

### Community 22 - "Shared API Contracts"
Cohesion: 0.10
Nodes (21): appendSettingsAudit(), SettingsAudit, TrustedActor, readPublicSettings(), updateSettings(), updateSettingsInTransaction(), Settings, validateSettings() (+13 more)

### Community 23 - "scripts"
Cohesion: 0.06
Nodes (31): devDependencies, @axe-core/playwright, concurrently, @playwright/test, typescript, engines, node, name (+23 more)

### Community 24 - "Backend Configuration and Services"
Cohesion: 0.09
Nodes (22): createAccountService(), authorize(), profile(), LegacyInstructor, LegacyMember, object(), profileInput(), roles (+14 more)

### Community 25 - "Verification and Task Tracking"
Cohesion: 0.12
Nodes (13): dev, load(), sharp, createDemoPhotoFixture(), hiddenPassword(), finish(), keypress(), parse() (+5 more)

### Community 26 - "Shared Interface Components"
Cohesion: 0.14
Nodes (21): createDependentClient(), child(), dependent(), id(), page(), target(), identifier(), Query (+13 more)

### Community 27 - "Shared Interface Components"
Cohesion: 0.12
Nodes (16): ActionAcceptedResponse, CustomerInvitationInput, FamilyCreateInput, FamilyInvitationActionInput, FamilyInvitationInput, FamilyInvitationPreview, FamilyView, CustomerInvitations() (+8 more)

### Community 28 - "Backend Configuration and Services"
Cohesion: 0.17
Nodes (18): createApplication(), createAuditViewService(), createDeactivationService(), createDeactivationRouter(), createGuardianReactivationService(), inspect(), profile(), rawToken() (+10 more)

### Community 29 - "Backend Configuration and Services"
Cohesion: 0.18
Nodes (15): createAccountRouter(), createAuditRouter(), createAuthRouter(), failure(), readSessionCookie(), requireEmptyBody(), sessionCookieName, createManagementRouter() (+7 more)

### Community 30 - "Database Schema and Migrations"
Cohesion: 0.13
Nodes (17): audit_append_only, business_settings, business_units, audit_events_page_idx, enforce_family_state(), families, family_creation_membership_idx, family_current_membership_idx (+9 more)

### Community 31 - "Verification and Task Tracking"
Cohesion: 0.11
Nodes (7): load(), harness(), load(), addGuardian(), dependent(), transaction(), valid

### Community 32 - "Verification and Task Tracking"
Cohesion: 0.13
Nodes (10): cleanDevelopmentDatabase(), administrationStates, customers, demoPassword, id(), personnel, profileScenarios, seedDevelopmentDemo() (+2 more)

### Community 34 - "Identity Implementation Plan"
Cohesion: 0.10
Nodes (21): Checkpoint after I03, Checkpoint after I06, Checkpoint after I09, Checkpoint after I12, Checkpoint after I15, Checkpoint after I18, Checkpoint after I21, Checkpoint after I24 (+13 more)

### Community 35 - "Backend Configuration and Services"
Cohesion: 0.19
Nodes (18): appendIdentityAudit(), boundedString(), fail(), familyFields, IdentityAudit, readIdentityAuditSnapshot(), roles, sanitizedSnapshot() (+10 more)

### Community 36 - "Identity Implementation Plan"
Cohesion: 0.13
Nodes (15): Graphify incremental refresh cadence, I36-I38 changed-source refresh evidence, October 5, 2026 I36-I38 refresh evidence, I35: Lifecycle composition guard, I36: Account deactivation, I37: Reactivation, I38: Lifecycle UI, Atomic authorized account deactivation (+7 more)

### Community 37 - "Bilingual Business Rules"
Cohesion: 0.11
Nodes (19): 10. Café, 11. Details to resolve during specification, 1. Studio, language, and settings, 2. Financial separation and payment collection, 3. Packages, credit value, expiration, and selection, 4. Booking, cancellation, and capacity, 5. Family sharing and leaving a family, 6. Manual adjustments and audit history (+11 more)

### Community 38 - "Bilingual Business Rules"
Cohesion: 0.11
Nodes (18): 10. Cafetería, 11. Detalles por resolver durante la especificación, 1. Estudio, idioma y configuración, 2. Separación financiera y cobro, 3. Paquetes, valor de los créditos, vencimiento y selección, 4. Reservas, cancelaciones y cupo, 5. Créditos compartidos y salida del grupo familiar, 6. Ajustes manuales e historial de auditoría (+10 more)

### Community 39 - "Languages and Display Formatting"
Cohesion: 0.11
Nodes (17): dependencies, @conecta/contracts, exports, ./format, @conecta/contracts, react, react-dom, name (+9 more)

### Community 40 - "Identity Implementation Plan"
Cohesion: 0.16
Nodes (18): I01: Resolve technical choices, I02: Account persistence, I03: Identity audit, I04: Password and bootstrap, I05: Session and delivery persistence, I06: Login backend, I08: Customer login slice, I09: Management login slice (+10 more)

### Community 41 - "Customer Web Application"
Cohesion: 0.12
Nodes (16): aliases, components, hooks, lib, ui, utils, iconLibrary, rsc (+8 more)

### Community 42 - "Management Web Application"
Cohesion: 0.12
Nodes (16): aliases, components, hooks, lib, ui, utils, iconLibrary, rsc (+8 more)

### Community 43 - "Identity Accounts and Permissions"
Cohesion: 0.12
Nodes (15): Advisory lock serializes last-active-administration protection, Acceptance scenarios, Boundaries and decisions still needed, Commands and structure, Confirmed account permissions, Deletion and family boundaries, Spec: Identity and access, Email sign-in, first-admin bootstrap and development accounts (+7 more)

### Community 44 - "Shared Interface Components"
Cohesion: 0.15
Nodes (13): GuardianInviteTarget, GuardianRemovalTarget, GuardianRemovedResponse, GuardianAccess(), GuardianApi, guardianError(), GuardianPanel(), failure() (+5 more)

### Community 45 - "Shared Interface Components"
Cohesion: 0.12
Nodes (16): aliases, components, hooks, lib, ui, utils, iconLibrary, rsc (+8 more)

### Community 47 - "Shared Interface Components"
Cohesion: 0.13
Nodes (13): name, private, type, version, @conecta/contracts, argon2, cors, helmet (+5 more)

### Community 48 - "Database Schema and Migrations"
Cohesion: 0.25
Nodes (11): enforce_guardian_invitation_binding(), guardian_consent_exception_guard, guardian_consent_exception_no_truncate, guardian_consent_exceptions, guardian_invitation_binding, guardian_invitation_history, guardian_invitation_no_truncate, guardian_invitations (+3 more)

### Community 49 - "Database Schema and Migrations"
Cohesion: 0.23
Nodes (15): identity_action_tokens, identity_action_tokens_account_idx, identity_action_tokens_expiry_idx, identity_action_tokens_person_idx, identity_action_tokens_recipient_idx, identity_action_tokens_target_idx, identity_email_outbox, identity_email_outbox_action_idx (+7 more)

### Community 50 - "Verification and Task Tracking"
Cohesion: 0.13
Nodes (10): Visual direction: Conecta Infusion, baseline, Flyway Docker, Playwright web servers, shadcn/ui monorepos, Tailwind v4, Tailwind Vite installation, Implementation plan: Foundation (+2 more)

### Community 51 - "Database Schema and Migrations"
Cohesion: 0.23
Nodes (10): dependent_account_state, enforce_dependent_state(), enforce_guardian_reactivation_consent(), guardian_reactivation_authorization, guardian_reactivation_binding, guardian_reactivation_history, guardian_reactivation_invitations, guardian_reactivation_no_truncate (+2 more)

### Community 52 - "Customer Web Application"
Cohesion: 0.13
Nodes (14): compilerOptions, allowImportingTsExtensions, esModuleInterop, jsx, lib, module, moduleResolution, noEmit (+6 more)

### Community 53 - "Management Web Application"
Cohesion: 0.13
Nodes (14): compilerOptions, allowImportingTsExtensions, esModuleInterop, jsx, lib, module, moduleResolution, noEmit (+6 more)

### Community 54 - "Database Schema and Migrations"
Cohesion: 0.24
Nodes (7): enforce_family_invitation_token(), family_invitation_history, family_invitation_no_truncate, family_invitation_token_binding, family_invitations, family_one_pending_invitation_idx, identity_family_invitation_valid()

### Community 55 - "Database Schema and Migrations"
Cohesion: 0.24
Nodes (7): enforce_family_successor_token(), family_one_pending_successor_idx, family_successor_history, family_successor_no_truncate, family_successor_offers, family_successor_token_binding, identity_family_successor_valid()

### Community 56 - "Shared Interface Components"
Cohesion: 0.13
Nodes (14): react, react-dom, name, private, scripts, typecheck, type, version (+6 more)

### Community 57 - "Shared Interface Components"
Cohesion: 0.13
Nodes (14): compilerOptions, allowImportingTsExtensions, esModuleInterop, jsx, lib, module, moduleResolution, noEmit (+6 more)

### Community 58 - "Role administration"
Cohesion: 0.18
Nodes (13): Management-only bounded UUID-cursor account listing, Account listing and personal profile edits, Authorized canonical person name phone and locale edits, Locked session account person role authorization and atomic audit, Bilingual accessible management account and role screens, Management account screens, Pending mutation blocks dismissal and competing saves; uncertain outcomes require refresh, Actual role changes revoke target sessions and remount self session controls (+5 more)

### Community 59 - "Languages and Display Formatting"
Cohesion: 0.14
Nodes (13): compilerOptions, allowImportingTsExtensions, esModuleInterop, jsx, lib, module, moduleResolution, noEmit (+5 more)

### Community 60 - "Shared API Contracts"
Cohesion: 0.19
Nodes (10): app, pool, getStudioOverview(), port, server, stopPhotoCleanup, CafeProduct, StudioOverview (+2 more)

### Community 61 - "Module Boundaries and Dependencies"
Cohesion: 0.28
Nodes (9): cafe-sales, credits-bookings, Capability map: Conecta Infusion, financial-reporting, identity, instructor-payroll, payments, public-home (+1 more)

### Community 62 - "Own profile and email changes"
Cohesion: 0.15
Nodes (13): Profile photos, Validate 5 MiB and 16 million pixels; static JPEG PNG WebP re-encoded metadata-free to at most 512 by 512 WebP, Manual demo, Postcommit replacement cleanup plus bounded Windows retries and 24-hour orphan reconciliation grace, Authorized own or management cross-account private photos, Production durable private storage retention backups and distributed staging require separate work, Upload and storage contract, API contracts (+5 more)

### Community 63 - "Verification and Task Tracking"
Cohesion: 0.20
Nodes (4): admin, valid, assertLegacySchemaMatches(), schemaSnapshot()

### Community 64 - "Backend Configuration and Services"
Cohesion: 0.29
Nodes (8): IdentitySecrets, associatedData(), decryptOutboxPayload(), EncryptedOutboxPayload, encryptOutboxPayload(), invalid(), OutboxContext, uuid()

### Community 65 - "Backend Configuration and Services"
Cohesion: 0.17
Nodes (11): compilerOptions, esModuleInterop, module, moduleResolution, noUncheckedIndexedAccess, outDir, rootDir, skipLibCheck (+3 more)

### Community 66 - "Database Schema and Migrations"
Cohesion: 0.32
Nodes (11): bookings, bookings_class_session_idx, class_sessions, class_sessions_starts_at_idx, instructors, members, members_email_unique, products (+3 more)

### Community 67 - "Database Schema and Migrations"
Cohesion: 0.32
Nodes (11): bookings, bookings_class_session_idx, class_sessions, class_sessions_starts_at_idx, instructors, members, members_email_unique, products (+3 more)

### Community 68 - "I07 authenticated transport"
Cohesion: 0.26
Nodes (8): I07 authenticated transport, Credentialed createApiClient authentication methods, Shared host-only HttpOnly frontend session cookie, I08 bilingual customer sign-in and account controls, Shared accessible SignInForm, Shared AccountAccess controls, GET management/access: current server administrator/manager capability, I09 management sign-in and access

### Community 69 - "Shared API Contracts"
Cohesion: 0.17
Nodes (11): dependencies, @conecta/contracts, exports, @conecta/contracts, name, private, scripts, test (+3 more)

### Community 70 - "Shared API Contracts"
Cohesion: 0.18
Nodes (10): compilerOptions, allowImportingTsExtensions, lib, module, moduleResolution, noEmit, skipLibCheck, strict (+2 more)

### Community 71 - "Identity Implementation Plan"
Cohesion: 0.20
Nodes (11): I22: Operational audit views, I23: Family persistence, I24: Family invitation backend, I25: Family UI, I26: Successor responsibility, I27: Membership lifecycle contracts, I28: Dependent persistence, I22–I23: Operational history and family persistence — October 4, 2026 (+3 more)

### Community 72 - "Identity Implementation Plan"
Cohesion: 0.18
Nodes (11): I29: Dependent profile backend, I30: Dependent UI, I31: Guardian consent, I32: Guardian removal, I33: Independent account transition, I34: Family/dependent review, I29: Dependent profile backend (October 5, 2026), I30: Dependent customer screens (October 5, 2026) (+3 more)

### Community 73 - "Backend Configuration and Services"
Cohesion: 0.20
Nodes (10): dependencies, argon2, @conecta/contracts, cors, dotenv, express, helmet, nodemailer (+2 more)

### Community 75 - "Verification and Task Tracking"
Cohesion: 0.20
Nodes (6): ﻿# Foundation verification, Flyway Docker/CLI, Playwright accessibility, shadcn monorepo, Tailwind Vite, Foundation toolchain evidence

### Community 76 - "Identity Implementation Plan"
Cohesion: 0.20
Nodes (10): I17: Account administration backend, I18: Role administration, I19: Administration UI, I20: Self profile and email change, I21: Profile photos, I17 - account listing and authorized personal profile edits, I18 - transactional role administration, I19: Administration UI — October 4, 2026 (+2 more)

### Community 77 - "/graphify"
Cohesion: 0.22
Nodes (9): /graphify, AST structural extraction, Community detection, Existing graph query fast path, Gemini optional host extraction fallback, Graph confidence audit trail, Interactive HTML GraphRAG JSON graph report, Parallel semantic extraction (+1 more)

### Community 78 - "Database Schema and Migrations"
Cohesion: 0.25
Nodes (5): dependent_deactivation_snapshot, dependent_person_state, dependent_role_state, snapshot_dependent_deactivation(), identity_dependent_transition_valid()

### Community 79 - "identity-families"
Cohesion: 0.42
Nodes (9): Financial disposition membership and sanitized audit are atomic, Closure returns eligible credits to original purchasers, Required trusted same-client credits-bookings coordinator, identity-families, Removal donation requires independently verified purchaser consent, I27 guarded internal family lifecycle, Readonly preview; family and financial revision rechecked under locks, Lower-level membership and closure mutations are private (+1 more)

### Community 80 - "POST /api/v1/accounts/invitations creates pending passwordless"
Cohesion: 0.22
Nodes (5): Administrator, manager, reception, cafe_staff and instructor may invite; customer-only actors cannot, POST /api/v1/accounts/invitations creates pending passwordless customer-only accounts; generic ACCEPTED, I15 invitation backend and I16 bilingual management/setup screens implemented, POST /api/v1/auth/setup accepts token/password; single-use activation, Argon2id, session revocation and no automatic login, Create/resend share registration-IP 30/15min; setup shares confirmation/reset action-IP 30/15min; direct socket IP only

### Community 81 - "Shared Interface Components"
Cohesion: 0.22
Nodes (9): dependencies, class-variance-authority, clsx, @conecta/contracts, lucide-react, @radix-ui/react-dialog, @radix-ui/react-slot, tailwind-merge (+1 more)

### Community 82 - "Identity Implementation Plan"
Cohesion: 0.22
Nodes (9): I12: Registration UI, I13: Recovery backend, I14: Recovery UI, I15: Customer invitations backend, I16: Invitation UI, I12 ? customer registration UI, I13 - password recovery backend, I14 - recovery and password reset UI (+1 more)

### Community 83 - "graphify reference: query, path, explain"
Cohesion: 0.25
Nodes (8): BFS broad neighbor context, DFS dependency path, Explain node, Graph-only evidence answers, graphify reference: query, path, explain, Persist query results, Shortest path, Vocabulary-constrained query expansion

### Community 84 - "graphify reference: incremental update and"
Cohesion: 0.25
Nodes (8): Cluster-only self-contained regeneration, Code-only semantic bypass, Deleted sources prune, graphify reference: incremental update and cluster-only, Incremental changed-file extraction, Manifest stamps only successful semantic outputs, Preserve directed graph semantics, Re-extracted sources replace

### Community 85 - "Backend Configuration and Services"
Cohesion: 0.39
Nodes (7): createChildDetailsService(), audit(), authorize(), checkSession(), createDependent(), dependent(), transaction()

### Community 86 - "Backend Configuration and Services"
Cohesion: 0.39
Nodes (6): anonymousCookie(), anonymousCsrfCookieName, createCsrfProtection(), sign(), valid(), equal()

### Community 87 - "Backend Configuration and Services"
Cohesion: 0.46
Nodes (7): createGuardianInvitationService(), authorize(), checkSession(), dependent(), inspect(), now(), transaction()

### Community 88 - "Shared Interface Components"
Cohesion: 0.43
Nodes (7): createPhotoService(), file(), reconcile(), clean(), removeUnreferenced(), storage(), save()

### Community 90 - "Identity login backend: I06 checkpoint"
Cohesion: 0.32
Nodes (5): Identity login backend: I06 checkpoint, Login abuse controls, Review and next step, Router factory contract, Session service

### Community 92 - "Commit and push"
Cohesion: 0.29
Nodes (7): Commit and push, Explicit reviewed staging, No force push no reset no hook bypass, Preserve unrelated work and staging, Scoped authorization commit and push, Validate relevant checks, Verify remote hash after push

### Community 93 - "graphify reference: extra exports and"
Cohesion: 0.29
Nodes (7): FalkorDB export, graphify reference: extra exports and benchmark, Graphify stdio MCP, Neo4j Cypher MERGE export, SVG GraphML exports, Token reduction benchmark, Wiki export

### Community 94 - "graphify reference: extraction subagent prompt"
Cohesion: 0.29
Nodes (7): Deterministic full relative path node identifiers, Extracted inferred ambiguous confidence provenance, graphify reference: extraction subagent prompt (compact), Hyperedges maximum three, Rationale node attributes, Semantic similarity inference, Verbatim absolute source file paths

### Community 95 - "Backend Configuration and Services"
Cohesion: 0.43
Nodes (5): createDependentRouter(), createGuardianService(), authorize(), checkSession(), transaction()

### Community 96 - "Shared Interface Components"
Cohesion: 0.48
Nodes (7): familyId(), familyError(), FamilyInvitation(), act(), FamilyResponsibility(), failure(), submit()

### Community 97 - "Backend Configuration and Services"
Cohesion: 0.24
Nodes (4): createProfileService(), recent(), transaction(), createRegistrationService()

### Community 98 - "Database Schema and Migrations"
Cohesion: 0.52
Nodes (6): account_roles, account_roles_assigned_by_idx, account_roles_role_idx, accounts, accounts_exemption_actor_idx, people

### Community 99 - "Backend Configuration and Services"
Cohesion: 0.33
Nodes (6): devDependencies, tsx, @types/cors, @types/express, @types/node, @types/pg

### Community 100 - "Backend Configuration and Services"
Cohesion: 0.33
Nodes (6): scripts, build, dev, start, test, typecheck

### Community 101 - "Database Schema and Migrations"
Cohesion: 0.47
Nodes (3): identity_lifecycle_operations, identity_lifecycle_receipt_history, identity_lifecycle_receipt_no_truncate

### Community 102 - "Backend Configuration and Services"
Cohesion: 0.50
Nodes (3): createDependentTransitionService(), checkSession(), lock()

### Community 106 - "Operational audit history"
Cohesion: 0.40
Nodes (4): GET /api/v1/audit management-only private operational history, Operational audit history, Allowlisted snapshots exclude secrets raw payloads free-text reasons and correlation IDs, Descending microsecond timestamp and UUID cursor pagination

### Community 107 - "Conecta Infusion: confirmed product intent"
Cohesion: 0.40
Nodes (3): Conecta Infusion Yoga on Instagram, GitHub issue #1, Conecta Infusion: confirmed product intent

### Community 108 - "Conecta Infusión: resumen de permisos"
Cohesion: 0.40
Nodes (3): Conecta Infusión: resumen de permisos, especificación de identidad — ../../SPEC-identity.md, Conecta Infusión: resumen de permisos (PDF snapshot)

### Community 109 - "Shared API Contracts"
Cohesion: 0.40
Nodes (4): name, private, types, version

### Community 110 - "graphify reference: add a URL"
Cohesion: 0.50
Nodes (4): Code watcher AST rebuild no LLM, Document watcher flags semantic update, graphify reference: add a URL and watch a folder, URL ingestion updates corpus

### Community 111 - "graphify reference: GitHub clone and"
Cohesion: 0.50
Nodes (4): Cross repository graph merge, GitHub clone reuse, graphify reference: GitHub clone and cross-repo merge, Local subfolder CLI output isolation

### Community 112 - "graphify reference: commit hook and"
Cohesion: 0.50
Nodes (4): Document image changes require manual update, graphify reference: commit hook and native CLAUDE.md integration, Native CLAUDE graph integration, Opt-in post-commit AST hook

### Community 113 - "graphify reference: transcribe video and"
Cohesion: 0.50
Nodes (4): Domain hint initial prompt, graphify reference: transcribe video and audio, Transcript documents semantic extraction, Whisper audio video transcription

### Community 115 - "Identity implementation decisions"
Cohesion: 0.50
Nodes (3): Argon2id 15?128 code point password policy; m=19456 t=2 p=1, Identity implementation decisions, Ten-minute recent password authentication

### Community 117 - "MCP connections for Codex"
Cohesion: 0.50
Nodes (4): Codex MCP configuration, GitHub MCP setup for Codex, OpenAI Docs MCP, MCP connections for Codex

### Community 118 - "Shared Interface Components"
Cohesion: 0.50
Nodes (4): exports, ./components/*, ./lib/utils, ./styles.css

### Community 120 - "POST /api/v1/auth/recovery email -> generic"
Cohesion: 0.67
Nodes (3): I13 recovery backend and I14 shared bilingual recovery/reset screens implemented, POST /api/v1/auth/recovery email -> generic 202 ACCEPTED; reset token/password -> PASSWORD_RESET, One-hour single-use version-bound reset; active eligible identities only; atomic password update/all-session revocation/audit; no activation/login

### Community 121 - "Shared Interface Components"
Cohesion: 0.67
Nodes (3): peerDependencies, react, react-dom

## Ambiguous Edges - Review These
- `Conecta Infusión: resumen de permisos` → `Identity specification pending in PDF; approved in Markdown`  [AMBIGUOUS]
  docs/requirements/resumen-permisos.es.pdf · relation: conceptually_related_to

## Knowledge Gaps
- **638 isolated node(s):** `PendingAccount`, `Account`, `Action`, `Guardian`, `Account` (+633 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 904 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **25 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `Conecta Infusión: resumen de permisos` and `Identity specification pending in PDF; approved in Markdown`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **Why does `pg` connect `Shared API Contracts` to `Backend Configuration and Services`, `Verification and Task Tracking`, `Backend Configuration and Services`, `Verification and Task Tracking`, `Verification and Task Tracking`, `Verification and Task Tracking`, `Shared API Contracts`, `Shared API Contracts`, `Shared Interface Components`, `Verification and Task Tracking`, `Backend Configuration and Services`, `Shared API Contracts`, `Backend Configuration and Services`, `Verification and Task Tracking`, `Backend Configuration and Services`, `Verification and Task Tracking`?**
  _High betweenness centrality (0.060) - this node is a cross-community bridge._
- **Why does `@playwright/test` connect `Verification and Task Tracking` to `Shared API Contracts`, `Shared API Contracts`, `Verification and Task Tracking`, `Shared API Contracts`, `scripts`?**
  _High betweenness centrality (0.031) - this node is a cross-community bridge._
- **Why does `@types/node` connect `Customer Web Application` to `Shared Interface Components`?**
  _High betweenness centrality (0.020) - this node is a cross-community bridge._
- **What connects `PendingAccount`, `Account`, `Action` to the rest of the system?**
  _638 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Backend Configuration and Services` be split into smaller, more focused modules?**
  _Cohesion score 0.0998185117967332 - nodes in this community are weakly interconnected._
- **Should `Verification and Task Tracking` be split into smaller, more focused modules?**
  _Cohesion score 0.061952861952861954 - nodes in this community are weakly interconnected._
## Incremental Update

Re-extracted only 51 changed source files; unchanged source fragments retained. Approved Identity plan is distinct from implemented code. No PDF regenerated.

## Integrity Limitations

Original extraction reported 16 dangling endpoints and 11 undirected edge collapses. This merged-graph check cannot restore missing information from the original extraction; verify findings against source files.

Fresh changed-file diagnostics: 334 dangling endpoints and 52 undirected edge collapses. The merged graph has 0 missing endpoints; synthesized endpoints do not prove implementations exist. Self-references include V3 accounts and AST name-resolution artifacts; verify call relationships against source. See `graph-health.json`.
