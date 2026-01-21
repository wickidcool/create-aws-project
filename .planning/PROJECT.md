# create-aws-starter-kit v1.3.0

## What This Is

An npx CLI tool that scaffolds full-stack AWS projects with React web, React Native mobile, Lambda API, and CDK infrastructure. Version 1.3.0 refactors the CLI architecture to separate project generation from AWS/GitHub setup, providing a lean wizard and flexible post-install commands.

## Core Value

Generated projects have production-ready multi-environment AWS infrastructure with automated CI/CD from day one.

## Current Milestone: v1.3.0 CLI Architecture Refactor

**Goal:** Simplify the main wizard by extracting AWS and GitHub setup into separate post-install commands.

**Target features:**
- Lean main wizard (`create-aws-project`) — only project scaffolding
- `setup-aws-envs` command — AWS Organization and environment accounts
- `initialize-github <env>` command — GitHub Environment setup per environment
- Remove AWS Organizations prompts from main wizard
- Rename `setup-github` to `initialize-github <env>`

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

### Active

- [ ] Lean main wizard without AWS Organizations prompts
- [ ] `setup-aws-envs` command for AWS Organization setup
- [ ] `initialize-github <env>` command for per-environment GitHub setup
- [ ] Commands run from inside generated project directory
- [ ] Remove/refactor existing AWS setup from wizard flow

### Out of Scope

- Multi-region deployment support — deferred to future version
- SSO/IAM Identity Center integration — complexity
- Cost budgets/alerts per environment — nice-to-have, not core
- `initialize-github all` option — users run per-environment for granular control

## Context

Shipped v1.2.0 with ~9,500 LOC TypeScript/YAML/JSON.

Tech stack:
- TypeScript with ES modules
- `prompts` library for interactive wizard
- AWS SDK v3 (Organizations, IAM, STS)
- GitHub REST API with tweetnacl encryption
- Template-based generation with `{{TOKEN}}` substitution
- Conditional Handlebars blocks for platform/feature-specific code

Current template structure in `templates/`:
- `root/` - Shared monorepo config (package.json, nx.json, tsconfig)
- `apps/web/` - React + Vite + Chakra UI
- `apps/mobile/` - React Native + Expo
- `apps/api/` - Lambda handlers + CDK stacks
- `.github/` - CI/CD workflows with environment-specific deployment

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
| Extract AWS/GitHub setup from wizard | Simpler wizard, flexibility, better error handling | — Pending |
| Per-environment GitHub init | Granular control, better error isolation | — Pending |
| Commands run from project directory | Reads project config, simpler UX | — Pending |

---
*Last updated: 2026-01-21 after v1.3 milestone start*
