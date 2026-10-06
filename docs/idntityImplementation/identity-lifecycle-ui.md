# Identity lifecycle screens

I38 connects the [account deactivation](identity-deactivation.md) and [reactivation](identity-reactivation.md) APIs to the customer and management applications. The controls reuse existing brand tokens, responsive dialogs, keyboard focus handling and Spanish/English translations.

## Customer account access

Sign in to the customer app and open **Account access / Acceso de la cuenta**. Select what happens to your own unused, unreserved credits; no disposition is selected automatically. For a dependent with no other eligible guardian, either arrange an accepted replacement through the existing guardian invitation screen or explicitly select joint deactivation. Dependents with another eligible guardian remain active.

Review deactivation before confirming. Changing a choice clears the previous preview and confirmation. A ready preview permits an explicit confirmation; a blocked preview keeps deactivation disabled. Recent authentication may require signing out and in again. Historical accounts, relationships and financial references remain preserved.

**Default composition still blocks deactivation.** Booking/credit, teaching and payroll success coordinators have not been implemented. The screen accurately reports this boundary and applies no partial change. A ready response is exercised only with controlled trusted test composition; it is never supplied by a demo flag or browser setting.

If a management execution response is uncertain, its retry preserves the exact original choices, revision and idempotency key. No automatic mutation retry occurs. Self-deactivation revokes its session, so an uncertain self result directs the person to check access with a new sign-in rather than retry through an old session. A stale conflict requires fresh review.

## Management access restoration

Administrators and managers can open **Account access** from the account list, including inactive accounts. The screen reads the current account version and requires explicit confirmation to restore access. Stale reads conflict; refresh before retrying. Restoration retains email/password confirmation requirements and does not recreate family or guardian relationships, cancelled bookings or expired credits.

The management **Restore dependent access / Restaurar acceso de dependientes** dialog lists inactive dependent profiles in bounded pages. It shows immediately prior guardians from the latest deactivation snapshot, eligibility and currently accepted renewal evidence. It does not expose email tokens or manufacture consent.

Send a fresh renewal to an eligible prior guardian. The seven-day local inbox action lets the authenticated recipient review and explicitly accept. The URL fragment is removed immediately and the token stays only in memory. Acceptance records consent while the dependent remains inactive. Management refreshes, selects the dependent again, explicitly confirms and restores it with the accepted guardian. Only that new authorization becomes active. If every prior guardian is ineligible, restoration remains unavailable. Removed or unrelated guardians cannot qualify.

Resending is subject to the existing 60-second cooldown and five sends per hour/recipient; it replaces the previous pending link. Issuer/recipient version, role, status and email changes can invalidate consent before completion. Both the read and mutation services check current bindings; reads are advisory, never authorization credentials.

## Family and standalone dependent limits

Family screens display unavailable **Leave family / Salir de la familia** and **Close family / Cerrar familia** controls with the missing financial coordination explained. They issue no lifecycle request and change no memberships or credits. Existing invitations and responsibility offers remain usable. No public family success route or financial adapter is invented by I38.

There is no standalone dependent-deactivation endpoint in the current implementation. Supported joint choices appear in the account workflow; guardian removal and independent-account transition retain their existing screens and consent requirements.

## Read contracts and manual data

All new reads return `Cache-Control: no-store`, require an authorized current session and enforce the existing Origin boundary:

- `GET /api/v1/accounts/:id/lifecycle`: management or the owning customer; current account status/version and at most 100 active guarded dependent choices.
- `GET /api/v1/dependents/reactivation-candidates?limit=25&cursor=UUID`: management only; bounded inactive profile page.
- `GET /api/v1/dependents/:id/reactivation/state`: management only; latest sequence and at most 100 prior guardian choices with safe acceptance references.

No new demo seed rows are necessary. I37's **Demo Inactive Dependent** and customer18 prior guardian support renewal testing; the existing customers, managers, families and guardians support blocked previews and relationship checks. Reseeding preserves manual restoration and does not recreate consent. Use the local inbox configured in [development setup](../development-demo.md); never reset data merely to retry a screen.

Verification covers real PostgreSQL authorization, malformed client contracts, bilingual responsive dialogs, keyboard return focus, axe accessibility, exact uncertain retry intent, disabled family controls and real inbox wrong-recipient/acceptance/finalization. See [recorded results](identity-verification.md). Business rules and PDF snapshots remain unchanged.
