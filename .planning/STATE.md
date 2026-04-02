# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-25)

**Core value:** Generated projects have production-ready multi-environment AWS infrastructure with automated CI/CD from day one.
**Current focus:** v1.8 MCP Server milestone

## Current Position

Phase: 29 of 29
Plan: 0
Status: Planning Phase 29
Last activity: 2026-04-02 — Phase 28 complete (Four MCP Tools Implementation, all 3 plans, 247 tests passing)

Progress: [███████░░░] ~75% (Phase 28 complete, 3 of 4 phases done)

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
| runCreateProjectNonInteractive accepts structured options object and throws on error (never process.exit) | MCP server safety — consistent with throw-not-exit pattern from Phase 27 | 28-01 |
| requireEnvVars treats whitespace-only values as missing (.trim() check) | Empty/blank env vars should not satisfy credential requirements | 28-01 |
| Use mock-server pattern (capture handler via registerTool spy) for MCP tool tests | Avoids SDK transport initialization; keeps tests fast and isolated | 28-02 |
| Progress token checked with !== undefined (not truthy) | Allows numeric 0 as a valid progress token | 28-02 |
| jest.spyOn(process, 'chdir').mockImplementation() in beforeEach prevents real chdir in tests | /tmp/test-project doesn't exist on test machine; spy asserts args without real side effects | 28-03 |

### Deferred Issues

None.

### Blockers/Concerns

- Note: npm test (not npx jest) required for tests using jest.unstable_mockModule and top-level await — must use node --experimental-vm-modules flag
- node_modules/create-aws-project/dist/ (hoisted) must be kept in sync with the built CLI package — npm install or npm run build from root refreshes it

### Outstanding Todos

None.

## Session Continuity

Last session: 2026-04-02
Stopped at: Phase 28 complete and verified — all 3 plans executed, 247 tests passing, human verification approved
Resume file: None
Next: `/gsd:discuss-phase 29` or `/gsd:plan-phase 29` — Publishing and Generated Project Template

---
*Updated: 2026-04-02 after Phase 28 completion and verification*
