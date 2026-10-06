# Management sign-in and access

I09 reuses the customer frontend's account/session controls in management-web. Both use shared `AccountAccess`, `SignInForm`, dialogs, labels and the credentialed API client. Sign-in, Remember me, session restoration and current/all-device logout have the same behavior in both languages. Follow [local setup](identity-local-email.md) and [manual bootstrap](identity-bootstrap.md); Identity remains opt-in. This task does not provision a developer or production account.

## Permission boundary

Any valid account may sign in and view its own account. Only current administrators and managers can see the account-administration section. Reception, café staff, instructors and customers do not receive that capability; adding a customer role to an instructor does not grant it. Future staff tools may have different permissions and must authorize their own operations.

`GET /api/v1/management/access` resolves the opaque session cookie against PostgreSQL, checking account/person status, expiry, revocation, session version and current roles. It returns a whitelisted own account plus `{ capabilities: { administerIdentity: true } }`. Invalid sessions return 401, insufficient roles 403 and persistence failures a sanitized 503. Responses are no-store. The route shares the exact Origin guard and credentialed CORS from [authenticated transport](identity-auth-transport.md). It is read-only and requires no mutation CSRF token. Supplied account IDs, roles and headers cannot change authority.

The UI requests this endpoint rather than deriving permission from cached account roles. Loading, denial and unavailable states expose no administrative section; an unavailable check offers retry. A failed session refresh clears parent access, and permission results must match the currently displayed account. This is a permission summary, not an account-administration feature: account creation, editing, role assignment and lifecycle commands remain later tasks. Every future protected command still needs its own server guard and target checks.

## Shared browser session

On localhost, the host-only HttpOnly cookie is shared across ports 5173 and 5174. Signing in through either frontend restores the same session in the other. Logout revokes the server session; the other frontend observes that change on reload or focus/visibility refresh. No authentication material is stored in application local/session storage. Existing public Foundation settings and browsing remain usable independently of sign-in.

## Verification and handoff

See [verification evidence](identity-verification.md) for workspace checks, real PostgreSQL actor denials, controlled accessibility scenarios and actual cross-frontend form login/logout. Fixtures use only the disposable database. No new migration or dependency is needed.

The approved plan requires human review after I09 before I10. Graphify currently covers I01–I08; an incremental refresh is needed for these I09 changes and will run only when authorized. Business-rule Markdown and PDF snapshots are unchanged.
