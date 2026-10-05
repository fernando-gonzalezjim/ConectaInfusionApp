# Fictional development dataset

Run this manually after migrations and [manual administrator bootstrap](identity-bootstrap.md). It never runs on startup or in migrations. Existing active administration is required; the script does not create the first administrator. No email is sent. Most fictional accounts use explicit management confirmation exemptions with provenance and audited creation. The dedicated I20 profile customer has an explicitly audited synthetic verified state for local testing; this is not evidence of real mailbox ownership.

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
