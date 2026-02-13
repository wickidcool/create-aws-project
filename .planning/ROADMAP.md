# Roadmap: create-aws-project

## Milestones

- ✅ **v1.2 AWS Organizations Support** - Phases 1-3 (shipped 2026-01-20)
- ✅ **v1.3 CLI Architecture Refactor** - Phases 4-9 (shipped 2026-01-23)
- ✅ **v1.4 Generated Project Validation** - Phases 10-14 (shipped 2026-01-24)
- ✅ **v1.5 Bug Fixes & Stability** - Phase 15 (shipped 2026-01-31)
- ✅ **v1.5.1 Fixes & Git Setup** - Phase 16 (shipped 2026-02-01)
- 🚧 **v1.6 End-to-End AWS Setup** - Phases 17-22 (in progress)

## Phases

<details>
<summary>✅ v1.2 AWS Organizations Support (Phases 1-3) - SHIPPED 2026-01-20</summary>

### Phase 1: Organization Setup Foundation
**Goal**: CLI can create AWS Organizations structure programmatically
**Plans**: 3 plans

Plans:
- [x] 01-01: AWS Organizations API integration
- [x] 01-02: Account creation workflow
- [x] 01-03: Error handling and validation

### Phase 2: Deployment User Management
**Goal**: Automated IAM user creation per environment
**Plans**: 2 plans

Plans:
- [x] 02-01: IAM user creation and policy attachment
- [x] 02-02: Access key management

### Phase 3: GitHub Integration
**Goal**: Automated GitHub secrets configuration
**Plans**: 2 plans

Plans:
- [x] 03-01: GitHub API integration with libsodium encryption
- [x] 03-02: Environment-specific secret configuration

</details>

<details>
<summary>✅ v1.3 CLI Architecture Refactor (Phases 4-9) - SHIPPED 2026-01-23</summary>

### Phase 4: Command Structure Foundation
**Goal**: CLI router with project context detection
**Plans**: 2 plans

Plans:
- [x] 04-01: Command routing and context detection
- [x] 04-02: Project configuration schema

### Phase 5: setup-aws-envs Command
**Goal**: Standalone AWS organization setup
**Plans**: 2 plans

Plans:
- [x] 05-01: Extract AWS operations from wizard
- [x] 05-02: Config persistence and validation

### Phase 6: initialize-github Command
**Goal**: Per-environment GitHub configuration
**Plans**: 1 plan

Plans:
- [x] 06-01: Extract GitHub setup with environment parameter

### Phase 7: Wizard Simplification
**Goal**: Lean project generation wizard
**Plans**: 1 plan

Plans:
- [x] 07-01: Remove AWS prompts, update templates

### Phase 8: Template Updates
**Goal**: Conditional template generation
**Plans**: 1 plan

Plans:
- [x] 08-01: Handlebars conditionals for ORG_ENABLED

### Phase 9: Documentation
**Goal**: Post-install workflow guidance
**Plans**: 1 plan

Plans:
- [x] 09-01: README template with setup instructions

</details>

<details>
<summary>✅ v1.4 Generated Project Validation (Phases 10-14) - SHIPPED 2026-01-24</summary>

### Phase 10: Test Harness Foundation
**Goal**: Programmatic project generation and validation
**Plans**: 2 plans

Plans:
- [x] 10-01: Test harness infrastructure
- [x] 10-02: Configuration matrix definition

### Phase 11: Platform Validation
**Goal**: Validate web/mobile/api combinations
**Plans**: 1 plan

Plans:
- [x] 11-01: Platform combination tests

### Phase 12: Auth Provider Validation
**Goal**: Validate Cognito and Auth0 configurations
**Plans**: 1 plan

Plans:
- [x] 12-01: Auth provider tests

### Phase 13: Local Test Runner
**Goal**: Manual validation workflow
**Plans**: 1 plan

Plans:
- [x] 13-01: npm run test:e2e script

### Phase 14: CI Integration
**Goal**: Automated validation on PR and release
**Plans**: 2 plans

Plans:
- [x] 14-01: PR validation workflow (core configs)
- [x] 14-02: Release validation workflow (full matrix)

</details>

<details>
<summary>✅ v1.5 Bug Fixes & Stability (Phase 15) - SHIPPED 2026-01-31</summary>

### Phase 15: Critical Fixes
**Goal**: Resolve blocking issues for production use
**Plans**: 1 plan

Plans:
- [x] 15-01: Fix libsodium loading, testing dependencies, and IAM idempotency

</details>

<details>
<summary>✅ v1.5.1 Fixes & Git Setup (Phase 16) - SHIPPED 2026-02-01</summary>

### Phase 16: CLI Polish & Git Setup
**Goal**: Better UX and optional GitHub repository creation
**Plans**: 2 plans

Plans:
- [x] 16-01: Fix package name references and CLI argument handling
- [x] 16-02: Add optional git repository setup after project generation

</details>

### 🚧 v1.6 End-to-End AWS Setup (In Progress)

**Milestone Goal:** Make the full AWS setup workflow complete reliably from root credentials through GitHub deployment configuration.

#### Phase 17: Root Credential Handling
**Goal**: CLI detects root credentials and creates admin IAM user automatically
**Depends on**: Phase 16
**Requirements**: ROOT-01, ROOT-02, ROOT-03, ROOT-04, ROOT-05, ROOT-06
**Success Criteria** (what must be TRUE):
  1. User can run setup-aws-envs with root credentials and CLI detects them before any operations
  2. CLI creates an admin IAM user with AdministratorAccess policy in the management account
  3. CLI switches to admin user credentials automatically for all subsequent operations
  4. CLI handles IAM eventual consistency gracefully with exponential backoff retries
  5. On re-run, CLI adopts existing admin user instead of failing or creating duplicates
**Plans**: 2 plans

Plans:
- [x] 17-01-PLAN.md — Root credential detection and admin user module with tests
- [x] 17-02-PLAN.md — Wire root detection into setup-aws-envs with credential switching

#### Phase 18: Architecture Simplification
**Goal**: All AWS/IAM operations consolidated in setup-aws-envs, GitHub operations isolated in initialize-github
**Depends on**: Phase 17
**Requirements**: ARCH-01, ARCH-02, ARCH-03, ARCH-04
**Success Criteria** (what must be TRUE):
  1. setup-aws-envs creates deployment IAM users and access keys in all child accounts (dev, stage, prod)
  2. Deployment credentials are persisted in project config after setup-aws-envs completes
  3. initialize-github reads credentials from config and pushes to GitHub secrets without making AWS API calls
  4. initialize-github still prompts for GitHub PAT and handles environment selection and secret encryption
**Plans**: 2 plans

Plans:
- [x] 18-01-PLAN.md — Add deployment access key creation to setup-aws-envs and extend config schema
- [x] 18-02-PLAN.md — Simplify initialize-github to read credentials from config (no AWS operations)

#### Phase 19: Idempotent Setup Improvements
**Goal**: Re-running setup-aws-envs resumes cleanly without redundant prompts
**Depends on**: Phase 18
**Requirements**: IDEM-01, IDEM-02, IDEM-03
**Success Criteria** (what must be TRUE):
  1. User with existing accounts in config is not re-prompted for their email addresses
  2. setup-aws-envs only prompts for emails of accounts that need to be created
  3. Partial re-runs (after failures) resume from last successful step without re-prompting completed information
**Plans**: 1 plan

Plans:
- [x] 19-01-PLAN.md — Pre-flight AWS account discovery and conditional email prompting

#### Phase 20: End-to-End Verification
**Goal**: Complete workflow from root credentials to deployed project works reliably
**Depends on**: Phase 19
**Requirements**: All v1.6 requirements
**Success Criteria** (what must be TRUE):
  1. User can run full workflow (project generation → setup-aws-envs with root → initialize-github) without errors
  2. Generated project deploys successfully to AWS with working CI/CD from GitHub Actions
  3. Re-running any command is safe and idempotent (no duplicate resources or errors)
**Plans**: 1 plan

Plans:
- [x] 20-01-PLAN.md — Manual test protocol creation and end-to-end workflow verification

#### Phase 21: Fix AWS -> GitHub Setup
**Goal**: Improve UX for AWS -> GitHub setup flow by adding batch mode to initialize-github and continuation prompt to setup-aws-envs
**Depends on**: Phase 20
**Plans**: 2 plans

Plans:
- [x] 21-01-PLAN.md — Add batch mode to initialize-github (--all flag, multiple positional args, single PAT prompt)
- [x] 21-02-PLAN.md — Add continuation prompt to setup-aws-envs (offer inline GitHub setup after AWS completion)

#### Phase 22: Add CDK Bootstrap to Environment Initialization
**Goal**: setup-aws-envs automatically bootstraps CDK in every environment account after deployment user setup
**Depends on**: Phase 21
**Plans**: 1 plan

Plans:
- [x] 22-01-PLAN.md — Create CDK bootstrap module and wire into setup-aws-envs

## Progress

**Execution Order:**
Phases execute in numeric order: 17 → 18 → 19 → 20 → 21 → 22

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Organization Setup Foundation | v1.2 | 3/3 | Complete | 2026-01-20 |
| 2. Deployment User Management | v1.2 | 2/2 | Complete | 2026-01-20 |
| 3. GitHub Integration | v1.2 | 2/2 | Complete | 2026-01-20 |
| 4. Command Structure Foundation | v1.3 | 2/2 | Complete | 2026-01-23 |
| 5. setup-aws-envs Command | v1.3 | 2/2 | Complete | 2026-01-23 |
| 6. initialize-github Command | v1.3 | 1/1 | Complete | 2026-01-23 |
| 7. Wizard Simplification | v1.3 | 1/1 | Complete | 2026-01-23 |
| 8. Template Updates | v1.3 | 1/1 | Complete | 2026-01-23 |
| 9. Documentation | v1.3 | 1/1 | Complete | 2026-01-23 |
| 10. Test Harness Foundation | v1.4 | 2/2 | Complete | 2026-01-24 |
| 11. Platform Validation | v1.4 | 1/1 | Complete | 2026-01-24 |
| 12. Auth Provider Validation | v1.4 | 1/1 | Complete | 2026-01-24 |
| 13. Local Test Runner | v1.4 | 1/1 | Complete | 2026-01-24 |
| 14. CI Integration | v1.4 | 2/2 | Complete | 2026-01-24 |
| 15. Critical Fixes | v1.5 | 1/1 | Complete | 2026-01-31 |
| 16. CLI Polish & Git Setup | v1.5.1 | 2/2 | Complete | 2026-02-01 |
| 17. Root Credential Handling | v1.6 | 2/2 | Complete | 2026-02-11 |
| 18. Architecture Simplification | v1.6 | 2/2 | Complete | 2026-02-11 |
| 19. Idempotent Setup Improvements | v1.6 | 1/1 | Complete | 2026-02-11 |
| 20. End-to-End Verification | v1.6 | 1/1 | Complete | 2026-02-13 |
| 21. Fix AWS -> GitHub Setup | v1.6 | 2/2 | Complete | 2026-02-13 |
| 22. Add CDK Bootstrap to Environment Initialization | v1.6 | 1/1 | Complete | 2026-02-13 |

---
*Last updated: 2026-02-13 after Phase 21 execution complete*
