# Roadmap: create-aws-starter-kit

## Milestones

- ✅ **v1.2 AWS Organizations Support** - Phases 1-3 (shipped 2026-01-20)
- ✅ **v1.3 CLI Architecture Refactor** - Phases 4-9 (shipped 2026-01-23)
- ✅ **v1.4 Generated Project Validation** - Phases 10-14 (shipped 2026-01-24)
- 🔧 **v1.5 Bug Fixes & Stability** - Phase 15

## Phases

<details>
<summary>v1.2 AWS Organizations Support (Phases 1-3) - SHIPPED 2026-01-20</summary>

See `.planning/milestones/v1.2-ROADMAP.md` for details.

</details>

<details>
<summary>v1.3 CLI Architecture Refactor (Phases 4-9) - SHIPPED 2026-01-23</summary>

See `.planning/milestones/v1.3-ROADMAP.md` for details.

</details>

<details>
<summary>v1.4 Generated Project Validation (Phases 10-14) - SHIPPED 2026-01-24</summary>

See `.planning/milestones/v1.4-ROADMAP.md` for details.

</details>

### v1.5 Bug Fixes & Stability

#### Phase 15: Formalize Bug Fixes

**Goal:** Commit and verify all bug fixes discovered during v1.4 validation and real-world usage.

**Requirements:** ENC-01, ENC-02, ENC-03, TPL-01, TPL-02, TPL-03, CLI-01, CLI-02, CLI-03, DOC-01

**Success criteria:**
1. `npm run build` passes with libsodium-wrappers (no tweetnacl references remain)
2. `npm test` passes all 118 unit tests
3. `npm run test:e2e` passes all 5 core e2e configs (web-api-cognito, web-cognito, mobile-auth0, api-cognito, full-auth0)
4. `npx create-aws-project setup-aws-envs` does not throw ESM module resolution errors
5. Generated mobile projects compile and run tests with Jest 30 + Expo SDK 53
6. `setup-aws-envs` creates IAM deployment users and saves user names to config
7. `initialize-github` uses existing user from config when available, falls back to full creation

**Plans:** 1 plan

Plans:
- [ ] 15-01-PLAN.md -- Harden CLI error handling, verify fixes, commit v1.5 changeset

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1-3 | v1.2 | 8/8 | Complete | 2026-01-20 |
| 4-9 | v1.3 | 8/8 | Complete | 2026-01-23 |
| 10-14 | v1.4 | 5/5 | Complete | 2026-01-24 |
| 15 | v1.5 | 0/1 | In Progress | -- |

---
*Created: 2026-01-18*
*Last updated: 2026-01-31*
