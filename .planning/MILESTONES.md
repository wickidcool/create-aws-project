# Project Milestones: create-aws-starter-kit

## v1.4 Generated Project Validation (Shipped: 2026-01-24)

**Delivered:** Test harness that validates all 14 generated project configurations build and pass tests, with local runner and CI integration.

**Phases completed:** 10-14 (5 plans total)

**Key accomplishments:**

- Test harness utilities (withTempDir, runCommand) with automatic cleanup
- Validation pipeline with 10-minute timeout per step and fail-fast behavior
- 14 config factories with tiered test matrix (smoke: 1, core: 5, full: 14)
- Local runner with ora spinner progress and console.table summary
- GitHub Actions CI for PR validation (5 configs) and release validation (14 configs)
- Fixed template TypeScript errors discovered by validation harness

**Stats:**

- 47 files created/modified
- +7,421 / -146 lines (10,737 total TypeScript LOC)
- 5 phases, 5 plans, 38 commits
- 2 days (2026-01-23 → 2026-01-24)

**Git range:** `fd23a0b` → `a7beaf9`

**What's next:** TBD (run `/gsd:new-milestone` to define next milestone)

---

## v1.3 CLI Architecture Refactor (Shipped: 2026-01-23)

**Delivered:** Simplified wizard with AWS/GitHub setup extracted into separate post-install commands for better flexibility and error handling.

**Phases completed:** 4-9 (8 plans total)

**Key accomplishments:**

- CLI command routing infrastructure with project context detection
- Simplified wizard from 15 to 7 prompts (AWS Organizations removed)
- `setup-aws-envs` command for AWS Organization and environment account creation
- `initialize-github <env>` command for per-environment GitHub deployment setup
- Comprehensive CLI documentation with post-install workflow
- README template with platform-conditional sections for generated projects

**Stats:**

- 49 files created/modified
- ~9,600 lines of TypeScript total
- 6 phases, 8 plans
- 3 days (2026-01-21 → 2026-01-23)

**Git range:** `chore(04-01)` → `docs(v1.3)`

**What's next:** v1.4 Generated Project Validation

---

## v1.2 AWS Organizations Support (Shipped: 2026-01-20)

**Delivered:** Multi-environment AWS infrastructure with automatic Organizations setup and GitHub Actions deployment credentials.

**Phases completed:** 1-3 (8 plans total)

**Key accomplishments:**

- AWS Organizations wizard with automatic org and account creation (dev/stage/prod)
- IAM deployment user creation with least-privilege CDK deployment policy
- GitHub Environments integration for environment-specific AWS credentials
- `setup-github` CLI command for one-step GitHub Actions configuration
- CDK templates with conditional multi-account/single-account deployment
- Backward compatibility preserved for v1.1.0 projects

**Stats:**

- 35 files created/modified
- ~3,800 lines of TypeScript/YAML/JSON added
- 3 phases, 8 plans
- Completed: 2026-01-20

**Git range:** `df6bb06` → `c99776a`

**What's next:** v1.3 CLI Architecture Refactor

---
