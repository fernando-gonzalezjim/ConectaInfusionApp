# Agent instructions

Always use the OpenAI developer documentation MCP server when working with OpenAI APIs, Codex, Agents SDK, or other OpenAI developer products.

When the user invokes `/commitAndPush` or `$commit-and-push`, read and follow `.agents/skills/commit-and-push/SKILL.md`. Requests to create or edit that command do not invoke it.

Keep `docs/requirements/agreed-business-rules.md` (English) and `docs/requirements/agreed-business-rules.es.md` (Spanish) synchronized. Whenever business rules change, update both documents in the same change, regardless of which language was edited first. Preserve matching section numbers, meaning, examples, exceptions, and unresolved questions. Do not mark the work complete with a stale translation. Translate agreed changes without inventing new decisions; surface any ambiguity. Verify section coverage and local links before completing the update.

The PDF `docs/requirements/agreed-business-rules.es.pdf` is an on-demand snapshot. Regenerate or update it only when the user explicitly requests a PDF update or a new PDF version. Changes to the Markdown business rules do not require updating the PDF.
