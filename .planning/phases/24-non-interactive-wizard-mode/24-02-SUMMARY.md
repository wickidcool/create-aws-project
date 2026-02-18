---
phase: 24-non-interactive-wizard-mode
plan: 02
subsystem: cli
tags: [cli, non-interactive, config-flag, typescript, automation]

# Dependency graph
requires:
  - phase: 24-01
    provides: loadNonInteractiveConfig() function and NonInteractiveConfigSchema already implemented and tested
provides:
  - --config flag detection in runCreate() routing to non-interactive path
  - runNonInteractive() function: loads config, creates dir, generates project, skips git setup (NI-06)
  - Complete end-to-end non-interactive mode: npx create-aws-project --config project.json
  - Phase 24 success criteria SC-1 through SC-4 verified
affects: [25-non-interactive-setup-aws-envs]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Flag detection inside runCreate() not run(): --config checked before nameArg extraction"
    - "Full args array passed to runCreate() so --config detection can find configPath at args[index+1]"
    - "runNonInteractive() calls loadNonInteractiveConfig, generateProject, writeConfigFile - never promptGitSetup or setupGitRepository"

key-files:
  created: []
  modified:
    - src/cli.ts

key-decisions:
  - "Detect --config inside runCreate() not run(): cleaner separation, Phase 25 can add --config to runSetupAwsEnvs() separately (as planned in 24-01)"
  - "printWelcome() called before --config check: shows banner in both interactive and non-interactive mode for consistent UX"
  - "process.exit(0) at end of runNonInteractive(): explicit exit prevents any further code execution"

patterns-established:
  - "Non-interactive function pattern: separate runNonInteractive() function called from runCreate() via early return"
  - "Flag detection pattern: findIndex + args[index+1] check for --config path argument"

# Metrics
duration: 4min
completed: 2026-02-18
---

# Phase 24 Plan 02: CLI Wiring for --config Flag Summary

**`--config project.json` flag wired into cli.ts: loads JSON config via loadNonInteractiveConfig(), generates project, skips all prompts and git setup, exits 0; missing/invalid config exits non-zero with errors**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-18T19:59:22Z
- **Completed:** 2026-02-18T20:00:57Z
- **Tasks:** 2 (Task 1: implementation, Task 2: end-to-end verification)
- **Files modified:** 1

## Accomplishments

- Added `runNonInteractive()` function to `src/cli.ts` implementing the full non-interactive create path (NI-01, NI-02, NI-06)
- Added `--config` flag detection in `runCreate()` that routes to `runNonInteractive()` before any interactive prompt code runs
- Added `--config <path>` documentation to `printHelp()` with usage example
- Verified all 4 Phase 24 success criteria end-to-end (SC-1: defaults, SC-2: full config, SC-3: invalid exits non-zero, SC-4: no git ops)
- All 160 tests pass, TypeScript compiles clean

## Task Commits

Each task was committed atomically:

1. **Task 1: Add --config detection and runNonInteractive() to cli.ts** - `2467603` (feat)
2. **Task 2: End-to-end verification** - verification only, no files changed

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `src/cli.ts` - Added import for loadNonInteractiveConfig, added runNonInteractive() function, added --config detection in runCreate(), updated printHelp()

## Decisions Made

- **printWelcome() before --config check:** Banner shows in both modes for consistent UX. The check happens immediately after the welcome print, so non-interactive mode still skips all prompts.
- **process.exit(0) in runNonInteractive():** Explicit exit at the end of the non-interactive path prevents any code path from accidentally falling through to interactive code.
- **Full args array to runCreate():** The `run()` dispatcher passes `args` (not `commandArgs`) to `runCreate()`, ensuring `--config project.json` can be found at any position in the array.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 24 is fully complete: `--config` flag works end-to-end, all success criteria verified
- Phase 25 (non-interactive setup-aws-envs, NI-07 through NI-09) can begin: the pattern for --config detection in a command function is now established
- No blockers

---
*Phase: 24-non-interactive-wizard-mode*
*Completed: 2026-02-18*
