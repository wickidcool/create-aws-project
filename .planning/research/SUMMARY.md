# Project Research Summary

**Project:** create-aws-project v1.8 — MCP Server Companion Package
**Domain:** MCP stdio server wrapping an existing TypeScript CLI with long-running AWS operations
**Researched:** 2026-03-25
**Confidence:** HIGH (all critical claims verified against npm registry, official MCP protocol docs, and direct codebase inspection)

---

## Executive Summary

The v1.8 milestone adds `create-aws-project-mcp`, a separate npm package that exposes the existing CLI's four major operations as MCP tools callable by AI agents. Experts build this type of companion package using `@modelcontextprotocol/sdk` v1.28.0 (the only production-ready TypeScript MCP SDK, published by Anthropic), publishing it as an ESM package invokable via `npx -y create-aws-project-mcp`. The server uses stdio transport, calls into existing CLI functions by direct import, and relies on the user's environment for AWS and GitHub credentials — never accepting secrets as tool inputs. All four tools (`create_project`, `setup_aws_envs`, `initialize_github`, `get_project_status`) are synchronous request-response with progress notifications for the two long-running operations.

The central architectural challenge is that the existing CLI functions were written for interactive terminal use: they call `console.log()` throughout, use the `prompts` library for interactive input (which writes to `process.stdout`), and call `process.exit(1)` on errors. All three behaviors are fatal to an MCP stdio server — any non-JSON write to stdout corrupts the JSON-RPC stream, `process.exit` kills the server process, and `prompts` competes with the MCP transport for stdin. The recommended resolution is a `withCliContext()` wrapper that redirects stdout and intercepts `process.exit`, combined with a strict policy of calling only the non-interactive (`--config`) code paths from MCP tool handlers. Two targeted additions to the existing package are also required: `runSetupAwsEnvsNonInteractive` must be exported, and a new `runInitializeGitHubNonInteractive` function must be added to bypass the interactive PAT prompt.

The package structure is a subdirectory in the same git repository using npm workspaces (`packages/create-aws-project-mcp/`), published independently to npm. Generated projects receive a `.mcp.json` template that launches the server via `npx -y create-aws-project-mcp` — no global install required. The most non-obvious runtime trap is working directory: MCP clients may launch the server from any directory (often `/` on macOS when opened via an OS launcher), so all project-context tools must accept `projectPath` as an explicit input parameter rather than relying on `process.cwd()`.

---

## Key Findings

### Recommended Stack

The MCP server is built on `@modelcontextprotocol/sdk@^1.28.0` — the only official TypeScript SDK, published by Anthropic. Version 2 is explicitly pre-alpha and must not be used. The existing project's `zod@4.3.6` satisfies the SDK peer dependency range (`^3.25 || ^4.0`) with no version conflict. TypeScript compilation uses `module: NodeNext` (required for the ESM-only SDK) with `.js` extension imports throughout. No additional packages are needed: the SDK bundles `zod-to-json-schema` internally, `console.error()` replaces any logging library, and HTTP transport packages are irrelevant for a local stdio server.

**Core technologies:**
- `@modelcontextprotocol/sdk@^1.28.0`: MCP server runtime, tool registration, stdio transport — only production-ready option; v2 is pre-alpha
- `McpServer` + `StdioServerTransport`: high-level API for tool registration; the lower-level `Server` class is deprecated in v1.28.0
- `server.registerTool()`: current registration API (replaces deprecated `server.tool()` overloads)
- `zod` (reuse existing `^4.3.6`): declared as peer dependency in MCP package to avoid dual installation
- Node.js `>=22.0.0`: matches existing project requirement (SDK minimum is `>=18`)
- `module: NodeNext` tsconfig: mandatory for `.js` extension imports from the ESM SDK

The server entry point follows the standard pattern: `McpServer` instantiated once, tools registered, `StdioServerTransport` connected, process stays alive. All diagnostic output uses `console.error()`. Any `console.log()` in any code path reachable from a tool handler corrupts the JSON-RPC stream and must be treated as a build-breaking defect.

### Expected Features

The four tools map 1:1 to existing CLI operations. `create_project` wraps the `--config` non-interactive wizard. `setup_aws_envs` wraps `runSetupAwsEnvsNonInteractive`. `initialize_github` wraps a new `runInitializeGitHubNonInteractive` (to be added). `get_project_status` is new logic — a read-only status report with a computed `nextSteps` array for agent guidance. The `projectPath` return value from `create_project` is the thread connecting all four tools; an agent receives it from the first call and passes it to every subsequent call.

**Must have (table stakes):**
- All four tools with complete Zod-validated input schemas — minimum viable server
- Environment-based credential injection (`AWS_ACCESS_KEY_ID`, `GITHUB_TOKEN`) — prevents credentials appearing in LLM context
- `projectPath` input on all project-context tools — without this, tools fail when launched from a non-project directory
- Structured JSON output on all tools — enables agent chaining (`projectPath` from `create_project` to subsequent tools)
- `isError: true` results with actionable messages — agents must distinguish recoverable from fatal failures
- Progress notifications for `create_project` (~30-60s) and `setup_aws_envs` (~3-10 min) — prevents tools from appearing hung
- `nextSteps` array in `get_project_status` — reduces agent reasoning load about setup state
- No interactive prompts in any MCP code path — any `prompts` call hangs indefinitely or crashes
- `process.exit()` interception — exits kill the server process, not just the current request
- `console.log()` prohibited throughout MCP server code — stdout is the JSON-RPC channel

**Should have (differentiators):**
- `nextSteps` derived from config state in `get_project_status` — agent gets a computed action list, not a raw config dump
- Partial failure reporting in `initialize_github` — attempt all environments, report per-environment success/failure for targeted retries
- Per-environment completion booleans in status — agent can check "is dev configured?" without credential parsing
- Human-readable progress messages with duration hints ("Creating prod account (this can take 1-2 minutes)")
- Explicit credential-source in error messages ("AWS_ACCESS_KEY_ID not set — add to .mcp.json env block: ...")
- `warnings` array in `get_project_status` for non-blocking alerts (e.g., "AWS credentials are root — consider IAM admin")
- `.mcp.json` template included in generated projects with env variable documentation

**Defer to post-v1.8:**
- `outputSchema` declarations in tool definitions (nice for type-safe clients, not required for function)
- `annotations.readOnly` on `get_project_status` (client-side optimization that skips confirmation prompts)
- Version pinning in generated `.mcp.json` (leave unpinned for initial release, document in README)

**Anti-features (explicitly do not build):**
- `awsAccessKeyId` / `awsSecretAccessKey` / `githubToken` as tool inputs — credentials in LLM context, logs, and client UIs
- Any interactive fallback when credentials are missing — cannot prompt in MCP, will hang
- Subprocess invocation of the CLI instead of direct import — adds latency and loses structured errors
- Merging `create_project` + `setup_aws_envs` into one tool — reduces agent composability and retry flexibility
- Passing raw `.aws-starter-config.json` content to the agent — exposes deployment credentials written by `setup_aws_envs`

### Architecture Approach

The MCP server lives in `packages/create-aws-project-mcp/` within the same git repository, enabled by npm workspaces. It imports directly from `create-aws-project` (declared as a direct dependency, not peer), calling only the non-interactive code paths. A `withCliContext()` utility in `utils/cli-context.ts` wraps all tool handler invocations: it redirects `process.stdout.write` to a capture buffer, intercepts `process.exit` and converts it to a thrown Error, and returns the captured terminal output (ANSI-stripped) alongside the result. This captured output becomes the human-readable text content returned to the AI agent — the same progress information a terminal user would see, without corrupting the protocol.

**Major components:**
1. `packages/create-aws-project-mcp/src/index.ts` — entry point with `#!/usr/bin/env node` shebang; creates McpServer, registers all tools, starts StdioServerTransport
2. `packages/create-aws-project-mcp/src/tools/` — one file per tool; each handler calls `withCliContext()` wrapping the relevant CLI function
3. `packages/create-aws-project-mcp/src/utils/cli-context.ts` — `withCliContext()` combining stdout redirect and `process.exit` interception
4. `packages/create-aws-project-mcp/src/utils/strip-ansi.ts` — cleans ANSI escape codes from captured terminal output before including in MCP responses
5. `create-aws-project/src/commands/setup-aws-envs.ts` — add `export` to `runSetupAwsEnvsNonInteractive` (currently unexported)
6. `create-aws-project/src/commands/initialize-github.ts` — add `runInitializeGitHubNonInteractive(config)` that reads `GITHUB_TOKEN` from environment and calls `src/github/secrets.ts` directly

The MCP server process is long-running — one process per client session. Tools execute sequentially (no concurrent dispatch at the stdio transport level). State is never held in memory between calls; each tool reads fresh from `.aws-starter-config.json`.

### Critical Pitfalls

1. **stdout corruption from `console.log()` and `prompts`** — Any non-JSON write to stdout corrupts the JSON-RPC stream and disconnects the client immediately. The existing CLI has 15+ `console.log()` calls in `setup-aws-envs.ts` and `initialize-github.ts`, plus `prompts` writes to `process.stdout` by default (confirmed via `node_modules/prompts/dist/elements/prompt.js:26-27`). Solution: call only non-interactive code paths; apply `withCliContext()` stdout redirect to every tool handler; treat any `console.log()` in MCP-reachable code as a build-breaking defect. Must be solved in Phase 1 before any tool can work.

2. **Working directory is undefined at MCP server startup** — MCP clients launch the server from an arbitrary directory (often `/` on macOS when opened via IDE). The existing `find-up` usage for `.aws-starter-config.json` returns `undefined` and all project-context tools fail with confusing "config not found" errors. Solution: all project-context tools must accept `projectPath` as an explicit input parameter; resolve config from `path.join(projectPath, '.aws-starter-config.json')`, not `process.cwd()`. This must be baked into tool schema design before any implementation begins.

3. **`process.exit()` kills the entire server** — `handleAwsError()` and validation code call `process.exit(1)` on failure. In an MCP server, this terminates the entire server process for the rest of the client session — not just the current request. Solution: `withCliContext()` must intercept `process.exit`, convert it to a thrown Error, and allow the tool handler to catch and return it as `isError: true`.

4. **Long-running tools exceed client timeouts** — `setup_aws_envs` can take 3-10 minutes. Claude Code's default timeout is approximately 60 seconds. Without progress notifications, the tool call times out even if the underlying AWS operation succeeds. Solution: emit `notifications/progress` throughout long operations; document expected duration in tool `description` fields. Per spec, clients MAY (not MUST) reset their timeout clock when receiving progress notifications — accept this uncertainty and document it.

5. **Credentials in tool inputs** — Any credential field in a tool's input schema becomes visible in LLM context, client UIs, and logs. Solution: read `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_PROFILE`, and `GITHUB_TOKEN` from the server's environment at startup via the AWS SDK default credential chain. Return actionable `isError: true` if required credentials are absent.

---

## Implications for Roadmap

The v1.8 work breaks cleanly into four phases. The critical path is: workspace setup → CLI additions → MCP tools → publishing. Nothing in phase N+1 can be tested without phase N complete.

### Phase 1: Package Foundation and Safety Infrastructure

**Rationale:** The `withCliContext()` utility is a hard prerequisite for every tool. Without it, the first tool call corrupts the stdio stream and the client disconnects silently. ESM setup (shebang, `module: NodeNext`, `chmod +x`) and MCP Inspector integration must be validated before writing any tool business logic. npm workspaces configuration in the root `package.json` must also happen here — it does not currently exist.

**Delivers:** A runnable MCP server binary that responds to `initialize`, registers zero tools, and starts without crashing. npm workspaces wired (`"workspaces": ["packages/*"]` in root). `withCliContext()` unit-tested in isolation with a function that writes to stdout and calls `process.exit`. MCP Inspector confirmed working against the bare server.

**Addresses features:** stdout redirect, `process.exit` interception, ESM shebang, `bin` entry in `package.json`.

**Avoids pitfalls:** Pitfall 1 (stdout corruption), Pitfall 3 (`process.exit` kills server), Pitfall 7 (ESM resolution), Pitfall 8 (testing without full IDE setup).

**Research flag:** Standard patterns — the official MCP TypeScript quickstart provides the exact implementation pattern. No additional research needed.

---

### Phase 2: CLI Additions (Changes to Existing Package)

**Rationale:** The two required changes to `create-aws-project` are a hard dependency for Phase 3. TypeScript will fail to import a non-exported function. These changes are surgical and low-risk, but they must be shipped and built before the MCP tool handlers can import from the CLI package.

**Delivers:** `runSetupAwsEnvsNonInteractive` exported from `commands/setup-aws-envs.ts`. New `runInitializeGitHubNonInteractive(config)` in `commands/initialize-github.ts` that reads `GITHUB_TOKEN` from environment and calls `src/github/secrets.ts` directly (bypassing `prompts`). Build confirmed with both new exports visible in `dist/`.

**Uses:** Existing `src/github/secrets.ts` modular structure (already suitable for direct invocation). Existing `SetupAwsEnvsConfig` types.

**Avoids pitfalls:** Pitfall 9 (stdin competition — the new non-interactive function never calls `prompts`), Pitfall 4 (credential exposure — PAT comes from environment, not a function parameter).

**Research flag:** No research needed — codebase audit in ARCHITECTURE.md already identified exactly which functions need changes and what their structure should be.

---

### Phase 3: Four MCP Tools

**Rationale:** With `withCliContext()` ready (Phase 1) and CLI exports available (Phase 2), all four tools can be built. The recommended build order within this phase: `get_project_status` first (pure read, no CLI calls, easiest to test the plumbing), then `create_project`, then `setup_aws_envs`, then `initialize_github`. Each tool must include the `projectPath` input, structured JSON output, `isError: true` error handling, and progress notifications for the two long-running tools.

**Delivers:** All four tools functional end-to-end via MCP Inspector. `get_project_status` returns structured status with `nextSteps`. `create_project` and `setup_aws_envs` emit progress notifications throughout execution. `initialize_github` handles partial per-environment failures. Credential detection at startup with actionable error messages pointing users to `.mcp.json` env configuration.

**Addresses features:** All table-stakes features. Progress notifications, `nextSteps`, partial failure reporting for `initialize_github`.

**Avoids pitfalls:** Pitfall 2 (working directory — `projectPath` on all tools), Pitfall 3 (long-running timeouts — progress notifications), Pitfall 4 (credentials in inputs), Pitfall 5 (`isError: true` throughout).

**Research flag:** Needs targeted verification during planning — confirm `server.sendProgressNotification()` method signature in SDK v1.28.0. FEATURES.md references this method but it was not traced directly to v1.28.0 type definitions. Verify parameter names before implementation to avoid a wasted cycle.

---

### Phase 4: Publishing and Generated Template

**Rationale:** Publishing is last — it requires a tested, working package. The `.mcp.json` template in generated projects ties the entire feature together for end users. npm workspaces build ordering must be codified in root scripts so CI builds both packages in sequence.

**Delivers:** `create-aws-project-mcp` published to npm. Root `build` script builds CLI then MCP package in order. Generated projects include `.mcp.json` template using `npx -y create-aws-project-mcp` with documented `env` keys for `GITHUB_TOKEN`. README updated with setup instructions for Claude Code, Claude Desktop, and Cursor. `prepublishOnly` script confirmed in MCP package `package.json`.

**Uses:** `npx -y create-aws-project-mcp` invocation pattern (verified, universal across all clients).

**Avoids pitfalls:** Pitfall 6 (version coupling — `create-aws-project` as direct dependency, `files` field, `prepublishOnly` build), Pitfall 10 (`.mcp.json` path portability — npx invocation, no relative or absolute paths).

**Research flag:** Cursor `.cursor/mcp.json` format was flagged MEDIUM confidence in STACK.md (official Cursor docs inaccessible during research). Verify against Cursor docs or community sources before publishing Cursor-specific README instructions.

---

### Phase Ordering Rationale

- Phase 1 before Phase 3: The safety wrapper is a hard dependency; writing tool handlers without it produces an undebuggable, silently-failing server.
- Phase 2 before Phase 3: TypeScript cannot import a non-exported function; the build fails at compile time.
- Phase 3 before Phase 4: Cannot publish an untested package; `npx create-aws-project-mcp` must work end-to-end before publishing.
- `get_project_status` first within Phase 3: It is read-only (no CLI calls, no `withCliContext` needed), has no credential requirements, and validates the tool registration plumbing before touching AWS-side complexity.

### Research Flags

Phases needing deeper research during planning:
- **Phase 3 (progress notifications):** Confirm `server.sendProgressNotification()` method signature in SDK v1.28.0 — FEATURES.md references it but it was not verified against the actual type definitions. Confirm parameter names (`progressToken`, `progress`, `total`, `message`) before implementation.
- **Phase 4 (Cursor config):** STACK.md flagged Cursor `.cursor/mcp.json` format as MEDIUM confidence. Verify before documenting in README.

Phases with standard patterns (skip research-phase):
- **Phase 1:** MCP TypeScript quickstart provides the exact implementation. No ambiguity.
- **Phase 2:** Pure codebase changes to existing TypeScript functions. No external unknowns.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All critical claims verified: npm registry (SDK version, peer deps), SDK type definitions (McpServer, StdioServerTransport, registerTool), official MCP TypeScript quickstart. No gaps. |
| Features | HIGH | All four tool designs verified against official MCP tools spec, progress spec, and direct project codebase inspection. Credential design follows documented MCP `env` pattern. |
| Architecture | HIGH | Stdout conflict analysis based on direct source inspection of `prompts` and `ora` node_modules. Process model verified from official MCP architecture docs. One MEDIUM: npm workspaces not yet configured in root `package.json` — requires migration step at Phase 1 start. |
| Pitfalls | HIGH (9/10) / MEDIUM (Pitfall 3) | 9 of 10 pitfalls are HIGH confidence (verified from official MCP spec or direct source inspection). Pitfall 3 (client-specific timeout values) is MEDIUM — timeout behavior is undocumented for Claude Code and Cursor specifically. |

**Overall confidence:** HIGH

### Gaps to Address

- **Claude Code timeout value:** The ~60-second default mentioned in PITFALLS.md is "observed" not documented. Validate during Phase 3 testing via MCP Inspector with artificial delays before relying on progress notifications as a mitigation strategy.
- **`server.sendProgressNotification()` signature:** Referenced in FEATURES.md but not traced to SDK v1.28.0 type definitions. Verify in Phase 3 planning before implementation to avoid a wasted cycle.
- **Cursor `.cursor/mcp.json` format:** MEDIUM confidence from STACK.md. Verify from Cursor docs or community sources before Phase 4 README authoring.
- **npm workspaces migration:** Root `package.json` does not currently have `"workspaces": ["packages/*"]`. This is a project structure change required before Phase 1 can proceed — treat as the first task in Phase 1.

---

## Sources

### Primary (HIGH confidence)
- `@modelcontextprotocol/sdk` npm registry + type definitions — SDK version 1.28.0, peer deps, McpServer/StdioServerTransport API, registerTool signature
- modelcontextprotocol.io/quickstart/server — McpServer, StdioServerTransport, registerTool, console.error requirement, main() pattern
- modelcontextprotocol.io/docs/concepts/transports — stdio protocol, stdout prohibition, stderr logging
- modelcontextprotocol.io/docs/concepts/tools — isError, inputSchema JSON Schema, structured content
- modelcontextprotocol.io/specification/2025-11-25/basic/utilities/progress — progressToken, notifications/progress format
- modelcontextprotocol.io/docs/tools/debugging — working directory behavior, env inheritance, MCP Inspector
- code.claude.com/docs/en/mcp — .mcp.json format, --scope project, Windows cmd /c workaround, env field
- modelcontextprotocol.io/quickstart/user — claude_desktop_config.json format, npx -y pattern
- Direct codebase inspection: `src/commands/setup-aws-envs.ts`, `src/commands/initialize-github.ts`, `node_modules/prompts/dist/elements/prompt.js:26-27`, `node_modules/ora/index.js:122`

### Secondary (MEDIUM confidence)
- Cursor `.cursor/mcp.json` format — same `mcpServers` schema as Claude Desktop documented by community; official Cursor docs inaccessible during research

---

*Research completed: 2026-03-25*
*Ready for roadmap: yes*
