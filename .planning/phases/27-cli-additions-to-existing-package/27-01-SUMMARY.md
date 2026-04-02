---
phase: 27-cli-additions-to-existing-package
plan: 01
subsystem: cli
tags: [typescript, esm, process-exit, named-export, mcp, zod, jest]

# Dependency graph
requires:
  - phase: 26-package-foundation-and-safety-infrastructure
    provides: MCP package scaffold and withCliContext safety utilities
provides:
  - Exported runSetupAwsEnvsNonInteractive function accepting parsed config object
  - SetupAwsEnvsNonInteractiveConfig type exported from package entry point
  - isMainModule guard in src/index.ts preventing CLI auto-run on library import
  - Unit test suite proving process.exit-free contract
affects:
  - 27-02 (runInitializeGitHubNonInteractive follows same pattern)
  - 28-mcp-tool-handlers (imports runSetupAwsEnvsNonInteractive from create-aws-project)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "isMainModule guard: import.meta.url check prevents CLI from running when module is imported as library"
    - "Non-interactive function pattern: accepts parsed config object, throws on all error paths, no process.exit"

key-files:
  created:
    - src/__tests__/commands/setup-aws-envs-non-interactive.spec.ts
  modified:
    - src/commands/setup-aws-envs.ts
    - src/index.ts

key-decisions:
  - "Renamed test file to .spec.ts — jest config uses testMatch: ['**/__tests__/**/*.spec.ts']"
  - "catch/re-throw for root credential detection failure instead of handleAwsError — keeps function process.exit-free"
  - "setupSuccessfulAwsMocks() helper sets fs mocks per-test — jest resetMocks:true resets mock implementations between tests"

patterns-established:
  - "Non-interactive CLI function pattern: export with interface, detectProjectContext (not requireProjectContext), throw not exit"

# Metrics
duration: 25min
completed: 2026-04-01
---

# Phase 27 Plan 01: Export runSetupAwsEnvsNonInteractive as process.exit-free named export Summary

**Refactored runSetupAwsEnvsNonInteractive to accept a parsed config object, throw on all error paths (no process.exit), and export it as a named export from create-aws-project with isMainModule guard preventing CLI auto-run on library import**

## Performance

- **Duration:** 25 min
- **Started:** 2026-04-02T04:08:34Z
- **Completed:** 2026-04-02T04:33:00Z
- **Tasks:** 2
- **Files modified:** 3 (2 src, 1 new test)

## Accomplishments

- `runSetupAwsEnvsNonInteractive` exported from `src/commands/setup-aws-envs.ts` and re-exported from `src/index.ts`
- Function accepts `SetupAwsEnvsNonInteractiveConfig` object (email field), validates with Zod inline, throws on invalid input
- All `process.exit()` and `handleAwsError()` calls replaced with `throw error` throughout the function body
- `runInitializeGitHub` call removed — AWS setup only, callers handle GitHub separately
- `isMainModule` guard added to `src/index.ts` so `import { runSetupAwsEnvsNonInteractive } from 'create-aws-project'` does not trigger CLI
- 7 unit tests prove the process.exit-free contract, including invalid config, missing context, successful run, and AWS error paths

## Task Commits

Each task was committed atomically:

1. **Task 1: Refactor runSetupAwsEnvsNonInteractive to be export-safe** - `7f25009` (feat)
2. **Task 2: Add unit tests for refactored runSetupAwsEnvsNonInteractive** - `fc43845` (test)

**Plan metadata:** (see below — docs commit)

## Files Created/Modified

- `src/commands/setup-aws-envs.ts` - Added `SetupAwsEnvsNonInteractiveConfig` interface, refactored function signature and body, replaced all process.exit/handleAwsError with throw, removed runInitializeGitHub call
- `src/index.ts` - Added named exports + isMainModule guard replacing unconditional `run()` call
- `src/__tests__/commands/setup-aws-envs-non-interactive.spec.ts` - New test file with 7 unit tests covering all must-have truths

## Decisions Made

- **Renamed test file to `.spec.ts`** — jest config uses `testMatch: ['**/__tests__/**/*.spec.ts']`; the plan said `.test.ts` but the project pattern is `.spec.ts`. Used `.spec.ts` to match existing convention.
- **`setupSuccessfulAwsMocks()` sets fs mocks per-test** — `jest resetMocks: true` in jest.config resets mock implementations between tests, so `readFileSync` mock needs to be re-initialized in each test that does file I/O.
- **catch/re-throw for root credential detection** instead of the original `handleAwsError(error)` — preserves error propagation without process.exit.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Test file extension mismatch**

- **Found during:** Task 2 (running tests)
- **Issue:** Plan specified `.test.ts` but jest.config `testMatch` only runs `.spec.ts` files — tests would be silently skipped
- **Fix:** Renamed file from `.test.ts` to `.spec.ts`
- **Files modified:** `src/__tests__/commands/setup-aws-envs-non-interactive.spec.ts`
- **Verification:** Tests appeared in test run (178 total vs 171 before)
- **Committed in:** fc43845 (Task 2 commit)

**2. [Rule 1 - Bug] TypeScript type error in process.exit spy**

- **Found during:** Task 2 (build/type-check)
- **Issue:** `mockImplementation(... as (code?: number) => never)` failed because `process.exit` accepts `string | number | null | undefined` in newer @types/node
- **Fix:** Changed cast to `as typeof process.exit` with eslint `any` annotation
- **Files modified:** `src/__tests__/commands/setup-aws-envs-non-interactive.spec.ts`
- **Verification:** TypeScript compiled without errors
- **Committed in:** fc43845 (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (2 bugs)
**Impact on plan:** Both necessary for correctness. No scope creep.

## Issues Encountered

- `jest resetMocks: true` in jest.config clears mock implementations between tests, requiring the `node:fs` mock functions to be exposed as top-level variables and configured per-test in `setupSuccessfulAwsMocks()`.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `runSetupAwsEnvsNonInteractive` is importable as `import { runSetupAwsEnvsNonInteractive } from 'create-aws-project'`
- Phase 27-02 can follow identical pattern for `runInitializeGitHubNonInteractive`
- Phase 28 MCP tool handlers can import and call the function without risk of process.exit killing the MCP server

---
*Phase: 27-cli-additions-to-existing-package*
*Completed: 2026-04-01*
