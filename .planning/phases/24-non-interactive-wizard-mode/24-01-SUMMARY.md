---
phase: 24-non-interactive-wizard-mode
plan: 01
subsystem: config
tags: [zod, json-schema, validation, non-interactive, cli, typescript]

# Dependency graph
requires:
  - phase: 23-fix-wizard-defaults
    provides: ProjectConfig type and validateProjectName() utility already in place
provides:
  - Zod v4 schema (NonInteractiveConfigSchema) for JSON config file validation
  - loadNonInteractiveConfig() function returning fully-formed ProjectConfig
  - 14 unit tests covering defaults, validation errors, auth normalization, file errors
  - zod@4.3.6 added as runtime dependency
affects: [24-02, 24-cli-wiring, 25-non-interactive-setup-aws-envs]

# Tech tracking
tech-stack:
  added: [zod@4.3.6]
  patterns:
    - "Zod safeParse() for all-errors-at-once validation (not throwing parse())"
    - "as const tuple pattern for Zod enum compatibility"
    - "Schema as single source of truth for valid values and defaults"
    - "Separate validateProjectName() call for npm package name rules beyond Zod schema"

key-files:
  created:
    - src/config/non-interactive.ts
    - src/__tests__/config/non-interactive.spec.ts
  modified:
    - package.json
    - package-lock.json

key-decisions:
  - "Use z.object() (not z.strictObject()) - strip unknown keys silently, not an error"
  - "Silently drop authFeatures when auth is none, not an error - no-op for automation pipelines"
  - "Validate name with both Zod .min(1) AND validateProjectName() - Zod catches empty/missing, npm validator catches invalid package names like UPPERCASE"
  - "Use z.enum(VALID_REGIONS) not z.string().refine() - simpler, better error messages"
  - "Resolve config path relative to process.cwd() not __dirname"

patterns-established:
  - "TDD Red-Green: write failing tests first (14 cases), then implement to pass all"
  - "picocolors mock pattern: jest.unstable_mockModule with identity functions"
  - "Temp file pattern: os.tmpdir() + Date.now() + random suffix for unique per-test files"
  - "process.exit mock: throw Error('process.exit called') so tests can catch it"

# Metrics
duration: 2min
completed: 2026-02-18
---

# Phase 24 Plan 01: Non-Interactive Config Schema Summary

**Zod v4 schema + loader for JSON config files: validates all fields in one pass, applies NI-04 defaults (platforms web+api, auth none, region us-east-1, brandColor blue), and returns a typed ProjectConfig**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-18T19:55:04Z
- **Completed:** 2026-02-18T19:56:55Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Installed zod@4.3.6 as runtime dependency (Zod v4 stable, not v3)
- Created `src/config/non-interactive.ts` exporting `NonInteractiveConfigSchema` and `loadNonInteractiveConfig()`
- All 14 tests pass with full coverage of defaults, validation errors, auth normalization, file errors, and npm name validation
- Full test suite passes (160 tests total), TypeScript compiles clean

## Task Commits

Each task was committed atomically:

1. **Task 1: Install zod and write failing tests** - `e944c50` (test)
2. **Task 2: Implement config schema and loader** - `c9cc989` (feat)

_Note: TDD plan - test commit produced RED phase, feat commit produced GREEN phase._

## Files Created/Modified

- `src/config/non-interactive.ts` - Zod schema + loader; exports NonInteractiveConfigSchema and loadNonInteractiveConfig()
- `src/__tests__/config/non-interactive.spec.ts` - 14 unit tests covering all must-have truths
- `package.json` - Added zod@4.3.6 to dependencies
- `package-lock.json` - Updated lockfile

## Decisions Made

- **z.object() over z.strictObject():** Unknown top-level JSON keys are stripped silently, not errors. Copying from other configs or schema evolution should not break automation pipelines.
- **Silent authFeatures drop when auth=none:** Contradictory but harmless; wizard prevents this via conditional prompt, JSON config cannot. Producing an error would be too strict.
- **Dual name validation:** Zod catches empty string (`min(1)`), `validateProjectName()` catches invalid npm package names (uppercase, special chars). Both needed because Zod doesn't know npm naming rules.
- **z.enum(VALID_REGIONS) over z.string().refine():** Simpler, produces cleaner error messages, TypeScript infers literal union type automatically.

## Deviations from Plan

None - plan executed exactly as written. The one minor adaptation: the plan noted `{ error: 'name is required' }` might need to be `{ message: '...' }` in Zod v4 - confirmed `message` is the correct key; used it directly.

## Issues Encountered

- `--testPathPattern` flag was replaced by `--testPathPatterns` in Jest 30 (note the 's'). Adapted the run command immediately without any test impact.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `loadNonInteractiveConfig()` is fully implemented and tested; ready to wire into `cli.ts` via `--config` flag detection in `runCreate()`
- The `NonInteractiveConfigSchema` can be re-exported or referenced for documentation of accepted config fields
- No blockers for Plan 02 (CLI wiring)

---
*Phase: 24-non-interactive-wizard-mode*
*Completed: 2026-02-18*
