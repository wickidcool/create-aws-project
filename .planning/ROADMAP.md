# Roadmap: create-aws-starter-kit v1.4

## Overview

Milestone v1.4 builds a test harness that validates all 14 generated project configurations (7 platform combinations x 2 auth providers) actually compile and pass tests. The harness generates projects into isolated temp directories, runs the npm install/build/test pipeline, and reports results. Local developers run via npm script; CI runs tiered execution (core configs on PRs, full matrix on releases).

## Milestones

- ✅ **v1.2 AWS Organizations Support** - Phases 1-3 (shipped 2026-01-20)
- ✅ **v1.3 CLI Architecture Refactor** - Phases 4-9 (shipped 2026-01-23)
- 🚧 **v1.4 Generated Project Validation** - Phases 10-14 (in progress)

## Phases

<details>
<summary>v1.2 AWS Organizations Support (Phases 1-3) - SHIPPED 2026-01-20</summary>

See `.planning/milestones/v1.2/ROADMAP-ARCHIVE.md` for details.

</details>

<details>
<summary>v1.3 CLI Architecture Refactor (Phases 4-9) - SHIPPED 2026-01-23</summary>

See `.planning/milestones/v1.3/ROADMAP-ARCHIVE.md` for details.

</details>

### v1.4 Generated Project Validation (In Progress)

**Milestone Goal:** Ensure all generated project configurations build and pass tests through automated validation.

- [x] **Phase 10: Test Harness Foundation** - Temp directory management and npm execution utilities
- [x] **Phase 11: Validation Pipeline** - Core runner that generates, installs, builds, tests
- [ ] **Phase 12: Test Fixtures and Matrix** - Configuration factories and tiered scenario definitions
- [ ] **Phase 13: Reporting and Local Runner** - Progress output, summary table, npm scripts
- [ ] **Phase 14: CI Integration** - PR workflow core configs, release workflow full matrix

## Phase Details

### Phase 10: Test Harness Foundation
**Goal**: Developers can create isolated temp directories and execute npm commands with captured output
**Depends on**: Nothing (first phase of v1.4)
**Requirements**: HARN-02, HARN-05
**Success Criteria** (what must be TRUE):
  1. Test can create unique temp directory that does not conflict with other tests
  2. Temp directories are automatically cleaned up after test completion
  3. npm commands can be executed with stdout/stderr captured
  4. execa dependency is installed and typed
**Plans:** 1 plan

Plans:
- [x] 10-01-PLAN.md — Test harness utilities (withTempDir, runCommand)

### Phase 11: Validation Pipeline
**Goal**: Single function validates a generated project through the full npm lifecycle
**Depends on**: Phase 10
**Requirements**: HARN-01, HARN-03, HARN-04, REPT-03
**Success Criteria** (what must be TRUE):
  1. `validateGeneratedProject(config)` generates project into temp dir
  2. Pipeline runs npm install, npm run build, npm test sequentially
  3. Non-zero exit code from any step fails the validation with captured output
  4. Each step has configurable timeout (default 10 minutes)
**Plans:** 1 plan

Plans:
- [x] 11-01-PLAN.md — Validation pipeline with timeout support and step tracking

### Phase 12: Test Fixtures and Matrix
**Goal**: Test configurations are defined as typed factories with tiered execution support
**Depends on**: Phase 11
**Requirements**: CICD-03
**Success Criteria** (what must be TRUE):
  1. Config factory functions produce valid ProjectConfig objects
  2. Matrix defines all 14 configurations with descriptive names
  3. Configurations are tagged with tier (smoke, core, full)
  4. Core tier includes at least one config per platform and per auth provider
**Plans:** 1 plan

Plans:
- [ ] 12-01-PLAN.md — Config factories and tiered test matrix

### Phase 13: Reporting and Local Runner
**Goal**: Developers can run validation locally with clear progress and summary output
**Depends on**: Phase 12
**Requirements**: REPT-01, REPT-02, REPT-04, REPT-05
**Success Criteria** (what must be TRUE):
  1. `npm run test:e2e` runs validation pipeline locally
  2. Progress shows which configuration is testing (e.g., "Testing 1/14: web-api-cognito")
  3. Failed validations display stdout/stderr for debugging
  4. Summary table at end shows pass/fail for all tested configs
**Plans**: TBD

Plans:
- [ ] 13-01: TBD

### Phase 14: CI Integration
**Goal**: CI automatically validates core configs on PRs and full matrix on releases
**Depends on**: Phase 13
**Requirements**: CICD-01, CICD-02
**Success Criteria** (what must be TRUE):
  1. PR workflow runs validation on core tier (3-4 configs)
  2. Release workflow runs validation on full 14-config matrix
  3. CI failure blocks PR merge or release with clear error output
  4. Workflow uses matrix strategy for parallel config execution
**Plans**: TBD

Plans:
- [ ] 14-01: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 10 -> 11 -> 12 -> 13 -> 14

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 10. Test Harness Foundation | v1.4 | 1/1 | Complete | 2026-01-23 |
| 11. Validation Pipeline | v1.4 | 1/1 | Complete | 2026-01-24 |
| 12. Test Fixtures and Matrix | v1.4 | 0/1 | Planned | - |
| 13. Reporting and Local Runner | v1.4 | 0/TBD | Not started | - |
| 14. CI Integration | v1.4 | 0/TBD | Not started | - |

---
*Created: 2026-01-23*
*Last updated: 2026-01-24*
