# Capability map: Conecta Infusion

Status: module boundaries, dependency direction, and proposed order approved by the user on October 1, 2026. Individual specifications and implementation plans require their own review.

Sources: [confirmed intent](docs/intent/conecta-infusion.md) and [agreed rules](docs/requirements/agreed-business-rules.md).

## Starting assumptions for review

- First release has two responsive React frontends, customer-web and management-web, in the existing npm workspace, with shared ui, i18n, contracts, and api-client packages. Both use one Node.js API and PostgreSQL database; native mobile is later. This structure is approved.
- One business, with separate studio and café financial units; Spanish first, English supported.
- The proposed module boundaries below organize requirements, not separate deployed services. They can live within the existing application.
- Audit history, permission enforcement, and bilingual behavior apply throughout the modules that use them.
- Payment provider, authentication approach, and unresolved business details remain open until their specifications address them.

## Approved modules

Dependencies mean a consumer relies on a provider's contract. Provider modules must not import their consumers. Specs will define the contracts, atomic operations, and financial event handling before implementation.

| Module id | Responsibility | Depends on | Future spec file |
| --- | --- | --- | --- |
| foundation | Business settings, studio/café identifiers, Spanish/English conventions, responsive shared components, audit-record contract | — | SPEC-foundation.md |
| identity | Customer and staff accounts, roles, permissions, family membership and departure policy | foundation | SPEC-identity.md |
| studio-catalog | Disciplines, class descriptions/media, instructors, schedules, capacity, single-class and package offers | identity | SPEC-studio-catalog.md |
| payments | Separate payment-account configuration, online and recorded in-person payments, payment status and reconciliation contracts | identity | SPEC-payments.md |
| credits-bookings | Purchased and complimentary credits, family pools, renewal/expiry, booking/cancellation, attendance/completion, private demand feedback | studio-catalog, payments | SPEC-credits-bookings.md |
| instructor-payroll | Assigned percentages, earnings from consumed credit values and completed sessions, payroll periods, payment records and acknowledgments | credits-bookings | SPEC-instructor-payroll.md |
| cafe-sales | Catalog, prices, same-sale combos, orders, sales and payment records | payments | SPEC-cafe-sales.md |
| financial-reporting | Separate studio/café financial views, expense records and reporting scope, restricted payroll visibility | instructor-payroll, cafe-sales | SPEC-financial-reporting.md |
| public-home | Public starting page, studio/café presentation, language switch, navigation to schedules, purchases and account access | studio-catalog, cafe-sales | SPEC-public-home.md |

## Approved boundary decisions

- Keep credits, bookings, and attendance in one module: reservations and cancellations change credit availability, while family departures must preserve reserved credits. This avoids separate modules each depending on the other.
- Identity owns who belongs to a family. Credits/bookings owns credit ownership and disposition when membership changes; it coordinates the departure through identity's contract. Identity does not read credit balances.
- Payments handles monetary transactions, not class prices or credit allocation. Studio and café consumers supply authoritative purchase details and apply confirmed outcomes using its contract. Repeated payment notifications must not create duplicate credits or sales.
- Instructor payroll consumes completed-session and consumed-credit facts; it does not recalculate credit value from today's catalog price. Attendance corrections require an explicit correction contract in the relevant specs.
- Public-home owns public presentation; operational customer/staff/instructor screens are specified with their corresponding modules. Its placement does not delay agreeing on visual direction or bilingual navigation.
- Financial reporting consumes operational records; operational modules do not depend on report calculations.

## Approved specification/build order

1. foundation → identity
2. studio-catalog and payments
3. credits-bookings → instructor-payroll (priority path for the owner's biggest pain point)
4. cafe-sales (can follow payments independently of the studio path)
5. financial-reporting and public-home once their respective providers are available

All modules are in first-release scope. This ordering is a dependency outline, not a commitment to parallel work or a detailed task plan. Public-home design can be discussed earlier while implementation waits for its data providers.

## Approval and next step

The map is approved. [SPEC-foundation.md](SPEC-foundation.md) is implemented and technically verified. [SPEC-identity.md](SPEC-identity.md) is now a draft, including development fixtures and the newly confirmed account-management permissions; its open policy questions and approval remain outstanding. Other listed specs have not been written. Plans and implementation follow their own review gates.

Deferred scope remains unchanged: ingredient inventory, waitlists, mixed studio/café packages, multiple independent businesses, automated instructor payouts, and the shared time-slot demand view.
