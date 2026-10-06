# Profile photos

I21 adds photo uploads to **My account → Edit my profile** in both apps and **View account** in management. Customers, instructors and staff can manage their own photo. Administrators and managers can also manage another account's photo. Other staff cannot read or change somebody else's photo through these endpoints. Photos do not change credentials, roles or session validity.

## Upload and storage contract

| Endpoint | Permission | Response |
| --- | --- | --- |
| `POST /api/v1/me/photo` | Current active session, exact Origin, session CSRF | Sanitized updated `AccountProfile` |
| `GET /api/v1/me/photo` | Current active session | Private static WebP |
| `POST /api/v1/accounts/:id/photo` | Own account or current admin/management authorization, exact Origin, session CSRF | Sanitized updated `AccountProfile` |
| `GET /api/v1/accounts/:id/photo` | Own account or current admin/management authorization | Private static WebP |

Upload JSON contains only `{ "data": "<canonical base64 image bytes>" }`. Filename, MIME declarations, paths, remote URLs, storage identifiers and extra fields are not accepted. The browser's file type selector is a convenience; server decoding decides whether the content is supported. The photo-specific JSON parser allows 7 MiB for base64 overhead; the decoded input is limited to 5 MiB and 16 million pixels. Origin and CSRF checks precede parsing. JPEG, PNG and WebP are accepted; animated/multipage images, APNG, SVG and malformed images are rejected. Native image decoding has at most two concurrent operations per process; overload fails safely without queueing unbounded work.

Images are automatically oriented and re-encoded to static WebP with dimensions no larger than 512×512, preserving aspect ratio without enlarging smaller images. Source EXIF, GPS, ICC, XMP and other metadata are discarded. This uses [Sharp's input controls](https://sharp.pixelplumbing.com/api-constructor/) and its [default metadata-removing output behavior](https://sharp.pixelplumbing.com/api-output/). Raw uploads are not retained. Binary responses use `image/webp`, `no-store` and `nosniff`; unauthenticated requests cannot read them. There is no public storage-ID route.

Set `IDENTITY_PHOTO_DIRECTORY` to an absolute private directory. The existing ignored `dev.env` is configured for `F:/Code/ConectaInfusionApp/.local/profile-photos`. Within the workspace, storage must be beneath `.local`; filesystem roots, public/build/dependency/config directories and symbolic-link storage roots are rejected. The service creates random UUID filenames exclusively and does not accept client paths. Vite's [filesystem deny settings](https://vite.dev/config/server-options#server-fs-deny) also block `.local` and `dev.env` in both apps, including `/@fs` requests. A missing storage setting makes photo operations unavailable while ordinary account/profile operations remain usable.

The account/photo reference and audit event commit under the same authorization and row locks used for personal profile edits. Upload authorization is checked before decoding and again before the reference changes. Failed writes or transactions remove their staged asset when ownership can be established. Successful replacement deletes the previous file after commit and after checking it is not referenced. If a commit response is uncertain, cleanup checks the database rather than risking deletion of a committed photo.

Temporary Windows `EPERM`/`EBUSY` deletion failures receive five bounded attempts. The API server also streams reconciliation on startup and every ten minutes, checking references in batches of 100. Only unreferenced UUID WebP files older than 24 hours are candidates; current references and recent staged uploads remain intact. Deletion rechecks ownership. Failures report only `PHOTO_CLEANUP_REQUIRED`, retaining files for a later sweep. Reads that race with replacement reauthorize and retry once when the old file disappears. Reconciliation timers stop during server shutdown.

This is a local filesystem implementation for one API process and its configured database. Production deployment still requires private directory permissions/Windows ACLs, durable backups, storage ownership, retention policy and monitoring of cleanup failures. Shared storage or multiple API instances require explicit staging coordination before deployment; the current grace period is not a distributed staging protocol. Referenced photos, including those on inactive accounts, follow the future approved retention policy rather than being silently deleted here. No production deployment or retention policy is introduced by I21.

## Manual demo

Run `npm run db:seed:demo`, then `npm run dev:demo`. Seeding creates the fictional upload fixture `.local/demo-profile.png` exclusively; reruns preserve it and existing account edits/photos. No extra customer account is needed: use the existing `customer.profile` account or any active demo personnel account from [demo setup](../development-demo.md).

1. Sign in, open **My account → Edit my profile**, choose `.local/demo-profile.png` and save the photo.
2. Check the preview, close/reopen or reload, then upload another supported image to replace it.
3. Sign in as the demo manager in the management app, open another account and upload its photo. Ordinary staff can only use their own profile editor.
4. Try an invalid image or one above 5 MiB; the existing photo should remain. While an upload is pending, profile controls and dialog dismissal are disabled. Uncertain network results require reopening the profile before another upload; POST requests are not automatically retried.

The guarded database reset clears database references, not arbitrary filesystem directories. Unreferenced stored photos become eligible for the reconciliation grace period. The synthetic upload fixture is reusable and preserved. Business rules and their Spanish translation are unchanged; PDF snapshots are unchanged. Graphify may be stale for these new storage, API, client, UI and development-fixture relationships; refresh incrementally when authorized.
