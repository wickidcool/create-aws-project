# Technology Stack: Generated Project Validation Testing

**Project:** create-aws-project test harness
**Researched:** 2026-01-23
**Confidence:** HIGH

## Context

The create-aws-project CLI generates full-stack AWS projects with 7 wizard prompts creating different platform (web/mobile/api) and auth (Cognito/Auth0/none) combinations. Current unit tests mock the filesystem and verify token replacement logic, but do not validate that generated projects actually build.

**Goal:** Add integration tests that:
1. Programmatically invoke the generator
2. Create actual projects in temporary directories
3. Run `npm install`, `npm run build`, `npm test` in generated projects
4. Verify across configuration matrix

## Existing Stack (DO NOT CHANGE)

| Technology | Version | Status |
|------------|---------|--------|
| Jest | ^30.2.0 | Installed, working |
| ts-jest | ^29.4.5 | Installed, working |
| TypeScript | ^5.9.3 | Installed, ES modules |
| Node.js | >=22.0.0 | Required by package.json |

**Critical constraint:** Tests use `--experimental-vm-modules` for ESM support. Any additions must work with this setup.

## Recommended Additions

### 1. Child Process Execution: `execa`

| Property | Value |
|----------|-------|
| Package | `execa` |
| Version | `^9.6.1` |
| Type | devDependency |
| Node requirement | ^18.19.0 or >=20.5.0 (compatible) |

**Why execa over Node.js child_process:**

1. **Promise-based API** - Works with async/await, integrates cleanly with Jest async tests
2. **Better error handling** - Detailed errors include stdout/stderr, exit codes, command that failed
3. **Automatic cleanup** - Kills child processes when parent exits, prevents zombie processes
4. **Cross-platform** - Handles Windows shebangs and PATH resolution
5. **Streaming support** - Can stream output for long-running `npm install` operations
6. **ESM native** - Pure ESM package, aligns with project's module strategy

**Usage pattern for validation tests:**

```typescript
import { execa } from 'execa';

// Run npm install in generated project
const { exitCode, stderr } = await execa('npm', ['install'], {
  cwd: generatedProjectPath,
  timeout: 300000, // 5 min for npm install
  reject: false,  // Don't throw on non-zero exit
});

// Run build
const buildResult = await execa('npm', ['run', 'build'], {
  cwd: generatedProjectPath,
  timeout: 120000,
  reject: false,
});

// Run tests
const testResult = await execa('npm', ['test'], {
  cwd: generatedProjectPath,
  timeout: 120000,
  reject: false,
});
```

**Alternative considered:** Node.js built-in `child_process.execSync`/`spawn`
- **Why not:** Callback-based API awkward in async tests, no automatic cleanup, poor error messages, no timeout without extra code

### 2. Temporary Directory Management: Node.js Built-in

| Property | Value |
|----------|-------|
| Package | None (use `node:fs/promises`) |
| API | `fs.mkdtemp()` |
| Node requirement | Built-in |

**Why Node.js built-in over tmp-promise/tempy:**

1. **Zero dependencies** - No additional packages needed
2. **Node 22+ has everything** - `fs.mkdtemp` with promises API is fully mature
3. **Platform-aware** - Uses system temp directory correctly
4. **Security** - Creates unique directories with proper permissions
5. **Simplicity** - For our use case (create dir, run tests, delete), built-in is sufficient

**Pattern for test harness:**

```typescript
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Create temp directory per test
const tempDir = await mkdtemp(join(tmpdir(), 'cap-test-'));

// Generate project into tempDir
await generateProject(config, tempDir);

// ... run tests ...

// Cleanup (in afterEach/afterAll)
await rm(tempDir, { recursive: true, force: true });
```

**Alternatives considered:**

| Package | Why Not |
|---------|---------|
| `tempy` | Extra dependency for simple use case; Node 22 built-ins sufficient |
| `tmp-promise` | Last updated 2022; Node built-ins have caught up |
| `rimraf` | Node 22's `fs.rm()` with `recursive: true` does same thing |

### 3. Test Configuration: Jest Projects

| Property | Value |
|----------|-------|
| Package | None (Jest built-in) |
| Feature | `projects` in jest.config.ts |

**Why Jest projects:**

The integration tests have different characteristics than unit tests:
- **Longer timeouts** - `npm install` can take 2-5 minutes
- **Sequential execution** - Can't run multiple `npm install` in parallel (disk/network contention)
- **Separate patterns** - Integration tests in different directory

**Recommended jest.config.ts structure:**

```typescript
export default {
  projects: [
    // Existing unit tests
    {
      displayName: 'unit',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/src/__tests__/**/*.spec.ts'],
      // ... existing config
    },
    // New integration tests
    {
      displayName: 'integration',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/src/__integration__/**/*.spec.ts'],
      testTimeout: 600000, // 10 minutes for full validation
      maxWorkers: 1, // Sequential to avoid npm contention
      // ... same transform config
    },
  ],
};
```

**Run options:**

```bash
# Unit tests only (fast, CI default)
npm test -- --selectProjects=unit

# Integration tests only (slow, CI weekly/release)
npm test -- --selectProjects=integration

# All tests
npm test
```

## Installation

```bash
# Single new dependency
npm install -D execa@^9.6.1
```

**That's it.** Everything else uses existing dependencies or Node.js built-ins.

## What NOT to Add

### Do NOT add: Vitest

| Reason | Explanation |
|--------|-------------|
| Already have Jest 30 | Migration cost with no benefit for this use case |
| Jest 30 improved ESM | Previous ESM complaints addressed in Jest 30 |
| Existing test patterns | Unit tests already use Jest mocking patterns |
| CI integration | Jest already integrated, no change needed |

### Do NOT add: rimraf

| Reason | Explanation |
|--------|-------------|
| Node 22 built-in | `fs.rm(path, { recursive: true, force: true })` does same thing |
| Zero dependencies | No point adding package for one-liner |

### Do NOT add: cross-spawn

| Reason | Explanation |
|--------|-------------|
| execa handles it | execa uses cross-spawn internally for Windows |
| Duplication | Would be redundant with execa |

### Do NOT add: Playwright/Cypress for E2E

| Reason | Explanation |
|--------|-------------|
| Wrong layer | We're validating build artifacts, not UI |
| Overkill | `npm run build && npm test` is sufficient validation |
| Cost | Browser testing infrastructure not needed |

### Do NOT add: Docker for test isolation

| Reason | Explanation |
|--------|-------------|
| Complexity | Temp directories provide sufficient isolation |
| CI overhead | Docker-in-docker adds 2-3 minutes to CI |
| Portability | Works on any machine without Docker |

## CI Matrix Strategy

The test matrix covers configuration combinations. Use GitHub Actions matrix strategy:

```yaml
jobs:
  integration-test:
    strategy:
      fail-fast: false
      matrix:
        platform: [web, api, mobile]
        auth: [none, cognito, auth0]
        exclude:
          # Mobile + Auth0 not supported
          - platform: mobile
            auth: auth0
    steps:
      - run: npm test -- --selectProjects=integration --testNamePattern="${{ matrix.platform }}.*${{ matrix.auth }}"
```

**Key decisions:**

1. **fail-fast: false** - Run all matrix combinations even if one fails (want full coverage report)
2. **Exclude invalid combos** - Don't waste CI on unsupported configurations
3. **testNamePattern** - Jest's built-in filtering by test name, no additional tooling

**Estimated CI time:**
- Unit tests: ~30 seconds
- Integration test (single config): ~3-5 minutes
- Full matrix (8 configs): ~5 minutes with parallelism

## Summary Table

| Need | Solution | New Dependency? |
|------|----------|-----------------|
| Run npm in generated projects | `execa@^9.6.1` | YES |
| Create temp directories | `node:fs/promises.mkdtemp` | NO |
| Delete temp directories | `node:fs/promises.rm` | NO |
| Separate test timeouts | Jest projects config | NO |
| Matrix testing | GitHub Actions matrix | NO |
| Test filtering | Jest `--selectProjects` | NO |

**Total new dependencies: 1 (execa)**

## Sources

- [Jest 30 Blog Post](https://jestjs.io/blog/2025/06/04/jest-30) - Jest 30 features, ESM improvements
- [Execa GitHub](https://github.com/sindresorhus/execa) - Process execution library
- [Execa npm](https://www.npmjs.com/package/execa) - Version 9.6.1 verified
- [Node.js fs.mkdtemp Documentation](https://nodejs.org/api/fs.html) - Built-in temp directory
- [GitHub Actions Matrix Builds](https://www.blacksmith.sh/blog/matrix-builds-with-github-actions) - CI matrix patterns
- [Advanced GitHub Actions Matrix](https://devopsdirective.com/posts/2025/08/advanced-github-actions-matrix/) - Advanced matrix strategies
- [Node.js Testing Best Practices](https://github.com/goldbergyoni/nodejs-testing-best-practices) - Test isolation patterns
- [Directories and Files Management in Tests](https://brightinventions.pl/blog/directories-and-files-management-in-tests/) - Temp file patterns
