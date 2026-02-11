---
phase: 17-root-credential-handling
plan: 02
subsystem: infra
tags: [aws, iam, sts, root-credentials, organizations, credential-switching]

# Dependency graph
requires:
  - phase: 17-01
    provides: Root credential detection module with admin user creation
provides:
  - Root detection wired into setup-aws-envs command flow
  - Automatic credential switching from root to admin IAM user
  - Admin user persistence to config for idempotent re-runs
  - Cross-account operations use admin credentials instead of root
affects: [setup-aws-envs usage, credential management, AWS setup workflow]

# Tech tracking
tech-stack:
  added: []
  patterns: [Credential switching pattern, Config persistence pattern, Conditional client creation]

key-files:
  created: []
  modified: [src/utils/project-context.ts, src/commands/setup-aws-envs.ts]

key-decisions:
  - "Root detection happens before collectEmails (before any AWS operations)"
  - "Admin credentials stored in memory for session, only userName+accessKeyId persisted to config"
  - "Organizations and cross-account IAM clients conditionally created with admin credentials"
  - "Non-root credential flow completely unchanged (no behavior change for IAM credentials)"

patterns-established:
  - "Conditional client creation: if (adminCredentials) { explicit credentials } else { default credentials }"
  - "Config persistence after admin user creation: writeFileSync immediately, not at end"
  - "fromTemporaryCredentials masterCredentials pattern for cross-account with explicit credentials"

# Metrics
duration: 2min
completed: 2026-02-11
---

# Phase 17 Plan 02: Root Credential Integration Summary

**CLI detects root credentials on setup-aws-envs start, creates admin user, switches credentials transparently, and persists admin user to config for skip-on-rerun behavior**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-11T05:10:33Z
- **Completed:** 2026-02-11T05:13:20Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Root detection integrated at start of setup-aws-envs (before collectEmails and AWS operations)
- Admin user creation and credential switching transparent to user
- Admin user info (userName + accessKeyId) persisted to config for idempotent re-runs
- Cross-account IAM clients and Organizations client conditionally use admin credentials
- Non-root credential flow completely unchanged (zero behavior change for IAM credentials)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add adminUser field to config type and update setup-aws-envs imports** - `3beb982` (feat)
2. **Task 2: Insert root detection and credential switching into setup-aws-envs flow** - `7672317` (feat)

## Files Created/Modified
- `src/utils/project-context.ts` - Added `adminUser?: { userName: string; accessKeyId: string }` to ProjectConfigMinimal interface
- `src/commands/setup-aws-envs.ts` - Integrated root detection, admin user creation, credential switching, and conditional client creation

## Decisions Made

**Root detection placement:** Inserted between existing accounts check and collectEmails. This ensures credentials are checked before any user input is collected, but after project context is validated. If credentials are missing entirely, the error is clear before prompting for emails.

**Credential persistence strategy:** Store admin credentials in memory (`adminCredentials` variable) for the current session, but only persist `userName` and `accessKeyId` to config (NOT `secretAccessKey`). The secret is only needed during the initial session when admin user is created. On re-runs, presence of `adminUser` in config signals to skip root detection entirely (user should have switched to IAM credentials or admin user exists and will be adopted).

**Conditional client creation:** Organizations and cross-account IAM clients check `if (adminCredentials)` and create clients with explicit credentials when available. When `adminCredentials` is null (non-root credentials or adminUser already in config), use existing client factory functions with default credentials. This preserves existing behavior for IAM credentials (zero breaking changes).

**fromTemporaryCredentials pattern:** For cross-account IAM operations, use `fromTemporaryCredentials({ masterCredentials: { ... }, params: { RoleArn, ... } })` to assume `OrganizationAccountAccessRole` with admin credentials as the source. Root credentials CANNOT assume this role (AWS restriction), but admin IAM user credentials CAN.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. Implementation followed the plan specifications and all tests passed on first run.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Root credential handling is complete for the setup-aws-envs command. The CLI now:
1. Detects root credentials automatically
2. Creates admin IAM user transparently
3. Switches to admin credentials for all AWS operations
4. Persists admin user info to config
5. Skips root detection on re-runs when adminUser exists

Next phase (if any) can build on this foundation. The setup-aws-envs command is now production-ready for use with both root and IAM credentials.

**Potential future enhancement:** The initialize-github command (not in scope for this milestone) could also benefit from root detection if it ever needs to perform AWS IAM operations directly. Currently initialize-github reads config and pushes to GitHub, so root detection is not needed there.

---
*Phase: 17-root-credential-handling*
*Completed: 2026-02-11*
