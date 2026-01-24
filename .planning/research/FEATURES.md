# Feature Landscape: CLI Generator Test Harness

**Domain:** Generated project validation for CLI scaffolding tool
**Researched:** 2026-01-23
**Confidence:** HIGH (patterns well-established in ecosystem)

## Context

create-aws-starter-kit generates projects with 14 configurations:
- 7 platform combinations: web, mobile, api, web+mobile, web+api, mobile+api, web+mobile+api
- 2 auth providers: Cognito, Auth0 (excluding 'none' for validation purposes)

Validation pipeline: `npm install` -> `npm run build` -> `npm test`

## Table Stakes

Features users expect. Missing = test harness feels incomplete.

| Feature | Why Expected | Complexity | Depends On | Notes |
|---------|--------------|------------|------------|-------|
| **Programmatic project generation** | CLI can't prompt interactively in tests | Low | Existing `generateProject()` | Already have `generateProject(config, outputDir)` in codebase |
| **Configuration matrix definition** | Need to express 14 configs declaratively | Low | Types system | Array of `ProjectConfig` objects |
| **Temporary directory isolation** | Tests shouldn't pollute file system | Low | Node.js `fs` | Use `jest-fixtures` pattern or `node:fs/promises` tmpdir |
| **Validation pipeline execution** | Core purpose of harness | Medium | Child process spawning | Run npm install/build/test sequentially |
| **Exit code validation** | Know if build/tests passed or failed | Low | Pipeline execution | Check `exitCode === 0` |
| **Failure reporting** | Know which config failed and why | Medium | Pipeline execution | Capture stdout/stderr, report on failure |
| **Local runner script** | Developers run tests manually | Low | Core harness | `npm run test:generated` or similar |
| **PR CI workflow** | Validate on every pull request | Low | GitHub Actions | Standard workflow file |
| **Cleanup on completion** | Don't leave temp dirs on disk | Low | Temp directory | `afterAll` or process exit cleanup |

## Differentiators

Features that improve DX beyond table stakes. Not expected, but valued.

| Feature | Value Proposition | Complexity | Depends On | Notes |
|---------|-------------------|------------|------------|-------|
| **Tiered execution (core vs full)** | Fast feedback on PRs, thorough on release | Medium | Configuration matrix | Define "core" subset (e.g., web+api+cognito, mobile+auth0) |
| **Parallel test execution** | Faster CI runs | Medium | Isolated temp dirs | Each config in separate process/dir |
| **Configuration subset selection** | Run single config locally for debugging | Low | CLI arg parsing | `npm run test:generated -- --config web-api-cognito` |
| **Progress reporting** | Know what's running during long tests | Low | Console output | Print "Testing web+api+cognito (1/14)..." |
| **Cached npm install** | Faster repeated runs | High | npm cache management | Share node_modules or use npm cache |
| **Structured test results** | Machine-readable output for CI | Medium | JSON output | Output JSON alongside console |
| **Timeout handling** | Don't hang indefinitely | Low | Process spawning | Kill after N minutes |
| **Release workflow trigger** | Full matrix on tag/release | Low | GitHub Actions | Workflow triggered by release event |
| **Build step caching** | Skip unchanged dependencies | High | Content hashing | Complex, likely over-engineering |
| **Matrix visualization** | See which configs passed/failed at a glance | Low | Console output | Summary table at end of run |

## Anti-Features

Features to explicitly NOT build. Common mistakes in this domain.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Interactive test prompts** | Tests must run unattended in CI | Use programmatic `generateProject()` API |
| **Testing generated project runtime behavior** | Out of scope - testing CLI, not user's app | Only validate build + tests pass |
| **Mocking npm install** | Defeats purpose of validation | Run real npm install (slow but necessary) |
| **Testing every auth feature combination** | Exponential explosion (14 -> 56+ configs) | Validate platform+auth combos only |
| **Snapshot testing of generated files** | Brittle, hard to maintain | Validate build/test success instead |
| **Real AWS/GitHub API calls in tests** | Requires credentials, slow, flaky | Templates already tested; just validate build |
| **Hot-reloading test harness** | Over-engineering for a test utility | Simple script that runs to completion |
| **Custom test framework** | Unnecessary complexity | Use existing Jest + shell execution |
| **Parallel npm install on same machine** | npm cache conflicts, disk thrashing | Sequential installs or isolated caches |
| **Testing node_modules contents** | Not our responsibility | Trust npm to install correctly |

## Feature Dependencies

```
                    Programmatic Generation (exists)
                              |
                    Configuration Matrix
                              |
                    Temp Directory Isolation
                              |
                    Validation Pipeline Execution
                              |
        +---------+-----------+-----------+----------+
        |         |           |           |          |
    Exit Code   Failure    Cleanup    Progress   Timeout
    Validation  Reporting            Reporting  Handling
        |         |
        +---------+
              |
        Local Runner Script
              |
        CI Workflows (PR / Release)
              |
        Tiered Execution (core vs full)
```

## MVP Recommendation

For MVP (v1.4), prioritize:

1. **Programmatic generation** - Already exists in `generateProject()`
2. **Configuration matrix** - Define 14 configs as array of objects
3. **Temp directory isolation** - Use `node:fs/promises` mkdtemp
4. **Validation pipeline** - Sequential npm install/build/test
5. **Exit code validation** - Check process.exitCode
6. **Failure reporting** - Capture and display stdout/stderr on failure
7. **Local runner** - `npm run test:generated` script
8. **PR workflow** - Core configs only (fast feedback)
9. **Release workflow** - Full 14-config matrix
10. **Timeout handling** - 10-minute timeout per config

Defer to post-v1.4:
- **Cached npm install**: Complex, premature optimization
- **Parallel execution**: Nice speedup, but sequential works first
- **Configuration subset selection**: Convenience feature, not essential
- **Structured JSON output**: Only needed if other tools consume results

## Complexity Estimates

| Phase | Features | Estimated Effort |
|-------|----------|------------------|
| Core harness | Matrix definition, temp dirs, pipeline execution, exit codes | 1-2 days |
| Reporting | Failure capture, progress output, summary | 0.5-1 day |
| Local runner | npm script, timeout handling | 0.5 day |
| CI integration | PR workflow (core), release workflow (full) | 0.5-1 day |
| **Total** | | **3-5 days** |

## Implementation Patterns

### Configuration Matrix Definition

```typescript
interface TestConfig {
  name: string;  // e.g., "web-api-cognito"
  config: ProjectConfig;
  tier: 'core' | 'extended';
}

const TEST_MATRIX: TestConfig[] = [
  {
    name: 'web-api-cognito',
    tier: 'core',
    config: {
      projectName: 'test-web-api-cognito',
      platforms: ['web', 'api'],
      auth: { provider: 'cognito', features: [] },
      // ... rest of config
    }
  },
  // ... 13 more configurations
];
```

### Tiered Execution

```typescript
// Core configs for PR validation (fast feedback)
const CORE_CONFIGS = TEST_MATRIX.filter(c => c.tier === 'core');
// Recommend: 3-4 configs covering main paths

// Full matrix for release validation
const FULL_MATRIX = TEST_MATRIX;
// All 14 configurations
```

### Validation Pipeline

```typescript
async function validateGeneratedProject(dir: string): Promise<ValidationResult> {
  const steps = ['npm install', 'npm run build', 'npm test'];

  for (const step of steps) {
    const result = await runCommand(step, { cwd: dir, timeout: 600000 });
    if (result.exitCode !== 0) {
      return { success: false, step, stdout: result.stdout, stderr: result.stderr };
    }
  }

  return { success: true };
}
```

## Sources

- [Yeoman Generator Testing](https://yeoman.io/authoring/testing) - Testing patterns for scaffolding tools
- [jest-fixtures](https://github.com/Thinkmill/jest-fixtures) - Temp directory management patterns
- [clet](https://github.com/node-modules/clet) - Command line E2E testing patterns
- [GitHub Actions Matrix Strategy](https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions#jobsjob_idstrategymatrix) - CI matrix configuration
- [npm/cli smoke tests](https://github.com/npm/cli/commit/97b41528739460b2e9e72e09000aded412418cb2) - Smoke test patterns for npm CLI
- [Tiered Testing Strategies](https://minimumcd.org/minimumcd/continuous-integration/testing-strategies/) - Fast feedback vs comprehensive testing

---

*Feature landscape analysis: 2026-01-23*
*Update when requirements change*
