# Fictional development dataset

Run this manually after migrations and [manual administrator bootstrap](identity-bootstrap.md). It never runs on startup or in migrations. Existing active administration is required; the script does not create the first administrator. No email is sent. Most fictional accounts use explicit management confirmation exemptions with provenance and audited creation. The dedicated I20 profile customer has an explicitly audited synthetic verified state for local testing; this is not evidence of real mailbox ownership.

I28 adds a fictional no-login dependent with `customer.profile`/`customer01` as guardians, one linked reusable child detail and an unlinked saved child for `customer18`. It does not change the 26-account/23-booking fixture counts or create child logins, invitations or bookings. Reseeding preserves manual details, ended guardian relationships and deactivated profiles. I30 exposes these fixtures in the customer Children and dependents dialog. See [dependent persistence](identity-dependents.md).

The private root `dev.env` contains all local API, database, inbox and fixture settings, with independent random encryption/throttle keys. It is Git-ignored. Commands load it automatically; do not replace its keys while encrypted email is pending. This setup uses the separate `conecta_dev` database, Docker project `conecta-demo`, PostgreSQL port 5433 and inbox ports 1026/8026.

```powershell
npm run db:up:demo
npm run db:migrate:demo
# Bootstrap the first administrator using the procedure below, then:
npm run db:seed:demo
npm run dev:demo
```

Create the first administrator manually using the existing bootstrap workflow with this configuration:

```powershell
npm run build -w @conecta/api
node --env-file=dev.env scripts/identity-bootstrap.mjs admin-sql --development --operator local-developer --output .local/demo-admin.sql
Get-Content .local/demo-admin.sql | docker compose --env-file dev.env -p conecta-demo exec -T db psql -U conecta -d conecta_dev -v ON_ERROR_STOP=1
```

The initial admin is `admin@conecta.example.test`, password `admin`, development only. The bootstrap output refuses to overwrite an existing file; after a reset choose a new output filename. Close other running app servers before `dev:demo`; app ports remain 3001/5173/5174. Inbox: `http://127.0.0.1:8026`. Existing process environment values take precedence over Node env-file values; remove conflicting overrides if needed. Never deploy/copy this seeded database: these fictional accounts have known passwords.

Every active demo account uses **`ConectaDemo!2026`**. Sign in using its complete email; pending/inactive accounts cannot sign in:

| Email | Roles |
| --- | --- |
| `manager@demo.conecta.example.test` | Manager + customer |
| `reception@demo.conecta.example.test` | Reception + customer |
| `cafe@demo.conecta.example.test` | Cafe staff + customer |
| `instructor.yoga@demo.conecta.example.test` | Instructor + customer |
| `instructor.dance@demo.conecta.example.test` | Instructor + customer |
| `customer01@demo.conecta.example.test` through `customer18@demo.conecta.example.test` | Customer |
| `customer.pending@demo.conecta.example.test` | Pending customer, no password |
| `customer.inactive@demo.conecta.example.test` | Inactive customer/account profile |

The dataset contains 26 accounts, 21 linked members, two linked instructors, three sessions and 23 bookings. Personnel retain customer roles for cafe access; their presence does not create free staff bookings. Customer 18 prefers English; the others prefer Spanish. A future yoga session is full with 16 confirmed bookings. A future K-pop session has two confirmed and one cancelled booking. A past functional session has two attended, one no-show and one cancelled booking. I19 adds pending/inactive customers for management filters and role restrictions. I20 adds `customer.profile@demo.conecta.example.test`, a dedicated fictional profile/email-change customer with a synthetic verified state and no bookings; see [manual profile testing](identity-profiles.md). Rerunning adds missing rows without overwriting earlier accounts, including manually changed login emails.

Session dates are relative to the first seed run, using the database day and a fixed 18:00 UTC start. They remain unchanged on reruns and eventually become historical. Deterministic namespaced IDs prevent duplicates. Rerunning preserves existing passwords, roles, profile edits, dates and booking statuses; it adds missing demo rows only. Conflicting account IDs/emails cause rollback rather than overwriting identities.

## Full development reset

Stop the app first, then run `npm run db:clean:demo`. This deletes the entire public schema of `conecta_dev`, including all accounts (also manually created admin), bookings, audit history, settings and Flyway history, then reapplies migrations. It is not limited to seeded rows. Bootstrap administration again before reseeding. The script refuses the existing `conecta` database, remote hosts and production configuration. It does not delete the Docker volume, inbox messages or private env file. Migration failure leaves a cleared database; rerun `db:migrate:demo` to recover. This reset is an explicit development exception to retained production audit history and never runs through an application endpoint.

These bookings use the initial relational model. Credit packages, credit consumption, cancellation fees, staff displacement, notifications, instructor percentages and payroll are not simulated. [Account/role editing screens](identity-administration.md) are available for administrators/managers on the management frontend. The I18 conservative role-removal guard will return conflict in this dataset because legacy bookings/instructor obligations exist. That is expected until domain coordination is implemented.

Graphify refreshes changed sources on the approved three-step cadence recorded in [the refresh ledger](../tasks/graphify-refresh.md); seeding itself does not rebuild the graph.

Verification: three focused PostgreSQL integration tests passed on October 4, 2026, covering environment guards, repeat-safe fictional links/counts, preserved profile edits, password hashing, full rollback on an existing email conflict, full schema reset and successful remigration. The existing `conecta` reset target is rejected before connecting. Private `dev.env` passed Identity configuration validation and is Git-ignored. Workspace typecheck/build and all 43 unit tests passed for the unchanged application code. The integration runner discovers this new test automatically. Existing development data was not populated or reset during verification; tests used disposable databases.

Local setup completed October 4, 2026 after a reported `DEVELOPMENT_ADMIN_REQUIRED`: the empty `conecta_dev` database received the guarded, operator-generated first-admin SQL, then all 23 fictional accounts and 23 bookings. The original `conecta` database was untouched. Reseeding created zero additional accounts. The CLI now explains the missing bootstrap step rather than displaying only an error code. After a full reset, repeat the manual bootstrap procedure before seeding.

## Profile photo testing

I21 extends the seed command with `.local/demo-profile.png`, a fictional color swatch for uploads. Existing fixture files and manually uploaded account photos are preserved. The ignored `dev.env` sets `IDENTITY_PHOTO_DIRECTORY` to the private `.local/profile-photos` directory. Use any active demo account's profile editor, or the manager's account editor for another person. See [photo setup and manual checks](identity-photos.md). The database reset does not recursively delete filesystem storage; the API reconciles old unreferenced photos after its staging grace period.

## Audit and family testing

I22 uses the existing audited account fixtures to exercise pagination. Sign in as the demo manager and choose **Ver historial** in the management app. See [audit controls and privacy](identity-audit.md).

I23 adds two fictional families and three memberships: `customer.profile` creates the shared family with `customer01`, and `customer18` creates a solo family. Accepted-invitation provenance is synthetic local fixture data; no real invitation, email, credit transfer or booking change is performed. Rerunning preserves existing group names, closure and ended memberships rather than rejoining them. I24 exposes authenticated invitation endpoints and I25 adds customer/management family screens; existing unassigned `customer02` and the manager/customer account cover recipient consent and management assistance without new seed identities. Seeding does not send invitations, and preserves invitations made through the API. See [family screens/manual checks and coordinator boundaries](identity-families.md).

The existing fixtures already cover the confirmed one-active-family rule; no new accounts/groups are needed. V7 enforces one current group per person, while the repeat-safe seed continues preserving historical memberships and manual edits.

I26 reuses `customer.profile` and `customer01` in the shared family for responsibility offers, acceptance and decline. The manager fixture can assist through the customer account list. Seeding never issues successor links or chooses consent: these are manual UI actions with local inbox delivery. Reseeding preserves responsibility transfers and offer history. Follow the [family and successor manual checks](identity-families.md).

## Dependent backend testing

I29 reuses the I28 no-login dependent and saved-child fixtures; no additional accounts, acceptance records or bookings are required. `customer.profile` and `customer01` can access their current dependent profile, while `customer18` owns the saved child available for conversion. Consult the [dependent endpoint guide](identity-dependents.md) for routes, version handling and privacy boundaries. Reseeding preserves conversions, edited names/ages and ended guardian authorization. I30 provides customer screens in both languages.

I30 manual UI checks reuse these same fixtures. Sign in to the customer app as `customer.profile@demo.conecta.example.test` or `customer01@demo.conecta.example.test` to see the current authorized guardian list, or as `customer18@demo.conecta.example.test` to edit/convert the saved child. Reseeding preserves those changes; the guarded full reset remains the only operation that clears the development database. Follow the [bilingual dependent screen checks](identity-dependents.md). No new demo rows are required for this step.

I31 reuses existing child/guardian/customer/manager fixtures for [guardian invitation checks](identity-dependents.md). Invite an unassigned customer such as customer02 and accept through the local inbox; seeding creates no real invitations or consent. V11 marks legacy/synthetic consent exceptions and preserves manual edits. Migrate before seeding; the guarded full reset remains compatible.

I32 reuses the same two current fictional guardians for [removal checks](identity-dependents.md). Removal preserves history; repeat seeding does not restore ended authorizations. To restore access, issue and accept a new invitation through the local inbox. The last active guardian cannot be removed. No additional seed accounts or consent are created.


I33 manual verification reuses Demo Dependent Child and its existing guardians; no new seeded identity or synthetic transition consent is needed. Request a new fictional `.test` mailbox from the guardian profile and confirm through the local inbox. After completion, the same dependent becomes an independent customer and both guardians lose authorization. Reseeding preserves the independent state and ended relationships. See [the transition checklist](identity-dependents.md#manual-verification) for commands and expected results. Do not reset a database merely to test this flow; creating a separate fictional dependent permits another run.


I35 reuses existing legacy demo members, bookings and teaching identities to exercise conservative lifecycle blocking. V13 adds internal retry-receipt persistence; it seeds no receipt or successful deactivation. No new demo account/data or reset is required, and public lifecycle controls remain assigned to later approved steps. See [the internal lifecycle contract](identity-lifecycle.md).

## I36 deactivation verification

Existing fictional accounts, families, dependents and accepted guardians cover manual guarded-preview checks. No new seed data or manufactured consent is needed. The private preview API returns an integration-required state with default composition; a sole guardian without an explicit joint choice conflicts. No success adapter is seeded, and no reset is required. See [account deactivation](identity-deactivation.md).

## I37 reactivation verification

The seed now also creates **Demo Inactive Dependent** with customer18 as its immediately prior guardian. It records real deactivation provenance and ends the old authorization; it creates no renewal invitation or consent. Existing manually edited/reactivated fixtures are preserved. Migrate before seeding. See [reactivation APIs and the I38 UI boundary](identity-reactivation.md).

I38 uses the existing inactive dependent, customer18, manager and family fixtures; no extra seed data are needed. The [lifecycle screen guide](identity-lifecycle-ui.md) explains blocked deactivation/family controls and the real inbox renewal workflow.
