# create-aws-starter-kit

## What This Is

An npx CLI tool that scaffolds full-stack AWS projects with React web, React Native mobile, Lambda API, and CDK infrastructure. Provides a lean wizard for project generation with separate post-install commands for AWS and GitHub setup. Includes automated validation of all 14 generated project configurations.

## Core Value

Generated projects have production-ready multi-environment AWS infrastructure with automated CI/CD from day one.

## Current Milestone: v1.5.1 Fixes & Git Setup

**Goal:** Fix CLI arg handling and docs, add optional git repo initialization after project generation.

**Target features:**
- Fix: project name from `npx create-aws-project <name>` not used by wizard
- Fix: docs show wrong command for AWS Organizations setup
- Feature: optional git hookup after generation (wizard prompt for repo URL, git init + remote + push, create repo if missing)

## Current State (v1.5.0)

Shipped v1.5.0 on 2026-01-31. Stable release with corrected encryption, template dependencies, and hardened CLI commands:

- **Wizard:** 7 prompts for project scaffolding (name, platforms, auth, features, region, theme)
- **setup-aws-envs:** Creates AWS Organization and dev/stage/prod accounts
- **initialize-github <env>:** Configures GitHub Environment with AWS credentials
- **Validation:** 14-config test matrix validates all platform/auth combinations build and pass tests

Tech stack:
- TypeScript with ES modules (~11,900 LOC)
- `prompts` library for interactive wizard
- AWS SDK v3 (Organizations, IAM, STS)
- GitHub REST API with libsodium-wrappers encryption (crypto_box_seal)
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

### Active

- Fix project name CLI argument not passed to wizard — v1.5.1
- Fix docs showing wrong AWS Organizations command — v1.5.1
- Optional git repo setup after project generation — v1.5.1

### Out of Scope

- Multi-region deployment support — deferred to future version
- SSO/IAM Identity Center integration — complexity
- Cost budgets/alerts per environment — nice-to-have, not core
- `initialize-github all` option — users run per-environment for granular control
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

---
*Last updated: 2026-02-01 after v1.5.1 milestone started*
