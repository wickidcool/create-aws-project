# Phase 13: Reporting and Local Runner - Research

**Researched:** 2026-01-24
**Domain:** CLI test reporting, progress indicators, npm script runners, terminal output formatting
**Confidence:** HIGH

## Summary

This phase creates a local test runner with real-time progress reporting and comprehensive summary output. The research focused on CLI progress patterns, test result formatting, terminal output libraries, and npm script integration patterns for E2E validation.

The standard approach for CLI test runners combines three elements: (1) real-time progress indicators using spinners that update per-test (e.g., "Testing 3/14: mobile-cognito"), (2) immediate error output when tests fail (stdout/stderr capture displayed inline), and (3) end-of-run summary tables showing all results at a glance (typically using console.table()).

The project already has the necessary dependencies: ora 9.1.0 for elegant terminal spinners, picocolors 1.1.1 for color formatting, and execa 9.6.1 (via Phase 10-11) for capturing command output. The validation infrastructure from Phase 11 provides structured ValidationResult objects with step-by-step success/failure data. Phase 13 wraps this into a local runner with developer-friendly reporting.

**Primary recommendation:** Build a local runner script that iterates through test configurations with ora spinners showing "Testing X/N: config-name", displays captured stdout/stderr immediately on failure, and prints a console.table() summary of all results at completion.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| ora | 9.1.0 | Terminal spinner/progress | Industry standard for CLI progress (PostCSS, Yeoman, create-react-app), elegant succeed/fail API, already in project |
| picocolors | 1.1.1 | ANSI color formatting | Fastest, smallest color library (7kB vs chalk's 101kB), used by PostCSS/Vite/Stylelint, already in project |
| console.table | Built-in | Summary table rendering | Native Node.js API, zero deps, produces properly formatted tables with columns |
| execa | 9.6.1 | Output capture | Already used in validation (Phase 10-11), provides all:true for interleaved stdout/stderr |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Node.js process.stdout | Built-in | Terminal width detection | For formatting tables to terminal width |
| Node.js process.exit | Built-in | Exit code signaling | Return non-zero on test failures for CI integration |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| ora | cli-progress | cli-progress provides progress bars, but ora's spinner pattern better fits unknown-duration tasks. ora is already in project |
| picocolors | chalk | chalk is more popular but 14x larger and slower. picocolors is already in project and sufficient |
| console.table | cli-table3 | cli-table3 offers more formatting but adds dependency. console.table is built-in and handles basic summaries well |
| Custom reporter | jest reporters | Jest reporters are for jest tests. This is for E2E validation of generated projects (different domain) |

**Installation:**
```bash
# All dependencies already installed
# ora v9.1.0 - dependencies
# picocolors v1.1.1 - dependencies
# execa v9.6.1 - devDependencies
```

## Architecture Patterns

### Recommended Project Structure
```
src/__tests__/harness/
├── fixtures/
│   ├── index.ts              # Export test matrix (Phase 12)
│   ├── matrix.ts             # TEST_MATRIX, getConfigsByTier() (Phase 12)
│   └── config-factories.ts   # Config creation (Phase 12)
├── temp-dir.ts               # withTempDir() (Phase 10)
├── run-command.ts            # runCommand() with timeout (Phase 10-11)
├── validate-project.ts       # validateGeneratedProject() (Phase 11)
└── local-runner.ts           # NEW: runValidationSuite() (Phase 13)

package.json
  scripts:
    test:e2e → node --import tsx/esm src/__tests__/harness/local-runner.ts
```

### Pattern 1: Spinner-Based Progress Reporting
**What:** Update spinner text to show current test configuration being validated
**When to use:** Long-running E2E tests where user needs feedback about what's happening
**Example:**
```typescript
// Using ora for per-config progress
import ora from 'ora';
import { getConfigsByTier } from './fixtures/index.js';

async function runValidationSuite(tier: 'smoke' | 'core' | 'full' = 'core') {
  const configs = getConfigsByTier(tier);
  const spinner = ora();

  for (let i = 0; i < configs.length; i++) {
    const config = configs[i];
    const progress = `Testing ${i + 1}/${configs.length}: ${config.name}`;

    spinner.start(progress);

    const result = await validateGeneratedProject(config.config);

    if (result.success) {
      spinner.succeed(`${progress} ✓`);
    } else {
      spinner.fail(`${progress} ✗ (failed at ${result.failedStep})`);
      // Display error output immediately
      console.error(result.steps.find(s => !s.success)?.output);
    }
  }
}
```

**Why this pattern:** Ora provides visual feedback without cluttering output, spinner.succeed/fail creates clear visual distinction, and updating spinner.text shows which config is running. Used by create-react-app, Yeoman, and other popular CLI tools.

**Sources:**
- [ora - npm](https://www.npmjs.com/package/ora)
- [GitHub - sindresorhus/ora](https://github.com/sindresorhus/ora)

### Pattern 2: Console Table Summary
**What:** Use console.table() to display all test results in a formatted table at completion
**When to use:** End-of-run summaries where user needs to see all results at a glance
**Example:**
```typescript
// Summary table after all tests complete
interface SummaryRow {
  config: string;
  status: string;
  failedStep?: string;
  duration: string;
}

function displaySummary(results: ValidationResult[], configs: TestConfiguration[]) {
  const rows = results.map((result, i) => ({
    config: configs[i].name,
    status: result.success ? '✓ PASS' : '✗ FAIL',
    failedStep: result.failedStep ?? '-',
    duration: `${(result.totalDuration / 1000).toFixed(1)}s`,
  }));

  console.log('\n=== Validation Summary ===\n');
  console.table(rows);

  const passed = results.filter(r => r.success).length;
  const total = results.length;
  console.log(`\nResults: ${passed}/${total} passed`);
}
```

**Why this pattern:** console.table() is built-in, zero-config, and produces properly formatted tables. Rows are sorted by test order. The (index) column shows test sequence. Used by Node.js test runner, performance testing tools, and debugging utilities.

**Sources:**
- [Console | Node.js v25.3.0 Documentation](https://nodejs.org/api/console.html)
- [Node.js console.table() Method - GeeksforGeeks](https://www.geeksforgeeks.org/node-js/node-js-console-table-method/)

### Pattern 3: Fail-Fast vs. Accumulate-All
**What:** Choice between stopping at first failure (fail-fast) vs. running all tests and reporting all failures
**When to use:** Fail-fast for development feedback loops, accumulate-all for comprehensive reporting
**Example:**
```typescript
// Accumulate-all pattern (recommended for local runner)
async function runValidationSuite(tier: TestTier = 'core') {
  const configs = getConfigsByTier(tier);
  const results: ValidationResult[] = [];

  for (let i = 0; i < configs.length; i++) {
    const config = configs[i];
    // Continue even if this config fails
    const result = await validateGeneratedProject(config.config);
    results.push(result);
  }

  // Display summary even if some failed
  displaySummary(results, configs);

  // Exit with non-zero if any failed
  const allPassed = results.every(r => r.success);
  process.exit(allPassed ? 0 : 1);
}
```

**Why this pattern:** Accumulate-all gives developers full picture of what's broken. Fail-fast is better for CI (saves time), but local runners should show all failures so developers can fix multiple issues at once. Exit code enables CI integration.

**Sources:**
- [Ensuring Your E2E Tests Run On Every Code Push](https://www.anders.co/blog/e2e-series-ensure-tests-run-on-every-push/)
- [Testing in 2026: Jest, React Testing Library, and Full Stack Testing Strategies](https://www.nucamp.co/blog/testing-in-2026-jest-react-testing-library-and-full-stack-testing-strategies)

### Pattern 4: Interleaved Stdout/Stderr Display
**What:** Display captured stdout/stderr for failed tests immediately after failure
**When to use:** Debugging failures - developers need to see error messages to fix issues
**Example:**
```typescript
// From Phase 11's runCommand - already captures interleaved output
const result = await runCommand('npm', ['test'], dir, timeout);
// result.output contains stdout+stderr in order via execa's all:true

// In local runner - display on failure
if (!result.success) {
  spinner.fail(`${progress} ✗ (failed at ${result.failedStep})`);

  const failedStepResult = result.steps.find(s => !s.success);
  if (failedStepResult) {
    console.error(pc.red('\n--- Error Output ---'));
    console.error(failedStepResult.output);
    console.error(pc.red('--- End Error Output ---\n'));
  }
}
```

**Why this pattern:** execa's all:true option (already used in Phase 11) merges stdout/stderr in chronological order, preserving log context. Displaying immediately after failure gives developer context while test is still in memory. Color coding with picocolors makes error sections easy to scan.

**Sources:**
- Existing implementation in src/__tests__/harness/run-command.ts (uses execa all:true)
- [Jest CLI Options](https://jestjs.io/docs/cli) - shows stderr/stdout separation patterns

### Pattern 5: npm Script Integration
**What:** Create npm script that runs local runner with Node.js loader for TypeScript
**When to use:** Making E2E tests discoverable and easy to run for all developers
**Example:**
```json
// package.json
{
  "scripts": {
    "test": "node --experimental-vm-modules node_modules/jest/bin/jest.js",
    "test:e2e": "node --import tsx/esm src/__tests__/harness/local-runner.ts",
    "test:e2e:smoke": "node --import tsx/esm src/__tests__/harness/local-runner.ts smoke",
    "test:e2e:full": "node --import tsx/esm src/__tests__/harness/local-runner.ts full"
  }
}
```

**Why this pattern:** npm scripts are the standard developer interface (discoverable via npm run, autocomplete in most IDEs). --import tsx/esm enables TypeScript execution without pre-compilation. Tier arguments (smoke/core/full) provide flexibility. Developers run `npm run test:e2e` without needing to know implementation details.

**Sources:**
- [How to set up a local E2E test development environment](https://www.anders.co/blog/e2e-series-setting-up-your-local-environment/)
- [End to end testing](https://www.threatdragon.com/docs/testing/e2e.html)

### Anti-Patterns to Avoid

- **Spinner during silent operations:** Don't show spinners for operations that complete instantly (< 100ms). Causes flicker. Use spinners only for operations expected to take >1 second.

- **Spinner without text updates:** Don't start a spinner with generic text and never update it. Developers don't know if it's hung. Update spinner.text to show what's happening.

- **Hiding error output until end:** Don't collect all error output and display at end. Display immediately after each failure so developer can start investigating while remaining tests run.

- **Color-only status:** Don't rely solely on color for pass/fail (accessibility). Use symbols (✓/✗) with color as enhancement.

- **Verbose success output:** Don't display full stdout for successful tests. Clutters output. Only show success indicator. Display stdout only on failure.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Terminal spinners | Custom animation loop with setInterval | ora | Handles terminal cursor positioning, cleanup on exit, color support, Unicode spinner chars across terminals |
| Colored output | ANSI escape codes manually | picocolors | Already in project, handles NO_COLOR env var, cross-platform compatibility, minimal overhead |
| Table formatting | String padding with spaces/dashes | console.table() | Built-in, handles column width auto-sizing, Unicode box drawing, index column automatically |
| Output capture | Manually piping stdout/stderr | execa with all:true | Already in project (Phase 10-11), preserves chronological order, handles encoding/buffering |
| Test result aggregation | Arrays with manual counting | Array.filter/every/reduce | Native array methods, readable intent, no off-by-one errors |

**Key insight:** CLI reporting has many edge cases (terminal width, Unicode support, color terminal detection, cursor positioning, cleanup on SIGINT). Using battle-tested libraries avoids bugs that only appear on certain terminals/OSes.

## Common Pitfalls

### Pitfall 1: Spinner Doesn't Clean Up on Error
**What goes wrong:** Spinner keeps animating after script crashes, leaving terminal in broken state
**Why it happens:** Uncaught exceptions bypass spinner.stop(), cursor remains hidden
**How to avoid:** Wrap main logic in try-catch with spinner.stop() in finally
**Warning signs:** Terminal cursor disappears after script error, need to run `reset` command

```typescript
// Correct pattern
async function runValidationSuite() {
  const spinner = ora();
  try {
    spinner.start('Running tests...');
    await runAllTests();
    spinner.succeed('All tests passed!');
  } catch (error) {
    spinner.fail('Tests failed!');
    throw error;
  } finally {
    spinner.stop(); // Always cleanup, even on exception
  }
}
```

**Sources:**
- [ora - npm](https://www.npmjs.com/package/ora) - Documents cleanup patterns
- Common issue in CLI tools using spinners

### Pitfall 2: Console.table() Truncates Wide Columns
**What goes wrong:** console.table() truncates text that exceeds terminal width, losing important error details
**Why it happens:** Node.js console.table() respects process.stdout.columns, cuts off wide cells
**How to avoid:** Keep table columns narrow (config name, status, step, duration), display full error output separately
**Warning signs:** Error messages in table cells end with "..."

```typescript
// Don't put full error messages in table
// BAD
console.table([
  { config: 'web-cognito', error: 'Very long error message that will be truncated...' }
]);

// GOOD - Keep table concise, display errors separately
console.table([
  { config: 'web-cognito', status: '✗ FAIL', failedStep: 'build' }
]);
// Then display full error output:
console.error(fullErrorOutput);
```

**Sources:**
- [Console | Node.js v25.3.0 Documentation](https://nodejs.org/api/console.html)
- Terminal rendering behavior

### Pitfall 3: Mixed Progress Output in CI
**What goes wrong:** Spinner animations produce excessive output in CI, logs become unreadable
**Why it happens:** Spinners animate by repeatedly updating same line (ANSI cursor control), CI captures every frame
**How to avoid:** Detect CI environment and disable spinners, use simple text logging instead
**Warning signs:** CI logs show hundreds of lines of spinner frames, or ANSI escape codes visible as text

```typescript
// Detect CI and adjust output
import ora from 'ora';

const isCI = process.env.CI === 'true' || !process.stdout.isTTY;

function createSpinner(text: string) {
  if (isCI) {
    // In CI, just log text without spinner
    console.log(text);
    return {
      succeed: (msg: string) => console.log(`✓ ${msg}`),
      fail: (msg: string) => console.error(`✗ ${msg}`),
      stop: () => {},
    };
  }
  return ora(text);
}
```

**Sources:**
- [ora - npm](https://www.npmjs.com/package/ora) - Documents isEnabled property
- [Ensuring Your E2E Tests Run On Every Code Push](https://www.anders.co/blog/e2e-series-ensure-tests-run-on-every-push/)

### Pitfall 4: Exit Code 0 Despite Failures
**What goes wrong:** Script reports failures but exits with code 0, CI marks build as passing
**Why it happens:** JavaScript doesn't automatically exit with error code when tests fail, must explicitly call process.exit(1)
**How to avoid:** Track overall success state, call process.exit(1) if any tests failed
**Warning signs:** CI shows red output but marks build as green/passing

```typescript
// Always set exit code based on results
async function runValidationSuite() {
  const results = await runAllTests();
  const allPassed = results.every(r => r.success);

  displaySummary(results);

  // CRITICAL: Exit with non-zero if any failed
  process.exit(allPassed ? 0 : 1);
}
```

**Sources:**
- Standard CI/CD practice
- [Ensuring Your E2E Tests Run On Every Code Push](https://www.anders.co/blog/e2e-series-ensure-tests-run-on-every-push/)

### Pitfall 5: Progress Counter Off-By-One
**What goes wrong:** Progress shows "Testing 0/14" or "Testing 15/14" due to loop index errors
**Why it happens:** Forgetting that array indices start at 0, but human-readable counts start at 1
**How to avoid:** Use i+1 for display, i for array access
**Warning signs:** Progress starts at 0, or exceeds total count

```typescript
// Correct: i is 0-indexed, display as i+1
for (let i = 0; i < configs.length; i++) {
  const progress = `Testing ${i + 1}/${configs.length}: ${configs[i].name}`;
  //                         ^^^^^ Human-readable 1-indexed
  //                                                ^^^^^ Array 0-indexed
}
```

**Sources:**
- Common JavaScript/TypeScript gotcha
- Zero-indexing in programming languages

## Code Examples

Verified patterns from official sources:

### Local Runner Main Function
```typescript
// src/__tests__/harness/local-runner.ts
import ora from 'ora';
import pc from 'picocolors';
import { getConfigsByTier, type TestTier } from './fixtures/index.js';
import { validateGeneratedProject } from './validate-project.js';
import type { ValidationResult } from './validate-project.js';

async function runValidationSuite(tier: TestTier = 'core') {
  const configs = getConfigsByTier(tier);
  const results: ValidationResult[] = [];
  const spinner = ora();

  console.log(pc.bold(`\nRunning ${configs.length} validation tests (tier: ${tier})\n`));

  for (let i = 0; i < configs.length; i++) {
    const config = configs[i];
    const progress = `Testing ${i + 1}/${configs.length}: ${config.name}`;

    spinner.start(progress);

    try {
      const result = await validateGeneratedProject(config.config);
      results.push(result);

      if (result.success) {
        spinner.succeed(pc.green(progress));
      } else {
        spinner.fail(pc.red(`${progress} (failed at ${result.failedStep})`));

        // Display error output immediately
        const failedStep = result.steps.find(s => !s.success);
        if (failedStep) {
          console.error(pc.red('\n--- Error Output ---'));
          console.error(failedStep.output);
          console.error(pc.red('--- End Error Output ---\n'));
        }
      }
    } catch (error) {
      spinner.fail(pc.red(`${progress} (exception)`));
      console.error(error);
      results.push({
        success: false,
        steps: [],
        totalDuration: 0,
      });
    }
  }

  // Display summary table
  displaySummary(results, configs);

  // Exit with appropriate code
  const allPassed = results.every(r => r.success);
  process.exit(allPassed ? 0 : 1);
}

function displaySummary(results: ValidationResult[], configs: any[]) {
  const rows = results.map((result, i) => ({
    config: configs[i].name,
    status: result.success ? pc.green('✓ PASS') : pc.red('✗ FAIL'),
    failedStep: result.failedStep ?? '-',
    duration: `${(result.totalDuration / 1000).toFixed(1)}s`,
  }));

  console.log(pc.bold('\n=== Validation Summary ===\n'));
  console.table(rows);

  const passed = results.filter(r => r.success).length;
  const total = results.length;
  const passRate = ((passed / total) * 100).toFixed(1);

  console.log(pc.bold(`\nResults: ${passed}/${total} passed (${passRate}%)`));
}

// CLI argument parsing
const tier = (process.argv[2] as TestTier) ?? 'core';
runValidationSuite(tier);
```

**Source:** Synthesized from ora and console.table() APIs, following patterns from Phase 10-11 validation infrastructure

### npm Scripts Configuration
```json
// package.json
{
  "scripts": {
    "test": "node --experimental-vm-modules node_modules/jest/bin/jest.js",
    "test:e2e": "node --import tsx/esm src/__tests__/harness/local-runner.ts",
    "test:e2e:smoke": "node --import tsx/esm src/__tests__/harness/local-runner.ts smoke",
    "test:e2e:full": "node --import tsx/esm src/__tests__/harness/local-runner.ts full"
  }
}
```

**Source:** Standard npm scripts pattern for E2E tests

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Custom spinner with setInterval | ora library | ~2015 | Eliminates cursor positioning bugs, handles cleanup automatically |
| chalk for colors | picocolors | 2021 | 14x smaller bundle (7kB vs 101kB), 2-10x faster, same API |
| Manual table formatting | console.table() | Node.js v10 (2018) | Built-in, zero config, auto-sizing columns |
| Separate stdout/stderr capture | execa all:true | execa v5 (2020) | Preserves chronological order of output |
| --require for TypeScript | --import tsx/esm | Node.js v20 (2023) | ESM-native, no experimental flags needed |

**Deprecated/outdated:**
- **node-spinner:** Unmaintained, use ora instead (last update 2014)
- **chalk:** Still works but picocolors is faster/smaller (consider for new projects)
- **--experimental-loader:** Deprecated in Node.js 20, use --import instead
- **cli-table/cli-table2:** Superseded by console.table() for simple use cases (cli-table3 for complex formatting)

## Open Questions

Things that couldn't be fully resolved:

1. **Should we add JSON output mode for CI parsing?**
   - What we know: CI systems can parse JSON for dashboards, some test runners provide --json flag
   - What's unclear: Whether CI integration needs machine-readable output, or human-readable is sufficient
   - Recommendation: Start with human-readable output (console.table), add --json flag later if CI integration requires it

2. **Should we parallelize config testing?**
   - What we know: Phase 11 validates sequentially (fail-fast), could run N configs in parallel with worker threads
   - What's unclear: Whether parallel execution saves enough time to justify complexity, or if temp dir conflicts would occur
   - Recommendation: Start sequential (simpler, matches CI), measure runtime, add parallelization if >10 minute runtime becomes issue

3. **Should we stream test output in real-time vs. buffered?**
   - What we know: execa captures all output, we display after test completes
   - What's unclear: Whether developers want to see npm install/build/test output streaming live, or buffered summary is better
   - Recommendation: Start buffered (cleaner output, spinner stays visible), add --verbose flag for streaming if requested

4. **Should we support watch mode for iterative development?**
   - What we know: Jest has --watch mode that reruns tests on file changes, useful for TDD workflows
   - What's unclear: Whether watch mode makes sense for slow E2E tests (each run takes minutes), or if one-shot is sufficient
   - Recommendation: Defer watch mode, focus on single-run reporter first, reassess based on developer feedback

## Sources

### Primary (HIGH confidence)
- [ora - npm](https://www.npmjs.com/package/ora) - Spinner API, succeed/fail patterns
- [GitHub - sindresorhus/ora](https://github.com/sindresorhus/ora) - Official documentation, TypeScript types
- [picocolors - npm](https://www.npmjs.com/package/picocolors) - Color formatting API
- [GitHub - alexeyraspopov/picocolors](https://github.com/alexeyraspopov/picocolors) - Official documentation
- [Console | Node.js v25.3.0 Documentation](https://nodejs.org/api/console.html) - console.table() API reference
- Existing project code - src/__tests__/harness/run-command.ts (execa usage), package.json (dependencies)

### Secondary (MEDIUM confidence)
- [How to set up a local E2E test development environment](https://www.anders.co/blog/e2e-series-setting-up-your-local-environment/) - npm script patterns for E2E tests
- [Ensuring Your E2E Tests Run On Every Code Push](https://www.anders.co/blog/e2e-series-ensure-tests-run-on-every-push/) - CI integration, exit codes
- [Testing in 2026: Jest, React Testing Library, and Full Stack Testing Strategies](https://www.nucamp.co/blog/testing-in-2026-jest-react-testing-library-and-full-stack-testing-strategies) - Modern testing stack, layered strategy
- [Node.js console.table() Method - GeeksforGeeks](https://www.geeksforgeeks.org/node-js/node-js-console-table-method/) - console.table() examples
- [Jest CLI Options](https://jestjs.io/docs/cli) - Reporter patterns, stdout/stderr handling

### Tertiary (LOW confidence)
- [Node.js: The commonly used NPM packages — Part 5](https://medium.com/deno-the-complete-reference/node-js-the-commonly-used-npm-packages-part-5-91738bd791f4) - ora usage in ecosystem
- [Ora: Complete Elegant terminal spinner Guide & Tutorial](https://generalistprogrammer.com/tutorials/ora-npm-package-guide) - Tutorial examples
- [Using console colors with Node.js - LogRocket Blog](https://blog.logrocket.com/using-console-colors-node-js/) - Color formatting patterns

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already in project (ora, picocolors, console.table, execa), versions verified
- Architecture: HIGH - Patterns synthesized from official docs and existing Phase 10-11 infrastructure
- Pitfalls: MEDIUM - Based on common CLI tool issues and ora documentation, some from practical experience

**Research date:** 2026-01-24
**Valid until:** 2026-02-24 (30 days - stable ecosystem, these patterns unlikely to change)
