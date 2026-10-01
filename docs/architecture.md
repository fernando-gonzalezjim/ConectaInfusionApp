# Architecture and implementation roadmap

## Database recommendation

Use PostgreSQL: this domain has linked records and needs transactions for booking capacity, membership credits, payments, and inventory movements. Relational constraints help preserve consistency.

| Option | Best fit | Considerations |
| --- | --- | --- |
| PostgreSQL | Recommended primary database for the studio and café | Requires database hosting and backups |
| Supabase (managed PostgreSQL) | A hosted database with optional authentication and storage services | Keep privileged credentials on the backend; define access policies before exposing tables to clients |
| SQLite | A disposable prototype or local single-device tool | Revisit deployment and concurrent writes before multi-device production use |

Start with local PostgreSQL through Docker and choose hosting when deployment requirements are known. PostgreSQL is now selected. The backend uses the pg driver, a bounded connection pool, query timeouts, and a transactional initial migration. Use parameterized queries for future user-supplied values.

References: [PostgreSQL transactions](https://www.postgresql.org/docs/current/tutorial-transactions.html), [Supabase database](https://supabase.com/docs/guides/database), [SQLite use cases](https://www.sqlite.org/whentouse.html).

## Boundaries

Web and future mobile clients call the versioned `/api/v1` API. Database credentials, authorization, payment verification, and business rules belong in the backend. Shared contracts define response shapes; they do not replace runtime input validation.

The initial SQL provides members, instructors, class sessions, bookings, products, sales, and sale items. It is a foundation, not a complete production schema. Bookings require a transaction that locks the session before checking capacity and inserting a reservation; a count followed by an unprotected insert can overbook. Cancelled bookings can be reactivated using their existing unique member/session record.

Store timestamps with time zones and render in the studio's configured time zone. Store MXN amounts as integer centavos, snapshot prices on sale items, and define tax and refund rules before taking payments. Currency must be validated across a sale and its line items.

## Suggested feature order

1. Staff authentication and roles: owner, receptionist, instructor, barista. Add server-side authorization, input validation, and audit records before exposing customer data.
2. Members and class scheduling: instructor availability, room capacity, booking, cancellation, attendance, and waitlists.
3. Memberships: monthly plans, class packs, credit ledger, expiration, and booking policies.
4. Café sales: menu, order tickets, checkout, payment records, and refunds. Use payment-provider tokens and webhooks; do not store card details.
5. Inventory: ingredients, recipes, suppliers, purchases, and stock movement history rather than only a mutable stock number.
6. Reports: class occupancy, membership renewal, café revenue, and product consumption.
7. Mobile access: decide between an installable web app (PWA) and a native React Native/Expo client based on offline, notification, and device integration requirements.

Before production, extend the migration runner for future schema changes and add transactional integration tests, backups with restore checks, rate limiting, secrets management, and deployment configuration. Business write workflows are not implemented yet. The dashboard reads PostgreSQL through the API and shows empty states for a new database.
