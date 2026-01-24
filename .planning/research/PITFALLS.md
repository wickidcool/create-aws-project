# Domain Pitfalls: CLI Generator Test Harness

**Domain:** Generated project validation for CLI scaffolding tools
**Project:** create-aws-starter-kit v1.4
**Researched:** 2026-01-23
**Context:** 14 configurations (7 platform combos x 2 auth providers), npm install -> build -> tests

---

## Critical Pitfalls

Mistakes that cause test infrastructure rewrites, false confidence, or CI pipeline failures.

### Pitfall 1: Testing Template Tokens Instead of Generated Output

**What goes wrong:** Tests verify that template files contain correct `{{TOKEN}}` placeholders or that token substitution logic works in isolation, but never validate that the fully generated project actually builds and runs.

**Why it happens:** Unit testing template logic is faster and easier than generating real projects. Teams assume "if tokens are substituted correctly, the output must be valid."

**Consequences:**
- Generated TypeScript fails to compile due to import path errors
- Missing files from conditional template blocks
- Package.json dependencies don't match actual imports
- False confidence from green tests on broken generators

**Warning signs:**
- All generator tests complete in < 1 second
- No `npm install` or `npm run build` in test suite
- Tests mock the filesystem entirely
- CI passes but users report "generated project won't build"

**Prevention:**
- Implement "smoke test" tier that generates real projects to temp directories
- Run actual `npm install`, `npm run build`, `npm test` on generated output
- At minimum, validate 1 configuration per PR; full matrix on releases

**Detection:** Add a simple integration test that generates one configuration and runs `tsc --noEmit`. If this fails, your unit tests are insufficient.

**Which phase should address:** Phase 1 (Test Harness Foundation) - Core architecture must include real project generation, not just token testing.

---

### Pitfall 2: Temp Directory Cleanup Failures Breaking Subsequent Tests

**What goes wrong:** Tests create temp directories for generated projects but fail to clean them up properly. Subsequent test runs fail with EEXIST errors, disk fills up, or tests interfere with each other.

**Why it happens:**
- Cleanup code in `afterEach` doesn't run if test throws early
- Async cleanup races with next test's setup
- rimraf/fs.rm fails silently on Windows EPERM errors
- Tests assume they have exclusive access to temp directory names

**Consequences:**
- Tests pass locally but fail in CI (different cleanup behavior)
- Flaky tests that depend on run order
- CI runners run out of disk space over time
- "Works on my machine" debugging sessions

**Warning signs:**
- Tests fail with "EEXIST: file already exists" or "ENOTEMPTY"
- Test suite slower on repeat runs
- CI disk space warnings
- Tests pass individually but fail when run together

**Prevention:**
```typescript
// Use unique temp directories per test
const testDir = path.join(os.tmpdir(), `gen-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);

// Cleanup in finally block, not just afterEach
try {
  await runTest();
} finally {
  await fs.rm(testDir, { recursive: true, force: true, maxRetries: 3 });
}
```

**Detection:** Run test suite 3x in a row locally. If second or third run fails, you have cleanup issues.

**Which phase should address:** Phase 1 (Test Harness Foundation) - Temp directory management must be robust from the start.

---

### Pitfall 3: npm install Timeouts and Flakiness in CI

**What goes wrong:** `npm install` takes 2-5 minutes per generated project. With 14 configurations, serial execution times out or exceeds CI limits. Parallel execution causes npm cache contention or OOM kills.

**Why it happens:**
- npm registry latency varies
- No caching strategy for generated project dependencies
- CI runners have limited memory (7GB on GitHub Actions)
- Parallel npm installs fight over cache locks

**Consequences:**
- CI jobs timeout after 60-90 minutes
- Random test failures from npm network errors
- Exit code 137 (OOM) on parallel matrix builds
- Developers skip validation tests because "they're too slow"

**Warning signs:**
- CI builds take > 30 minutes
- Same test fails/passes randomly across runs
- npm install output shows retries
- "Killed" in CI logs with no error message

**Prevention:**
- Cache npm registry locally or use `--prefer-offline`
- Run configurations sequentially with global timeout per step
- Use `npm ci` not `npm install` for deterministic installs
- Consider generating projects in parallel, installing sequentially
- Set explicit timeouts: `npm ci --maxsockets=3` to limit parallelism

```yaml
# GitHub Actions: Cache npm globally, not per-matrix
- uses: actions/setup-node@v4
  with:
    node-version: 22
    cache: 'npm'
```

**Detection:** Monitor CI build times week over week. If variance exceeds 50%, investigate npm timing.

**Which phase should address:** Phase 2 (Core Validation Pipeline) - npm install strategy needs design upfront.

---

### Pitfall 4: Testing Only Happy Path Configurations

**What goes wrong:** Tests validate `web + api + cognito` (the most common config) but skip edge cases like `mobile-only + auth0` or `api-only + no-auth`. These untested configurations ship broken.

**Why it happens:**
- Full matrix testing is slow and expensive
- Edge configurations seem "obviously correct" if common ones work
- Combinatorial explosion makes comprehensive testing feel impossible
- Developers test what they personally use

**Consequences:**
- Users report "web-only doesn't work" after release
- Emergency patches for untested configurations
- Loss of user trust when basic configurations fail
- "Auth0 support" is marketed but actually broken

**Warning signs:**
- Tests only cover 2-3 configurations out of 14
- No test for single-platform configurations
- Auth provider tests only exercise one provider
- No tests for "minimal" configurations (fewest options)

**Prevention:**
- Define tiered testing strategy:
  - **Tier 1 (PR):** 4 core configs (web+api+cognito, mobile+api+auth0, web-only, api-only)
  - **Tier 2 (Release):** All 14 configurations
- Ensure every platform and every auth provider appears in Tier 1
- Test extremes: maximum features AND minimum features

**Detection:** Create a coverage matrix showing which configurations have validation tests. Any gaps are risks.

**Which phase should address:** Phase 3 (Local Test Runner) - Test configuration selection logic must support tiered strategy.

---

### Pitfall 5: CI Environment Differs from Generated Project Requirements

**What goes wrong:** CI runner has Node 20, but generated projects require Node 22. CI has npm 9, generated projects assume npm 10 features. Tests pass in CI but generated projects fail for users.

**Why it happens:**
- CI workflow pins Node version for stability
- Generated projects evolve independently
- Nobody updates CI when template Node version changes
- Local development uses nvm with latest, CI uses fixed version

**Consequences:**
- "Works in CI, fails for users" - inverted usual problem
- Generated project syntax not supported in CI Node version
- npm lockfile version mismatches
- Confusing test failures from Node API differences

**Warning signs:**
- package.json in CLI specifies different `engines.node` than generated projects
- CI workflow hardcodes Node version
- Generated projects use features from newer Node (e.g., native fetch)
- npm warnings about lockfile version during CI

**Prevention:**
- CI workflow should read Node version from generated project's package.json
- Or: CI tests multiple Node versions matching supported range
- Keep CLI and generated project Node requirements synchronized
- Add `.nvmrc` to generated projects and respect it in tests

```yaml
# Dynamic Node version from generated project
- name: Read Node version
  id: node-version
  run: echo "version=$(node -p "require('./package.json').engines.node.replace('>=', '')")" >> $GITHUB_OUTPUT
```

**Detection:** Compare `engines.node` in CLI's package.json vs generated template's package.json.

**Which phase should address:** Phase 4 (CI Integration) - CI workflow must handle Node version alignment.

---

## Moderate Pitfalls

Mistakes that cause delays, technical debt, or confusing test failures.

### Pitfall 6: Validating Build Without Validating Tests

**What goes wrong:** Test harness runs `npm run build` on generated projects but skips `npm test`. Generated projects compile but ship with failing tests that users discover.

**Why it happens:**
- Build validation seems sufficient ("if it compiles, it works")
- Running tests doubles validation time
- Template tests have their own bugs unrelated to generation
- "We'll fix template tests later"

**Consequences:**
- Users run `npm test` and get failures on fresh project
- Erodes trust: "If tests fail out of the box, what else is broken?"
- Template test bugs persist indefinitely

**Prevention:**
- Validation pipeline must be: `npm ci` -> `npm run build` -> `npm test`
- Generated project tests should pass with zero configuration
- Include test validation in "minimum viable test" for PRs

**Which phase should address:** Phase 2 (Core Validation Pipeline) - Pipeline definition must include test execution.

---

### Pitfall 7: Generated Project Tests Require External Services

**What goes wrong:** Generated project templates include tests that call real AWS services or require running databases. Validation fails without AWS credentials or Docker.

**Why it happens:**
- Template authors write integration tests for realistic scenarios
- Local development has AWS credentials configured
- "Just mock it in CI" - but validation needs to test the actual template

**Consequences:**
- Cannot validate generated projects without AWS credentials
- CI needs secrets, which complicates PR testing from forks
- Tests are slow and flaky due to network dependencies

**Warning signs:**
- Generated projects have tests importing `@aws-sdk/*`
- Tests timeout without clear error messages
- CI requires AWS credentials in environment

**Prevention:**
- Generated project tests must be self-contained by default
- Integration tests that need external services should be in separate script
- Use `@aws-sdk/client-*-mock` or similar for AWS SDK testing
- Template tests should mock all external dependencies

**Which phase should address:** Phase 2 (Core Validation Pipeline) - Validate that template tests don't require external services.

---

### Pitfall 8: Ignoring Platform-Specific Build Differences

**What goes wrong:** Tests run on Ubuntu CI but generated mobile projects need macOS for iOS builds. React Native has platform-specific native dependencies that fail silently.

**Why it happens:**
- CI defaults to Linux for cost/speed
- Web and API projects work fine on Linux
- Mobile "builds" in CI only validates TypeScript, not native code
- Expo/React Native hides platform issues until actual device build

**Consequences:**
- "Mobile" configuration appears tested but iOS builds fail
- False confidence in mobile platform support
- Users discover issues only when building for App Store

**Warning signs:**
- CI only uses `ubuntu-latest`
- Mobile project validation skips native build steps
- No macOS CI job for iOS validation
- Tests pass but users report Xcode build failures

**Prevention:**
- For full validation: Use macOS runner for mobile configurations
- For PR tier: At minimum validate TypeScript compiles, document limitation
- Consider Expo CI for React Native validation without full native builds
- Explicitly document what "mobile validation" covers and doesn't cover

**Which phase should address:** Phase 4 (CI Integration) - CI matrix must address platform requirements.

---

### Pitfall 9: Test Isolation Failures from Shared State

**What goes wrong:** Tests modify global state (env vars, working directory, npm cache) and don't restore it. Tests pass in isolation but fail when run together or in different order.

**Why it happens:**
- `process.chdir()` changes working directory globally
- Environment variables set in one test persist to next
- npm cache from one generated project pollutes another
- Jest runs tests in parallel by default

**Consequences:**
- Tests pass with `--runInBand` but fail in parallel
- Order-dependent test failures
- "Works locally, fails in CI" due to different parallelization

**Warning signs:**
- Tests use `process.chdir()` without restoration
- Tests set `process.env.X` without cleanup
- Random failures when running full suite vs individual test
- Adding `--runInBand` to CI "fixes" flakiness

**Prevention:**
```typescript
// Save and restore working directory
const originalCwd = process.cwd();
afterEach(() => process.chdir(originalCwd));

// Save and restore env vars
const originalEnv = { ...process.env };
afterEach(() => {
  process.env = originalEnv;
});
```
- Run tests in isolated processes when they modify global state
- Use Jest's `--isolatedModules` for env-dependent tests

**Which phase should address:** Phase 1 (Test Harness Foundation) - Test utilities must enforce isolation.

---

### Pitfall 10: Hardcoded Paths Breaking Cross-Platform Tests

**What goes wrong:** Tests use Unix-style paths (`/tmp/test`) or assume specific directory structures. Tests fail on Windows or when run from different working directories.

**Why it happens:**
- Developers work on macOS/Linux, forget Windows exists
- Path separators hardcoded as `/`
- Absolute paths reference developer's machine structure
- Template paths use wrong separator

**Consequences:**
- Tests fail on Windows CI runners
- Contributors on Windows can't run tests locally
- Path assertions fail due to separator differences

**Warning signs:**
- Paths constructed with string concatenation instead of `path.join()`
- Tests reference `/tmp` or `C:\` directly
- No Windows CI job
- Test assertions compare paths as strings

**Prevention:**
```typescript
// Always use path module
const testDir = path.join(os.tmpdir(), 'test-project');

// Normalize paths before comparison
expect(path.normalize(actual)).toBe(path.normalize(expected));

// Use path.sep for separator-aware comparisons
```

**Which phase should address:** Phase 1 (Test Harness Foundation) - Path handling must be cross-platform from start.

---

## Minor Pitfalls

Mistakes that cause annoyance but are fixable without major rework.

### Pitfall 11: Verbose Test Output Obscuring Failures

**What goes wrong:** Validation tests log entire npm install output, TypeScript errors, and generated file contents. Actual failure reason is buried in thousands of lines.

**Prevention:**
- Capture output but only display on failure
- Summarize: "npm install: 342 packages in 45s" not full log
- Extract and highlight actual error messages

**Which phase should address:** Phase 3 (Local Test Runner) - Output formatting for developer experience.

---

### Pitfall 12: No Timeout Per Validation Step

**What goes wrong:** Test has 5-minute overall timeout, but `npm install` hangs for 4 minutes before failing. Actual build never runs, timeout error gives no clue which step failed.

**Prevention:**
- Set timeouts per step: install (3min), build (2min), test (2min)
- Log which step is starting/completing
- On timeout, report which step was executing

**Which phase should address:** Phase 2 (Core Validation Pipeline) - Step timeouts in pipeline runner.

---

### Pitfall 13: Regenerating Entire Project on Each Test Run

**What goes wrong:** Every test generates a fresh project from scratch, even when testing unrelated functionality. Test suite takes 20 minutes when it could take 2.

**Prevention:**
- Cache generated project fixtures for read-only tests
- Only regenerate when template files change
- Separate "generation tests" from "generated project tests"

**Which phase should address:** Phase 5 (Optimization) - After basic pipeline works, optimize for speed.

---

### Pitfall 14: Missing Configuration Name in Error Messages

**What goes wrong:** CI reports "Test failed" without specifying which of 14 configurations failed. Developer must dig through logs to find `web-mobile-cognito` was the culprit.

**Prevention:**
- Include configuration name in test description
- Structure CI output by configuration
- Summary at end listing passed/failed configs

**Which phase should address:** Phase 4 (CI Integration) - CI workflow output formatting.

---

## Phase-Specific Warnings

| Phase | Likely Pitfall | Mitigation |
|-------|---------------|------------|
| Test Harness Foundation | Temp directory cleanup failures | Use unique dirs with finally-block cleanup |
| Test Harness Foundation | Testing tokens not output | Include real generation + build in harness |
| Core Validation Pipeline | npm install timeouts | Design caching strategy, set step timeouts |
| Core Validation Pipeline | Skipping test execution | Pipeline must run npm test, not just build |
| Local Test Runner | Test isolation failures | Enforce cwd/env restoration in utilities |
| Local Test Runner | Missing tiered config strategy | Define PR tier vs release tier upfront |
| CI Integration | Node version mismatches | Read version from generated project |
| CI Integration | Platform-specific failures | macOS runner for mobile, document gaps |
| Optimization | Premature optimization | Get correctness first, then speed |

---

## Sources

Research based on:
- [Yeoman Testing Guidelines](https://yeoman.io/authoring/testing) - Generator testing patterns
- [GitHub Actions Limits](https://docs.github.com/en/actions/reference/limits) - CI resource constraints
- [Nx Blog: Reliable CI](https://nx.dev/blog/reliable-ci-a-new-execution-model-fixing-both-flakiness-and-slowness) - Flaky test analysis
- [npm Documentation](https://docs.npmjs.com/cli/v8/commands/npm-install-ci-test/) - npm ci behavior
- [GitHub Community: npm ci issues](https://github.com/orgs/community/discussions/162536) - npm install performance problems
- [Medium: Node.js CI/CD Failures](https://medium.com/@Adekola_Olawale/fixing-common-build-failures-in-node-js-ci-cd-pipelines-21805028d479) - Environment differences
- [node-tmp GitHub](https://github.com/raszi/node-tmp) - Temp directory cleanup patterns
- [Create React App CI Issues](https://github.com/facebook/create-react-app/issues/7845) - CI environment variable behavior
- [Matrix Testing Guide](https://yrkan.com/blog/matrix-testing-in-ci-cd-pipelines/) - Configuration matrix best practices

**Confidence:** MEDIUM - Based on general CLI generator testing patterns and documented CI issues. Specific pitfalls for Nx monorepo generation may vary.
