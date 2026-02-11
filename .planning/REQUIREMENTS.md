# Requirements: create-aws-project v1.6

**Defined:** 2026-02-10
**Core Value:** Generated projects have production-ready multi-environment AWS infrastructure with automated CI/CD from day one.

## v1.6 Requirements

### Root Credential Handling

- [ ] **ROOT-01**: CLI detects root credentials via STS GetCallerIdentity before any cross-account operations
- [ ] **ROOT-02**: When root detected, CLI creates an IAM admin user in the management account with AdministratorAccess policy
- [ ] **ROOT-03**: CLI generates access keys for the admin user and switches to those credentials for subsequent operations
- [ ] **ROOT-04**: CLI retries IAM operations with exponential backoff to handle eventual consistency (3-4s window)
- [ ] **ROOT-05**: On re-run, CLI adopts existing admin user via tag-based matching instead of creating a duplicate
- [ ] **ROOT-06**: CLI handles access key limit (2 max) by detecting existing keys before creating new ones

### Idempotent Setup

- [ ] **IDEM-01**: `setup-aws-envs` skips email prompts for accounts that already exist in config
- [ ] **IDEM-02**: `setup-aws-envs` only prompts for emails of accounts that need to be created
- [ ] **IDEM-03**: Partial re-runs resume from last successful step without re-prompting completed steps

### Architecture Simplification

- [ ] **ARCH-01**: `setup-aws-envs` creates deployment IAM users and access keys in child accounts (moved from `initialize-github`)
- [ ] **ARCH-02**: Deployment credentials are stored in project config for `initialize-github` to consume
- [ ] **ARCH-03**: `initialize-github` reads stored credentials from config and pushes to GitHub secrets (no AWS operations)
- [ ] **ARCH-04**: `initialize-github` continues to handle GitHub PAT prompt, environment selection, and secret encryption

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
| ROOT-01 | TBD | Pending |
| ROOT-02 | TBD | Pending |
| ROOT-03 | TBD | Pending |
| ROOT-04 | TBD | Pending |
| ROOT-05 | TBD | Pending |
| ROOT-06 | TBD | Pending |
| IDEM-01 | TBD | Pending |
| IDEM-02 | TBD | Pending |
| IDEM-03 | TBD | Pending |
| ARCH-01 | TBD | Pending |
| ARCH-02 | TBD | Pending |
| ARCH-03 | TBD | Pending |
| ARCH-04 | TBD | Pending |

**Coverage:**
- v1.6 requirements: 13 total
- Mapped to phases: 0
- Unmapped: 13

---
*Requirements defined: 2026-02-10*
*Last updated: 2026-02-10 after initial definition*
