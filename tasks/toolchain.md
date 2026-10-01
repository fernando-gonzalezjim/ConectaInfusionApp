# Foundation toolchain evidence

October 1, 2026. Exact npm resolutions are in package-lock.json; use npm ci.

| Tool | Selected / observed | Evidence |
| --- | --- | --- |
| Node / npm | 24.21.0 / 11.19.0 | Executed locally |
| React / Vite / TypeScript | 19.3.0 / 8.3.1 / 7.0.2 | Existing stack retained; builds pass |
| Tailwind / Vite plugin | 4.3.3 | Vite 8 peer compatibility checked; shared CSS builds |
| shadcn/ui | new-york source components | Official registry button/input/dialog/alert; local adaptations |
| Playwright / axe | 1.63.0 / 4.13.0 | Chromium installed; twelve scenarios pass |
| PostgreSQL | postgres:17 | Configured, not run here |
| Flyway | redgate/flyway:13.9.0 | Exact tag selected from official docs; pull/runtime unverified |
| Docker Desktop | Missing | Installation canceled at administrator prompt |

References consulted during implementation: [Tailwind Vite](https://tailwindcss.com/docs/installation/using-vite), [shadcn monorepo](https://ui.shadcn.com/docs/monorepo), [Flyway Docker/CLI](https://documentation.red-gate.com/flyway/reference/usage/command-line), [Playwright accessibility](https://playwright.dev/docs/accessibility-testing).

Verify Flyway image availability and record its resolved digest once Docker works. A pinned tag alone is not runtime evidence.
