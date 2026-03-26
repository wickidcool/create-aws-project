# MCP Server Pitfalls: Wrapping an Existing Node.js CLI

**Domain:** MCP server implementation wrapping create-aws-project CLI
**Researched:** 2026-03-25
**Context:** v1.8 milestone — adding `create-aws-project-mcp` package as a separate npm package

---

## Critical Pitfalls

Mistakes that cause silent failures, protocol corruption, or require architectural rewrites.

---

### Pitfall 1: stdout Corruption from console.log and prompts Library

**What goes wrong:** Any call to `console.log()`, `process.stdout.write()`, or the `prompts` library writes plain text to stdout. The MCP client reads stdout as the JSON-RPC protocol channel. Non-JSON content injected into the stream produces unparseable messages, causing the client to terminate the connection immediately or silently — with no useful error message.

**Why it happens:** The existing CLI code was written for terminal use. `console.log()` defaults to `process.stdout`. The `prompts` library explicitly defaults to `process.stdout` for rendering interactive prompts (confirmed in `node_modules/prompts/dist/elements/prompt.js:27`). Every call site that writes to stdout in the CLI codebase is a protocol corruption risk.

**Affected code in this project:**
- `src/commands/setup-aws-envs.ts`: Uses `prompts` (reads stdin, writes stdout) for email collection, AWS credentials, and continuation prompts. Has 15+ `console.log()` calls.
- `src/commands/initialize-github.ts`: Uses `prompts` for GitHub PAT input and environment selection. Has multiple `console.log()` calls.
- `src/cli.ts`: Writes "Next steps" banner and success message via `console.log()`.
- `src/wizard.ts`: Full interactive wizard using `prompts` for all 7 questions.

**The ora spinner situation (mostly safe but watch succeed/fail):** `ora` defaults its stream to `process.stderr`, not stdout (confirmed in `node_modules/ora/index.js:122`). Spinner rendering is safe. However, `ora` hooks `process.stdout` internally when a spinner is active to intercept concurrent writes — this hooking mechanism itself does not write to stdout, but it does mean ora is aware of stdout writes from other code. `spinner.succeed()` and `spinner.fail()` write to `this.#stream` which defaults to stderr — safe. But `console.log()` calls interleaved with spinner activity still go to stdout.

**Consequences:**
- MCP client gets malformed JSON-RPC stream
- Connection terminates without actionable error message
- Debugging is difficult because the corruption is silent from the server's perspective

**Prevention:**

The MCP server layer must NEVER call the interactive CLI code paths directly. The correct architecture:

1. The MCP server calls the non-interactive (`--config`) code paths only — these paths skip all `prompts` calls and most `console.log()` calls.
2. All `console.log()` and `console.error()` calls inside any function reachable from an MCP tool handler must be redirected to `process.stderr` or suppressed.
3. The safest approach is to import only the pure computation functions (config parsing, generation logic, AWS SDK calls) — not the CLI entry points.

```typescript
// BAD: Calls CLI code that writes to stdout
import { runSetupAwsEnvs } from './commands/setup-aws-envs.js';

// GOOD: Calls only the non-interactive core logic
import { runSetupAwsEnvsNonInteractive } from './commands/setup-aws-envs.js';
```

The official MCP documentation states explicitly: "The server MUST NOT write anything to its stdout that is not a valid MCP message" and "Local MCP servers should not log messages to stdout (standard out), as this will interfere with protocol operation." (Source: [MCP Transports spec](https://modelcontextprotocol.io/docs/concepts/transports), [MCP Debugging guide](https://modelcontextprotocol.io/docs/tools/debugging))

**Logging replacement:** All progress messages should use `process.stderr.write()` or the MCP SDK's `server.sendLoggingMessage()` (which sends `notifications/message` over the protocol channel to the client).

**Detection (warning signs):**
- MCP client disconnects immediately after tool invocation
- Inspector shows no response for a tool call
- `mcp-server-*.log` file in Claude Desktop logs is empty or shows the server started but no tool responses appear

**Phase assignment:** Phase 1 — must be solved before any tool can work

**Confidence:** HIGH — confirmed by official MCP spec, official MCP debugging docs, direct source inspection of `prompts` and `ora` libraries

---

### Pitfall 2: Working Directory is Undefined (or Root `/`) for File Operations

**What goes wrong:** `setup_aws_envs` and `initialize_github` tools use `find-up` to locate `.aws-starter-config.json` by walking upward from `process.cwd()`. When launched by Claude Desktop or Cursor via the MCP config, the server's working directory is whatever directory the IDE was launched from — often the home directory, the project directory, or `/` on macOS. It is never guaranteed to be the user's generated project directory.

**Why it happens:** The MCP client launches the server as a subprocess. The client (Claude Desktop, Cursor) may be started from any directory, or by the OS launcher. The MCP protocol provides no mechanism to inherit the user's current terminal directory. The official MCP debugging guide documents this explicitly: "The working directory for servers launched via the client's config may be undefined (like `/` on macOS) since the client could be started from anywhere."

**Consequences:**
- `find-up('.aws-starter-config.json')` returns `undefined`
- `setup_aws_envs` and `initialize_github` tools fail with "No project config found"
- The failure message is confusing — the config file exists on disk, but the server can't find it
- The same tool works fine when called from the terminal (where cwd is set) but fails from Claude/Cursor

**Prevention:**

The MCP tools that operate on an existing project (setup_aws_envs, initialize_github, get_project_status) must accept the project directory as an explicit tool input parameter:

```typescript
// Tool input schema for project-context tools
{
  projectDir: {
    type: "string",
    description: "Absolute path to the generated project directory containing .aws-starter-config.json"
  }
}
```

The tool handler then resolves the config relative to `projectDir`, not `process.cwd()`:

```typescript
const configPath = path.join(args.projectDir, '.aws-starter-config.json');
```

For `create_project`, the tool must accept an `outputDir` parameter (where to create the project) and return the absolute path of the created project in the tool result, so subsequent tools can reference it.

The `.mcp.json` template placed in generated projects can hint the working directory concept via description, but cannot force cwd — the tool parameters are the only reliable mechanism.

**Detection (warning signs):**
- Tool returns "No project config found" or similar
- Works from terminal, fails in Claude Code / Cursor
- `find-up` returns `undefined` in MCP context

**Phase assignment:** Phase 1 — tool schema design must account for this before any tools are built

**Confidence:** HIGH — confirmed by official MCP debugging docs, and verified against `find-up` usage in the existing codebase

---

## Critical Pitfalls (Protocol and Tooling)

---

### Pitfall 3: Long-Running Tools and Client-Side Timeouts

**What goes wrong:** `setup_aws_envs` takes 2-5 minutes (AWS account creation involves polling). `create_project` takes 30-60 seconds (npm install). MCP clients impose request timeouts. If the tool takes longer than the timeout, the client cancels the request and the user sees a timeout error — even if the operation completed successfully on the server.

**What the spec says:** The MCP lifecycle spec states: "Implementations SHOULD establish timeouts for all sent requests... The sender SHOULD issue a cancellation notification for that request." Clients MAY reset the timeout clock when receiving progress notifications. Clients SHOULD enforce a maximum timeout regardless.

**Claude Code's behavior (observed):** Claude Code uses the MCP SDK default timeout of 60 seconds for tool calls. This is configurable per-request in the SDK but clients use their own defaults. The 60-second default would be exceeded by `setup_aws_envs` in most cases.

**Consequences:**
- User gets "Tool call timed out" from Claude Code / Cursor
- The server-side operation may still be running (orphaned process)
- The config file may be partially written (AWS accounts created but not all IAM users)
- Re-running is safe due to idempotency, but the user doesn't know what state they're in

**Prevention:**

Two complementary strategies:

1. **Progress notifications:** The MCP server should emit `notifications/progress` messages during long operations. If the client's `tools/call` request included a `progressToken`, the server sends progress updates. This MAY reset the client's timeout clock (per spec). The server can send these from inside the AWS SDK polling loop.

2. **Accept the timeout reality:** Tools that genuinely take longer than any reasonable timeout (setup_aws_envs at 5 minutes) should return early with a "started" status and a way to poll for completion — OR the tool description should set accurate expectations and the user should be informed before invocation.

The progress notification pattern:
```typescript
// In the tools/call handler, check if progressToken was provided
const progressToken = request.params._meta?.progressToken;

// Then during the long operation:
if (progressToken) {
  await server.notification({
    method: 'notifications/progress',
    params: {
      progressToken,
      progress: 3,
      total: 10,
      message: 'Creating dev AWS account...'
    }
  });
}
```

**Important constraint:** Progress notifications only help if the client honors them for timeout extension. The spec says clients MAY reset the clock, not MUST. For `setup_aws_envs`, the safe bet is: accept that users need to wait, use progress notifications as a best-effort mechanism, and document expected duration in the tool's `description` field.

**Detection (warning signs):**
- Tool invocation returns timeout error from Claude Code
- Works fine in MCP Inspector (which may have different or no timeout)
- Operations complete on AWS console but client reports failure

**Phase assignment:** Phase 2 — implement progress notifications alongside each long-running tool

**Confidence:** MEDIUM — spec behavior confirmed HIGH; client-specific timeout values are LOW confidence (undocumented for Claude Code and Cursor specifically)

---

## Moderate Pitfalls

Mistakes that cause confusing errors, security issues, or significant debugging time.

---

### Pitfall 4: Credentials/Secrets in Tool Input Schema

**What goes wrong:** Making AWS credentials or GitHub PATs required inputs in the MCP tool schema means the LLM sees those values in plaintext as part of the tool call. LLMs log conversation context. Claude Code and Cursor may surface these values in conversation history. This creates a credential exposure risk.

**The wrong design:**
```typescript
// BAD: Credentials as explicit tool inputs
setup_aws_envs({
  awsAccessKeyId: "AKIA...",
  awsSecretAccessKey: "...",
  githubToken: "ghp_..."
})
```

**The right design for this project:** The existing CLI already uses environment variables and the AWS credential chain for AWS access. The MCP server should do the same — inherit credentials from the server process environment, not from tool inputs. The MCP client config (`claude_desktop_config.json` or `.mcp.json`) supports an `env` key for injecting environment variables at server launch time:

```json
{
  "mcpServers": {
    "create-aws-project": {
      "command": "node",
      "args": ["..."],
      "env": {
        "AWS_PROFILE": "my-profile",
        "GITHUB_TOKEN": "ghp_..."
      }
    }
  }
}
```

The GitHub PAT is a specific challenge: the existing `initialize-github` command prompts for it interactively. In the MCP context, prompting is not possible. Three options:

1. Require `GITHUB_TOKEN` environment variable (best for security)
2. Accept as tool input (acceptable if clearly documented as a secret parameter, but still visible to LLM context)
3. Use MCP's `elicitation/create` request if the client supports it (requires client capability negotiation)

**Recommendation:** Environment variable for GITHUB_TOKEN. The `.mcp.json` template should document this in comments.

**Consequences of getting this wrong:** Credentials appear in LLM conversation context, Claude logging, and potentially user-visible chat history. PATs and access keys could be inadvertently shared or logged.

**Phase assignment:** Phase 1 — tool schema design decision

**Confidence:** HIGH — MCP env key behavior confirmed by official config docs; security reasoning is straightforward

---

### Pitfall 5: Tool Error Handling — Throwing vs Returning isError

**What goes wrong:** Throwing an unhandled exception inside a tool handler causes a JSON-RPC protocol-level error (code -32603 Internal Error). The MCP client receives an error response with no content. This looks like a server crash to the LLM, not a recoverable tool failure. The LLM cannot extract a useful error message to display to the user or reason about.

**The right approach:** The MCP spec defines two error mechanisms:

1. **Protocol errors** (JSON-RPC errors): For issues like unknown tool names, invalid argument schemas, or server startup failures. These are thrown as exceptions and become error responses.

2. **Tool execution errors**: For failures during tool work (AWS API error, bad config, invalid credentials). These should be returned as a successful JSON-RPC response with `isError: true` in the result.

```typescript
// BAD: Throwing inside a tool handler for expected failures
server.tool('create_project', schema, async (args) => {
  const config = validateConfig(args);
  // ... throws if AWS credentials missing
  await runSetup(config);
});

// GOOD: Return isError for recoverable/expected failures
server.tool('create_project', schema, async (args) => {
  try {
    const config = validateConfig(args);
    await runSetup(config);
    return {
      content: [{ type: 'text', text: 'Project created successfully...' }],
      isError: false
    };
  } catch (error) {
    return {
      content: [{ type: 'text', text: `Failed: ${error.message}` }],
      isError: true
    };
  }
});
```

The `isError: true` response reaches the LLM as content. The LLM can then reason about the failure and suggest next steps ("It looks like AWS credentials are not configured...").

**Consequences of getting this wrong:** The LLM sees an opaque error with no description. It cannot help the user recover. The connection may or may not survive (depends on client implementation).

**Phase assignment:** Phase 2 — every tool handler

**Confidence:** HIGH — confirmed by official MCP tools spec with explicit JSON examples

---

### Pitfall 6: npm Publishing — Companion Package Version Coupling

**What goes wrong:** `create-aws-project-mcp` depends on `create-aws-project`. If listed as a regular `dependency`, npm installs whatever version satisfies the semver range at install time. If the user has `create-aws-project@1.7.0` globally but the MCP package resolves `create-aws-project@1.8.0`, two versions may exist in node_modules. The MCP server would be calling code from `1.8.0` while the user thinks they're running `1.7.0`. If listed with an exact version, the package goes stale as the CLI evolves.

**Three design options:**

1. **Bundle everything in one package:** No dependency problem. The `create-aws-project` package gains a `--mcp` flag or `mcp-server` bin entry. Claude Code and Cursor launch it as `npx create-aws-project --mcp`. Simpler to publish and version. Downside: adds MCP SDK weight to the CLI package for non-MCP users.

2. **MCP package imports CLI as a dependency (regular `dependency` with `^` semver):** Simple. Works for `npx` usage (`npx create-aws-project-mcp`). Risk: version skew if user installs both packages separately.

3. **MCP package uses `peerDependency`:** User must install both packages themselves. Better for monorepo setups. More friction for `npx` usage since npx won't install peers automatically.

**Recommendation for this project:** Use option 1 (single package) or option 2 (two packages, MCP as `dependencies` not `peerDependencies`). Given that the MCP server is launched via `npx create-aws-project-mcp` in the `.mcp.json` template, and the user never installs it globally, `npx` always gets the latest compatible version of both packages. This makes regular `dependency` the right choice.

**Additional publishing concern — `files` field:** The MCP package must include `dist/` in the `files` array. A common mistake is forgetting to add new dist files to `files`, causing the published package to be missing the server entrypoint. The existing CLI package uses `"files": ["dist", "templates", "README.md"]` — the MCP package needs its own `files` field.

**Pre-publish check:** Both packages need `prepublishOnly` scripts that run `tsc`. A missing build step causes `npm publish` to publish stale compiled output or fail silently with outdated type declarations.

**Phase assignment:** Phase 3 — npm publishing setup

**Confidence:** MEDIUM — dependency strategy reasoning is standard npm knowledge (HIGH confidence); specific behavior of version resolution during npx invocation is MEDIUM confidence

---

### Pitfall 7: ESM Module Resolution in the MCP Server Entrypoint

**What goes wrong:** The existing project uses `"type": "module"` in package.json (ES modules). The `@modelcontextprotocol/sdk` package is also ESM. However, the MCP server binary must be executable via `node ./dist/index.js`. If the TypeScript compilation outputs `.js` files without the `#!/usr/bin/env node` shebang, or if the tsconfig doesn't set `"module": "NodeNext"` with proper `.js` extensions in import paths, the server fails to start with cryptic ESM resolution errors.

**Specific issue:** The existing project has already solved ESM/CJS interop for `libsodium-wrappers` using `createRequire`. The same ESM discipline applies to the MCP server. The `@modelcontextprotocol/sdk` uses `import`/`export` — verify `moduleResolution: NodeNext` is set in the MCP package's `tsconfig.json`.

**Prevention:**
- Add `#!/usr/bin/env node` to the MCP server entry file
- Set `chmod +x` on the compiled bin file (or handle via `bin` field in package.json which npm handles automatically)
- Test startup with `node ./dist/server.js` before testing via MCP Inspector

**Phase assignment:** Phase 1 — project setup

**Confidence:** HIGH — based on existing project's own ESM patterns and established Node.js ESM behavior

---

## Minor Pitfalls

Mistakes that cause friction but are quickly fixable.

---

### Pitfall 8: Testing Without a Full Claude/Cursor Setup

**What goes wrong:** Developers try to test MCP servers by configuring Claude Desktop or Cursor, then restarting the IDE after every code change. This is slow (30-60 second restart cycle) and hard to debug (logs are in a non-obvious location).

**The right tool:** MCP Inspector. Run it without any installation:

```bash
npx @modelcontextprotocol/inspector node ./dist/server.js
```

Inspector opens a local web UI at `http://localhost:5173`. It provides:
- Tool listing and invocation UI
- JSON-RPC message inspection
- Error display

This gives immediate feedback during development without requiring Claude Desktop restarts.

**Secondary test approach:** Write integration tests that spawn the server as a subprocess, send JSON-RPC over stdio, and assert on responses. The MCP TypeScript SDK's `Client` class can be used to script this programmatically.

**Logging strategy during development:** All logging from the MCP server should go to stderr. For stdio transport, stderr is captured by Claude Desktop (written to `~/Library/Logs/Claude/mcp-server-*.log` on macOS). During development via Inspector, stderr is visible in the terminal.

**Phase assignment:** Phase 1 — establish before building tools

**Confidence:** HIGH — confirmed by official MCP Inspector documentation

---

### Pitfall 9: stdin Being Consumed by MCP Transport

**What goes wrong:** The `prompts` library, if called in any code path reachable from an MCP tool, attempts to read from `process.stdin`. The MCP stdio transport is also reading from `process.stdin`. The two readers compete for the same stream. The MCP transport gets MCP JSON-RPC messages; the `prompts` library gets garbage (or nothing). The prompts hang indefinitely waiting for user input that never arrives.

**Prevention:** Same as Pitfall 1 — never call interactive code paths from MCP tool handlers. Additionally, consider explicitly disabling interactive prompts at the process level when starting in MCP mode:

```typescript
// In MCP server entry point
import { stdin } from 'node:process';
// The MCP SDK owns stdin entirely — no other code should read it
```

**Detection:** Tool call hangs indefinitely with no response. Inspector shows the request was sent but no response received. Server process is not CPU-bound (it's just waiting on stdin).

**Phase assignment:** Phase 1

**Confidence:** HIGH — confirmed by direct source inspection of `prompts` library defaults

---

### Pitfall 10: .mcp.json Template — Path Portability

**What goes wrong:** The `.mcp.json` file placed in generated projects needs to point to the MCP server. If the template uses a relative path (`"command": "../../node_modules/.bin/create-aws-project-mcp"`), it breaks when the project is moved or cloned to a different machine. If it uses a hardcoded absolute path, it breaks on any machine except the generator's.

**The right pattern:** Use `npx` as the command so no path is needed:

```json
{
  "mcpServers": {
    "create-aws-project": {
      "command": "npx",
      "args": ["-y", "create-aws-project-mcp"],
      "env": {
        "GITHUB_TOKEN": ""
      }
    }
  }
}
```

`npx -y` fetches the latest version if not cached. This works on any machine with Node.js installed. The `env` key documents required environment variables even when empty (serves as a reminder to the user).

**Phase assignment:** Phase 3 — template authoring

**Confidence:** HIGH — confirmed by official MCP connect-local-servers docs showing npx pattern

---

## Phase-Specific Warnings Summary

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Tool schema design | Working directory not inherited (Pitfall 2) | Require projectDir as explicit parameter |
| Tool schema design | Credentials in tool inputs (Pitfall 4) | Use env vars, document in .mcp.json template |
| Tool implementation | stdout corruption (Pitfall 1) | Only call non-interactive code paths; redirect all logs to stderr |
| Tool implementation | stdin consumed by prompts (Pitfall 9) | Never call prompts from MCP context |
| Tool implementation | Error handling (Pitfall 5) | Return isError:true, never throw for expected failures |
| Long-running tools | Client timeouts (Pitfall 3) | Emit progress notifications; document expected duration in tool description |
| Project setup | ESM resolution (Pitfall 7) | Shebang, NodeNext moduleResolution, chmod +x |
| npm publishing | Version coupling (Pitfall 6) | Use regular dependency not peer; include files field; prepublishOnly build |
| Template | .mcp.json path portability (Pitfall 10) | Use npx pattern, never relative or absolute paths |
| Testing | No full IDE setup needed (Pitfall 8) | Use MCP Inspector for all development testing |

---

## Sources

**Official MCP Documentation (HIGH confidence):**
- [MCP Transports spec](https://modelcontextprotocol.io/docs/concepts/transports) — "The server MUST NOT write anything to its stdout that is not a valid MCP message"
- [MCP Debugging guide](https://modelcontextprotocol.io/docs/tools/debugging) — Working directory behavior, stderr for logging, Inspector usage
- [MCP Tools spec](https://modelcontextprotocol.io/docs/concepts/tools) — isError pattern, error handling mechanisms
- [MCP Lifecycle spec](https://modelcontextprotocol.io/specification/2025-03-26/basic/lifecycle) — Timeout SHOULD behavior, progress notification interaction
- [MCP Progress spec](https://modelcontextprotocol.io/specification/2025-03-26/basic/utilities/progress) — progressToken, progress notification format
- [MCP Cancellation spec](https://modelcontextprotocol.io/specification/2025-03-26/basic/utilities/cancellation) — Cancellation flow
- [MCP Connect Local Servers](https://modelcontextprotocol.io/docs/develop/connect-local-servers) — env key in config, npx pattern
- [MCP Inspector docs](https://modelcontextprotocol.io/docs/tools/inspector) — Testing without IDE

**Direct Source Inspection (HIGH confidence):**
- `node_modules/ora/index.js:122` — ora default stream is process.stderr (safe)
- `node_modules/ora/index.js:334` — spinner clear() skips non-TTY (safe)
- `node_modules/prompts/dist/elements/prompt.js:26-27` — prompts defaults stdin=process.stdin, stdout=process.stdout (critical risk)
- `src/commands/setup-aws-envs.ts` — 15+ console.log calls + prompts usage (must not be called from MCP)
- `src/commands/initialize-github.ts` — multiple console.log calls + prompts usage (must not be called from MCP)
