# Phase 27: CLI Additions to Existing Package - Context

**Gathered:** 2026-04-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Export `runSetupAwsEnvsNonInteractive` from the CLI package and add `runInitializeGitHubNonInteractive` — both callable by MCP tool handlers with no interactive prompts anywhere in their execution paths. Wire `notifications/progress` events into all four MCP tools. Creating the MCP tool handlers themselves is Phase 28.

</domain>

<decisions>
## Implementation Decisions

### Config contract
- `runInitializeGitHubNonInteractive` accepts the same config shape as the existing `--config` flag — reuse the Zod schema already in place
- Validate input with Zod defensively (same as the CLI does); do not trust callers to pre-validate
- `projectDir` defaults to the current working directory (`process.cwd()`) — no explicit path parameter needed
- GitHub token source: Claude's Discretion (env-only vs config fallback)

### Progress events
- All four MCP tools (`create_project`, `setup_aws_envs`, `initialize_github`, `get_project_status`) emit progress events — at minimum start/done; granularity per tool is Claude's Discretion
- Progress event payload shape: Claude's Discretion (message-only vs message + percentage)
- Where to wire progress (MCP handlers only vs shared callback into CLI): Claude's Discretion based on invasiveness to existing code

### Error behavior
- Missing credential errors (GITHUB_TOKEN absent, AWS creds absent) must produce actionable messages that point the user to the `.mcp.json` env block — not just "variable not found"
- Error signaling (throw vs return result object): Claude's Discretion based on consistency with existing non-interactive function patterns
- Partial progress events fire before a failure: Claude's Discretion
- Error type distinction (user-fixable vs unexpected): Claude's Discretion

### Export surface
- Whether `runSetupAwsEnvsNonInteractive` already exists or needs to be built: Claude must verify by reading current CLI source before planning
- Which TypeScript types to export alongside the functions: Claude's Discretion (export what the MCP package needs to compile without errors)
- Export location (add to existing `index.ts` vs separate `/mcp` subpath): Claude's Discretion based on package conventions

### Claude's Discretion
- GitHub token source (env-only vs config fallback) — pick based on security best practices and MCP token flow
- Progress event payload shape — align with MCP `notifications/progress` spec
- Progress wiring strategy — minimize invasiveness to existing CLI code
- Error signaling pattern — match whatever `runSetupAwsEnvsNonInteractive` already does for consistency
- Partial progress on failure — pick what's cleanest with MCP notification model
- Error type distinction — only differentiate if it meaningfully improves MCP client UX
- Export location and type surface — export minimum needed for MCP package to compile cleanly

</decisions>

<specifics>
## Specific Ideas

- "Check the code first" — whether `runSetupAwsEnvsNonInteractive` needs to be created or just re-exported must be determined by reading the current CLI source, not assumed

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 27-cli-additions-to-existing-package*
*Context gathered: 2026-04-01*
