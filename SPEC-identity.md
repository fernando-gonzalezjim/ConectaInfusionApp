# Spec: Identity and access

Module id: `identity`. Dependency: `foundation`.
Status: draft started October 1, 2026; product questions below remain open. No authentication code or accounts have been created by this specification.
Sources: [capability map](CAPABILITY-MAP.md), [business rules](docs/requirements/agreed-business-rules.md) / [reglas de negocio](docs/requirements/agreed-business-rules.es.md), [Foundation](SPEC-foundation.md).

## Objective and scope

Give customers and personnel individual accounts, authenticated sessions and server-enforced access to their own or explicitly authorized records. Customer self-registration includes email confirmation. Management can administer instructors; staff can create customers and edit their own personal details. Both frontends keep Spanish primary and English available.

Identity owns accounts, roles, permissions, family membership and its membership-change interface. Instructor catalog/media/schedules remain studio-catalog responsibilities; percentages belong to their authorized domain workflow. Credit disposition and reservations remain credits-bookings responsibilities. Account/profile administration must not introduce those financial workflows or erase their future history.

Confirmed staff attendance benefit: all staff and instructors may book any class for free. At capacity, a paying customer can still book by automatically replacing the most recently made eligible complimentary staff/instructor reservation, with a notification to the displaced person; earlier complimentary reservations retain priority. Identity supplies active staff/instructor eligibility; credits-bookings owns complimentary booking, capacity priority and displacement. Notification delivery, timestamp tie-breaking and payroll consequences require their owning specifications. This benefit does not require staff to purchase a customer package; the precise account/role representation remains a technical design decision.

## Confirmed account permissions

| Action | Admin/management | Staff without management role | Customer |
| --- | --- | --- | --- |
| Create instructor | Allowed | Denied | Denied |
| Update another instructor | Allowed | Denied | Denied |
| Delete another instructor | Allowed | Denied | Denied |
| Create, edit or deactivate another non-instructor staff account | Allowed | Denied | Denied |
| Update own personal profile | Allowed | Allowed | Allowed |
| Create customer via email invitation | Allowed | Allowed, including instructors | Self-registration with email confirmation |
| Delete another customer | Allowed | Denied | Denied |
| Delete own customer account | Allowed when acting as that customer | Allowed when acting as that customer | Allowed |
| Update another customer's personal details | Allowed | Denied, including customers they created | Denied |
| Change own role/permissions/pay rate through profile editing | Denied | Denied | Denied |

Owner/admin/manager retain their previously agreed operational authority; exact role assignment and protection of the last administrative account still need specification. An instructor's self-profile update is distinct from administering another instructor. Instructors are explicitly allowed to create customers through email invitations; this grants no additional permission to edit or deactivate those customers.

Apply authorization in the API for every operation and target identifier, regardless of which frontend sends it. Hiding a control is not authorization. Reject mass-assignment of roles, verification status, pay rates or ownership identifiers. Sensitive account mutations and audit events commit together. Never put password hashes, passwords, sessions or confirmation/reset tokens in audit payloads.

## Development-only accounts

Requested fixtures:

| Login | Password | Proposed role |
| --- | --- | --- |
| admin | admin | Administrator |
| testuser | testuser | Customer |

These are intentionally public local test credentials, not production bootstrap credentials. Implement them through an explicit seed command only after the specification/plan is approved. The command must require both development environment and a separate fixture opt-in, reject production/staging/unknown environments, and target a clearly identified local/disposable database. It must never run from migrations, normal startup or production deployment.

Store fixture passwords through the same password-hashing path as other accounts. Repeated seeding must not overwrite a real account or reset an existing account's credentials/roles. Production must reject development-fixture identities even if a development database was accidentally copied. Any shorter-password exception is limited to these fixtures and cannot be used by public registration.

Proposed fixture email addresses are admin@conecta.example.test and testuser@conecta.example.test; confirmation can be explicitly seeded for these local identities only. Normal registration still requires confirmation. Username login for the two fixtures must work as requested; whether normal users log in by email only or by username/email is an open product choice.

## Proposed authentication flows (review required)

- Customer registers with personal details, email and password. Server assigns only the customer role. Pending accounts have no operational access until email confirmation.
- Confirmation links are time-limited and single-use; resend is throttled. Email comparison/uniqueness rules apply consistently to registration, invitations, login, recovery and email changes. A duplicate email must not attach an account to someone else's customer history.
- Confirmed: customers created by admin/management or staff must supply an email and receive an invitation to confirm it and set their own password. Personnel never assigns or sees the password. This flow does not support customer records without email. Account access remains pending until invitation completion; delivery provider, expiry and resend details still need specification.
- Include login, logout, current-account retrieval and password recovery. Proposed web transport is an opaque server-managed session in an HttpOnly cookie, Secure on HTTPS, with explicit SameSite/CSRF and origin rules for both frontends. Session lifetime and cross-frontend login sharing are decisions for this spec/plan, not implicit browser behavior.
- Passwords use an adaptive salted hash, with Argon2id as the proposed choice; select a maintained Node-compatible implementation and parameters during planning. Do not use the development passwords to set the normal password policy.
- Login/confirmation/recovery need rate limits and responses that do not expose account existence. Email changes require confirmation of the new address; password reset, disabling and privilege changes must invalidate affected sessions.
- Spanish/English labels and emails, understandable validation errors, keyboard access, focus management and existing branded shared components apply to every account screen.

Security references: [OWASP password storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html), [authentication](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html), [sessions](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html), [email verification](https://cheatsheetseries.owasp.org/cheatsheets/Email_Validation_and_Verification_Cheat_Sheet.html). These guide implementation safeguards; they do not establish product permissions.

## Deletion and family boundaries

Customer self-deletion and management deletion rights are confirmed. The user confirmed deletion means revoke access and deactivate the profile while preserving booking, payment and audit history. No hard-delete or anonymization timeline is approved. Proposed safeguard: require recent authentication for self-deletion and explicit confirmation for account-deactivation actions.

Future bookings, unused/reserved credits, outstanding instructor pay and family membership need explicit handling before deleting an account with those obligations. Do not silently cancel bookings, consume credits, transfer balances, settle pay, or drop historical foreign-key targets. Retention/privacy policy is a separate unresolved decision; deactivation is not a claim that all personal data has been erased.

Keep the approved family rules: individual logins, automatic sharing while in a family, withdrawal limited to the departing purchaser's unused/unreserved credits, optional donation, and reservation preservation. Identity supplies membership facts and a transactional membership-change interface; credits-bookings coordinates financial disposition without a reverse dependency from Identity. Invitation authority, acceptance, minors, last-member closure and how deletion triggers departure remain open. Do not ship an uncoordinated leave/delete route that will break these rules.

## Commands and structure

Existing verification commands from the root:

```powershell
npm run typecheck
npm run build
npm test
npm run test:integration
npm run test:e2e -- --project=chromium
```

Local infrastructure: npm run db:up, npm run db:migrate, npm run dev. Docker and Chromium are required for integration tests. A development-account seed command and local email-delivery setup will be defined in the approved plan; neither exists yet. No real-user account creation or email sending is authorized by drafting this document.

Expected locations:

- apps/api/src/modules/identity: identity services, validation, authorization and session/email adapters.
- database/migrations: new forward migrations after V2; preserve existing members/instructors and audit references.
- apps/customer-web/src: registration, confirmation, login, recovery and own-account screens.
- apps/management-web/src: staff login/profile and authorized account administration.
- packages/contracts and packages/api-client: public DTOs and transport, excluding credentials from returned models.
- packages/i18n and packages/ui: reusable bilingual labels and accessible controls.
- apps/api/test and tests/integration: denial/ownership, session and real-PostgreSQL transaction tests; tests/e2e for controlled UI behavior.

Follow existing TypeScript, single-quoted imports, explicit exported types and parameterized PostgreSQL queries. Illustrative boundary only, not implementation:

```typescript
export interface IdentityActor {
  accountId: string;
  roles: readonly string[];
}
// Resolve the actor from the verified server session, never a request-body actorId.
```

## Acceptance scenarios

1. Explicit local fixture seeding creates the two requested logins with the approved roles. Repetition does not duplicate or overwrite accounts; non-development seeding and fixture login are rejected.
2. Self-registration creates only an unconfirmed customer; confirmation succeeds once, rejects expired/reused links and grants no staff role.
3. Admin/management can administer another instructor. Ordinary staff/customer direct API attempts are denied, including altered target IDs and forged role fields.
4. Staff can create a customer and edit their own allowed personal fields, but cannot delete a customer or edit another customer/staff/instructor profile. This denial also applies to customer records they created. Only admin/management may create, edit or deactivate other non-instructor staff accounts; test denials for ordinary staff and customers through direct API calls. Admin/management may edit another customer's allowed personal fields; profile editing never grants role or credential control.
5. Customers can edit/delete only themselves. A forged account ID or privileged profile field does not broaden access.
6. Personnel-created customers require email. Test successful invitations from admin/management, reception, café staff and instructors. An invitation lets the customer confirm the address and choose their own password before account access is enabled. Missing email is rejected; personnel cannot assign the password, bypass confirmation or expose existing private records. Instructor invitation rights do not permit subsequent profile edits or deactivation.
7. Logout, password reset, account disablement and role changes invalidate sessions as specified; session/CSRF boundaries are tested across both origins.
8. Account mutations and sanitized audit history are atomic. Deletion preserves references or follows the separately approved resolution policy; no hidden credit/booking changes occur.
9. Both languages and all three Foundation viewports pass account-flow keyboard, validation, loading, error and retry checks.
10. Multi-role and family behavior follows the final decisions below. Family-credit integration must be verified again when credits-bookings is implemented.

No numeric coverage threshold is invented. Use Node unit tests, isolated PostgreSQL integration tests and real Chromium flows; assert permission denials at the API, not just absent buttons.

## Boundaries and decisions still needed

Always: enforce permissions server-side; use trusted actor context; preserve domain history; audit authorized changes; keep English/Spanish rules synchronized; use new Flyway migrations.

Ask before: unresolved account/deletion/family policy, production bootstrap, real user invitations/email delivery, changing module boundaries, or advancing this draft to implementation without its spec and plan approval.

Never: install known development credentials in production, allow self-promotion, expose raw secrets in logs/audits, erase financial history as a side effect, or regenerate the business-rule PDF without request.

Open decisions, in priority order:

1. Deactivation with history preservation is confirmed; define handling of remaining obligations separately.
2. Confirm testuser is a customer and choose the normal login identifier. Personnel-created customers require email and invitation-based confirmation/password setup; provider, expiry and resend details remain open.
3. Who assigns roles, including privileged roles? Customer creation by email invitation explicitly includes instructors. Management of other non-instructor staff accounts and editing another customer's personal details are confirmed as admin/management only; staff may still edit their own personal details.
4. Staff/instructors have free class-booking eligibility, with displacement and notification when classes fill. Specify account/role representation and access to the booking interface without requiring a paid customer profile. Separate handling of a person's existing customer history or family membership remains unresolved; the staff benefit does not silently transfer or erase it.
5. Family invitation rights, minors, acceptance, and closing a family, including previously donated credits.
6. Editable personal fields, verification/recovery/session expiry policy, local email testing and production mail provider; audit retention/viewers.

The next artifact after specification approval is the Identity implementation plan and tasks. Preserve the completed Foundation evidence rather than overwrite it.
