# Architecture Patterns: Generated Project Test Harness

**Domain:** CLI tool testing - generated project validation
**Researched:** 2026-01-23
**Confidence:** HIGH (based on codebase analysis and established patterns)

## Executive Summary

This document defines the architecture for integrating a generated project test harness into the existing `create-aws-project` CLI codebase. The harness validates that generated projects build successfully across the configuration matrix (platforms, auth providers, features).

The key insight is that the existing codebase already has the right abstraction: `generateProject(config, outputDir)` accepts a `ProjectConfig` and outputs to a directory. The test harness wraps this function, runs build commands in generated projects, and collects results.

## Recommended Architecture

```
src/
  __tests__/               # Existing unit tests
    generator.spec.ts
    wizard.spec.ts
    ...
  e2e/                     # NEW: Generated project validation
    fixtures/              # Test configuration definitions
      configs.ts           # ProjectConfig factory
      matrix.ts            # Configuration matrix
    harness/               # Test harness infrastructure
      runner.ts            # Orchestrates generation + validation
      temp-dir.ts          # Temp directory lifecycle
      npm-runner.ts        # npm command execution
      types.ts             # Result types
    __tests__/             # E2E test files
      smoke.e2e.ts         # Fast: single config validation
      matrix.e2e.ts        # Slow: full matrix validation
  generator/               # Existing (no changes needed)
    generate-project.ts    # Main entry point for harness
  ...
```

### Why This Structure

1. **Separation of concerns:** E2E tests live in `src/e2e/` not `src/__tests__/` - they have different runtime characteristics (minutes vs milliseconds)
2. **Reusable harness:** The `harness/` module can be used by both smoke tests and matrix tests
3. **Fixture-driven:** Test configurations are data, not code - easy to add new matrix combinations
4. **Generator untouched:** `generateProject()` already has the right interface - no modifications needed

## Component Boundaries

| Component | Responsibility | Consumes | Produces |
|-----------|---------------|----------|----------|
| `fixtures/configs.ts` | Factory functions for `ProjectConfig` | `types.ts` | `ProjectConfig` objects |
| `fixtures/matrix.ts` | Defines test matrix (which configs to test) | `configs.ts` | Array of test scenarios |
| `harness/temp-dir.ts` | Create/cleanup temp directories | Node `fs`, `os` | Temp dir paths |
| `harness/npm-runner.ts` | Execute npm commands in directories | `execa` | Command results (exit code, output) |
| `harness/runner.ts` | Orchestrate: generate -> npm install -> validate | All above + `generateProject` | `ValidationResult` |
| `harness/types.ts` | Type definitions for harness | - | TypeScript types |
| `e2e/__tests__/*.e2e.ts` | Jest test files | `runner.ts`, `matrix.ts` | Test results |

## Data Flow for Validation Pipeline

```
                    Matrix Definition
                           |
                           v
               +-------------------+
               | For each config:  |
               +-------------------+
                           |
         +-----------------+-----------------+
         |                                   |
         v                                   |
  +-------------+                            |
  | temp-dir.ts |                            |
  | create()    |                            |
  +-------------+                            |
         |                                   |
         v                                   |
  +-------------------+                      |
  | generateProject() |  <-- existing API    |
  | (config, tempDir) |                      |
  +-------------------+                      |
         |                                   |
         v                                   |
  +---------------+                          |
  | npm-runner.ts |                          |
  | npm install   |                          |
  +---------------+                          |
         |                                   |
         v                                   |
  +---------------+                          |
  | npm-runner.ts |                          |
  | npm run build |                          |
  +---------------+                          |
         |                                   |
         v                                   |
  +-------------+                            |
  | temp-dir.ts |                            |
  | cleanup()   |                            |
  +-------------+                            |
         |                                   |
         +----------------+------------------+
                          |
                          v
                 Collect Results
                          |
                          v
              Report Pass/Fail + Details
```

## Integration Points with Existing CLI

### Integration Point 1: `generateProject()` Function

**Location:** `src/generator/generate-project.ts`
**Interface:**
```typescript
export async function generateProject(
  config: ProjectConfig,
  outputDir: string,
  options: GenerateOptions = {}
): Promise<void>
```

**Integration strategy:** Import and call directly. No wrapper needed.

```typescript
// In harness/runner.ts
import { generateProject } from '../../generator/index.js';

async function runValidation(config: ProjectConfig): Promise<ValidationResult> {
  const tempDir = await createTempDir();
  try {
    await generateProject(config, tempDir, { onProgress: () => {} });
    // ... run npm commands
  } finally {
    await cleanupTempDir(tempDir);
  }
}
```

**Why this works:** The existing function is already designed for programmatic use. It accepts a config object (no prompts) and a target directory. The `onProgress` callback can be silenced for tests.

### Integration Point 2: `ProjectConfig` Type

**Location:** `src/types.ts`
**No changes needed.** Test fixtures will create valid `ProjectConfig` objects.

```typescript
// In fixtures/configs.ts
import type { ProjectConfig } from '../../types.js';

export function createMinimalConfig(): ProjectConfig {
  return {
    projectName: 'test-project',
    platforms: ['web'],
    awsRegion: 'us-east-1',
    features: [],
    brandColor: 'blue',
    auth: { provider: 'none', features: [] },
  };
}

export function createFullConfig(): ProjectConfig {
  return {
    projectName: 'full-project',
    platforms: ['web', 'mobile', 'api'],
    awsRegion: 'us-east-1',
    features: ['github-actions', 'vscode-config'],
    brandColor: 'purple',
    auth: { provider: 'cognito', features: ['mfa', 'social-login'] },
  };
}
```

### Integration Point 3: Jest Configuration

**Location:** `jest.config.ts`
**Modification needed:** Add E2E project configuration.

The existing Jest config uses standard configuration. Extend it with a projects array:

```typescript
// Option A: Multi-project config (recommended)
export default {
  projects: [
    // Existing unit tests
    {
      displayName: 'unit',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/src/__tests__/**/*.spec.ts'],
      // ... existing config
    },
    // E2E tests (new)
    {
      displayName: 'e2e',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/src/e2e/**/*.e2e.ts'],
      testTimeout: 300000, // 5 minutes per test
      // ... config
    },
  ],
};
```

**Package.json scripts:**
```json
{
  "test": "jest --selectProjects unit",
  "test:e2e": "jest --selectProjects e2e",
  "test:e2e:smoke": "jest --selectProjects e2e --testNamePattern smoke",
  "test:all": "jest"
}
```

### Integration Point 4: CI Pipeline

**Current state:** No `.github/workflows/` in CLI repo (workflows are in generated projects)
**New addition:** Add CI workflow for the CLI tool itself

```yaml
# .github/workflows/ci.yml (new file)
name: CI
on: [push, pull_request]

jobs:
  unit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
      - run: npm ci
      - run: npm test

  e2e-smoke:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
      - run: npm ci
      - run: npm run build
      - run: npm run test:e2e:smoke

  e2e-matrix:
    runs-on: ubuntu-latest
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
      - run: npm ci
      - run: npm run build
      - run: npm run test:e2e
```

## New Components Needed

### 1. `src/e2e/harness/temp-dir.ts`

Manages temporary directory lifecycle.

```typescript
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export async function createTempDir(prefix = 'cap-test-'): Promise<string> {
  return mkdtemp(join(tmpdir(), prefix));
}

export async function cleanupTempDir(path: string): Promise<void> {
  await rm(path, { recursive: true, force: true });
}
```

### 2. `src/e2e/harness/npm-runner.ts`

Executes npm commands with proper timeout and error handling.

**Recommendation:** Use `execa` for cross-platform compatibility.

```typescript
import { execa, type ExecaError } from 'execa';

export interface NpmResult {
  success: boolean;
  command: string;
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
}

export async function runNpmCommand(
  command: string[],
  cwd: string,
  timeoutMs = 180000 // 3 minutes default
): Promise<NpmResult> {
  const start = Date.now();
  const cmd = command[0];
  const args = command.slice(1);

  try {
    const result = await execa(cmd, args, {
      cwd,
      timeout: timeoutMs,
      // Use shell on Windows for npm compatibility
      shell: process.platform === 'win32',
    });

    return {
      success: true,
      command: command.join(' '),
      exitCode: 0,
      stdout: result.stdout,
      stderr: result.stderr,
      durationMs: Date.now() - start,
    };
  } catch (error) {
    const execaError = error as ExecaError;
    return {
      success: false,
      command: command.join(' '),
      exitCode: execaError.exitCode ?? 1,
      stdout: execaError.stdout ?? '',
      stderr: execaError.stderr ?? '',
      durationMs: Date.now() - start,
    };
  }
}
```

### 3. `src/e2e/harness/runner.ts`

Orchestrates the full validation flow.

```typescript
import type { ProjectConfig } from '../../types.js';
import { generateProject } from '../../generator/index.js';
import { createTempDir, cleanupTempDir } from './temp-dir.js';
import { runNpmCommand, type NpmResult } from './npm-runner.js';

export interface ValidationResult {
  config: ProjectConfig;
  success: boolean;
  tempDir: string;
  steps: {
    generate: { success: boolean; error?: string };
    install: NpmResult | null;
    build: NpmResult | null;
  };
  totalDurationMs: number;
}

export async function validateGeneratedProject(
  config: ProjectConfig,
  options: { cleanup?: boolean; installTimeout?: number; buildTimeout?: number } = {}
): Promise<ValidationResult> {
  const { cleanup = true, installTimeout = 180000, buildTimeout = 120000 } = options;
  const start = Date.now();
  const tempDir = await createTempDir();

  const result: ValidationResult = {
    config,
    success: false,
    tempDir,
    steps: {
      generate: { success: false },
      install: null,
      build: null,
    },
    totalDurationMs: 0,
  };

  try {
    // Step 1: Generate project
    await generateProject(config, tempDir, { onProgress: () => {} });
    result.steps.generate.success = true;

    // Step 2: npm install
    result.steps.install = await runNpmCommand(
      ['npm', 'install'],
      tempDir,
      installTimeout
    );
    if (!result.steps.install.success) {
      return result;
    }

    // Step 3: Build (use nx build for all projects)
    result.steps.build = await runNpmCommand(
      ['npm', 'run', 'build:all'],
      tempDir,
      buildTimeout
    );

    result.success = result.steps.build.success;
    return result;
  } catch (error) {
    result.steps.generate.error = error instanceof Error ? error.message : String(error);
    return result;
  } finally {
    result.totalDurationMs = Date.now() - start;
    if (cleanup) {
      await cleanupTempDir(tempDir);
    }
  }
}
```

### 4. `src/e2e/harness/types.ts`

Type definitions.

```typescript
import type { ProjectConfig } from '../../types.js';

export interface TestScenario {
  name: string;
  config: ProjectConfig;
  expectedBuildTargets?: string[]; // e.g., ['web', 'api']
}

export interface MatrixResult {
  scenarios: Array<{
    scenario: TestScenario;
    result: ValidationResult;
  }>;
  summary: {
    total: number;
    passed: number;
    failed: number;
    durationMs: number;
  };
}
```

### 5. `src/e2e/fixtures/configs.ts`

Factory functions for test configurations.

```typescript
import type { ProjectConfig } from '../../types.js';

export const createConfig = (overrides: Partial<ProjectConfig> = {}): ProjectConfig => ({
  projectName: 'test-project',
  platforms: ['web'],
  awsRegion: 'us-east-1',
  features: [],
  brandColor: 'blue',
  auth: { provider: 'none', features: [] },
  ...overrides,
});

// Smoke test config - fastest possible validation
export const smokeConfig = createConfig({
  projectName: 'smoke-test',
  platforms: ['web'],
  features: [],
  auth: { provider: 'none', features: [] },
});

// Full stack config
export const fullStackConfig = createConfig({
  projectName: 'full-stack',
  platforms: ['web', 'mobile', 'api'],
  features: ['github-actions', 'vscode-config'],
  auth: { provider: 'cognito', features: ['mfa'] },
});
```

### 6. `src/e2e/fixtures/matrix.ts`

Matrix definition for comprehensive testing.

```typescript
import type { TestScenario } from '../harness/types.js';
import { createConfig } from './configs.js';

// Tiered test matrix
export const smokeScenarios: TestScenario[] = [
  {
    name: 'web-only-no-auth',
    config: createConfig({ platforms: ['web'] }),
  },
];

export const coreScenarios: TestScenario[] = [
  // Platform combinations
  { name: 'api-only', config: createConfig({ platforms: ['api'] }) },
  { name: 'web-api', config: createConfig({ platforms: ['web', 'api'] }) },
  { name: 'all-platforms', config: createConfig({ platforms: ['web', 'mobile', 'api'] }) },
];

export const authScenarios: TestScenario[] = [
  { name: 'cognito-basic', config: createConfig({ auth: { provider: 'cognito', features: [] } }) },
  { name: 'cognito-mfa', config: createConfig({ auth: { provider: 'cognito', features: ['mfa'] } }) },
  { name: 'auth0', config: createConfig({ auth: { provider: 'auth0', features: [] } }) },
];

export const fullMatrix: TestScenario[] = [
  ...smokeScenarios,
  ...coreScenarios,
  ...authScenarios,
];
```

## Patterns to Follow

### Pattern 1: Cleanup on Success, Preserve on Failure

When a test fails, preserve the temp directory for debugging.

```typescript
describe('generated project validation', () => {
  it('should build web-only project', async () => {
    const result = await validateGeneratedProject(config, {
      cleanup: false // Preserve for inspection if test fails
    });

    if (result.success) {
      await cleanupTempDir(result.tempDir);
    } else {
      console.log(`Failed project preserved at: ${result.tempDir}`);
    }

    expect(result.success).toBe(true);
  });
});
```

### Pattern 2: Parallel Matrix Execution (with limits)

Run matrix tests in parallel but limit concurrency to avoid resource exhaustion.

```typescript
import pLimit from 'p-limit';

const limit = pLimit(3); // Max 3 concurrent validations

const results = await Promise.all(
  scenarios.map(scenario =>
    limit(() => validateGeneratedProject(scenario.config))
  )
);
```

### Pattern 3: Structured Error Reporting

Capture and report which step failed with full context.

```typescript
function formatFailure(result: ValidationResult): string {
  const lines = [`Validation failed for: ${result.config.projectName}`];

  if (!result.steps.generate.success) {
    lines.push(`  Generate failed: ${result.steps.generate.error}`);
  } else if (result.steps.install && !result.steps.install.success) {
    lines.push(`  npm install failed (exit ${result.steps.install.exitCode})`);
    lines.push(`  stderr: ${result.steps.install.stderr.slice(0, 500)}`);
  } else if (result.steps.build && !result.steps.build.success) {
    lines.push(`  Build failed (exit ${result.steps.build.exitCode})`);
    lines.push(`  stderr: ${result.steps.build.stderr.slice(0, 500)}`);
  }

  return lines.join('\n');
}
```

## Anti-Patterns to Avoid

### Anti-Pattern 1: Modifying generateProject for Tests

**Wrong:** Adding test-specific flags or behavior to `generateProject()`.
**Right:** The existing function already has the right interface. Use it as-is.

### Anti-Pattern 2: Running npm ci in Tests

**Wrong:** Using `npm ci` which requires package-lock.json in generated projects.
**Right:** Generated projects don't have package-lock.json initially. Use `npm install`.

### Anti-Pattern 3: Hardcoded Timeouts

**Wrong:** Using fixed timeouts without configuration.
**Right:** Make timeouts configurable with sensible defaults. npm install on first run (without cache) can be slow.

### Anti-Pattern 4: Ignoring npm Cache

**Wrong:** Clearing npm cache between tests for "isolation".
**Right:** Let npm use its cache - it dramatically speeds up repeated installs. The goal is validating the generated project, not npm's caching.

## Suggested Build Order

Based on dependency analysis:

### Phase 1: Infrastructure (no dependencies)
1. `harness/types.ts` - Type definitions
2. `harness/temp-dir.ts` - Temp directory management
3. `harness/npm-runner.ts` - npm command execution

### Phase 2: Orchestration (depends on Phase 1)
4. `harness/runner.ts` - Validation orchestration
5. `fixtures/configs.ts` - Config factories
6. `fixtures/matrix.ts` - Test matrix definition

### Phase 3: Tests (depends on Phase 2)
7. `__tests__/smoke.e2e.ts` - Smoke test
8. Jest config updates
9. Package.json scripts

### Phase 4: CI Integration (depends on Phase 3)
10. `.github/workflows/ci.yml`

## Dependency Diagram

```
types.ts (standalone)
    ^
    |
temp-dir.ts (standalone)
    ^
    |
npm-runner.ts (standalone)
    ^
    |
runner.ts ---> temp-dir.ts
    |     \
    |      --> npm-runner.ts
    |       \
    |        --> generateProject (existing)
    v
configs.ts ---> types.ts (project types)
    ^
    |
matrix.ts ---> configs.ts
    ^
    |
smoke.e2e.ts ---> runner.ts
             \--> matrix.ts

jest.config.ts (modified)
package.json (modified)
.github/workflows/ci.yml (new)
```

## New Dependencies Required

| Package | Purpose | Version |
|---------|---------|---------|
| `execa` | Cross-platform process execution | `^9.x` |
| `p-limit` | Concurrency limiting for parallel tests | `^6.x` (optional, for matrix parallelization) |

**Note:** Both are ESM-only packages, which aligns with this project's ESM configuration.

## Sources

- [Node.js Child Process Documentation](https://nodejs.org/api/child_process.html) - spawn/exec behavior, timeout handling
- [Execa GitHub](https://github.com/sindresorhus/execa) - Cross-platform process execution
- [Jest Projects Configuration](https://jestjs.io/docs/configuration) - Multi-project setup
- [Separating Unit and Integration Tests in Jest](https://daveiscoding.hashnode.dev/separate-nodejs-unit-integration-and-e2e-tests-using-jest-projects) - Jest projects pattern
- Codebase analysis of `src/generator/generate-project.ts` - existing programmatic API
