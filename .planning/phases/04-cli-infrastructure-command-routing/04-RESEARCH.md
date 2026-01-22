# Phase 4: CLI Infrastructure & Command Routing - Research

**Researched:** 2026-01-21
**Domain:** Node.js CLI architecture, command routing, project context detection
**Confidence:** HIGH

## Summary

This phase establishes CLI infrastructure for routing commands and validating project context. The existing codebase uses native Node.js argument parsing without a CLI framework. Research evaluated whether to introduce a CLI framework (Commander.js, Yargs) versus enhancing the existing approach.

**Key finding:** The existing native approach is sufficient for this project's needs. The CLI has only 3-4 commands with simple argument structures. Introducing Commander.js would add ~75KB dependency for minimal benefit. The project should enhance the existing pattern with better structure while keeping dependencies minimal.

**Primary recommendation:** Enhance native argument parsing with a command registry pattern. Add project config detection via `find-up` package. Deprecate `setup-github` with clear messaging.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Native Node.js | 22+ | Argument parsing | Already in use, `process.argv` sufficient for 3-4 commands |
| find-up | 8.0.0 | Config file discovery | De facto standard for upward file search, 8M+ weekly downloads |
| picocolors | 1.1.1 | Terminal colors | Already used in project, minimal footprint |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| prompts | 2.4.2 | Interactive input | Already used, continue for any new prompts |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Native parsing | Commander.js | Commander adds ~75KB, full subcommand support, but overkill for 3-4 simple commands |
| Native parsing | Yargs | Similar to Commander, ~290KB, more validation built-in |
| find-up | pkg-dir | pkg-dir specifically finds package.json; find-up more flexible for custom markers |

**Installation:**
```bash
npm install find-up
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── index.ts              # Entry point - thin wrapper
├── cli.ts                # Command router - parseArgs + dispatch
├── commands/
│   ├── create.ts         # Main wizard command (default)
│   ├── setup-aws-envs.ts # AWS Organizations setup
│   ├── initialize-github.ts # Per-env GitHub setup
│   └── setup-github.ts   # DEPRECATED - kept for deprecation notice
├── utils/
│   └── project-context.ts # Config detection utilities
└── ...existing modules
```

### Pattern 1: Command Registry Pattern
**What:** Central registry maps command names to handler modules
**When to use:** When CLI has multiple commands with different behaviors
**Example:**
```typescript
// Source: Node.js CLI best practices
interface CommandHandler {
  name: string;
  description: string;
  run: (args: string[]) => Promise<void>;
}

const commands: Map<string, CommandHandler> = new Map([
  ['create', { name: 'create', description: 'Create new project', run: runCreate }],
  ['setup-aws-envs', { name: 'setup-aws-envs', description: 'Setup AWS accounts', run: runSetupAwsEnvs }],
  ['initialize-github', { name: 'initialize-github', description: 'Init GitHub env', run: runInitGitHub }],
]);

function dispatch(commandName: string | undefined, args: string[]): Promise<void> {
  // No command = default to 'create'
  const cmd = commands.get(commandName ?? 'create');
  if (!cmd) {
    printHelp();
    process.exit(1);
  }
  return cmd.run(args);
}
```

### Pattern 2: Project Context Detection
**What:** Detect if running from inside a valid project directory
**When to use:** Commands that require project configuration
**Example:**
```typescript
// Source: find-up documentation, sindresorhus/find-up
import { findUp } from 'find-up';
import { readFile } from 'node:fs/promises';

const CONFIG_FILE = '.aws-starter-config.json';

interface ProjectContext {
  configPath: string;
  projectRoot: string;
  config: ProjectConfig;
}

async function detectProjectContext(): Promise<ProjectContext | null> {
  const configPath = await findUp(CONFIG_FILE);
  if (!configPath) {
    return null;
  }

  const projectRoot = path.dirname(configPath);
  const configContent = await readFile(configPath, 'utf-8');
  const config = JSON.parse(configContent) as ProjectConfig;

  return { configPath, projectRoot, config };
}

function requireProjectContext(): Promise<ProjectContext> {
  const context = await detectProjectContext();
  if (!context) {
    console.error(pc.red('Error:') + ' Not inside a project directory.');
    console.error('');
    console.error('Run this command from inside a project created with create-aws-project.');
    console.error(`Expected config file: ${pc.cyan(CONFIG_FILE)}`);
    process.exit(1);
  }
  return context;
}
```

### Pattern 3: Deprecation Warning
**What:** Clear message when deprecated command is invoked
**When to use:** Removing/replacing commands while maintaining backward compatibility
**Example:**
```typescript
// Source: Node.js best practices for CLI deprecation
function runDeprecatedSetupGitHub(): void {
  console.log(pc.yellow('WARNING: ') + 'setup-github is deprecated.');
  console.log('');
  console.log('This command has been replaced by:');
  console.log(`  ${pc.cyan('initialize-github <env>')} - Configure a single environment`);
  console.log('');
  console.log('Example:');
  console.log(`  ${pc.cyan('npx create-aws-project initialize-github dev')}`);
  console.log(`  ${pc.cyan('npx create-aws-project initialize-github prod')}`);
  console.log('');
  console.log('The new command provides per-environment setup with better error isolation.');
  process.exit(1);
}
```

### Pattern 4: Multiple Binary Entry Points
**What:** Define separate bin entries for commands that run from project directory
**When to use:** Commands that should be runnable directly without prefix
**Example:**
```json
// Source: npm documentation on bin field
{
  "bin": {
    "create-aws-project": "./dist/index.js",
    "setup-aws-envs": "./dist/commands/setup-aws-envs-cli.js",
    "initialize-github": "./dist/commands/initialize-github-cli.js"
  }
}
```

### Anti-Patterns to Avoid
- **Deep nesting of if/else for commands:** Use registry/map pattern instead
- **Hardcoding paths:** Use find-up for config discovery, __dirname for package paths
- **Silent failures:** Always provide actionable error messages when context detection fails
- **Inconsistent exit codes:** Use 0 for success, 1 for user error, 2 for system error

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Upward file search | Manual directory traversal loop | find-up | Handles symlinks, edge cases, async/sync variants |
| Terminal colors | ANSI escape codes | picocolors (already used) | Cross-platform, respects NO_COLOR |
| Interactive prompts | readline + manual validation | prompts (already used) | Validation, types, cancel handling |
| Argument parsing (complex) | Manual string parsing | Commander.js | Only if needs grow beyond current scope |

**Key insight:** The project's CLI needs are simple enough that native Node.js features plus one small utility (find-up) are sufficient. Adding a full CLI framework now would be over-engineering.

## Common Pitfalls

### Pitfall 1: process.cwd() vs Config Location
**What goes wrong:** Commands assume project root is cwd, but user might run from subdirectory
**Why it happens:** process.cwd() returns where command was run, not project root
**How to avoid:** Always use find-up to locate config, then derive project root from config path
**Warning signs:** Commands fail when run from apps/web/ or other subdirectories

### Pitfall 2: Forgetting ESM Module Considerations
**What goes wrong:** __dirname not available, require() not available
**Why it happens:** Project uses `"type": "module"` in package.json
**How to avoid:** Use `import.meta.url` with `fileURLToPath` for path resolution
**Warning signs:** ReferenceError: __dirname is not defined

### Pitfall 3: Inconsistent Command Naming
**What goes wrong:** Users confused by command variations (setup-github vs setupGithub vs setup_github)
**Why it happens:** No naming convention established
**How to avoid:** Use kebab-case consistently for all commands matching npm convention
**Warning signs:** Documentation and help text show different formats

### Pitfall 4: Not Handling Missing Config Gracefully
**What goes wrong:** Cryptic error when config file missing or invalid JSON
**Why it happens:** No validation before JSON.parse
**How to avoid:** Wrap config loading in try/catch, provide clear "run from project directory" message
**Warning signs:** "SyntaxError: Unexpected token" or "Cannot read property of undefined"

### Pitfall 5: Exit Codes Ignored
**What goes wrong:** Script automation fails silently
**Why it happens:** Using console.log for errors but not setting exit code
**How to avoid:** Always call process.exit(1) after error messages, process.exit(0) on success
**Warning signs:** CI pipelines report success despite errors

## Code Examples

Verified patterns from official sources:

### CLI Entry Point (index.ts)
```typescript
// Source: Current project pattern, enhanced
#!/usr/bin/env node

import { run } from './cli.js';

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
```

### Command Router (cli.ts)
```typescript
// Source: Combined from current code + best practices
import pc from 'picocolors';

export async function run(): Promise<void> {
  const args = process.argv.slice(2);

  // Handle global flags first
  if (args.includes('--help') || args.includes('-h')) {
    printHelp();
    process.exit(0);
  }

  if (args.includes('--version') || args.includes('-v')) {
    console.log(getVersion());
    process.exit(0);
  }

  // Find command (first non-flag argument)
  const command = args.find(arg => !arg.startsWith('-'));
  const commandArgs = args.filter(arg => arg !== command);

  // Route to command handler
  switch (command) {
    case undefined:
      // No command = create new project (backward compatible)
      await runCreate(commandArgs);
      break;
    case 'setup-aws-envs':
      await runSetupAwsEnvs(commandArgs);
      break;
    case 'initialize-github':
      await runInitializeGitHub(commandArgs);
      break;
    case 'setup-github':
      // Deprecated command
      showDeprecationNotice();
      break;
    default:
      // Unknown command - might be project name for create
      await runCreate([command, ...commandArgs]);
      break;
  }
}
```

### Project Context Detection
```typescript
// Source: find-up documentation + Node.js best practices
import { findUp } from 'find-up';
import { readFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import pc from 'picocolors';

export const CONFIG_FILE = '.aws-starter-config.json';

export interface ProjectConfig {
  projectName: string;
  platforms: string[];
  awsRegion: string;
  // ... other fields
}

export interface ProjectContext {
  configPath: string;
  projectRoot: string;
  config: ProjectConfig;
}

export async function detectProjectContext(): Promise<ProjectContext | null> {
  const configPath = await findUp(CONFIG_FILE);

  if (!configPath) {
    return null;
  }

  try {
    const content = await readFile(configPath, 'utf-8');
    const config = JSON.parse(content) as ProjectConfig;
    return {
      configPath,
      projectRoot: dirname(configPath),
      config,
    };
  } catch {
    return null;
  }
}

export async function requireProjectContext(): Promise<ProjectContext> {
  const context = await detectProjectContext();

  if (!context) {
    console.error(pc.red('Error:') + ' Not inside a project directory.');
    console.error('');
    console.error('This command must be run from inside a project created with:');
    console.error(`  ${pc.cyan('npx create-aws-project <project-name>')}`);
    console.error('');
    console.error(`Expected config file: ${pc.cyan(CONFIG_FILE)}`);
    process.exit(1);
  }

  return context;
}
```

### Deprecation Notice
```typescript
// Source: Node.js CLI deprecation patterns
import pc from 'picocolors';

export function showDeprecationNotice(): never {
  console.log('');
  console.log(pc.yellow('DEPRECATED:') + ' The setup-github command has been replaced.');
  console.log('');
  console.log('Use the new per-environment command instead:');
  console.log('');
  console.log(`  ${pc.cyan('npx create-aws-project initialize-github <env>')}`);
  console.log('');
  console.log('Where <env> is one of: dev, stage, prod');
  console.log('');
  console.log('Example workflow:');
  console.log(`  1. ${pc.cyan('npx create-aws-project setup-aws-envs')}     # Create AWS accounts`);
  console.log(`  2. ${pc.cyan('npx create-aws-project initialize-github dev')}  # Configure dev`);
  console.log(`  3. ${pc.cyan('npx create-aws-project initialize-github prod')} # Configure prod`);
  console.log('');
  console.log(pc.dim('The new approach provides better error isolation per environment.'));

  process.exit(1);
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Monolithic wizard | Separated commands | v1.3 (this milestone) | Better error handling, flexibility |
| All-at-once setup | Per-environment init | v1.3 (this milestone) | Error isolation, partial recovery |
| setup-github | initialize-github <env> | v1.3 (this milestone) | Granular control |

**Deprecated/outdated:**
- `setup-github`: Replaced by `initialize-github <env>` for per-environment control

## Open Questions

Things that couldn't be fully resolved:

1. **Config file name convention**
   - What we know: Common patterns include `.xxxrc`, `.xxx.json`, `xxx.config.js`
   - What's unclear: Whether to use `.aws-starter-config.json` or shorter name
   - Recommendation: Use `.aws-starter-config.json` - explicit and unlikely to conflict

2. **Standalone binaries vs subcommands**
   - What we know: Can register multiple bin entries in package.json
   - What's unclear: Whether users prefer `npx setup-aws-envs` or `npx create-aws-project setup-aws-envs`
   - Recommendation: Support both - subcommand routing for npx + direct bin entries for local install

3. **Version matching between CLI and generated project**
   - What we know: Config file will be generated by wizard
   - What's unclear: How to handle version mismatches when commands run on older config
   - Recommendation: Add configVersion field to config, warn if major version differs

## Sources

### Primary (HIGH confidence)
- [Commander.js GitHub](https://github.com/tj/commander.js) - Subcommand patterns, option handling
- [find-up GitHub](https://github.com/sindresorhus/find-up) - v8.0.0 API, usage patterns
- [Node.js CLI Apps Best Practices](https://github.com/lirantal/nodejs-cli-apps-best-practices) - Error handling, exit codes, user feedback
- [npm package.json bin documentation](https://docs.npmjs.com/cli/v8/configuring-npm/package-json/) - Multiple binary entry points

### Secondary (MEDIUM confidence)
- [Node.js Command Line API](https://nodejs.org/api/cli.html) - Native argument handling, deprecation patterns
- [npm-compare: commander vs yargs](https://npm-compare.com/commander,yargs) - Framework comparison data
- [DEV Community: Mastering Node.js CLI](https://dev.to/boudydegeer/mastering-nodejs-cli-best-practices-and-tips-7j5) - General CLI patterns

### Tertiary (LOW confidence)
- Web search results on deprecation messaging - Common patterns but not verified against official sources

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - find-up is established, native Node.js is proven, project already uses picocolors/prompts
- Architecture: HIGH - Command registry pattern is standard, verified against multiple sources
- Pitfalls: MEDIUM - Based on experience patterns and best practices guides
- Code examples: HIGH - Derived from current codebase + official documentation

**Research date:** 2026-01-21
**Valid until:** 2026-03-21 (60 days - stable domain, slow-changing)
