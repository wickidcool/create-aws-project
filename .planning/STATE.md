# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-18)

**Core value:** Generated projects have production-ready multi-environment AWS infrastructure with automated CI/CD from day one.
**Current focus:** v1.7 AI-Friendly CLI

## Current Position

Phase: 25 of 25 (non-interactive-setup-aws-envs)
Plan: 01 of 02 in phase 25
Status: In progress
Last activity: 2026-02-19 - Completed 25-01-PLAN.md (config schema + email derivation)

Progress: [##############################-] 93% (phase 25 plan 01 done, plan 02 remaining)

## Milestones

| Version | Name | Phases | Status | Shipped |
|---------|------|--------|--------|---------|
| v1.2 | AWS Organizations Support | 1-3 | Complete | 2026-01-20 |
| v1.3 | CLI Architecture Refactor | 4-9 | Complete | 2026-01-23 |
| v1.4 | Generated Project Validation | 10-14 | Complete | 2026-01-24 |
| v1.5 | Bug Fixes & Stability | 15 | Complete | 2026-01-31 |
| v1.5.1 | Fixes & Git Setup | 16 | Complete | 2026-02-01 |
| v1.6 | End-to-End AWS Setup | 17-22 | Complete | 2026-02-13 |
| v1.7 | AI-Friendly CLI | 23-25 | Active | — |

## Accumulated Context

### Decisions

| Phase | Decision | Rationale |
|-------|----------|-----------|
| 24-01 | z.object() not z.strictObject() for JSON config | Unknown keys stripped silently; schema evolution should not break automation pipelines |
| 24-01 | authFeatures silently dropped when auth=none | Contradictory but harmless; no-op for automation; producing an error would be too strict |
| 24-01 | Dual name validation: Zod min(1) + validateProjectName() | Zod catches empty/missing; npm validator catches invalid package names (e.g. UPPERCASE) |
| 24-01 | Detect --config inside runCreate() not run() | Cleaner separation; Phase 25 can add --config to runSetupAwsEnvs() separately |
| 24-01 | z.enum(VALID_REGIONS) not z.string().refine() | Simpler, better error messages, TypeScript infers literal union type |
| 24-02 | printWelcome() before --config check | Banner shows in both interactive and non-interactive modes for consistent UX |
| 24-02 | process.exit(0) at end of runNonInteractive() | Explicit exit prevents any fallthrough to interactive code paths |
| 25-01 | z.string().min(1) not z.email() for setup-aws-envs email | Avoids Zod v3/v4 chained API confusion; AWS provides authoritative email validation |
| 25-01 | Post-safeParse includes('@') check for email format | Catches no-@ emails that would produce malformed derived addresses; Zod min(1) doesn't catch this |
| 25-01 | lastIndexOf('@') for email splitting in deriveEnvironmentEmails | Defensive; correct for valid emails and edge cases (plus aliases, subdomains) |

### Deferred Issues

None.

### Blockers/Concerns

- Note: npm test (not npx jest) required for tests using jest.unstable_mockModule and top-level await - must use node --experimental-vm-modules flag

### Outstanding Todos

- Execute Phase 25 Plan 02: Wire --config flag into setup-aws-envs CLI command

## Session Continuity

Last session: 2026-02-19
Stopped at: Completed 25-01-PLAN.md (SetupAwsEnvsConfig schema + email derivation)
Resume file: None
Next: Execute 25-02-PLAN.md (CLI wiring for --config flag in runSetupAwsEnvs)

---
*Updated: 2026-02-19 after 25-01 config schema and email derivation complete*
