# Agent instructions

Respond to the user in English, even when the user writes in Spanish. Write code, identifiers and technical documentation in English unless translation is not practical. Product-facing Spanish and explicitly requested Spanish documents remain Spanish; preserve the synchronized bilingual business rules.

Use the existing Graphify graph automatically when it helps investigate architecture, dependencies or change impact. Check relevant source files and the approved specification because the graph is a snapshot and may be incomplete. After meaningful changes to code relationships, API contracts, database schemas, architecture, specifications or business rules, remind the user to update Graphify and record that the graph may be stale. Do not rebuild it automatically or enable hooks unless authorized. Routine formatting, PDF exports and minor wording edits do not require a reminder.

Always use the OpenAI developer documentation MCP server when working with OpenAI APIs, Codex, Agents SDK, or other OpenAI developer products.

When the user invokes `/commitAndPush` or `$commit-and-push`, read and follow `.agents/skills/commit-and-push/SKILL.md`. Requests to create or edit that command do not invoke it.

Keep `docs/requirements/agreed-business-rules.md` (English) and `docs/requirements/agreed-business-rules.es.md` (Spanish) synchronized. Whenever business rules change, update both documents in the same change, regardless of which language was edited first. Preserve matching section numbers, meaning, examples, exceptions, and unresolved questions. Do not mark the work complete with a stale translation. Translate agreed changes without inventing new decisions; surface any ambiguity. Verify section coverage and local links before completing the update.

The PDF `docs/requirements/agreed-business-rules.es.pdf` is an on-demand snapshot. Regenerate or update it only when the user explicitly requests a PDF update or a new PDF version. Changes to the Markdown business rules do not require updating the PDF.

The same on-demand snapshot rule applies to `docs/requirements/resumen-permisos.es.pdf`. Update it only on explicit request; edits to the permissions summary Markdown do not trigger PDF regeneration.
