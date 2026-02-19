# Project Milestones: create-aws-starter-kit

## v1.7 AI-Friendly CLI (Shipped: 2026-02-19)

**Delivered:** Non-interactive CLI mode enabling AI coding agents and CI pipelines to drive project generation and AWS setup via JSON config files, with sensible defaults and clear validation errors.

**Phases completed:** 23-25 (4 plans total)

**Key accomplishments:**

- Non-interactive wizard mode via `--config project.json` with sensible defaults (only `name` required)
- Zod v4 config schema validation with all-errors-at-once reporting (no fallback to prompting)
- Non-interactive `setup-aws-envs --config aws.json` with automatic email derivation for dev/stage/prod
- Auto-invocation of GitHub setup after non-interactive AWS setup completion
- Configurable auth test mock in App.spec.tsx template (FIX-01)

**Stats:**

- 27 files changed (+3,599 / -107)
- 8,025 total TypeScript LOC
- 3 phases, 4 plans, 24 commits
- 2 days (2026-02-18 → 2026-02-19)
- 171 tests passing (25 new: 14 non-interactive + 11 non-interactive-aws)

**Git range:** `c9afbd9` → `99718c5`

**What's next:** TBD (run `/gsd:new-milestone` to define next milestone)

---

## v1.6 End-to-End AWS Setup (Shipped: 2026-02-13)

**Delivered:** Complete end-to-end AWS setup workflow from root credentials through CDK bootstrap and GitHub deployment configuration, with full idempotency and streamlined UX.

**Phases completed:** 17-22 (9 plans total)

**Key accomplishments:**

- Root credential detection with automatic IAM admin user creation (tag-based adoption, exponential backoff)
- Architecture simplification: all AWS/IAM operations consolidated in setup-aws-envs, initialize-github reads config only
- Idempotent setup with pre-flight AWS account discovery and conditional email prompting
- Comprehensive E2E verification with 6-test manual protocol (all passed with real AWS)
- Batch mode for initialize-github (--all flag) with inline continuation from setup-aws-envs
- Automated CDK bootstrap via cross-account STS AssumeRole in every environment

**Stats:**

- 13 source files modified (+1,728 / -227)
- 9,083 total TypeScript LOC
- 6 phases, 9 plans, 45 commits
- 4 days (2026-02-10 → 2026-02-13)
- 146 tests passing (28 new: 16 root-credentials + 12 cdk-bootstrap)

**Git range:** `feat(17-01)` → `feat(21-02)`

**What's next:** TBD (run `/gsd:new-milestone` to define next milestone)

---

## v1.5.1 Fixes & Git Setup (Shipped: 2026-02-01)

**Delivered:** Fixed CLI argument handling and package name references, added optional GitHub repository setup after project generation.

**Phases completed:** 16 (2 plans total)

**Key accomplishments:**

- Fixed CLI argument handling: `npx create-aws-project my-app` pre-fills project name in wizard
- Corrected all package name references from `create-aws-starter-kit` to `create-aws-project`
- Optional GitHub repository setup after project generation (git init, commit, push)
- Automatic remote repository creation via GitHub API (user and org repos)
- Secure PAT handling with immediate cleanup from `.git/config` after push
- Non-fatal git setup: failures are warnings, project creation always succeeds

**Stats:**

- 15 files created/modified
- +1,815 / -27 lines (12,122 total TypeScript LOC)
- 1 phase, 2 plans, 13 commits
- 1 day (2026-02-01)

**Git range:** `e5e1ba7` → `a7eebe1`

**What's next:** TBD (run `/gsd:new-milestone` to define next milestone)

---

## v1.5 Bug Fixes & Stability (Shipped: 2026-01-31)

**Delivered:** Formalized bug fixes from v1.4 validation into stable release with corrected encryption, template dependencies, and hardened CLI commands for idempotent re-runs.

**Phases completed:** 15 (1 plan total)

**Key accomplishments:**

- Replaced broken tweetnacl encryption with libsodium crypto_box_seal (fixes GitHub secrets 422 errors)
- Hardened CLI commands for idempotent re-runs with tag-based IAM user adoption
- Fixed generated project test dependencies (@testing-library/dom, extend-expect, jest-jasmine2)
- Two-step deployment flow: setup-aws-envs creates users, initialize-github reads from config
- Full verification: 118/118 unit tests, 7/7 UAT tests, 10/10 requirements satisfied

**Stats:**

- 27 files created/modified
- +1,755 / -267 lines (11,918 total TypeScript LOC)
- 1 phase, 1 plan, 20 commits
- 7 days (2026-01-24 → 2026-01-31)

**Git range:** `44d219b` → `c775bd9`

**What's next:** TBD (run `/gsd:new-milestone` to define next milestone)

---

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
