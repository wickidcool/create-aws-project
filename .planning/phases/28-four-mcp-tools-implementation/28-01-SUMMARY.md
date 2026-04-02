---
phase: 28-four-mcp-tools-implementation
plan: 01
status: complete
completed: 2026-04-02
commits:
  - b131edc: feat(28-01) extract and export runCreateProjectNonInteractive from CLI package
  - 143978c: feat(28-01) create MissingCredentialsError class with .mcp.json snippet formatter
subsystem: mcp-tools
tags: [mcp, cli, error-handling, typescript]
requires: [26-package-foundation-and-safety-infrastructure, 27-cli-additions-to-existing-package]
provides: [runCreateProjectNonInteractive export, MissingCredentialsError class]
affects: [28-02, 28-03, 28-04, 28-05]
tech-stack:
  added: []
  patterns: [structured-options-object, throw-not-exit, type-discriminated-errors]
key-files:
  created:
    - packages/create-aws-project-mcp/src/tools/errors.ts
    - packages/create-aws-project-mcp/src/__tests__/tools/errors.spec.ts
  modified:
    - src/cli.ts
    - src/index.ts
---

# Phase 28 Plan 01: CLI Export and Credential Error Foundation Summary

## What Was Built

`runCreateProjectNonInteractive(options: CreateProjectOptions)` is now exported from the CLI package and re-exported through `src/index.ts`, providing a safe programmatic entry point for the `create_project` MCP tool handler. `MissingCredentialsError` and `requireEnvVars` helper were added to the MCP package's `tools/errors.ts`, providing a typed, actionable error class with a copy-pasteable `.mcp.json` snippet for all four tool handlers that need credential validation.

## Deliverables

- `src/cli.ts` — Added `CreateProjectOptions` interface and `runCreateProjectNonInteractive` function that accepts structured options, throws on errors (never calls `process.exit`), and returns `{ projectDir }`
- `src/index.ts` — Re-exports `runCreateProjectNonInteractive` and `CreateProjectOptions` so the MCP package can import them from `create-aws-project`
- `packages/create-aws-project-mcp/src/tools/errors.ts` — `MissingCredentialsError` class with `type: 'MISSING_CREDENTIALS'`, `missingVars` array, and `.mcp.json` snippet in message; plus `requireEnvVars` helper
- `packages/create-aws-project-mcp/src/__tests__/tools/errors.spec.ts` — 13 tests covering all class properties, snippet format, instanceof check, and helper edge cases

## Test Results

- CLI package: 192 tests, 192 passed
- MCP package: 21 tests, 21 passed (13 new in errors.spec.ts)
- Total: 213 tests, all passing

## Deviations

None — plan executed exactly as written.

## Decisions

- `runCreateProjectNonInteractive` maps `options.auth ?? 'none'` for both provider and authFeatures silencing (consistent with `loadNonInteractiveConfig` logic in `non-interactive.ts`)
- `requireEnvVars` uses `.trim()` check to treat whitespace-only values as missing, matching the pattern established in Phase 27
