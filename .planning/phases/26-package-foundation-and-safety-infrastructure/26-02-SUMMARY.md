---
plan: 26-02
status: complete
completed: 2026-04-01
duration: ~2 minutes
subsystem: mcp-server
tags: [mcp, safety, stdout-capture, process-exit, monkey-patch, typescript]
---

# Phase 26 Plan 02: withCliContext Safety Wrapper — Summary

## What Was Built

Implemented `withCliContext<T>()`, a safety wrapper that monkey-patches `process.stdout.write` and `process.exit` before invoking a CLI function, then unconditionally restores both originals in a `finally` block. This prevents stdout corruption of the MCP stdio transport and prevents `process.exit()` from killing the server. All future Phase 28 tool handlers will call this wrapper.

## Deliverables

- **packages/create-aws-project-mcp/src/utils/cli-context.ts**: `withCliContext` and `CliContextResult<T>` — the core safety wrapper
- **packages/create-aws-project-mcp/src/__tests__/utils/cli-context.spec.ts**: 7 test cases proving stdout capture, exit interception, and unconditional cleanup on both success and error paths

## Commits

| Task | Commit | Files |
|------|--------|-------|
| Task 1: Implement withCliContext utility | 4fffa70 | src/utils/cli-context.ts |
| Task 2: Write comprehensive tests (+ fix .bind() bug) | 7f1589c | src/__tests__/utils/cli-context.spec.ts, src/utils/cli-context.ts |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed `.bind()` from original save references**

- **Found during:** Task 2, test run
- **Issue:** Implementation saved `process.stdout.write.bind(process.stdout)` and `process.exit.bind(process)`. This created NEW function references, so the `finally` block restored a bound copy rather than the exact original. Tests asserting `process.stdout.write === writeBefore` failed with `Expected: [Function bound bound bound]` / `Received: [Function bound bound bound bound]`.
- **Fix:** Changed saves to direct reference assignment (`const originalWrite = process.stdout.write`) so `finally` restores the exact same reference that was in place before the call.
- **Files modified:** src/utils/cli-context.ts (lines 12-13)
- **Commit:** 7f1589c

**2. [Rule 3 - Blocking] Import `jest` from `@jest/globals` in ESM test file**

- **Found during:** Task 2, first test run
- **Issue:** `jest` global is not available in ESM test modules; test file used `jest.fn()` without importing it, causing `ReferenceError: jest is not defined`.
- **Fix:** Added `import { jest } from "@jest/globals"` at top of test file. Rewrote the "does not leak" test to avoid using `jest.fn()` (used a plain sentinel function instead) to keep logic clear without relying on jest mock APIs.
- **Files modified:** src/__tests__/utils/cli-context.spec.ts
- **Commit:** 7f1589c

## Must-Haves Verification

| Check | Status |
|-------|--------|
| withCliContext captures all stdout writes and returns as string | Pass |
| withCliContext intercepts process.exit() and throws instead of killing process | Pass |
| process.stdout.write and process.exit restored in finally block after success | Pass |
| process.stdout.write and process.exit restored in finally block after error | Pass |
| cli-context.ts exists and exports withCliContext + CliContextResult | Pass |
| cli-context.spec.ts exists with >= 50 lines (96 lines) | Pass |
| process.stdout.write monkey-patched via try/finally | Pass (grep count: 3) |
| process.exit monkey-patched via try/finally | Pass (grep count: 4) |
| `npm run build` exits 0 | Pass |
| `npm test` exits 0 (179 total: 171 CLI + 8 MCP) | Pass |
| `grep -c "finally"` returns >= 1 | Pass (1) |
| `grep -c "process.stdout.write"` returns >= 3 | Pass (3) |
| `grep -c "process.exit"` returns >= 3 | Pass (4) |
