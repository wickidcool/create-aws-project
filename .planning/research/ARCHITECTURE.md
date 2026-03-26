# Architecture Patterns: MCP Server Integration

**Domain:** MCP server wrapping an existing TypeScript CLI
**Researched:** 2026-03-25
**Confidence:** HIGH for MCP protocol and SDK; HIGH for stdio conflict analysis (based on official docs + codebase inspection)

---

## Question 1: Direct Import vs Subprocess Invocation

**Recommendation: Direct import. Do not spawn subprocesses.**

The MCP server should import and call CLI functions directly — the same pattern already used internally when `setup-aws-envs` calls `runInitializeGitHub(['--all'])` via a direct import.

**Why not subprocess:**
- Subprocess spawning introduces a second stdio channel that would need its own JSON-RPC protocol. The spawned process's stdout is separate from the MCP server's stdout, but managing two stdio channels from a single process is complex and fragile.
- Error propagation from subprocess to MCP tool response requires parsing exit codes and stderr, which loses structured error information.
- The existing functions are already designed for programmatic invocation (`runSetupAwsEnvsNonInteractive(configPath)`, `runInitializeGitHub(args)`).

**The real problem with direct import:**
The CLI functions use `console.log()`, `ora()` spinners, and `picocolors` — all of which write to **stdout**. The MCP stdio transport specification states:

> "The server MUST NOT write anything to its stdout that is not a valid MCP message."
> "Never use console.log() as it writes to standard output (stdout) by default. Writing to stdout will corrupt the JSON-RPC messages and break your server."

This is the critical architectural challenge. The solution is output capture, not subprocess avoidance.

---

## The Stdout Conflict: Analysis and Resolution

### What the CLI functions write to stdout

Auditing the existing commands:

| Source | Output type | Volume |
|--------|------------|--------|
| `console.log()` in setup-aws-envs | Progress status, summary tables, warnings | High |
| `ora()` spinner `.start()/.succeed()/.fail()/.info()` | Spinner frames and completion lines | High |
| `console.log()` in initialize-github | Status messages, batch summaries | High |
| `picocolors` (pc.green, pc.cyan etc.) | ANSI escape sequences within the above | All |
| `process.exit(1)` | Hard exits on error | Critical |

The functions are **not designed to be silent**. They log liberally throughout execution.

### Resolution: Redirect stdout during execution

The MCP server tool handler must redirect `process.stdout` before calling CLI functions, then restore it after. Node.js allows replacing the `process.stdout.write` method.

```typescript
// Capture pattern — used in each tool handler
async function withSuppressedStdout<T>(fn: () => Promise<T>): Promise<{ result: T; output: string }> {
  const chunks: string[] = [];
  const originalWrite = process.stdout.write.bind(process.stdout);

  process.stdout.write = (chunk: string | Uint8Array, ...args: unknown[]) => {
    chunks.push(typeof chunk === 'string' ? chunk : chunk.toString());
    return true;
  };

  try {
    const result = await fn();
    return { result, output: chunks.join('') };
  } finally {
    process.stdout.write = originalWrite;
  }
}
```

The captured output (stripped of ANSI codes) can be returned to the MCP client as part of the tool response content — this gives the AI agent the same progress information the user would see in a terminal.

### The process.exit() problem

`handleAwsError()` and several error paths call `process.exit(1)`. This will kill the MCP server process entirely if an error occurs in a tool call.

**Resolution:** The MCP server must intercept `process.exit` during tool execution, converting it to a thrown error:

```typescript
async function withExitInterception<T>(fn: () => Promise<T>): Promise<T> {
  const originalExit = process.exit.bind(process);
  let exitCalled = false;
  let exitCode = 0;

  process.exit = ((code?: number) => {
    exitCalled = true;
    exitCode = code ?? 0;
    throw new Error(`process.exit(${exitCode}) intercepted`);
  }) as typeof process.exit;

  try {
    return await fn();
  } catch (error) {
    if (exitCalled) {
      throw new Error(`Command failed with exit code ${exitCode}`);
    }
    throw error;
  } finally {
    process.exit = originalExit;
  }
}
```

Both stdout suppression and exit interception should be combined into a single `withCliContext()` wrapper applied to every tool handler.

### stderr is safe

`console.error()` writes to stderr. Per the MCP spec, the server MAY write to stderr for logging. All error output from the CLI that uses `console.error()` is therefore safe to leave unchanged.

---

## Question 2: Package Structure

**Recommendation: Separate npm package in the same git repository (co-located but not a formal monorepo).**

### Option A: Formal monorepo (nx or turborepo)
- Adds significant tooling overhead
- The existing package is not structured as a workspace
- Overkill for two packages where one depends on the other

### Option B: Separate git repository
- Decouples release cycles, which is premature for a new package
- Requires publishing `create-aws-project` to npm before `create-aws-project-mcp` can depend on it during development
- Harder to keep in sync during active development

### Option C (Recommended): Subdirectory in the same repo, npm workspaces
- Add `"workspaces": ["packages/*"]` to the root `package.json`
- Create `packages/create-aws-project-mcp/` with its own `package.json`
- The MCP package depends on `create-aws-project` via workspace reference: `"create-aws-project": "*"`
- Both packages share the same git history and can be co-developed
- Published separately to npm (each has its own `npm publish`)

### Dependency relationship

`create-aws-project-mcp` should declare `create-aws-project` as a **direct dependency**, not a peer dependency.

**Why not peer dependency:**
- Peer dependencies require the consumer to install both packages. The MCP server is the final consumer — it is not a library that others build upon. There is no reason to push the dependency resolution burden onto users.
- With a direct dependency, `npx create-aws-project-mcp` (or `npx -y create-aws-project-mcp`) pulls in everything needed in one command.

**Version pinning:** The MCP package should pin to the exact version of `create-aws-project` it was tested with, or use a caret range if the CLI's public API is stable. Because the MCP server calls internal functions (not a published API), pin to exact version initially.

---

## Question 3: stdio MCP Server Process Model

**The MCP server is long-running — one process per client session.**

From official MCP documentation (verified at modelcontextprotocol.io):

> "The client launches the MCP server as a subprocess. The server reads JSON-RPC messages from its standard input (stdin) and sends messages to its standard output (stdout)."
> "Local MCP servers that use the STDIO transport typically serve a single MCP client."

The lifecycle:
1. Client (Claude Code, Claude Desktop, Cursor) spawns the MCP server process
2. The server process starts, initializes, and begins listening on stdin
3. Client sends `initialize` → server responds with capabilities
4. Client can then call tools repeatedly — the server handles them one by one
5. Client closes stdin or terminates the process to end the session

**Implications:**
- The process is alive for the entire coding session, not spawned per-call
- State can be held in memory between calls (though the project's tools are stateless)
- Long-running AWS operations (account creation takes minutes) are fine — the server process stays alive while the tool handler awaits
- Startup cost (importing all CLI modules) is paid once per session, not per call

**Tool call concurrency:**
MCP servers receive one request at a time over stdio — there is no concurrent dispatch at the transport level. The server does not need to worry about concurrent tool invocations.

---

## Question 4: .mcp.json Format

**Use npx invocation — not global install, not local path.**

### Format verified from official MCP docs

The `.mcp.json` file (project-scoped MCP configuration for Claude Code) uses the same `mcpServers` key structure as `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "create-aws-project": {
      "command": "npx",
      "args": ["-y", "create-aws-project-mcp"],
      "env": {}
    }
  }
}
```

### Why npx invocation

**Not global install** (`npm install -g create-aws-project-mcp`):
- Requires users to manage a separate install step
- Version drift — user may have old version installed
- Defeats zero-config goal

**Not local path** (`node ./node_modules/.bin/...`):
- Generated projects don't install the MCP package as a dependency
- Would require users to run `npm install` in the generated project just to use MCP tooling

**npx with `-y` flag:**
- Downloads and executes without prompting for confirmation
- Always uses the latest published version (unless version pinned)
- Works immediately after project generation with no additional setup
- Standard pattern used by all major npx-invoked MCP servers (e.g., `@modelcontextprotocol/server-filesystem`)

### Version pinning in generated .mcp.json

For production, consider pinning to a specific version:
```json
"args": ["-y", "create-aws-project-mcp@1.8.0"]
```

This prevents behavior changes when the MCP package is updated. The tradeoff: users don't automatically get fixes. Leave unpinned for the initial v1.8 release; add pinning guidance to the README.

### env field

The `env` field passes environment variables to the MCP server process. The server inherits the parent process environment by default, which means AWS credentials (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_PROFILE`) and GitHub tokens are available automatically when the user has them configured. The `env` field in `.mcp.json` only needs to be populated if the MCP server requires variables that are NOT in the user's environment.

For `create-aws-project-mcp`, the `env` field should be an empty object `{}` in the template — users will configure their own credentials via their shell environment.

---

## Question 5: Changes to Existing CLI Code

### Summary: Minimal changes required; add a separate programmatic API layer

The existing CLI functions (`runSetupAwsEnvsNonInteractive`, `runInitializeGitHub`, `runWizard`) were designed as command handlers, not library functions. They exit the process on error and write freely to stdout. **Do not modify the existing functions** — they work for the CLI use case and modifying them risks breaking existing behavior.

Instead, the MCP package wraps them using the `withCliContext()` utility.

### What must be exported from create-aws-project

The MCP package imports from `create-aws-project`. The following must be accessible as named exports:

| Export | Current status | Action |
|--------|---------------|--------|
| `runSetupAwsEnvsNonInteractive` | Private function in `commands/setup-aws-envs.ts` | Export it |
| `runInitializeGitHub` | Already exported as `export async function runInitializeGitHub` | No change |
| `runSetupAwsEnvs` | Already exported | No change |
| Config schemas (Zod) | In `config/non-interactive-aws.ts` and `config/non-interactive.ts` | Already exported |

**The one required change:** `runSetupAwsEnvsNonInteractive` must be changed from a private function to an exported function. Currently it is defined without `export` inside `commands/setup-aws-envs.ts`.

### No changes to function signatures

The MCP server accepts tool input in JSON (from the AI agent), constructs the arguments the CLI functions expect, and calls them. No changes to function signatures are needed.

For `create_project`, the MCP server will:
1. Accept a JSON object matching the wizard config schema
2. Write it to a temp file
3. Call the existing `--config` path via the non-interactive wizard runner

For `setup_aws_envs`, the MCP server will:
1. Accept `{ email: string }` (or more fields if needed)
2. Write it to a temp file
3. Call `runSetupAwsEnvsNonInteractive(tempFilePath)`

For `initialize_github`, the MCP server will:
1. Accept `{ environments: string[], pat: string, repo?: string }`
2. The PAT cannot be passed via the current function signature — `runInitializeGitHub` prompts for it interactively

**This is a problem:** `runInitializeGitHub` always prompts for the PAT interactively. The `prompts` library writes to stdout (via stdin/stdout in interactive mode), which corrupts MCP stdio.

**Solution for initialize_github:** The MCP package needs a new thin wrapper that accepts the PAT as a parameter and calls the underlying GitHub secrets API directly, bypassing `runInitializeGitHub`. The GitHub client and `setEnvironmentCredentials` function in `src/github/secrets.ts` are already modular enough to call directly.

Alternatively, add `runInitializeGitHubNonInteractive(config)` to the CLI package — similar to the existing `runSetupAwsEnvsNonInteractive` pattern.

---

## Recommended Architecture: Component Boundaries

```
create-aws-project/                    (existing package, minimal changes)
  src/
    commands/
      setup-aws-envs.ts                (export runSetupAwsEnvsNonInteractive)
      initialize-github.ts             (add runInitializeGitHubNonInteractive)
    github/
      secrets.ts                       (already modular, no changes)
    config/
      non-interactive-aws.ts           (already exported)

packages/
  create-aws-project-mcp/
    src/
      index.ts                         (entry point: create server, register tools, start transport)
      tools/
        create-project.ts              (create_project tool handler)
        setup-aws-envs.ts              (setup_aws_envs tool handler)
        initialize-github.ts           (initialize_github tool handler)
        get-project-status.ts          (get_project_status tool handler)
      utils/
        cli-context.ts                 (withCliContext: stdout redirect + exit interception)
        strip-ansi.ts                  (clean ANSI codes from captured output for MCP response)
    package.json
    tsconfig.json
```

### Tool handler pattern

Each tool handler follows this pattern:

```typescript
server.registerTool(
  'setup_aws_envs',
  {
    description: '...',
    inputSchema: { ... }
  },
  async (input) => {
    const { output, error } = await withCliContext(async () => {
      // write input to temp file, call CLI function
      const configPath = await writeTempConfig({ email: input.email });
      await runSetupAwsEnvsNonInteractive(configPath);
    });

    if (error) {
      return {
        content: [{ type: 'text', text: `Setup failed: ${error}\n\nOutput:\n${stripAnsi(output)}` }],
        isError: true
      };
    }

    return {
      content: [{ type: 'text', text: `AWS environments configured successfully.\n\n${stripAnsi(output)}` }]
    };
  }
);
```

---

## Build Order

The MCP package depends on built output from `create-aws-project`. The correct build sequence:

1. Build `create-aws-project`: `npm run build` in root → produces `dist/`
2. Build `create-aws-project-mcp`: `npm run build` in `packages/create-aws-project-mcp/` → produces its own `dist/`
3. Both packages publish independently to npm

With npm workspaces, a root-level `npm run build` script can sequence them:
```json
"build": "tsc && npm run build --workspace=packages/create-aws-project-mcp"
```

**What must exist before MCP can work:**
- `runSetupAwsEnvsNonInteractive` exported from CLI package
- `runInitializeGitHubNonInteractive` added to CLI package (new function)
- CLI package built (`dist/` present) for workspace local resolution

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Spawning the CLI as a subprocess from the MCP server

**What:** `child_process.spawn('npx', ['create-aws-project', 'setup-aws-envs', '--config', '...'])`

**Why bad:** Adds latency, complicates error handling, requires parsing unstructured text output, and creates a dependency on the CLI being in PATH. The whole point of direct import is avoiding this.

### Anti-Pattern 2: Modifying CLI functions to accept a "silent" mode flag

**What:** Adding `{ silent: boolean }` to every CLI function signature and branching all output behind that flag.

**Why bad:** Invasive change to working code. Changes every call site. Risks introducing bugs in the interactive path. The stdout-redirect wrapper achieves the same goal non-invasively.

### Anti-Pattern 3: Making the MCP server stateful between calls

**What:** Caching project state in memory in the MCP server process.

**Why bad:** The MCP server is long-running but the user may switch working directories between calls. Always read state fresh from `.aws-starter-config.json` on each tool call. The `requireProjectContext()` utility already does this correctly.

### Anti-Pattern 4: Using console.log anywhere in MCP server code

**What:** `console.log('Tool called:', toolName)`

**Why bad:** Writes to stdout, corrupting MCP JSON-RPC messages. Use `console.error()` for all diagnostic output in the MCP package.

### Anti-Pattern 5: Putting the MCP package inside src/ of the existing package

**What:** Adding MCP server code to `src/mcp/` in the existing package.

**Why bad:** The existing package's `bin` is `create-aws-project`. Adding MCP server code conflates two different executables. The MCP server needs its own `bin` entry, its own `package.json` name (`create-aws-project-mcp`), and independent versioning. Keeping them as sibling packages in workspaces is cleaner.

---

## Scalability Considerations

These are not relevant for this use case — the MCP server runs locally on the developer's machine, serves one AI agent session at a time, and the bottleneck is always AWS API latency (minutes for account creation). No scalability concerns apply.

---

## Sources

- MCP Transport specification (verified current): https://modelcontextprotocol.io/docs/concepts/transports
- MCP Architecture overview: https://modelcontextprotocol.io/docs/concepts/architecture
- MCP Build Server guide with TypeScript code examples: https://modelcontextprotocol.io/docs/develop/build-server
- MCP Connect Local Servers (claude_desktop_config.json format): https://modelcontextprotocol.io/docs/develop/connect-local-servers
- `@modelcontextprotocol/sdk` v1.28.0 exports map (verified via `npm info`): import paths are `@modelcontextprotocol/sdk/server/mcp.js` for `McpServer` and `@modelcontextprotocol/sdk/server/stdio.js` for `StdioServerTransport`
- Existing codebase audit: `/Users/alwick/development/projects/create-aws-project/src/commands/setup-aws-envs.ts` and `initialize-github.ts` read directly

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| MCP stdio process model (long-running) | HIGH | Verified from official MCP spec |
| stdout conflict and resolution strategy | HIGH | MCP spec explicitly prohibits stdout; stdout-redirect is established Node.js pattern |
| Import paths for @modelcontextprotocol/sdk | HIGH | Verified via npm info exports map and official build-server tutorial |
| .mcp.json format with npx invocation | HIGH | Verified pattern from MCP official docs (same mcpServers format as claude_desktop_config.json) |
| runSetupAwsEnvsNonInteractive export gap | HIGH | Confirmed via direct codebase audit — function exists but lacks export keyword |
| runInitializeGitHub PAT prompt problem | HIGH | Confirmed via codebase audit — always prompts interactively, no non-interactive path |
| npm workspaces approach | MEDIUM | Standard approach; workspaces config in root package.json not yet present, requires migration step |
