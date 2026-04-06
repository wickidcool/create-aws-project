# Phase 29: Publishing and Generated Project Template - Research

**Researched:** 2026-04-03
**Domain:** npm publish (workspace packages), `.mcp.json` format (Claude Code), template generation
**Confidence:** HIGH

## Summary

Phase 29 has two independent work streams: (1) making `create-aws-project-mcp` publishable to npm as a standalone package, and (2) adding `.mcp.json` to every project scaffolded by `create-aws-project`. The MCP package already has a `bin` entry, `prepublishOnly` script, `files` field, and a working build. The gaps are: test files are being compiled into `dist/` and therefore into the published tarball (needs tsconfig fix), no `README.md` exists in the package, and the `package.json` lacks metadata fields (`description`, `keywords`, `repository`, `author`). The `.mcp.json` template addition is a straightforward file + manifest entry using the already-established template copy system.

The `.mcp.json` format is well-specified by the Claude Code documentation. Project-scoped MCP servers use `command: "npx"` + `args: ["-y", "create-aws-project-mcp"]` pattern. The `env` block holds placeholder values for all required credentials (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `GITHUB_TOKEN`). The file is static JSON (no token replacement needed) and goes in `templates/root/.mcp.json`, added to the `shared` array in `templateManifest`.

The `create-aws-project: "*"` dependency in the MCP package stays as `"*"` in the published tarball — npm does not rewrite it. When a consumer installs `create-aws-project-mcp`, npm resolves `"*"` to `latest`, which means the published `create-aws-project` must be on the registry before `create-aws-project-mcp` can be installed. Publish order matters: publish the root CLI package first, then the MCP package.

**Primary recommendation:** Fix test file compilation from production build (exclude `src/__tests__` from `tsconfig.json`), add README.md to MCP package, add npm metadata fields, create `templates/root/.mcp.json`, add it to `templateManifest.shared`, and add a `publish` script at the root level. Do NOT change the `create-aws-project: "*"` dependency — it correctly resolves to latest at install time.

## Standard Stack

No new libraries are required for this phase. All tools are either built into Node.js, already installed, or standard CLI tooling.

### Core
| Tool | Version | Purpose | Why Standard |
|------|---------|---------|--------------|
| npm CLI | 11.10.1 (current) | Package publishing via `npm publish --workspace` | Built into Node.js; workspace-aware publish |
| TypeScript `exclude` in tsconfig | built-in | Exclude test files from production build | Standard pattern for TypeScript projects |

### Supporting
| Tool | Version | Purpose | When to Use |
|------|---------|---------|-------------|
| `npm pack --dry-run` | built-in | Verify what gets published before actual publish | Run before every real publish to catch surprises |
| `npm publish --workspace=packages/create-aws-project-mcp` | built-in | Publish only the MCP package | Use this to publish independently from root CLI |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `"create-aws-project": "*"` dependency | `"create-aws-project": "^1.7.0"` pinned version | Pinned version provides guaranteed compatibility; `"*"` means always latest. Both work, pinned is more predictable but requires version bumps on each release. For this monorepo pattern, `"*"` is acceptable. |
| Separate publish script per-workspace | Root-level `publish` script | Root-level is cleaner for the final user |

**Installation:**
No new packages needed.

## Architecture Patterns

### Recommended Project Structure Changes

```
packages/create-aws-project-mcp/
├── tsconfig.json          # ADD: exclude src/__tests__/**
├── package.json           # ADD: description, keywords, repository, author, homepage, README to files
├── README.md              # ADD: new file
└── src/                   # unchanged
    └── __tests__/         # still compiled for tests via tsconfig.spec.json, not tsconfig.json

templates/
└── root/
    ├── .gitignore         # existing
    ├── .mcp.json          # ADD: new template file
    └── [other files]      # existing

src/templates/manifest.ts  # ADD: .mcp.json entry to shared array
```

### Pattern 1: Excluding Test Files from Production TypeScript Build

**What:** `tsconfig.json` (production build) excludes `__tests__` directories; `tsconfig.spec.json` includes them for test runs.
**When to use:** Any TypeScript package where tests live inside `src/` alongside source.
**Example:**
```json
// packages/create-aws-project-mcp/tsconfig.json - production build
{
  "compilerOptions": { ... },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "src/**/__tests__/**", "src/**/*.spec.ts"]
}
```
```json
// packages/create-aws-project-mcp/tsconfig.spec.json - test build (includes tests)
{
  "extends": "./tsconfig.json",
  "include": ["src/**/*"]  // no exclusion - tests included
}
```

### Pattern 2: `.mcp.json` Template File

**What:** A static JSON file in `templates/root/.mcp.json` that gets copied unchanged into the scaffolded project root.
**When to use:** TMPL-01 — every generated project gets this file.
**Example:**
```json
{
  "mcpServers": {
    "create-aws-project": {
      "command": "npx",
      "args": ["-y", "create-aws-project-mcp"],
      "env": {
        "AWS_ACCESS_KEY_ID": "YOUR_AWS_ACCESS_KEY_ID",
        "AWS_SECRET_ACCESS_KEY": "YOUR_AWS_SECRET_ACCESS_KEY",
        "AWS_REGION": "us-east-1",
        "GITHUB_TOKEN": "YOUR_GITHUB_TOKEN"
      }
    }
  }
}
```

**Key design decisions:**
- `command: "npx"` with `args: ["-y", "create-aws-project-mcp"]` — this is the idiomatic Claude Code `.mcp.json` pattern for npx-based servers (confirmed from official Claude Code docs)
- `"AWS_REGION"` is included because tools use it; placeholder value `"us-east-1"` is the most common default
- All four env vars listed even though only `setup_aws_envs` and `initialize_github` need credentials — documents the complete set
- Server name `"create-aws-project"` matches the server `name` field in `server.ts` (`McpServer({ name: "create-aws-project" })`)
- Values are `"YOUR_..."` placeholders — not empty strings, not `null`. The documented style is all-caps placeholder names

### Pattern 3: Adding to templateManifest

**What:** Add `.mcp.json` to the `shared` array in `src/templates/manifest.ts`.
**When to use:** Files that go in every generated project regardless of platform/auth choice.
**Example:**
```typescript
// src/templates/manifest.ts
shared: [
  // ... existing entries ...
  { src: 'root/.mcp.json', dest: '.mcp.json' },
],
```

**Note:** `.json` files go through `replaceTokens()` in `copy-file.ts`. The `.mcp.json` has no token placeholders so token replacement is a no-op — this is safe.

### Pattern 4: npm Workspace Publish Flow

**What:** Publish a single workspace package from the root.
**Command:** `npm publish --workspace=packages/create-aws-project-mcp --access public`
**Note:** `create-aws-project-mcp` is an unscoped package — unscoped packages are always public, so `--access public` is redundant but harmless. The package name has no `@scope/` prefix so there's no risk of accidentally publishing as private.

**Correct publish order** (due to `create-aws-project: "*"` dependency):
1. `npm publish` (root CLI package, `create-aws-project`)
2. `npm publish --workspace=packages/create-aws-project-mcp` (MCP package)

### Anti-Patterns to Avoid

- **Including test files in published package:** `"files": ["dist"]` with `tsconfig.json` compiling `src/__tests__` causes 31 total files (21 are test compiled outputs) in the tarball. Fix by excluding `__tests__` from `tsconfig.json`.
- **Empty `README.md`:** npm will publish without a README but the package page on npmjs.com will have no documentation. The `"files"` field auto-includes `README.md` if present at package root.
- **Publishing MCP package before CLI package is on npm:** `create-aws-project: "*"` will fail to install if `create-aws-project` is not yet on the public registry. Publish root first.
- **Forgetting `chmod 755 dist/index.js`:** The MCP package build script already does this: `"build": "tsc && chmod 755 dist/index.js"`. The `prepublishOnly` script runs this before publish. Do not remove it — without it, `npx -y create-aws-project-mcp` would fail with permission denied.
- **Using `"workspace:*"` syntax:** npm workspaces support `"workspace:*"` but the current package uses `"*"`. npm 11 does NOT rewrite `"*"` during publish — it stays as `"*"` in the published package.json (verified via `npm pack` + tarball inspection). This is correct behavior: `"*"` resolves to the latest published version of the dependency.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Excluding test files from build | Custom build script that deletes test outputs | TypeScript `exclude` in tsconfig.json | One config change; maintained by TypeScript tooling |
| Computing what gets published | Manual file listing | `npm pack --dry-run` | Shows exactly what npm will include before committing |
| `.mcp.json` dynamic generation | Generating it in `generateProject()` with special logic | Static template file | File is identical for all projects; no tokens needed |

**Key insight:** This phase is primarily configuration and file addition — no new logic to write. The template system, the build system, and the publish tooling are all established.

## Common Pitfalls

### Pitfall 1: Test Files Published in Package

**What goes wrong:** Running `npm pack --workspace=packages/create-aws-project-mcp --dry-run` reveals 31 files including `dist/__tests__/**/*.spec.js`. This adds ~40kB of compiled test code to every user install.
**Why it happens:** `tsconfig.json` uses `"include": ["src/**/*"]` which captures `src/__tests__/**/*.spec.ts`. The `"files": ["dist"]` in `package.json` then includes everything under `dist/`.
**How to avoid:** Add `"exclude": ["node_modules", "dist", "src/**/__tests__/**", "src/**/*.spec.ts"]` to `tsconfig.json`. The `tsconfig.spec.json` which is used by Jest can keep the inclusive `include` pattern.
**Warning signs:** `npm pack --dry-run` output shows `dist/__tests__/` entries.

### Pitfall 2: Missing README.md in MCP Package

**What goes wrong:** The published package has no documentation on npmjs.com. Users who find the package can't understand what it does.
**Why it happens:** `packages/create-aws-project-mcp/` has no `README.md` file. The root `README.md` is not included.
**How to avoid:** Create `packages/create-aws-project-mcp/README.md` and add `"README.md"` to the `"files"` array (or rely on npm auto-including it — npm automatically includes `README.md` if present, regardless of `"files"` field).
**Warning signs:** Package page on npmjs.com shows "No README found."

### Pitfall 3: Publish Order for Workspace Dependencies

**What goes wrong:** Publishing `create-aws-project-mcp` before `create-aws-project` is on the npm registry causes `npx -y create-aws-project-mcp` to fail on install with a 404 for the `create-aws-project` dependency.
**Why it happens:** `create-aws-project: "*"` in the MCP package's dependencies resolves to `latest` on install. If `create-aws-project` has never been published, there is no `latest`.
**How to avoid:** Always publish root CLI first: `npm publish` then `npm publish --workspace=packages/create-aws-project-mcp`.
**Warning signs:** `npm install create-aws-project-mcp` fails with "No matching version found for create-aws-project@*".

### Pitfall 4: `.mcp.json` Gets Token-Replaced Incorrectly

**What goes wrong:** If `.mcp.json` contained strings that look like token patterns (e.g., `{{PROJECT_NAME}}`), `replaceTokens()` would modify them during scaffold generation.
**Why it happens:** `copy-file.ts` calls `replaceTokens()` on `.json` files.
**How to avoid:** The actual `.mcp.json` content uses `"YOUR_AWS_ACCESS_KEY_ID"` style placeholders — none of these match the `{{TOKEN}}` pattern used by `replaceTokens()`. No risk with the current design.
**Warning signs:** Generated `.mcp.json` has modified env var placeholder values.

### Pitfall 5: `npx -y create-aws-project-mcp` Fails Due to Stale npx Cache

**What goes wrong:** Success criterion 1 requires `npx -y create-aws-project-mcp` (fresh install, no prior cache) to start without error. If tested with a cached version, a bad publish is not caught.
**Why it happens:** `npx -y` installs if not cached; subsequent runs use cache.
**How to avoid:** Test with `npx --yes create-aws-project-mcp` after clearing the npx cache: `rm -rf ~/.npm/_npx` or use a clean environment.
**Warning signs:** Server starts with old version; test passes but production fails.

### Pitfall 6: `create-aws-project` package.json version needs bumping

**What goes wrong:** If the root package version (currently `1.7.0`) is not bumped before publish, npm will reject the publish with "You cannot publish over the previously published versions".
**Why it happens:** npm registry is immutable — a given name+version combination can only be published once.
**How to avoid:** Bump `packages/create-aws-project-mcp` to at least `1.0.0` (already done) and bump root to `1.8.0` before publishing.
**Warning signs:** `npm publish` fails with 403 "cannot publish over the previously published version".

## Code Examples

### tsconfig.json Fix (Exclude Test Files from Production Build)
```json
// Source: TypeScript documentation - include/exclude patterns
// packages/create-aws-project-mcp/tsconfig.json
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
  "exclude": ["node_modules", "dist", "src/**/__tests__/**", "src/**/*.spec.ts"]
}
```

### `.mcp.json` Template File Content
```json
// Source: Official Claude Code docs - project-scoped .mcp.json format
// Place at: templates/root/.mcp.json
{
  "mcpServers": {
    "create-aws-project": {
      "command": "npx",
      "args": ["-y", "create-aws-project-mcp"],
      "env": {
        "AWS_ACCESS_KEY_ID": "YOUR_AWS_ACCESS_KEY_ID",
        "AWS_SECRET_ACCESS_KEY": "YOUR_AWS_SECRET_ACCESS_KEY",
        "AWS_REGION": "us-east-1",
        "GITHUB_TOKEN": "YOUR_GITHUB_TOKEN"
      }
    }
  }
}
```

### templateManifest Shared Array Addition
```typescript
// Source: src/templates/manifest.ts - existing pattern
// Add this entry to the shared array:
{ src: 'root/.mcp.json', dest: '.mcp.json' },
```

### MCP package.json With All Required Fields
```json
// packages/create-aws-project-mcp/package.json
{
  "name": "create-aws-project-mcp",
  "version": "1.0.0",
  "description": "MCP server for create-aws-project CLI — scaffold and manage AWS projects via AI agents",
  "type": "module",
  "bin": {
    "create-aws-project-mcp": "./dist/index.js"
  },
  "scripts": {
    "build": "tsc && chmod 755 dist/index.js",
    "test": "node --experimental-vm-modules ../../node_modules/jest/bin/jest.js",
    "prepublishOnly": "npm run build"
  },
  "files": ["dist", "README.md"],
  "engines": { "node": ">=22.0.0" },
  "keywords": ["aws", "mcp", "model-context-protocol", "scaffold", "cli"],
  "license": "ISC",
  "repository": {
    "type": "git",
    "url": "https://github.com/wickidcool/create-aws-project.git"
  },
  "author": "wickidcool",
  "homepage": "https://github.com/wickidcool/create-aws-project#readme",
  "bugs": {
    "url": "https://github.com/wickidcool/create-aws-project/issues"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.29.0",
    "create-aws-project": "*"
  },
  "devDependencies": {
    "@types/jest": "^30.0.0",
    "@types/node": "^24.10.1",
    "jest": "^30.2.0",
    "ts-jest": "^29.4.5",
    "typescript": "^5.9.3"
  }
}
```

### Root-Level Publish Script Addition
```json
// package.json scripts — add a publish-mcp convenience script
{
  "scripts": {
    "publish-mcp": "npm publish --workspace=packages/create-aws-project-mcp"
  }
}
```

### Verifying the Published Package (Pre-Publish Checklist)
```bash
# 1. Verify what gets included
npm pack --workspace=packages/create-aws-project-mcp --dry-run

# 2. Check that no dist/__tests__/ entries appear
# Good output: only dist/index.js, dist/server.js, dist/tools/*.js, dist/utils/*.js

# 3. Build locally and smoke test the bin
npm run build --workspace=packages/create-aws-project-mcp
node packages/create-aws-project-mcp/dist/index.js
# Expected: server starts (blocks on stdio) — Ctrl-C to exit
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Claude Desktop `claude_desktop_config.json` | `.mcp.json` in project root | Claude Code added project-scoped MCP config | `.mcp.json` is the standard for shareable project-level MCP configuration |
| `server.tool()` | `server.registerTool()` | MCP SDK 1.x | Already handled in Phase 28 |

**Deprecated/outdated:**
- `server.tool()`: Already replaced in Phase 28. Not relevant here.
- Claude Desktop `~/Library/Application Support/Claude/claude_desktop_config.json`: This is user-scoped, not project-scoped. The `.mcp.json` in project root is what gets committed to source control and shared with the team.

## Open Questions

1. **Should `create-aws-project` also have its version bumped to `1.8.0` before publish?**
   - What we know: Current version is `1.7.0`. npm registry rejects re-publishing the same version.
   - What's unclear: Whether the planner should include a version bump task, or assume this is handled out-of-band.
   - Recommendation: Include a version bump task for both packages as the first step before publish.

2. **Should the `.mcp.json` server key be `"create-aws-project"` or `"create-aws-project-mcp"`?**
   - What we know: The `McpServer({ name: "create-aws-project" })` in `server.ts` uses `"create-aws-project"`. The `MissingCredentialsError` in `errors.ts` also outputs `{ mcpServers: { 'create-aws-project': { env: envBlock } } }` — so the fix suggestion in error messages already uses `"create-aws-project"` as the key.
   - What's unclear: Nothing — both sources agree.
   - Recommendation: Use `"create-aws-project"` as the server key to match the error messages already in the codebase.

3. **Does the root `.gitignore` in `templates/root/` already exclude `.mcp.json`?**
   - What we know: The generated project's `.gitignore` comes from `templates/root/.gitignore`. The `.mcp.json` should be committed to source control (it contains placeholder values, not real credentials).
   - What's unclear: Whether `.mcp.json` is in the gitignore template.
   - Recommendation: Verify `templates/root/.gitignore` does NOT exclude `.mcp.json`. If it does, remove that exclusion.

## Sources

### Primary (HIGH confidence)
- Direct file inspection: `packages/create-aws-project-mcp/package.json` — current state of publish config
- Direct file inspection: `packages/create-aws-project-mcp/tsconfig.json` — confirms test files are compiled to dist
- `npm pack --workspace=packages/create-aws-project-mcp --dry-run` — confirmed 31 files including test outputs
- Tarball inspection (`npm pack` + `tar xzf` + `cat package/package.json`) — confirmed `"*"` is NOT rewritten during pack
- `src/templates/manifest.ts` — established pattern for adding template entries
- `src/generator/copy-file.ts` — confirms `.json` files go through `replaceTokens()` (safe for `.mcp.json`)
- Official Claude Code docs at `code.claude.com/docs/en/mcp` — confirmed project-scoped `.mcp.json` format, `command: "npx"` + `args` pattern, `env` block spec
- `packages/create-aws-project-mcp/src/tools/errors.ts` — confirms `"create-aws-project"` is the server key in error messages

### Secondary (MEDIUM confidence)
- WebSearch on npm workspace publish behavior — confirmed `"*"` resolves to latest at install time, publish order matters
- WebSearch on `publishConfig.access` — confirmed unscoped packages are always public, no `publishConfig` needed

### Tertiary (LOW confidence)
- N/A

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — verified from direct file inspection and npm pack output
- Architecture (tsconfig fix, .mcp.json content, manifest addition): HIGH — verified from official docs and direct code inspection
- Pitfalls (test files, publish order, version bump): HIGH — verified by running npm pack and inspecting output
- `.mcp.json` format: HIGH — verified from official Claude Code documentation

**Research date:** 2026-04-03
**Valid until:** 2026-05-03 (npm and `.mcp.json` format are stable; revisit if MCP SDK major version changes)
