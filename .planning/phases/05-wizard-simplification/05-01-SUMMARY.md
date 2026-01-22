---
phase: 05-wizard-simplification
plan: 01
subsystem: cli
tags: [wizard, prompts, refactor]

# Dependency graph
requires:
  - phase: 04-cli-infrastructure-command-routing
    provides: CLI command routing infrastructure
provides:
  - Simplified 7-prompt wizard for project scaffolding
  - Wizard focused on core project setup only
affects: [05-02, 06-setup-aws-envs]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Wizard only handles project scaffolding, AWS setup deferred to commands"

key-files:
  created: []
  modified:
    - src/wizard.ts
    - src/__tests__/wizard.spec.ts

key-decisions:
  - "Remove AWS Organizations from wizard - moved to setup-aws-envs command"
  - "7 prompts: projectName, platforms, authProvider, authFeatures, features, awsRegion, brandColor"

patterns-established:
  - "Wizard returns minimal ProjectConfig without org field"

# Metrics
duration: 3min
completed: 2026-01-22
---

# Phase 5 Plan 01: Remove Org Prompts Summary

**Simplified wizard from 15 to 7 prompts by removing AWS Organizations configuration - org setup deferred to setup-aws-envs command**

## Performance

- **Duration:** 3 min
- **Started:** 2026-01-22T00:00:00Z
- **Completed:** 2026-01-22T00:03:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Removed 8 AWS Organizations prompts from wizard.ts
- Removed org-structure.js imports and OrgConfig type references
- Removed org config processing logic (25+ lines)
- Updated test expectations from 15 to 7 prompts
- All 71 tests pass

## Task Commits

Each task was committed atomically:

1. **Task 1: Remove org prompts and processing from wizard.ts** - `5c266d9` (refactor)
2. **Task 2: Update wizard test expectations** - `465336d` (test)

## Files Created/Modified

- `src/wizard.ts` - Simplified to 7 prompts, removed org processing logic
- `src/__tests__/wizard.spec.ts` - Updated test to expect 7 prompts

## Decisions Made

- **Wizard scope:** Only project scaffolding prompts remain (name, platforms, auth, features, region, theme)
- **Org setup deferred:** AWS Organizations configuration moves to setup-aws-envs command (Phase 6)
- **Config structure:** ProjectConfig returned without org field

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - straightforward removal of org-related code.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Wizard simplified and ready for config file generation (05-02)
- Downstream commands (setup-aws-envs) will handle AWS Organizations setup
- No blockers

---
*Phase: 05-wizard-simplification*
*Completed: 2026-01-22*
