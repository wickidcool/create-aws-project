# Technology Stack: MCP Server Package

**Project:** create-aws-project-mcp (new companion package)
**Context:** Subsequent milestone — adding an MCP server companion package to an existing CLI tool
**Researched:** 2026-03-25
**Overall confidence:** HIGH (all critical claims verified against npm registry and official MCP documentation)

---

## Recommended Stack

### Core Dependency

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `@modelcontextprotocol/sdk` | `^1.28.0` | MCP server runtime, tool registration, stdio transport | Only official MCP SDK for TypeScript; published by Anthropic, PBC. Version 1.28.0 published 2026-03-25. v2 is pre-alpha — do not use. |
| `zod` | existing (`^4.3.6`) | Tool input schema definitions | The SDK peer dependency is `^3.25 || ^4.0`. The existing project already has zod 4.3.6 — no version conflict. Reuse via peer dep; do not pin a separate copy in the MCP package. |

### Runtime

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Node.js | `>=22.0.0` | Runtime | SDK requires `>=18`; existing project requires `>=22`. Use `>=22` to match the parent project. |
| TypeScript | `^5.9.3` (inherit from workspace) | Type safety, compilation | Existing project is on `^5.9.3`. ES modules with `module: NodeNext` is the correct setting. |

### What NOT to Add

| Package | Why Not |
|---------|---------|
| `express`, `hono`, HTTP server packages | This is a stdio-only server. HTTP transport is for remote deployment. The SDK bundles express/hono internally for its HTTP mode; do not install them as project deps. |
| `@modelcontextprotocol/sdk` v2 | v2 is "pre-alpha, not for production" per the GitHub README on the `main` branch. Stay on v1.x. |
| Separate `zod` installation | The parent package already has zod 4.3.6. Use as a peer dependency to avoid version duplication. |
| Any logging library | `console.error()` writes to stderr, which is safe for stdio MCP servers. A logging library adds unnecessary overhead. |

---

## SDK API: What to Use

### Imports (HIGH confidence — verified from SDK type definitions)

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
```

Deep-import paths with `.js` extensions are required. The SDK is published as ES modules (`"type": "module"`). This matches the existing project's `module: NodeNext` configuration.

### Server Instantiation

```typescript
const server = new McpServer({
  name: "create-aws-project",
  version: "1.0.0",
});
```

`McpServer` is the high-level API. The lower-level `Server` class is `@deprecated` and only needed for advanced cases (custom request handlers, sampling). Use `McpServer`.

### Defining Tools with Zod Input Schemas

The current API is `registerTool`. The older `server.tool()` overloads still work but are marked `@deprecated` in v1.28.0.

```typescript
server.registerTool(
  "create_project",
  {
    description: "Scaffold a new AWS full-stack project",
    inputSchema: {
      projectName: z.string().min(1).describe("Name of the project"),
      platforms: z
        .array(z.enum(["web", "mobile"]))
        .describe("Target platforms"),
      awsRegion: z
        .string()
        .default("us-east-1")
        .describe("AWS region for deployment"),
    },
  },
  async ({ projectName, platforms, awsRegion }) => {
    // call into create-aws-project functions directly
    return {
      content: [{ type: "text", text: "Project created successfully." }],
    };
  }
);
```

`inputSchema` takes a plain object whose values are Zod schemas (`ZodRawShapeCompat` in the SDK type system). The SDK converts this to a JSON Schema for the MCP protocol automatically using `zod-to-json-schema` (bundled inside the SDK — no separate install needed).

### Tool Result Shape

```typescript
// Success
return {
  content: [{ type: "text", text: "..." }],
};

// Execution error (not protocol error — use this for expected failures)
return {
  content: [{ type: "text", text: "Error: ..." }],
  isError: true,
};
```

Do not throw unhandled exceptions in tool callbacks. Catch all errors and return `isError: true` with a descriptive message. Unhandled throws become protocol errors (JSON-RPC error codes), which are harder for the LLM to interpret.

### Stdio Transport Wiring

```typescript
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("create-aws-project MCP server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
```

`StdioServerTransport` reads newline-delimited JSON-RPC messages from `process.stdin` and writes to `process.stdout`. The constructor optionally accepts `(Readable, Writable)` for testing. After `server.connect(transport)`, the process stays alive waiting for stdin messages — do not exit manually.

### Logging Rule (Critical)

```typescript
// NEVER in a stdio MCP server — corrupts the JSON-RPC stream
console.log("anything");

// ALWAYS use stderr
console.error("anything");
```

Any write to stdout that is not a valid MCP JSON-RPC message corrupts the protocol and crashes the client's connection immediately. This is the most common source of silent failures in MCP server implementations.

---

## Package Structure

### Package Layout

```
packages/
  create-aws-project-mcp/
    src/
      index.ts                   # #!/usr/bin/env node entry point
      server.ts                  # McpServer instantiation and tool registration
      tools/
        create-project.ts        # create_project tool handler
        setup-aws-envs.ts        # setup_aws_envs tool handler
        initialize-github.ts     # initialize_github tool handler
        get-project-status.ts    # get_project_status tool handler
    dist/                        # compiled output (gitignored)
    package.json
    tsconfig.json
```

If the project does not adopt a monorepo, place the MCP server under `src/mcp/` within the existing project and publish separately. The separate directory is cleaner regardless.

### package.json for the MCP Package

```json
{
  "name": "create-aws-project-mcp",
  "version": "1.0.0",
  "description": "MCP server for create-aws-project CLI",
  "type": "module",
  "bin": {
    "create-aws-project-mcp": "./dist/index.js"
  },
  "scripts": {
    "build": "tsc && chmod 755 dist/index.js",
    "prepublishOnly": "npm run build"
  },
  "files": ["dist"],
  "engines": {
    "node": ">=22.0.0"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.28.0",
    "create-aws-project": "^1.7.0"
  },
  "peerDependencies": {
    "zod": "^4.0"
  }
}
```

Key decisions:
- `"type": "module"` is required because the SDK is ESM-only
- `bin` entry enables `npx create-aws-project-mcp` invocation
- `chmod 755` in the build script makes the entry point executable (required for shebang invocation on Unix)
- `create-aws-project` is a direct dependency so its functions can be imported without subprocess calls
- `zod` declared as peer dependency to avoid dual-installation with `create-aws-project`

### Entry Point (src/index.ts)

```typescript
#!/usr/bin/env node
import { startServer } from "./server.js";

startServer().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
```

The shebang line is required for `npx` and direct invocation to work without specifying `node` explicitly.

### tsconfig.json for the MCP Package

```json
{
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "target": "ES2022",
    "declaration": true,
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

Identical to the existing `create-aws-project` tsconfig. `module: NodeNext` is mandatory for `.js` extension imports from ESM packages like the MCP SDK.

---

## Client Configuration Formats

### Claude Code: `.mcp.json` (project-scoped)

Place at the repository root and check into source control. This makes the MCP server available to all contributors automatically.

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

Scope options in Claude Code:
- `project` scope writes to `.mcp.json` — shared with team via git
- `local` scope (default) writes to local config only — not shared
- `user` scope writes to global user config

To register via CLI instead of editing the file directly:

```bash
claude mcp add --scope project --transport stdio create-aws-project -- npx -y create-aws-project-mcp
```

**Windows note (confirmed from Claude Code docs):** On native Windows (not WSL), wrap npx with `cmd /c`:

```json
{
  "mcpServers": {
    "create-aws-project": {
      "command": "cmd",
      "args": ["/c", "npx", "-y", "create-aws-project-mcp"]
    }
  }
}
```

Claude Code also supports environment variable substitution in the config via `${VAR_NAME}` syntax.

### Claude Desktop: `claude_desktop_config.json`

```json
{
  "mcpServers": {
    "create-aws-project": {
      "command": "npx",
      "args": ["-y", "create-aws-project-mcp"]
    }
  }
}
```

File locations:
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`

### Cursor: `.cursor/mcp.json`

Cursor uses the same `mcpServers` schema, stored in `.cursor/mcp.json` at workspace root.

```json
{
  "mcpServers": {
    "create-aws-project": {
      "command": "npx",
      "args": ["-y", "create-aws-project-mcp"]
    }
  }
}
```

Confidence on Cursor format: MEDIUM — Cursor is documented as an MCP client using the same `mcpServers` schema as Claude Desktop. Could not directly verify via official Cursor docs (access denied). Confirm during implementation phase.

### All clients: `env` field

All clients support an optional `env` object for environment variables passed to the server process:

```json
{
  "mcpServers": {
    "create-aws-project": {
      "command": "npx",
      "args": ["-y", "create-aws-project-mcp"],
      "env": {
        "AWS_PROFILE": "my-profile",
        "AWS_REGION": "us-east-1"
      }
    }
  }
}
```

This is useful for configuring AWS credentials without requiring interactive input.

---

## Integration with Existing `create-aws-project`

The MCP server calls into existing functions directly (no subprocess). This requires those functions to be importable as a library.

### Confirmed export surface (inspected from source)

| Module | Exported Function | Current Signature |
|--------|-------------------|-------------------|
| `src/commands/setup-aws-envs.ts` | `runSetupAwsEnvs` | `(args: string[]) => Promise<void>` |
| `src/commands/initialize-github.ts` | `runInitializeGitHub` | `(args: string[]) => Promise<void>` |
| `src/generator/index.ts` | `generateProject` | `(options: GenerateOptions) => Promise<void>` |
| `src/config/non-interactive.ts` | `loadNonInteractiveConfig` | `(configPath: string) => ProjectConfig` |

**Implication for MCP tools:** `runSetupAwsEnvs` and `runInitializeGitHub` take `string[]` (the CLI args format). The MCP tools will construct the args array from structured Zod-validated inputs before calling into these functions. This is lower risk than refactoring the functions for the first milestone.

Example:

```typescript
// In the setup_aws_envs tool handler:
const args = ["--config", configPath, "--env", environment];
await runSetupAwsEnvs(args);
```

### The stdout Corruption Problem (Critical)

The existing CLI commands use `ora` (spinner) and `picocolors` — both write to stdout. When those functions execute from inside an MCP tool handler, their stdout writes will corrupt the stdio JSON-RPC stream.

**Required mitigations (in priority order):**

1. **Detect stdio mode:** Set an environment variable (e.g., `MCP_MODE=1`) before invoking CLI functions. Add a check in CLI output utilities to silence stdout when this env var is set.

2. **Wrap stdout:** Before calling a CLI function, temporarily replace `process.stdout.write` with a no-op (or capture buffer), then restore after.

3. **Refactor commands to accept an `outputStream` option:** The cleanest long-term solution, but requires a larger refactor of all command functions.

Option 1 is the recommended approach for the first milestone. This is the single highest-risk integration point — plan explicit implementation time for it.

---

## Installation Commands

```bash
# In the new MCP package directory
npm install @modelcontextprotocol/sdk@^1.28.0

# Dev dependencies (TypeScript toolchain)
npm install -D typescript @types/node
```

The SDK bundles `zod-to-json-schema` and `ajv` internally. The project already has `zod ^4.3.6` which satisfies the SDK's peer dep range of `^3.25 || ^4.0`. No version conflict.

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Transport | stdio | Streamable HTTP | stdio is the universal default for local tools; HTTP requires a persistent process and auth; clients "SHOULD support stdio whenever possible" per the MCP spec |
| Tool schema | Zod (reuse existing) | Raw JSON Schema objects | Zod is already the project's validation library; the SDK natively converts Zod shapes; raw JSON Schema is more verbose with no benefit |
| SDK version | v1.28.0 | v2 pre-alpha | v2 is explicitly "pre-alpha, not for production" per the typescript-sdk GitHub README |
| Package structure | Separate npm package with its own `package.json` | Add to existing package as a second `bin` entry | Question states separate npm package; a separate `package.json` makes the dependency tree explicit and avoids bloating `create-aws-project` with MCP-specific deps |
| Calling CLI functions | Direct import (in-process) | Subprocess via `execa` | Direct import is faster, avoids process overhead, enables proper error propagation, and avoids the complexity of parsing subprocess output |

---

## Sources

| Source | Confidence | What was verified |
|--------|------------|-------------------|
| npm registry query: `npm view @modelcontextprotocol/sdk --json` | HIGH | Version 1.28.0, published 2026-03-25; zod peer dep `^3.25 || ^4.0`; `"type": "module"`; engine `>=18` |
| SDK type inspection: `dist/esm/server/mcp.d.ts` | HIGH | `McpServer` class, `registerTool` signature, `ZodRawShapeCompat`, `ToolCallback` types |
| SDK type inspection: `dist/esm/server/stdio.d.ts` | HIGH | `StdioServerTransport` class, constructor `(Readable?, Writable?)`, `connect` method |
| MCP protocol docs: modelcontextprotocol.io/docs/concepts/transports | HIGH | Stdio transport: newline-delimited JSON-RPC, stdin in / stdout out, stderr for logs |
| MCP protocol docs: modelcontextprotocol.io/docs/concepts/tools | HIGH | Tool definition format, inputSchema JSON Schema, `isError` in tool result |
| MCP quickstart (TypeScript): modelcontextprotocol.io/quickstart/server | HIGH | `McpServer`, `StdioServerTransport`, `registerTool`, `server.connect(transport)`, `console.error` logging, `main()` pattern |
| MCP quickstart (user): modelcontextprotocol.io/quickstart/user | HIGH | `claude_desktop_config.json` format: `mcpServers`, `command`, `args`, `npx -y` pattern |
| Claude Code MCP docs: code.claude.com/docs/en/mcp | HIGH | `.mcp.json` file at project scope, `--scope project` flag, Windows `cmd /c` workaround, `env` field |
| Existing project code inspection | HIGH | Exported function signatures for `runSetupAwsEnvs`, `runInitializeGitHub`, `generateProject`, `loadNonInteractiveConfig` |
