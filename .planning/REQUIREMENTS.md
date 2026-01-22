# Requirements: create-aws-starter-kit v1.3.0

**Defined:** 2026-01-21
**Core Value:** Generated projects have production-ready multi-environment AWS infrastructure with automated CI/CD from day one.

## v1 Requirements

Requirements for v1.3.0 CLI Architecture Refactor. Each maps to roadmap phases.

### Wizard Simplification

- [ ] **WIZ-01**: Main wizard only prompts for project name, platforms, auth, features, region, theme
- [ ] **WIZ-02**: AWS Organizations prompts removed from main wizard flow
- [ ] **WIZ-03**: Generated project includes config file for post-install commands to read

### setup-aws-envs Command

- [ ] **AWS-01**: User can run `setup-aws-envs` from inside generated project
- [ ] **AWS-02**: Command creates AWS Organization if not exists
- [ ] **AWS-03**: Command creates environment accounts (dev, stage, prod)
- [ ] **AWS-04**: Command stores account IDs in project config for other commands
- [ ] **AWS-05**: Command shows progress and handles errors gracefully

### initialize-github Command

- [ ] **GH-01**: User can run `initialize-github <env>` from inside generated project
- [ ] **GH-02**: Command accepts environment name as required argument (dev, stage, prod)
- [ ] **GH-03**: Command creates IAM deployment user for specified environment
- [ ] **GH-04**: Command configures GitHub Environment with AWS credentials
- [ ] **GH-05**: Command validates environment exists in project config before proceeding

### CLI Infrastructure

- [ ] **CLI-01**: CLI entry point routes to correct command based on arguments
- [ ] **CLI-02**: Commands detect when not run from inside valid project directory
- [ ] **CLI-03**: Existing `setup-github` command removed/deprecated

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Enhanced Commands

- **ENH-01**: `initialize-github all` option to set up all environments at once
- **ENH-02**: `setup-aws-envs --dry-run` to preview what would be created
- **ENH-03**: `status` command to show current project configuration state

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| `initialize-github all` | Users run per-environment for granular control and error isolation |
| Commands work from anywhere with path arg | Simpler UX to require running from project directory |
| Multi-region deployment | Deferred to future version |
| SSO/IAM Identity Center | Complexity |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| WIZ-01 | TBD | Pending |
| WIZ-02 | TBD | Pending |
| WIZ-03 | TBD | Pending |
| AWS-01 | TBD | Pending |
| AWS-02 | TBD | Pending |
| AWS-03 | TBD | Pending |
| AWS-04 | TBD | Pending |
| AWS-05 | TBD | Pending |
| GH-01 | TBD | Pending |
| GH-02 | TBD | Pending |
| GH-03 | TBD | Pending |
| GH-04 | TBD | Pending |
| GH-05 | TBD | Pending |
| CLI-01 | TBD | Pending |
| CLI-02 | TBD | Pending |
| CLI-03 | TBD | Pending |

**Coverage:**
- v1 requirements: 16 total
- Mapped to phases: 0
- Unmapped: 16 ⚠️

---
*Requirements defined: 2026-01-21*
*Last updated: 2026-01-21 after initial definition*
