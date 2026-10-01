---
name: commit-and-push
description: Review, validate, stage, commit, and push the requested project changes when the user asks to commit and push or invokes /commitAndPush. Creating or editing this workflow does not authorize running it.
---

# Commit and push

Treat a request to run this workflow as authorization to commit and push the requested changes. Do not ask for duplicate confirmation when scope and destination are clear. Honor environment-required approvals.

## Inspect and select

- Read the applicable AGENTS.md. Use local Git for staging, committing, and pushing so the actual working tree and index are preserved.
- Inspect repository status, current branch, staged and unstaged diffs, untracked paths, recent commit style, and upstream configuration. Do not print embedded credentials from remote URLs.
- If no Git repository exists, stop and explain that initialization and a remote are needed; do not create a remote repository automatically.
- Select changes covered by the user's request or completed task. For an explicit request to commit all changes, review all of them. Preserve unrelated work and staging; if existing staged changes make the commit scope ambiguous, ask before changing the index.
- Exclude secrets, real .env files, dependency folders, build output, logs, and local database files. Sanitized examples and lockfiles may be included. Report suspicious secrets by path without reproducing their values.

## Validate and commit

- Review the selected diff for obvious defects and accidental changes. For application code in this project, run the relevant checks from package.json, normally npm run typecheck, npm run build, and npm test. Documentation-only changes need link/content checks, not a full app build.
- Reuse checks already completed for the same unchanged content. If a required check fails, resolve task-related failures or report the blocker. Do not disable checks, skip hooks, or claim unavailable database integration tests passed.
- Stage explicit reviewed paths or hunks. Review git diff --cached and git diff --cached --check before committing. Ensure no unrelated previously staged content is included.
- Use a concise message explaining the change, following repository conventions; use a Conventional Commit when there is no established convention. Preserve a message supplied by the user. Use a message file for multiline text to avoid shell quoting problems.
- If there are no changes, do not create an empty commit. Continue only if there are existing unpushed commits within the requested scope.

## Push and verify

- Prefer the current branch's configured upstream. Without an upstream, use a single unambiguous configured remote and the current branch, then set the upstream. If the branch is detached, the destination is missing or ambiguous, or protection prevents the push, ask for the specific missing decision.
- Fetch the target before pushing and inspect outgoing commits. Stop if the outgoing history includes unrelated commits outside the user's authorization. If the target has diverged, explain the issue rather than automatically rebasing or merging unrelated work.
- Push only the selected branch to the resolved destination. Never force-push, push all branches or tags, amend existing commits, reset, delete branches, change Git identity, or bypass hooks as part of this workflow.
- On authentication or network failure, preserve the local commit and report it. Do not loop indefinitely. Use required sandbox escalation for sandbox-related failures.
- Confirm the remote branch hash matches the pushed local commit and inspect final status. Do not report success based only on a created local commit.

Report the commit hash and subject, branch and remote, checks performed, push result, and any remaining uncommitted work. Do not open or merge a pull request unless separately requested.
