# Foundation toolchain evidence

October 1, 2026. Exact npm resolutions are in package-lock.json; use npm ci.

| Tool | Selected / observed | Evidence |
| --- | --- | --- |
| Node / npm | 24.21.0 / 11.19.0 | Executed locally |
| React / Vite / TypeScript | 19.3.0 / 8.3.1 / 7.0.2 | Existing stack retained; builds pass |
| Tailwind / Vite plugin | 4.3.3 | Vite 8 peer compatibility checked; shared CSS builds |
| shadcn/ui | new-york source components | Official registry button/input/dialog/alert; local adaptations |
| Playwright / axe | 1.63.0 / 4.13.0 | Chromium installed; twelve scenarios pass |
| PostgreSQL | postgres:17 (17.11) | Live isolated migrations and transactions passed |
| Flyway | redgate/flyway:13.9.0 | Pulled and executed against PostgreSQL 17.11 |
| Docker Desktop | 4.93.0; Engine 29.8.1 | Linux engine running; isolated test cleanup verified |

References consulted during implementation: [Tailwind Vite](https://tailwindcss.com/docs/installation/using-vite), [shadcn monorepo](https://ui.shadcn.com/docs/monorepo), [Flyway Docker/CLI](https://documentation.red-gate.com/flyway/reference/usage/command-line), [Playwright accessibility](https://playwright.dev/docs/accessibility-testing).

Verified image digests:

- Flyway: `redgate/flyway@sha256:bb1974d16bd374dd32582c93cfc7965b27664e4720a4b243f74c00f74c157745`.
- PostgreSQL: `postgres@sha256:d74eeac9a635390a49bc21bd49fccd973de707e2a53a76ac49b552b8712ec46f`.

Compose pins the Flyway version tag. PostgreSQL follows the 17 series; the digests above record the actual tested artifacts, rather than claiming future tag pulls are identical.
