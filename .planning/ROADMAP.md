# Roadmap: create-aws-starter-kit

## Completed Milestones

- [v1.2 AWS Organizations Support](milestones/v1.2-ROADMAP.md) (Phases 1-3) -- SHIPPED 2026-01-20

## Current Milestone

- [v1.3.0 CLI Architecture Refactor](milestones/v1.3-ROADMAP.md) (Phases 4-8) -- IN PROGRESS

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. AWS Organizations Foundation | v1.2 | 3/3 | Complete | 2026-01-20 |
| 2. GitHub Deployment Command | v1.2 | 3/3 | Complete | 2026-01-20 |
| 3. Template Updates & Integration | v1.2 | 2/2 | Complete | 2026-01-20 |
| 4. CLI Infrastructure & Command Routing | v1.3 | 2/2 | Complete | 2026-01-22 |
| 5. Wizard Simplification | v1.3 | 0/2 | Pending | -- |
| 6. setup-aws-envs Command | v1.3 | 0/? | Pending | -- |
| 7. initialize-github Command | v1.3 | 0/? | Pending | -- |
| 8. Documentation Updates | v1.3 | 0/? | Pending | -- |

## Phase 4: CLI Infrastructure & Command Routing

**Goal:** CLI routes commands correctly and validates project context

Plans:
- [x] 04-01-PLAN.md -- CLI routing, find-up dependency, deprecation notice
- [x] 04-02-PLAN.md -- Project context detection, command stubs

## Phase 5: Wizard Simplification

**Goal:** Main wizard is lean and generates project config for downstream commands

**Plans:** 2 plans

Plans:
- [ ] 05-01-PLAN.md -- Remove org prompts from wizard, update test
- [ ] 05-02-PLAN.md -- Remove org setup from CLI, add config file write, update next steps
