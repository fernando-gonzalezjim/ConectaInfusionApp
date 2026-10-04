# Customer sign-in and account controls

I08 adds customer-web sign-in and own-account controls to the existing public header. It uses the approved [visual direction](design/visual-direction.md), shared `SignInForm`, Button/Input/Dialog components, bilingual i18n messages and the [I07 client/transport](identity-auth-transport.md). The public schedule/café view continues working independently of authentication. I09 supplies [management sign-in and server access checks](identity-management-login.md); registration, password recovery and profile editing remain later tasks.

## Interaction and states

Choose **Iniciar sesión / Sign in** to open the compact dialog. Email and password have persistent visible labels, native required/email validation and appropriate browser autocomplete hints. Remember me is optional and explains the fixed 7-day/30-day lifetimes. Approved short development-fixture passwords remain usable: the sign-in form does not impose the normal password-creation minimum.

While a request is pending, form fields and submission are disabled and the action reports its progress. Duplicate submissions are blocked both in the component and its controller. Credential errors preserve the email and Remember me choice but clear the password; the error receives focus and is announced. Generic localized messages cover unavailable service, throttling, expired sessions and forbidden mutations. Raw server messages are never rendered. Closing the dialog unmounts the form and clears its local credentials.

Successful sign-in closes the dialog and changes the header control to **Mi cuenta / My account**. The dialog displays only the signed-in person's name/email, with current-device and all-device logout controls. Failed logout retains the last-known account view and reports the failure; it never pretends the server revoked access. An unauthenticated mutation returns the interface to sign-in. The server remains authoritative for roles/status and every protected operation; cached display data grants no permission.

The component restores its session on mount and refreshes when the window regains focus or the document becomes visible. Requests are cancelled on unmount; background session reads cannot overwrite a newer mutation. No polling service, role assignment, account creation or extra backend route was added. Background infrastructure failure does not convert a known session into a successful logout. Identity-disabled/outage responses leave public browsing usable; sign-in attempts give the localized unavailable message.

## Accessibility and layout

The shared Radix dialog traps focus, supports Escape and restores focus to its trigger. The sign-in form begins at the email field, uses a native checkbox and allows ordinary keyboard submission. Controls and dialog content adapt to narrow screens and translated text; the dialog has a bounded height with internal scrolling. Existing semantic brand tokens supply colors, borders and focus outlines. No logo artwork or unrelated public-page redesign was introduced.

Chromium checks cover Spanish/English labels, keyboard order, required/email validation, pending/denial/outage/throttle states, password clearing, session revocation on focus, logout failure, no horizontal overflow at 320/360/768/1440 pixels and axe accessibility checks. Real disposable PostgreSQL browser scenarios sign in normal administrator/customer accounts through the form, verify 7/30-day persisted lifetimes, restore after reload, display own data and perform current/all-device logout. Test accounts exist only in the disposable database; the manual development bootstrap remains separate.

See [verification evidence](../tasks/identity-verification.md). The authorized changed-file Graphify refresh includes I07/I08 after implementation verification. Business rules and PDF snapshots remain unchanged. I09 now shares the account controller with management-web; its access section relies on server permission checks. Human review is required after I09 before I10.

References: [React effect cleanup](https://react.dev/reference/react/useEffect), [Radix Dialog accessibility](https://www.radix-ui.com/primitives/docs/components/dialog) and the [approved Identity plan](../tasks/identity-plan.md).
