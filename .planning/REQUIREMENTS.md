# Requirements: create-aws-project v1.6

**Defined:** 2026-02-10
**Core Value:** Generated projects have production-ready multi-environment AWS infrastructure with automated CI/CD from day one.

## v1.6 Requirements

### Root Credential Handling

- [x] **ROOT-01**: CLI detects root credentials via STS GetCallerIdentity before any cross-account operations
- [x] **ROOT-02**: When root detected, CLI creates an IAM admin user in the management account with AdministratorAccess policy
- [x] **ROOT-03**: CLI generates access keys for the admin user and switches to those credentials for subsequent operations
- [x] **ROOT-04**: CLI retries IAM operations with exponential backoff to handle eventual consistency (3-4s window)
- [x] **ROOT-05**: On re-run, CLI adopts existing admin user via tag-based matching instead of creating a duplicate
- [x] **ROOT-06**: CLI handles access key limit (2 max) by detecting existing keys before creating new ones

### Idempotent Setup

- [x] **IDEM-01**: `setup-aws-envs` skips email prompts for accounts that already exist in config
- [x] **IDEM-02**: `setup-aws-envs` only prompts for emails of accounts that need to be created
- [x] **IDEM-03**: Partial re-runs resume from last successful step without re-prompting completed steps

### Architecture Simplification

- [x] **ARCH-01**: `setup-aws-envs` creates deployment IAM users and access keys in child accounts (moved from `initialize-github`)
- [x] **ARCH-02**: Deployment credentials are stored in project config for `initialize-github` to consume
- [x] **ARCH-03**: `initialize-github` reads stored credentials from config and pushes to GitHub secrets (no AWS operations)
- [x] **ARCH-04**: `initialize-github` continues to handle GitHub PAT prompt, environment selection, and secret encryption

## Future Requirements

### Enhanced Credential Management

- **CRED-01**: Optional root access key deletion after admin user creation
- **CRED-02**: Admin credential rotation guidance after initial setup
- **CRED-03**: AWS Secrets Manager integration for credential storage

## Out of Scope

| Feature | Reason |
|---------|--------|
| SSO/IAM Identity Center | Complexity — admin IAM user is sufficient for CLI bootstrapping |
| MFA enforcement on admin user | Adds UX friction, deferred to user's own security hardening |
| Automatic AWS CLI profile configuration | Users manage their own AWS CLI config |
| Multiple project admin users | Single admin per management account is sufficient |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| ROOT-01 | Phase 17 | Complete |
| ROOT-02 | Phase 17 | Complete |
| ROOT-03 | Phase 17 | Complete |
| ROOT-04 | Phase 17 | Complete |
| ROOT-05 | Phase 17 | Complete |
| ROOT-06 | Phase 17 | Complete |
| IDEM-01 | Phase 19 | Complete |
| IDEM-02 | Phase 19 | Complete |
| IDEM-03 | Phase 19 | Complete |
| ARCH-01 | Phase 18 | Complete |
| ARCH-02 | Phase 18 | Complete |
| ARCH-03 | Phase 18 | Complete |
| ARCH-04 | Phase 18 | Complete |

**Coverage:**
- v1.6 requirements: 13 total
- Mapped to phases: 13
- Unmapped: 0

---
*Requirements defined: 2026-02-10*
*Last updated: 2026-02-11 after Phase 19 completion*
