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
| 5. Wizard Simplification | v1.3 | 2/2 | Complete | 2026-01-21 |
| 6. setup-aws-envs Command | v1.3 | 1/1 | Complete | 2026-01-21 |
| 7. initialize-github Command | v1.3 | 0/1 | Planned | -- |
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
- [x] 05-01-PLAN.md -- Remove org prompts from wizard, update test
- [x] 05-02-PLAN.md -- Remove org setup from CLI, add config file write, update next steps

## Phase 6: setup-aws-envs Command

**Goal:** Users can set up AWS Organizations and environment accounts from generated project

**Plans:** 1 plan

Plans:
- [x] 06-01-PLAN.md -- Add ora dependency, implement email collection, command orchestration with progress and error handling

## Phase 7: initialize-github Command

**Goal:** Users can initialize GitHub environments per-environment

**Plans:** 1 plan

Plans:
- [ ] 07-01-PLAN.md -- STS dependency, cross-account IAM, full command implementation with GitHub integration
