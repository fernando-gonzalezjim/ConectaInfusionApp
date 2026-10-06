# Operational audit history

Administrators and managers can open **View history** in the management app. Spanish is the default; switching language translates labels and formats dates in the configured studio timezone. History loads on demand, with 25 events per page, previous/next navigation, refresh and retry.

`GET /api/v1/audit` requires a current authorized session and the configured Origin. It accepts only `limit` (1–50, default 25) and an opaque cursor. Stable descending pagination uses the event timestamp, including PostgreSQL microseconds, and UUID as the tie breaker. Responses are private and `no-store`; other methods have no mutation endpoint. Role/session checks run again under database locks.

The response contains allowlisted actor/target references, recognized actions and sanitized before/after fields. Passwords, hashes, session/action tokens, arbitrary nested payloads, free-text reasons and correlation IDs are never returned. Unknown legacy actions use a generic label without raw payloads. Existing stored events are not rewritten. Display names come from the current referenced record; they are not historical name snapshots. This operational view does not replace customer transactions or instructor pay histories owned by their respective modules.

The existing demo account events cover pagination; I23 adds fictional family events. Run `npm run db:migrate:demo`, then `npm run db:seed:demo` and `npm run dev:demo`. Sign in at `http://localhost:5174` with `manager@demo.conecta.example.test` / `ConectaDemo!2026` and choose **Ver historial**. Ordinary customers, reception, café staff and instructors cannot read this history unless their account also has administrator/manager authorization.
