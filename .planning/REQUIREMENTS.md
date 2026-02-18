# Requirements: create-aws-project v1.7

**Defined:** 2026-02-18
**Core Value:** Generated projects have production-ready multi-environment AWS infrastructure with automated CI/CD from day one.

## v1.7 Requirements

### Non-Interactive Mode

- [x] **NI-01**: CLI accepts `--config <path>` flag pointing to a JSON config file
- [x] **NI-02**: When `--config` is provided, wizard runs without any interactive prompts
- [x] **NI-03**: Config schema covers all wizard values: `name`, `platforms`, `auth`, `authFeatures`, `features`, `region`, `brandColor`
- [x] **NI-04**: Only `name` is required; all other fields default to wizard defaults (`platforms: ["web","api"]`, `auth: "none"`, `features: ["github-actions","vscode-config"]`, `region: "us-east-1"`, `brandColor: "blue"`)
- [x] **NI-05**: Invalid config values produce a clear error listing all validation failures (no fallback to prompting)
- [x] **NI-06**: Git setup is skipped in non-interactive mode
- [ ] **NI-07**: `setup-aws-envs --config <path>` accepts config with `email` field for root email
- [ ] **NI-08**: Environment emails auto-generated from root email by inserting `-{env}` before `@` (e.g., `user@example.com` → `user-dev@example.com`)
- [ ] **NI-09**: `setup-aws-envs` skips all interactive prompts when `--config` is provided

### Template Fixes

- [x] **FIX-01**: App.spec.tsx test mock supports configurable auth state (fetch on mount only when authenticated)

## Future Requirements

### Extended Non-Interactive Support

- **NI-EXT-01**: `initialize-github --config <path>` for non-interactive GitHub setup
- **NI-EXT-02**: JSON output mode for structured AI-readable output
- **NI-EXT-03**: CLI flags as alternative to config file (`--name`, `--platforms`, etc.)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Non-interactive initialize-github | Deferred — focus on wizard and AWS setup first |
| CLI flags for individual values | Config file sufficient for AI agents, flags add complexity |
| YAML/TOML config support | JSON is the universal AI interchange format |
| Config file generation command | AI agents can generate JSON directly |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| FIX-01 | Phase 23 | Done |
| NI-01 | Phase 24 | Complete |
| NI-02 | Phase 24 | Complete |
| NI-03 | Phase 24 | Complete |
| NI-04 | Phase 24 | Complete |
| NI-05 | Phase 24 | Complete |
| NI-06 | Phase 24 | Complete |
| NI-07 | Phase 25 | Pending |
| NI-08 | Phase 25 | Pending |
| NI-09 | Phase 25 | Pending |

**Coverage:**
- v1.7 requirements: 10 total
- Mapped to phases: 10
- Unmapped: 0

---
*Requirements defined: 2026-02-18*
