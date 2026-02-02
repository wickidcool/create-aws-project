---
phase: 16-fixes-and-git-setup
plan: 01
subsystem: cli
tags: [cli, wizard, typescript, prompts]

# Dependency graph
requires:
  - phase: 05-wizard-simplification
    provides: runWizard and prompts module structure
provides:
  - CLI argument passthrough to wizard defaultName
  - Corrected package name references in all user-facing documentation
affects: [user-experience, documentation, onboarding]

# Tech tracking
tech-stack:
  added: []
  patterns: [WizardOptions interface for extensibility]

key-files:
  created: []
  modified:
    - src/wizard.ts
    - src/cli.ts
    - templates/root/README.md

key-decisions:
  - "Use WizardOptions interface for wizard configuration"
  - "Extract first non-flag CLI arg as project name"
  - "Preserve IAM ManagedBy tags for v1.5.0 compatibility"

patterns-established:
  - "WizardOptions pattern: Optional configuration via interface for extensibility"
  - "Non-mutating prompt customization: Spread and override instead of mutating module exports"

# Metrics
duration: 2min
completed: 2026-02-02
---

# Phase 16 Plan 01: CLI Fixes Summary

**CLI argument handling now passes project name from `npx create-aws-project <name>` to wizard; all user-facing docs updated to show correct package name**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-02T03:23:42Z
- **Completed:** 2026-02-02T03:25:45Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Fixed CLI argument handling: `npx create-aws-project my-app` now pre-fills "my-app" in wizard
- Corrected all 9 package name references from `create-aws-starter-kit` to `create-aws-project` in help text and banner
- Updated generated project README template to link to correct npm package
- Preserved backward compatibility with IAM tag values from v1.5.0

## Task Commits

Each task was committed atomically:

1. **Task 1: Pass CLI name argument through to wizard prompt** - `9eb7232` (feat)
2. **Task 2: Fix stale package name references in help text, banner, and template README** - `6957966` (fix)

## Files Created/Modified
- `src/wizard.ts` - Added WizardOptions interface, defaultName parameter, local namePrompt variable
- `src/cli.ts` - Extract CLI name argument and pass to wizard; updated help/banner/examples to show create-aws-project
- `templates/root/README.md` - Updated npm package documentation URL

## Decisions Made

**WizardOptions interface approach:**
- Created extensible interface for future wizard configuration
- Avoided mutating module-level exports (spread pattern for prompt customization)
- Rationale: Clean architecture, prevents side effects

**First non-flag argument extraction:**
- Used `args.find(arg => !arg.startsWith('-'))` to extract project name
- Rationale: Simple, matches standard CLI conventions (e.g., `npm install <package>`)

**IAM tag preservation:**
- Kept `ManagedBy: create-aws-starter-kit` tags in src/aws/iam.ts
- Rationale: Backward compatibility - enables idempotent adoption of IAM users created by v1.5.0

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## Next Phase Readiness

- CLI argument handling and documentation now correct for v1.5.1 release
- Ready for git setup feature implementation (next plan)
- All existing tests still passing (118/118)

---
*Phase: 16-fixes-and-git-setup*
*Completed: 2026-02-02*
