# Roadmap: create-aws-starter-kit v1.2.0

## Overview

Version 1.2.0 adds AWS Organizations support with automatic creation of dev/stage/prod accounts, plus a new CLI command for configuring GitHub Actions deployment credentials. The work progresses from AWS infrastructure setup, to GitHub integration tooling, to template updates that tie everything together.

## Domain Expertise

None

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

- [ ] **Phase 1: AWS Organizations Foundation** - Wizard prompts and AWS SDK integration for org/account creation
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
- [ ] 01-01: Add org structure wizard prompts and types
- [ ] 01-02: AWS Organizations SDK integration and account creation
- [ ] 01-03: Cross-account IAM role setup

### Phase 2: GitHub Deployment Command
**Goal**: New CLI command (`setup-github` or similar) that creates IAM deployment users per environment and configures GitHub repository secrets
**Depends on**: Phase 1
**Research**: Likely (GitHub API for secrets, IAM policy patterns)
**Research topics**: GitHub REST API for secrets, minimal IAM permissions for CDK deploy, secure credential handling
**Plans**: TBD

Plans:
- [ ] 02-01: New CLI command structure and GitHub API integration
- [ ] 02-02: IAM deployment user creation with least-privilege policies
- [ ] 02-03: GitHub secrets configuration per environment

### Phase 3: Template Updates & Integration
**Goal**: CDK templates support multi-account deployment, GitHub workflows use environment-specific credentials
**Depends on**: Phase 2
**Research**: Unlikely (updating existing patterns)
**Plans**: TBD

Plans:
- [ ] 03-01: CDK stack updates for cross-account deployment
- [ ] 03-02: GitHub workflow updates for multi-environment secrets
- [ ] 03-03: Documentation and backward compatibility testing

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. AWS Organizations Foundation | 0/3 | Not started | - |
| 2. GitHub Deployment Command | 0/3 | Not started | - |
| 3. Template Updates & Integration | 0/3 | Not started | - |
