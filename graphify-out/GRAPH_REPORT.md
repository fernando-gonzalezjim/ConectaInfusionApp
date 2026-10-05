# Graph Report - ConectaInfusionApp  (2026-10-05)

## Corpus Check
- 240 files · ~136,927 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 7 file(s) not represented in the graph (top: (none) 3, .example 2, .toml 1)

## Summary
- 1731 nodes · 3447 edges · 129 communities (100 shown, 29 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 34 edges (avg confidence: 0.85)
- Token cost: unavailable (host-agent extraction usage is not exposed; placeholder counters do not mean zero cost).

## Community Hubs (Navigation)
- Verification and Task Tracking
- Module Boundaries and Dependencies
- Foundation Specification
- Backend Configuration and Services
- Identity Implementation Plan
- Verification and Task Tracking
- Database Schema and Migrations
- Backend Configuration and Services
- Verification and Task Tracking
- Management Web Application
- Shared Interface Components
- Languages and Display Formatting
- Shared API Contracts
- Shared Interface Components
- Shared Interface Components
- Identity Accounts and Permissions
- Shared Interface Components
- Shared Interface Components
- Verification and Task Tracking
- Shared API Contracts
- Shared Interface Components
- Backend Configuration and Services
- Shared API Contracts
- Shared Interface Components
- Verification and Task Tracking
- Backend Configuration and Services
- Shared API Contracts
- Verification and Task Tracking
- scripts
- Languages and Display Formatting
- Verification and Task Tracking
- Shared Interface Components
- Backend Configuration and Services
- Customer Web Application
- Management Web Application
- Shared Interface Components
- Customer Web Application
- Customer Web Application
- Database Schema and Migrations
- Database Schema and Migrations
- Bilingual Business Rules
- Bilingual Business Rules
- Shared Interface Components
- Identity Accounts and Permissions
- Verification and Task Tracking
- Verification and Task Tracking
- Management Web Application
- Languages and Display Formatting
- Verification and Task Tracking
- Shared API Contracts
- Backend Configuration and Services
- Database Schema and Migrations
- Database Schema and Migrations
- I07 authenticated transport
- Shared API Contracts
- Shared Interface Components
- Backend Configuration and Services
- Backend Configuration and Services
- Identity Implementation Plan
- Backend Configuration and Services
- Manual Identity bootstrap
- Shared API Contracts
- Shared Interface Components
- Verification and Task Tracking
- Verification and Task Tracking
- Verification and Task Tracking
- /graphify
- Identity Implementation Plan
- POST /api/v1/accounts/invitations creates pending passwordless
- graphify reference: query, path, explain
- graphify reference: incremental update and
- Shared Interface Components
- Identity login backend: I06 checkpoint
- package.json
- Commit and push
- graphify reference: extra exports and
- graphify reference: extraction subagent prompt
- Customer Web Application
- Customer Web Application
- Database Schema and Migrations
- Identity Implementation Plan
- Verification and Task Tracking
- Verification and Task Tracking
- Backend Configuration and Services
- Backend Configuration and Services
- Identity Implementation Plan
- Customer Web Application
- Operational audit history
- Conecta Infusion: confirmed product intent
- Conecta Infusión: resumen de permisos
- devDependencies
- Shared API Contracts
- Identity Implementation Plan
- Identity Implementation Plan
- Verification and Task Tracking
- graphify reference: add a URL
- graphify reference: GitHub clone and
- graphify reference: commit hook and
- graphify reference: transcribe video and
- Identity implementation decisions
- I05 persistence and local email
- MCP connections for Codex
- Verification and Task Tracking
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
- Verification and Task Tracking
- Verification and Task Tracking
- Shared Interface Components

## God Nodes (most connected - your core abstractions)
1. `Document` - 90 edges
2. `pg` - 41 edges
3. `AuthError` - 34 edges
4. `createApiClient()` - 31 edges
5. `@playwright/test` - 28 edges
6. `Spec: Foundation` - 27 edges
7. `isolatedDatabase()` - 25 edges
8. `migrate()` - 25 edges
9. `Conecta Infusion: reglas de negocio acordadas` - 21 edges
10. `appendIdentityAudit()` - 21 edges

## Surprising Connections (you probably didn't know these)
- `Conecta Infusion: reglas de negocio acordadas (PDF snapshot)` --semantically_similar_to--> `Conecta Infusion: reglas de negocio acordadas`  [INFERRED] [semantically similar]
  docs/requirements/agreed-business-rules.es.pdf → docs/requirements/agreed-business-rules.es.md
- `Foundation human review pending` --conceptually_related_to--> `Document`  [INFERRED]
  tasks/todo.md → AGENTS.md
- `Settings update and audit atomic singleton lock` --semantically_similar_to--> `Transactional append-only sanitized audit`  [INFERRED] [semantically similar]
  docs/architecture.md → SPEC-foundation.md
- `Conecta Infusión: resumen de permisos (PDF snapshot)` --semantically_similar_to--> `Conecta Infusión: resumen de permisos`  [INFERRED] [semantically similar]
  docs/requirements/resumen-permisos.es.pdf → docs/requirements/resumen-permisos.es.md
- `submit()` --indirect_call--> `token()`  [INFERRED]
  packages/ui/src/components/password-recovery.tsx → apps/api/test/integration/identity-invitations.test.mjs

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Completed invitation creation, resend and deliberate password setup flow** — docs_identity_invitations_create, docs_identity_invitations_resend, docs_identity_invitations_setup, docs_identity_invitations_browser_safety [EXTRACTED 1.00]
- **Repeat-safe fictional demo data without invented family consent** — tasks_identity_verification_i23_demo, tasks_identity_verification_i24_seed, tasks_identity_verification_i25_checkpoint, tasks_identity_verification_i26_seed [EXTRACTED 1.00]
- **I24 consent, live binding and atomic family membership** — tasks_identity_verification_i24_acceptance, tasks_identity_verification_i24_consent, tasks_identity_verification_i24_lock_atomicity, tasks_identity_verification_i24_delivery_policy [EXTRACTED 1.00]
- **I26 explicit successor consent with live authority and preserved history** — tasks_identity_verification_i26_offers, tasks_identity_verification_i26_decisions, tasks_identity_verification_i26_live_binding, tasks_identity_verification_i26_invalidation, tasks_identity_verification_i26_responsibility_preservation [EXTRACTED 1.00]
- **Guarded operator-only development bootstrap** — docs_identity_bootstrap_development_testuser, docs_identity_bootstrap_local_target_guards, docs_identity_bootstrap_fixture_provenance, docs_identity_bootstrap_private_sql_output [EXTRACTED 1.00]
- **Shared customer and management authentication flow** — docs_identity_customer_login_customer_login, docs_identity_management_login_management_login, docs_identity_auth_transport_authenticated_transport, docs_identity_auth_transport_shared_host_cookie [EXTRACTED 1.00]

## Communities (129 total, 29 thin omitted)

### Community 0 - "Verification and Task Tracking"
Cohesion: 0.08
Nodes (27): ActionPurpose, Environment, invalid(), loopback(), origin(), readIdentityConfig(), secret(), text() (+19 more)

### Community 1 - "Module Boundaries and Dependencies"
Cohesion: 0.05
Nodes (28): cafe-sales, credits-bookings, Capability map: Conecta Infusion, financial-reporting, foundation, identity, instructor-payroll, payments (+20 more)

### Community 2 - "Foundation Specification"
Cohesion: 0.04
Nodes (48): Architecture, Audit mutation rejection triggers, Business timezone independent device timezone, Controlled browser tests use intercepted responses, Docker integration verifies real migrations and live browser screens, Express backend owns PostgreSQL business behavior, Flyway sole migration runner, Foundation excludes production authentication financial workflows full WCAG certification (+40 more)

### Community 3 - "Backend Configuration and Services"
Cohesion: 0.11
Nodes (27): createApplication(), createAccountInvitationService(), actor(), createAccountRouter(), createAuditRouter(), createAuditViewService(), createAuthRouter(), failure() (+19 more)

### Community 5 - "Verification and Task Tracking"
Cohesion: 0.10
Nodes (8): authConfig(), createAuthAccount(), password, harness(), token(), digest(), load(), harness()

### Community 6 - "Database Schema and Migrations"
Cohesion: 0.08
Nodes (32): audit_append_only, business_settings, business_units, identity_action_tokens, identity_action_tokens_account_idx, identity_action_tokens_expiry_idx, identity_action_tokens_person_idx, identity_action_tokens_recipient_idx (+24 more)

### Community 7 - "Backend Configuration and Services"
Cohesion: 0.13
Nodes (29): address(), object(), PendingAccount, personnel, ActionBinding, ActionError, actionSubjectHash(), cancelActionDelivery() (+21 more)

### Community 8 - "Verification and Task Tracking"
Cohesion: 0.09
Nodes (14): dev, load(), sharp, cleanDevelopmentDatabase(), createDemoPhotoFixture(), hiddenPassword(), finish(), keypress() (+6 more)

### Community 9 - "Management Web Application"
Cohesion: 0.06
Nodes (35): dependencies, @conecta/api-client, @conecta/contracts, @conecta/i18n, @conecta/ui, react, react-dom, devDependencies (+27 more)

### Community 10 - "Shared Interface Components"
Cohesion: 0.08
Nodes (23): api, CustomerAccess(), FoundationApp(), CustomerActionPage(), RegistrationAccess(), Root(), EmailChangedResponse, EmailConfirmedResponse (+15 more)

### Community 11 - "Languages and Display Formatting"
Cohesion: 0.12
Nodes (26): api, App(), actions, fields, Key, OperationalAudit(), Text, value() (+18 more)

### Community 12 - "Shared API Contracts"
Cohesion: 0.14
Nodes (24): createDevelopmentTestUser(), developmentDatabaseUrl(), generateFirstAdminSql(), literal(), text(), boundedWork(), hashDevelopmentFixturePassword(), hashPassword() (+16 more)

### Community 13 - "Shared Interface Components"
Cohesion: 0.13
Nodes (18): LoginResult, LoginInput, LoginResponse, PublicAccount, SessionResponse, AccountAccess(), mutate(), refresh() (+10 more)

### Community 14 - "Shared Interface Components"
Cohesion: 0.06
Nodes (30): dependencies, class-variance-authority, clsx, @conecta/contracts, lucide-react, @radix-ui/react-dialog, @radix-ui/react-slot, tailwind-merge (+22 more)

### Community 15 - "Identity Accounts and Permissions"
Cohesion: 0.08
Nodes (28): Management-only bounded UUID-cursor account listing, Account listing and personal profile edits, Authorized canonical person name phone and locale edits, Locked session account person role authorization and atomic audit, Bilingual accessible management account and role screens, Management account screens, Pending mutation blocks dismissal and competing saves; uncertain outcomes require refresh, Actual role changes revoke target sessions and remount self session controls (+20 more)

### Community 16 - "Shared Interface Components"
Cohesion: 0.22
Nodes (15): api, AccessLost, Key, roles, Text, InvitationKey, DialogContent, DialogDescription (+7 more)

### Community 17 - "Shared Interface Components"
Cohesion: 0.12
Nodes (19): api, identityRoles, AccountListQuery, AccountListResponse, ApiErrorCode, BusinessUnitCode, CsrfResponse, EmailChangeInput (+11 more)

### Community 18 - "Verification and Task Tracking"
Cohesion: 0.13
Nodes (5): isolatedDatabase(), migrate(), load(), secrets, compose

### Community 19 - "Shared API Contracts"
Cohesion: 0.13
Nodes (24): appendIdentityAudit(), boundedString(), fail(), familyFields, IdentityAudit, identityAuditActions, readIdentityAuditSnapshot(), roles (+16 more)

### Community 20 - "Shared Interface Components"
Cohesion: 0.13
Nodes (15): accessFailure(), AccountAdministration(), AccountEditor(), save(), AdministrationApi, errorKey(), AccountProfile, AccountProfileInput (+7 more)

### Community 21 - "Backend Configuration and Services"
Cohesion: 0.16
Nodes (22): AcceptedFamilyInvitation, actor(), checkSession(), closeFamilyInTransaction(), createFamilyInTransaction(), endFamilyMembershipInTransaction(), FamilyChange, FamilyContext (+14 more)

### Community 22 - "Shared API Contracts"
Cohesion: 0.13
Nodes (7): load(), harness(), load(), valid, profile, event, family

### Community 23 - "Shared Interface Components"
Cohesion: 0.16
Nodes (14): familyId(), FamilyCreateInput, FamilyInvitationActionInput, FamilyInvitationPreview, FamilyView, FamilyApi, familyError(), FamilyPanel() (+6 more)

### Community 24 - "Verification and Task Tracking"
Cohesion: 0.12
Nodes (9): load(), config(), harness(), post(), env, dependencies, key(), secrets() (+1 more)

### Community 25 - "Backend Configuration and Services"
Cohesion: 0.13
Nodes (15): createAccountService(), authorize(), profile(), LegacyInstructor, LegacyMember, object(), profileInput(), roles (+7 more)

### Community 26 - "Shared API Contracts"
Cohesion: 0.20
Nodes (17): ApiError, createApiClient(), accountMutation(), anonymousAction(), csrfToken(), familyMutation(), familyPreview(), familyRead() (+9 more)

### Community 27 - "Verification and Task Tracking"
Cohesion: 0.15
Nodes (5): fixture(), actorContext(), token(), transaction(), seedDevelopmentFamilies()

### Community 28 - "scripts"
Cohesion: 0.11
Nodes (19): scripts, build, db:clean:demo, db:flyway:migrate, db:info, db:migrate, db:migrate:demo, db:seed:demo (+11 more)

### Community 29 - "Languages and Display Formatting"
Cohesion: 0.11
Nodes (17): dependencies, @conecta/contracts, exports, ./format, @conecta/contracts, react, react-dom, name (+9 more)

### Community 30 - "Verification and Task Tracking"
Cohesion: 0.16
Nodes (7): administrationStates, customers, demoPassword, id(), personnel, profileScenarios, seedDevelopmentDemo()

### Community 31 - "Shared Interface Components"
Cohesion: 0.12
Nodes (14): name, private, type, version, @types/node, @conecta/contracts, argon2, cors (+6 more)

### Community 32 - "Backend Configuration and Services"
Cohesion: 0.18
Nodes (10): IdentitySecrets, LoginThrottleError, reserveLoginAttempt(), associatedData(), decryptOutboxPayload(), EncryptedOutboxPayload, encryptOutboxPayload(), invalid() (+2 more)

### Community 33 - "Customer Web Application"
Cohesion: 0.12
Nodes (16): aliases, components, hooks, lib, ui, utils, iconLibrary, rsc (+8 more)

### Community 34 - "Management Web Application"
Cohesion: 0.12
Nodes (16): aliases, components, hooks, lib, ui, utils, iconLibrary, rsc (+8 more)

### Community 35 - "Shared Interface Components"
Cohesion: 0.12
Nodes (16): aliases, components, hooks, lib, ui, utils, iconLibrary, rsc (+8 more)

### Community 36 - "Customer Web Application"
Cohesion: 0.12
Nodes (15): @conecta/api-client, @conecta/contracts, @conecta/i18n, @conecta/ui, react, react-dom, @tailwindcss/vite, @types/react (+7 more)

### Community 37 - "Customer Web Application"
Cohesion: 0.13
Nodes (14): compilerOptions, allowImportingTsExtensions, esModuleInterop, jsx, lib, module, moduleResolution, noEmit (+6 more)

### Community 38 - "Database Schema and Migrations"
Cohesion: 0.24
Nodes (7): enforce_family_invitation_token(), family_invitation_history, family_invitation_no_truncate, family_invitation_token_binding, family_invitations, family_one_pending_invitation_idx, identity_family_invitation_valid()

### Community 39 - "Database Schema and Migrations"
Cohesion: 0.24
Nodes (7): enforce_family_successor_token(), family_one_pending_successor_idx, family_successor_history, family_successor_no_truncate, family_successor_offers, family_successor_token_binding, identity_family_successor_valid()

### Community 40 - "Bilingual Business Rules"
Cohesion: 0.13
Nodes (15): 10. Café, 11. Details to resolve during specification, 1. Studio, language, and settings, 2. Financial separation and payment collection, 3. Packages, credit value, expiration, and selection, 4. Booking, cancellation, and capacity, 5. Family sharing and leaving a family, 6. Manual adjustments and audit history (+7 more)

### Community 41 - "Bilingual Business Rules"
Cohesion: 0.13
Nodes (14): 10. Cafetería, 11. Detalles por resolver durante la especificación, 1. Estudio, idioma y configuración, 2. Separación financiera y cobro, 3. Paquetes, valor de los créditos, vencimiento y selección, 4. Reservas, cancelaciones y cupo, 5. Créditos compartidos y salida del grupo familiar, 6. Ajustes manuales e historial de auditoría (+6 more)

### Community 42 - "Shared Interface Components"
Cohesion: 0.13
Nodes (14): compilerOptions, allowImportingTsExtensions, esModuleInterop, jsx, lib, module, moduleResolution, noEmit (+6 more)

### Community 43 - "Identity Accounts and Permissions"
Cohesion: 0.13
Nodes (13): Acceptance scenarios, Boundaries and decisions still needed, Commands and structure, Confirmed account permissions, Deletion and family boundaries, Spec: Identity and access, Email sign-in, first-admin bootstrap and development accounts, Invitation acceptance required before family membership and sharing (+5 more)

### Community 44 - "Verification and Task Tracking"
Cohesion: 0.15
Nodes (10): Identity verification: completed I19-I26 implementation and historical earlier evidence, Automatic changed-source Graphify refresh every 3 completed steps starting I24; counter/snapshot in tasks/graphify-refresh.md, I22 administrator/manager operational history: bounded microsecond/UUID cursor, allowlisted snapshots and private responses, I22-I23 final 55 unit/client, 81 controlled, 87 backend and separate final 26 live Chromium tests passed, I23 seed adds 2 synthetic families/3 memberships; preserves manual names/departures and full reset compatibility, I23 additive V6: immutable creator/acceptance provenance, historical memberships, version locking and deferred responsibility constraints, I24 checkpoint approved by request to proceed I25; existing fixtures sufficient; second cadence step, I26 completes I24-I26 three-step refresh interval; changed-source extraction preserves unchanged fragments; I27 next (+2 more)

### Community 45 - "Verification and Task Tracking"
Cohesion: 0.18
Nodes (5): load(), fixture(), account(), token(), input

### Community 46 - "Management Web Application"
Cohesion: 0.14
Nodes (13): compilerOptions, esModuleInterop, jsx, lib, module, moduleResolution, noEmit, paths (+5 more)

### Community 47 - "Languages and Display Formatting"
Cohesion: 0.14
Nodes (13): compilerOptions, allowImportingTsExtensions, esModuleInterop, jsx, lib, module, moduleResolution, noEmit (+5 more)

### Community 48 - "Verification and Task Tracking"
Cohesion: 0.20
Nodes (4): admin, valid, assertLegacySchemaMatches(), schemaSnapshot()

### Community 49 - "Shared API Contracts"
Cohesion: 0.21
Nodes (9): app, pool, getStudioOverview(), port, server, stopPhotoCleanup, CafeProduct, YogaClass (+1 more)

### Community 50 - "Backend Configuration and Services"
Cohesion: 0.17
Nodes (11): compilerOptions, esModuleInterop, module, moduleResolution, noUncheckedIndexedAccess, outDir, rootDir, skipLibCheck (+3 more)

### Community 51 - "Database Schema and Migrations"
Cohesion: 0.32
Nodes (11): bookings, bookings_class_session_idx, class_sessions, class_sessions_starts_at_idx, instructors, members, members_email_unique, products (+3 more)

### Community 52 - "Database Schema and Migrations"
Cohesion: 0.32
Nodes (11): bookings, bookings_class_session_idx, class_sessions, class_sessions_starts_at_idx, instructors, members, members_email_unique, products (+3 more)

### Community 53 - "I07 authenticated transport"
Cohesion: 0.26
Nodes (8): I07 authenticated transport, Credentialed createApiClient authentication methods, Shared host-only HttpOnly frontend session cookie, I08 bilingual customer sign-in and account controls, Shared accessible SignInForm, Shared AccountAccess controls, GET management/access: current server administrator/manager capability, I09 management sign-in and access

### Community 54 - "Shared API Contracts"
Cohesion: 0.17
Nodes (11): dependencies, @conecta/contracts, exports, @conecta/contracts, name, private, scripts, test (+3 more)

### Community 55 - "Shared Interface Components"
Cohesion: 0.24
Nodes (8): ActionAcceptedResponse, CustomerInvitationInput, FamilyInvitationInput, CustomerInvitations(), changeOpen(), clear(), submit(), InvitationApi

### Community 56 - "Backend Configuration and Services"
Cohesion: 0.40
Nodes (8): appendSettingsAudit(), SettingsAudit, TrustedActor, readPublicSettings(), updateSettings(), updateSettingsInTransaction(), Settings, validateSettings()

### Community 57 - "Backend Configuration and Services"
Cohesion: 0.22
Nodes (5): createRegistrationService(), email(), object(), PendingAccount, RegistrationError

### Community 58 - "Identity Implementation Plan"
Cohesion: 0.20
Nodes (8): I33: Independent account transition, I34: Family/dependent review, I35: Lifecycle composition guard, I36: Account deactivation, I37: Reactivation, I38: Lifecycle UI, I39: Verification runner and regression, I40: Documentation and handoff

### Community 59 - "Backend Configuration and Services"
Cohesion: 0.20
Nodes (10): dependencies, argon2, @conecta/contracts, cors, dotenv, express, helmet, nodemailer (+2 more)

### Community 61 - "Shared API Contracts"
Cohesion: 0.20
Nodes (9): compilerOptions, lib, module, moduleResolution, noEmit, skipLibCheck, strict, target (+1 more)

### Community 62 - "Shared Interface Components"
Cohesion: 0.36
Nodes (7): Alert, AlertDescription, AlertTitle, alertVariants, FieldError(), cn(), class-variance-authority

### Community 63 - "Verification and Task Tracking"
Cohesion: 0.20
Nodes (4): @axe-core/playwright, account, family, profile

### Community 64 - "Verification and Task Tracking"
Cohesion: 0.22
Nodes (6): Seven-day single-use token; intended signed-in customer; recipient account/person/version and live sender/family eligibility, Invitation ID/version audits omit raw emails/tokens; strict typed event allowlist and bilingual labels extended, I24 private family create/current/read/invite/preview/accept backend completed October 4, 60-second/five-per-hour resend; replacement atomic; throttled replacement preserves old valid token, I24 56 unit/client, 97 full-run backend plus separate upgrade=98 distinct, 26 live Chromium; V1-V8 migration/checksums, V8 adds provenance/version-token binding/live domain validation/accepted history; V6/V7 historical synthetic consent preserved

### Community 65 - "Verification and Task Tracking"
Cohesion: 0.22
Nodes (7): Ordered account/person then roles/session/family/offer/token locks; recipient membership/account/email/version, issuer/family version binding, Bilingual SMTP successor journeys prove acceptance/decline/replay, authority transfer, unchanged creator/membership and 4 audit events, Current responsible member or management offers to eligible independent member; opaque recipient/limit replies; replacement revokes/scrubs old delivery, Acceptance changes responsibility/family version only; creator/membership/credits/bookings/guardianship remain preserved, 3-test guarded demo regression preserves transferred responsibility/manual edits/departures/reset; no offers seeded; local V9 reseed adds zero accounts, I26 7 focused PostgreSQL, 12 successor controlled, 60 unit/client/i18n, 105 total controlled, 105 backend, 28 live passed; V1-V9, V9 preserves V8 history; immutable successor-offer provenance; one pending offer/group; deferred token binding

### Community 66 - "/graphify"
Cohesion: 0.22
Nodes (9): /graphify, AST structural extraction, Community detection, Existing graph query fast path, Gemini optional host extraction fallback, Graph confidence audit trail, Interactive HTML GraphRAG JSON graph report, Parallel semantic extraction (+1 more)

### Community 67 - "Identity Implementation Plan"
Cohesion: 0.22
Nodes (8): I25: Family UI, I26: Successor responsibility, I27: Membership lifecycle contracts, I28: Dependent persistence, I29: Dependent profile backend, I30: Dependent UI, I31: Guardian consent, I32: Guardian removal

### Community 68 - "POST /api/v1/accounts/invitations creates pending passwordless"
Cohesion: 0.22
Nodes (5): Administrator, manager, reception, cafe_staff and instructor may invite; customer-only actors cannot, POST /api/v1/accounts/invitations creates pending passwordless customer-only accounts; generic ACCEPTED, I15 invitation backend and I16 bilingual management/setup screens implemented, POST /api/v1/auth/setup accepts token/password; single-use activation, Argon2id, session revocation and no automatic login, Create/resend share registration-IP 30/15min; setup shares confirmation/reset action-IP 30/15min; direct socket IP only

### Community 69 - "graphify reference: query, path, explain"
Cohesion: 0.25
Nodes (8): BFS broad neighbor context, DFS dependency path, Explain node, Graph-only evidence answers, graphify reference: query, path, explain, Persist query results, Shortest path, Vocabulary-constrained query expansion

### Community 70 - "graphify reference: incremental update and"
Cohesion: 0.25
Nodes (8): Cluster-only self-contained regeneration, Code-only semantic bypass, Deleted sources prune, graphify reference: incremental update and cluster-only, Incremental changed-file extraction, Manifest stamps only successful semantic outputs, Preserve directed graph semantics, Re-extracted sources replace

### Community 71 - "Shared Interface Components"
Cohesion: 0.43
Nodes (7): createPhotoService(), file(), reconcile(), clean(), removeUnreferenced(), storage(), save()

### Community 73 - "Identity login backend: I06 checkpoint"
Cohesion: 0.32
Nodes (5): Identity login backend: I06 checkpoint, Login abuse controls, Review and next step, Router factory contract, Session service

### Community 74 - "package.json"
Cohesion: 0.25
Nodes (7): engines, node, name, private, workspaces, concurrently, typescript

### Community 75 - "Commit and push"
Cohesion: 0.29
Nodes (7): Commit and push, Explicit reviewed staging, No force push no reset no hook bypass, Preserve unrelated work and staging, Scoped authorization commit and push, Validate relevant checks, Verify remote hash after push

### Community 76 - "graphify reference: extra exports and"
Cohesion: 0.29
Nodes (7): FalkorDB export, graphify reference: extra exports and benchmark, Graphify stdio MCP, Neo4j Cypher MERGE export, SVG GraphML exports, Token reduction benchmark, Wiki export

### Community 77 - "graphify reference: extraction subagent prompt"
Cohesion: 0.29
Nodes (7): Deterministic full relative path node identifiers, Extracted inferred ambiguous confidence provenance, graphify reference: extraction subagent prompt (compact), Hyperedges maximum three, Rationale node attributes, Semantic similarity inference, Verbatim absolute source file paths

### Community 78 - "Customer Web Application"
Cohesion: 0.29
Nodes (7): dependencies, @conecta/api-client, @conecta/contracts, @conecta/i18n, @conecta/ui, react, react-dom

### Community 79 - "Customer Web Application"
Cohesion: 0.29
Nodes (7): devDependencies, @tailwindcss/vite, @types/node, @types/react, @types/react-dom, vite, @vitejs/plugin-react

### Community 80 - "Database Schema and Migrations"
Cohesion: 0.52
Nodes (6): account_roles, account_roles_assigned_by_idx, account_roles_role_idx, accounts, accounts_exemption_actor_idx, people

### Community 81 - "Identity Implementation Plan"
Cohesion: 0.29
Nodes (7): I13: Recovery backend, I14: Recovery UI, I15: Customer invitations backend, I16: Invitation UI, I17: Account administration backend, I18: Role administration, I19: Administration UI

### Community 82 - "Verification and Task Tracking"
Cohesion: 0.29
Nodes (4): I20 adds booking-free customer.profile demo account; 26 accounts/21 members; preserves changed email/profile, I20 both-port own-profile editor and transactional email change with prior-address notification, Email confirmation atomically verifies provenance, revokes sessions, audits and queues prior-address notification, I20 passed 5 focused PostgreSQL, 47 unit, 75 controlled plus later mobile check, 78 backend and separate final 21 live tests

### Community 83 - "Verification and Task Tracking"
Cohesion: 0.29
Nodes (5): Post-commit old-asset cleanup; ownership-aware uncertain-write cleanup; EPERM/EBUSY retry; streaming orphan reconciliation, Exclusive fictional demo-profile.png; preserves files/manual edits; production/remote seed guards; no extra accounts, Photo JSON parser 7 MiB; bytes <=5 MiB/16M pixels; JPEG/PNG/WebP; no animation/APNG; static oriented WebP <=512x512, I21 private own/cross-management photo upload/preview with current profile-edit authorization, I21 passed 53 unit, 77 controlled, 80 backend and 24 live Chromium tests; V1-V5 migrations

### Community 84 - "Backend Configuration and Services"
Cohesion: 0.33
Nodes (6): devDependencies, tsx, @types/cors, @types/express, @types/node, @types/pg

### Community 85 - "Backend Configuration and Services"
Cohesion: 0.33
Nodes (6): scripts, build, dev, start, test, typecheck

### Community 86 - "Identity Implementation Plan"
Cohesion: 0.33
Nodes (6): I01: Resolve technical choices, I02: Account persistence, I03: Identity audit, I04: Password and bootstrap, I05: Session and delivery persistence, I06: Login backend

### Community 87 - "Customer Web Application"
Cohesion: 0.40
Nodes (5): scripts, build, dev, preview, typecheck

### Community 89 - "Operational audit history"
Cohesion: 0.40
Nodes (4): GET /api/v1/audit management-only private operational history, Operational audit history, Allowlisted snapshots exclude secrets raw payloads free-text reasons and correlation IDs, Descending microsecond timestamp and UUID cursor pagination

### Community 90 - "Conecta Infusion: confirmed product intent"
Cohesion: 0.40
Nodes (3): Conecta Infusion Yoga on Instagram, GitHub issue #1, Conecta Infusion: confirmed product intent

### Community 91 - "Conecta Infusión: resumen de permisos"
Cohesion: 0.40
Nodes (3): Conecta Infusión: resumen de permisos, especificación de identidad — ../../SPEC-identity.md, Conecta Infusión: resumen de permisos (PDF snapshot)

### Community 92 - "devDependencies"
Cohesion: 0.40
Nodes (5): devDependencies, @axe-core/playwright, concurrently, @playwright/test, typescript

### Community 93 - "Shared API Contracts"
Cohesion: 0.40
Nodes (4): name, private, types, version

### Community 94 - "Identity Implementation Plan"
Cohesion: 0.40
Nodes (5): I08: Customer login slice, I09: Management login slice, I10: Single-use action delivery, I11: Customer registration backend, I12: Registration UI

### Community 95 - "Identity Implementation Plan"
Cohesion: 0.40
Nodes (5): I20: Self profile and email change, I21: Profile photos, I22: Operational audit views, I23: Family persistence, I24: Family invitation backend

### Community 96 - "Verification and Task Tracking"
Cohesion: 0.40
Nodes (3): I19 bilingual management listing/filter/profile/role UI with sanitized typed responses, I19 guarded demo seed: 25 accounts, 20 customers, 2 instructors, 3 sessions, 23 bookings; preserves manual edits, I19 passed 45 unit, 71 controlled and final separate 19 real Chromium tests

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

### Community 106 - "POST /api/v1/auth/recovery email -> generic"
Cohesion: 0.67
Nodes (3): I13 recovery backend and I14 shared bilingual recovery/reset screens implemented, POST /api/v1/auth/recovery email -> generic 202 ACCEPTED; reset token/password -> PASSWORD_RESET, One-hour single-use version-bound reset; active eligible identities only; atomic password update/all-session revocation/audit; no activation/login

## Ambiguous Edges - Review These
- `Conecta Infusión: resumen de permisos` → `Identity specification pending in PDF; approved in Markdown`  [AMBIGUOUS]
  docs/requirements/resumen-permisos.es.pdf · relation: conceptually_related_to
- `Incremental Graphify cadence` → `I40: Documentation and handoff`  [AMBIGUOUS]
  tasks/identity-todo.md · relation: conceptually_related_to

## Knowledge Gaps
- **576 isolated node(s):** `LegacyInstructor`, `LegacyMember`, `Environment`, `PendingAccount`, `Account` (+571 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 796 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **29 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `Conecta Infusión: resumen de permisos` and `Identity specification pending in PDF; approved in Markdown`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **What is the exact relationship between `Incremental Graphify cadence` and `I40: Documentation and handoff`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **Why does `pg` connect `Verification and Task Tracking` to `Backend Configuration and Services`, `Backend Configuration and Services`, `Backend Configuration and Services`, `Verification and Task Tracking`, `Shared API Contracts`, `Verification and Task Tracking`, `Shared API Contracts`, `Verification and Task Tracking`, `Shared API Contracts`, `Backend Configuration and Services`, `Verification and Task Tracking`, `Backend Configuration and Services`, `Backend Configuration and Services`, `Backend Configuration and Services`, `Verification and Task Tracking`, `Shared Interface Components`?**
  _High betweenness centrality (0.059) - this node is a cross-community bridge._
- **Why does `@playwright/test` connect `Verification and Task Tracking` to `Verification and Task Tracking`, `package.json`, `Verification and Task Tracking`, `Verification and Task Tracking`, `Verification and Task Tracking`, `Shared API Contracts`, `Verification and Task Tracking`, `Verification and Task Tracking`, `Verification and Task Tracking`?**
  _High betweenness centrality (0.026) - this node is a cross-community bridge._
- **Why does `@conecta/contracts` connect `Shared Interface Components` to `Shared Interface Components`?**
  _High betweenness centrality (0.020) - this node is a cross-community bridge._
- **What connects `LegacyInstructor`, `LegacyMember`, `Environment` to the rest of the system?**
  _576 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Verification and Task Tracking` be split into smaller, more focused modules?**
  _Cohesion score 0.0841799709724238 - nodes in this community are weakly interconnected._
## Incremental Update

Re-extracted only 43 changed source files; unchanged source fragments retained. Approved Identity plan is distinct from implemented code. No PDF regenerated.

## Integrity Limitations

Original extraction reported 16 dangling endpoints and 11 undirected edge collapses. This merged-graph check cannot restore missing information from the original extraction; verify findings against source files.

Fresh changed-file diagnostics: 215 dangling endpoints and 46 undirected edge collapses. The merged graph has 0 missing endpoints; synthesized endpoints do not prove implementations exist. Self-references include V3 accounts and AST name-resolution artifacts; verify call relationships against source. See `graph-health.json`.
