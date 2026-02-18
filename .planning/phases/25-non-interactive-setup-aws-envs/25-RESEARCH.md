# Phase 25: Non-Interactive setup-aws-envs - Research

**Researched:** 2026-02-18
**Domain:** CLI non-interactive mode, email derivation, subprocess invocation, Zod schema validation
**Confidence:** HIGH

## Summary

Phase 25 mirrors Phase 24 exactly in structure: add a `--config <path>` flag to `setup-aws-envs`, validate the JSON config with Zod, and drive the full AWS setup flow without interactive prompts. The Phase 24 implementation is complete and working — the pattern, test structure, Zod schema, and CLI wiring are all established. Phase 25 is a targeted copy-and-adapt of that pattern into `runSetupAwsEnvs()`.

The two new behaviors unique to Phase 25 are: (1) email derivation — given `owner@example.com`, automatically produce `owner-dev@example.com`, `owner-stage@example.com`, `owner-prod@example.com` by inserting `-{env}` before `@`; and (2) automatic GitHub setup — after AWS completes, unconditionally call `runInitializeGitHub(['--all'])` with the failure handled gracefully (warning + exit 0, not exit 1). Both are straightforward string manipulation and control flow additions.

The key architectural decision from CONTEXT.md: detect `--config` inside `runSetupAwsEnvs()`, not inside `run()` in `cli.ts`. This matches Phase 24's decision to detect `--config` inside `runCreate()`. The function already receives `_args: string[]` (renamed to `args` for non-interactive support). The existing `collectEmails()` call at line 404 is the only interactive prompt in the main setup flow — replace it with derived emails when `--config` is provided.

**Primary recommendation:** Create `src/config/non-interactive-aws.ts` with a minimal Zod schema (only `email` required), a `deriveEnvironmentEmails()` utility, and a `loadSetupAwsEnvsConfig()` loader. In `setup-aws-envs.ts`, rename `_args` to `args`, detect `--config`, skip `collectEmails()`, and auto-invoke `runInitializeGitHub(['--all'])` at the end.

## Standard Stack

All dependencies are already installed. No new packages needed.

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| zod | ^4.3.6 | Config schema validation | Already in project (Phase 24); same `safeParse()` + `result.error.issues` pattern |
| node:fs (readFileSync) | built-in | Read JSON config file | Already used in `setup-aws-envs.ts` |
| node:path (resolve) | built-in | Resolve config file path | Already used throughout codebase |
| picocolors | ^1.1.1 | Color output | Already in `setup-aws-envs.ts` |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| node:child_process (execSync) | built-in | Could invoke initialize-github; NOT needed | `runInitializeGitHub()` is a direct function call from same package |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Direct `runInitializeGitHub(['--all'])` | `execSync('npx create-aws-project initialize-github --all')` | Direct function call is faster, doesn't fork a new process, shares same context; subprocess adds unnecessary complexity |

**Installation:**
```bash
# No new packages needed — all dependencies already installed
```

## Architecture Patterns

### Recommended Project Structure

New files:
```
src/
├── config/
│   ├── non-interactive.ts          # Phase 24 (existing) — wizard config schema
│   └── non-interactive-aws.ts      # NEW — setup-aws-envs config schema + email derivation
└── commands/
    └── setup-aws-envs.ts           # Modified — add --config detection + non-interactive path
```

New test files:
```
src/__tests__/
└── config/
    └── non-interactive-aws.spec.ts # NEW — unit tests for schema + email derivation
```

### Pattern 1: Detect `--config` in `runSetupAwsEnvs()`

**What:** Rename `_args` parameter to `args`, extract `--config <path>` at the top of `runSetupAwsEnvs()`. If present, branch to non-interactive path.

**When to use:** When args contains `--config`.

**Example:**
```typescript
// In src/commands/setup-aws-envs.ts
export async function runSetupAwsEnvs(args: string[]): Promise<void> {
  // Non-interactive path: --config flag provided
  const configFlagIndex = args.findIndex(arg => arg === '--config');
  if (configFlagIndex !== -1) {
    const configPath = args[configFlagIndex + 1];
    if (!configPath || configPath.startsWith('--')) {
      console.error(pc.red('Error:') + ' --config requires a path argument');
      console.error('  Example: npx create-aws-project setup-aws-envs --config aws.json');
      process.exit(1);
    }
    await runSetupAwsEnvsNonInteractive(configPath);
    return;
  }

  // Interactive path (unchanged below)
  // ...
}
```

**Note:** `cli.ts` passes `commandArgs` (args after the subcommand) to `runSetupAwsEnvs()`. The `--config` flag will appear in `commandArgs` when invoked as `setup-aws-envs --config aws.json`. This requires no changes to `cli.ts`.

### Pattern 2: Zod Schema for setup-aws-envs Config

**What:** Minimal schema — only `email` is required. No other fields because the AWS setup already reads all other settings from the existing `.aws-starter-config.json` in the project directory.

**When to use:** In `src/config/non-interactive-aws.ts`.

**Example:**
```typescript
// Source: Zod v4 API (zod.dev/api) — same pattern as Phase 24
import * as z from 'zod';

export const SetupAwsEnvsConfigSchema = z.object({
  email: z.string().min(1, { message: 'email is required' }),
});

export type SetupAwsEnvsConfig = z.infer<typeof SetupAwsEnvsConfigSchema>;
```

**Why minimal:** The command already reads `config.projectName`, `config.awsRegion`, and account state from `.aws-starter-config.json` (via `requireProjectContext()`). The only thing the non-interactive caller needs to supply is the root email address. Unknown keys are silently stripped per Phase 24 decision (`z.object()` not `z.strictObject()`).

### Pattern 3: Email Derivation

**What:** Given a root email `user@example.com`, insert `-{env}` before `@` to produce per-environment emails.

**When to use:** In `src/config/non-interactive-aws.ts` as a standalone exported function.

**Example:**
```typescript
// Source: codebase analysis — NI-08 specification
export function deriveEnvironmentEmails(
  rootEmail: string,
  environments: readonly string[]
): Record<string, string> {
  const atIndex = rootEmail.lastIndexOf('@');
  const localPart = rootEmail.slice(0, atIndex);
  const domain = rootEmail.slice(atIndex); // includes '@'

  const derived: Record<string, string> = {};
  for (const env of environments) {
    derived[env] = `${localPart}-${env}${domain}`;
  }
  return derived;
}
```

**Edge case — plus aliases:** `user+tag@example.com` → `user+tag-dev@example.com`. The `-{env}` is appended to the entire local part before `@`. This is valid RFC 5321 behavior. Do not special-case plus aliases.

**Edge case — subdomain emails:** `user@sub.example.com` → `user-dev@sub.example.com`. No special handling needed — `lastIndexOf('@')` handles this correctly.

**Edge case — multiple `@` signs:** Technically invalid emails, but `lastIndexOf('@')` finds the last `@`, which is the correct separator. Zod email format validation is not added per pattern (keep schema minimal; basic format validation via `z.string().min(1)` is sufficient — invalid emails will fail at the AWS account creation step with a clear AWS error).

**Why `lastIndexOf` not `indexOf`:** Defensive; same result for valid emails; correct for any malformed input.

### Pattern 4: Non-Interactive AWS Setup Flow

**What:** Full AWS setup with derived emails, skipping `collectEmails()`, auto-running GitHub setup at end.

**When to use:** When `--config` is provided.

**Example:**
```typescript
async function runSetupAwsEnvsNonInteractive(configPath: string): Promise<void> {
  // 1. Load and validate config
  const awsConfig = loadSetupAwsEnvsConfig(configPath);

  // 2. Derive per-environment emails
  const ENVIRONMENTS = ['dev', 'stage', 'prod'] as const;
  const emails = deriveEnvironmentEmails(awsConfig.email, ENVIRONMENTS);

  // 3. Log derived emails for transparency (per CONTEXT.md decision)
  console.log('');
  console.log('Derived environment emails:');
  for (const [env, email] of Object.entries(emails)) {
    console.log(`  ${pc.cyan(env)}: ${email}`);
  }
  console.log('');

  // 4. Run the same AWS setup flow as interactive mode
  //    (call shared logic with emails pre-supplied, no collectEmails() call)

  // ... AWS setup logic (same as interactive, emails already known) ...

  // 5. Auto-run GitHub setup (per CONTEXT.md decision)
  console.log('Setting up GitHub environments...');
  try {
    await runInitializeGitHub(['--all']);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.warn(pc.yellow('Warning:') + ` GitHub setup failed: ${msg}`);
    console.warn('AWS setup completed successfully. Run initialize-github manually:');
    console.warn(`  ${pc.cyan('npx create-aws-project initialize-github --all')}`);
  }
}
```

### Pattern 5: Loader Function

**What:** Read file, parse JSON, validate with Zod, exit with all errors on failure.

**Example:**
```typescript
// In src/config/non-interactive-aws.ts
import * as z from 'zod';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import pc from 'picocolors';

export function loadSetupAwsEnvsConfig(configPath: string): SetupAwsEnvsConfig {
  const absolutePath = resolve(process.cwd(), configPath);

  let rawContent: string;
  try {
    rawContent = readFileSync(absolutePath, 'utf-8');
  } catch {
    console.error(pc.red('Error:') + ` Cannot read config file: ${absolutePath}`);
    process.exit(1);
  }

  let rawData: unknown;
  try {
    rawData = JSON.parse(rawContent);
  } catch {
    console.error(pc.red('Error:') + ` Config file is not valid JSON: ${absolutePath}`);
    process.exit(1);
  }

  const result = SetupAwsEnvsConfigSchema.safeParse(rawData);

  if (!result.success) {
    console.error(pc.red('Error:') + ' Invalid config file:');
    console.error('');
    for (const issue of result.error.issues) {
      const fieldPath = issue.path.length > 0 ? issue.path.join('.') : '(root)';
      console.error(`  ${pc.red('x')} ${fieldPath}: ${issue.message}`);
    }
    console.error('');
    process.exit(1);
  }

  return result.data;
}
```

### Pattern 6: Shared Setup Logic Extraction (Optional Refactor)

**What:** The interactive flow currently runs all AWS setup inline in `runSetupAwsEnvs()`. The non-interactive path needs the same logic but with `emails` already known, not collected via prompts.

**Options:**

**Option A (simpler, recommended):** Keep interactive path unchanged. In the non-interactive path, replicate only the core AWS logic, skipping the `collectEmails()` call. The non-interactive function is self-contained. Duplication is minimal — the key branching point is one `collectEmails()` call and the final GitHub prompt.

**Option B (cleaner but riskier):** Extract a `runAwsSetupCore(emails: Record<string, string>)` shared function, call it from both paths. Risk: refactoring existing working code; regression potential.

**Recommendation: Option A.** The non-interactive function calls `requireProjectContext()`, runs the same spinner/account/IAM/CDK sequence with pre-derived emails, then auto-calls `runInitializeGitHub(['--all'])`. This is a net-new function that doesn't modify the existing interactive flow. The final interactive GitHub prompt is replaced with an unconditional `runInitializeGitHub(['--all'])` call.

### Anti-Patterns to Avoid

- **Adding `--config` detection to `cli.ts`:** The CONTEXT.md decision is clear: detect inside `runSetupAwsEnvs()`. `cli.ts` routing passes `commandArgs` to the handler — no changes to `cli.ts` needed.
- **Forking a subprocess to call `initialize-github`:** Use `runInitializeGitHub(['--all'])` direct function call. It's already imported in `setup-aws-envs.ts`.
- **Exiting non-zero when `initialize-github` fails:** Per CONTEXT.md, AWS setup is the primary goal. GitHub failure = warning + exit 0.
- **Validating email format strictly in Zod:** Keep the schema minimal. `z.string().min(1)` catches empty/missing. AWS will provide the authoritative error for invalid email formats.
- **Sharing the Phase 24 config file/schema:** The setup-aws-envs config is a completely separate concern (different required fields). Create a separate `non-interactive-aws.ts` file.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JSON config validation | Custom if/else field checks | `SetupAwsEnvsConfigSchema.safeParse()` | Zod collects all errors; TypeScript infers the type |
| Email derivation | Regex with capture groups | String `lastIndexOf('@')` split-and-join | Simple string op is reliable; no regex needed |
| GitHub setup subprocess | `execSync('npx create-aws-project initialize-github --all')` | `runInitializeGitHub(['--all'])` | Direct import is already in file; no subprocess overhead |
| Error message formatting | Custom formatter | Same `pc.red('Error:') + ...` pattern as rest of codebase | Consistency; matches Phase 24 style |

**Key insight:** The entire non-interactive AWS schema is one required field (`email`). Do not add optional fields preemptively. The project's AWS configuration (region, project name, etc.) already lives in `.aws-starter-config.json` — `requireProjectContext()` reads it.

## Common Pitfalls

### Pitfall 1: `_args` Parameter Prevents `--config` Detection

**What goes wrong:** `runSetupAwsEnvs(_args: string[])` uses `_args` prefix (conventional "unused" marker). Renaming to `args` is required to actually use it.
**Why it happens:** The original parameter was declared unused because the interactive flow doesn't use args.
**How to avoid:** Rename `_args` to `args` and remove the leading underscore. Check if any linter config flags this — the `@typescript-eslint/no-unused-vars` rule typically uses the `_` prefix as an exclusion pattern. Renaming to `args` and using it resolves the unused-vars warning.
**Warning signs:** TypeScript/ESLint warning "Parameter 'args' is declared but its value is never read" if `--config` detection is added but the actual non-interactive path wasn't.

### Pitfall 2: `collectEmails()` Is Outside the Spinner

**What goes wrong:** The existing code calls `spinner.stop()` at line 400 before `collectEmails()` — because prompts conflict with ora. In the non-interactive path, there are no prompts, so the spinner can stay active through email derivation.
**Why it happens:** The interactive code structure was built around the spinner/prompts conflict.
**How to avoid:** In `runSetupAwsEnvsNonInteractive()`, do not replicate the `spinner.stop()` + `collectEmails()` + `spinner.start()` sequence. Instead, use the derived emails directly and keep the spinner active.
**Warning signs:** Spinner showing at wrong times, or spinner stopped too early in non-interactive mode.

### Pitfall 3: `initialize-github --all` Will Prompt for GitHub PAT

**What goes wrong:** `runInitializeGitHub(['--all'])` in batch mode calls `promptForGitHubPAT()` which is an interactive prompt. Invoking it from non-interactive `setup-aws-envs` will block waiting for user input.
**Why it happens:** `initialize-github` is not itself non-interactive — it still prompts for the PAT and repo info.
**How to avoid:** The CONTEXT.md decision is to "auto-run `initialize-github --all`" — but looking at the actual `runInitializeGitHub()` code in batch mode (line 284+), it calls `promptForGitHubPAT()` which is interactive. This means in true non-interactive mode, the GitHub step will block.

**Resolution:** The non-interactive `setup-aws-envs` invokes `runInitializeGitHub(['--all'])`, which will prompt for PAT/repo interactively. This is acceptable per the requirement: the AWS setup completes without prompts (NI-07, NI-08, NI-09), and the GitHub step that follows can still be interactive. If `initialize-github` fails (user cancels, missing credentials), `setup-aws-envs` exits 0 with a warning — AWS setup is the primary goal.

**Warning signs:** Test expecting fully non-interactive behavior through GitHub step — that's not the requirement. The requirement is that AWS setup itself (accounts, IAM, CDK) requires no interaction.

### Pitfall 4: GitHub PAT Environment Variable Not in Scope

**What goes wrong:** Hoping to make GitHub step non-interactive by reading `GITHUB_TOKEN` from env — this logic doesn't exist in `initialize-github` today.
**Why it happens:** Common assumption that env vars bypass prompts.
**How to avoid:** Don't add `GITHUB_TOKEN` env var handling to `initialize-github` in Phase 25. That's a separate enhancement. The success criteria only require the AWS setup to run without prompts, not the subsequent GitHub step.
**Warning signs:** Phase scope creeping into modifying `initialize-github` to be non-interactive.

### Pitfall 5: Email Derivation Breaks for Emails Without `@`

**What goes wrong:** `deriveEnvironmentEmails('notanemail', [...])` produces `notanemail-dev` with empty domain.
**Why it happens:** `lastIndexOf('@')` returns `-1` if no `@` found; `slice(0, -1)` takes all but last character.
**How to avoid:** Zod's `z.string().min(1)` doesn't validate email format. Add basic format check: after `safeParse`, verify the email contains `@`. Or add `z.string().includes('@')` refinement. A simple check:
```typescript
if (!result.data.email.includes('@')) {
  console.error(pc.red('Error:') + ' Invalid config file:');
  console.error('');
  console.error(`  ${pc.red('x')} email: must be a valid email address`);
  console.error('');
  process.exit(1);
}
```
Do not use `z.string().email()` — this is a Zod v3 chained method. In Zod v4, email validation is `z.email()` (top-level), not chained. For this phase, a simple `includes('@')` check is sufficient.
**Warning signs:** Derived emails like `owne-dev` (missing domain) being passed to AWS account creation.

### Pitfall 6: `process.exit(1)` Inside `try/catch` in Non-Interactive Path

**What goes wrong:** The existing `handleAwsError()` always calls `process.exit(1)`. The non-interactive path's GitHub step uses a `try/catch` that should NOT call `handleAwsError()` — it should warn and continue.
**Why it happens:** Reusing `handleAwsError()` for the GitHub step would exit non-zero, which contradicts the CONTEXT.md decision (GitHub failure = warning + exit 0).
**How to avoid:** Use a separate try/catch for the `runInitializeGitHub(['--all'])` call. Do not pass its errors to `handleAwsError()`.
**Warning signs:** `setup-aws-envs --config aws.json` exits non-zero when GitHub setup fails.

## Code Examples

### Email Derivation (Verified by Specification)
```typescript
// Source: NI-08 specification + codebase analysis
export function deriveEnvironmentEmails(
  rootEmail: string,
  environments: readonly string[]
): Record<string, string> {
  const atIndex = rootEmail.lastIndexOf('@');
  const localPart = rootEmail.slice(0, atIndex);
  const domain = rootEmail.slice(atIndex); // includes '@'
  const result: Record<string, string> = {};
  for (const env of environments) {
    result[env] = `${localPart}-${env}${domain}`;
  }
  return result;
}

// Example:
// deriveEnvironmentEmails('owner@example.com', ['dev', 'stage', 'prod'])
// → { dev: 'owner-dev@example.com', stage: 'owner-stage@example.com', prod: 'owner-prod@example.com' }
```

### Zod Schema (Minimal — Only Email Required)
```typescript
// Source: Zod v4 API (same pattern as Phase 24's non-interactive.ts)
import * as z from 'zod';

export const SetupAwsEnvsConfigSchema = z.object({
  email: z.string().min(1, { message: 'email is required' }),
});

export type SetupAwsEnvsConfig = z.infer<typeof SetupAwsEnvsConfigSchema>;
```

### GitHub Step Error Handling (Warning + Exit 0)
```typescript
// Source: CONTEXT.md decision: "setup-aws-envs still exits 0 with a warning"
console.log('');
console.log('Setting up GitHub environments...');
try {
  await runInitializeGitHub(['--all']);
} catch (error) {
  const msg = error instanceof Error ? error.message : String(error);
  console.warn(pc.yellow('Warning:') + ` GitHub setup failed: ${msg}`);
  console.warn('AWS setup completed successfully. Run initialize-github manually:');
  console.warn(`  ${pc.cyan('npx create-aws-project initialize-github --all')}`);
  // Note: process.exit(0) happens naturally after this — no explicit exit needed
  // OR call process.exit(0) explicitly if there's any risk of fallthrough
}
```

### Unit Test Pattern for Email Derivation
```typescript
// Source: Phase 24 test pattern (non-interactive.spec.ts)
describe('deriveEnvironmentEmails', () => {
  it('derives standard dev/stage/prod emails', () => {
    const result = deriveEnvironmentEmails('owner@example.com', ['dev', 'stage', 'prod']);
    expect(result.dev).toBe('owner-dev@example.com');
    expect(result.stage).toBe('owner-stage@example.com');
    expect(result.prod).toBe('owner-prod@example.com');
  });

  it('handles plus alias emails', () => {
    const result = deriveEnvironmentEmails('user+tag@company.com', ['dev']);
    expect(result.dev).toBe('user+tag-dev@company.com');
  });

  it('handles subdomain emails', () => {
    const result = deriveEnvironmentEmails('admin@sub.example.com', ['dev']);
    expect(result.dev).toBe('admin-dev@sub.example.com');
  });
});
```

### Unit Test Pattern for Schema Validation
```typescript
// Source: Phase 24 test pattern (non-interactive.spec.ts)
describe('loadSetupAwsEnvsConfig', () => {
  beforeEach(() => {
    jest.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit called');
    }) as () => never);
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('loads valid config with email field', () => {
    const tmpFile = writeTempConfig({ email: 'owner@example.com' });
    const config = loadSetupAwsEnvsConfig(tmpFile);
    expect(config.email).toBe('owner@example.com');
  });

  it('exits when email is missing', () => {
    const tmpFile = writeTempConfig({});
    expect(() => loadSetupAwsEnvsConfig(tmpFile)).toThrow('process.exit called');
    expect(process.exit).toHaveBeenCalledWith(1);
  });

  it('strips unknown keys silently', () => {
    const tmpFile = writeTempConfig({ email: 'owner@example.com', unknown: 'value' });
    const config = loadSetupAwsEnvsConfig(tmpFile);
    expect(config.email).toBe('owner@example.com');
    expect((config as Record<string, unknown>).unknown).toBeUndefined();
  });
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Direct interactive prompts for all inputs | `--config` flag for non-interactive mode | Phase 24 (complete) | Phase 25 follows the same flag pattern |
| `_args: string[]` parameter (unused) | `args: string[]` parameter (used for `--config` detection) | Phase 25 | Rename when adding `--config` detection |
| Interactive GitHub continuation prompt | Auto-run `runInitializeGitHub(['--all'])` | Phase 25 | The `prompts()` call at lines 580-604 is replaced in non-interactive path |

**Existing code that Phase 25 bypasses:**
- `collectEmails()` call (lines 404-413 in `setup-aws-envs.ts`) — replaced by `deriveEnvironmentEmails()`
- `prompts({ type: 'confirm', name: 'continueToGitHub' })` (lines 580-604) — replaced by unconditional `runInitializeGitHub(['--all'])` call

## Open Questions

1. **Does `runInitializeGitHub(['--all'])` actually fail cleanly when caught in try/catch?**
   - What we know: `runInitializeGitHub` calls `process.exit(1)` internally on GitHub auth failure (line 264 in `initialize-github.ts`). `process.exit()` throws in the test environment but does NOT throw in production — it terminates the process.
   - What's unclear: In production, if `initialize-github` calls `process.exit(1)`, the entire `setup-aws-envs` process will terminate with exit code 1, bypassing the try/catch. The try/catch cannot catch `process.exit()`.
   - Recommendation: The planner should decide whether to (a) accept this behavior — GitHub auth failures will exit 1 regardless, (b) restructure `runInitializeGitHub` to return a result instead of calling `process.exit()`, or (c) skip the try/catch entirely since it can't catch `process.exit()` anyway, and instead accept that GitHub failures cause non-zero exit (which slightly conflicts with CONTEXT.md "exits 0 with a warning" decision).

   **Most pragmatic resolution:** Document in the plan that the "exit 0 on GitHub failure" guarantee only applies to network/API errors that throw JavaScript `Error` objects (which the try/catch CAN catch), not to errors that cause `runInitializeGitHub` to internally call `process.exit(1)`. This is a known limitation and acceptable for Phase 25.

2. **Should email format be validated more strictly than `includes('@')`?**
   - What we know: AWS has its own email validation and will reject malformed emails with a clear error. Overly strict validation here duplicates AWS logic.
   - Recommendation: Use `includes('@')` to catch the obvious case (no `@` would break derivation). Skip full RFC 5321 validation — let AWS be the authority.

## Sources

### Primary (HIGH confidence)
- Codebase: `src/commands/setup-aws-envs.ts` — Full interactive flow; identified exact lines to bypass for non-interactive mode
- Codebase: `src/commands/initialize-github.ts` — `runInitializeGitHub(['--all'])` function signature; batch mode behavior; `process.exit()` call pattern
- Codebase: `src/config/non-interactive.ts` — Phase 24 Zod schema + loader pattern to replicate exactly
- Codebase: `src/cli.ts` — `runCreate()` `--config` detection pattern (exact model for Phase 25)
- Codebase: `src/__tests__/config/non-interactive.spec.ts` — Test pattern to replicate for new spec file
- Codebase: `src/utils/project-context.ts` — `requireProjectContext()` usage; confirms project config already available
- `.planning/phases/25-non-interactive-setup-aws-envs/25-CONTEXT.md` — Locked decisions for Phase 25

### Secondary (MEDIUM confidence)
- `.planning/phases/24-non-interactive-wizard-mode/24-RESEARCH.md` — Phase 24 research (verified findings already applied in codebase)
- `.planning/phases/24-non-interactive-wizard-mode/24-02-PLAN.md` — Phase 24 plan (confirmed implementation pattern)

### Tertiary (LOW confidence)
- None — all findings from direct codebase inspection; no WebSearch findings needed

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies; all libraries already in project; patterns directly confirmed by reading implemented Phase 24 code
- Architecture: HIGH — integration points identified by reading actual source files; no speculation needed
- Email derivation: HIGH — simple string operation verified by reading NI-08 spec and testing mentally against examples
- GitHub step open question: MEDIUM — `process.exit()` vs try/catch behavior is a known Node.js fact; the interaction with the specific code is inferred but not tested

**Research date:** 2026-02-18
**Valid until:** 2026-05-18 (90 days — stable codebase; no external library changes needed)
