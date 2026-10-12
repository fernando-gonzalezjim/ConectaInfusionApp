# Legacy studio reconciliation

C02 adds V15 without changing existing session IDs, titles, durations, instructors, capacities or booking rows. Legacy sessions receive `class_id=NULL`, `status=legacy`, `version=1`. They retain an instructor requirement and are not automatically published or adopted into a reusable class.

Catalog-owned sessions require a class link and 55-minute duration. Draft/cancelled catalog sessions can lack an instructor; published sessions cannot. Catalog class/discipline deletion is prevented while referenced. Later services supply authorization, publication, assignment and scheduling guards; these constraints do not claim those services are implemented.

Inspect the read-only `studio_legacy_session_reconciliation` view on an authorized database to review legacy session IDs, instructor/person links, original duration/capacity and historical booking counts. This view is not a public API; it contains operational identifiers. No automated name/email matching is authorized.

```sql
SELECT * FROM studio_legacy_session_reconciliation ORDER BY starts_at,id;
```

Adoption remains explicit management work after the appropriate workflow is implemented. Resolve incompatible durations and active conflicts deliberately without rewriting historical bookings. Applied V1-V14 migrations remain untouched; V15 runs transactionally through Flyway. Use isolated fresh/repeated/populated migration tests, never a development reset as a migration strategy.
