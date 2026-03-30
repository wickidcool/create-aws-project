# Requirements: create-aws-project v1.8 MCP Server

**Defined:** 2026-03-26
**Core Value:** Generated projects have production-ready multi-environment AWS infrastructure with automated CI/CD from day one.

## v1.8 Requirements

### Package Structure

- [ ] **PKG-01**: npm workspaces configured in root `package.json` so both packages share `node_modules`
- [ ] **PKG-02**: `packages/mcp/` directory with its own `package.json`, `tsconfig.json`, and `bin` entry (`create-aws-project-mcp`)
- [ ] **PKG-03**: Root-level `build` and `test` scripts run both packages
- [ ] **PKG-04**: `packages/mcp/package.json` includes publish scripts; `create-aws-project-mcp` is publishable to npm

### Safety Infrastructure

- [ ] **SAFE-01**: `withCliContext()` utility redirects `process.stdout.write` during CLI function calls to prevent MCP stdio corruption
- [ ] **SAFE-02**: `withCliContext()` intercepts `process.exit()` and converts it to a thrown `Error` so the server process survives validation failures
- [ ] **SAFE-03**: MCP server entry point creates `McpServer`, registers all tools, and connects via `StdioServerTransport`
- [ ] **SAFE-04**: Long-running tools (`create_project`, `setup_aws_envs`) emit `notifications/progress` with a `progressToken` so clients can track status

### CLI Additions (existing package)

- [ ] **CLI-01**: `runSetupAwsEnvsNonInteractive` is exported from `src/setup-aws-envs.ts` so the MCP package can import it
- [ ] **CLI-02**: `runInitializeGitHubNonInteractive(config)` function added to `src/initialize-github.ts` — accepts structured config, no interactive prompts

### MCP Tools

- [ ] **TOOL-01**: `create_project` tool accepts `name` (required) and optional project options; calls `runCreateProjectNonInteractive()`; returns the scaffolded project directory path
- [ ] **TOOL-02**: `setup_aws_envs` tool accepts `projectDir` (required) and optional AWS config overrides; calls `runSetupAwsEnvsNonInteractive()`; emits progress notifications; returns account IDs
- [ ] **TOOL-03**: `initialize_github` tool accepts `projectDir` (required) and optional `env` (defaults to all); calls `runInitializeGitHubNonInteractive()`; returns per-environment status
- [ ] **TOOL-04**: `get_project_status` tool accepts `projectDir` (required); reads `.aws-starter-config.json`; returns structured project state (accounts, deploymentUsers, configVersion)

### Credentials

- [ ] **CRED-01**: All tools read credentials from environment variables only (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `GITHUB_TOKEN`); no credential parameters in tool schemas

### Generated Project Template

- [ ] **TMPL-01**: Generated projects include `.mcp.json` at root with `mcpServers` entry (`npx -y create-aws-project-mcp`) and placeholder `env` block for all required environment variables

## Future Requirements

### v2.0+

- **EXT-01**: `awsProfile` optional input on `setup_aws_envs` for users with multiple AWS profiles
- **EXT-02**: Cursor `.cursor/mcp.json` generation alongside `.mcp.json` (pending Cursor format verification)
- **EXT-03**: `destroy_project` tool for tearing down AWS infrastructure
- **EXT-04**: Streaming output from tools (if MCP spec evolves to support it)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Interactive prompts from MCP tools | MCP tools must be non-interactive; the v1.7 `--config` paths handle this |
| Credential inputs in tool schemas | Security risk — credentials appear in LLM context and client logs |
| MCP tool for the interactive wizard | The non-interactive `--config` path is the correct entry point for agents |
| Separate npm package repo | Monorepo keeps versions in sync without publish ceremony |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| PKG-01 | Phase 26 | Pending |
| PKG-02 | Phase 26 | Pending |
| PKG-03 | Phase 26 | Pending |
| PKG-04 | Phase 29 | Pending |
| SAFE-01 | Phase 26 | Pending |
| SAFE-02 | Phase 26 | Pending |
| SAFE-03 | Phase 26 | Pending |
| SAFE-04 | Phase 27 | Pending |
| CLI-01 | Phase 27 | Pending |
| CLI-02 | Phase 27 | Pending |
| TOOL-01 | Phase 28 | Pending |
| TOOL-02 | Phase 28 | Pending |
| TOOL-03 | Phase 28 | Pending |
| TOOL-04 | Phase 28 | Pending |
| CRED-01 | Phase 26 | Pending |
| TMPL-01 | Phase 29 | Pending |

**Coverage:**
- v1.8 requirements: 16 total
- Mapped to phases: 16
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-26*
*Last updated: 2026-03-25 after roadmap creation — traceability verified correct*
