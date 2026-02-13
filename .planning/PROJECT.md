# create-aws-starter-kit

## What This Is

An npx CLI tool that scaffolds full-stack AWS projects with React web, React Native mobile, Lambda API, and CDK infrastructure. Provides a lean wizard for project generation with optional GitHub repository setup, and a streamlined two-command AWS setup flow (setup-aws-envs handles root credentials, admin user, org, accounts, deployment users, CDK bootstrap; initialize-github reads config and pushes secrets). Includes automated validation of all 14 generated project configurations.

## Core Value

Generated projects have production-ready multi-environment AWS infrastructure with automated CI/CD from day one.

## Current State (v1.6)

Shipped v1.6 on 2026-02-13. End-to-end AWS setup with root credential handling and streamlined workflow:

- **Wizard:** 7 prompts for project scaffolding (name, platforms, auth, features, region, theme) + optional git setup
- **Git setup:** Optional GitHub repo URL prompt after generation (git init, commit, push, auto-create repo)
- **setup-aws-envs:** Root credential detection, admin user creation, AWS Organization, dev/stage/prod accounts, deployment IAM users/keys, CDK bootstrap, continuation prompt to initialize-github
- **initialize-github:** Reads deployment credentials from config, pushes to GitHub secrets (no AWS operations). Supports batch mode (--all flag) and single-environment mode.
- **Validation:** 14-config test matrix validates all platform/auth combinations build and pass tests
- **Tests:** 146 passing across 10 test suites

Tech stack:
- TypeScript with ES modules (~9,083 LOC)
- `prompts` library for interactive wizard
- AWS SDK v3 (Organizations, IAM, STS)
- GitHub REST API with libsodium-wrappers encryption (crypto_box_seal)
- `@octokit/rest` for GitHub repository creation during git setup
- Template-based generation with `{{TOKEN}}` substitution
- Conditional Handlebars blocks for platform/feature-specific code
- Test harness with execa for E2E validation

## Requirements

### Validated

- ✓ Interactive wizard for project configuration — v1.0
- ✓ Platform selection (web, mobile, api) — v1.0
- ✓ Authentication providers (Cognito, Auth0) — v1.0
- ✓ GitHub Actions CI/CD workflows — v1.0
- ✓ AWS CDK infrastructure templates — v1.0
- ✓ Token-based template generation — v1.0
- ✓ Nx monorepo structure — v1.1.0
- ✓ AWS Organizations structure creation (dev, stage, prod accounts) — v1.2.0
- ✓ Direct AWS API calls to create Organization and accounts during generation — v1.2.0
- ✓ New CLI command for GitHub deployment setup (`setup-github`) — v1.2.0
- ✓ IAM deployment user creation per environment — v1.2.0
- ✓ Automatic GitHub secrets configuration for each environment — v1.2.0
- ✓ Backward compatibility with v1.1.0 generated projects — v1.2.0
- ✓ Lean main wizard without AWS Organizations prompts — v1.3.0
- ✓ `setup-aws-envs` command for AWS Organization setup — v1.3.0
- ✓ `initialize-github <env>` command for per-environment GitHub setup — v1.3.0
- ✓ Commands run from inside generated project directory — v1.3.0
- ✓ CLI command routing with project context detection — v1.3.0
- ✓ Post-install workflow documentation — v1.3.0
- ✓ README template for generated projects — v1.3.0
- ✓ Test harness for programmatic project generation — v1.4.0
- ✓ Validation of platform combinations (web, mobile, api) — v1.4.0
- ✓ Validation of auth providers (Cognito, Auth0) — v1.4.0
- ✓ Local test runner (`npm run test:e2e`) — v1.4.0
- ✓ CI workflow for PR validation (core configs) — v1.4.0
- ✓ CI workflow for release validation (full matrix) — v1.4.0
- ✓ GitHub secrets encryption with libsodium crypto_box_seal — v1.5.0
- ✓ libsodium-wrappers ESM loading via createRequire CJS fallback — v1.5.0
- ✓ @testing-library/dom peer dependency in generated web projects — v1.5.0
- ✓ @testing-library/react-native/extend-expect migration — v1.5.0
- ✓ Jest 30 + Expo SDK 53 compatibility (jest-jasmine2) — v1.5.0
- ✓ Idempotent CLI commands with tag-based IAM user adoption — v1.5.0
- ✓ CLI argument passthrough for project name — v1.5.1
- ✓ Correct package name references in help text and templates — v1.5.1
- ✓ Optional GitHub repository setup after project generation — v1.5.1
- ✓ Root credential detection via STS GetCallerIdentity — v1.6
- ✓ Automatic IAM admin user creation when root detected — v1.6
- ✓ Admin credentials for cross-account role assumption — v1.6
- ✓ Skip email prompts for existing accounts on re-run — v1.6
- ✓ End-to-end setup-aws-envs completion (org + accounts + IAM users + CDK bootstrap) — v1.6
- ✓ End-to-end initialize-github completion with config-based credentials — v1.6
- ✓ Batch mode for initialize-github (--all flag) — v1.6
- ✓ Continuation prompt from setup-aws-envs to initialize-github — v1.6
- ✓ Automated CDK bootstrap in every environment account — v1.6

### Active

(None — run `/gsd:new-milestone` to define next milestone requirements)

### Out of Scope

- Multi-region deployment support — deferred to future version
- SSO/IAM Identity Center integration — complexity, admin IAM user sufficient
- Cost budgets/alerts per environment — nice-to-have, not core
- MFA enforcement on admin user — UX friction, deferred to user's own security hardening
- Performance optimizations (cached npm install, parallel validation) — future enhancement
- Watch mode for template development — future enhancement

## Constraints

- **Backward compatibility**: Existing generated projects must continue to work
- **AWS permissions**: Users need sufficient AWS permissions to create Organizations
- **GitHub token**: GitHub secrets setup requires a PAT with appropriate scopes
- **Project context**: Post-install commands must run from inside generated project

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Direct AWS API for org creation | Users want immediate org setup, not separate deploy step | ✓ Good |
| Separate CLI command for GitHub setup | Decouples concerns, can be run independently | ✓ Good |
| Three environments (dev/stage/prod) | Industry standard, matches existing workflow templates | ✓ Good |
| Sequential account creation | AWS rate limits prevent parallel creation | ✓ Good |
| GitHub Environments for credentials | Cleaner than suffixed repo secrets, native GitHub feature | ✓ Good |
| libsodium-wrappers for encryption | tweetnacl lacks Blake2b needed for GitHub sealed box; libsodium implements crypto_box_seal correctly | ✓ Good |
| Handlebars conditionals for ORG_ENABLED | Preserves backward compatibility cleanly | ✓ Good |
| Extract AWS/GitHub setup from wizard | Simpler wizard, flexibility, better error handling | ✓ Good |
| Per-environment GitHub init | Granular control, better error isolation | ✓ Good |
| Commands run from project directory | Reads project config, simpler UX | ✓ Good |
| Switch-based command routing | Simple and readable for current command count | ✓ Good |
| find-up for project context | ESM-native, clean API for upward config search | ✓ Good |
| Config file with configVersion | Future compatibility for schema changes | ✓ Good |
| Ora spinner for AWS operations | Clear progress feedback for long operations | ✓ Good |
| Sequential email prompts | Avoids TypeScript self-reference in validation | ✓ Good |
| Platform tokens for README | Conditional documentation per platform selection | ✓ Good |
| Try-finally temp dir cleanup | Guarantee cleanup even when test throws | ✓ Good |
| 10-minute timeout per validation step | Balance between catching hangs and allowing slow builds | ✓ Good |
| Tiered test matrix (smoke/core/full) | Balance speed vs coverage for different contexts | ✓ Good |
| CI detection for progress display | TTY spinners for local, plain logging for CI | ✓ Good |
| fail-fast: false in CI | Report all config failures, not just first | ✓ Good |

| createRequire for CJS loading | libsodium-wrappers ESM build has broken relative import; CJS build works via createRequire | ✓ Good |
| jest-jasmine2 for mobile tests | Jest 30 jest-circus runner conflicts with Expo SDK 53 runtime | ✓ Good |
| @testing-library/react-native/extend-expect | @testing-library/jest-native deprecated; react-native v12.4+ includes extend-expect | ✓ Good |
| WizardOptions interface for extensibility | Clean configuration pattern, avoids mutating module exports | ✓ Good |
| First non-flag CLI arg as project name | Standard CLI convention (matches npm, git, etc.) | ✓ Good |
| Optional git setup with empty-to-skip | Non-intrusive UX, pressing Enter skips entirely | ✓ Good |
| PAT cleanup from .git/config after push | Security: PAT should not persist on disk | ✓ Good |
| Non-fatal git setup errors | Git is convenience, not core — project is still usable | ✓ Good |
| @octokit/rest for repo creation | Official GitHub SDK, handles user vs org repos | ✓ Good |
| Root detection before operations | Prevents cross-account IAM failures with root creds | ✓ Good |
| Admin user in /admin/ path | Clean separation from /deployment/ users | ✓ Good |
| Tag-based admin adoption | ManagedBy tag enables idempotent re-runs | ✓ Good |
| AWS as source of truth for accounts | Organizations ListAccounts API authoritative, config syncs | ✓ Good |
| Deployment creds in config | Clean handoff from setup-aws-envs to initialize-github | ✓ Good |
| Zero AWS operations in initialize-github | Pure GitHub operations, reads config only | ✓ Good |
| STS AssumeRole for CDK bootstrap | Temporary cross-account credentials for bootstrap | ✓ Good |
| Batch mode for initialize-github | --all flag or multiple args, single PAT prompt | ✓ Good |
| Continuation prompt after AWS setup | Defaults to yes, natural workflow progression | ✓ Good |
| Direct function chaining for continuation | Import/call pattern, not subprocess spawn | ✓ Good |

---
*Last updated: 2026-02-13 after v1.6 milestone*
