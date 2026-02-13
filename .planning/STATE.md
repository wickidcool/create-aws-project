# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-10)

**Core value:** Generated projects have production-ready multi-environment AWS infrastructure with automated CI/CD from day one.
**Current focus:** v1.6 End-to-End AWS Setup

## Current Position

Phase: 21 of 22 (Fix AWS -> GitHub Setup) — COMPLETE
Plan: 2/2 complete
Status: Phase 21 complete. Phase 22 (CDK Bootstrap) is next.
Last activity: 2026-02-13 — Completed 21-02-PLAN.md (continuation prompt for setup-aws-envs)

Progress: [██████████████████░░] 21/22 phases complete (95% overall, 100% of v1.6 planned phases)
Note: All planned v1.6 phases complete. Phase 22 (CDK bootstrap) remains.

## Milestones

| Version | Name | Phases | Status | Shipped |
|---------|------|--------|--------|---------|
| v1.2 | AWS Organizations Support | 1-3 | Complete | 2026-01-20 |
| v1.3 | CLI Architecture Refactor | 4-9 | Complete | 2026-01-23 |
| v1.4 | Generated Project Validation | 10-14 | Complete | 2026-01-24 |
| v1.5 | Bug Fixes & Stability | 15 | Complete | 2026-01-31 |
| v1.5.1 | Fixes & Git Setup | 16 | Complete | 2026-02-01 |
| v1.6 | End-to-End AWS Setup | 17-22 | Active | — |

## Performance Metrics

### v1.2 Metrics

| Metric | Value |
|--------|-------|
| Phases completed | 3 |
| Plans executed | 8 |
| Duration | 2 days |
| LOC added/modified | ~2,500 |

### v1.3 Metrics

| Metric | Value |
|--------|-------|
| Phases completed | 6 |
| Plans executed | 8 |
| Duration | 3 days |
| Files modified | 49 |
| LOC total | ~9,600 |

### v1.4 Metrics

| Metric | Value |
|--------|-------|
| Phases completed | 5 |
| Plans executed | 5 |
| Duration | 2 days |
| Files modified | 47 |
| Commits | 38 |
| Lines added | +7,421 |
| LOC total | ~10,700 |

### v1.5 Metrics

| Metric | Value |
|--------|-------|
| Phases completed | 1 |
| Plans executed | 1 |
| Duration | 7 days |
| Files modified | 27 |
| Commits | 20 |
| Lines | +1,755 / -267 |
| LOC total | ~11,900 |
| Tests passing | 118/118 |

### v1.5.1 Metrics

| Metric | Value |
|--------|-------|
| Phases completed | 1 |
| Plans executed | 2 |
| Duration | 1 day |
| Files modified | 15 |
| Commits | 13 |
| Lines | +1,815 / -27 |
| LOC total | ~12,100 |
| Tests passing | 118/118 |

## Accumulated Context

### Decisions

All decisions logged in PROJECT.md Key Decisions table. Milestone archives in `.planning/milestones/` contain detailed phase decisions.

### Recent v1.6 Decisions

- **Architecture:** ALL AWS/IAM operations move to `setup-aws-envs`. `initialize-github` becomes read-config-and-push-to-GitHub only.
- **Root handling:** CLI detects root credentials and creates admin IAM user automatically (no manual user creation step).
- **Idempotent re-runs:** Skip email prompts for accounts that already exist in config.
- **Admin user path:** Store admin users in `/admin/` path (separate from deployment users in `/deployment/`)
- **Tag-based admin adoption:** Check `ManagedBy=create-aws-starter-kit` tag before adopting existing admin users
- **Retry on key creation:** Wrap admin access key creation in retry with exponential backoff for IAM eventual consistency
- **Root detection placement (17-02):** Root detection happens before collectEmails but after project context validation
- **Credential persistence strategy (17-02):** Admin credentials stored in memory for session, only userName+accessKeyId persisted to config
- **Conditional client creation (17-02):** Organizations and IAM clients check adminCredentials and create with explicit credentials when available
- **Skip behavior (17-02):** When adminUser exists in config, skip root detection entirely (user should have switched to IAM or admin exists)
- **Credential storage structure (18-01):** Store credentials as `Record<string, DeploymentCredentials>` in config, keyed by environment name
- **Idempotent credential handling (18-01):** Check existingCredentials before creating new keys, reuse existing if present
- **Partial failure resilience (18-01):** Call updateConfig after each successful key creation (same pattern as accounts/users)
- **Command separation (18-02):** initialize-github reads credentials from config (no AWS operations), setup-aws-envs handles all AWS/IAM
- **Credential validation (18-02):** Check config.deploymentCredentials at start, fail fast with helpful error directing to setup-aws-envs
- **Migration detection (18-02):** Detect projects with deploymentUsers but no credentials, show specific migration message
- **AWS as source of truth (19-01):** Organizations ListAccounts API is authoritative for existing accounts, config syncs with AWS state
- **Name pattern matching (19-01):** Discover accounts by matching {projectName}-{env} pattern against AWS account names
- **Conditional email prompting (19-01):** Only collect emails for environments that need account creation based on AWS discovery
- **Config sync after discovery (19-01):** Update config with discovered accounts immediately to stay in sync with AWS reality
- **STS AssumeRole for bootstrap credentials (22-01):** Use STS AssumeRole to get temporary credentials for CDK bootstrap in cross-account scenario
- **Environment variables for subprocess credentials (22-01):** Pass AWS credentials to npx cdk bootstrap via AWS_* environment variables
- **Idempotent bootstrap (22-01):** Always run CDK bootstrap (no check-before-run) since it's safe to run multiple times
- **Batch mode triggers (21-01):** initialize-github enters batch mode when --all flag present OR multiple positional args provided
- **Per-environment error collection (21-01):** Batch mode collects results per environment, continues on failure, reports summary at end
- **Backward compatibility (21-01):** Single-environment mode preserved exactly as-is for backward compatibility
- **Continuation prompt defaults (21-02):** setup-aws-envs continuation prompt defaults to yes (natural next step in workflow)
- **onCancel handling (21-02):** Prompts include onCancel handler for graceful Ctrl+C with helpful next-step message
- **Direct function chaining (21-02):** Command continuation uses direct function import/call, not subprocess spawn
- **Seamless workflow (21-02):** AWS -> GitHub flow reduced from 4 commands to 2 confirmation prompts via inline continuation

### Roadmap Evolution

- Phase 21 added: Fix AWS -> GitHub Setup
- Phase 22 added: Add CDK bootstrap to environment initialization

### Deferred Issues

None.

### Blockers/Concerns

None.

### Outstanding Todos

None.

## Session Continuity

Last session: 2026-02-13
Stopped at: Completed 21-02-PLAN.md (continuation prompt for setup-aws-envs)
Resume file: None
Next: Phase 22 (CDK bootstrap) or ship v1.6

---
*Updated: 2026-02-13 after completing Phase 21 Plan 02*
