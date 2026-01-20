# Roadmap: create-aws-starter-kit v1.2.0

## Overview

Version 1.2.0 adds AWS Organizations support with automatic creation of dev/stage/prod accounts, plus a new CLI command for configuring GitHub Actions deployment credentials. The work progresses from AWS infrastructure setup, to GitHub integration tooling, to template updates that tie everything together.

## Domain Expertise

None

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

- [x] **Phase 1: AWS Organizations Foundation** - Wizard prompts and AWS SDK integration for org/account creation
- [ ] **Phase 2: GitHub Deployment Command** - New CLI command for IAM user and GitHub secrets setup
- [ ] **Phase 3: Template Updates & Integration** - Multi-account CDK templates and workflow updates

## Phase Details

### Phase 1: AWS Organizations Foundation
**Goal**: Users can opt into AWS Organizations during project generation, with automatic creation of Organization and environment accounts (dev, stage, prod)
**Depends on**: Nothing (first phase)
**Research**: Likely (AWS Organizations API, account creation patterns)
**Research topics**: AWS Organizations SDK, account creation limits/quotas, cross-account role patterns
**Plans**: TBD

Plans:
- [x] 01-01: Add org structure wizard prompts and types
- [x] 01-02: AWS Organizations SDK integration and account creation
- [x] 01-03: CLI integration and template tokens

### Phase 2: GitHub Deployment Command
**Goal**: New CLI command (`setup-github` or similar) that creates IAM deployment users per environment and configures GitHub repository secrets
**Depends on**: Phase 1
**Research**: Likely (GitHub API for secrets, IAM policy patterns)
**Research topics**: GitHub REST API for secrets, minimal IAM permissions for CDK deploy, secure credential handling
**Plans**: 3 plans in 2 waves

Plans:
- [x] 02-01: IAM SDK module for deployment user creation (Wave 1)
- [x] 02-02: GitHub API module for repository secrets (Wave 1)
- [x] 02-03: CLI command integration with human verification (Wave 2)

### Phase 3: Template Updates & Integration
**Goal**: CDK templates support multi-account deployment, GitHub workflows use environment-specific credentials
**Depends on**: Phase 2
**Research**: Unlikely (updating existing patterns)
**Plans**: TBD

Plans:
- [x] 03-01: CDK stack updates for cross-account deployment
- [ ] 03-02: GitHub workflow updates for multi-environment secrets
- [ ] 03-03: Documentation and backward compatibility testing

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. AWS Organizations Foundation | 3/3 | Complete | 2026-01-20 |
| 2. GitHub Deployment Command | 3/3 | Complete | 2026-01-20 |
| 3. Template Updates & Integration | 1/3 | In progress | - |
