# Conecta Infusion: agreed business rules

Status: confirmed interview decisions, recorded October 1, 2026.
Parent document: [confirmed product intent](../intent/conecta-infusion.md).
Language: **English** | [Español](agreed-business-rules.es.md).

Keep both versions equivalent and update them in the same change. Preserve numbering, examples, exceptions, and open questions; neither translation introduces new decisions.

These are requirements for future implementation. Examples illustrate the rules; they are not a full catalog or evidence that functionality already exists. Later explicit corrections in the interview replace earlier assumptions.

## 1. Studio, language, and settings

- The studio supports multiple disciplines, including yoga, ballet, functional training, and K-pop.
- Management creates customer-facing class information, including descriptions, photos, and videos, and manages schedules.
- Spanish is the primary app language; English is supported from the start.
- Initial operation is in Mexico using MXN. Country/currency settings should allow future configuration; actual provider/country support must be assessed separately.
- Initial class capacity is 16, stored in app settings and changeable by management. Per-session overrides and the effect on already scheduled classes still need specification.
- Initial single-class price is 150 MXN and is editable by authorized management.
- Public home page, navigation, visual style, and responsive layouts will be specified next.

## 2. Financial separation and payment collection

- Studio and café sales, expenses, and financial reporting are tracked separately.
- Each side has a separately configurable payment account. Both may initially point to the same account and later operate independently.
- Customers can pay online or in person. Start with one online provider rather than three integrations.
- Mercado Pago Checkout Pro is the working recommendation, not a finalized provider decision. PayPal and direct card acceptance were discussed as alternatives.
- Customers without valid credits can browse schedules but cannot reserve without purchasing a single class or package.
- For in-person payment, staff records payment and makes the corresponding credits available before a booking is made. The earlier idea of reserving first and paying later was superseded by this credit requirement.
- Expense-entry workflows, financial report detail, refunds, taxes, and payment settlement/reconciliation are not yet specified.

## 3. Packages, credit value, expiration, and selection

- A class credit can be used for any discipline; packages are not discipline-restricted.
- Packages provide discounted per-class values. Each credit retains its original purchase value for instructor-pay calculations, including when shared or extended.
- The entry/test package is **three classes for the price of two**. This corrects the early three-for-one example.
- Credits expire after 30 days.
- Buying a qualifying package, meaning any package other than the entry/test package, combines still-valid remaining credits with new credits and gives the combined balance a new 30-day expiration from the purchase date.
- Purchasing the entry/test package does not extend existing credits.
- Expired credits do not automatically carry forward. Staff may restore them manually.
- Renewal changes expiration, not the original monetary value of existing credits.
- Booking uses the credit that expires soonest. If expiration dates match, use the oldest purchased credit first.
- Credits must remain valid on the date of the booked class, not merely on the booking date.
- Booking reserves the credit; attendance, late cancellation, or no-show consumes it according to the rules below.

## 4. Booking, cancellation, and capacity

- All staff and instructors may attend any class for free and may reserve a place. Their complimentary reservations can be displaced when the class fills; the affected person must receive a notification.
- When a class is at capacity but includes a complimentary staff/instructor reservation, a paying customer may still book and automatically replace one such reservation. Notify the displaced person. Paid attendance includes bookings backed by purchased package credits, not just single-class purchases.
- If several complimentary staff/instructor reservations can be replaced, displace the most recently made reservation first, preserving earlier reservations' priority.
- Specify notification delivery and deterministic handling of identical reservation timestamps in credits-bookings. Also specify whether these complimentary reservations affect instructor earnings; do not infer a paid-credit value from free attendance.

- Customers can book and cancel in the first release.
- Cancellation at least two hours before the class releases the reserved credit without consuming it.
- Cancellation less than two hours before the class consumes the credit. No-shows also consume a credit.
- Special exceptions are handled through manual staff credit adjustments.
- A class with no available place and no replaceable complimentary staff/instructor reservation remains visible and is marked Full / Llena; new bookings are disabled. At-capacity classes with a replaceable complimentary reservation must still allow the paying-customer booking described above; their display wording belongs in the booking specification.
- No waitlist is required for the first release. A cancellation that frees a place allows another booking.
- Customers can leave private feedback for staff requesting additional sessions for a full class.
- A later feature may show time slots selected by other members. Its audience and detailed mechanics remain open; see [issue #1](https://github.com/LFGJ-personal/ConectaInfusionApp/issues/1).

## 5. Family sharing and leaving a family

- Each family member has their own login and can book using the shared family credit pool.
- While a customer belongs to a family, sharing is automatic. To stop sharing, they must leave the family.
- Credits retain purchaser identity, original value, and expiration.
- A departing member can withdraw only their own unused, unreserved credits or choose to leave them with the family. They cannot withdraw another purchaser's credits.
- Remaining members retain the family pool, subject to the departing purchaser's choice.
- If no family members remain, credits return to their purchasers. The handling of credits previously deliberately left behind needs a precise specification.
- Existing bookings remain valid after departure. Reserved credits remain attached to those bookings and cannot be withdrawn immediately.
- If such a booking is later cancelled on time, its released credit returns to the departed purchaser if they chose to take their credits; otherwise it stays in the family pool.
- A released credit preserves its original monetary value and expiration date. Leaving a family or cancelling does not reset expiration.

## 6. Manual adjustments and audit history

- All staff members may adjust customer credits, including restoring expired credits and granting exceptions.
- Restoring a purchased credit preserves its original monetary value for instructor pay.
- When granting a complimentary credit, staff specifies the value to use for instructor pay even though the customer paid nothing.
- Credit adjustments record the actor, time, change, amount, and reason in the transaction/audit history.
- Staff actions must be traceable: who performed the action, when, and what changed. Attendance/session corrections and payment records are included.
- Specific retention periods and audit storage design remain for specification.

## 7. Instructor earnings and attendance

- Owners, managers, or admins assign each instructor a percentage based on experience, certifications, and their agreement. Current percentages are 40%, 50%, or 60%.
- Instructor pay is calculated separately for each consumed customer credit at its own monetary value, then summed. A session does not have one flat payout independent of attendees.
- The instructor's percentage does not change with attendance count; total earnings do.
- Example: credits valued at 150 + 150 + 120 + 135 + 135 MXN total 690 MXN. At 50%, instructor earnings for that session are 345 MXN.
- If the class takes place, consumed credits for attendees, late cancellations, and no-shows generate instructor earnings.
- Timely cancellations generate no instructor earnings.
- Both instructors and management can record attendance and mark a session complete.
- Management can correct attendance and completion records. Changes are audited.
- Earnings must remain explainable through the underlying credits and their values, rather than recalculating all attendees at the current single-class price.

## 8. Payroll and payment acknowledgment

- Payroll is twice monthly, on the 15th and the last day of the month, not every 14 days.
- The app calculates amounts owed; management pays instructors outside the app using its usual payment method.
- Management records amount, payment date, and method. The instructor acknowledges receipt through their own login.
- Payment recording and acknowledgment are timestamped and retained in history, replacing reliance on WhatsApp as the only confirmation record.
- Instructors can see their own earnings and payment history, including payment details and acknowledgment status.
- Automated instructor payouts are out of scope; no future implementation is promised.
- Period cutoff times, locking/approval, rounding, and corrections after payment need specification.

## 9. Permissions and visibility

| Role or audience | Confirmed permissions and visibility |
| --- | --- |
| Owner / admin / manager | Change prices, assign instructor percentages, view both business finances and all payroll, record instructor payments, and correct attendance/session records |
| All staff | Adjust credits with an audit record; other permissions depend on operational role |
| Reception / café staff | Access the bookings, payments, or café sales needed for their daily duties; not full financial reports or everyone's payroll |
| Instructor | Assigned classes, attendance and completion, own earnings, own pay history, and acknowledgment of received payments; no other instructor's private earnings |
| Customer | Own bookings and relevant account information, shared family credit balance when applicable; no staff financial information |

### 9.1. Account and profile management

- Only admins/management may create, update, or delete other instructors.
- Only admins/management may create, edit, or deactivate other non-instructor staff accounts. Staff retain permission to update their own personal details, without changing their roles or permissions.
- Staff may update their own personal profile only; this does not authorize changing their own role, permissions, or instructor pay percentage.
- Admins/management and staff, including instructors, may create customers through the email-invitation flow. Instructors receive no additional permission to edit or deactivate those customers.
- A customer created by admins/management or staff must provide an email address and receive an invitation to confirm it and set their own password. Creating customer records without email is not supported by this flow; personnel do not assign the customer's password.
- Only admins/management may delete another customer's account; staff may not delete customers.
- Customers may register themselves with email confirmation, update their own personal details, and delete their own account.
- Only admins/management may edit another customer's personal details. Ordinary staff may create customers but edit only their own personal profile; customer-creation permission does not authorize later edits to that customer's profile.
- These account permissions do not broaden operational access to finances, credits, or other users' private records.
- Deleting a customer or instructor means deactivating access while preserving booking, payment, and audit history; it does not mean physically erasing those records.
- Handling of future bookings, remaining credits, and family membership during deactivation must be specified separately. No automatic cancellation, credit forfeiture, or transfer is implied.

The remaining permission matrix, role-assignment authority, multi-role users, and family invitation rights remain for specification. This table must not be interpreted as granting all staff unrestricted financial access.

## 10. Café

- Management maintains the catalog, prices, and discounted packages/combos.
- Café packages are discounts on items purchased together in the same sale, not prepaid credits redeemable over multiple visits.
- Staff records sales and payments so café financial history exists from the first release.
- Only owners, admins, and managers can change prices; café staff can perform their authorized sales operations.
- Ingredient inventory comes later.
- Packages combining café products and studio classes are a future possibility, outside the first release.

## 11. Details to resolve during specification

These questions do not invalidate the confirmed intent and should not be answered silently during implementation:

- Public home page content, visual identity, detailed screens, media management, and translation workflow.
- Authentication and invitation delivery/expiration details, handling of obligations during account deactivation, remaining profile-management permissions, family creation/invitations, minors, and how to handle previously donated family credits when a group closes. Customer self-registration requires email confirmation; personnel-created customers require an email invitation to confirm their address and set a password; deletion deactivates access while preserving history, as agreed in section 9.1.
- Exact 30-day timestamp calculation, timezone/cutoff behavior, and which credits are extended by purchases within a family, including already-reserved credits.
- Restored-credit expiry, late-cancellation exceptions, and a released credit whose original expiration has passed.
- Provider selection, account connection, payment confirmation/failure handling, refunds, and financial reconciliation.
- Booking horizon, schedule recurrence, instructor substitutions, studio-cancelled sessions, and whether a session with no attendees took place for payroll purposes.
- Package catalog, entry/test eligibility and repeat-purchase limits, and how package cost is apportioned across credits when amounts do not divide evenly.
- Effective dates of instructor percentage changes, rounding, payroll period boundaries, and adjustments after payroll has been acknowledged or paid.
- Expense entry/reporting depth and café sale correction/refund workflows.
- Deployment, accessibility criteria, numeric success measures, and eventual migration from the owner's other system.
