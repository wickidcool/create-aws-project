# Roadmap: create-aws-starter-kit

## Milestones

- [x] **v1.2 AWS Organizations Support** - Phases 1-3 (shipped 2026-01-20)
- [x] **v1.3 CLI Architecture Refactor** - Phases 4-9 (shipped 2026-01-23)
- [x] **v1.4 Generated Project Validation** - Phases 10-14 (shipped 2026-01-24)
- [x] **v1.5 Bug Fixes & Stability** - Phase 15 (shipped 2026-01-31)
- [x] **v1.5.1 Fixes & Git Setup** - Phase 16 (complete 2026-02-02)

## Phases

<details>
<summary>v1.2 AWS Organizations Support (Phases 1-3) - SHIPPED 2026-01-20</summary>

See: `.planning/milestones/v1.2-ROADMAP.md`

</details>

<details>
<summary>v1.3 CLI Architecture Refactor (Phases 4-9) - SHIPPED 2026-01-23</summary>

See: `.planning/milestones/v1.3-ROADMAP.md`

</details>

<details>
<summary>v1.4 Generated Project Validation (Phases 10-14) - SHIPPED 2026-01-24</summary>

See: `.planning/milestones/v1.4-ROADMAP.md`

</details>

<details>
<summary>v1.5 Bug Fixes & Stability (Phase 15) - SHIPPED 2026-01-31</summary>

See: `.planning/milestones/v1.5-ROADMAP.md`

</details>

### v1.5.1 Fixes & Git Setup (Complete)

**Milestone Goal:** Fix CLI arg handling and docs, add optional git repo initialization after project generation.

- [x] **Phase 16: Fixes & Git Setup** - Fix CLI bugs and add optional GitHub repo creation during wizard flow (complete 2026-02-02)

## Phase Details

### Phase 16: Fixes & Git Setup
**Goal**: Users can generate a project with correct CLI behavior and optionally push it to a GitHub repository in one wizard flow
**Depends on**: Phase 15 (current stable codebase)
**Requirements**: FIX-01, FIX-02, GIT-01, GIT-02, GIT-03, GIT-04, GIT-05, GIT-06
**Success Criteria** (what must be TRUE):
  1. Running `npx create-aws-project my-app` pre-fills "my-app" as the default project name in the wizard prompt
  2. Generated project documentation shows the correct `setup-aws-envs` command for AWS Organizations setup
  3. After project generation, user is prompted for a GitHub repo URL which can be skipped to skip all git setup
  4. When repo URL and PAT are provided, the generated project is git-initialized, committed, and pushed to the remote
  5. If the specified remote repository does not exist, it is automatically created via GitHub API before pushing
**Plans**: 2 plans

Plans:
- [x] 16-01-PLAN.md -- Fix CLI name arg passthrough and stale package name references (complete)
- [x] 16-02-PLAN.md -- Add optional GitHub repository setup after project generation (complete)

## Progress

**Execution Order:** Phase 16

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 16. Fixes & Git Setup | v1.5.1 | 2/2 | Complete | 2026-02-02 |

---
*Created: 2026-02-01*
