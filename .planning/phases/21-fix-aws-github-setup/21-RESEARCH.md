# Phase 21: Fix AWS -> GitHub Setup - Research

**Researched:** 2026-02-13
**Domain:** CLI UX patterns, multi-environment setup, credential input optimization
**Confidence:** HIGH

## Summary

Phase 21 addresses UX friction in the AWS -> GitHub setup workflow. Currently, users must run `initialize-github` three separate times (once per environment: dev, stage, prod), entering their GitHub PAT each time. This creates a tedious, error-prone experience that violates CLI best practices for batch operations and credential handling.

The old deprecated `setup-github` command had an "all environments at once" pattern that was better UX-wise, but it used the old profile-based approach. The new `initialize-github` command improved the architecture (reads credentials from config, no AWS operations) but regressed the user experience by requiring three separate invocations with three separate PAT prompts.

Additionally, `setup-aws-envs` completes successfully and simply prints "Next: npx create-aws-project initialize-github dev" — it doesn't offer to continue automatically, forcing users to context-switch and run a new command.

**Primary recommendation:** Add an "all environments" mode to `initialize-github` that: (1) prompts for GitHub PAT once and reuses it for all environments, (2) can be invoked explicitly via `initialize-github --all` or `initialize-github dev stage prod`, and (3) should be offered as a continuation prompt at the end of `setup-aws-envs`.

## Standard Stack

No new dependencies required. This is a UX refactoring using existing infrastructure.

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| prompts | Already in use | Interactive prompts | Already used for PAT input, supports confirm prompts |
| @octokit/rest | Already in use | GitHub API | Already used for secrets management |
| ora | Already in use | Progress spinners | Already used consistently throughout commands |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| picocolors | Already in use | Terminal colors | Already used for output formatting |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Interactive batch mode | Multiple CLI invocations | Current approach; rejected for poor UX (3x PAT prompts) |
| PAT caching to filesystem | Memory-only PAT reuse | More persistent but violates security best practice (clig.dev warns against storing secrets in files or env vars) |
| Auto-continue from setup-aws-envs | Manual command invocation | Current approach; rejected because it forces context-switch |
| Environment variables for PAT | Interactive prompt | Violates security best practices per clig.dev |

**Installation:**
```bash
# No new dependencies required
```

## Architecture Patterns

### Recommended Command Flow
```
User workflow (current - 4 commands):
  npx create-aws-project setup-aws-envs
  npx create-aws-project initialize-github dev    [prompts for PAT]
  npx create-aws-project initialize-github stage  [prompts for PAT again]
  npx create-aws-project initialize-github prod   [prompts for PAT again]

User workflow (improved - 2 commands):
  npx create-aws-project setup-aws-envs
  [prompted to continue to GitHub setup: Yes]
  [prompts for PAT once]
  [configures all 3 environments]

Alternative explicit invocation:
  npx create-aws-project setup-aws-envs
  npx create-aws-project initialize-github --all  [prompts for PAT once, does all envs]
```

### Pattern 1: Batch Operation with Single Credential Input

**What:** Accept GitHub PAT once, reuse for multiple environment configurations in the same session

**When to use:** When performing the same operation (push secrets) across multiple targets (environments) that use the same credential

**Example:**
```typescript
// In initialize-github.ts - NEW batch mode
export async function runInitializeGitHub(args: string[]): Promise<void> {
  const context = await requireProjectContext();

  // NEW: Check for --all flag or multiple environment arguments
  const batchMode = args.includes('--all') || args.length > 1;
  const environments = batchMode
    ? determineBatchEnvironments(args, context.config)
    : [await determineEnvironment(args[0], context.config)];

  // Get repository info once
  const repoInfo = getGitRemoteOrigin() || await promptForRepoInfo();

  // Get GitHub PAT once for all environments
  const pat = await promptForGitHubPAT();
  const githubClient = createGitHubClient(pat);

  // Process each environment with the same PAT
  for (const env of environments) {
    const spinner = ora(`Configuring ${env} environment...`).start();

    const credentials = context.config.deploymentCredentials?.[env];
    if (!credentials) {
      spinner.fail(`No credentials for ${env}`);
      continue; // Continue with remaining environments
    }

    await setEnvironmentCredentials(
      githubClient,
      repoInfo.owner,
      repoInfo.repo,
      GITHUB_ENV_NAMES[env],
      credentials.accessKeyId,
      credentials.secretAccessKey
    );

    spinner.succeed(`Configured ${GITHUB_ENV_NAMES[env]}`);
  }

  // Summary
  console.log(pc.green(`\n✓ All ${environments.length} environments configured!`));
}
```

**Source:** Pattern derived from [CLI Guidelines - Batch Operations](https://clig.dev/) which states "Multiple arguments are fine for simple actions against multiple files" and extends naturally to environments.

### Pattern 2: Continuation Prompt After Setup

**What:** Offer to continue to the next logical step after a setup command completes

**When to use:** When there's a clear next step in a multi-stage workflow

**Example:**
```typescript
// In setup-aws-envs.ts - END of runSetupAwsEnvs()
console.log(pc.green('AWS environment setup complete!'));
console.log('');
// ... summary table ...
console.log('');

// NEW: Offer to continue
const response = await prompts(
  {
    type: 'confirm',
    name: 'continueToGitHub',
    message: 'Continue to GitHub Environment setup?',
    initial: true,
  },
  {
    onCancel: () => {
      console.log('\nNext: Push credentials to GitHub:');
      console.log(`  ${pc.cyan('npx create-aws-project initialize-github --all')}`);
      return;
    }
  }
);

if (response.continueToGitHub) {
  console.log('');
  // Directly invoke initialize-github with --all flag
  await runInitializeGitHub(['--all']);
} else {
  console.log('');
  console.log('Next: Push credentials to GitHub:');
  console.log(`  ${pc.cyan('npx create-aws-project initialize-github --all')}`);
}
```

**Source:** [CLI Guidelines - Suggesting Next Commands](https://clig.dev/) recommends "suggest what command to run next" and acknowledges typical conversational workflows where "running one command to set up a tool and then learning what commands to run to actually start using it" is common.

### Pattern 3: Graceful Error Handling in Batch Operations

**What:** When one environment fails in batch mode, continue with remaining environments and report all results at the end

**When to use:** In batch operations where individual failures shouldn't abort the entire operation

**Example:**
```typescript
// In initialize-github.ts - batch mode with error collection
const results: Array<{env: string, success: boolean, error?: string}> = [];

for (const env of environments) {
  try {
    // ... configure environment ...
    results.push({ env, success: true });
  } catch (error) {
    results.push({
      env,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    // Continue with next environment
  }
}

// Summary report
const successful = results.filter(r => r.success);
const failed = results.filter(r => !r.success);

if (successful.length > 0) {
  console.log(pc.green(`\n✓ Successfully configured ${successful.length} environment(s):`));
  successful.forEach(r => console.log(`  ${r.env}`));
}

if (failed.length > 0) {
  console.log(pc.red(`\n✗ Failed to configure ${failed.length} environment(s):`));
  failed.forEach(r => console.log(`  ${r.env}: ${r.error}`));
  console.log('\nYou can retry failed environments individually.');
}
```

### Anti-Patterns to Avoid

- **Don't store GitHub PAT to filesystem**: Even temporarily. Per clig.dev, "Do not read secrets from environment variables" and "Do not read secrets directly from flags" because they leak. Memory-only credential reuse within a single command execution is acceptable.

- **Don't auto-continue without prompting**: Always ask for confirmation before chaining commands. Users may want to review AWS setup results before proceeding to GitHub.

- **Don't abort entire batch on first failure**: If dev environment fails, still attempt stage and prod. Report all results at the end.

- **Don't require flags for common case**: `--all` should be available, but `initialize-github dev stage prod` (positional arguments) is more intuitive for users.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Credential caching | Custom file-based credential store | In-memory credential reuse within single command execution | Security: File/env var storage of secrets is dangerous per clig.dev. Memory-only is safer and sufficient for batch operations. |
| Batch operation UX | Sequential command invocations | Multiple positional arguments or --all flag | Standard CLI pattern: `rm file1 file2 file3` not `rm file1 && rm file2 && rm file3` |
| GitHub client reuse | Create new Octokit instance per environment | Create once, reuse for all environments in batch | Efficiency: One authentication check, one client instance |

**Key insight:** The GitHub API client (`@octokit/rest`) is designed to be reusable across multiple operations. Creating it once with the PAT and reusing it for all three environments is both more efficient and provides better UX.

## Common Pitfalls

### Pitfall 1: Breaking Single-Environment Use Case

**What goes wrong:** When adding batch mode, developers might break the existing single-environment invocation pattern that some users rely on.

**Why it happens:** Refactoring for batch mode may introduce regressions in argument parsing or environment selection logic.

**How to avoid:**
- Maintain backward compatibility: `initialize-github dev` must still work exactly as before
- Add new functionality as opt-in: `--all` flag or multiple positional arguments
- Test both single and batch modes explicitly

**Warning signs:**
- Existing test cases fail after batch mode implementation
- Single-environment invocation shows unexpected prompts or behavior

### Pitfall 2: Leaking GitHub PAT

**What goes wrong:** PAT gets logged to console, written to files, or stored in environment variables.

**Why it happens:** Debugging code accidentally logs sensitive data, or developers try to "helpfully" cache credentials.

**How to avoid:**
- Never log the PAT value (log only "PAT provided" or similar)
- Never write PAT to disk, even temporarily
- Keep PAT in memory only, scoped to the command execution
- Use `type: 'password'` in prompts to hide input

**Warning signs:**
- PAT appears in console output
- PAT found in error messages
- Files created containing PAT

### Pitfall 3: Poor Error Recovery in Batch Mode

**What goes wrong:** First environment fails (e.g., bad credentials), entire batch aborts, user must start over.

**Why it happens:** Using `throw` instead of collecting errors and continuing.

**How to avoid:**
- Wrap each environment's configuration in try-catch
- Collect results (success/failure) for all environments
- Display comprehensive summary at the end
- Allow users to retry only failed environments

**Warning signs:**
- Second environment never attempted when first fails
- No summary of what succeeded vs failed
- User must re-enter PAT to retry

### Pitfall 4: Awkward Command Chaining

**What goes wrong:** Trying to auto-invoke `initialize-github` from `setup-aws-envs` without proper separation of concerns.

**Why it happens:** Temptation to "just call the function" rather than properly structuring commands.

**How to avoid:**
- Keep commands as separate entry points
- Use prompts to offer continuation, not automatic chaining
- Extract shared logic to importable functions if needed
- Respect command boundaries for testability

**Warning signs:**
- Circular imports between command modules
- Difficulty testing commands in isolation
- Error handling becomes complex across command boundaries

## Code Examples

Verified patterns from official sources:

### Batch Arguments Pattern
```typescript
// Source: Standard CLI pattern from clig.dev
// Example: rm file1.txt file2.txt file3.txt

// In initialize-github.ts
function determineBatchEnvironments(
  args: string[],
  config: ProjectConfig
): Environment[] {
  // --all flag: configure all environments with credentials
  if (args.includes('--all')) {
    return VALID_ENVIRONMENTS.filter(
      env => config.deploymentCredentials?.[env]
    );
  }

  // Multiple positional arguments: dev stage prod
  const environments = args.filter(arg => !arg.startsWith('--'));

  if (environments.length === 0) {
    throw new Error('No environments specified. Use --all or list environments: dev stage prod');
  }

  // Validate all are valid environments
  for (const env of environments) {
    if (!isValidEnvironment(env)) {
      throw new Error(`Invalid environment: ${env}. Valid: ${VALID_ENVIRONMENTS.join(', ')}`);
    }
    if (!config.deploymentCredentials?.[env]) {
      throw new Error(`No credentials for ${env}. Run setup-aws-envs first.`);
    }
  }

  return environments as Environment[];
}
```

### Continuation Prompt Pattern
```typescript
// Source: prompts library + clig.dev guidance
// Pattern: Offer next step with sensible default

import prompts from 'prompts';

async function offerContinuation(): Promise<boolean> {
  const response = await prompts(
    {
      type: 'confirm',
      name: 'continue',
      message: 'Continue to GitHub Environment setup?',
      initial: true, // Default to yes
    },
    {
      onCancel: () => {
        // User pressed Ctrl+C or cancelled
        return false;
      }
    }
  );

  return response.continue ?? false;
}
```

### Credential Reuse Pattern
```typescript
// Source: Security best practice - memory-only credentials
// Pattern: Prompt once, use multiple times in same execution

async function configureAllEnvironments(
  environments: Environment[],
  config: ProjectConfig
): Promise<void> {
  // Prompt for GitHub PAT ONCE
  const pat = await promptForGitHubPAT();

  // Create GitHub client ONCE with the PAT
  const githubClient = createGitHubClient(pat);

  // Reuse the authenticated client for all environments
  for (const env of environments) {
    await configureSingleEnvironment(githubClient, env, config);
  }

  // PAT never leaves memory, client is garbage collected after function returns
}
```

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| `setup-github` handled all environments at once with profile-based AWS access | `initialize-github` must be run 3x (once per environment) with config-based AWS access | Architecture improved (separation of concerns) but UX regressed (3x credential prompts) |
| Deprecated `setup-github` used for-loop over environments | `initialize-github` single-environment only | Better error isolation but worse user experience |
| Single GitHub PAT prompt for all environments | Three identical GitHub PAT prompts | More secure (no PAT caching) but annoying and error-prone |

**Current state (v1.6):**
- Architecture is correct: `setup-aws-envs` creates credentials, `initialize-github` reads from config
- UX is poor: Users must run initialize-github 3x with identical PAT input each time
- No auto-continuation: `setup-aws-envs` prints next step but doesn't offer to continue

**Recommendation:**
- Keep architecture separation: Don't merge commands
- Add batch mode to `initialize-github`: Reuse PAT in memory across environments
- Add continuation prompt to `setup-aws-envs`: Offer to launch `initialize-github --all`

**Deprecated/outdated:**
- `setup-github` command (shows deprecation notice, still in codebase but not used)

## Open Questions

Things that couldn't be fully resolved:

1. **Should `initialize-github --all` be the default when invoked without arguments?**
   - What we know: clig.dev recommends prompting for missing required arguments
   - What's unclear: Whether "all environments" or "which environment?" is the better default prompt
   - Recommendation: Keep current behavior (prompt for single environment) for backward compatibility. Require explicit `--all` flag or multiple arguments for batch mode.

2. **Should the continuation prompt in `setup-aws-envs` pass specific environment list to `initialize-github`?**
   - What we know: Only environments with credentials in config should be configured
   - What's unclear: Whether to automatically filter or let `initialize-github --all` handle it
   - Recommendation: Pass `--all` flag and let `initialize-github` filter based on available credentials. Simpler and more maintainable.

3. **Should failed environments in batch mode be retried automatically?**
   - What we know: Some failures are transient (network), others are permanent (bad credentials)
   - What's unclear: Whether automatic retry helps or hurts UX
   - Recommendation: No automatic retry. Display summary of successes/failures. User can manually retry failed environments.

4. **Should `setup-aws-envs` offer continuation if it detected existing accounts (idempotent re-run)?**
   - What we know: Idempotent re-run should be fast and safe
   - What's unclear: Whether continuation prompt makes sense when "nothing new" happened
   - Recommendation: Always offer continuation if credentials exist in config, regardless of whether accounts were just created or already existed. User may want to update GitHub secrets.

## Sources

### Primary (HIGH confidence)
- [Command Line Interface Guidelines](https://clig.dev/) - Authoritative CLI UX best practices (batch operations, credential handling, next-step suggestions)
- [prompts library documentation](https://www.npmjs.com/package/prompts) - Already in use, supports confirm prompts and cancellation handling
- Current codebase: `src/commands/setup-aws-envs.ts`, `src/commands/initialize-github.ts`, `src/commands/setup-github.ts` (deprecated but shows batch pattern)

### Secondary (MEDIUM confidence)
- [CLI UX best practices: 3 patterns for improving progress displays](https://evilmartians.com/chronicles/cli-ux-best-practices-3-patterns-for-improving-progress-displays) - Progress display patterns
- [UX patterns for CLI tools](https://www.lucasfcosta.com/blog/ux-patterns-cli-tools) - General CLI UX guidance
- [Top 8 CLI UX Patterns Users Will Brag About](https://medium.com/@kaushalsinh73/top-8-cli-ux-patterns-users-will-brag-about-4427adb548b7) - First-run wizard and continuation patterns

### Tertiary (LOW confidence)
- [Managing your personal access tokens - GitHub Docs](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens) - GitHub PAT best practices
- [How to cache your Personal Access Token (PAT) in Linux environment](https://medium.com/ci-cd-devops/how-to-cache-your-personal-access-token-pat-in-linux-environment-97791424eb83) - Credential caching patterns (informational only; we're avoiding filesystem caching per clig.dev security guidance)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - No new dependencies, using existing libraries
- Architecture: HIGH - Pattern validated by clig.dev and existing deprecated setup-github command
- Pitfalls: HIGH - Derived from security best practices (clig.dev) and common CLI error patterns

**Research date:** 2026-02-13
**Valid until:** 2026-03-15 (30 days - stable domain, CLI patterns change slowly)
