# MCP connections for Codex

The project configuration is in `.codex/config.toml`:

- `openaiDeveloperDocs`: official OpenAI documentation search and retrieval, including Codex and Agents SDK documentation. No API key is required. This is a documentation connection, not an OpenAI API execution service.
- `github`: GitHub's official remote MCP server. Authentication uses the `GITHUB_PAT_TOKEN` environment variable; no token is stored in the project.

Codex loads project configuration only for trusted projects. Open this folder in Codex and trust it if prompted.

## GitHub authentication

Create a GitHub personal access token limited to the repositories and permissions you need. Set `GITHUB_PAT_TOKEN` in the environment of the process launching Codex or VS Code. For a temporary PowerShell session, enter it without putting it in shell history:

```powershell
$githubCredential = Read-Host 'GitHub personal access token' -AsSecureString
$env:GITHUB_PAT_TOKEN = [System.Net.NetworkCredential]::new('', $githubCredential).Password
codex
```

For the IDE extension, VS Code must inherit this environment variable at startup; an already-running VS Code process will not inherit changes from a new terminal. The backend's `apps/api/.env` is not used to configure Codex MCP authentication.

After loading the configuration, run `codex mcp list` from this folder or inspect the IDE extension's MCP settings. Restart the Codex extension after changing its MCP configuration. A listed server confirms configuration; a successful tool call confirms connectivity and authentication.

## Sources

- [Codex MCP configuration](https://developers.openai.com/codex/mcp)
- [OpenAI Docs MCP](https://developers.openai.com/learn/docs-mcp)
- [GitHub MCP setup for Codex](https://github.com/github/github-mcp-server/blob/main/docs/installation-guides/install-codex.md)
