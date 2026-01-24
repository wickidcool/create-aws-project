# create-aws-starter-kit

## What This Is

An npx CLI tool that scaffolds full-stack AWS projects with React web, React Native mobile, Lambda API, and CDK infrastructure. Provides a lean wizard for project generation with separate post-install commands for AWS and GitHub setup.

## Core Value

Generated projects have production-ready multi-environment AWS infrastructure with automated CI/CD from day one.

## Current Milestone: v1.4 Generated Project Validation

**Goal:** Ensure all generated project configurations build and pass tests.

**Target features:**
- Test harness for generating projects with different platform/auth configs
- Validation pipeline: npm install → build → tests pass
- Local test runner for developers
- Tiered CI: core configs on PRs, full 14-config matrix on releases

## Current State (v1.3.0)

Shipped v1.3.0 on 2026-01-23. CLI now separates concerns:
- **Wizard:** 7 prompts for project scaffolding (name, platforms, auth, features, region, theme)
- **setup-aws-envs:** Creates AWS Organization and dev/stage/prod accounts
- **initialize-github <env>:** Configures GitHub Environment with AWS credentials

Tech stack:
- TypeScript with ES modules (~9,600 LOC)
- `prompts` library for interactive wizard
- AWS SDK v3 (Organizations, IAM, STS)
- GitHub REST API with tweetnacl encryption
- Template-based generation with `{{TOKEN}}` substitution
- Conditional Handlebars blocks for platform/feature-specific code

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

### Active

- [ ] Test harness for programmatic project generation
- [ ] Validation of platform combinations (web, mobile, api)
- [ ] Validation of auth providers (Cognito, Auth0)
- [ ] Local test runner (npm test)
- [ ] CI workflow for PR validation (core configs)
- [ ] CI workflow for release validation (full matrix)

### Out of Scope

- Multi-region deployment support — deferred to future version
- SSO/IAM Identity Center integration — complexity
- Cost budgets/alerts per environment — nice-to-have, not core
- `initialize-github all` option — users run per-environment for granular control

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
| tweetnacl for encryption | Lighter weight than libsodium-wrappers | ✓ Good |
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

---
*Last updated: 2026-01-23 after v1.4 milestone started*
