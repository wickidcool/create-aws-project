# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-25)

**Core value:** Generated projects have production-ready multi-environment AWS infrastructure with automated CI/CD from day one.
**Current focus:** v1.8 MCP Server milestone

## Current Position

Phase: 28 of 29
Plan: 0
Status: Planning Phase 28
Last activity: 2026-04-02 — Phase 27 complete (CLI Additions to Existing Package)

Progress: [█████░░░░░] ~50% (Phase 27 complete, 2 of 4 phases done)

## Milestones

| Version | Name | Phases | Status | Shipped |
|---------|------|--------|--------|---------|
| v1.2 | AWS Organizations Support | 1-3 | Complete | 2026-01-20 |
| v1.3 | CLI Architecture Refactor | 4-9 | Complete | 2026-01-23 |
| v1.4 | Generated Project Validation | 10-14 | Complete | 2026-01-24 |
| v1.5 | Bug Fixes & Stability | 15 | Complete | 2026-01-31 |
| v1.5.1 | Fixes & Git Setup | 16 | Complete | 2026-02-01 |
| v1.6 | End-to-End AWS Setup | 17-22 | Complete | 2026-02-13 |
| v1.7 | AI-Friendly CLI | 23-25 | Complete | 2026-02-19 |
| v1.8 | MCP Server | 26-29 | In Progress | - |

## Accumulated Context

### Decisions

Cleared — full decision log in PROJECT.md Key Decisions table.

| Decision | Context | Plan |
|----------|---------|------|
| MCP package test script uses `../../node_modules/jest/bin/jest.js` | Jest hoisted to root in npm workspaces; `node_modules/.bin/jest` does not exist in workspace package dir | 26-01 |
| Root jest.config.ts excludes `/packages/` from testPathIgnorePatterns | Each workspace runs its own tests independently to avoid double-running | 26-01 |
| No peerDependencies for zod in MCP package | SDK bundles its own zod; adding peer dep creates version conflicts | 26-01 |
| withCliContext saves process.stdout.write without .bind() | Saving with .bind() creates a new function reference; the finally block must restore the exact same reference to satisfy identity tests and prevent double-wrapping | 26-02 |
| ESM test files must import jest from @jest/globals | jest global is not auto-injected in ESM module context; use `import { jest } from "@jest/globals"` | 26-02 |
| Non-interactive exported functions use detectProjectContext (not requireProjectContext) and throw instead of process.exit | MCP server cannot have process.exit called in tool handlers | 27-01 |
| Test files in __tests__/ use .spec.ts extension (not .test.ts) | jest.config testMatch only matches `**/__tests__/**/*.spec.ts` | 27-01 |
| jest resetMocks:true resets mock implementations — expose fs mocks as top-level vars and configure in setupMocks helper | Mock factory implementations are reset between tests; must re-configure in beforeEach or per-test setup | 27-01 |
| GITHUB_TOKEN read from process.env only — never accepted as function parameter (CRED-01) | MCP tool handlers must not prompt for credentials; env var is the only safe channel | 27-02 |
| Per-environment try/catch in runInitializeGitHubNonInteractive allows partial failure reporting | One env's GitHub API failure should not abort remaining env configurations | 27-02 |
| jest.fn mock typed with full parameter signature to avoid TS2554 on toHaveBeenCalledWith | Zero-arg mock type causes TypeScript errors when asserting call arguments | 27-02 |

### Deferred Issues

None.

### Blockers/Concerns

- Note: npm test (not npx jest) required for tests using jest.unstable_mockModule and top-level await — must use node --experimental-vm-modules flag

### Outstanding Todos

None.

## Session Continuity

Last session: 2026-04-02
Stopped at: Phase 27 complete and verified — both plans executed, 192 tests passing
Resume file: None
Next: `/gsd:discuss-phase 28` or `/gsd:plan-phase 28` — Four MCP Tools Implementation

---
*Updated: 2026-04-02 after Phase 27 completion and verification*
