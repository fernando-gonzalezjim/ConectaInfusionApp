# Internal Identity lifecycle composition

I35 provides the internal coordinator boundary for [the approved Identity lifecycle](SPEC-identity.md). It exposes no deactivation, family departure/removal/closure or reactivation HTTP route. The existing [family financial lifecycle contract](identity-families.md) remains separate and requires its owning coordinator.

## Request and preview contract

`createIdentityLifecycleComposition()` is conservative by default. Account/dependent deactivation and staff-eligibility changes require credits-bookings, studio-catalog and instructor-payroll coordinators. Family leave/removal/closure requires credits-bookings. Missing coordinators, unknown revisions or incomplete atomic/audit/history assurances yield `INTEGRATION_REQUIRED`; missing required schema or unknown public tables/views/materialized views/foreign tables yield `UNKNOWN_SCHEMA`. Legacy obligations without explicit owning-adapter support yield `LEGACY_OBLIGATIONS`. Empty or absent future credit/payroll tables never establish that no obligation exists.

A request binds the initiating account, operation, canonical affected-person set and a trusted Identity intent/version string. That string must include the operation's explicit choices, target versions, and any purchaser donation-consent reference. It must never contain passwords, mail action tokens or profile text. The internal limit is 100 affected people per call; it is a batching bound, not an approved family-size rule. Larger operations require a reviewed owning-module transaction strategy before they can be enabled.

Preview runs inside an explicit caller-owned transaction and returns either `{status:'blocked', reasons}` or `{status:'ready', revision}`. A SHA-256 revision binds the request, current account/role/person/dependent/guardian/family facts and each owning module's revision. Guardian relationships of affected account holders and their dependent profiles, plus all memberships of affected families, are included. Successful previews roll back all inspection effects to their savepoint before returning, so an erroneous inspector cannot persist a write. Preview is advisory; execution inspects again.

## Caller and adapter prerequisites

Before either call, the trusted Identity caller must authorize the current actor and lock all affected accounts in UUID order, then all affected people, roles, sessions and Identity relationships in the established order. Derive the complete target/dependent/guardian/family scope under those locks; if newly discovered relationships introduce an unlocked account, restart with a new canonical scope rather than acquiring a late account lock. Reauthorize every retry, including a completed receipt lookup. The composition guard is not an authentication or authorization service.

Adapters then inspect legacy sources under a conservative `SHARE ROW EXCLUSIVE` domain-table lock. This serializes inspections that may become writes and avoids concurrent SHARE-to-write lock upgrades. No adapter may acquire a late Identity account/person lock; every required identity must already be in the caller's locked scope. Future fully adopted modules may replace this conservative scan only with an explicitly reviewed adapter and regression evidence.

The legacy scan detects member-person or normalized-email matches, booking attendee/acting-account references, unresolved legacy attendance links, and linked or ambiguous teaching identities. Credit and studio/payroll adapters must explicitly support their relevant legacy records before execution. Undeclared schemas remain blocking; adapters declare their own additional table names and cannot claim Foundation/Identity tables as newly owned schema. Missing declared tables also block.

Coordinators receive a query-only facade for the same PostgreSQL transaction. It permits single parameterized SELECT/INSERT/UPDATE/DELETE/WITH/LOCK statements; it rejects transaction/session commands, SQL comments, semicolons and callback-style queries and exposes no client release or alternate connection. This is a programming boundary for registered trusted adapters, not a sandbox for arbitrary SQL. Adapters must not capture another client/pool, issue external payments/network effects, invoke nontransactional side effects or independently commit. Their inspection revisions must represent current locked obligations, including reservations, earned instructor pay, cancellation and teaching-resolution decisions. Only an `applied` receipt matching the inspected revision is accepted.

## Execution and idempotency

Execution requires the original request, preview revision and a UUID idempotency key. Actor/key retries serialize before domain inspection. V13 stores only completed immutable receipts with a request hash, revision and completion time; no pending receipt is committed and no default user is seeded. A matching retry returns the same operation ID without reapplying effects. Reusing a key for a changed request/revision conflicts. Use the original intent binding on replay; fresh actor authorization remains mandatory, while fresh state/version validation is required before an uncompleted mutation.

For new work, execution recomputes the current preview, invokes each owning coordinator and the trusted Identity mutation callback through the same restricted transaction facade, then appends the receipt and reference-only `identity.lifecycle_applied` audit. Adapter failure, mismatched revisions, Identity failure or audit failure roll back all guard effects to a savepoint, even if the outer caller catches the error and later commits. The initiating actor and operation reference are recorded without profile text or credentials. Receipts cannot be updated, deleted or truncated through normal runtime SQL.

I36 adds a safe operational projection for the generic receipt event with the explicit `lifecycle_operation` target and Spanish/English label alongside account/dependent audit. Do not infer public workflow completion from a test coordinator or receipt.

## I36 and owning-module handoff

[I36 account deactivation](identity-deactivation.md) implements privileged/self authorization, final-administrator protection, guardian scope, accepted transfer or allowed joint deactivation, retained other-guardian access, session revocation and audited status changes. These share the transaction with the coordinator and recheck current locks/versions on retry; default composition still blocks without owning-module adapters. I37 owns explicit reactivation and accepting-prior-guardian provenance. I38 owns previews and honest integration-required screens.

Credits-bookings owns the two-hour cancellation outcomes, reserved credit ownership/expiration/value, family withdrawal/donation and preserved paid bookings. Studio-catalog owns explicit teaching reassignment/cancellation. Instructor-payroll owns earned payments that remain owed after deactivation. These implementations are not supplied by I35's test adapters; no default adapter claims them resolved. Empty schemas or fixture bookings do not replace domain verification.

## Verification and fictional data

The dedicated PostgreSQL suite checks missing/unknown schemas and coordinators, legacy matching, stale domain/Identity revisions, concurrent retry receipts, read-only preview, prohibited commits, caught-error rollback, coordinator/Identity/audit failures, immutable receipts and populated V12 upgrade/conflict rollback. The existing full regression checks remain required because V13 adds an Identity-owned table to the guarded role-change allowlist.

Existing demo member, booking and instructor fixtures already exercise conservative blocked obligations; no new seed data or manufactured lifecycle success is appropriate. The local demo receives additive V13 through `npm run db:migrate:demo`; no database reset or real payment/email is needed. Public lifecycle controls remain unavailable until their approved steps are completed. See [the verification record](identity-verification.md).
