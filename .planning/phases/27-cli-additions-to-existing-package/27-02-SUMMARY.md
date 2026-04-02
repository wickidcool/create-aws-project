---
phase: 27-cli-additions-to-existing-package
plan: 02
subsystem: api
tags: [github, mcp, non-interactive, zod, octokit, typescript]

# Dependency graph
requires:
  - phase: 27-01
    provides: runSetupAwsEnvsNonInteractive pattern, dual-purpose index.ts, detectProjectContext throws convention
  - phase: 26-package-foundation-and-safety-infrastructure
    provides: MCP server scaffold that will consume these exports
provides:
  - runInitializeGitHubNonInteractive exported from create-aws-project package
  - InitializeGitHubConfig, InitializeGitHubResult, InitializeGitHubEnvResult types
  - Per-environment GitHub secrets initialization without prompts or process.exit
  - Unit tests proving no-prompt, env-token, per-env-status behavior
affects:
  - 28-mcp-tool-handlers (consumes runInitializeGitHubNonInteractive for initialize_github tool)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Non-interactive function reads credentials from process.env only (CRED-01)
    - Per-environment try/catch for partial failure semantics
    - Zod safeParse for config validation before any side effects
    - detectProjectContext (not requireProjectContext) + throw for MCP-safe error handling

key-files:
  created:
    - src/__tests__/commands/initialize-github-non-interactive.spec.ts
  modified:
    - src/commands/initialize-github.ts
    - src/index.ts

key-decisions:
  - "GITHUB_TOKEN read from process.env only — never accepted as parameter (CRED-01)"
  - "Per-environment try/catch ensures one env failure does not abort remaining environments"
  - "InitializeGitHubEnvResult exported separately for type reuse in MCP tool responses"

patterns-established:
  - "Non-interactive GitHub functions: read token from env, validate config with Zod, detect context with detectProjectContext, loop with individual try/catch, return structured result"

# Metrics
duration: 2min
completed: 2026-04-02
---

# Phase 27 Plan 02: CLI Additions to Existing Package Summary

**`runInitializeGitHubNonInteractive` exported from create-aws-project — reads GITHUB_TOKEN from env, calls setEnvironmentCredentials per env with individual try/catch, returns per-env success/failure status without prompts or process.exit**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-04-02T04:17:27Z
- **Completed:** 2026-04-02T04:20:24Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Added `runInitializeGitHubNonInteractive` to `src/commands/initialize-github.ts` with Zod validation, env-only token read, and per-environment try/catch loop
- Exported `runInitializeGitHubNonInteractive`, `InitializeGitHubConfig`, `InitializeGitHubResult`, `InitializeGitHubEnvResult` from `src/index.ts`
- Created 14 unit tests in `initialize-github-non-interactive.spec.ts` covering all specified behaviors; total test count rose from 178 to 192

## Task Commits

Each task was committed atomically:

1. **Task 1: Implement runInitializeGitHubNonInteractive** - `6894fd7` (feat)
2. **Task 2: Add unit tests for runInitializeGitHubNonInteractive** - `3284316` (test)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `src/commands/initialize-github.ts` - Added `InitializeGitHubConfig`, `InitializeGitHubResult`, `InitializeGitHubEnvResult` types, `InitializeGitHubConfigSchema`, and `runInitializeGitHubNonInteractive` function
- `src/index.ts` - Added named exports for `runInitializeGitHubNonInteractive` and its three types
- `src/__tests__/commands/initialize-github-non-interactive.spec.ts` - 14 unit tests proving non-interactive behavior contract

## Decisions Made

- `GITHUB_TOKEN` read from `process.env` only — never accepted as a function parameter, following CRED-01 pattern established in project
- Per-environment `try/catch` in the loop ensures one environment's GitHub API failure does not prevent the other environments from being configured — callers receive a full status report
- `InitializeGitHubEnvResult` exported as a named type to allow Phase 28 MCP tool handlers to type their responses without duplication

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed TypeScript typing on mockSetEnvironmentCredentials**

- **Found during:** Task 2 (unit tests)
- **Issue:** `jest.fn<() => Promise<void>>()` (zero-arg signature) caused TS2554 errors when `toHaveBeenCalledWith` was called with 6 arguments
- **Fix:** Changed mock type to `jest.fn<(client, owner, repo, env, accessKeyId, secretAccessKey) => Promise<void>>()` matching the actual function signature
- **Files modified:** `src/__tests__/commands/initialize-github-non-interactive.spec.ts`
- **Verification:** `npm test` passes with 192 tests
- **Committed in:** `3284316` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Trivial TypeScript mock typing fix. No scope creep.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Both non-interactive functions (`runSetupAwsEnvsNonInteractive` and `runInitializeGitHubNonInteractive`) are importable from the `create-aws-project` package
- Phase 28 (MCP tool handlers) can now import and call `runInitializeGitHubNonInteractive` for the `initialize_github` tool
- 192 tests passing, build clean

---
*Phase: 27-cli-additions-to-existing-package*
*Completed: 2026-04-02*
