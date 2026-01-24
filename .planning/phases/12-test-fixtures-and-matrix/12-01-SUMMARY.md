---
phase: 12-test-fixtures-and-matrix
plan: 01
subsystem: testing
tags: [jest, typescript, fixtures, factories, test-matrix]

# Dependency graph
requires:
  - phase: 11-validation-pipeline
    provides: validateGeneratedProject function and test harness utilities
provides:
  - 14 factory functions for all platform/auth combinations
  - TEST_MATRIX with tier assignments (smoke/core/full)
  - getConfigsByTier and getConfigByName helpers
  - Comprehensive fixture tests (27 tests)
affects: [phase-13-reporting, phase-14-ci-integration]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Factory functions returning fresh ProjectConfig objects
    - Tiered test configuration (smoke: 1, core: 5, full: 14)

key-files:
  created:
    - src/__tests__/harness/fixtures/config-factories.ts
    - src/__tests__/harness/fixtures/matrix.ts
    - src/__tests__/harness/fixtures/index.ts
    - src/__tests__/harness/fixtures/fixtures.spec.ts
  modified:
    - jest.config.ts

key-decisions:
  - "Tier distribution: smoke (1), core (4), full (9) for balanced coverage vs speed"
  - "Core tier covers all 3 platforms AND both auth providers in 5 configs"
  - "Exclude auth provider 'none' from matrix (simplest path, implicitly tested)"

patterns-established:
  - "Factory pattern: each factory creates fresh ProjectConfig via createBaseConfig"
  - "Tier selection: getConfigsByTier returns cumulative configs (core includes smoke)"

# Metrics
duration: 2min 29s
completed: 2026-01-24
---

# Phase 12 Plan 01: Test Fixtures Foundation Summary

**14 typed config factories with tiered TEST_MATRIX (smoke/core/full) and 27 comprehensive fixture tests**

## Performance

- **Duration:** 2min 29s
- **Started:** 2026-01-24T06:54:44Z
- **Completed:** 2026-01-24T06:57:13Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Created 14 factory functions for all platform/auth combinations
- Defined TEST_MATRIX with 14 configurations and tier assignments
- Implemented getConfigsByTier (smoke: 1, core: 5, full: 14) and getConfigByName helpers
- Added 27 tests verifying matrix coverage, tier selection, and config validity

## Task Commits

Each task was committed atomically:

1. **Task 1: Create config factories and matrix definition** - `1495d75` (feat)
2. **Task 2: Add comprehensive test coverage** - `7d619d9` (test)

**Deviation fix:** `655acf1` (fix: jest config testMatch)

## Files Created/Modified

- `src/__tests__/harness/fixtures/config-factories.ts` - 14 factory functions for ProjectConfig
- `src/__tests__/harness/fixtures/matrix.ts` - TEST_MATRIX, TestTier type, tier helpers
- `src/__tests__/harness/fixtures/index.ts` - Public exports for fixtures module
- `src/__tests__/harness/fixtures/fixtures.spec.ts` - 27 tests for matrix and factories
- `jest.config.ts` - Added testMatch pattern

## Decisions Made

- **Tier distribution:** smoke (1), core (4), full (9) configs - core tier (5 total) covers all platforms and auth providers for PR validation
- **Project naming:** Each factory uses unique project name (e.g., 'test-web-cognito') to avoid directory collisions
- **No 'none' auth provider:** Excluded from matrix as simplest path; implicitly tested when cognito/auth0 work

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Jest treating utility modules as test suites**
- **Found during:** Verification (npm test)
- **Issue:** Jest was picking up .ts files in __tests__/harness/ as test files, causing "no tests" failures
- **Fix:** Added `testMatch: ['**/__tests__/**/*.spec.ts']` to jest.config.ts
- **Files modified:** jest.config.ts
- **Verification:** All 118 tests pass, no spurious failures
- **Committed in:** `655acf1`

---

**Total deviations:** 1 auto-fixed (blocking issue)
**Impact on plan:** Essential fix for test runner to work correctly. No scope creep.

## Issues Encountered

None - plan executed smoothly after Jest config fix.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- TEST_MATRIX ready for Phase 13 (reporting) to consume
- getConfigsByTier enables Phase 14 (CI) to run different tiers per workflow
- All 118 tests pass (91 existing + 27 new fixture tests)

---
*Phase: 12-test-fixtures-and-matrix*
*Completed: 2026-01-24*
