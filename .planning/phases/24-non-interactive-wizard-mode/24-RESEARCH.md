# Phase 24: Non-Interactive Wizard Mode - Research

**Researched:** 2026-02-18
**Domain:** CLI non-interactive mode, JSON config parsing, schema validation
**Confidence:** HIGH

## Summary

Phase 24 adds a `--config <path>` flag that reads a JSON config file and drives the project wizard without any interactive prompts. This is a targeted, contained change: the heavy lifting (project generation) already works; all that's needed is (1) a new code path in `cli.ts` and `wizard.ts` that bypasses `prompts`, (2) a validation layer that applies defaults and rejects unknown or missing-required values, and (3) a skip for git setup when in non-interactive mode.

The codebase already has the `ProjectConfig` type that defines every value the wizard collects. The config schema for Phase 24 maps almost 1:1 to that type. The main new work is: parse the JSON file, validate it against known-good values using Zod, apply defaults for omitted optional fields, then hand a fully-formed `ProjectConfig` to the existing `generateProject()` function unchanged.

Zod v4 (current stable: 4.3.6) is the standard library for this. It is NOT currently a project dependency; it must be added. Zod provides `safeParse()` which collects ALL validation failures in one pass (rather than throwing on the first error), matching requirement NI-05 exactly. Its `.default()` modifier handles NI-04 defaults declaratively.

**Primary recommendation:** Add `zod` as a runtime dependency. Create `src/config/non-interactive.ts` with a Zod schema + loader function. Detect `--config` in `runCreate()` within `cli.ts` and branch to a non-interactive path that skips `runWizard()` and `promptGitSetup()`.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| zod | ^4.3.6 | JSON config schema validation | De-facto TypeScript schema validator; `safeParse()` collects all errors in one pass; `.default()` handles NI-04 defaults declaratively; static type inference from schema |
| node:fs (readFileSync) | built-in | Read JSON config file | Already used in `cli.ts`; synchronous read is fine at startup |
| node:path (resolve) | built-in | Resolve config file path relative to cwd | Already used throughout codebase |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| picocolors | ^1.1.1 | Color error output | Already in project; use `pc.red()` for validation errors |
| validate-npm-package-name | ^7.0.2 | Validate project name in config | Already in project via `validation/project-name.ts` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| zod | Hand-rolled validation | Hand-rolled: faster to write first time, but grows messy fast; doesn't infer TypeScript types; error collection requires manual accumulator; zod is the right tool |
| zod | valibot | Valibot is newer, smaller bundle, but zod v4 is stable and has more ecosystem familiarity; for a CLI that's already not bundle-size-sensitive, zod wins on maturity |
| zod | ajv (JSON Schema) | ajv is heavier, JSON Schema is more verbose than zod's TypeScript API; no static type inference |

**Installation:**
```bash
npm install zod
```

## Architecture Patterns

### Recommended Project Structure

New files needed:
```
src/
├── config/
│   └── non-interactive.ts   # Zod schema + loadNonInteractiveConfig() function
├── cli.ts                   # Add --config flag detection in runCreate()
└── wizard.ts                # No changes needed
```

New test files needed:
```
src/__tests__/
└── config/
    └── non-interactive.spec.ts  # Unit tests for schema + loader
```

### Pattern 1: Detect `--config` Flag in `runCreate()`

**What:** Extract `--config <path>` from args at the top of `runCreate()`. If present, branch to non-interactive path. If absent, fall through to existing `runWizard()` path.

**When to use:** When `args` contains `--config` flag.

**Example:**
```typescript
// In cli.ts, inside runCreate()
async function runCreate(args: string[]): Promise<void> {
  printWelcome();
  console.log('');

  // Non-interactive path: --config flag provided
  const configFlagIndex = args.findIndex(arg => arg === '--config');
  if (configFlagIndex !== -1) {
    const configPath = args[configFlagIndex + 1];
    if (!configPath || configPath.startsWith('--')) {
      console.error(pc.red('Error:') + ' --config requires a path argument');
      console.error('  Example: npx create-aws-project --config project.json');
      process.exit(1);
    }
    await runNonInteractive(configPath);
    return;
  }

  // Interactive path (unchanged)
  const nameArg = args.find(arg => !arg.startsWith('-'));
  const config = await runWizard(nameArg ? { defaultName: nameArg } : undefined);
  // ... rest of existing interactive flow
}
```

### Pattern 2: Zod Schema for Config File

**What:** Define the JSON config schema with Zod. Required: `name`. All others optional with defaults matching NI-04 spec.

**When to use:** In `src/config/non-interactive.ts`.

**Example:**
```typescript
// Source: Zod v4 official docs (zod.dev/api)
import * as z from 'zod';

const VALID_PLATFORMS = ['web', 'mobile', 'api'] as const;
const VALID_AUTH_PROVIDERS = ['none', 'cognito', 'auth0'] as const;
const VALID_AUTH_FEATURES = ['social-login', 'mfa'] as const;
const VALID_FEATURES = ['github-actions', 'vscode-config'] as const;
const VALID_REGIONS = ['us-east-1', 'us-west-2', 'eu-west-1', 'eu-central-1', 'ap-northeast-1', 'ap-southeast-2'] as const;
const VALID_BRAND_COLORS = ['blue', 'purple', 'teal', 'green', 'orange'] as const;

export const NonInteractiveConfigSchema = z.object({
  name: z.string().min(1),                              // NI-04: required
  platforms: z.array(z.enum(VALID_PLATFORMS))
    .min(1)
    .default(['web', 'api']),                           // NI-04: default web+api
  auth: z.enum(VALID_AUTH_PROVIDERS).default('none'),  // NI-04: default none
  authFeatures: z.array(z.enum(VALID_AUTH_FEATURES)).default([]),
  features: z.array(z.enum(VALID_FEATURES))
    .default(['github-actions', 'vscode-config']),      // NI-04: default both features
  region: z.string()
    .refine(v => VALID_REGIONS.includes(v as typeof VALID_REGIONS[number]), {
      error: `Must be one of: ${[...VALID_REGIONS].join(', ')}`,
    })
    .default('us-east-1'),                             // NI-04: default us-east-1
  brandColor: z.enum(VALID_BRAND_COLORS).default('blue'), // NI-04: default blue
});

export type NonInteractiveConfig = z.infer<typeof NonInteractiveConfigSchema>;
```

**Important note on Zod v4 enum:** In Zod v4, the argument to `z.enum()` must be a tuple literal or `as const` array — not a plain `string[]`. Use `z.enum(['a', 'b', 'c'] as const)` or `z.enum(VALID_PLATFORMS)` where `VALID_PLATFORMS` is declared `as const`.

### Pattern 3: Load, Validate, and Report All Errors

**What:** Read the JSON file, parse it, run Zod validation, collect ALL failures and print them, exit non-zero.

**When to use:** Implements NI-01, NI-02, NI-03, NI-05.

**Example:**
```typescript
// Source: Zod v4 safeParse API (zod.dev/basics)
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import pc from 'picocolors';
import { NonInteractiveConfigSchema } from './non-interactive.js';
import type { ProjectConfig } from '../types.js';
import { validateProjectName } from '../validation/project-name.js';

export function loadNonInteractiveConfig(configPath: string): ProjectConfig {
  // 1. Resolve path relative to cwd
  const absolutePath = resolve(process.cwd(), configPath);

  // 2. Read file (fail fast if not found)
  let rawContent: string;
  try {
    rawContent = readFileSync(absolutePath, 'utf-8');
  } catch {
    console.error(pc.red('Error:') + ` Cannot read config file: ${absolutePath}`);
    process.exit(1);
  }

  // 3. Parse JSON (fail fast if invalid JSON)
  let rawData: unknown;
  try {
    rawData = JSON.parse(rawContent);
  } catch {
    console.error(pc.red('Error:') + ` Config file is not valid JSON: ${absolutePath}`);
    process.exit(1);
  }

  // 4. Validate with Zod (collect ALL errors)
  const result = NonInteractiveConfigSchema.safeParse(rawData);

  if (!result.success) {
    console.error(pc.red('Error:') + ' Invalid config file:');
    console.error('');
    for (const issue of result.error.issues) {
      const fieldPath = issue.path.length > 0 ? issue.path.join('.') : '(root)';
      console.error(`  ${pc.red('✗')} ${fieldPath}: ${issue.message}`);
    }
    console.error('');
    process.exit(1);
  }

  const cfg = result.data;

  // 5. Additional name validation (reuse existing project-name validator)
  const nameValidation = validateProjectName(cfg.name);
  if (nameValidation !== true) {
    console.error(pc.red('Error:') + ' Invalid config file:');
    console.error('');
    console.error(`  ${pc.red('✗')} name: ${nameValidation}`);
    console.error('');
    process.exit(1);
  }

  // 6. Map to ProjectConfig (internal shape)
  return {
    projectName: cfg.name,
    platforms: cfg.platforms,
    awsRegion: cfg.region,
    features: cfg.features,
    brandColor: cfg.brandColor,
    auth: {
      provider: cfg.auth,
      features: cfg.auth === 'none' ? [] : cfg.authFeatures,
    },
  };
}
```

### Pattern 4: Non-Interactive `runCreate` Path (NI-06: Skip Git)

**What:** After loading config, call `generateProject()` directly. Skip `promptGitSetup()`.

**Example:**
```typescript
// In cli.ts
async function runNonInteractive(configPath: string): Promise<void> {
  const config = loadNonInteractiveConfig(configPath);
  const outputDir = resolve(process.cwd(), config.projectName);

  if (existsSync(outputDir)) {
    console.error(pc.red('Error:') + ` Directory ${pc.cyan(config.projectName)} already exists.`);
    process.exit(1);
  }

  mkdirSync(outputDir, { recursive: true });

  console.log('');
  await generateProject(config, outputDir);
  writeConfigFile(outputDir, config);

  // NI-06: Skip git setup entirely in non-interactive mode
  // promptGitSetup() is NOT called

  console.log('');
  console.log(pc.green('✔') + ` Created ${pc.bold(config.projectName)} successfully!`);
  printNextSteps(config.projectName);
  process.exit(0);
}
```

### Anti-Patterns to Avoid

- **Falling back to prompts on invalid config:** NI-05 requires hard fail with error list, no fallback. Never call `runWizard()` after `--config`.
- **Validating only `name`:** Validate all fields. Unknown values for `platforms`, `auth`, etc. are errors, not silently ignored.
- **Throwing ZodError:** Always use `safeParse()` not `parse()` — `parse()` throws on the first error, losing subsequent failures.
- **Path resolution relative to script:** Resolve config path relative to `process.cwd()`, not `__dirname`. The user is specifying a path from their working directory.
- **Storing wizard defaults as magic strings in multiple places:** Define defaults once in the Zod schema's `.default()` calls. Don't duplicate them in the validator, the loader, and the tests.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Schema validation with all-errors collection | Custom accumulator loop with if/else checks | `zod.safeParse()` + `result.error.issues` | Zod collects all issues automatically across all fields; custom loop requires maintaining per-field logic |
| Enum validation for platforms/auth/etc. | `if (!['web','mobile','api'].includes(v))` | `z.enum(VALID_PLATFORMS)` | Zod generates the error message; TypeScript infers the allowed type; single source of truth |
| Optional-with-default logic | `const platforms = cfg.platforms ?? ['web', 'api']` | `.default(['web', 'api'])` in Zod schema | Defaults live in schema, not scattered in business logic; schema is the documentation |
| Project name validation | Duplicate the npm name check | `validateProjectName()` from `validation/project-name.ts` | Already in project, already tested, don't duplicate |

**Key insight:** Zod makes the schema the single source of truth for what's valid and what defaults apply. Without Zod, defaults and validation logic inevitably drift apart.

## Common Pitfalls

### Pitfall 1: Zod v4 Breaking Changes from v3

**What goes wrong:** Code written for Zod v3 syntax fails at runtime with Zod v4.
**Why it happens:** Zod v4 has breaking API changes: `z.string().email()` moved to `z.email()`, error customization moved to `error:` param, `.strict()` deprecated in favor of `z.strictObject()`.
**How to avoid:** Use Zod v4 API throughout. Don't copy old v3 examples. Key APIs for this phase (object, enum, array, string, default, safeParse) are stable in v4.
**Warning signs:** TypeScript compilation errors on `.email()` chained methods, or runtime errors about unknown schema methods.

### Pitfall 2: Zod `z.enum()` Requires `as const` Tuple

**What goes wrong:** `z.enum(['web', 'mobile', 'api'])` fails TypeScript inference.
**Why it happens:** Zod v4 infers enum values from literal types; `string[]` loses the literal types.
**How to avoid:** Declare as `const VALID_PLATFORMS = ['web', 'mobile', 'api'] as const` then pass `z.enum(VALID_PLATFORMS)`. Or inline as `z.enum(['web', 'mobile', 'api'] as const)`.
**Warning signs:** TypeScript error "Argument of type 'string[]' is not assignable to parameter of type '[string, ...string[]]'"

### Pitfall 3: `--config` Flag Parsing Collision with Command Detection

**What goes wrong:** `cli.ts` command parser treats `--config` value (the path string) as a command name.
**Why it happens:** Current `run()` finds the first non-flag argument as the command. If the config path is `config.json` (no leading `--`), it becomes the "command".
**How to avoid:** Detect `--config` before the command routing logic. Extract the config path explicitly (`args[flagIndex + 1]`), then strip both `--config` and the path from `args` before the switch statement, OR handle `--config` entirely within `runCreate()` by checking args passed to it.
**Warning signs:** Running `npx create-aws-project --config project.json` routes to "project.json" as a command instead of the default create flow.

Analyzing `cli.ts` more carefully: `runCreate(args)` receives all args including `--config`. The detection belongs inside `runCreate()`, not in `run()`. This avoids touching the command routing logic.

### Pitfall 4: `authFeatures` When `auth === 'none'`

**What goes wrong:** Config specifies `auth: "none"` and `authFeatures: ["social-login"]`, which is contradictory.
**Why it happens:** JSON config allows any combination; wizard prevents this via conditional prompt (`type: (prev) => prev !== 'none' ? 'multiselect' : null`).
**How to avoid:** In the loader, when `auth === 'none'`, always set `auth.features` to `[]` regardless of what `authFeatures` in the JSON says. Silently ignore or explicitly document as "authFeatures ignored when auth is none". Do not error — it's not harmful.
**Warning signs:** Generated project has auth features configured but auth provider is none.

### Pitfall 5: Missing `name` Field — Clear Error Required

**What goes wrong:** Zod's default error for a missing required string is "Invalid input: expected string, received undefined" — not super clear.
**Why it happens:** Zod's default messages are type-centric, not user-friendly for a CLI.
**How to avoid:** Add a custom error message for the `name` field: `z.string().min(1, { error: 'name is required' })`. This produces `name: name is required` rather than the default type error message.
**Warning signs:** Test for missing `name` shows confusing error output.

### Pitfall 6: `platforms` Array — Minimum 1 Item Not Enforced by Default

**What goes wrong:** User passes `{"name": "my-app", "platforms": []}` and gets a project with no platforms.
**Why it happens:** `z.array(...)` allows empty arrays by default.
**How to avoid:** Add `.min(1)` constraint on the platforms array: `z.array(z.enum(VALID_PLATFORMS)).min(1)`.
**Warning signs:** Empty platforms array doesn't error; project generates but with no web/mobile/api.

## Code Examples

Verified patterns from official sources:

### Complete Zod Schema for Phase 24
```typescript
// Source: Zod v4 API docs (zod.dev/api)
import * as z from 'zod';

const VALID_PLATFORMS = ['web', 'mobile', 'api'] as const;
const VALID_AUTH_PROVIDERS = ['none', 'cognito', 'auth0'] as const;
const VALID_AUTH_FEATURES = ['social-login', 'mfa'] as const;
const VALID_FEATURES = ['github-actions', 'vscode-config'] as const;
const VALID_REGIONS = [
  'us-east-1', 'us-west-2', 'eu-west-1',
  'eu-central-1', 'ap-northeast-1', 'ap-southeast-2'
] as const;
const VALID_BRAND_COLORS = ['blue', 'purple', 'teal', 'green', 'orange'] as const;

export const NonInteractiveConfigSchema = z.object({
  name: z.string().min(1, { error: 'name is required' }),
  platforms: z.array(z.enum(VALID_PLATFORMS)).min(1).default(['web', 'api']),
  auth: z.enum(VALID_AUTH_PROVIDERS).default('none'),
  authFeatures: z.array(z.enum(VALID_AUTH_FEATURES)).default([]),
  features: z.array(z.enum(VALID_FEATURES)).default(['github-actions', 'vscode-config']),
  region: z.enum(VALID_REGIONS).default('us-east-1'),
  brandColor: z.enum(VALID_BRAND_COLORS).default('blue'),
});
```

Note: `region` can be `z.enum(VALID_REGIONS)` rather than `z.string().refine(...)` since all valid values are known at compile time — simpler and produces better error messages.

### `safeParse` Error Collection
```typescript
// Source: Zod v4 basics (zod.dev/basics)
const result = NonInteractiveConfigSchema.safeParse(rawData);

if (!result.success) {
  console.error(pc.red('Error:') + ' Invalid config file:');
  console.error('');
  for (const issue of result.error.issues) {
    const field = issue.path.length > 0 ? issue.path.join('.') : '(root)';
    console.error(`  ${pc.red('✗')} ${field}: ${issue.message}`);
  }
  console.error('');
  process.exit(1);
}
// result.data is fully typed as NonInteractiveConfig with defaults applied
```

### Test: Minimal Config Produces Correct Defaults
```typescript
// Pattern: unit test for loadNonInteractiveConfig with tmp file
import { tmpdir } from 'node:os';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

it('should apply all defaults when only name is provided', () => {
  const tmpFile = join(tmpdir(), 'test-config.json');
  writeFileSync(tmpFile, JSON.stringify({ name: 'my-app' }));

  const config = loadNonInteractiveConfig(tmpFile);

  expect(config.projectName).toBe('my-app');
  expect(config.platforms).toEqual(['web', 'api']);
  expect(config.auth.provider).toBe('none');
  expect(config.features).toEqual(['github-actions', 'vscode-config']);
  expect(config.awsRegion).toBe('us-east-1');
  expect(config.brandColor).toBe('blue');
});
```

### Test: Invalid Config Reports All Errors and Exits Non-Zero
```typescript
it('should report all validation failures and call process.exit(1)', () => {
  const tmpFile = join(tmpdir(), 'bad-config.json');
  writeFileSync(tmpFile, JSON.stringify({
    // name missing
    platforms: ['invalid-platform'],
    auth: 'unknown-provider',
  }));

  // mock process.exit
  expect(() => loadNonInteractiveConfig(tmpFile)).toThrow('process.exit called');
  // Verify multiple errors were printed
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Zod v3 `z.string().email()` chained methods | Zod v4 top-level `z.email()` | Zod v4 (2024-2025) | Must use v4 API; v3 examples on internet are still common but deprecated |
| `z.object({}).strict()` | `z.strictObject({})` | Zod v4 | Strict mode is now top-level function, not method chain |
| Custom error maps | `error:` parameter on schema methods | Zod v4 | Simpler customization, no separate errorMap function |
| `.parse()` throwing ZodError | `.safeParse()` returning result union | Always existed, best practice since v3 | For CLIs, always use safeParse; thrown errors mix with other errors |

**Deprecated/outdated:**
- **Zod v3 `invalid_type_error`/`required_error`:** Replaced by `error:` in Zod v4. Don't use these.
- **`z.object().merge()`:** Deprecated in Zod v4; use `.extend()` instead.

## Open Questions

Things that couldn't be fully resolved:

1. **Should `--config` be detectable in `run()` before command routing, or only inside `runCreate()`?**
   - What we know: `run()` finds the first non-`--` arg as the command. `--config` is a flag, so it won't be picked up as a command. But the config PATH (e.g. `project.json`) could theoretically be interpreted as a command name if the command detection logic sees it — but this can't happen because `--config` is found before the command index, and the path string follows it. Still, cleaner to detect inside `runCreate()`.
   - What's unclear: Whether this creates any edge case with subcommand + `--config` in future (Phase 25 adds `--config` to `setup-aws-envs`).
   - Recommendation: Detect `--config` inside `runCreate()` for Phase 24. Phase 25 can add it to `runSetupAwsEnvs()` separately.

2. **Should `authFeatures` be silently dropped or warned when `auth === 'none'`?**
   - What we know: The wizard conditionally hides authFeatures when auth is none. JSON config can't enforce this at the JSON level.
   - Recommendation: Silently drop (set to `[]`). It's not an error — it's a no-op. Adding a warning would be noise for automated pipelines.

3. **Should unknown top-level keys in the JSON be errors?**
   - What we know: Zod's `z.object()` by default strips unknown keys. `z.strictObject()` would error on unknown keys.
   - Recommendation: Use `z.object()` (strip unknown keys silently). Unknown keys are likely from copy-paste or future schema evolution; failing on them is too strict for automation use.

## Sources

### Primary (HIGH confidence)
- [Zod v4 Basics](https://zod.dev/basics) - `safeParse()` API, error handling, optional fields
- [Zod v4 API Reference](https://zod.dev/api) - Object schemas, enum, array, default values
- [Zod v4 Changelog / Migration](https://zod.dev/v4/changelog) - Breaking changes from v3 to v4
- Codebase: `src/cli.ts` - Existing arg parsing pattern, `runCreate()` function
- Codebase: `src/wizard.ts` - `ProjectConfig` assembly, prompt structure
- Codebase: `src/types.ts` - `ProjectConfig`, `AuthConfig` type definitions
- Codebase: `src/prompts/*.ts` - All valid values for each wizard field (enums, choices)
- Codebase: `src/validation/project-name.ts` - Existing `validateProjectName()` to reuse
- Codebase: `src/git/setup.ts` - `promptGitSetup()` to SKIP in non-interactive mode

### Secondary (MEDIUM confidence)
- [npm: zod](https://npmjs.com/package/zod) - Current version 4.3.6 confirmed via `npm info zod version`
- [Building CLI apps with TypeScript in 2026](https://hackers.pub/@hongminhee/2026/typescript-cli-2026) - Modern CLI patterns; recommends Zod/Valibot adapters for validation

### Tertiary (LOW confidence)
- WebSearch: "Node.js CLI non-interactive mode JSON config file validation pattern 2026" - General pattern confirmation only; no new information beyond what codebase and Zod docs provide

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zod is the clear choice; verified version 4.3.6 from npm; API verified from zod.dev
- Architecture: HIGH — integration points are clear from reading the codebase; pattern is add-a-branch, not restructure
- Pitfalls: HIGH — most pitfalls discovered by directly reading the existing code and Zod v4 changelog
- Zod v4 API specifics: HIGH — verified from official zod.dev docs

**Research date:** 2026-02-18
**Valid until:** 2026-05-18 (90 days — Zod v4 is a stable major release; Node.js built-ins are stable)
