---
phase: 19-idempotent-setup-improvements
plan: 01
subsystem: infra
tags: [aws, organizations, idempotency, setup, cli]

# Dependency graph
requires:
  - phase: 18-architecture-simplification
    provides: "Simplified setup-aws-envs with credential storage"
provides:
  - "Pre-flight AWS account discovery before prompting"
  - "Conditional email collection based on existing accounts"
  - "listOrganizationAccounts function with pagination"
  - "Idempotent account setup that skips existing resources"
affects: [20-complete-idempotency, testing, documentation]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Pre-flight discovery pattern", "Conditional prompting based on AWS state", "Config sync with AWS as source of truth"]

key-files:
  created: []
  modified: ["src/aws/organizations.ts", "src/commands/setup-aws-envs.ts"]

key-decisions:
  - "AWS Organizations ListAccounts API is source of truth for existing accounts"
  - "Match accounts by name pattern ({projectName}-{env}) not by config alone"
  - "Warn when config has accounts not found in AWS"
  - "Sync config with discovered accounts immediately after discovery"

patterns-established:
  - "Pre-flight discovery: Query AWS state before prompting user"
  - "Conditional prompting: Only ask for data that's actually needed"
  - "Source of truth: AWS API state takes precedence over config file"

# Metrics
duration: 2min
completed: 2026-02-11
---

# Phase 19 Plan 01: Idempotent Account Discovery Summary

**setup-aws-envs discovers existing AWS accounts via Organizations API before prompting, only collecting emails for accounts that need creation**

## Performance

- **Duration:** 2 minutes
- **Started:** 2026-02-11T17:28:56Z
- **Completed:** 2026-02-11T17:31:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Added listOrganizationAccounts function with automatic pagination handling
- Integrated pre-flight account discovery after organization check
- Made email collection conditional based on which environments need creation
- Config syncs with AWS state (discovered accounts update config immediately)
- Zero email prompts when all accounts already exist in AWS

## Task Commits

Each task was committed atomically:

1. **Task 1: Add listOrganizationAccounts to organizations.ts** - `5064129` (feat)
2. **Task 2: Integrate pre-flight discovery and conditional prompting into setup-aws-envs** - `291a73b` (feat)

## Files Created/Modified
- `src/aws/organizations.ts` - Added listOrganizationAccounts function with pagination (do-while loop, NextToken handling)
- `src/commands/setup-aws-envs.ts` - Pre-flight discovery, conditional email collection, merged account state from AWS + config

## Decisions Made

**1. AWS Organizations API as source of truth**
- Rationale: Config can become stale if accounts created outside CLI. AWS state is authoritative.
- Implementation: listOrganizationAccounts called after org check, before email collection

**2. Name pattern matching for account discovery**
- Pattern: `{projectName}-{env}` (e.g., "my-app-dev")
- Rationale: Account names are immutable, predictable, and set by this CLI during creation

**3. Config sync after discovery**
- Behavior: Discovered accounts update config immediately, even if no new accounts created
- Rationale: Keeps config in sync with AWS reality, handles manual account creation

**4. Warning (not error) for config-only accounts**
- Behavior: Warn if config has account that's not found in AWS Organization
- Rationale: Non-blocking - allows recovery if account was removed from org

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - implementation followed plan precisely, TypeScript compilation and build succeeded without issues.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

**Ready for Phase 19 Plan 02 (deployment user/credential idempotency):**
- Account discovery pattern established and working
- listOrganizationAccounts provides reusable pagination pattern
- Config sync pattern established (updateConfig after discovery)

**Implementation notes for 19-02:**
- Extend discovery pattern to IAM users (ListUsers) and access keys (ListAccessKeys)
- Follow same conditional logic: discover existing → filter needed → prompt/create only missing
- Reuse merged state pattern: AWS discovered + config existing → final accounts/users/credentials

**No blockers or concerns.**

---
*Phase: 19-idempotent-setup-improvements*
*Completed: 2026-02-11*
