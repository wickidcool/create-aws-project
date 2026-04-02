# Phase 28: Four MCP Tools Implementation - Research

**Researched:** 2026-04-02
**Domain:** @modelcontextprotocol/sdk tool registration, progress notifications, MCP tool patterns
**Confidence:** HIGH

## Summary

This phase implements four MCP tool handlers in the `create-aws-project-mcp` package by wiring the existing non-interactive CLI functions (`runCreateProjectNonInteractive` — which does not yet exist as a named export and must be built, `runSetupAwsEnvsNonInteractive`, `runInitializeGitHubNonInteractive`) to `McpServer.registerTool()` calls. The MCP SDK v1.29.0 is already installed; the server skeleton is already wired with `StdioServerTransport`; the only work is implementing the four tool handlers.

The SDK provides `registerTool(name, config, callback)` as the non-deprecated API. Tool callbacks receive `(args, extra)` where `extra.sendNotification()` emits `notifications/progress` events and `extra._meta?.progressToken` carries the client-supplied token. Errors are surfaced by returning `{ content: [{ type: 'text', text: '...' }], isError: true }` — the SDK does NOT validate output schema when `isError: true`. Input validation failures (missing required fields) are handled automatically by the SDK's Zod schema integration before the callback is called.

`create_project` is the only tool with no pre-existing non-interactive function — it must be built by inlining `loadNonInteractiveConfig`, `generateProject`, and `writeConfigFile` logic from `src/cli.ts`. The other three tools call already-exported functions. `get_project_status` reads `.aws-starter-config.json` directly — there is no existing helper and one must be written.

**Primary recommendation:** Use `server.registerTool()` with `z.object()` input schemas. Emit progress in long-running tools by calling `await extra.sendNotification({ method: 'notifications/progress', params: { progressToken, progress, total, message } })` after each major step, guarded by `if (extra._meta?.progressToken !== undefined)`.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @modelcontextprotocol/sdk | 1.29.0 (installed) | MCP server, tool registration, progress notifications | Already in package.json; `McpServer.registerTool()` is the current non-deprecated API |
| zod | (transitive via create-aws-project) | Input schema definition and validation | SDK uses Zod shapes natively for `inputSchema`; same Zod already used in CLI config schemas |
| create-aws-project | `*` (workspace) | Non-interactive CLI functions | Already a dependency; exports `runSetupAwsEnvsNonInteractive` and `runInitializeGitHubNonInteractive` |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| node:fs/promises | built-in | Read `.aws-starter-config.json` for `get_project_status` | `get_project_status` reads the config file directly |
| node:path | built-in | Resolve `projectDir` to absolute path | Needed whenever `projectDir` is passed as tool input |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `registerTool()` | `server.tool()` | `server.tool()` is deprecated as of SDK 1.x; `registerTool()` is the current API. Use `registerTool`. |
| Zod inline in tool file | Shared schema from create-aws-project config | Inline is simpler and avoids cross-package schema coupling |

**Installation:**
No new packages needed. All dependencies are already present.

## Architecture Patterns

### Recommended Project Structure
```
packages/create-aws-project-mcp/src/
├── server.ts              # McpServer setup + registerTool() calls (all four tools here)
├── tools/
│   ├── create-project.ts      # create_project handler
│   ├── setup-aws-envs.ts      # setup_aws_envs handler
│   ├── initialize-github.ts   # initialize_github handler
│   └── get-project-status.ts  # get_project_status handler
├── utils/
│   └── cli-context.ts         # existing stdout capture utility
└── index.ts               # unchanged entry point
```

Alternatively, all four tools can live directly in `server.ts` if each handler is small. Given that each tool has distinct error types and response shapes, separate files per tool is preferred for testability.

### Pattern 1: Tool Registration with Zod Input Schema
**What:** Register a tool with a typed input schema; the SDK validates inputs before calling the handler.
**When to use:** All four tools.
**Example:**
```typescript
// Source: node_modules/@modelcontextprotocol/sdk/dist/esm/server/mcp.d.ts
import { z } from 'zod';

server.registerTool(
  'get_project_status',
  {
    title: 'Get Project Status',
    description: 'Returns structured project state from .aws-starter-config.json',
    inputSchema: z.object({
      projectDir: z.string().min(1, 'projectDir is required'),
    }),
  },
  async ({ projectDir }, extra) => {
    // ...handler
  }
);
```

### Pattern 2: Returning isError Responses
**What:** Return `{ content: [{ type: 'text', text: '...' }], isError: true }` for tool-level errors (credential missing, project not found, AWS error).
**When to use:** `MISSING_CREDENTIALS` errors, project-not-found errors, and any caught exception.
**Example:**
```typescript
// Source: node_modules/@modelcontextprotocol/sdk/dist/esm/server/mcp.d.ts + types.d.ts
return {
  content: [{ type: 'text', text: JSON.stringify({ errorType: 'MISSING_CREDENTIALS', message: '...' }) }],
  isError: true,
};
```
Output schema validation is bypassed when `isError: true`, so the response shape is always safe.

### Pattern 3: Progress Notifications
**What:** Emit `notifications/progress` events during long-running operations using `extra.sendNotification()`.
**When to use:** `create_project` and `setup_aws_envs` (per SAFE-04).
**Example:**
```typescript
// Source: node_modules/@modelcontextprotocol/sdk/dist/esm/shared/protocol.d.ts
// + node_modules/@modelcontextprotocol/sdk/dist/esm/types.d.ts (ProgressNotificationSchema)
async (args, extra) => {
  const progressToken = extra._meta?.progressToken;

  if (progressToken !== undefined) {
    await extra.sendNotification({
      method: 'notifications/progress',
      params: { progressToken, progress: 1, total: 4, message: 'Scaffolding project...' },
    });
  }

  // ... do work ...

  if (progressToken !== undefined) {
    await extra.sendNotification({
      method: 'notifications/progress',
      params: { progressToken, progress: 2, total: 4, message: 'Writing config file...' },
    });
  }
}
```
Progress values must increase monotonically. Only send if `progressToken !== undefined`.

### Pattern 4: Structured JSON Success Response
**What:** Return success data as a JSON string in a text content block.
**When to use:** All four tools for their success payloads.
**Example:**
```typescript
return {
  content: [{ type: 'text', text: JSON.stringify({ projectDir: '/path/to/project' }) }],
};
```

### Pattern 5: MISSING_CREDENTIALS Error Type
**What:** A distinct `errorType` field in the isError response body, separate from input validation errors.
**When to use:** When `process.env.AWS_ACCESS_KEY_ID` / `GITHUB_TOKEN` are absent.
**Why distinct:** The CONTEXT.md locks this — callers handle `MISSING_CREDENTIALS` differently from input validation (prompt user to configure env vs. re-call with corrected inputs).
**Example:**
```typescript
// Credential check for setup_aws_envs
if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        errorType: 'MISSING_CREDENTIALS',
        message: 'AWS credentials are not set. Add them to your .mcp.json env block:',
        fix: '{ "env": { "AWS_ACCESS_KEY_ID": "...", "AWS_SECRET_ACCESS_KEY": "..." } }',
        missingVars: ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY'],
      }),
    }],
    isError: true,
  };
}
```

### Anti-Patterns to Avoid
- **Using `server.tool()` instead of `server.registerTool()`:** `tool()` is marked deprecated in SDK 1.x. Use `registerTool()`.
- **Calling `process.exit()` from tool handlers:** The non-interactive functions never call `process.exit()`, but `withCliContext` exists in the utils if needed to intercept. Tool handlers must throw or return `isError: true` — never exit the process.
- **Sending progress without checking progressToken:** Always guard `extra.sendNotification()` with `if (extra._meta?.progressToken !== undefined)`. Sending without a token will cause a protocol error.
- **Throwing unhandled exceptions from tool handlers:** Unhandled throws crash the server. All tool handlers must have a top-level try/catch that returns `isError: true`.
- **Using `detectProjectContext()` without explicit `projectDir`:** The non-interactive CLI functions call `detectProjectContext()` which uses `findUp` from the CWD. In MCP context, CWD may not be the project dir — always `chdir` or override via `process.chdir(projectDir)` before calling, OR refactor to pass `projectDir` directly. The existing `SetupAwsEnvsNonInteractiveConfig` has an optional `projectDir` field for this.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Input schema validation | Custom validation logic | Zod + SDK auto-validation | SDK calls safeParse before invoking callback; validation errors return MCP error automatically |
| Project scaffolding | Re-implement template copying | `generateProject()` + `writeConfigFile()` pattern from cli.ts | All template logic and config writing is already tested |
| GitHub secret setting | Direct GitHub API calls | `runInitializeGitHubNonInteractive()` from create-aws-project | Function handles partial failures, multi-env, and GITHUB_TOKEN reading |
| AWS env setup | Direct AWS SDK calls | `runSetupAwsEnvsNonInteractive()` from create-aws-project | Function handles org creation, account creation, IAM, CDK bootstrap, idempotency |
| Config file reading | JSON.parse directly | `readFile` + typed `ProjectConfigMinimal` interface from `project-context.ts` | Interface already defines the exact shape with all fields |

**Key insight:** The heavy lifting is already done in the `create-aws-project` package. The MCP tools are thin wrappers: validate inputs, check credentials, call the non-interactive function, return structured JSON.

## Common Pitfalls

### Pitfall 1: `create_project` Has No Non-Interactive Export
**What goes wrong:** `runCreateProjectNonInteractive` does not exist as an exported function in `src/index.ts`. The phase requirements say "calls `runCreateProjectNonInteractive()`" but that function must be created as part of this phase.
**Why it happens:** The non-interactive create flow exists only as a local function `runNonInteractive()` inside `cli.ts`.
**How to avoid:** Either (a) extract `runNonInteractive()` from `cli.ts` into a new export, or (b) inline the equivalent logic in the `create_project` tool handler using `loadNonInteractiveConfig` / `generateProject` / `writeConfigFile`.
**Warning signs:** If you try to import `runCreateProjectNonInteractive` from `create-aws-project` before creating it, TypeScript will error.

### Pitfall 2: `detectProjectContext()` Uses CWD, Not projectDir
**What goes wrong:** `runSetupAwsEnvsNonInteractive` and `runInitializeGitHubNonInteractive` call `detectProjectContext()` which searches upward from `process.cwd()`. In an MCP server running via stdio, `cwd` is whatever the host set — NOT the `projectDir` argument.
**Why it happens:** The functions were designed for interactive CLI use where the user is already inside the project dir.
**How to avoid:** Before calling these functions, use `process.chdir(projectDir)`. Or add `projectDir` support to `detectProjectContext()`. The `SetupAwsEnvsNonInteractiveConfig` interface already has an optional `projectDir?: string` field but `detectProjectContext()` ignores it — it only uses `findUp` from cwd.
**Warning signs:** Tool returns "Not inside a project directory" even when `projectDir` is correctly specified.

### Pitfall 3: `ora` (Spinner) Writes to stdout/stderr — Captured by withCliContext
**What goes wrong:** `runSetupAwsEnvsNonInteractive` uses `ora` spinner extensively, writing to stderr. In MCP, the server communicates via stdio — `console.error` writes to stderr go to the MCP client's log, not the tool result.
**Why it happens:** `ora` uses `process.stderr.write` internally.
**How to avoid:** This is actually fine for MCP over stdio — stderr is separate from stdout (which carries MCP protocol messages). The `withCliContext` utility only captures stdout. Spinner output to stderr will appear in MCP server logs, which is appropriate.
**Warning signs:** If MCP protocol messages (stdout) get mixed with spinner output — use `console.error` not `console.log` in non-interactive functions.

### Pitfall 4: `isError: true` vs Throwing
**What goes wrong:** Developer throws an exception from a tool handler instead of returning `isError: true`, causing the SDK to return a protocol-level error rather than a tool-level error.
**Why it happens:** Confusing "server error" vs "tool-reported error" semantics.
**How to avoid:** Tool handlers should catch all exceptions and return `{ content: [{ type: 'text', text: '...' }], isError: true }`. Only let throws propagate if the entire server should be considered broken.
**Warning signs:** MCP Inspector shows a JSON-RPC error instead of a tool result with `isError`.

### Pitfall 5: progress values must increase monotonically
**What goes wrong:** Sending `progress: 2` after `progress: 3` causes a protocol violation.
**Why it happens:** Progress steps added out of order during development.
**How to avoid:** Use a counter starting at 0 that increments each time.
**Warning signs:** MCP client progress bar jumps backward or client disconnects.

### Pitfall 6: `nextSteps` computation for `get_project_status`
**What goes wrong:** `get_project_status` must return a `nextSteps` array "computed from config state" — this logic does not exist anywhere in the codebase and must be written fresh.
**Why it happens:** There is no existing `computeNextSteps()` function. The requirements say compute from config state.
**How to avoid:** Write a pure function: if `accounts` is empty → "Run setup_aws_envs"; if `accounts` is set but `deploymentUsers` is not → "Run setup_aws_envs"; if `deploymentCredentials` is missing envs → "Run initialize_github for missing envs"; otherwise → project is ready.
**Warning signs:** Success criterion 1 will fail if `nextSteps` is missing or always empty.

## Code Examples

Verified patterns from official sources:

### Tool Registration (registerTool - non-deprecated API)
```typescript
// Source: dist/esm/server/mcp.d.ts - registerTool signature
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

server.registerTool(
  'get_project_status',
  {
    title: 'Get Project Status',
    description: 'Returns structured project state from .aws-starter-config.json',
    inputSchema: z.object({
      projectDir: z.string().min(1),
    }),
  },
  async ({ projectDir }, extra) => {
    // handler body
  }
);
```

### Progress Notification Emission
```typescript
// Source: dist/esm/shared/protocol.d.ts (sendNotification type)
//         dist/esm/types.d.ts (ProgressNotificationSchema - method: 'notifications/progress',
//           params: { progressToken, progress, total?, message? })
const progressToken = extra._meta?.progressToken;
let step = 0;
const total = 4;

async function emitProgress(message: string): Promise<void> {
  if (progressToken !== undefined) {
    await extra.sendNotification({
      method: 'notifications/progress',
      params: { progressToken, progress: ++step, total, message },
    });
  }
}
```

### isError Response Pattern
```typescript
// Source: dist/esm/types.d.ts (CallToolResult)
// isError: true bypasses output schema validation
return {
  content: [{ type: 'text', text: JSON.stringify({ errorType: 'MISSING_CREDENTIALS', message, missingVars, fix }) }],
  isError: true,
};
```

### Success Response Pattern
```typescript
// Source: dist/esm/types.d.ts (CallToolResult)
return {
  content: [{ type: 'text', text: JSON.stringify({ projectDir, /* ... */ }) }],
};
```

### What create_project Must Do (no existing export)
```typescript
// Source: src/cli.ts runNonInteractive() + src/config/non-interactive.ts
// src/generator/generate-project.ts + src/generator/copy-file.ts
import { NonInteractiveConfigSchema } from 'create-aws-project/src/config/non-interactive.js';
// OR inline the logic:
// 1. Validate: name (required), outputDir (optional, defaults to cwd), region/platforms/auth etc
// 2. mkdirSync(outputDir, { recursive: true })
// 3. generateProject(config, outputDir, { onProgress: emitProgress })
// 4. writeConfigFile(outputDir, config)  — writes .aws-starter-config.json
// 5. Return { projectDir: outputDir }
```

### get_project_status Config Read
```typescript
// Source: src/utils/project-context.ts (ProjectConfigMinimal interface)
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const configPath = join(projectDir, '.aws-starter-config.json');
const raw = await readFile(configPath, 'utf-8');
const config = JSON.parse(raw) as ProjectConfigMinimal;
// config has: projectName, platforms, awsRegion, configVersion?,
//             accounts?, deploymentUsers?, deploymentCredentials?, adminUser?
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `server.tool()` | `server.registerTool()` | SDK 1.x | `tool()` is now deprecated; use `registerTool()` |
| Raw JSON schema objects for inputSchema | Zod objects | SDK 1.x | SDK accepts both; prefer Zod for type safety |

**Deprecated/outdated:**
- `server.tool()`: Marked `@deprecated` in SDK 1.29.0. Use `server.registerTool()`.

## Open Questions

1. **`runCreateProjectNonInteractive` must be created**
   - What we know: `runNonInteractive()` in `cli.ts` contains the logic but is not exported
   - What's unclear: Whether to extract it into `src/index.ts` exports or inline in the MCP tool handler
   - Recommendation: Extract it as a new export from `create-aws-project` (add to `src/index.ts`) so it can be tested independently. This is the same pattern as `runSetupAwsEnvsNonInteractive` and `runInitializeGitHubNonInteractive`.

2. **`process.chdir(projectDir)` vs refactoring detectProjectContext**
   - What we know: `runSetupAwsEnvsNonInteractive` and `runInitializeGitHubNonInteractive` use `detectProjectContext()` which reads from `process.cwd()`
   - What's unclear: Whether `process.chdir()` is safe to call in an MCP server that handles one request at a time (it is, stdio MCP is single-threaded per connection) or whether a cleaner refactor is needed
   - Recommendation: Pass `projectDir` to `detectProjectContext()` via a temporary `process.chdir(projectDir)` before each call, then restore cwd after. Simpler than refactoring the existing functions. Since stdio MCP is synchronous per request this is safe.

3. **Credential check location for setup_aws_envs**
   - What we know: `runSetupAwsEnvsNonInteractive` uses the AWS SDK which reads from env automatically; it does not explicitly validate credentials exist first
   - What's unclear: Whether the credential check in the tool handler should be explicit (check env vars) or rely on the function throwing an SDK error
   - Recommendation: Explicit check before calling the function — check `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` exist and return `MISSING_CREDENTIALS` immediately. This satisfies the "actionable message" requirement without waiting for an AWS SDK network error.

## Sources

### Primary (HIGH confidence)
- `node_modules/@modelcontextprotocol/sdk/dist/esm/server/mcp.d.ts` — `McpServer.registerTool()` signature, `ToolCallback` type, `RegisteredTool`, deprecation of `tool()` methods
- `node_modules/@modelcontextprotocol/sdk/dist/esm/shared/protocol.d.ts` — `RequestHandlerExtra` type, `sendNotification` method, `_meta?.progressToken` access
- `node_modules/@modelcontextprotocol/sdk/dist/esm/types.d.ts` — `ProgressNotificationSchema` (method, params shape), `ServerNotificationSchema`, `CallToolResult` type
- `src/commands/setup-aws-envs.ts` — `runSetupAwsEnvsNonInteractive` function signature and `SetupAwsEnvsNonInteractiveConfig` interface
- `src/commands/initialize-github.ts` — `runInitializeGitHubNonInteractive`, `InitializeGitHubConfig`, `InitializeGitHubResult` interfaces
- `src/utils/project-context.ts` — `ProjectConfigMinimal` interface (all fields in `.aws-starter-config.json`)
- `src/config/non-interactive.ts` — `NonInteractiveConfigSchema` (all create_project options)
- `src/cli.ts` — `runNonInteractive()` local function (create_project logic to extract)
- `src/generator/generate-project.ts` — `generateProject()` and `GenerateOptions` with `onProgress` callback

### Secondary (MEDIUM confidence)
- Official MCP server.md docs (via WebFetch) — confirmed progress notification pattern with `ctx.mcpReq.notify()` (docs use older API; actual SDK uses `extra.sendNotification()` per protocol.d.ts)

### Tertiary (LOW confidence)
- N/A

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — installed version inspected directly from node_modules
- Architecture (tool registration, progress, isError): HIGH — verified from SDK type definitions in node_modules
- Pitfalls: HIGH for cwd issue and create_project missing export (direct code inspection); MEDIUM for progress monotonicity (verified from type comments)
- create_project logic: HIGH — pattern is clear from cli.ts source

**Research date:** 2026-04-02
**Valid until:** 2026-05-02 (MCP SDK is fast-moving; recheck if SDK version changes)
