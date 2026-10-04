# Graph Report - ConectaInfusionApp  (2026-10-04)

## Corpus Check
- 183 files · ~108,320 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 7 file(s) not represented in the graph (top: (none) 3, .example 2, .toml 1)

## Summary
- 1296 nodes · 2319 edges · 86 communities (66 shown, 20 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 51 edges (avg confidence: 0.89)
- Token cost: unavailable (host-agent extraction usage is not exposed; placeholder counters do not mean zero cost).

## Community Hubs (Navigation)
- Shared API Contracts
- Bilingual Business Rules
- Foundation Specification
- Verification and Task Tracking
- Shared Interface Components
- Identity Implementation Plan
- Shared API Contracts
- Management Web Application
- Customer Web Application
- Bilingual Business Rules
- Verification and Task Tracking
- Verification and Task Tracking
- Shared Interface Components
- Shared Interface Components
- Backend Configuration and Services
- Shared Interface Components
- scripts
- Verification and Task Tracking
- Shared Interface Components
- Verification and Task Tracking
- Database Schema and Migrations
- Languages and Display Formatting
- Shared API Contracts
- Customer Web Application
- Management Web Application
- Identity Implementation Plan
- Shared Interface Components
- Identity Implementation Plan
- Verification and Task Tracking
- Backend Configuration and Services
- Verification and Task Tracking
- Customer Web Application
- Languages and Display Formatting
- Shared Interface Components
- Identity Implementation Plan
- Management Web Application
- Languages and Display Formatting
- Verification and Task Tracking
- Identity Accounts and Permissions
- Backend Configuration and Services
- Backend Configuration and Services
- Backend Configuration and Services
- Database Schema and Migrations
- Database Schema and Migrations
- I07 authenticated transport
- Shared API Contracts
- Backend Configuration and Services
- Verification and Task Tracking
- Manual Identity bootstrap
- Shared API Contracts
- /graphify
- Backend Configuration and Services
- Shared Interface Components
- graphify reference: query, path, explain
- graphify reference: incremental update and
- Identity login backend: I06 checkpoint
- Commit and push
- graphify reference: extra exports and
- graphify reference: extraction subagent prompt
- Database Schema and Migrations
- Single-use actions and email delivery
- Database Schema and Migrations
- Shared API Contracts
- graphify reference: add a URL
- graphify reference: GitHub clone and
- graphify reference: commit hook and
- graphify reference: transcribe video and
- Identity implementation decisions
- I05 persistence and local email
- MCP connections for Codex
- Verification and Task Tracking
- POST /api/v1/auth/recovery email -> generic
- commitAndPush.prompt.md
- Customer Web Application
- Customer Web Application
- Management Web Application
- Identity Implementation Plan
- Verification and Task Tracking
- Shared Interface Components
- Isolated integration suite uses real

## God Nodes (most connected - your core abstractions)
1. `pg` - 29 edges
2. `Spec: Foundation` - 27 edges
3. `Conecta Infusion: reglas de negocio acordadas` - 26 edges
4. `Conecta Infusion: agreed business rules` - 24 edges
5. `AuthError` - 22 edges
6. `Implementation plan: Identity and access` - 21 edges
7. `Spec: Identity and access` - 20 edges
8. `Architecture` - 19 edges
9. `cn()` - 18 edges
10. `isolatedDatabase()` - 18 edges

## Surprising Connections (you probably didn't know these)
- `Conecta Infusion: reglas de negocio acordadas (PDF snapshot)` --semantically_similar_to--> `Conecta Infusion: reglas de negocio acordadas`  [INFERRED] [semantically similar]
  docs/requirements/agreed-business-rules.es.pdf → docs/requirements/agreed-business-rules.es.md
- `Conecta Infusión: resumen de permisos (PDF snapshot)` --semantically_similar_to--> `Conecta Infusión: resumen de permisos`  [INFERRED] [semantically similar]
  docs/requirements/resumen-permisos.es.pdf → docs/requirements/resumen-permisos.es.md
- `Settings update and audit atomic singleton lock` --semantically_similar_to--> `Transactional append-only sanitized audit`  [INFERRED] [semantically similar]
  docs/architecture.md → SPEC-foundation.md
- `No production provider/scheduler; HTTPS/proxy and abuse monitoring remain launch work; delivery and uniform timing are not guaranteed` --semantically_similar_to--> `Identity remains opt-in; production authentication hosting and mail scheduling are unconfigured`  [INFERRED] [semantically similar]
  docs/identity-recovery.md → README.md
- `signIn()` --indirect_call--> `email()`  [INFERRED]
  tests/integration/identity-recovery.spec.ts → apps/api/src/modules/identity/registration.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Completed invitation creation, resend and deliberate password setup flow** — docs_identity_invitations_create, docs_identity_invitations_resend, docs_identity_invitations_setup, docs_identity_invitations_browser_safety [EXTRACTED 1.00]
- **Transactional role mutation safeguards and domain coordination boundary** — docs_identity_roles_atomic_mutation, docs_identity_roles_last_active_administration, docs_identity_roles_lock_discipline, docs_identity_roles_coordinator_hook, docs_identity_roles_conservative_guard [EXTRACTED 1.00]
- **Completed I15-I18 evidence with pending I18 human checkpoint** — tasks_identity_verification_i15, tasks_identity_verification_i16, tasks_identity_verification_i17, tasks_identity_verification_i18, tasks_identity_todo_i18_checkpoint [EXTRACTED 1.00]
- **Guarded operator-only development bootstrap** — docs_identity_bootstrap_development_testuser, docs_identity_bootstrap_local_target_guards, docs_identity_bootstrap_fixture_provenance, docs_identity_bootstrap_private_sql_output [EXTRACTED 1.00]
- **Required credit-to-instructor-pay traceability** — docs_requirements_agreed_business_rules_credit_value, docs_requirements_agreed_business_rules_earnings, docs_requirements_agreed_business_rules_payroll, docs_requirements_agreed_business_rules_audit [EXTRACTED 1.00]
- **Shared customer and management authentication flow** — docs_identity_customer_login_customer_login, docs_identity_management_login_management_login, docs_identity_auth_transport_authenticated_transport, docs_identity_auth_transport_shared_host_cookie [EXTRACTED 1.00]
- **Planned atomic lifecycle integration; not completed implementation** — tasks_identity_plan_composition_layer_lifecycle_coordinator, capability_map_identity, capability_map_credits_bookings, capability_map_studio_catalog, capability_map_instructor_payroll [EXTRACTED 1.00]

## Communities (86 total, 20 thin omitted)

### Community 0 - "Shared API Contracts"
Cohesion: 0.05
Nodes (51): app, createApplication(), pool, address(), createAccountInvitationService(), actor(), object(), createAccountRouter() (+43 more)

### Community 1 - "Bilingual Business Rules"
Cohesion: 0.06
Nodes (11): Conecta Infusion Yoga on Instagram, GitHub issue #1, Conecta Infusion: confirmed product intent, issue #1, Conecta Infusion: agreed business rules, incidencia #1, Conecta Infusion: reglas de negocio acordadas, Conecta Infusion: reglas de negocio acordadas (PDF snapshot) (+3 more)

### Community 2 - "Foundation Specification"
Cohesion: 0.04
Nodes (48): Architecture, Audit mutation rejection triggers, Business timezone independent device timezone, Controlled browser tests use intercepted responses, Docker integration verifies real migrations and live browser screens, Express backend owns PostgreSQL business behavior, Flyway sole migration runner, Foundation excludes production authentication financial workflows full WCAG certification (+40 more)

### Community 3 - "Verification and Task Tracking"
Cohesion: 0.05
Nodes (36): dependencies, argon2, @conecta/contracts, cors, dotenv, express, helmet, nodemailer (+28 more)

### Community 4 - "Shared Interface Components"
Cohesion: 0.17
Nodes (23): api, AccountAccess(), mutate(), refresh(), visible(), AccountLabels, errorCode(), Button (+15 more)

### Community 5 - "Identity Implementation Plan"
Cohesion: 0.05
Nodes (25): I17 account administration endpoints implemented; management screens deferred to I19, GET /api/v1/accounts: management-only listing with limit, cursor, role and status, POST /api/v1/accounts/:id/profile: fullName, phone and preferredLocale only, Name <=120 UTF-16 units; nullable phone <=40; no controls; locale es-MX/en; extra fields rejected, AccountProfileInput, AccountProfile and AccountListResponse omit credentials, sessions, tokens and exemption/audit payloads, Administrator, manager, reception, cafe_staff and instructor may invite; customer-only actors cannot, POST /api/v1/accounts/invitations creates pending passwordless customer-only accounts; generic ACCEPTED, I15 invitation backend and I16 bilingual management/setup screens implemented (+17 more)

### Community 6 - "Shared API Contracts"
Cohesion: 0.13
Nodes (22): createDevelopmentTestUser(), developmentDatabaseUrl(), generateFirstAdminSql(), literal(), text(), boundedWork(), hashDevelopmentFixturePassword(), hashPassword() (+14 more)

### Community 7 - "Management Web Application"
Cohesion: 0.06
Nodes (35): dependencies, @conecta/api-client, @conecta/contracts, @conecta/i18n, @conecta/ui, react, react-dom, devDependencies (+27 more)

### Community 8 - "Customer Web Application"
Cohesion: 0.06
Nodes (34): dependencies, @conecta/api-client, @conecta/contracts, @conecta/i18n, @conecta/ui, react, react-dom, devDependencies (+26 more)

### Community 9 - "Bilingual Business Rules"
Cohesion: 0.07
Nodes (17): Database migration transition, Visual direction: Conecta Infusion, ﻿# Foundation verification, baseline, Flyway Docker, Playwright web servers, shadcn/ui monorepos, Tailwind v4 (+9 more)

### Community 10 - "Verification and Task Tracking"
Cohesion: 0.11
Nodes (6): authConfig(), createAuthAccount(), password, harness(), token(), harness()

### Community 11 - "Verification and Task Tracking"
Cohesion: 0.08
Nodes (14): dev, admin, valid, assertLegacySchemaMatches(), schemaSnapshot(), hiddenPassword(), finish(), keypress() (+6 more)

### Community 12 - "Shared Interface Components"
Cohesion: 0.06
Nodes (31): dependencies, class-variance-authority, clsx, @conecta/contracts, lucide-react, @radix-ui/react-dialog, @radix-ui/react-slot, tailwind-merge (+23 more)

### Community 13 - "Shared Interface Components"
Cohesion: 0.12
Nodes (20): ApiError, createApiClient(), anonymousAction(), csrfToken(), invitation(), send(), AccountProfile, ApiErrorCode (+12 more)

### Community 14 - "Backend Configuration and Services"
Cohesion: 0.16
Nodes (17): PendingAccount, personnel, ActionBinding, ActionError, cancelActionDelivery(), consumeAction(), invalid(), issueAction() (+9 more)

### Community 15 - "Shared Interface Components"
Cohesion: 0.12
Nodes (19): App(), api, Root(), EmailConfirmedResponse, ActionApi, ActionKey, IdentityActionPage(), changed() (+11 more)

### Community 16 - "scripts"
Cohesion: 0.07
Nodes (26): devDependencies, @axe-core/playwright, concurrently, @playwright/test, typescript, engines, node, name (+18 more)

### Community 17 - "Verification and Task Tracking"
Cohesion: 0.11
Nodes (5): load(), env, dependencies, compose, runDeliveryCommand()

### Community 18 - "Shared Interface Components"
Cohesion: 0.13
Nodes (17): api, CustomerAccess(), api, FoundationApp(), CustomerActionPage(), RegistrationAccess(), api, ManagementAccessResponse (+9 more)

### Community 19 - "Verification and Task Tracking"
Cohesion: 0.17
Nodes (5): load(), isolatedDatabase(), migrate(), load(), secrets

### Community 20 - "Database Schema and Migrations"
Cohesion: 0.20
Nodes (15): identity_action_tokens, identity_action_tokens_account_idx, identity_action_tokens_expiry_idx, identity_action_tokens_person_idx, identity_action_tokens_recipient_idx, identity_action_tokens_target_idx, identity_email_outbox, identity_email_outbox_action_idx (+7 more)

### Community 21 - "Languages and Display Formatting"
Cohesion: 0.11
Nodes (17): dependencies, @conecta/contracts, exports, ./format, @conecta/contracts, react, react-dom, name (+9 more)

### Community 22 - "Shared API Contracts"
Cohesion: 0.18
Nodes (4): load(), key(), secrets(), valid

### Community 23 - "Customer Web Application"
Cohesion: 0.12
Nodes (16): aliases, components, hooks, lib, ui, utils, iconLibrary, rsc (+8 more)

### Community 24 - "Management Web Application"
Cohesion: 0.12
Nodes (16): aliases, components, hooks, lib, ui, utils, iconLibrary, rsc (+8 more)

### Community 25 - "Identity Implementation Plan"
Cohesion: 0.24
Nodes (9): cafe-sales, credits-bookings, Capability map: Conecta Infusion, financial-reporting, identity, instructor-payroll, payments, public-home (+1 more)

### Community 26 - "Shared Interface Components"
Cohesion: 0.12
Nodes (16): aliases, components, hooks, lib, ui, utils, iconLibrary, rsc (+8 more)

### Community 28 - "Verification and Task Tracking"
Cohesion: 0.22
Nodes (14): ActionPurpose, actionSubjectHash(), createEmailOutboxWorker(), finish(), now(), prepare(), runBatch(), DeliveryCode (+6 more)

### Community 29 - "Backend Configuration and Services"
Cohesion: 0.23
Nodes (11): sessionCookieName, Environment, IdentityConfig, invalid(), loopback(), origin(), readIdentityConfig(), secret() (+3 more)

### Community 30 - "Verification and Task Tracking"
Cohesion: 0.17
Nodes (6): @axe-core/playwright, @playwright/test, overview, settings, fill(), fill()

### Community 31 - "Customer Web Application"
Cohesion: 0.13
Nodes (14): compilerOptions, allowImportingTsExtensions, esModuleInterop, jsx, lib, module, moduleResolution, noEmit (+6 more)

### Community 32 - "Languages and Display Formatting"
Cohesion: 0.29
Nodes (11): Locale, formatBusinessTime(), formatMoney(), readLocale(), saveLocale(), Context, LanguageContext, LocaleProvider() (+3 more)

### Community 33 - "Shared Interface Components"
Cohesion: 0.13
Nodes (14): compilerOptions, allowImportingTsExtensions, esModuleInterop, jsx, lib, module, moduleResolution, noEmit (+6 more)

### Community 35 - "Management Web Application"
Cohesion: 0.14
Nodes (13): compilerOptions, esModuleInterop, jsx, lib, module, moduleResolution, noEmit, paths (+5 more)

### Community 36 - "Languages and Display Formatting"
Cohesion: 0.14
Nodes (13): compilerOptions, allowImportingTsExtensions, esModuleInterop, jsx, lib, module, moduleResolution, noEmit (+5 more)

### Community 38 - "Identity Accounts and Permissions"
Cohesion: 0.17
Nodes (3): Agent instructions, foundation, Foundation implementation tasks

### Community 39 - "Backend Configuration and Services"
Cohesion: 0.29
Nodes (8): IdentitySecrets, associatedData(), decryptOutboxPayload(), EncryptedOutboxPayload, encryptOutboxPayload(), invalid(), OutboxContext, uuid()

### Community 40 - "Backend Configuration and Services"
Cohesion: 0.20
Nodes (6): createRegistrationService(), email(), object(), PendingAccount, RegistrationError, submit()

### Community 41 - "Backend Configuration and Services"
Cohesion: 0.17
Nodes (11): compilerOptions, esModuleInterop, module, moduleResolution, noUncheckedIndexedAccess, outDir, rootDir, skipLibCheck (+3 more)

### Community 42 - "Database Schema and Migrations"
Cohesion: 0.32
Nodes (11): bookings, bookings_class_session_idx, class_sessions, class_sessions_starts_at_idx, instructors, members, members_email_unique, products (+3 more)

### Community 43 - "Database Schema and Migrations"
Cohesion: 0.32
Nodes (11): bookings, bookings_class_session_idx, class_sessions, class_sessions_starts_at_idx, instructors, members, members_email_unique, products (+3 more)

### Community 44 - "I07 authenticated transport"
Cohesion: 0.26
Nodes (8): I07 authenticated transport, Credentialed createApiClient authentication methods, Shared host-only HttpOnly frontend session cookie, I08 bilingual customer sign-in and account controls, Shared accessible SignInForm, Shared AccountAccess controls, GET management/access: current server administrator/manager capability, I09 management sign-in and access

### Community 45 - "Shared API Contracts"
Cohesion: 0.17
Nodes (11): dependencies, @conecta/contracts, exports, @conecta/contracts, name, private, scripts, test (+3 more)

### Community 46 - "Backend Configuration and Services"
Cohesion: 0.40
Nodes (8): appendSettingsAudit(), SettingsAudit, TrustedActor, readPublicSettings(), updateSettings(), updateSettingsInTransaction(), Settings, validateSettings()

### Community 47 - "Verification and Task Tracking"
Cohesion: 0.27
Nodes (4): harness(), load(), digest(), load()

### Community 49 - "Shared API Contracts"
Cohesion: 0.20
Nodes (9): compilerOptions, lib, module, moduleResolution, noEmit, skipLibCheck, strict, target (+1 more)

### Community 50 - "/graphify"
Cohesion: 0.22
Nodes (9): /graphify, AST structural extraction, Community detection, Existing graph query fast path, Gemini optional host extraction fallback, Graph confidence audit trail, Interactive HTML GraphRAG JSON graph report, Parallel semantic extraction (+1 more)

### Community 51 - "Backend Configuration and Services"
Cohesion: 0.36
Nodes (8): actions, appendIdentityAudit(), boundedString(), fail(), IdentityAudit, roles, sanitizedSnapshot(), Snapshot

### Community 52 - "Shared Interface Components"
Cohesion: 0.33
Nodes (7): ActionAcceptedResponse, CustomerInvitationInput, CustomerInvitations(), changeOpen(), clear(), submit(), InvitationApi

### Community 53 - "graphify reference: query, path, explain"
Cohesion: 0.25
Nodes (8): BFS broad neighbor context, DFS dependency path, Explain node, Graph-only evidence answers, graphify reference: query, path, explain, Persist query results, Shortest path, Vocabulary-constrained query expansion

### Community 54 - "graphify reference: incremental update and"
Cohesion: 0.25
Nodes (8): Cluster-only self-contained regeneration, Code-only semantic bypass, Deleted sources prune, graphify reference: incremental update and cluster-only, Incremental changed-file extraction, Manifest stamps only successful semantic outputs, Preserve directed graph semantics, Re-extracted sources replace

### Community 56 - "Identity login backend: I06 checkpoint"
Cohesion: 0.32
Nodes (5): Identity login backend: I06 checkpoint, Login abuse controls, Review and next step, Router factory contract, Session service

### Community 57 - "Commit and push"
Cohesion: 0.29
Nodes (7): Commit and push, Explicit reviewed staging, No force push no reset no hook bypass, Preserve unrelated work and staging, Scoped authorization commit and push, Validate relevant checks, Verify remote hash after push

### Community 58 - "graphify reference: extra exports and"
Cohesion: 0.29
Nodes (7): FalkorDB export, graphify reference: extra exports and benchmark, Graphify stdio MCP, Neo4j Cypher MERGE export, SVG GraphML exports, Token reduction benchmark, Wiki export

### Community 59 - "graphify reference: extraction subagent prompt"
Cohesion: 0.29
Nodes (7): Deterministic full relative path node identifiers, Extracted inferred ambiguous confidence provenance, graphify reference: extraction subagent prompt (compact), Hyperedges maximum three, Rationale node attributes, Semantic similarity inference, Verbatim absolute source file paths

### Community 60 - "Database Schema and Migrations"
Cohesion: 0.52
Nodes (6): account_roles, account_roles_assigned_by_idx, account_roles_role_idx, accounts, accounts_exemption_actor_idx, people

### Community 61 - "Single-use actions and email delivery"
Cohesion: 0.29
Nodes (7): Delivery and secrets, Single-use actions and email delivery, Lifetimes and resend, Run one local delivery tick, Transaction and authorization contract, Customer screens, Customer registration and confirmation

### Community 62 - "Database Schema and Migrations"
Cohesion: 0.47
Nodes (3): audit_append_only, business_settings, business_units

### Community 64 - "Shared API Contracts"
Cohesion: 0.40
Nodes (4): name, private, types, version

### Community 65 - "graphify reference: add a URL"
Cohesion: 0.50
Nodes (4): Code watcher AST rebuild no LLM, Document watcher flags semantic update, graphify reference: add a URL and watch a folder, URL ingestion updates corpus

### Community 66 - "graphify reference: GitHub clone and"
Cohesion: 0.50
Nodes (4): Cross repository graph merge, GitHub clone reuse, graphify reference: GitHub clone and cross-repo merge, Local subfolder CLI output isolation

### Community 67 - "graphify reference: commit hook and"
Cohesion: 0.50
Nodes (4): Document image changes require manual update, graphify reference: commit hook and native CLAUDE.md integration, Native CLAUDE graph integration, Opt-in post-commit AST hook

### Community 68 - "graphify reference: transcribe video and"
Cohesion: 0.50
Nodes (4): Domain hint initial prompt, graphify reference: transcribe video and audio, Transcript documents semantic extraction, Whisper audio video transcription

### Community 69 - "Identity implementation decisions"
Cohesion: 0.50
Nodes (3): Argon2id 15?128 code point password policy; m=19456 t=2 p=1, Identity implementation decisions, Ten-minute recent password authentication

### Community 71 - "MCP connections for Codex"
Cohesion: 0.50
Nodes (4): Codex MCP configuration, GitHub MCP setup for Codex, OpenAI Docs MCP, MCP connections for Codex

### Community 73 - "POST /api/v1/auth/recovery email -> generic"
Cohesion: 0.67
Nodes (3): I13 recovery backend and I14 shared bilingual recovery/reset screens implemented, POST /api/v1/auth/recovery email -> generic 202 ACCEPTED; reset token/password -> PASSWORD_RESET, One-hour single-use version-bound reset; active eligible identities only; atomic password update/all-session revocation/audit; no activation/login

## Ambiguous Edges - Review These
- `Conecta Infusión: resumen de permisos` → `Identity specification pending in PDF; approved in Markdown`  [AMBIGUOUS]
  docs/requirements/resumen-permisos.es.pdf · relation: conceptually_related_to

## Knowledge Gaps
- **473 isolated node(s):** `ButtonProps`, `RecoveryAccount`, `ActionBinding`, `DeliveryCode`, `DeliveryMessage` (+468 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 618 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **20 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `Conecta Infusión: resumen de permisos` and `Identity specification pending in PDF; approved in Markdown`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **Why does `pg` connect `Shared API Contracts` to `Shared API Contracts`, `Verification and Task Tracking`, `Backend Configuration and Services`, `Verification and Task Tracking`, `Backend Configuration and Services`, `Backend Configuration and Services`, `Verification and Task Tracking`, `Backend Configuration and Services`, `Verification and Task Tracking`, `Verification and Task Tracking`, `Backend Configuration and Services`?**
  _High betweenness centrality (0.065) - this node is a cross-community bridge._
- **Why does `@playwright/test` connect `Verification and Task Tracking` to `scripts`, `Verification and Task Tracking`, `Shared API Contracts`?**
  _High betweenness centrality (0.028) - this node is a cross-community bridge._
- **Why does `@conecta/contracts` connect `Shared Interface Components` to `Verification and Task Tracking`?**
  _High betweenness centrality (0.025) - this node is a cross-community bridge._
- **What connects `ButtonProps`, `RecoveryAccount`, `ActionBinding` to the rest of the system?**
  _473 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Shared API Contracts` be split into smaller, more focused modules?**
  _Cohesion score 0.051643192488262914 - nodes in this community are weakly interconnected._
- **Should `Bilingual Business Rules` be split into smaller, more focused modules?**
  _Cohesion score 0.05519480519480519 - nodes in this community are weakly interconnected._
## Incremental Update

Re-extracted only 28 changed source files; unchanged source fragments retained. Approved Identity plan is distinct from implemented code. No PDF regenerated.

## Integrity Limitations

Original extraction reported 16 dangling endpoints and 11 undirected edge collapses. This merged-graph check cannot restore missing information from the original extraction; verify findings against source files.

Fresh changed-file diagnostics: 139 dangling endpoints and 20 undirected edge collapses. The merged graph has 0 missing endpoints; synthesized endpoints do not prove implementations exist. Self-references include V3 accounts and AST name-resolution artifacts; verify call relationships against source. See `graph-health.json`.
