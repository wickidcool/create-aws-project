# Roadmap: create-aws-project

## Milestones

- ✅ **v1.2 AWS Organizations Support** - Phases 1-3 (shipped 2026-01-20)
- ✅ **v1.3 CLI Architecture Refactor** - Phases 4-9 (shipped 2026-01-23)
- ✅ **v1.4 Generated Project Validation** - Phases 10-14 (shipped 2026-01-24)
- ✅ **v1.5 Bug Fixes & Stability** - Phase 15 (shipped 2026-01-31)
- ✅ **v1.5.1 Fixes & Git Setup** - Phase 16 (shipped 2026-02-01)
- ✅ **v1.6 End-to-End AWS Setup** - Phases 17-22 (shipped 2026-02-13)
- ✅ **v1.7 AI-Friendly CLI** - Phases 23-25 (shipped 2026-02-19)
- 🚧 **v1.8 MCP Server** - Phases 26-29 (in progress)

## Phases

<details>
<summary>✅ v1.2 AWS Organizations Support (Phases 1-3) - SHIPPED 2026-01-20</summary>

Phases 1-3 delivered multi-environment AWS infrastructure with automatic Organizations setup and GitHub Actions deployment credentials.

</details>

<details>
<summary>✅ v1.3 CLI Architecture Refactor (Phases 4-9) - SHIPPED 2026-01-23</summary>

Phases 4-9 delivered simplified wizard with AWS/GitHub setup extracted into separate post-install commands.

</details>

<details>
<summary>✅ v1.4 Generated Project Validation (Phases 10-14) - SHIPPED 2026-01-24</summary>

Phases 10-14 delivered test harness validating all 14 generated project configurations with local runner and CI integration.

</details>

<details>
<summary>✅ v1.5 Bug Fixes & Stability (Phase 15) - SHIPPED 2026-01-31</summary>

Phase 15 delivered libsodium encryption fix, idempotent CLI commands, and corrected generated project test dependencies.

</details>

<details>
<summary>✅ v1.5.1 Fixes & Git Setup (Phase 16) - SHIPPED 2026-02-01</summary>

Phase 16 delivered CLI argument handling fixes, package name corrections, and optional GitHub repository setup after generation.

</details>

<details>
<summary>✅ v1.6 End-to-End AWS Setup (Phases 17-22) - SHIPPED 2026-02-13</summary>

Phases 17-22 delivered complete end-to-end AWS setup workflow from root credentials through CDK bootstrap and GitHub deployment configuration.

</details>

<details>
<summary>✅ v1.7 AI-Friendly CLI (Phases 23-25) - SHIPPED 2026-02-19</summary>

Phases 23-25 delivered non-interactive CLI mode via `--config` flag for AI coding agents and CI pipelines, with Zod v4 schema validation.

</details>

---

### 🚧 v1.8 MCP Server (In Progress)

**Milestone Goal:** Wrap the CLI as a standalone MCP server so Claude Code and Cursor can call `create_project()`, `setup_aws_envs()`, `initialize_github()`, and `get_project_status()` as tools. Published as `create-aws-project-mcp` on npm. Generated projects include a pre-configured `.mcp.json` for zero-config Claude/Cursor integration.

---

#### Phase 26: Package Foundation and Safety Infrastructure

**Goal**: A runnable MCP server binary exists with stdout protection, process.exit interception, and npm workspaces wired — the hard prerequisites that every tool handler depends on.

**Depends on**: Phase 25 (v1.7 complete)

**Requirements**: PKG-01, PKG-02, PKG-03, SAFE-01, SAFE-02, SAFE-03, CRED-01

**Success Criteria** (what must be TRUE):
  1. Running `npx create-aws-project-mcp` starts a server process that responds to MCP `initialize` without crashing
  2. `withCliContext()` can be called with a function that writes to `process.stdout` and calls `process.exit(1)` — stdout writes are captured (not sent to process stdout) and `process.exit` throws an Error instead of killing the process
  3. Root `npm run build` and `npm test` complete successfully for both `create-aws-project` and `create-aws-project-mcp` packages
  4. MCP Inspector connects to the server and shows zero registered tools (bare server, no tools yet)

**Plans**: 2 plans

Plans:
- [x] 26-01-PLAN.md — npm workspaces monorepo setup and bare MCP server scaffold
- [x] 26-02-PLAN.md — withCliContext safety wrapper with stdout capture and exit interception

---

#### Phase 27: CLI Additions to Existing Package

**Goal**: The two functions the MCP package needs are exported from the CLI package — `runSetupAwsEnvsNonInteractive` is exported, and `runInitializeGitHubNonInteractive` is added — with no interactive prompts in either code path.

**Depends on**: Phase 26

**Requirements**: CLI-01, CLI-02

**Success Criteria** (what must be TRUE):
  1. `import { runSetupAwsEnvsNonInteractive } from 'create-aws-project'` compiles without TypeScript errors in the MCP package
  2. `runInitializeGitHubNonInteractive(config)` accepts a structured config object, reads `GITHUB_TOKEN` from environment, and calls the GitHub secrets module directly — no `prompts` call anywhere in its execution path

**Plans**: 2 plans

Plans:
- [x] 27-01-PLAN.md — Refactor and export runSetupAwsEnvsNonInteractive (remove process.exit, accept config object)
- [x] 27-02-PLAN.md — Add runInitializeGitHubNonInteractive (structured config, env token, per-env status)

---

#### Phase 28: Four MCP Tools Implementation

**Goal**: All four MCP tools are implemented, respond correctly via MCP Inspector, return structured JSON output, and handle credential-missing errors with actionable messages — the server is functionally complete.

**Depends on**: Phase 27

**Requirements**: TOOL-01, TOOL-02, TOOL-03, TOOL-04, SAFE-04

**Success Criteria** (what must be TRUE):
  1. `get_project_status` called with a valid `projectDir` returns structured JSON including `accounts`, `deploymentUsers`, `configVersion`, and a `nextSteps` array computed from config state
  2. `create_project` called with `name` returns the scaffolded project directory path and the generated project directory exists on disk
  3. `setup_aws_envs` and `initialize_github` each return `isError: true` with an actionable message (pointing to the `.mcp.json` env block) when their required environment variables are absent — neither hangs nor crashes the server
  4. All four tools appear in MCP Inspector's tool list with complete input schemas; calling any tool with missing required inputs returns a validation error, not a server crash
  5. Long-running tool handlers (`create_project`, `setup_aws_envs`) emit `notifications/progress` events that a connected MCP client can receive during a multi-second operation

**Plans**: 3 plans

Plans:
- [x] 28-01-PLAN.md — Extract runCreateProjectNonInteractive export and create MissingCredentialsError class
- [x] 28-02-PLAN.md — Implement create_project and get_project_status tool handlers
- [x] 28-03-PLAN.md — Implement setup_aws_envs and initialize_github tool handlers

---

#### Phase 29: Publishing and Generated Project Template

**Goal**: `create-aws-project-mcp` is published to npm and every project scaffolded by the CLI includes a `.mcp.json` that launches the server via `npx -y create-aws-project-mcp` with documented environment variable placeholders.

**Depends on**: Phase 28

**Requirements**: PKG-04, TMPL-01

**Success Criteria** (what must be TRUE):
  1. `npx -y create-aws-project-mcp` (fresh install, no prior cache) starts the server without error — the package is live on the npm registry
  2. A project generated by `npx create-aws-project` contains `.mcp.json` at its root with an `mcpServers` entry using `npx -y create-aws-project-mcp` and a documented `env` block listing all required environment variables
  3. The root `npm run build` script builds the CLI package before the MCP package (dependency order enforced)

**Plans**: 2 plans

Plans:
- [ ] 29-01-PLAN.md — Fix tsconfig exclude, add package metadata, and prepare for npm publish
- [ ] 29-02-PLAN.md — Add .mcp.json to generated project template

---

## Progress

**Execution Order:** 26 → 27 → 28 → 29

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1-3. AWS Organizations Support | v1.2 | — | Complete | 2026-01-20 |
| 4-9. CLI Architecture Refactor | v1.3 | — | Complete | 2026-01-23 |
| 10-14. Generated Project Validation | v1.4 | — | Complete | 2026-01-24 |
| 15. Bug Fixes & Stability | v1.5 | — | Complete | 2026-01-31 |
| 16. Fixes & Git Setup | v1.5.1 | — | Complete | 2026-02-01 |
| 17-22. End-to-End AWS Setup | v1.6 | — | Complete | 2026-02-13 |
| 23-25. AI-Friendly CLI | v1.7 | — | Complete | 2026-02-19 |
| 26. Package Foundation + Safety | v1.8 | 2/2 | Complete | 2026-04-01 |
| 27. CLI Additions | v1.8 | 2/2 | Complete | 2026-04-02 |
| 28. Four MCP Tools | v1.8 | 3/3 | Complete | 2026-04-02 |
| 29. Publishing + Template | v1.8 | 0/2 | Not started | - |
