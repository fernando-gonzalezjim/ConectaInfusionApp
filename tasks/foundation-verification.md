# Foundation verification

October 1, 2026. Implementation is in progress, not accepted as complete.

## Executed evidence

- Workspace type checks and API/customer/management production builds passed.
- Ten Node tests passed: API outage, missing-settings readiness, absent settings-write/audit routes, settings validation, client success/error/abort, locale storage fallback, money and timezone formatting.
- Twelve Chromium scenarios passed: both origins at 360/768/1440, Spanish/English with reload persistence, input retention, class/price rendering, management settings, dialog Enter/Escape/focus return and trap, associated field errors with long labels, loading/empty/error/retry states, no overflow or page errors. axe found no violations for configured WCAG 2/2.1/2.2 A/AA tags in tested loaded states, field fixture and open dialog.
- Clean npm ci passed with no reported vulnerabilities. Build passed after the fixture and readiness changes. Fixture HTML is excluded from the production build.
- Mobile customer and desktop customer/management screenshots inspected: readable branded layouts without clipped content. Screenshots are ignored test-results artifacts. These checks do not certify full WCAG compliance.
- Static color-pair review: body text/white 13.64:1, muted text/blush 6.08:1, white/primary 7.40:1, error text/white 7.38:1, input boundary/white 4.18:1. The last is a non-text boundary (3:1 target), not body text. Browser axe checks provide additional rendered-state evidence.
- Browser checks passed again after npm ci. Live Playwright configuration loads and lists its two scenarios, but they have not run against PostgreSQL.
- Integration command failed explicitly because Docker is unavailable; no tests were falsely marked passed/skipped.

Browser tests intercept API responses and do not prove database-to-browser integration. API outage tests use an intentionally unreachable database.

## Acceptance mapping

| Criterion | Status |
| --- | --- |
| A01 settings/defaults | Validation passes; persistence needs PostgreSQL |
| A02 locale preservation | Both browser origins pass |
| A03 money/time | Formatter tests pass; fixture display checked |
| A04 atomic audit | Code/scenario present; database execution blocked |
| A05 corrections/privacy | Allowlisted writer/scenario present; database execution blocked |
| A06 public boundary | Unavailable/absent write routes pass; happy response needs PostgreSQL |
| A07 shared components | Browser checks pass including field-error fixture, delayed loading and focus trap; full manual keyboard/contrast review remains |
| A08 fresh/repeat/checksum | Scenarios present; Docker blocked |
| A09 legacy adoption/drift | Comparator/scenario present; Docker blocked; real adoption requires separate approval |
| A10 workspace separation | Builds/distinct dev servers pass; root lifecycle/proxies need live verification |
| A11 both apps / roles | Fixture checks pass; authorization tests belong to Identity |

## Remaining work

1. Install/start Docker, verify pinned images, run integration tests and fix failures. No real application database was altered.
2. After migration acceptance, retire the legacy executable and switch db:migrate to Flyway.
3. Test real settings/API readiness, both proxies, root dev shutdown, and database-backed browser flows. The isolated runner now invokes playwright.integration.config.ts against a separate fixture database; these two live browser scenarios have not executed.
4. Complete manual keyboard/contrast review. Stable codes were added to legacy API errors; missing-singleton readiness now has a passing regression test.
5. Verify update/truncate rejection in addition to deletion on PostgreSQL. The current audit writer is settings-specific; downstream modules must extend typed event definitions with their own allowed fields rather than accept unrestricted payloads.
6. Finish live-check evidence and handoff. No commit/push performed.

Business rules and Spanish PDF were not changed by this implementation. Public homepage, Identity, bookings, payments, credits and payroll remain later modules.
