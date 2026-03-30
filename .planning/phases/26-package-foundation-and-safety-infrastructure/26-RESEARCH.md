# Phase 26: Package Foundation and Safety Infrastructure - Research

**Researched:** 2026-03-30
**Domain:** npm workspaces setup, MCP server binary wiring, stdout/exit safety infrastructure
**Confidence:** HIGH

## Summary

Phase 26 creates the structural prerequisites for the entire v1.8 MCP milestone. Three distinct work streams must converge: (1) converting the single-package repo into an npm workspaces monorepo, (2) bootstrapping a runnable `create-aws-project-mcp` package with the MCP SDK wired to StdioServerTransport, and (3) implementing the `withCliContext()` safety wrapper that all future tool handlers will depend on.

The prior MCP milestone research (2026-03-25) is comprehensive and HIGH confidence throughout. The MCP SDK is now at v1.29.0 (was 1.28.0 when researched — minor bump, no breaking changes, same API). The technical patterns for all three work streams are verified and ready to implement.

The central insight driving the design: the existing CLI writes freely to stdout via `console.log`, `ora`, and `prompts`. Any byte written to stdout that is not a valid MCP JSON-RPC message corrupts the protocol stream immediately and silently. `withCliContext()` is the blast shield — it must be implemented correctly before any tool handler can run CLI code safely.

**Primary recommendation:** Implement npm workspaces + MCP package skeleton first (prerequisites), then implement `withCliContext()` independently and test it with unit tests before wiring any tool handlers to it.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@modelcontextprotocol/sdk` | `^1.29.0` | MCP server runtime, tool registration, stdio transport | Only official MCP SDK for TypeScript; published by Anthropic, PBC. v1.x is production; v2 is pre-alpha — do not use |
| `zod` | existing `^4.3.6` (peer dep) | Tool input schema validation | SDK peer dep range `^3.25 || ^4.0`; existing project has 4.3.6 — reuse, do not install separately in MCP package |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| npm workspaces | built-in (npm 11.x) | Link packages in monorepo | Root `package.json` `workspaces` field — no separate install |
| `@cfworker/json-schema` | `^4.1.1` | SDK peer dep (JSON schema validation) | SDK pulls this in automatically; list as peer dep if needed |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| npm workspaces | turborepo / nx | Overkill for two packages; npm workspaces is zero-config for this use case |
| npm workspaces | yarn/pnpm workspaces | Project already uses npm; switching adds migration cost |
| `withCliContext()` custom wrapper | `MCP_MODE=1` env flag in CLI code | Env flag requires modifying every CLI function; stdout redirect is non-invasive |

**Installation (in MCP package directory after workspace setup):**
```bash
npm install @modelcontextprotocol/sdk@^1.29.0
```

## Architecture Patterns

### Recommended Project Structure

```
create-aws-project/                  (root — existing package, minimal changes)
  package.json                       (add "workspaces": ["packages/*"])
  tsconfig.json                      (unchanged)
  jest.config.ts                     (unchanged)
  src/                               (unchanged)
  packages/
    create-aws-project-mcp/
      src/
        index.ts                     (#!/usr/bin/env node entry — calls startServer())
        server.ts                    (McpServer instantiation, tool registration, transport connect)
        utils/
          cli-context.ts             (withCliContext: stdout redirect + exit interception)
      package.json
      tsconfig.json
```

No `tools/` subdirectory yet — Phase 26 is a bare server with zero tools registered.

### Pattern 1: npm Workspaces Root Configuration

**What:** Declare the workspace in root `package.json` so both packages share `node_modules` and the MCP package can import from `create-aws-project` via symlink.
**When to use:** Always — this is the foundation for the entire monorepo.

```json
// root package.json — add "workspaces" field (and update scripts)
{
  "workspaces": ["packages/*"],
  "scripts": {
    "build": "tsc && npm run build --workspace=packages/create-aws-project-mcp",
    "test": "node --experimental-vm-modules node_modules/jest/bin/jest.js && npm test --workspace=packages/create-aws-project-mcp"
  }
}
```

After adding `workspaces` to root `package.json`, run `npm install` from the root. npm will symlink `packages/create-aws-project-mcp` into `node_modules/create-aws-project-mcp`.

### Pattern 2: MCP Package `package.json`

**What:** Minimal package.json for the MCP server package.
**When to use:** Create this before any source files.

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
    "test": "node --experimental-vm-modules node_modules/.bin/jest",
    "prepublishOnly": "npm run build"
  },
  "files": ["dist"],
  "engines": {
    "node": ">=22.0.0"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.29.0",
    "create-aws-project": "*"
  },
  "peerDependencies": {
    "zod": "^4.0"
  }
}
```

Key points:
- `"type": "module"` — SDK is ESM-only
- `create-aws-project: "*"` — workspace protocol; resolves to local package via symlink
- `chmod 755` in build — required for shebang invocation on Unix
- `zod` as peer dep — prevents dual-installation with root package

### Pattern 3: MCP Package `tsconfig.json`

**What:** TypeScript configuration for the MCP package.

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

Must match root tsconfig's `module: NodeNext` and `moduleResolution: NodeNext` — required for `.js` extension imports in ESM packages.

### Pattern 4: MCP Server Entry Point

**What:** The shebang entry point that starts the server.

```typescript
// packages/create-aws-project-mcp/src/index.ts
// Source: modelcontextprotocol.io/quickstart/server
#!/usr/bin/env node
import { startServer } from "./server.js";

startServer().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
```

The shebang line is required. The `.js` extension in the import is required for `NodeNext` module resolution.

### Pattern 5: Bare MCP Server (no tools)

**What:** The minimal server that passes success criterion 4 (MCP Inspector shows zero tools).

```typescript
// packages/create-aws-project-mcp/src/server.ts
// Source: @modelcontextprotocol/sdk v1.29.0 + modelcontextprotocol.io/quickstart/server
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

export async function startServer(): Promise<void> {
  const server = new McpServer({
    name: "create-aws-project",
    version: "1.0.0",
  });

  // Tools will be registered here in Phase 28
  // server.registerTool(...)

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("create-aws-project MCP server running on stdio");
}
```

`McpServer` is the high-level API. Do not use the lower-level `Server` class (deprecated). After `server.connect(transport)`, the process stays alive reading from stdin — do not call `process.exit()` anywhere in normal flow.

### Pattern 6: `withCliContext()` — The Safety Wrapper

**What:** Combines stdout capture and process.exit interception into a single wrapper. This is SAFE-01 + SAFE-02.

```typescript
// packages/create-aws-project-mcp/src/utils/cli-context.ts
export interface CliContextResult<T> {
  result: T;
  capturedOutput: string;
}

export async function withCliContext<T>(
  fn: () => Promise<T>
): Promise<CliContextResult<T>> {
  // --- SAFE-01: Redirect stdout ---
  const chunks: Buffer[] = [];
  const originalWrite = process.stdout.write.bind(process.stdout);

  // Override with compatible signature
  (process.stdout.write as unknown) = (
    chunk: string | Uint8Array,
    encodingOrCb?: BufferEncoding | ((err?: Error | null) => void),
    cb?: (err?: Error | null) => void
  ): boolean => {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    const callback = typeof encodingOrCb === 'function' ? encodingOrCb : cb;
    if (callback) callback();
    return true;
  };

  // --- SAFE-02: Intercept process.exit ---
  const originalExit = process.exit.bind(process);
  let interceptedExitCode: number | undefined;

  (process.exit as unknown) = (code?: number): never => {
    interceptedExitCode = code ?? 0;
    throw new Error(`process.exit(${interceptedExitCode}) intercepted`);
  };

  try {
    const result = await fn();
    return {
      result,
      capturedOutput: Buffer.concat(chunks).toString('utf8'),
    };
  } catch (error) {
    if (interceptedExitCode !== undefined) {
      throw new Error(
        `Command failed with exit code ${interceptedExitCode}`
      );
    }
    throw error;
  } finally {
    process.stdout.write = originalWrite;
    process.exit = originalExit;
  }
}
```

Key design decisions:
- `finally` block always restores both overrides — even if an exception escapes
- `interceptedExitCode` distinguishes between `process.exit` throws and real errors
- The captured output is returned so tool handlers can include it in their response text
- ANSI stripping (for MCP responses) belongs in the tool handler, not here

The existing test suite already uses the same pattern for testing — `jest.spyOn(process, 'exit').mockImplementation(...)` in `non-interactive.spec.ts` confirms this approach works within the project.

### Anti-Patterns to Avoid

- **`console.log()` anywhere in MCP server code:** Writes to stdout, corrupting the JSON-RPC stream. Use `console.error()` exclusively.
- **Calling interactive CLI paths (`runSetupAwsEnvs`, `runInitializeGitHub`):** These use `prompts` which reads stdin (owned by MCP transport) and writes stdout. Must call non-interactive variants only.
- **Putting MCP code inside existing `src/`:** The MCP server needs its own `bin` entry and independent versioning. Keep as sibling package.
- **Using `Server` class (lower-level):** Deprecated in favor of `McpServer`. Use `McpServer`.
- **Not restoring overrides in `finally`:** If `withCliContext` leaks a stdout redirect, subsequent MCP protocol messages won't reach the transport, killing the server.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JSON-RPC over stdio | Custom protocol parser | `@modelcontextprotocol/sdk` with `StdioServerTransport` | SDK handles framing, protocol negotiation, initialize handshake, and error responses |
| Zod → JSON Schema conversion | Custom converter | SDK handles it internally (`zod-to-json-schema` is bundled) | The SDK's `registerTool` accepts Zod shapes directly and converts automatically |
| Workspace dependency linking | `npm link` manually | npm workspaces `"workspaces": ["packages/*"]` + `npm install` | npm workspaces auto-symlinks and handles hoisting |

**Key insight:** The MCP SDK handles all protocol-level complexity. Phase 26 implementation is almost entirely configuration and plumbing — the hard parts (stdio framing, capability negotiation, tool dispatch) are solved by the SDK.

## Common Pitfalls

### Pitfall 1: stdout Corruption Destroys the Protocol Stream

**What goes wrong:** Any non-JSON byte written to stdout by the server causes the MCP client to receive malformed JSON-RPC, disconnecting immediately with no useful error message.
**Why it happens:** `console.log()` defaults to stdout. The `prompts` library defaults to stdout. `ora` uses stderr (safe), but `console.log()` calls interleaved with spinners still hit stdout.
**How to avoid:** `withCliContext()` must capture stdout before any CLI function is called. Additionally, use `console.error()` for all MCP server logging.
**Warning signs:** MCP client disconnects immediately after tool invocation; Inspector shows no response; empty or truncated MCP log files.

### Pitfall 2: `withCliContext()` Leaks on Exception

**What goes wrong:** If the `finally` block is missing or incomplete, a crash inside the wrapped function leaves `process.stdout.write` and `process.exit` overridden permanently. All subsequent MCP protocol messages are captured into a buffer that nothing reads, and the server silently stops communicating.
**Why it happens:** Overriding `process.stdout.write` is a global mutation — it affects all code running in the process.
**How to avoid:** Always restore both overrides in the `finally` block, unconditionally.
**Warning signs:** Server responds to `initialize` but never responds to subsequent requests.

### Pitfall 3: npm Workspaces `npm install` Must Run from Root

**What goes wrong:** Running `npm install` inside `packages/create-aws-project-mcp/` instead of the root creates a nested `node_modules` that is not symlinked correctly. The workspace symlink for `create-aws-project` won't be present.
**Why it happens:** npm workspaces only activates when `npm install` runs at the root where the `workspaces` field is defined.
**How to avoid:** Always run `npm install` from the project root after adding workspace configuration.
**Warning signs:** `Cannot find module 'create-aws-project'` when running the MCP server.

### Pitfall 4: Missing `chmod 755` Breaks `npx` Invocation

**What goes wrong:** `npx create-aws-project-mcp` reports `permission denied` or silently does nothing on Unix systems.
**Why it happens:** TypeScript compilation produces `dist/index.js` without executable permission. The `bin` field in `package.json` needs the file to be executable for Unix shebang invocation.
**How to avoid:** Add `chmod 755 dist/index.js` to the build script: `"build": "tsc && chmod 755 dist/index.js"`.
**Warning signs:** `npx create-aws-project-mcp` fails with permission error; direct `node dist/index.js` works fine.

### Pitfall 5: ESM `.js` Extension Required in All Imports

**What goes wrong:** Import like `import { startServer } from "./server"` (no extension) fails with `ERR_MODULE_NOT_FOUND` at runtime in ESM context.
**Why it happens:** `module: NodeNext` requires explicit `.js` extensions in import paths, mirroring how ESM works natively in Node.js.
**How to avoid:** All imports within the MCP package must use `.js` extension: `import { ... } from "./server.js"`. SDK imports use `.js` too: `import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"`.
**Warning signs:** `Error [ERR_MODULE_NOT_FOUND]: Cannot find module '...'` at startup.

### Pitfall 6: Root `npm test` Script Sequencing

**What goes wrong:** Root `npm test` runs both packages in parallel and the MCP package tests fail because the CLI package is not built yet (or jest processes interfere).
**Why it happens:** `npm run test --workspaces` runs tests in all workspaces — order may not be guaranteed.
**How to avoid:** Run tests sequentially: CLI package tests first, then MCP package tests. Use `&&` in the root test script rather than `--workspaces`.
**Warning signs:** MCP tests pass when run standalone but fail when run from root.

## Code Examples

### Creating the Workspace Structure

```bash
# From project root
mkdir -p packages/create-aws-project-mcp/src/utils
```

### Running MCP Inspector to Test the Bare Server

```bash
# Source: modelcontextprotocol.io/docs/tools/inspector
# After building the MCP package:
npx @modelcontextprotocol/inspector node packages/create-aws-project-mcp/dist/index.js
```

Inspector opens at `http://localhost:5173`. Success criterion 4: zero registered tools should appear.

### Verifying withCliContext() in Tests

The test pattern the project already uses (from `non-interactive.spec.ts`) is identical to what `withCliContext()` does internally:

```typescript
// Pattern already proven in existing test suite:
jest.spyOn(process, 'exit').mockImplementation((() => {
  throw new Error('process.exit called');
}) as () => never);

// Unit test for withCliContext:
it('captures stdout and converts process.exit to Error', async () => {
  const { result, capturedOutput } = await withCliContext(async () => {
    process.stdout.write('captured text\n');
    return 'done';
  });

  expect(result).toBe('done');
  expect(capturedOutput).toContain('captured text');
  // After withCliContext, stdout should be restored
  // process.stdout.write should work normally again
});

it('converts process.exit to thrown Error', async () => {
  await expect(
    withCliContext(async () => {
      process.exit(1);
    })
  ).rejects.toThrow('Command failed with exit code 1');
});
```

### Workspace Script in Root `package.json`

```json
{
  "workspaces": ["packages/*"],
  "scripts": {
    "build": "tsc && npm run build --workspace=packages/create-aws-project-mcp",
    "test": "node --experimental-vm-modules node_modules/jest/bin/jest.js && npm test --workspace=packages/create-aws-project-mcp"
  }
}
```

Note: The `--experimental-vm-modules` flag is required for the root package because it uses `jest.unstable_mockModule` (prior phase decision). The MCP package may use a simpler jest setup if it doesn't need dynamic module mocking.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `server.tool()` (deprecated) | `server.registerTool()` | SDK v1.28.0+ | Use `registerTool` — `server.tool()` still works but marked deprecated |
| Manual workspace linking (`npm link`) | `"workspaces"` in `package.json` | npm v7+ | Zero-config workspace symlinks via standard npm |
| MCP SDK v0.x API | v1.x `McpServer` high-level API | v1.0.0 | `McpServer` is the stable production API |

**Deprecated/outdated:**
- `Server` class (lower-level): Superseded by `McpServer`; avoid unless advanced custom request handling is needed.
- `server.tool()` method: Deprecated in v1.28.0; replaced by `server.registerTool()`.

## Open Questions

1. **MCP package jest configuration**
   - What we know: Root package uses `node --experimental-vm-modules` because tests use `jest.unstable_mockModule`. The MCP package tests in Phase 26 are unit tests for `withCliContext()` — likely simpler.
   - What's unclear: Does the MCP package need its own `jest.config.ts` or can it inherit from root? The root jest config has `testPathIgnorePatterns` that won't match the MCP package path.
   - Recommendation: Give the MCP package its own `jest.config.ts` mirroring the root config. Keep `--experimental-vm-modules` for consistency even if not needed yet — it won't hurt.

2. **`process.stdout.write` TypeScript typing**
   - What we know: `process.stdout.write` has complex overloaded signatures (accepts `string | Buffer | Uint8Array`, optional encoding, optional callback). Direct assignment requires a type cast.
   - What's unclear: Whether a simple cast `(process.stdout.write as unknown) = ...` satisfies TypeScript strict mode cleanly.
   - Recommendation: Use `as unknown as typeof process.stdout.write` cast pattern. The existing test suite already uses `jest.spyOn(process, 'exit')` which sets a precedent for patching process globals.

3. **Root `npm test` sequencing with workspaces**
   - What we know: `npm test --workspace=packages/create-aws-project-mcp` runs only the MCP package tests.
   - What's unclear: Whether jest instances running in the same terminal from two separate `npm test` invocations (sequential `&&`) can interfere with each other.
   - Recommendation: Use `&&` sequencing in the root test script (run CLI tests first, then MCP tests). Test this locally before finalizing the root `package.json` scripts.

## Sources

### Primary (HIGH confidence)

- `.planning/research/STACK.md` (2026-03-25) — Full MCP SDK stack research: `@modelcontextprotocol/sdk` API, import paths, `McpServer`, `StdioServerTransport`, `registerTool`
- `.planning/research/ARCHITECTURE.md` (2026-03-25) — `withCliContext()` pattern, stdout redirect + exit interception implementation, npm workspaces rationale, build order
- `.planning/research/PITFALLS.md` (2026-03-25) — stdout corruption mechanics, ESM resolution pitfalls, `prompts` stdin conflict, MCP Inspector testing
- `npm view @modelcontextprotocol/sdk@1.29.0` — Confirmed latest version is 1.29.0 (bump from 1.28.0); peer deps unchanged: `zod: "^3.25 || ^4.0"`, `@cfworker/json-schema: "^4.1.1"`
- Existing project `src/__tests__/config/non-interactive.spec.ts` — Confirms `jest.spyOn(process, 'exit')` pattern already in use; identical approach to `withCliContext()` exit interception
- `npm help workspaces` (npm 11.10.1) — Confirms workspaces `package.json` `"workspaces"` field syntax and auto-symlinking behavior

### Secondary (MEDIUM confidence)

- `.planning/ROADMAP.md` — Phase 26 success criteria and requirement list (PKG-01 through SAFE-03, CRED-01) confirmed

### Tertiary (LOW confidence)

- None — all critical claims verified from primary sources.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — MCP SDK verified via npm registry; npm workspaces is built-in npm feature
- Architecture: HIGH — `withCliContext()` pattern verified against existing test patterns in codebase; MCP SDK API confirmed from prior research
- Pitfalls: HIGH — stdout corruption and ESM issues confirmed by official MCP spec and direct inspection of `prompts`/`ora` source

**Research date:** 2026-03-30
**Valid until:** 2026-04-30 (MCP SDK is actively maintained but v1.x API is stable; npm workspaces is a stable feature)
