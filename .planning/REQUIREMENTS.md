# Requirements: create-aws-starter-kit v1.4

**Defined:** 2026-01-23
**Core Value:** Generated projects have production-ready multi-environment AWS infrastructure with automated CI/CD from day one.

## v1.4 Requirements

Requirements for generated project validation. Each maps to roadmap phases.

### Test Harness Infrastructure

- [ ] **HARN-01**: Test harness can generate projects programmatically with any platform/auth configuration
- [ ] **HARN-02**: Each test run uses isolated temporary directory that doesn't pollute file system
- [ ] **HARN-03**: Validation pipeline runs npm install, npm run build, and npm test sequentially
- [ ] **HARN-04**: Validation captures exit codes and fails if any step returns non-zero
- [ ] **HARN-05**: Temporary directories are cleaned up after successful test runs

### Reporting

- [x] **REPT-01**: Failed validations display captured stdout/stderr for debugging
- [x] **REPT-02**: Developer can run validation locally via npm script (`npm run test:e2e` or similar)
- [x] **REPT-03**: Each validation step has timeout (10 minutes) to prevent hanging
- [x] **REPT-04**: Progress output shows which configuration is being tested (e.g., "Testing 1/14: web-api-cognito")
- [x] **REPT-05**: Summary table at end shows pass/fail status for all tested configurations

### CI Integration

- [ ] **CICD-01**: PR workflow runs validation on core configuration subset (3-4 representative configs)
- [ ] **CICD-02**: Release workflow runs validation on full 14-configuration matrix
- [ ] **CICD-03**: Configuration matrix supports tiered execution (core tier vs full tier)

## Future Requirements

Deferred to later milestones. Tracked but not in current roadmap.

### Performance Optimizations

- **PERF-01**: Cached npm install to speed up repeated runs
- **PERF-02**: Parallel test execution across configurations
- **PERF-03**: Incremental validation (only test changed templates)

### Developer Experience

- **DEVX-01**: Configuration subset selection for local debugging (`--config web-api-cognito`)
- **DEVX-02**: Structured JSON output for CI integration
- **DEVX-03**: Watch mode for template development

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Testing generated project runtime behavior | Out of scope - testing CLI, not user's app |
| Mocking npm install | Defeats purpose of validation |
| Testing every auth feature combination | Exponential explosion (14 -> 56+ configs) |
| Snapshot testing of generated files | Brittle, hard to maintain |
| Real AWS/GitHub API calls in tests | Requires credentials, slow, flaky |
| Testing node_modules contents | Not our responsibility |
| Mobile native builds (Expo/RN) | Requires macOS runners, defer to future |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| HARN-01 | Phase 11 | Complete |
| HARN-02 | Phase 10 | Complete |
| HARN-03 | Phase 11 | Complete |
| HARN-04 | Phase 11 | Complete |
| HARN-05 | Phase 10 | Complete |
| REPT-01 | Phase 13 | Complete |
| REPT-02 | Phase 13 | Complete |
| REPT-03 | Phase 11 | Complete |
| REPT-04 | Phase 13 | Complete |
| REPT-05 | Phase 13 | Complete |
| CICD-01 | Phase 14 | Pending |
| CICD-02 | Phase 14 | Pending |
| CICD-03 | Phase 12 | Complete |

**Coverage:**
- v1.4 requirements: 13 total
- Mapped to phases: 13
- Unmapped: 0

---
*Requirements defined: 2026-01-23*
*Last updated: 2026-01-24 after Phase 13 complete*
