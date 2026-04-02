---
phase: 28-four-mcp-tools-implementation
plan: 02
status: complete
completed: 2026-04-02
commits:
  - fe840ae: feat(28-02) implement create_project and get_project_status tool handlers
  - 2990440: test(28-02) unit tests for create_project and get_project_status tools
subsystem: mcp-tools
tags: [mcp, tools, typescript, jest, progress-notifications]
requires: [28-01]
provides: [create_project tool handler, get_project_status tool handler]
affects: [28-03, 28-04, 28-05]
tech-stack:
  added: []
  patterns: [registerTool-pattern, mock-server-capture-handler, withCliContext-wrapper, progress-notifications]
key-files:
  created:
    - packages/create-aws-project-mcp/src/tools/create-project.ts
    - packages/create-aws-project-mcp/src/tools/get-project-status.ts
    - packages/create-aws-project-mcp/src/__tests__/tools/create-project.spec.ts
    - packages/create-aws-project-mcp/src/__tests__/tools/get-project-status.spec.ts
  modified:
    - packages/create-aws-project-mcp/src/server.ts
---

# Phase 28 Plan 02: Two MCP Tool Handlers Summary

## What Was Built

`create_project` and `get_project_status` MCP tool handlers are implemented and registered on the server. `create_project` wraps `runCreateProjectNonInteractive` in `withCliContext`, emits progress notifications when a `progressToken` is provided, and returns structured JSON with `projectDir`. `get_project_status` reads `.aws-starter-config.json` from a given directory and returns structured status including computed `nextSteps` guidance. Both tools return `isError: true` on failure rather than crashing the server.

## Deliverables

- `packages/create-aws-project-mcp/src/tools/create-project.ts` — `registerCreateProjectTool(server)` function; handles progress notifications via `extra._meta.progressToken`
- `packages/create-aws-project-mcp/src/tools/get-project-status.ts` — `registerGetProjectStatusTool(server)` function; reads config, computes nextSteps, handles ENOENT/parse errors gracefully
- `packages/create-aws-project-mcp/src/server.ts` — Updated to import and register both tools; placeholder comment removed
- `packages/create-aws-project-mcp/src/__tests__/tools/create-project.spec.ts` — 7 tests: registration, args passthrough, success path, error path, progress on/off
- `packages/create-aws-project-mcp/src/__tests__/tools/get-project-status.spec.ts` — 5 tests: full status, nextSteps with empty accounts, nextSteps when fully configured, ENOENT error, invalid JSON error

## Test Results

- MCP package: 34 tests, 34 passed (13 new from this plan)
- CLI package: 192 tests, 192 passed
- Total: 226 tests, all passing

## Deviations

**[Rule 3 - Blocking] Stale hoisted node_modules/create-aws-project dist**

- Found during: Task 1 compilation
- Issue: `node_modules/create-aws-project/dist/` was a stale copy from April 1 (pre-Phase-28 build) without `runCreateProjectNonInteractive` export in types
- Fix: Synced entire `dist/` directory from root package to `node_modules/create-aws-project/dist/`; this also resolved a pre-existing `server.spec.ts` failure caused by missing `runSetupAwsEnvsNonInteractive` export
- Files modified: `node_modules/create-aws-project/dist/` (not tracked in git; workspace tooling issue)

## Decisions

- Used mock-server pattern (capture handler via `registerTool` spy) rather than instantiating real McpServer in tests — avoids SDK transport initialization and keeps tests fast and isolated
- `expect.objectContaining` used for optional-fields assertion to avoid TypeScript strictness issues with mock function generic types
- Progress token checked with `!== undefined` (not truthy) to allow numeric `0` as valid token
