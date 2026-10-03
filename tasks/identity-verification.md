# Identity verification evidence

Branch: `feature/identity-implementation`. Specification and implementation plan approved October 3, 2026. This file records completed checks without claiming the whole module is implemented.

## I01 — dependency and technical decisions

Completed October 3, 2026. Exact pins and limits are recorded in [identity-decisions.md](../docs/identity-decisions.md).

- Clean Windows x64 install: Node 24.21.0, npm 11.19.0, `npm ci --ignore-scripts`; passed.
- Windows dependency tests: `node --test apps/api/test/identity-dependencies.test.mjs`; 3 passed, none skipped.
- Clean Linux x64 install: disposable `node:24.21.0-bookworm-slim` container, project mounted read-only; root lockfile and every workspace manifest copied into container-local temporary storage, `npm ci --ignore-scripts`; passed. Image digest: `sha256:0e0ff40c39bc087845bfb27465a0df4ea419520094bc35842ff83dd8cbe6f9b6`.
- Linux dependency tests against that clean install: 3 passed, none skipped.
- Checks prove password verification rejects a wrong password, SMTP message construction works without external delivery, and image decoding/re-encoding removes EXIF metadata.
- Argon2id hash plus two verifications: approximately 47 ms on Windows and 62 ms in the Linux container. These are smoke timings, not load/capacity benchmarks.
- `npm run typecheck`, `npm run build`, `npm test`: passed; 13 unit tests total including the 3 dependency checks.
- Installation audit and `npm audit --omit=dev`: no known vulnerabilities reported. This is not proof against unknown malicious packages.

Initial checks found a test assuming a fixed PHC parameter order. The library emits `m,p,t`; the corrected assertion checks each parameter/value independently. Both platforms then passed. An initial sandboxed Node test spawn was denied; the normal test invocation was run with required execution permissions.

No database migration, account, session, SMTP connection or upload route exists from I01. Database and browser suites will be required when their behavior changes; unchanged Foundation evidence is preserved.

## Graph snapshot

The authorized incremental refresh before I01 re-extracted six changed documents and retained unchanged source fragments: 844 nodes, 1,120 edges, 53 communities. The report preserves the original full-extraction integrity warnings. Host semantic token usage was not exposed and is reported as unavailable, not zero.

I01 introduced dependencies, a compatibility test and security decisions after that snapshot. **Graph may be stale; remind the user to update Graphify.** The earlier refresh does not authorize continuous rebuilding or hooks.

## Next verification

I02: fresh/repeated/populated-legacy migrations, explicit linkage/collision checks and person/account constraints. I03: customer-capable audit, atomic rollback, forbidden mutation and secret exclusion. Human review checkpoint follows I03.
