---
phase: 13-reporting-local-runner
plan: 01
type: execute
subsystem: testing
tags: [e2e, reporting, validation, cli, progress-indicators]
requires:
  - phases: [12-fixtures-matrix]
    artifacts: [fixtures/index.ts, fixtures/matrix.ts, validate-project.ts]
provides:
  - local-runner.ts with runValidationSuite and tier support
  - npm scripts for E2E validation (test:e2e, test:e2e:smoke, test:e2e:full)
  - Real-time progress reporting with ora spinners
  - Summary table output with console.table
affects:
  - future-phases: [14-ci-github-actions]
    impact: "CI integration can use same runner with CI detection"
tech-stack:
  added: [tsx@^4.21.0]
  patterns:
    - "Spinner-based progress with ora (TTY detection for CI compatibility)"
    - "Console.table summary reporting"
    - "Fail-fast validation with accumulate-all reporting"
    - "Exit code signaling for CI integration"
key-files:
  created:
    - path: src/__tests__/harness/local-runner.ts
      purpose: Validation suite runner with progress and summary reporting
      exports: [runValidationSuite]
      lines: 117
  modified:
    - path: package.json
      changes: [Added tsx devDependency, Added test:e2e scripts]
    - path: src/__tests__/harness/validate-project.ts
      changes: [Fixed npm ci -> npm install, Fixed build -> build:all]
    - path: src/__tests__/harness/validate-project.spec.ts
      changes: [Updated test expectations to match validation fixes]
decisions:
  - id: LOCAL-RUNNER-CLI
    choice: Use process.argv parsing for tier selection
    rationale: Simple, direct, matches npm script pattern
    alternatives: [Commander.js, yargs]
  - id: CI-DETECTION
    choice: Detect CI via process.env.CI and process.stdout.isTTY
    rationale: Standard approach, prevents ANSI escape code pollution in CI logs
    alternatives: [ora.isEnabled, always use spinners]
  - id: NPM-INSTALL-NOT-CI
    choice: Use npm install instead of npm ci for generated projects
    rationale: Generated projects don't have package-lock.json files
    discovery: Validation smoke test revealed npm ci failure
  - id: BUILD-ALL-SCRIPT
    choice: Use npm run build:all to match Nx monorepo structure
    rationale: Generated projects use Nx run-many for multi-project builds
    discovery: Validation smoke test revealed missing 'build' script
metrics:
  tasks: 2
  commits: 3
  files-created: 1
  files-modified: 3
  duration: 4.6 minutes
  completed: 2026-01-24
---

# Phase 13 Plan 01: Local Validation Runner Summary

**One-liner:** CLI validation runner with ora spinner progress, immediate error display, and console.table summary for smoke/core/full test tiers

## What Was Built

Created a local E2E validation runner that executes the test matrix from Phase 12 with developer-friendly progress reporting:

1. **Local runner script (local-runner.ts):**
   - Runs validation suite across smoke/core/full test tiers
   - Real-time progress via ora spinner: "Testing X/N: config-name"
   - CI detection: TTY spinners in terminal, plain logging in CI
   - Immediate error output display after failures
   - Summary table with config name, status, failed step, duration
   - Exit code 0/1 for CI integration

2. **npm script integration:**
   - `npm run test:e2e` - Run core tier (default)
   - `npm run test:e2e:smoke` - Run smoke tier (1 config, quick validation)
   - `npm run test:e2e:full` - Run full tier (9 configs, comprehensive)
   - Uses tsx with --import flag for TypeScript execution

3. **Validation bug fixes:**
   - Fixed npm ci failure: Generated projects lack package-lock.json, use npm install
   - Fixed build script: Nx monorepos use build:all not build
   - Updated test expectations to match reality

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed npm ci command failing on generated projects**
- **Found during:** Task 2 smoke tier execution
- **Issue:** validate-project.ts used `npm ci` which requires package-lock.json, but generated projects don't have lockfiles
- **Fix:** Changed to `npm install` which works without lockfile
- **Files modified:** src/__tests__/harness/validate-project.ts
- **Commit:** 3913479

**2. [Rule 1 - Bug] Fixed build script name mismatch**
- **Found during:** Task 2 smoke tier execution
- **Issue:** validate-project.ts called `npm run build` but generated projects use `npm run build:all` (Nx run-many pattern)
- **Fix:** Changed to `npm run build:all`
- **Files modified:** src/__tests__/harness/validate-project.ts
- **Commit:** 3913479

**3. [Rule 1 - Bug] Updated test expectations to match validation fixes**
- **Found during:** Task 2 verification (npm test)
- **Issue:** validate-project.spec.ts expected old commands (npm ci, build)
- **Fix:** Updated test expectations to match corrected commands
- **Files modified:** src/__tests__/harness/validate-project.spec.ts
- **Commit:** 0a67740

## Decisions Made

| ID | Decision | Rationale | Alternatives |
|----|----------|-----------|--------------|
| LOCAL-RUNNER-CLI | Use process.argv parsing for tier selection | Simple, direct, matches npm script pattern. No need for full CLI framework for single argument | Commander.js (overkill), yargs (unnecessary complexity) |
| CI-DETECTION | Detect CI via process.env.CI and process.stdout.isTTY | Standard approach prevents ANSI escape code pollution in CI logs. Ora spinners animate cleanly in terminal but produce garbage in CI | ora.isEnabled (less explicit), always use spinners (breaks CI logs) |
| NPM-INSTALL-NOT-CI | Use npm install instead of npm ci | Generated projects don't have package-lock.json. npm ci requires lockfile, npm install works without | Generate package-lock.json (adds generated file), keep npm ci (breaks validation) |
| BUILD-ALL-SCRIPT | Use npm run build:all | Matches what generator actually creates (Nx run-many pattern). build:all builds all packages in monorepo | Add 'build' alias (redundant), change generator (unnecessary) |

## Results

**Commits:**
- `b2bc2a3` - feat(13-01): create local runner with spinner progress and summary table
- `3913479` - feat(13-01): add npm scripts and fix validation command issues
- `0a67740` - fix(13-01): update test expectations for validation command changes

**Files:**
- Created: src/__tests__/harness/local-runner.ts (117 lines)
- Modified: package.json, package-lock.json, src/__tests__/harness/validate-project.ts, src/__tests__/harness/validate-project.spec.ts

**Verification:**
- ✅ TypeScript compiles without errors (npm run build)
- ✅ All 118 unit tests pass (npm test)
- ✅ Smoke tier executes and reports failures (npm run test:e2e:smoke)
- ✅ Progress displays "Testing 1/1: web-api-cognito" format
- ✅ Error output displayed immediately after failure
- ✅ Summary table shows config/status/failedStep/duration
- ✅ Exit code 1 on validation failure

## Known Issues

**Template TypeScript Errors Discovered:**

The validation runner successfully detected TypeScript compilation errors in generated project templates (web-api-cognito smoke tier):

1. **TS4111 index signature errors:** Multiple files accessing properties via dot notation that TypeScript requires bracket notation for index signatures
2. **Missing aws-amplify dependency:** web app imports aws-amplify but package.json lacks dependency
3. **Missing amplifyConfig export:** web/src/config/amplify-config.ts doesn't export amplifyConfig

**Status:** These are **generator template bugs**, not validation runner bugs. The local runner correctly detected and reported them. These issues should be tracked separately and fixed in a future phase focused on template quality.

**Impact:** Current validation suite will fail on all configurations until template bugs are fixed. This is expected and demonstrates validation is working correctly.

## Integration Points

**Phase 12 (Test Fixtures) → Phase 13:**
- ✅ getConfigsByTier() provides test matrix
- ✅ TestTier type defines smoke/core/full
- ✅ validateGeneratedProject() executes validation steps
- ✅ ValidationResult provides structured success/failure data

**Phase 13 → Phase 14 (CI Integration):**
- ✅ CI detection built-in (process.env.CI check)
- ✅ Exit code signaling ready (process.exit(0/1))
- ✅ Plain text logging in CI mode (no spinner animations)
- ✅ Same runner script works in both local and CI contexts

## Next Phase Readiness

**Ready for Phase 14 (CI GitHub Actions):**
- ✅ local-runner.ts is CI-compatible
- ✅ npm run test:e2e can be called from GitHub Actions workflow
- ⚠️ Template bugs must be fixed before CI can pass validation

**Prerequisites for success:**
1. Fix template TypeScript errors (TS4111 index signature issues)
2. Add missing aws-amplify dependency to web app template
3. Export amplifyConfig from web/src/config/amplify-config.ts
4. Re-run smoke tier to verify fixes

**Recommendation:** Create a quick bugfix phase (13-02 or standalone) to address template issues before proceeding to CI integration. Otherwise Phase 14 CI will always fail validation.

## Performance

**Execution time:** 4.6 minutes (start to final commit)

**Validation performance (smoke tier):**
- Install step: ~44s (npm install with all dependencies)
- Build step: ~24s (TypeScript compilation, failed due to template errors)
- Total per config: ~68s

**Projection:**
- Smoke tier (1 config): ~1 minute
- Core tier (4 configs): ~4-5 minutes
- Full tier (9 configs): ~10-12 minutes

## Lessons Learned

**1. E2E tests reveal integration gaps unit tests miss**

Unit tests mocked runCommand so they couldn't catch npm ci vs npm install mismatch. Running actual smoke tier immediately revealed the issue. Always run E2E smoke test before marking validation "complete."

**2. Generated artifacts != assumptions**

Validation assumed npm ci and npm run build would work based on typical Node.js projects. Generated Nx monorepo has different patterns (build:all, no lockfile). Check actual generator output before writing validation.

**3. CI detection is critical for log quality**

Spinner animations produce hundreds of lines of ANSI escape codes in CI logs. Detecting TTY and using plain logging in CI keeps logs readable. This pattern should be default for all CLI progress tools.

**4. Immediate error output > batched summaries**

Displaying error output right after failure (not waiting for end) lets developers start investigating while remaining tests run. Better DX than forcing them to wait for full suite completion before seeing any details.

---

**Duration:** 4.6 minutes
**Status:** Complete
**Next:** Fix template TypeScript errors before Phase 14
