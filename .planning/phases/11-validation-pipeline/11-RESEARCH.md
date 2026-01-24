# Phase 11: Validation Pipeline - Research

**Researched:** 2026-01-24
**Domain:** Node.js subprocess execution, sequential pipeline validation, test harness patterns
**Confidence:** HIGH

## Summary

This phase builds a validation pipeline that tests generated projects through the full npm lifecycle (install → build → test). The research focused on execa timeout configuration, sequential command execution patterns, failure handling strategies, and validation result reporting.

The standard approach for validation pipelines in Node.js uses sequential execution with fail-fast behavior - each step must succeed before the next begins, and the first failure stops the pipeline immediately. This is achieved using execa's timeout option (with proper signal handling), try-catch blocks for error propagation, and structured result objects that capture exit codes and output.

The project already has the building blocks from Phase 10: `withTempDir()` for isolated environment management, `runCommand()` for subprocess execution with output capture, and execa 9.6.1 for timeout support. Phase 11 orchestrates these into a validation pipeline.

**Primary recommendation:** Build a sequential pipeline that runs npm install → npm run build → npm test with 10-minute timeouts per step, returning a structured ValidationResult interface with step-by-step success/failure tracking.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| execa | 9.6.1 | Subprocess execution with timeout | Industry standard for running commands in Node.js, provides timeout, signal handling, and clean error objects |
| Node.js fs/promises | Built-in | Temp directory management | Native async file operations, used by withTempDir() |
| Jest | 30.2.0 | Test framework | Project's existing test framework, supports per-test timeouts |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| TypeScript | 5.9.3 | Type safety for result interfaces | Already in project, ensures ValidationResult types are enforced |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| execa | child_process.spawn | execa provides better error handling, output capture, and timeout built-in. child_process requires manual implementation |
| Sequential execution | Promise.all() parallel | Parallel execution wastes CI minutes if early steps fail. Sequential provides deterministic logs and clear failure points |
| Fail-fast | Error accumulation (continue on failure) | Fail-fast saves time and matches CI best practices. Error accumulation useful for comprehensive reporting but not needed for validation |

**Installation:**
```bash
# Already installed from Phase 10
# execa v9.6.1 in devDependencies
```

## Architecture Patterns

### Recommended Function Structure
```typescript
src/__tests__/harness/
├── temp-dir.ts              # withTempDir() - Phase 10
├── run-command.ts            # runCommand() - Phase 10
└── validate-project.ts       # validateGeneratedProject() - Phase 11
```

### Pattern 1: Sequential Pipeline with Fail-Fast
**What:** Execute commands sequentially, stopping at first failure
**When to use:** Validation pipelines where later steps depend on earlier success
**Example:**
```typescript
// Fail-fast sequential execution
async function validateGeneratedProject(config: ProjectConfig): Promise<ValidationResult> {
  return await withTempDir('validate-', async (dir) => {
    // 1. Generate project
    await generateProject(config, dir);

    // 2. Run npm install (if this fails, stop here)
    const installResult = await runCommand('npm', ['install'], dir);
    if (!installResult.success) {
      return { success: false, failedStep: 'install', output: installResult.output };
    }

    // 3. Run npm run build (only if install succeeded)
    const buildResult = await runCommand('npm', ['run', 'build'], dir);
    if (!buildResult.success) {
      return { success: false, failedStep: 'build', output: buildResult.output };
    }

    // 4. Run npm test (only if build succeeded)
    const testResult = await runCommand('npm', ['test'], dir);
    if (!testResult.success) {
      return { success: false, failedStep: 'test', output: testResult.output };
    }

    return { success: true };
  });
}
```

**Why this pattern:** Sequential execution with fail-fast saves CI minutes (if build fails, test never runs), provides deterministic logs, and gives clear failure points. In a 3-minute pipeline, failing fast can save 40-70 seconds per fail.

**Sources:**
- [npm run all Command in 2026](https://thelinuxcode.com/npm-run-all-command-in-2026-practical-orchestration-with-npm-run-all/)
- [Jenkins Pipelines With Centralized Error Codes and Fail-Fast](https://dzone.com/articles/jenkins-pipelines-centralized-error-codes-fail-fast)

### Pattern 2: Timeout Configuration with execa
**What:** Configure per-command timeouts to prevent hanging processes
**When to use:** Long-running commands like npm install, build, test
**Example:**
```typescript
// From Phase 10's runCommand(), add timeout option
export async function runCommand(
  command: string,
  args: string[],
  cwd: string,
  timeout: number = 600000 // 10 minutes default
): Promise<CommandResult> {
  try {
    const result = await execa(command, args, {
      cwd,
      all: true,
      timeout,
      // forceKillAfterDelay defaults to 5000ms (SIGKILL after SIGTERM)
    });
    return {
      success: true,
      exitCode: result.exitCode ?? 0,
      output: result.all ?? '',
    };
  } catch (error) {
    const execaError = error as {
      exitCode?: number;
      all?: string;
      message?: string;
      timedOut?: boolean;
    };
    return {
      success: false,
      exitCode: execaError.exitCode ?? 1,
      output: execaError.all ?? execaError.message ?? '',
      timedOut: execaError.timedOut,
    };
  }
}
```

**Execa v9 timeout behavior:**
- When `timeout` is exceeded, execa sends SIGTERM to the subprocess
- After 5 seconds (default `forceKillAfterDelay`), if process still running, execa sends SIGKILL
- Error object has `timedOut: true` and includes captured output
- The `timeout` option was improved in v9 with better validation and race condition fixes

**Sources:**
- [Execa GitHub repository](https://github.com/sindresorhus/execa)
- [Execa forceKillAfterTimeout search results](https://www.npmjs.com/package/execa/v/3.0.0)
- [A Practical Guide to Execa for Node.js](https://betterstack.com/community/guides/scaling-nodejs/execa-cli/)

### Pattern 3: ValidationResult Interface (Result Pattern)
**What:** Structured result object that makes success/failure explicit
**When to use:** Functions that can fail in predictable ways with useful error context
**Example:**
```typescript
export interface ValidationStepResult {
  step: 'install' | 'build' | 'test';
  success: boolean;
  exitCode?: number;
  output?: string;
  timedOut?: boolean;
  duration?: number;
}

export interface ValidationResult {
  success: boolean;
  failedStep?: 'install' | 'build' | 'test';
  steps: ValidationStepResult[];
  totalDuration?: number;
}
```

**Why this pattern:** The Result pattern makes error handling explicit and type-safe. Instead of throwing exceptions, methods return a typed object that contains either success or detailed failure information. This forces callers to handle both success and failure cases, preventing unexpected runtime errors.

**Benefits:**
- Type safety: TypeScript enforces handling of both success and failure paths
- Explicit errors: No hidden exceptions, failures are part of method signatures
- Detailed context: Can include step name, exit code, output, timeout status
- Testing: Easier to test all code paths when errors are values, not thrown

**Sources:**
- [TypeScript Result Pattern: Better Errors](https://arg-software.medium.com/functional-error-handling-in-typescript-with-the-result-pattern-5b96a5abb6d3)
- [Creating a Result Type in TypeScript](https://www.dennisokeeffe.com/blog/2024-07-14-creating-a-result-type-in-typescript)
- [Using Results in TypeScript](https://imhoff.blog/posts/using-results-in-typescript)

### Pattern 4: Try-Finally Cleanup (from Phase 10)
**What:** Guaranteed cleanup even when validation fails
**When to use:** Already implemented in `withTempDir()`
**Example:**
```typescript
// Already provided by Phase 10
export async function withTempDir<T>(
  prefix: string,
  fn: (dir: string) => Promise<T>
): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), prefix));
  try {
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true }).catch((err) => {
      console.warn(`Failed to clean up temp directory ${dir}:`, err);
    });
  }
}
```

**Why this pattern:** Tests should ensure temp directories are always cleaned up, especially when operations fail, to prevent EEXIST errors in future test runs. Try-finally guarantees cleanup happens even when tests throw, and the catch-warn pattern prevents cleanup failures from masking test failures.

**Sources:**
- [Test properly clean up temp directory](https://github.com/nodejs/node/pull/2164)
- [Secure tempfiles in NodeJS without dependencies](https://advancedweb.hu/secure-tempfiles-in-nodejs-without-dependencies/)

### Anti-Patterns to Avoid
- **Parallel command execution (Promise.all):** Wastes CI minutes when early steps fail. npm test shouldn't run if npm install fails.
- **Silent failures:** Always capture and return exit codes and output. Silent failures hide root causes.
- **Infinite timeouts:** Commands without timeouts can hang forever. Always set reasonable timeout values.
- **Throw-based errors:** In validation context, throwing exceptions loses structured error information. Use Result pattern instead.
- **Manual cleanup:** Using manual cleanup logic instead of try-finally leads to resource leaks when tests fail.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Subprocess execution with timeout | Custom spawn + setTimeout | execa with timeout option | execa handles signal ordering (SIGTERM → SIGKILL), cross-platform differences, output capture, and edge cases |
| Temp directory cleanup | Custom fs.rm calls | withTempDir() from Phase 10 | Already handles try-finally, recursive deletion, warn-on-cleanup-failure pattern |
| Command output capture | Manual stdout/stderr buffering | execa with all: true | Correctly interleaves stdout/stderr (Phase 10 uses this), handles encoding, prevents buffer overflow |
| Timeout after grace period | Multiple setTimeout calls | execa's forceKillAfterDelay | Default 5-second grace period before SIGKILL, battle-tested |

**Key insight:** Subprocess management has many edge cases (signal handling, cleanup, cross-platform differences, buffer management). execa is the ecosystem standard because it handles these correctly. Phase 10 already provides the right abstractions.

## Common Pitfalls

### Pitfall 1: Insufficient Timeout Values
**What goes wrong:** npm install/build/test times out prematurely, causing false negatives
**Why it happens:** Developers underestimate time needed for first install (no cache), complex builds, or slow CI environments
**How to avoid:**
- Use 10 minutes (600000ms) as default per-step timeout
- CI environments often use 10 minutes as default (CircleCI standard)
- Monitor actual durations and adjust if needed
- First npm install (no cache) takes longer than subsequent runs
**Warning signs:**
- Intermittent test failures in CI but passes locally
- Tests fail with "timeout" but running manually succeeds
- Failures correlate with npm registry slowness

**Sources:**
- [npm install timeout discussion](https://github.com/npm/cli/issues/1151)
- [CircleCI npm install timeouts](https://discuss.circleci.com/t/npm-timeouts/23730)

### Pitfall 2: Not Using npm ci in Validation
**What goes wrong:** npm install gets latest versions, validation tests different code than what package-lock.json specifies
**Why it happens:** npm install respects semver ranges in package.json, npm ci uses exact versions from package-lock.json
**How to avoid:**
- Use `npm ci` instead of `npm install` for deterministic installs
- npm ci is faster (skips version resolution) and ensures exact dependency tree
- This is the standard for CI environments
**Warning signs:**
- Validation passes locally but generated projects fail for users
- "Works on my machine" syndrome
- Flaky test results

**Sources:**
- [npm install falls into timeout, what can you do?](https://dev.to/ferreira_mariana/npm-install-falls-into-timeout-what-can-you-do-42i7)

### Pitfall 3: Jest Test Timeout Mismatch
**What goes wrong:** Jest's 5-second default timeout kills validation tests before subprocess timeouts trigger
**Why it happens:** Jest default testTimeout (5000ms) is much lower than validation pipeline duration (potentially 30+ minutes total)
**How to avoid:**
- Set per-test timeout: `test('validates project', async () => { ... }, 35 * 60 * 1000)` (35 minutes)
- Or configure jest.config.ts: `testTimeout: 35 * 60 * 1000` (affects all tests)
- Per-test timeout is preferred (doesn't slow down other tests)
**Warning signs:**
- Test fails with "Exceeded timeout of 5000 ms for a test"
- Validation stops before subprocess timeout triggers

**Sources:**
- [Jest testTimeout configuration](https://jestjs.io/docs/configuration)
- [Jest exceeded timeout error](https://bobbyhadz.com/blog/jest-exceeded-timeout-of-5000-ms-for-test)

### Pitfall 4: Losing Output on Timeout
**What goes wrong:** When command times out, partial output is lost, making debugging hard
**Why it happens:** Not using execa's `all: true` option, or not preserving error.all on timeout
**How to avoid:**
- Phase 10's runCommand() already uses `all: true` correctly
- Ensure `timedOut` errors still return `error.all` in output
- execa captures output even when timeout kills the process
**Warning signs:**
- Timeout errors with empty output
- Can't determine what command was doing when it timed out

### Pitfall 5: Wrong Working Directory for Generated Project Commands
**What goes wrong:** Running npm commands in wrong directory causes "no package.json found" errors
**Why it happens:** Using process.cwd() instead of the generated project directory
**How to avoid:**
- Always pass `cwd` to runCommand() with the generated project directory path
- Phase 10's runCommand() already requires `cwd` parameter (good design)
**Warning signs:**
- Error: "Cannot find module 'package.json'"
- npm commands fail with "not a package"

## Code Examples

Verified patterns from official sources:

### Sequential Validation Pipeline
```typescript
// Source: Pattern synthesis from fail-fast and Result pattern research
export interface ValidationResult {
  success: boolean;
  failedStep?: 'install' | 'build' | 'test';
  steps: Array<{
    step: string;
    success: boolean;
    exitCode?: number;
    output?: string;
    timedOut?: boolean;
    duration?: number;
  }>;
}

export async function validateGeneratedProject(
  config: ProjectConfig,
  timeout: number = 600000 // 10 minutes per step
): Promise<ValidationResult> {
  const steps: ValidationResult['steps'] = [];

  return await withTempDir('validate-', async (dir) => {
    // 1. Generate project
    await generateProject(config, dir);

    // 2. Run npm ci (deterministic install)
    const installStart = Date.now();
    const installResult = await runCommand('npm', ['ci'], dir, timeout);
    steps.push({
      step: 'install',
      success: installResult.success,
      exitCode: installResult.exitCode,
      output: installResult.output,
      timedOut: installResult.timedOut,
      duration: Date.now() - installStart,
    });

    if (!installResult.success) {
      return { success: false, failedStep: 'install', steps };
    }

    // 3. Run npm run build
    const buildStart = Date.now();
    const buildResult = await runCommand('npm', ['run', 'build'], dir, timeout);
    steps.push({
      step: 'build',
      success: buildResult.success,
      exitCode: buildResult.exitCode,
      output: buildResult.output,
      timedOut: buildResult.timedOut,
      duration: Date.now() - buildStart,
    });

    if (!buildResult.success) {
      return { success: false, failedStep: 'build', steps };
    }

    // 4. Run npm test
    const testStart = Date.now();
    const testResult = await runCommand('npm', ['test'], dir, timeout);
    steps.push({
      step: 'test',
      success: testResult.success,
      exitCode: testResult.exitCode,
      output: testResult.output,
      timedOut: testResult.timedOut,
      duration: Date.now() - testStart,
    });

    if (!testResult.success) {
      return { success: false, failedStep: 'test', steps };
    }

    return { success: true, steps };
  });
}
```

### Updated runCommand with Timeout and TimedOut Tracking
```typescript
// Enhancement to Phase 10's runCommand.ts
export interface CommandResult {
  success: boolean;
  exitCode: number;
  output: string;
  timedOut?: boolean; // NEW: track timeout
}

export async function runCommand(
  command: string,
  args: string[],
  cwd: string,
  timeout: number = 600000 // NEW: default 10 minutes
): Promise<CommandResult> {
  try {
    const result = await execa(command, args, {
      cwd,
      all: true,
      timeout,
      // forceKillAfterDelay: 5000 (default, SIGKILL after 5s grace period)
    });
    return {
      success: true,
      exitCode: result.exitCode ?? 0,
      output: result.all ?? '',
      timedOut: false,
    };
  } catch (error) {
    const execaError = error as {
      exitCode?: number;
      all?: string;
      message?: string;
      timedOut?: boolean;
    };
    return {
      success: false,
      exitCode: execaError.exitCode ?? 1,
      output: execaError.all ?? execaError.message ?? '',
      timedOut: execaError.timedOut ?? false,
    };
  }
}
```

### Test with Extended Timeout
```typescript
// Source: Jest documentation on per-test timeout
describe('validateGeneratedProject', () => {
  test(
    'validates a generated project through full npm lifecycle',
    async () => {
      const config = createTestConfig();
      const result = await validateGeneratedProject(config);

      expect(result.success).toBe(true);
      expect(result.steps).toHaveLength(3);
      expect(result.steps[0].step).toBe('install');
      expect(result.steps[1].step).toBe('build');
      expect(result.steps[2].step).toBe('test');
    },
    35 * 60 * 1000 // 35 minutes: 10 min per step × 3 steps + 5 min buffer
  );
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| npm install | npm ci | Became standard ~2018 | Deterministic installs, faster in CI, ensures package-lock.json is source of truth |
| child_process.spawn | execa | execa released 2016, became standard ~2019 | Better error handling, cleaner API, built-in timeout/signal management |
| throw-based errors | Result pattern | Growing adoption 2020+ | Type-safe error handling, explicit success/failure paths |
| Parallel test steps | Sequential fail-fast | Always best practice | Saves CI minutes, clearer failure points |

**Deprecated/outdated:**
- **child_process without timeout:** Modern Node.js apps use libraries like execa that provide timeout built-in
- **npm install in CI:** Should use `npm ci` for deterministic, faster installs
- **forceKillAfterTimeout (execa < 9):** Renamed to `forceKillAfterDelay` in execa v9, though functionality unchanged

## Open Questions

Things that couldn't be fully resolved:

1. **Should validation run on all platform combinations?**
   - What we know: Config specifies platforms array ['web', 'mobile', 'api']
   - What's unclear: Should we validate each platform separately, or all-at-once?
   - Recommendation: Start with validating the full config (all selected platforms together). Later phases can add per-platform validation if needed.

2. **How to handle auth provider external dependencies in tests?**
   - What we know: Generated projects might configure Cognito or Auth0
   - What's unclear: Do validation tests need real AWS credentials? Mock services?
   - Recommendation: Tests should validate that project builds/tests pass without requiring real auth services. Generated projects should have mocked auth in their test suites.

3. **Should validation test files be committed alongside regular tests?**
   - What we know: Validation tests will be in `src/__tests__/harness/`
   - What's unclear: Should they be excluded from normal test runs to save time?
   - Recommendation: Include in normal test runs but use Jest's test.skip() or describe.skip() for slow validation tests unless running in CI or explicitly enabled.

## Sources

### Primary (HIGH confidence)
- [execa GitHub repository](https://github.com/sindresorhus/execa) - Timeout configuration, error handling
- [Jest testTimeout configuration](https://jestjs.io/docs/configuration) - Per-test timeout
- [Node.js fs/promises](https://nodejs.org/api/fs.html) - Native temp dir management
- Project's existing Phase 10 code - withTempDir(), runCommand(), CommandResult

### Secondary (MEDIUM confidence)
- [npm run all Command in 2026](https://thelinuxcode.com/npm-run-all-command-in-2026-practical-orchestration-with-npm-run-all/) - Sequential fail-fast patterns
- [TypeScript Result Pattern](https://arg-software.medium.com/functional-error-handling-in-typescript-with-the-result-pattern-5b96a5abb6d3) - Result interface design
- [Jenkins Pipelines With Centralized Error Codes and Fail-Fast](https://dzone.com/articles/jenkins-pipelines-centralized-error-codes-fail-fast) - Pipeline patterns
- [A Practical Guide to Execa for Node.js](https://betterstack.com/community/guides/scaling-nodejs/execa-cli/) - Execa usage examples
- [Testpack validation tool](https://github.com/qwertie/testpack) - Package validation patterns
- [npm ci best practices](https://dev.to/ferreira_mariana/npm-install-falls-into-timeout-what-can-you-do-42i7) - Deterministic installs

### Tertiary (LOW confidence)
- Various Stack Overflow and blog posts on timeout values - No authoritative source found for "ideal" timeout values, 10 minutes appears as common default

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - execa 9.6.1 already in project, timeout features well-documented
- Architecture: HIGH - Sequential fail-fast is well-established pattern, Phase 10 provides building blocks
- Pitfalls: HIGH - Timeout and npm ci pitfalls well-documented in official sources and community

**Research date:** 2026-01-24
**Valid until:** 2026-02-24 (30 days - stable domain, execa is mature, npm lifecycle unlikely to change)
