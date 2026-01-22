# Requirements: create-aws-starter-kit v1.3.0

**Defined:** 2026-01-21
**Core Value:** Generated projects have production-ready multi-environment AWS infrastructure with automated CI/CD from day one.

## v1 Requirements

Requirements for v1.3.0 CLI Architecture Refactor. Each maps to roadmap phases.

### CLI Infrastructure

- [x] **CLI-01**: CLI entry point routes to correct command based on arguments
- [x] **CLI-02**: Commands detect when not run from inside valid project directory
- [x] **CLI-03**: Existing `setup-github` command removed/deprecated

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

### Documentation

- [ ] **DOC-01**: README.md updated with new CLI commands and usage
- [ ] **DOC-02**: Wizard prompts section reflects simplified flow (no AWS Organizations)
- [ ] **DOC-03**: Post-install setup workflow documented (setup-aws-envs → initialize-github)

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
| CLI-01 | Phase 4 | Complete |
| CLI-02 | Phase 4 | Complete |
| CLI-03 | Phase 4 | Complete |
| WIZ-01 | Phase 5 | Pending |
| WIZ-02 | Phase 5 | Pending |
| WIZ-03 | Phase 5 | Pending |
| AWS-01 | Phase 6 | Pending |
| AWS-02 | Phase 6 | Pending |
| AWS-03 | Phase 6 | Pending |
| AWS-04 | Phase 6 | Pending |
| AWS-05 | Phase 6 | Pending |
| GH-01 | Phase 7 | Pending |
| GH-02 | Phase 7 | Pending |
| GH-03 | Phase 7 | Pending |
| GH-04 | Phase 7 | Pending |
| GH-05 | Phase 7 | Pending |
| DOC-01 | Phase 8 | Pending |
| DOC-02 | Phase 8 | Pending |
| DOC-03 | Phase 8 | Pending |

**Coverage:**
- v1 requirements: 19 total
- Mapped to phases: 19
- Unmapped: 0 ✓

---
*Requirements defined: 2026-01-21*
*Last updated: 2026-01-22 after Phase 4 completion*
