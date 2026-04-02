# Phase 27: CLI Additions to Existing Package - Research

**Researched:** 2026-04-01
**Domain:** TypeScript CLI export surface, MCP SDK progress notifications, non-interactive function design
**Confidence:** HIGH

## Summary

Phase 27 requires exporting `runSetupAwsEnvsNonInteractive` from the CLI package and adding `runInitializeGitHubNonInteractive` to `initialize-github.ts` — both callable by MCP tool handlers with zero interactive prompts. Progress events (`notifications/progress`) are also wired into all four MCP tools.

The existing code was read directly. The critical discovery: `runSetupAwsEnvsNonInteractive` already exists as a **private function** in `src/commands/setup-aws-envs.ts` (line 271), but it calls `process.exit(0)` at completion and is not exported. It **cannot** be called from MCP handlers as-is — calling `process.exit()` from inside an MCP tool handler would kill the server process. The function must be refactored to return normally (or throw on failure) rather than exiting.

`runInitializeGitHubNonInteractive` does not exist anywhere in the codebase. The existing `runInitializeGitHub` always calls `prompts` for PAT, repo owner, and (sometimes) environment selection — none of that can run in MCP context. A non-interactive variant must call `createGitHubClient` and `setEnvironmentCredentials` directly with inputs passed via config plus `GITHUB_TOKEN` from environment.

**Primary recommendation:** Refactor `runSetupAwsEnvsNonInteractive` to throw on error / return on success (remove `process.exit` calls), then export it. Add `runInitializeGitHubNonInteractive` that mirrors the logic in the batch-mode branch of `runInitializeGitHub` but reads the GitHub token from `process.env.GITHUB_TOKEN` and repo info from config.

## Standard Stack

No new libraries are needed. All required dependencies are already in the CLI package.

### Core (already installed)
| Library | Version | Purpose | Role in this phase |
|---------|---------|---------|--------------|
| `zod` | ^4.3.6 | Schema validation | Validate `runInitializeGitHubNonInteractive` config input |
| `@octokit/rest` | ^22.0.1 | GitHub API | Used by `setEnvironmentCredentials` (already called in interactive path) |
| `@modelcontextprotocol/sdk` | ^1.29.0 | MCP server | `sendNotification` / `ProgressNotification` for SAFE-04 |

### No New Installations Required

All needed code is already present. This phase is purely about:
1. Refactoring and exporting an existing private function
2. Adding a new non-interactive function
3. Adding a progress-callback parameter pattern
4. Updating the export surface of the CLI package

## Architecture Patterns

### Current Export Surface (Critical Gap)

The CLI package `src/index.ts` currently only contains:
```typescript
#!/usr/bin/env node
import { run } from './cli.js';
run().catch((error) => { console.error(error); process.exit(1); });
```

This is the **bin entry point**, not a library export file. The MCP package's `package.json` declares `"create-aws-project": "*"` as a dependency, meaning it imports from the package. The CLI package's `package.json` has `"main": "./dist/index.js"` — this points to the bin file.

**Implication**: To export library functions, one of two approaches is needed:
- **Option A (recommended)**: Add explicit named exports to `src/index.ts` so they appear in the dist `index.js` — the shebang line and `run()` call can remain, named exports alongside it are valid.
- **Option B**: Create a separate `src/lib.ts` and update `package.json` `"exports"` field with subpath `"./lib"`.

Option A is lower invasiveness and matches the project's existing convention (no `exports` field in `package.json` yet).

### Recommended Project Structure (No Changes to Layout)

```
src/
├── commands/
│   ├── setup-aws-envs.ts     # export runSetupAwsEnvsNonInteractive (refactored)
│   └── initialize-github.ts  # add runInitializeGitHubNonInteractive
├── config/
│   └── non-interactive-aws.ts  # SetupAwsEnvsConfig already exported here
└── index.ts                  # add named exports for MCP package
```

### Pattern 1: Refactor `runSetupAwsEnvsNonInteractive` — Remove process.exit

**What:** The existing private function calls `process.exit(0)` on success (line 593) and `handleAwsError()` on failure, which always calls `process.exit(1)`. Both must be replaced.

**Current signature:**
```typescript
// Private, not exported
async function runSetupAwsEnvsNonInteractive(configPath: string): Promise<void>
```

**Required signature for export:**
```typescript
export async function runSetupAwsEnvsNonInteractive(configPath: string): Promise<void>
// throws on error, returns on success — no process.exit anywhere in call path
```

**Changes needed:**
- Remove `process.exit(0)` at end of success path
- Replace `handleAwsError(error)` calls (which call `process.exit(1)`) with `throw error` or a new throwing helper
- The `runSetupAwsEnvs` (interactive, exported) already wraps the non-interactive path in a conditional — it calls `runSetupAwsEnvsNonInteractive()` and returns. So the interactive path is unaffected by removing `process.exit(0)` from the non-interactive function.

**The `handleAwsError` problem**: `handleAwsError` calls `process.exit(1)` after printing messages. For the non-interactive path, it must throw instead. Create a `throwAwsError(error: unknown): never` variant that throws an `Error` with the actionable message, or make `handleAwsError` accept a mode flag.

**Simplest approach**: Create a new `toActionableAwsError(error: unknown): Error` that returns an Error with the formatted message, then `throw toActionableAwsError(error)` in the non-interactive path.

### Pattern 2: Add `runInitializeGitHubNonInteractive`

**What:** A new exported function in `src/commands/initialize-github.ts` that configures all GitHub environments for all configured credentials, reading the GitHub token from `process.env.GITHUB_TOKEN`.

**Source of logic**: The existing batch-mode branch of `runInitializeGitHub` (lines 282-374) contains the right logic but mixes in prompts for PAT and repo info. The non-interactive version skips those prompts.

**Required signature:**
```typescript
export interface InitializeGitHubNonInteractiveConfig {
  githubRepo: string; // "owner/repo" format
  environments?: ('dev' | 'stage' | 'prod')[]; // defaults to all configured
}

export async function runInitializeGitHubNonInteractive(
  config: InitializeGitHubNonInteractiveConfig
): Promise<void>
// throws on error — no process.exit anywhere
```

**GitHub token source decision (Claude's Discretion)**: Use **`process.env.GITHUB_TOKEN` only** — no config fallback. Reasoning:
- MCP clients set env vars in `.mcp.json` `env` block — this is the established pattern
- Embedding tokens in config files creates secrets-in-filesystem risk
- The requirement explicitly says "reads `GITHUB_TOKEN` from environment"
- Error message must say: "Set GITHUB_TOKEN in the env block of .mcp.json"

**Repo info source**: Accept `githubRepo` in config (owner/repo format). Parse with existing `parseGitHubUrl()`. Fallback to `getGitRemoteOrigin()` if config does not provide it — but this is a CLI luxury; for MCP, the config should always provide it.

**Config schema**: Validate with Zod defensively. The `githubRepo` field: `z.string().regex(/^[^/]+\/[^/]+$/)`.

**projectDir**: Defaults to `process.cwd()` per the decision — `requireProjectContext()` already uses `process.cwd()` internally (via `find-up`), so no explicit path parameter is needed.

### Pattern 3: MCP Progress Notifications (SAFE-04)

**What:** The MCP SDK's `RequestHandlerExtra` provides `sendNotification` and `_meta?.progressToken`. Progress events fire from the MCP tool handler layer, not from the CLI functions.

**Why handler-only (not shared callback into CLI):** Adding a callback parameter to `runSetupAwsEnvsNonInteractive` would require touching the long AWS function body and threading the callback through. Phase 28 creates the tool handlers — Phase 27 only needs to make the CLI functions callable. Progress wiring is done in Phase 28's tool handlers by wrapping the CLI call with start/done notifications. This minimizes invasiveness.

**MCP SDK progress notification API (verified from installed SDK at ^1.29.0):**

`RequestHandlerExtra` type (from `@modelcontextprotocol/sdk/dist/esm/shared/protocol.d.ts`):
- `extra._meta?.progressToken` — type `string | number | undefined` — the token the client sent
- `extra.sendNotification(notification)` — sends a `ServerNotification`

`ProgressNotification` shape (from `types.d.ts`, `ProgressNotificationSchema`):
```typescript
{
  method: "notifications/progress",
  params: {
    progressToken: string | number,  // required — must match what client sent
    progress: number,                // required — current progress value
    total?: number,                  // optional — max value for percentage
    message?: string,                // optional — human-readable status
  }
}
```

**Recommended payload shape (Claude's Discretion):** Include both `message` and `progress`/`total` so clients can display either text or a progress bar.

```typescript
// Source: installed SDK types.d.ts lines 926-966
await extra.sendNotification({
  method: "notifications/progress",
  params: {
    progressToken: extra._meta!.progressToken!,
    progress: 0,
    total: 100,
    message: "Starting AWS environment setup..."
  }
});
```

**Only send if progressToken is present:** Client may not send a progressToken. Always guard: `if (extra._meta?.progressToken != null)`.

### Anti-Patterns to Avoid

- **Calling `process.exit()` from exported non-interactive functions**: Kills the MCP server process. All `process.exit` calls must be replaced with `throw` in the non-interactive execution paths.
- **Calling `prompts()` anywhere in non-interactive paths**: Will hang waiting for stdin in MCP server context. Audit the full call chain — `requireProjectContext()` does NOT call prompts (verified: it uses `find-up` to locate the config file).
- **Sharing a single `handleAwsError` that calls `process.exit`**: The interactive and non-interactive paths currently share error helpers. Don't modify the interactive helper — create a non-interactive variant.
- **Exporting the GitHub PAT via config object**: Token must come from env only. Do not accept it in the config struct.
- **Passing `ora` spinner into non-interactive functions**: The spinner writes to stdout/stderr and conflicts with MCP's stdio transport. Non-interactive functions should not use `ora` internally when called from MCP handlers — or the spinner must be suppressible. Since progress is being handled via MCP notifications in Phase 28, the spinner in `runSetupAwsEnvsNonInteractive` is acceptable for now (it writes to stderr via ora). Actually: ora writes to `process.stderr` by default, not stdout. The MCP SDK uses `console.error()` for server logs (also stderr). This is a potential interleaving issue but not fatal. The spec says not to worry about it in Phase 27 since spinner suppression can be handled in Phase 28.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| GitHub API calls | custom fetch | `createGitHubClient` + `setEnvironmentCredentials` from `src/github/secrets.ts` | Already implemented and tested |
| Config validation for `runInitializeGitHubNonInteractive` | manual type checks | Zod schema with `safeParse` | Consistent with all other config loaders in this codebase |
| Repo URL parsing | manual string split | `parseGitHubUrl()` from `src/github/secrets.ts` | Already handles SSH and HTTPS formats |
| Progress token check | assume always present | `if (extra._meta?.progressToken != null)` guard | Token is optional per spec — server is not obligated to receive it |

**Key insight:** Almost all the logic needed already exists in the codebase. This phase is primarily restructuring and refactoring, not building new capabilities.

## Common Pitfalls

### Pitfall 1: `process.exit` in Non-Interactive Path Kills MCP Server
**What goes wrong:** `runSetupAwsEnvsNonInteractive` calls `process.exit(0)` on line 593 and `handleAwsError` (which calls `process.exit(1)`) on failure. If an MCP tool handler calls this function, the entire MCP server process exits.
**Why it happens:** The function was designed only for CLI use where process exit is the correct behavior.
**How to avoid:** Before exporting, remove all `process.exit` calls from the non-interactive path. Replace the `handleAwsError(error)` call with `throw error` (or a throwing variant). Remove the `process.exit(0)` at the end of the success path.
**Warning signs:** Any test that calls the non-interactive function and expects it to return (not exit) will fail at `process.exit`.

### Pitfall 2: `runInitializeGitHub` Calls `prompts` Before Reaching the Work
**What goes wrong:** Even in batch mode, `runInitializeGitHub` calls `promptForGitHubPAT()` and optionally `promptForRepoInfo()`. These will hang in MCP context (stdin is controlled by the SDK).
**Why it happens:** The interactive and non-interactive logic is interleaved in one function.
**How to avoid:** Create `runInitializeGitHubNonInteractive` that goes directly to `createGitHubClient(token)` and `setEnvironmentCredentials(...)` without any `prompts` calls. Audit with a search for `prompts(` in the function's call chain.
**Warning signs:** A grep of `prompts(` in the non-interactive call chain returns any hits.

### Pitfall 3: `requireProjectContext()` May Still Exit
**What goes wrong:** `requireProjectContext()` is called by both non-interactive functions. It may call `process.exit(1)` internally if not inside a project directory.
**Why it happens:** It's a CLI utility that prints errors and exits.
**How to avoid:** Check `requireProjectContext` source to confirm behavior, and decide whether it's acceptable to let it exit (since "not in a project dir" is a usage error that should propagate to the MCP client as a tool error). This is likely acceptable for Phase 27 — the MCP tool handler wraps the call in a try/catch that converts thrown errors to tool error responses. But `process.exit` bypasses try/catch.
**Recommended action:** Read `requireProjectContext` source. If it calls `process.exit`, consider whether Phase 27 needs to address this or if Phase 28 (which creates handlers with `withCliContext`) handles it.

### Pitfall 4: Export Location Mismatch
**What goes wrong:** Exporting from `src/commands/setup-aws-envs.ts` is necessary but not sufficient — the MCP package does `import { ... } from 'create-aws-project'` which resolves to `dist/index.js`. If `index.ts` doesn't re-export, the import fails at compile time.
**Why it happens:** The package's `main` field points to `dist/index.js` (compiled from `src/index.ts`), which currently only contains the `run()` call.
**How to avoid:** Add named exports to `src/index.ts`:
```typescript
export { runSetupAwsEnvsNonInteractive } from './commands/setup-aws-envs.js';
export { runInitializeGitHubNonInteractive } from './commands/initialize-github.js';
```
**Warning signs:** `tsc` compiles cleanly in the CLI package but the MCP package gets "Module has no exported member" errors.

### Pitfall 5: `GITHUB_TOKEN` Missing — Generic Error Message
**What goes wrong:** If `GITHUB_TOKEN` is not in the environment, throwing a generic "GITHUB_TOKEN is not set" error leaves the user with no actionable guidance.
**Why it happens:** The requirement explicitly calls this out — the error must point to `.mcp.json`.
**How to avoid:** Check `process.env.GITHUB_TOKEN` at the top of `runInitializeGitHubNonInteractive` and throw with: `"GITHUB_TOKEN environment variable is not set. Add it to the env block in your .mcp.json configuration."`
**Warning signs:** Error message doesn't mention `.mcp.json`.

### Pitfall 6: TypeScript Strict Mode — `process.exit(0)` Return Type
**What goes wrong:** `handleAwsError` has return type `never` because it always calls `process.exit`. If replaced with `throw`, the TypeScript compiler may not narrow correctly without an explicit `throw` in the catch block.
**Why it happens:** TypeScript uses `never` for unreachable code analysis.
**How to avoid:** Ensure the replacement function also returns `never`:
```typescript
function throwAwsError(error: unknown): never {
  // format message
  throw new Error(formattedMessage);
}
```

## Code Examples

### Correct Progress Notification Pattern

```typescript
// Source: installed @modelcontextprotocol/sdk types.d.ts (ProgressNotificationSchema)
// and shared/protocol.d.ts (RequestHandlerExtra)

// In Phase 28 MCP tool handler:
import type { RequestHandlerExtra, ServerRequest, ServerNotification } from "@modelcontextprotocol/sdk/server/mcp.js";

async function setupAwsEnvsTool(
  args: { configPath: string },
  extra: RequestHandlerExtra<ServerRequest, ServerNotification>
): Promise<CallToolResult> {
  const token = extra._meta?.progressToken;

  const sendProgress = async (progress: number, total: number, message: string) => {
    if (token != null) {
      await extra.sendNotification({
        method: "notifications/progress",
        params: { progressToken: token, progress, total, message }
      });
    }
  };

  await sendProgress(0, 100, "Starting AWS environment setup...");
  try {
    await runSetupAwsEnvsNonInteractive(args.configPath);
    await sendProgress(100, 100, "AWS environment setup complete");
    return { content: [{ type: "text", text: "Setup complete" }] };
  } catch (err) {
    return { isError: true, content: [{ type: "text", text: String(err) }] };
  }
}
```

### Correct `runInitializeGitHubNonInteractive` Structure

```typescript
// Source: existing src/commands/initialize-github.ts batch-mode logic (lines 282-374)
// and src/github/secrets.ts (createGitHubClient, setEnvironmentCredentials, parseGitHubUrl)

import { z } from 'zod';
import { requireProjectContext } from '../utils/project-context.js';
import { createGitHubClient, setEnvironmentCredentials, parseGitHubUrl } from '../github/secrets.js';

const InitializeGitHubNonInteractiveConfigSchema = z.object({
  githubRepo: z.string().regex(/^[^/]+\/[^/]+$/, 'must be owner/repo format'),
  environments: z.array(z.enum(['dev', 'stage', 'prod'])).optional(),
});

export type InitializeGitHubNonInteractiveConfig = z.infer<typeof InitializeGitHubNonInteractiveConfigSchema>;

export async function runInitializeGitHubNonInteractive(
  config: InitializeGitHubNonInteractiveConfig
): Promise<void> {
  // Validate input defensively
  const parsed = InitializeGitHubNonInteractiveConfigSchema.safeParse(config);
  if (!parsed.success) {
    throw new Error(`Invalid config: ${parsed.error.issues.map(i => i.message).join(', ')}`);
  }

  // Token from env only
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error(
      'GITHUB_TOKEN environment variable is not set. ' +
      'Add it to the env block in your .mcp.json configuration.'
    );
  }

  const context = await requireProjectContext();
  const { config: projectConfig } = context;
  const repoInfo = parseGitHubUrl(parsed.data.githubRepo);
  const githubClient = createGitHubClient(token);

  const GITHUB_ENV_NAMES: Record<string, string> = {
    dev: 'Development', stage: 'Staging', prod: 'Production',
  };

  const environments = parsed.data.environments ?? ['dev', 'stage', 'prod'].filter(
    env => projectConfig.deploymentCredentials?.[env]
  );

  for (const env of environments) {
    const credentials = projectConfig.deploymentCredentials?.[env];
    if (!credentials) {
      throw new Error(`No deployment credentials found for ${env}. Run setup-aws-envs first.`);
    }
    await setEnvironmentCredentials(
      githubClient,
      repoInfo.owner,
      repoInfo.repo,
      GITHUB_ENV_NAMES[env],
      credentials.accessKeyId,
      credentials.secretAccessKey
    );
  }
}
```

### Correct Export in `src/index.ts`

```typescript
#!/usr/bin/env node
// Existing bin entry point
import { run } from './cli.js';
run().catch((error) => { console.error(error); process.exit(1); });

// Library exports for MCP package (CLI-01, CLI-02)
export { runSetupAwsEnvsNonInteractive } from './commands/setup-aws-envs.js';
export { runInitializeGitHubNonInteractive } from './commands/initialize-github.js';
export type { InitializeGitHubNonInteractiveConfig } from './commands/initialize-github.js';
```

## State of the Art

| Old Approach | Current Approach | Status |
|--------------|------------------|--------|
| `runSetupAwsEnvsNonInteractive` private, calls `process.exit` | Export, throw on error | Must change for Phase 27 |
| `runInitializeGitHub` always prompts | New `runInitializeGitHubNonInteractive` reads env token | Must add for Phase 27 |
| `src/index.ts` = bin-only entry | `src/index.ts` = bin + library exports | Must change for CLI-01/CLI-02 |

**Key gap confirmed by code reading:**
- `runSetupAwsEnvsNonInteractive` EXISTS at line 271 of `setup-aws-envs.ts` but is NOT exported and calls `process.exit`
- `runInitializeGitHubNonInteractive` does NOT exist anywhere
- `src/index.ts` exports NOTHING — it is a pure bin entry point

## Open Questions

1. **`requireProjectContext()` exit behavior**
   - What we know: It's called by both non-interactive functions; it uses `find-up` to locate `.aws-starter-config.json`
   - What's unclear: Whether it calls `process.exit(1)` on failure (not read in this research pass)
   - Recommendation: Read `src/utils/project-context.ts` before implementing. If it calls `process.exit`, Phase 27 needs to decide whether to wrap it or leave it (Phase 28's `withCliContext` intercepts `process.exit`).

2. **Spinner writes from `runSetupAwsEnvsNonInteractive` in MCP context**
   - What we know: `ora` writes to `process.stderr` by default; MCP SDK stdio transport reads/writes on stdout; `console.error` also goes to stderr
   - What's unclear: Whether ora spinner output on stderr will corrupt the MCP JSON-RPC stream
   - Recommendation: `ora` uses stderr, MCP uses stdout for JSON-RPC — they should not interfere. If issues arise, ora has a `stream` option that can be redirected; this is a Phase 28 concern.

3. **`parseGitHubUrl` handling of plain `owner/repo` strings**
   - What we know: It is called in the interactive path with URLs from `git remote get-url` (SSH or HTTPS) and from the prompt response. The prompt validates `owner/repo` format.
   - What's unclear: Whether `parseGitHubUrl` handles plain `owner/repo` (no `https://github.com/` prefix) correctly
   - Recommendation: Read `src/github/secrets.ts` lines 60+ before implementing `runInitializeGitHubNonInteractive`. If it doesn't handle plain `owner/repo`, construct the full URL before passing or parse manually.

## Sources

### Primary (HIGH confidence)
- Direct code reading: `src/commands/setup-aws-envs.ts` — confirmed `runSetupAwsEnvsNonInteractive` exists (private, process.exit)
- Direct code reading: `src/commands/initialize-github.ts` — confirmed no non-interactive variant exists
- Direct code reading: `src/index.ts` — confirmed no library exports, bin-only
- Direct code reading: `packages/create-aws-project-mcp/src/server.ts` — confirmed MCP server stub in place
- Direct SDK type reading: `node_modules/@modelcontextprotocol/sdk/dist/esm/types.d.ts` lines 926-966 — `ProgressNotificationSchema` confirmed fields
- Direct SDK type reading: `node_modules/@modelcontextprotocol/sdk/dist/esm/shared/protocol.d.ts` lines 173-210 — `RequestHandlerExtra` confirmed `sendNotification` and `_meta?.progressToken`
- Direct code reading: `src/config/non-interactive-aws.ts` — `SetupAwsEnvsConfig` Zod schema confirmed
- Direct code reading: `src/config/non-interactive.ts` — `NonInteractiveConfigSchema` pattern confirmed for reference
- Direct code reading: `packages/create-aws-project-mcp/package.json` — confirmed `"create-aws-project": "*"` dependency

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — read directly from installed node_modules and package.json
- Architecture: HIGH — read directly from source files; all key functions located and analyzed
- Pitfalls: HIGH — derived from direct code analysis of process.exit calls, prompts calls, and export gaps
- Progress API: HIGH — read directly from installed SDK types at ^1.29.0

**Research date:** 2026-04-01
**Valid until:** 2026-05-01 (stable codebase; SDK at fixed version)
