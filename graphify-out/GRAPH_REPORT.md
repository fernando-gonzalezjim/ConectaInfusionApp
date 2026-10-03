# Graph Report - ConectaInfusionApp  (2026-10-03)

## Corpus Check
- Corpus is ~49,541 words - fits in a single context window. You may not need a graph.

## Summary
- 844 nodes · 1120 edges · 53 communities (45 shown, 8 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 30 edges (avg confidence: 0.92)
- Token cost: unavailable (host-agent extraction usage is not exposed; placeholder counters do not mean zero cost).

## Community Hubs (Navigation)
- Shared Interface Components
- Bilingual Business Rules
- Foundation Specification
- Backend Configuration and Services
- Customer Web Application
- Management Web Application
- Verification and Task Tracking
- Bilingual Business Rules
- Shared Interface Components
- Verification and Task Tracking
- Conecta Infusion
- Identity Implementation Plan
- Identity Implementation Plan
- Languages and Display Formatting
- Customer Web Application
- Management Web Application
- Shared Interface Components
- Identity Implementation Plan
- Customer Web Application
- Shared Interface Components
- Identity Implementation Plan
- Management Web Application
- Languages and Display Formatting
- Identity Implementation Plan
- Shared API Contracts
- Backend Configuration and Services
- Database Schema and Migrations
- Database Schema and Migrations
- Shared API Contracts
- Identity Implementation Plan
- Shared API Contracts
- /graphify
- graphify reference: query, path, explain
- graphify reference: incremental update and
- Identity Accounts and Permissions
- Commit and push
- graphify reference: extra exports and
- graphify reference: extraction subagent prompt
- compose.yaml
- Verification and Task Tracking
- Database Schema and Migrations
- Shared API Contracts
- graphify reference: add a URL
- graphify reference: GitHub clone and
- graphify reference: commit hook and
- graphify reference: transcribe video and
- MCP connections for Codex
- commitAndPush.prompt.md
- Customer Web Application
- Customer Web Application
- Management Web Application
- Shared Interface Components

## God Nodes (most connected - your core abstractions)
1. `Spec: Foundation` - 27 edges
2. `Conecta Infusion: reglas de negocio acordadas` - 26 edges
3. `Conecta Infusion: agreed business rules` - 24 edges
4. `Implementation plan: Identity and access` - 22 edges
5. `Conecta Infusion` - 21 edges
6. `Spec: Identity and access` - 21 edges
7. `Architecture` - 19 edges
8. `cn()` - 18 edges
9. `Capability map: Conecta Infusion` - 14 edges
10. `Phase 2: Registration and account administration` - 14 edges

## Surprising Connections (you probably didn't know these)
- `Conecta Infusion: reglas de negocio acordadas (PDF snapshot)` --semantically_similar_to--> `Conecta Infusion: reglas de negocio acordadas`  [INFERRED] [semantically similar]
  docs/requirements/agreed-business-rules.es.pdf → docs/requirements/agreed-business-rules.es.md
- `Settings update and audit atomic singleton lock` --semantically_similar_to--> `Transactional append-only sanitized audit`  [INFERRED] [semantically similar]
  docs/architecture.md → SPEC-foundation.md
- `Conecta Infusión: resumen de permisos (PDF snapshot)` --semantically_similar_to--> `Conecta Infusión: resumen de permisos`  [INFERRED] [semantically similar]
  docs/requirements/resumen-permisos.es.pdf → docs/requirements/resumen-permisos.es.md
- `Identity specification pending in PDF; approved in Markdown` --conceptually_related_to--> `Conecta Infusión: resumen de permisos`  [AMBIGUOUS]
  docs/requirements/resumen-permisos.es.pdf → docs/requirements/resumen-permisos.es.md
- `Per-credit instructor earnings (required)` --semantically_similar_to--> `Per-credit instructor earnings (required) — Spanish requirement`  [INFERRED] [semantically similar]
  docs/requirements/agreed-business-rules.md → docs/requirements/agreed-business-rules.es.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Required credit-to-instructor-pay traceability** — docs_requirements_agreed_business_rules_credit_value, docs_requirements_agreed_business_rules_earnings, docs_requirements_agreed_business_rules_payroll, docs_requirements_agreed_business_rules_audit [EXTRACTED 1.00]
- **Planned atomic lifecycle integration; not completed implementation** — tasks_identity_plan_composition_layer_lifecycle_coordinator, capability_map_identity, capability_map_credits_bookings, capability_map_studio_catalog, capability_map_instructor_payroll [EXTRACTED 1.00]
- **Approved pending Identity implementation phases** — tasks_identity_todo_phase_1, tasks_identity_todo_phase_2, tasks_identity_todo_phase_3, tasks_identity_todo_phase_4 [EXTRACTED 1.00]

## Communities (53 total, 8 thin omitted)

### Community 0 - "Shared Interface Components"
Cohesion: 0.08
Nodes (42): getStudioOverview(), api, FoundationApp(), api, App(), ApiError, createApiClient(), get() (+34 more)

### Community 1 - "Bilingual Business Rules"
Cohesion: 0.06
Nodes (11): Conecta Infusion Yoga on Instagram, GitHub issue #1, Conecta Infusion: confirmed product intent, issue #1, Conecta Infusion: agreed business rules, incidencia #1, Conecta Infusion: reglas de negocio acordadas, Conecta Infusion: reglas de negocio acordadas (PDF snapshot) (+3 more)

### Community 2 - "Foundation Specification"
Cohesion: 0.04
Nodes (48): Architecture, Audit mutation rejection triggers, Business timezone independent device timezone, Controlled browser tests use intercepted responses, Docker integration verifies real migrations and live browser screens, Express backend owns PostgreSQL business behavior, Flyway sole migration runner, Foundation excludes production authentication financial workflows full WCAG certification (+40 more)

### Community 3 - "Backend Configuration and Services"
Cohesion: 0.06
Nodes (38): dependencies, @conecta/contracts, cors, dotenv, express, helmet, pg, devDependencies (+30 more)

### Community 4 - "Customer Web Application"
Cohesion: 0.06
Nodes (35): dependencies, @conecta/api-client, @conecta/contracts, @conecta/i18n, @conecta/ui, react, react-dom, devDependencies (+27 more)

### Community 5 - "Management Web Application"
Cohesion: 0.06
Nodes (35): dependencies, @conecta/api-client, @conecta/contracts, @conecta/i18n, @conecta/ui, react, react-dom, devDependencies (+27 more)

### Community 6 - "Verification and Task Tracking"
Cohesion: 0.06
Nodes (29): devDependencies, @axe-core/playwright, concurrently, @playwright/test, typescript, engines, node, name (+21 more)

### Community 7 - "Bilingual Business Rules"
Cohesion: 0.07
Nodes (17): Database migration transition, Visual direction: Conecta Infusion, ﻿# Foundation verification, baseline, Flyway Docker, Playwright web servers, shadcn/ui monorepos, Tailwind v4 (+9 more)

### Community 8 - "Shared Interface Components"
Cohesion: 0.06
Nodes (31): dependencies, class-variance-authority, clsx, @conecta/contracts, lucide-react, @radix-ui/react-dialog, @radix-ui/react-slot, tailwind-merge (+23 more)

### Community 9 - "Verification and Task Tracking"
Cohesion: 0.09
Nodes (10): admin, valid, valid, pg, assertLegacySchemaMatches(), schemaSnapshot(), compose, isolatedEnvironment (+2 more)

### Community 10 - "Conecta Infusion"
Cohesion: 0.09
Nodes (22): API localhost 3001, Conecta Infusion, Customer localhost 5173, Database outage unavailable state with retry, Development fixtures excluded production builds, Frontend proxy api strict ports, Integration disposable database port 55432, Management localhost 5174 (+14 more)

### Community 11 - "Identity Implementation Plan"
Cohesion: 0.17
Nodes (20): I23: Family persistence, I24: Family invitation backend, I25: Family UI, I26: Successor responsibility, I27: Membership lifecycle contracts, I28: Dependent persistence, I29: Dependent profile backend, I30: Dependent UI (+12 more)

### Community 12 - "Identity Implementation Plan"
Cohesion: 0.20
Nodes (10): cafe-sales, credits-bookings, Capability map: Conecta Infusion, financial-reporting, foundation, identity, instructor-payroll, payments (+2 more)

### Community 13 - "Languages and Display Formatting"
Cohesion: 0.11
Nodes (17): dependencies, @conecta/contracts, exports, ./format, @conecta/contracts, react, react-dom, name (+9 more)

### Community 14 - "Customer Web Application"
Cohesion: 0.12
Nodes (16): aliases, components, hooks, lib, ui, utils, iconLibrary, rsc (+8 more)

### Community 15 - "Management Web Application"
Cohesion: 0.12
Nodes (16): aliases, components, hooks, lib, ui, utils, iconLibrary, rsc (+8 more)

### Community 16 - "Shared Interface Components"
Cohesion: 0.12
Nodes (16): aliases, components, hooks, lib, ui, utils, iconLibrary, rsc (+8 more)

### Community 18 - "Customer Web Application"
Cohesion: 0.13
Nodes (14): compilerOptions, allowImportingTsExtensions, esModuleInterop, jsx, lib, module, moduleResolution, noEmit (+6 more)

### Community 19 - "Shared Interface Components"
Cohesion: 0.13
Nodes (14): compilerOptions, allowImportingTsExtensions, esModuleInterop, jsx, lib, module, moduleResolution, noEmit (+6 more)

### Community 20 - "Identity Implementation Plan"
Cohesion: 0.25
Nodes (14): I10: Single-use action delivery, I11: Customer registration backend, I12: Registration UI, I13: Recovery backend, I14: Recovery UI, I15: Customer invitations backend, I16: Invitation UI, I17: Account administration backend (+6 more)

### Community 21 - "Management Web Application"
Cohesion: 0.14
Nodes (13): compilerOptions, esModuleInterop, jsx, lib, module, moduleResolution, noEmit, paths (+5 more)

### Community 22 - "Languages and Display Formatting"
Cohesion: 0.14
Nodes (13): compilerOptions, allowImportingTsExtensions, esModuleInterop, jsx, lib, module, moduleResolution, noEmit (+5 more)

### Community 23 - "Identity Implementation Plan"
Cohesion: 0.16
Nodes (4): Implementation plan: Identity and access, feature/identity-implementation, Identity implementation tasks, Foundation implementation tasks

### Community 24 - "Shared API Contracts"
Cohesion: 0.36
Nodes (9): appendSettingsAudit(), SettingsAudit, TrustedActor, readPublicSettings(), updateSettings(), updateSettingsInTransaction(), Settings, validateSettings() (+1 more)

### Community 25 - "Backend Configuration and Services"
Cohesion: 0.17
Nodes (11): compilerOptions, esModuleInterop, module, moduleResolution, noUncheckedIndexedAccess, outDir, rootDir, skipLibCheck (+3 more)

### Community 26 - "Database Schema and Migrations"
Cohesion: 0.32
Nodes (11): bookings, bookings_class_session_idx, class_sessions, class_sessions_starts_at_idx, instructors, members, members_email_unique, products (+3 more)

### Community 27 - "Database Schema and Migrations"
Cohesion: 0.32
Nodes (11): bookings, bookings_class_session_idx, class_sessions, class_sessions_starts_at_idx, instructors, members, members_email_unique, products (+3 more)

### Community 28 - "Shared API Contracts"
Cohesion: 0.17
Nodes (11): dependencies, @conecta/contracts, exports, @conecta/contracts, name, private, scripts, test (+3 more)

### Community 29 - "Identity Implementation Plan"
Cohesion: 0.29
Nodes (10): I01: Resolve technical choices, I02: Account persistence, I03: Identity audit, I04: Password and bootstrap, I05: Session and delivery persistence, I06: Login backend, I07: Authenticated transport, I08: Customer login slice (+2 more)

### Community 30 - "Shared API Contracts"
Cohesion: 0.20
Nodes (9): compilerOptions, lib, module, moduleResolution, noEmit, skipLibCheck, strict, target (+1 more)

### Community 31 - "/graphify"
Cohesion: 0.22
Nodes (9): /graphify, AST structural extraction, Community detection, Existing graph query fast path, Gemini optional host extraction fallback, Graph confidence audit trail, Interactive HTML GraphRAG JSON graph report, Parallel semantic extraction (+1 more)

### Community 32 - "graphify reference: query, path, explain"
Cohesion: 0.25
Nodes (8): BFS broad neighbor context, DFS dependency path, Explain node, Graph-only evidence answers, graphify reference: query, path, explain, Persist query results, Shortest path, Vocabulary-constrained query expansion

### Community 33 - "graphify reference: incremental update and"
Cohesion: 0.25
Nodes (8): Cluster-only self-contained regeneration, Code-only semantic bypass, Deleted sources prune, graphify reference: incremental update and cluster-only, Incremental changed-file extraction, Manifest stamps only successful semantic outputs, Preserve directed graph semantics, Re-extracted sources replace

### Community 35 - "Commit and push"
Cohesion: 0.29
Nodes (7): Commit and push, Explicit reviewed staging, No force push no reset no hook bypass, Preserve unrelated work and staging, Scoped authorization commit and push, Validate relevant checks, Verify remote hash after push

### Community 36 - "graphify reference: extra exports and"
Cohesion: 0.29
Nodes (7): FalkorDB export, graphify reference: extra exports and benchmark, Graphify stdio MCP, Neo4j Cypher MERGE export, SVG GraphML exports, Token reduction benchmark, Wiki export

### Community 37 - "graphify reference: extraction subagent prompt"
Cohesion: 0.29
Nodes (7): Deterministic full relative path node identifiers, Extracted inferred ambiguous confidence provenance, graphify reference: extraction subagent prompt (compact), Hyperedges maximum three, Rationale node attributes, Semantic similarity inference, Verbatim absolute source file paths

### Community 38 - "compose.yaml"
Cohesion: 0.33
Nodes (6): Database migrations read-only mount, Flyway 13.9.0 migration service, Flyway baseline on migrate disabled, Flyway clean disabled, Persistent postgres data volume, PostgreSQL 17 service

### Community 39 - "Verification and Task Tracking"
Cohesion: 0.33
Nodes (7): Database migrations read-only mount, Disposable tmpfs test database, Flyway 13.9.0 migration service, Flyway baseline on migrate disabled, Flyway clean disabled, Isolated disposable test service: no host database or persistent volume., PostgreSQL 17 service

### Community 40 - "Database Schema and Migrations"
Cohesion: 0.47
Nodes (3): audit_append_only, business_settings, business_units

### Community 42 - "Shared API Contracts"
Cohesion: 0.40
Nodes (4): name, private, types, version

### Community 43 - "graphify reference: add a URL"
Cohesion: 0.50
Nodes (4): Code watcher AST rebuild no LLM, Document watcher flags semantic update, graphify reference: add a URL and watch a folder, URL ingestion updates corpus

### Community 44 - "graphify reference: GitHub clone and"
Cohesion: 0.50
Nodes (4): Cross repository graph merge, GitHub clone reuse, graphify reference: GitHub clone and cross-repo merge, Local subfolder CLI output isolation

### Community 45 - "graphify reference: commit hook and"
Cohesion: 0.50
Nodes (4): Document image changes require manual update, graphify reference: commit hook and native CLAUDE.md integration, Native CLAUDE graph integration, Opt-in post-commit AST hook

### Community 46 - "graphify reference: transcribe video and"
Cohesion: 0.50
Nodes (4): Domain hint initial prompt, graphify reference: transcribe video and audio, Transcript documents semantic extraction, Whisper audio video transcription

### Community 47 - "MCP connections for Codex"
Cohesion: 0.50
Nodes (4): Codex MCP configuration, GitHub MCP setup for Codex, OpenAI Docs MCP, MCP connections for Codex

## Ambiguous Edges - Review These
- `Conecta Infusión: resumen de permisos` → `Identity specification pending in PDF; approved in Markdown`  [AMBIGUOUS]
  docs/requirements/resumen-permisos.es.pdf · relation: conceptually_related_to

## Knowledge Gaps
- **436 isolated node(s):** `BusinessUnitCode`, `ButtonProps`, `TrustedActor`, `api`, `api` (+431 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 486 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **8 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `Conecta Infusión: resumen de permisos` and `Identity specification pending in PDF; approved in Markdown`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **Why does `Implementation plan: Identity and access` connect `Identity Implementation Plan` to `Identity Implementation Plan`, `Identity Implementation Plan`, `Identity Implementation Plan`, `Identity Implementation Plan`, `Identity Implementation Plan`?**
  _High betweenness centrality (0.030) - this node is a cross-community bridge._
- **Why does `Implementation plan: Foundation` connect `Bilingual Business Rules` to `Identity Implementation Plan`?**
  _High betweenness centrality (0.029) - this node is a cross-community bridge._
- **Why does `Foundation implementation tasks` connect `Identity Implementation Plan` to `Identity Accounts and Permissions`, `Identity Implementation Plan`, `Bilingual Business Rules`?**
  _High betweenness centrality (0.027) - this node is a cross-community bridge._
- **What connects `BusinessUnitCode`, `ButtonProps`, `TrustedActor` to the rest of the system?**
  _436 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Shared Interface Components` be split into smaller, more focused modules?**
  _Cohesion score 0.0845771144278607 - nodes in this community are weakly interconnected._
- **Should `Bilingual Business Rules` be split into smaller, more focused modules?**
  _Cohesion score 0.05519480519480519 - nodes in this community are weakly interconnected._
## Incremental Update

Re-extracted only 6 changed documents; unchanged code and other source fragments retained. Approved Identity plan is distinct from implemented code. No PDF regenerated.

## Integrity Limitations

Original extraction reported 16 dangling endpoints and 11 undirected edge collapses. This merged-graph check cannot restore missing information from the original extraction; verify findings against source files.
