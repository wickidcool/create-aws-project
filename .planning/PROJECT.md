# create-aws-starter-kit v1.2.0

## What This Is

An npx CLI tool that scaffolds full-stack AWS projects with React web, React Native mobile, Lambda API, and CDK infrastructure. Version 1.2.0 adds AWS Organizations support with separate accounts per environment (dev, stage, prod) and automated GitHub Actions deployment credentials.

## Core Value

Generated projects have production-ready multi-environment AWS infrastructure with automated CI/CD from day one.

## Requirements

### Validated

- ✓ Interactive wizard for project configuration — v1.0
- ✓ Platform selection (web, mobile, api) — v1.0
- ✓ Authentication providers (Cognito, Auth0) — v1.0
- ✓ GitHub Actions CI/CD workflows — v1.0
- ✓ AWS CDK infrastructure templates — v1.0
- ✓ Token-based template generation — v1.0
- ✓ Nx monorepo structure — v1.1.0

### Active

- [ ] AWS Organizations structure creation (dev, stage, prod accounts)
- [ ] Direct AWS API calls to create Organization and accounts during generation
- [ ] New CLI command for GitHub deployment setup (`setup-github` or similar)
- [ ] IAM deployment user creation per environment
- [ ] Automatic GitHub secrets configuration for each environment
- [ ] Backward compatibility with v1.1.0 generated projects

### Out of Scope

- Multi-region deployment support — deferred to future version
- SSO/IAM Identity Center integration — complexity for v1.2
- Cost budgets/alerts per environment — nice-to-have, not core

## Context

This is a brownfield project with existing v1.1.0 codebase. The CLI tool uses:
- TypeScript with ES modules
- `prompts` library for interactive wizard
- Template-based generation with `{{TOKEN}}` substitution
- Conditional blocks for platform/feature-specific code

Current template structure in `templates/` includes:
- `root/` - Shared monorepo config (package.json, nx.json, tsconfig)
- `apps/web/` - React + Vite + Chakra UI
- `apps/mobile/` - React Native + Expo
- `apps/api/` - Lambda handlers + CDK stacks
- `.github/` - CI/CD workflows

The CDK infrastructure already includes:
- DynamoDB tables
- Lambda functions
- API Gateway
- CloudFront + S3 static hosting
- Cognito/Auth0 authentication stacks

## Constraints

- **Backward compatibility**: Existing v1.1.0 generated projects must continue to work
- **AWS permissions**: Users need sufficient AWS permissions to create Organizations
- **GitHub token**: GitHub secrets setup requires a PAT with appropriate scopes

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Direct AWS API for org creation | Users want immediate org setup, not separate deploy step | — Pending |
| Separate CLI command for GitHub setup | Decouples concerns, can be run independently | — Pending |
| Three environments (dev/stage/prod) | Industry standard, matches existing workflow templates | — Pending |

---
*Last updated: 2026-01-20 after initialization*
