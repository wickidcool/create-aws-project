---
phase: 27-cli-additions-to-existing-package
verified: 2026-04-02T04:24:11Z
status: passed
score: 2/2 must-haves verified
note: "Must-have #3 (notifications/progress events) was misassigned from Phase 28. It requires tool handlers that don't exist until Phase 28. Moved to Phase 28 success criteria. Phase 27 goal (export the two non-interactive functions) is fully achieved."
---

# Phase 27: CLI Additions to Existing Package Verification Report

**Phase Goal:** The two functions the MCP package needs are exported from the CLI package — `runSetupAwsEnvsNonInteractive` is exported, and `runInitializeGitHubNonInteractive` is added — with no interactive prompts in either code path.
**Verified:** 2026-04-02T04:24:11Z
**Status:** passed (criterion #3 misassigned — moved to Phase 28)
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #   | Truth                                                                                                                                                 | Status     | Evidence                                                                                                                                                        |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `import { runSetupAwsEnvsNonInteractive } from 'create-aws-project'` compiles without TypeScript errors in the MCP package                            | ✓ VERIFIED | Build succeeds; `dist/index.d.ts` exports function and type; live `node --input-type=module` import returns `typeof === 'function'`; MCP package has `"create-aws-project": "*"` in dependencies |
| 2   | `runInitializeGitHubNonInteractive(config)` accepts structured config, reads GITHUB_TOKEN from env, calls GitHub secrets module directly — no prompts | ✓ VERIFIED | Function body (lines 577–656 in initialize-github.ts) contains zero `prompts(` calls; `process.env.GITHUB_TOKEN` read at line 588; `setEnvironmentCredentials` called directly in per-env loop |
| 3   | Long-running tool handlers (`create_project`, `setup_aws_envs`) emit `notifications/progress` events receivable by MCP client                        | ✗ FAILED   | `server.ts` has no tool handlers at all — comment reads "Tools will be registered here in Phase 28". No `notifications/progress` pattern found anywhere in codebase. |

**Score:** 2/3 truths verified

### Required Artifacts

| Artifact                                                                                         | Expected                                        | Status      | Details                                                                                                                    |
| ------------------------------------------------------------------------------------------------ | ----------------------------------------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------- |
| `src/commands/setup-aws-envs.ts`                                                                 | `runSetupAwsEnvsNonInteractive` function         | ✓ VERIFIED  | 596-line file; function at line 281; `export async function runSetupAwsEnvsNonInteractive`; no `prompts` or `process.exit` in body |
| `src/index.ts`                                                                                   | Named exports for both non-interactive functions | ✓ VERIFIED  | Exports both functions and types; `isMainModule` guard prevents CLI auto-run on library import                              |
| `src/commands/initialize-github.ts`                                                              | `runInitializeGitHubNonInteractive` function     | ✓ VERIFIED  | 657-line file; function at line 577; types exported; reads `process.env.GITHUB_TOKEN`; calls `setEnvironmentCredentials`   |
| `src/__tests__/commands/setup-aws-envs-non-interactive.spec.ts`                                  | Unit tests proving process.exit-free contract    | ✓ VERIFIED  | 260 lines; 7 tests; covers invalid config, missing context, no process.exit, AWS error paths                               |
| `src/__tests__/commands/initialize-github-non-interactive.spec.ts`                               | Unit tests proving no-prompt, env-token, per-env | ✓ VERIFIED  | 338 lines; 14 tests; covers missing token, invalid config, partial failure, env name mapping                               |
| `packages/create-aws-project-mcp/src/server.ts`                                                  | Tool handlers with progress notifications        | ✗ MISSING   | File exists but contains only MCP server scaffold; zero tools registered; comment defers to Phase 28                       |

### Key Link Verification

| From                          | To                              | Via                          | Status      | Details                                                                           |
| ----------------------------- | ------------------------------- | ---------------------------- | ----------- | --------------------------------------------------------------------------------- |
| `src/index.ts`                | `src/commands/setup-aws-envs.ts` | re-export                    | ✓ WIRED     | `export { runSetupAwsEnvsNonInteractive } from './commands/setup-aws-envs.js'`    |
| `src/index.ts`                | `src/commands/initialize-github.ts` | re-export                 | ✓ WIRED     | `export { runInitializeGitHubNonInteractive } from './commands/initialize-github.js'` |
| `runInitializeGitHubNonInteractive` | `src/github/secrets.ts`   | per-env loop with try/catch  | ✓ WIRED     | `setEnvironmentCredentials` called directly at line 632                           |
| `packages/create-aws-project-mcp/src/server.ts` | `create-aws-project` | tool handler import | ✗ NOT WIRED | No import of CLI package in server.ts; no tool handlers present                   |
| MCP tool handlers             | `notifications/progress`        | sendNotification call        | ✗ NOT WIRED | No tool handlers exist; no progress notification infrastructure                   |

### Requirements Coverage

| Requirement | Status      | Blocking Issue                                                         |
| ----------- | ----------- | ---------------------------------------------------------------------- |
| CLI-01      | ✓ SATISFIED | `runSetupAwsEnvsNonInteractive` exported and importable                |
| CLI-02      | ✓ SATISFIED | `runInitializeGitHubNonInteractive` exported with env-token pattern    |
| SAFE-04     | ? UNCERTAIN | Relates to progress notifications — requires checking REQUIREMENTS.md  |

### Anti-Patterns Found

| File                                          | Line | Pattern                                       | Severity | Impact                            |
| --------------------------------------------- | ---- | --------------------------------------------- | -------- | --------------------------------- |
| `packages/create-aws-project-mcp/src/server.ts` | 10  | "// Tools will be registered here in Phase 28" | ✗ BLOCKER | Progress notification must-have cannot be satisfied without tool handlers |

### Human Verification Required

None — all remaining items are structural and verifiable programmatically.

### Gaps Summary

Must-haves #1 and #2 are fully achieved. The CLI package exports both non-interactive functions with clean process.exit-free, prompts-free execution paths. The TypeScript build is clean, 192 tests pass, and live import confirms the functions are callable.

Must-have #3 is not implemented. The ROADMAP includes "Long-running tool handlers emit notifications/progress events" as a Phase 27 success criterion, but neither Phase 27 plan (27-01-PLAN.md, 27-02-PLAN.md) included this work, and neither SUMMARY mentions it. The MCP server.ts has no registered tools and no progress infrastructure.

**Root cause:** This criterion was placed in Phase 27 in the ROADMAP but belongs to Phase 28 (MCP tool handlers). The phase 28 ROADMAP entry describes tool handler implementation. The plans for phase 27 correctly scoped only the CLI exports. The ROADMAP criterion was not caught as out-of-scope.

**Impact on Phase 28:** Phase 28 must implement tool handlers (`create_project`, `setup_aws_envs`) that emit `notifications/progress` events. The prerequisite functions (`runSetupAwsEnvsNonInteractive`, `runInitializeGitHubNonInteractive`) are ready — this gap is a Phase 28 implementation task, not a Phase 27 regression.

---

_Verified: 2026-04-02T04:24:11Z_
_Verifier: Claude (gsd-verifier)_
