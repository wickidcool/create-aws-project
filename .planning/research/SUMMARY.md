# Project Research Summary

**Project:** create-aws-project v1.4 - Generated Project Validation
**Domain:** CLI generator test harness - validating that scaffolded projects build correctly
**Researched:** 2026-01-23
**Confidence:** HIGH

## Executive Summary

The create-aws-project CLI generates full-stack AWS projects with 14 configurations (7 platform combinations x 2 auth providers). Current unit tests mock the filesystem and verify token replacement logic, but they never validate that generated projects actually compile, install dependencies, or run their test suites. This is a known gap in CLI generator testing - teams assume "if tokens substitute correctly, output must be valid" - which leads to users discovering broken configurations after release.

The recommended approach is to build a test harness that programmatically invokes `generateProject()` into temporary directories, then executes the real `npm install`, `npm run build`, and `npm test` pipeline. The existing codebase already has the right abstraction - the `generateProject(config, outputDir)` function accepts configuration without prompts. The harness wraps this with temp directory management, process execution via `execa`, and structured result collection. Only ONE new dependency is needed: `execa@^9.6.1` for cross-platform child process execution. Everything else uses Node.js built-ins or existing Jest infrastructure.

Key risks are npm install timeouts in CI (2-5 minutes per configuration), temp directory cleanup failures causing flaky tests, and testing only common configurations while edge cases ship broken. These are mitigated through tiered testing (3-4 core configs on PRs, full 14-config matrix on releases), robust cleanup with unique directories and try/finally patterns, and explicit step timeouts. The architecture separates harness infrastructure from test fixtures, making it easy to add configurations without touching orchestration code.

## Key Findings

### Recommended Stack

The existing stack (Jest 30, ts-jest, TypeScript 5.9, Node 22) remains unchanged. Add only `execa@^9.6.1` for process execution.

**Core technologies:**
- **execa@^9.6.1** (NEW): Cross-platform process execution with promises, timeouts, automatic cleanup
- **Node.js fs/promises**: Built-in temp directory creation (`mkdtemp`) and cleanup (`rm`) - no external packages
- **Jest projects**: Built-in feature to separate unit tests from E2E tests with different timeouts

**What NOT to add:**
- Vitest - Already have Jest 30 with improved ESM support
- rimraf - Node 22's `fs.rm()` with `recursive: true` does the same thing
- Docker - Complexity overhead; temp directories provide sufficient isolation
- Playwright/Cypress - Wrong layer; validating build artifacts, not UI

### Expected Features

**Must have (table stakes):**
- Programmatic project generation (already exists via `generateProject()`)
- Configuration matrix definition (14 configs as typed array)
- Temp directory isolation (unique dirs per test)
- Validation pipeline: `npm install` -> `npm run build` -> `npm test`
- Exit code validation and failure reporting with stdout/stderr capture
- Local runner script (`npm run test:e2e`)
- PR CI workflow (core configs) and release workflow (full matrix)
- Cleanup on completion and timeout handling (10 min per config)

**Should have (differentiators):**
- Tiered execution (core tier for PRs, full matrix for releases)
- Progress reporting ("Testing web+api+cognito (1/14)...")
- Configuration subset selection for debugging (`--config web-api-cognito`)
- Matrix visualization (summary table at end)

**Defer (v2+):**
- Cached npm install (complex, premature optimization)
- Parallel test execution (sequential works first)
- Structured JSON output (only needed if other tools consume results)

### Architecture Approach

The harness lives in `src/e2e/` separate from unit tests in `src/__tests__/`. It consists of two layers: infrastructure (`harness/` module with temp-dir, npm-runner, runner components) and fixtures (`fixtures/` with config factories and matrix definitions). Test files in `e2e/__tests__/` use the harness to validate configurations. The existing `generateProject()` function requires no modifications.

**Major components:**
1. **harness/temp-dir.ts** - Create/cleanup isolated temp directories with unique names
2. **harness/npm-runner.ts** - Execute npm commands via execa with timeouts and error capture
3. **harness/runner.ts** - Orchestrate: generate project -> npm install -> npm build -> collect results
4. **fixtures/configs.ts** - Factory functions producing valid `ProjectConfig` objects
5. **fixtures/matrix.ts** - Define test scenarios with tiering (smoke, core, full)

### Critical Pitfalls

1. **Testing template tokens instead of generated output** - Unit tests verify token substitution but generated projects fail to compile. PREVENTION: Smoke test tier must generate real projects and run actual build commands.

2. **Temp directory cleanup failures** - Tests fail with EEXIST/ENOTEMPTY when cleanup doesn't run after early throws. PREVENTION: Use unique timestamped directory names and cleanup in finally blocks, not just afterEach.

3. **npm install timeouts and CI flakiness** - 14 configs x 3-5 minutes each = timeouts and OOM kills in parallel. PREVENTION: Sequential execution with step-level timeouts, let npm use its cache, set explicit `maxsockets`.

4. **Testing only happy path configurations** - web+api+cognito works but mobile-only+auth0 ships broken. PREVENTION: Define tiered strategy where PR tier covers every platform AND every auth provider.

5. **CI Node version differs from generated projects** - Tests pass in CI but generated projects fail for users on different Node. PREVENTION: CI workflow reads Node version from generated project's package.json or tests multiple versions.

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Test Harness Foundation
**Rationale:** Must establish infrastructure before writing tests. Temp directory and process execution are foundational.
**Delivers:** `src/e2e/harness/` module with temp-dir.ts, npm-runner.ts, types.ts
**Addresses:** Temp directory isolation, validation pipeline execution (FEATURES.md)
**Avoids:** Pitfall 2 (cleanup failures), Pitfall 10 (hardcoded paths)
**Dependencies:** Install `execa@^9.6.1`

### Phase 2: Validation Pipeline
**Rationale:** Core orchestration depends on Phase 1 infrastructure. Must work before tests can use it.
**Delivers:** `src/e2e/harness/runner.ts` - the `validateGeneratedProject()` function
**Uses:** execa, Node fs/promises (STACK.md)
**Implements:** Runner component (ARCHITECTURE.md)
**Avoids:** Pitfall 1 (testing tokens not output), Pitfall 6 (validating build without tests), Pitfall 12 (no per-step timeout)

### Phase 3: Test Fixtures and Matrix
**Rationale:** With harness complete, define what to test. Config factories enable matrix definition.
**Delivers:** `src/e2e/fixtures/` with configs.ts and matrix.ts; tiered test scenarios
**Addresses:** Configuration matrix definition, tiered execution (FEATURES.md)
**Avoids:** Pitfall 4 (testing only happy path) - ensures every platform and auth provider appears in core tier

### Phase 4: Jest Configuration and Local Runner
**Rationale:** Tests need Jest project configuration before they can run.
**Delivers:** Updated jest.config.ts with E2E project, npm scripts (`test:e2e`, `test:e2e:smoke`)
**Addresses:** Local runner script, timeout handling (FEATURES.md)
**Avoids:** Pitfall 9 (test isolation) - E2E project has `maxWorkers: 1` for sequential execution

### Phase 5: E2E Test Files
**Rationale:** All infrastructure in place; write the actual test specs.
**Delivers:** `src/e2e/__tests__/smoke.e2e.ts`, `src/e2e/__tests__/matrix.e2e.ts`
**Addresses:** Exit code validation, failure reporting, progress reporting (FEATURES.md)
**Avoids:** Pitfall 11 (verbose output obscuring failures) - structured error extraction

### Phase 6: CI Integration
**Rationale:** Tests work locally; extend to CI. Last because it depends on everything else.
**Delivers:** `.github/workflows/ci.yml` with unit, e2e-smoke, e2e-matrix jobs
**Addresses:** PR workflow (core), release workflow (full), matrix visualization (FEATURES.md)
**Avoids:** Pitfall 3 (npm timeout in CI), Pitfall 5 (Node version mismatch), Pitfall 8 (platform differences), Pitfall 14 (missing config name in errors)

### Phase Ordering Rationale

- **Phases 1-2 first:** Infrastructure must exist before tests can use it. The harness is the foundation.
- **Phase 3 before 4:** Need to know what configs exist before configuring Jest to run them.
- **Phase 4 before 5:** Jest config must be in place for test files to execute.
- **Phase 6 last:** CI wraps everything; it's the outermost layer and requires all inner layers working.

This ordering follows the dependency graph in ARCHITECTURE.md: types -> temp-dir -> npm-runner -> runner -> configs -> matrix -> tests -> CI.

### Research Flags

**Phases likely needing deeper research during planning:**
- **Phase 6 (CI Integration):** Mobile validation on macOS runners, GitHub Actions matrix optimization, caching strategies. The CI workflow has many moving parts and platform-specific concerns.

**Phases with standard patterns (skip research-phase):**
- **Phase 1 (Foundation):** Well-documented Node.js fs patterns, execa is mature and documented
- **Phase 2 (Pipeline):** Straightforward orchestration, patterns established in ARCHITECTURE.md
- **Phase 3 (Fixtures):** Data definition, no external dependencies
- **Phase 4 (Jest Config):** Jest projects is a documented feature
- **Phase 5 (Tests):** Jest test patterns are standard

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | execa is industry standard; Node built-ins are stable; Jest 30 already in use |
| Features | HIGH | Patterns from Yeoman, create-react-app, npm CLI smoke tests all align |
| Architecture | HIGH | Based on codebase analysis; `generateProject()` already has correct interface |
| Pitfalls | MEDIUM | General CLI generator patterns; Nx monorepo specifics may vary |

**Overall confidence:** HIGH

### Gaps to Address

- **Mobile platform validation depth:** Research doesn't fully resolve whether to use macOS runners for iOS validation or document TypeScript-only validation as a limitation. Decide during Phase 6 planning.
- **npm caching strategy:** Multiple approaches mentioned (--prefer-offline, npm cache action, sequential vs parallel). Concrete strategy should be validated empirically in Phase 6.
- **Expo/React Native native builds:** If generated mobile projects need native validation beyond TypeScript compilation, additional tooling may be needed. Currently documented as out of scope.

## Sources

### Primary (HIGH confidence)
- [Jest 30 Blog](https://jestjs.io/blog/2025/06/04/jest-30) - Jest projects, ESM improvements
- [Execa GitHub](https://github.com/sindresorhus/execa) - Process execution patterns
- [Node.js fs Documentation](https://nodejs.org/api/fs.html) - mkdtemp, rm APIs
- Codebase analysis of `src/generator/generate-project.ts` - existing programmatic API

### Secondary (MEDIUM confidence)
- [Yeoman Testing Guidelines](https://yeoman.io/authoring/testing) - Generator testing patterns
- [GitHub Actions Matrix Strategy](https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions) - CI configuration
- [Nx Reliable CI Blog](https://nx.dev/blog/reliable-ci-a-new-execution-model-fixing-both-flakiness-and-slowness) - Flaky test mitigation

### Tertiary (needs validation)
- npm install timing and caching strategies - empirical testing needed
- Mobile platform CI requirements - depends on actual generated project structure

---
*Research completed: 2026-01-23*
*Ready for roadmap: yes*
