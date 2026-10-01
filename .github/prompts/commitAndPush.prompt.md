---
description: Review, validate, commit, and push the requested project changes.
agent: agent
---

Run the [commit-and-push workflow](../../.agents/skills/commit-and-push/SKILL.md) for this project.

Use any scope, commit message, branch, or remote supplied with this invocation. Otherwise infer the change scope from the completed task and use the current branch's upstream. Inspect and validate before committing, preserve unrelated work, and verify the push. This invocation authorizes the scoped commit and push; do not request duplicate confirmation when the destination is clear.
