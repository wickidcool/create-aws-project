---
phase: 28-four-mcp-tools-implementation
plan: 03
status: complete
completed: 2026-04-02
commits:
  - 3256a47: feat(28-03) implement setup_aws_envs and initialize_github tool handlers
  - 3ed4f8c: test(28-03) unit tests for setup_aws_envs and initialize_github credential error paths
subsystem: mcp-tools
tags: [mcp, aws, github, credential-validation, progress-notifications, typescript]
requires: [28-01-cli-export-and-credential-error-foundation, 28-02-two-mcp-tool-handlers]
provides: [setup_aws_envs tool handler, initialize_github tool handler]
affects: [28-04, 28-05]
tech-stack:
  added: []
  patterns: [credential-check-first, chdir-restore-pattern, mock-server-testing, jest-spyon-process]
key-files:
  created:
    - packages/create-aws-project-mcp/src/tools/setup-aws-envs.ts
    - packages/create-aws-project-mcp/src/tools/initialize-github.ts
    - packages/create-aws-project-mcp/src/__tests__/tools/setup-aws-envs.spec.ts
    - packages/create-aws-project-mcp/src/__tests__/tools/initialize-github.spec.ts
  modified:
    - packages/create-aws-project-mcp/src/server.ts
decisions:
  - "jest.spyOn(process, 'chdir').mockImplementation() in beforeEach prevents real directory changes — /tmp/test-project does not exist in test environment"
  - "process.chdir mock defined in beforeEach (not global) so afterEach mockRestore() is scoped per test"
  - "28-02's server.ts additions (registerCreateProjectTool, registerGetProjectStatusTool) were already present; plan 28-03 added registerSetupAwsEnvsTool and registerInitializeGitHubTool alongside them"
metrics:
  duration: ~25 minutes
  completed: 2026-04-02
---

# Phase 28 Plan 03: setup_aws_envs and initialize_github Tool Handlers Summary

## What Was Built

`setup_aws_envs` and `initialize_github` MCP tool handlers are now registered on the server. Both tools validate required credentials (AWS keys and GITHUB_TOKEN respectively) before delegating to CLI non-interactive functions, returning structured `isError` responses with `.mcp.json` snippets when credentials are missing. Both tools manage `process.cwd()` safely via `chdir` + try/finally restore pattern.

## Deliverables

- `packages/create-aws-project-mcp/src/tools/setup-aws-envs.ts` — `registerSetupAwsEnvsTool` export: checks `AWS_ACCESS_KEY_ID` + `AWS_SECRET_ACCESS_KEY` first, chdir management, progress notifications (0/2/3 when progressToken present), wraps `runSetupAwsEnvsNonInteractive` in `withCliContext`
- `packages/create-aws-project-mcp/src/tools/initialize-github.ts` — `registerInitializeGitHubTool` export: checks `GITHUB_TOKEN` first, chdir management, wraps `runInitializeGitHubNonInteractive` in `withCliContext`, returns per-environment result JSON
- `packages/create-aws-project-mcp/src/server.ts` — Updated to import and register both new tools alongside the existing 28-02 tools
- `packages/create-aws-project-mcp/src/__tests__/tools/setup-aws-envs.spec.ts` — 11 tests: credential error paths, success path, email forwarding, chdir management, progress notifications with/without token, error recovery
- `packages/create-aws-project-mcp/src/__tests__/tools/initialize-github.spec.ts` — 10 tests: GITHUB_TOKEN missing error, success path, repoUrl/environments forwarding, partial result JSON, chdir management, error recovery

## Test Results

- MCP package: 55 tests, 55 passed (21 new tests in setup-aws-envs.spec.ts and initialize-github.spec.ts)
- All existing tests continue to pass

## Deviations

**[Auto-fix] Mocked process.chdir in tests**

Tests calling `handler({ projectDir: '/tmp/test-project', ... })` would fail with ENOENT because `/tmp/test-project` does not exist on the test machine. Added `jest.spyOn(process, 'chdir').mockImplementation()` in `beforeEach` with `mockRestore()` in `afterEach` to prevent real directory changes while still asserting the correct arguments were passed.

## Decisions

- `jest.spyOn(process, 'chdir')` set up in `beforeEach` (not at module scope) so each test gets a fresh spy and `afterEach` can restore cleanly
- `process.cwd()` captured before the spy is installed so restore-to-original-cwd assertion remains accurate
- `server.ts` parallel-execution merge: 28-02's imports were already committed; 28-03 added two imports and two registration calls without removing anything
