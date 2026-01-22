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

- [x] **WIZ-01**: Main wizard only prompts for project name, platforms, auth, features, region, theme
- [x] **WIZ-02**: AWS Organizations prompts removed from main wizard flow
- [x] **WIZ-03**: Generated project includes config file for post-install commands to read

### setup-aws-envs Command

- [x] **AWS-01**: User can run `setup-aws-envs` from inside generated project
- [x] **AWS-02**: Command creates AWS Organization if not exists
- [x] **AWS-03**: Command creates environment accounts (dev, stage, prod)
- [x] **AWS-04**: Command stores account IDs in project config for other commands
- [x] **AWS-05**: Command shows progress and handles errors gracefully

### initialize-github Command

- [x] **GH-01**: User can run `initialize-github <env>` from inside generated project
- [x] **GH-02**: Command accepts environment name as required argument (dev, stage, prod)
- [x] **GH-03**: Command creates IAM deployment user for specified environment
- [x] **GH-04**: Command configures GitHub Environment with AWS credentials
- [x] **GH-05**: Command validates environment exists in project config before proceeding

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
| WIZ-01 | Phase 5 | Complete |
| WIZ-02 | Phase 5 | Complete |
| WIZ-03 | Phase 5 | Complete |
| AWS-01 | Phase 6 | Complete |
| AWS-02 | Phase 6 | Complete |
| AWS-03 | Phase 6 | Complete |
| AWS-04 | Phase 6 | Complete |
| AWS-05 | Phase 6 | Complete |
| GH-01 | Phase 7 | Complete |
| GH-02 | Phase 7 | Complete |
| GH-03 | Phase 7 | Complete |
| GH-04 | Phase 7 | Complete |
| GH-05 | Phase 7 | Complete |
| DOC-01 | Phase 8 | Pending |
| DOC-02 | Phase 8 | Pending |
| DOC-03 | Phase 8 | Pending |

**Coverage:**
- v1 requirements: 19 total
- Mapped to phases: 19
- Unmapped: 0 ✓

---
*Requirements defined: 2026-01-21*
*Last updated: 2026-01-22 after Phase 7 completion*
