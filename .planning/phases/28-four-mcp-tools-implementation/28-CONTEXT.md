# Phase 28: Four MCP Tools Implementation - Context

**Gathered:** 2026-04-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Implement four MCP tool handlers (`create_project`, `setup_aws_envs`, `initialize_github`, `get_project_status`) in the `create-aws-project-mcp` package. Tools respond correctly via MCP Inspector, return structured JSON, and handle errors with actionable messages. The server becomes functionally complete. Publishing to npm and generated project template updates are Phase 29.

</domain>

<decisions>
## Implementation Decisions

### Credential Error Messages

- When required env vars are absent, error messages must include **both**: the names of the missing vars AND the fix location (`.mcp.json` env block)
- Include a copy-pasteable `.mcp.json` snippet in the error showing exactly where to add the missing vars — not just a file reference
- `initialize_github` credential error: concise — "Set GITHUB_TOKEN in your .mcp.json env block" — no explanation of why it's env-only
- Credential errors (`MISSING_CREDENTIALS`) are a **distinct error type** from input validation errors — callers need to handle them differently (e.g., prompt user to configure creds vs. re-call with corrected inputs)

### Tool Input Schemas

- `create_project(name, outputDir?, ...options)`: accepts `name` (required) + `outputDir` (optional, defaults to cwd) + key generation options as optional parameters (e.g., environments, region — the commonly varied settings from the CLI wizard)
- `setup_aws_envs(config)` and `initialize_github(config)`: accept the **full config schema** matching the `--config` flag shape (Zod-validated, same as Phase 23-25 CLI) — consistency with the CLI, caller passes everything at once
- `get_project_status(projectDir)`: only `projectDir` is required — always returns the full status object (`accounts`, `deploymentUsers`, `configVersion`, `nextSteps`) — no field filtering

### Claude's Discretion

- Exact key generation options to expose on `create_project` (which specific CLI options to surface)
- The specific field/code name for the MISSING_CREDENTIALS error type
- Progress event granularity and message text for `create_project` and `setup_aws_envs`
- Success response envelope shape for each tool

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches for response structure and progress events.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 28-four-mcp-tools-implementation*
*Context gathered: 2026-04-02*
