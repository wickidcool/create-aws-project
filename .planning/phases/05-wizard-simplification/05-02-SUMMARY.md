---
phase: 05-wizard-simplification
plan: 02
subsystem: cli
tags: [wizard, config-file, json, next-steps]

# Dependency graph
requires:
  - phase: 04-cli-infrastructure-command-routing
    provides: command routing infrastructure
provides:
  - Simplified wizard without AWS Organizations setup
  - .aws-starter-config.json generation for downstream commands
  - Post-wizard setup-aws-envs guidance
affects: [06-setup-aws-envs, 07-initialize-github]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Config file generation for inter-command communication
    - JSON config at .aws-starter-config.json

key-files:
  created: []
  modified:
    - src/cli.ts

key-decisions:
  - "Config file uses JSON format with configVersion for future compatibility"
  - "Empty accounts object populated by setup-aws-envs command"
  - "setup-aws-envs guidance appears inline after platform commands"

patterns-established:
  - "Config file pattern: wizard writes, downstream commands read/update"
  - "AwsStarterConfig interface defines shared config structure"

# Metrics
duration: 2min
completed: 2026-01-22
---

# Phase 5 Plan 02: Simplify Wizard CLI Summary

**Wizard now generates .aws-starter-config.json for downstream commands, no longer attempts AWS Organizations setup**

## Performance

- **Duration:** 2 min
- **Started:** 2026-01-22T04:22:37Z
- **Completed:** 2026-01-22T04:24:43Z
- **Tasks:** 3
- **Files modified:** 1

## Accomplishments
- Removed AWS Organizations imports and setup logic from cli.ts (96 lines deleted)
- Added AwsStarterConfig interface and writeConfigFile function
- Config file written to generated project as .aws-starter-config.json
- Post-wizard next steps now include setup-aws-envs guidance

## Task Commits

Each task was committed atomically:

1. **Task 1: Remove AWS Organizations setup from cli.ts** - `3289479` (refactor)
2. **Task 2: Add config file generation to cli.ts** - `128b77d` (feat)
3. **Task 3: Update printNextSteps with setup-aws-envs guidance** - `c5c98fd` (feat)

## Files Created/Modified
- `src/cli.ts` - Removed organizations.js imports, added writeConfigFile, updated printNextSteps

## Decisions Made
- Config file uses configVersion: "1.0" for future compatibility
- accounts object starts empty, populated by setup-aws-envs command
- setup-aws-envs guidance appears inline in next steps (not prominent section)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Wizard simplification complete
- setup-aws-envs command can now read .aws-starter-config.json
- initialize-github command will also consume config file
- Phase 6 (setup-aws-envs) ready to implement

---
*Phase: 05-wizard-simplification*
*Completed: 2026-01-22*
