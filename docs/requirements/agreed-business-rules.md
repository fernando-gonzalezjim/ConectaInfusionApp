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
- Specify notification delivery and deterministic handling of identical reservation timestamps in credits-bookings.
- Free staff/instructor attendance generates no instructor pay because no paid credit is consumed. Do not assign a paid-credit value to this attendance benefit.

- Customers can book and cancel in the first release.
- Cancellation at least two hours before the class releases the reserved credit without consuming it.
- Cancellation less than two hours before the class consumes the credit. No-shows also consume a credit.
- Special exceptions are handled through manual staff credit adjustments.
- A class with no available place and no replaceable complimentary staff/instructor reservation remains visible and is marked Full / Llena; new bookings are disabled. At-capacity classes with a replaceable complimentary reservation must still allow the paying-customer booking described above; their display wording belongs in the booking specification.
- No waitlist is required for the first release. A cancellation that frees a place allows another booking.
- Customers can leave private feedback for staff requesting additional sessions for a full class.
- A later feature may show time slots selected by other members. Its audience and detailed mechanics remain open; see [issue #1](https://github.com/LFGJ-personal/ConectaInfusionApp/issues/1).

## 5. Family sharing and leaving a family

- When a member is removed from a family group, their own eligible unused/unreserved purchased credits return to their account unless they explicitly choose to leave them with the family. The person removing them cannot donate their credits on their behalf. Credits reserved for valid bookings remain attached, and credit value and expiration remain unchanged.

- Any active independent family member may invite another member; acceptance is required before joining. Members may leave voluntarily. Only the current group responsible person or admins/management may remove another member. Removal follows the existing credit-departure rules and is recorded in audit history; it does not grant authority over dependent guardianship.

- Parents can turn saved child details into a dependent profile while preserving linked booking history. An authorized guardian may request an independent account for the dependent. The dependent confirms their email and sets a password, then the transition completes automatically without admin/management approval. Independent accounts have no minimum age requirement. Preserve profile identity, booking history and family membership; end all guardian management access to the now-independent profile while retaining historical authorization records.

- Independent family members have their own login and can book using the shared family credit pool. Children may have a dependent profile without their own email or login; a parent manages the profile and books classes for them through the parent account. The booking identifies the child as attendee and the parent as the acting user.
- A dependent profile may have multiple authorized parents/guardians who can manage it and book for the child. A parent/guardian may also book a children's class (for example, Yoga Kids) directly through their own account without first creating a dependent profile. The attendee is still the child, not the booking parent/guardian. These bookings require the child's name and age so staff know who will attend. The customer can enter these details through simple text fields, save them to their account and reuse them for later bookings without creating a dependent profile. Later linking to a dependent profile preserves booking history.
- Customers may create their own family group and invite members. Every invitation requires acceptance before the person joins and shares credits. Admins/management may help manage the group; this assistance does not remove the acceptance requirement.
- An existing authorized parent/guardian may invite another guardian to a dependent profile. The invited guardian must accept before gaining access to manage the profile or book for that child. Admins/management may assist with these invitations; acceptance is still required. Family-group membership alone does not grant guardian access.
- Only admins/management may remove another guardian from a dependent profile. A guardian may remove themselves. Removal must leave at least one active authorized guardian for an active dependent; a pending invitation does not satisfy this requirement.
- When deleting their account, a guardian may transfer guardianship to someone who accepts first, or choose to deactivate both their account and the dependent profile, preserving history. This joint deactivation is an explicit exception because the dependent also becomes inactive. If another active authorized guardian remains, deleting one guardian account leaves the dependent active and preserves access for the remaining guardians. Joint guardian/dependent deactivation applies only when no other active authorized guardian remains.
- While a customer belongs to a family, sharing is automatic. To stop sharing, they must leave the family.
- Credits retain purchaser identity, original value, and expiration.
- A departing member can withdraw only their own unused, unreserved credits or choose to leave them with the family. They cannot withdraw another purchaser's credits.
- Remaining members retain the family pool, subject to the departing purchaser's choice.
- The family-group creator/current responsible member or admins/management may close the group. The creator loses closure permission on leaving and may select a remaining member as the new responsible person with closure authority. This changes group responsibility, not historical creator identity, credit ownership or dependent guardian authorization. A successor must accept before receiving responsibility and closure authority. Declining leaves the transfer incomplete; the creator may nominate someone else before leaving or leave without an accepted successor, losing closure permission. Until a successor accepts, admin/management may manage or close the group and the last remaining member may close it. Declining or awaiting acceptance does not change credits or bookings; actual departure follows the agreed credit rules. Closure, responsibility transfers and credit disposition are recorded in audit history.
- When a family group closes, including when no members remain, remaining unused/unreserved credits return to their original purchasers, including credits previously left with the group. Their monetary value and expiration stay unchanged; consumed or expired credits are not restored and no refund is issued. Credits reserved for valid bookings remain attached to those bookings.
- Existing bookings remain valid after departure. Reserved credits remain attached to those bookings and cannot be withdrawn immediately.
- If such a booking is later cancelled on time, its released credit returns to the departed purchaser if they chose to take their credits; otherwise it stays in the family pool.
- A released credit preserves its original monetary value and expiration date. Leaving a family or cancelling does not reset expiration.

## 6. Manual adjustments and audit history

- Preserve booking, payment, payroll and audit history after account deactivation. The first release does not automatically delete these records. Requests to erase or anonymize personal information are handled separately while preserving required financial records. Define production retention periods before launch; this decision does not establish a legal retention period or authorize indefinite retention of all personal information.

- Admins/management may view the full operational audit history. Customers and instructors may view only their own relevant transactions and payment history, not the full audit or other people's private records. Ordinary staff do not gain full audit access from their operational permissions; multi-role accounts retain the access authorized by their assigned roles.

- All staff members may adjust customer credits, including restoring expired credits and granting exceptions.
- Restoring a purchased credit preserves its original monetary value for instructor pay.
- When granting a complimentary credit, staff specifies the value to use for instructor pay even though the customer paid nothing.
- Credit adjustments record the actor, time, change, amount, and reason in the transaction/audit history.
- Staff actions must be traceable: who performed the action, when, and what changed. Attendance/session corrections and payment records are included.
- Specific retention periods and audit storage design remain for specification.

## 7. Instructor earnings and attendance

- Owners, managers, or admins assign each instructor a percentage based on experience, certifications, and their agreement. Current percentages are 40%, 50%, or 60%.
- Instructor pay is calculated separately for each consumed customer credit at its own monetary value, then summed. A session does not have one flat payout independent of attendees.
- Free attendance under the staff/instructor benefit contributes zero to instructor earnings and consumes no paid credit. This is distinct from staff-granted complimentary customer credits, whose instructor-pay value is explicitly assigned under section 6.
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

- When role removal ends staff/instructor free-attendance eligibility, cancel future complimentary attendance bookings without charging credits. Preserve paid customer bookings and customer access when the customer account remains active. Removing one role does not end free-attendance eligibility if another assigned role still grants it.

- Deactivating a staff/instructor account immediately ends login access and free staff booking eligibility. Management must reassign or explicitly cancel upcoming teaching sessions; account deactivation does not silently cancel those sessions. Earned instructor pay remains owed and recorded, and management may record payment after deactivation. Removing a staff/instructor role while keeping the customer account active preserves customer access; this is distinct from deactivating the entire account.

- Confirmation and initial password setup links expire after 24 hours; password recovery links after 1 hour; family, guardian and group-responsibility invitations after 7 days. All links are single-use. Resending invalidates the previous link, requires a 60-second wait and allows at most 5 sends per hour per recipient and purpose. Development uses a local email inbox; select the production email provider during implementation planning.

- One login works across customer and management frontends; assigned roles control access. Sessions expire after 7 days, or 30 days when Remember me is selected. Password reset, account deactivation and role changes end existing sessions. Users can sign out of all devices.

- All active accounts may recover their password through a secure, single-use email link. Password recovery does not reactivate a deactivated account. The link expiration and resend limits defined in this section apply.
- Only admins/management may reactivate a deactivated account. Reactivation preserves its history but does not restore expired credits or cancelled bookings; credit restoration still requires a separately audited manual adjustment.
- Reactivation does not automatically restore family membership or guardian authorization. A reactivated account must receive and accept a new invitation to rejoin a family or regain access as a dependent's guardian, following the existing invitation permissions. Historical membership and guardianship records remain preserved.
- Only admins/management may reactivate a dependent profile. Before reactivation, at least one guardian authorized for that dependent immediately before deactivation must have an active account and accept renewed authorization. If all those guardian accounts are deactivated, dependent reactivation is blocked. A new person with no qualifying prior guardianship cannot satisfy this requirement. Reactivation does not restore expired credits or cancelled bookings.

- Editable personal profile fields are name, phone, preferred language and profile photo, subject to the account-editing permissions below. Changing an email address requires confirmation of the new address; email changes are separate from ordinary profile edits and do not grant role or permission changes.

- Only admins/management may create, update, or delete other instructors.
- Only admins/management may create, edit, or deactivate other non-instructor staff accounts. Staff retain permission to update their own personal details, without changing their roles or permissions.
- Staff may update their own personal profile only; this does not authorize changing their own role, permissions, or instructor pay percentage.
- Only admins/management may assign or change account roles. Ordinary staff, instructors, and customers cannot change their own or another person's roles; customer registration and invitations cannot grant staff or management roles.
- The app must reject deactivation or role removal that would leave no active account with administrative/management access. This includes an admin/manager attempting the change on their own account.
- Admins/management and staff, including instructors, may create customers through the email-invitation flow. Instructors receive no additional permission to edit or deactivate those customers.
- All accounts sign in using an email address, including administrative and development test accounts.
- One email account may hold both staff/instructor and customer roles. Adding a staff/instructor role preserves existing customer history, credits and family membership. Staff/instructors can purchase café products as customers; their free class attendance benefit does not make café purchases free.
- Approved development accounts: admin@conecta.example.test with the administrator role and testuser@conecta.example.test with the customer role. These test accounts are development-only.
- Customer creation requires an email address. The normal personnel-created flow sends an invitation for email confirmation and password setup; creating customer records without email is not supported.
- An admin or manager may create an account without requiring email confirmation. This is an explicit exception to the invitation flow, not permission for ordinary staff or instructors to bypass verification.
- The first admin is created manually in the database and does not require email verification. An email address is still required for sign-in.
- Initial passwords matching the account name apply only to development test accounts: admin/admin and testuser/testuser. This rule does not apply to regular accounts, including accounts created by an admin or manager; they receive a secure, single-use email link to choose their own password, including when email confirmation is exempted. They must set their password before account access; this step does not add a separate email-confirmation requirement.
- Only admins/management may delete another customer's account; staff may not delete customers.
- Customers may register themselves with email confirmation, update their own personal details, and delete their own account.
- Only admins/management may edit another customer's personal details. Ordinary staff may create customers but edit only their own personal profile; customer-creation permission does not authorize later edits to that customer's profile.
- These account permissions do not broaden operational access to finances, credits, or other users' private records.
- Deleting a customer or instructor means deactivating access while preserving booking, payment, and audit history; it does not mean physically erasing those records.
- Deactivating a customer's account cancels that customer's future bookings using the normal two-hour cancellation rule: at least two hours before the class releases the reserved credit; less than two hours consumes it. Booking, payment and audit history are preserved. Remaining unused credits stay recorded until their normal expiration, without an automatic refund or validity extension. Family-held credits follow the agreed departure rules in section 5, including the purchaser choice to withdraw eligible credits or leave them with the group. During self-deactivation, the customer must explicitly choose to keep eligible purchased credits recorded on the inactive account or leave them with the family; keeping them generates no refund and preserves normal expiration. If management deactivates the account without a customer choice, eligible purchased credits stay recorded on the inactive account, without a refund or expiration change; they are not donated to the family. Credits reserved for still-valid bookings remain reserved. On group closure, remaining credits follow the return-to-original-purchaser rule in section 5, including previously donated credits. No additional forfeiture or unapproved balance transfer is implied. If a guardian deactivates but another active authorized guardian remains, the dependent stays active and their bookings remain valid, including bookings created by the departing guardian. If the dependent is also deactivated, their future bookings are cancelled under the same two-hour rule, preserving history.

The remaining permission matrix, safeguards for privileged role changes, technical representation of multiple roles, and detailed family-management operations remain for specification. This table must not be interpreted as granting all staff unrestricted financial access.

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
- Production email provider selection during planning, handling of obligations during account deactivation, remaining profile-management permissions, detailed family-management operations, dependent guardian permissions. Customer self-registration and the normal personnel-created invitation flow require email confirmation; admin/management-created accounts and the manually created first admin have the explicit exceptions in section 9.1. Deletion deactivates access while preserving history.
- Exact 30-day timestamp calculation, timezone/cutoff behavior, and which credits are extended by purchases within a family, including already-reserved credits.
- Restored-credit expiry, late-cancellation exceptions, and a released credit whose original expiration has passed.
- Provider selection, account connection, payment confirmation/failure handling, refunds, and financial reconciliation.
- Booking horizon, schedule recurrence, instructor substitutions, studio-cancelled sessions, and whether a session with no attendees took place for payroll purposes.
- Package catalog, entry/test eligibility and repeat-purchase limits, and how package cost is apportioned across credits when amounts do not divide evenly.
- Effective dates of instructor percentage changes, rounding, payroll period boundaries, and adjustments after payroll has been acknowledged or paid.
- Expense entry/reporting depth and café sale correction/refund workflows.
- Deployment, accessibility criteria, numeric success measures, and eventual migration from the owner's other system.
