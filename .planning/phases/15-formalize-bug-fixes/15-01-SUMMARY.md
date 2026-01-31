---
phase: 15-formalize-bug-fixes
plan: 01
subsystem: cli-commands
tags: [iam, idempotency, error-handling, libsodium, templates, jest, documentation]
requires: [14-validate-all-configs]
provides: [idempotent-cli-commands, verified-v1.5-fixes]
affects: [future-cli-enhancements]
tech-stack:
  added: []
  patterns: [idempotent-operations, tag-based-adoption, summary-tables]
key-files:
  created: []
  modified:
    - src/aws/iam.ts
    - src/commands/setup-aws-envs.ts
    - src/commands/initialize-github.ts
    - src/utils/project-context.ts
    - .planning/REQUIREMENTS.md
key-decisions:
  - "Adopt existing IAM users only if tagged with ManagedBy=create-aws-starter-kit (safer than blind adoption)"
  - "Access key limit detection before creation (AWS max 2 per user)"
  - "Summary table format for CLI output showing all environments at once"
  - "Deployment user name shown instead of full ARN (cleaner UX)"
duration: 4min
completed: 2026-01-31
---

# Phase 15 Plan 01: Formalize Bug Fixes Summary

**Hardened IAM operations with idempotent re-runs, verified libsodium encryption and template fixes**

## Performance

- **Duration**: 4 minutes
- **Build**: Passed with zero errors
- **Tests**: All 118 unit tests passed
- **Verification**: 12/12 checks passed (ENC-01/02/03, TPL-01/02/03, CLI-01/02/03, DOC-01)

## Accomplishments

### Verification Completed (Task 1)
- ✓ **ENC-01**: Confirmed libsodium-wrappers with crypto_box_seal encryption
- ✓ **ENC-02**: Confirmed createRequire pattern for CJS loading with explanatory comment
- ✓ **ENC-03**: Confirmed no tweetnacl references in src/ or package.json
- ✓ **TPL-01**: Confirmed @testing-library/dom in templates/root/package.json
- ✓ **TPL-02**: Confirmed @testing-library/react-native/extend-expect (not jest-native)
- ✓ **TPL-03**: Confirmed jest-jasmine2 test runner in mobile jest.config.ts
- ✓ **DOC-01**: Confirmed all four key decisions documented in PROJECT.md

All bug fixes from phases 14-02 through 14-05 were already implemented in the working tree. This plan verified correctness and hardened the implementation.

### IAM Hardening (Task 2)
**Idempotent re-runs**: setup-aws-envs and initialize-github now handle partial failures gracefully.

**src/aws/iam.ts changes:**
- Added `ListUserTagsCommand` and `ListAccessKeysCommand` imports
- Created `userHasTag()` helper to check ManagedBy tag
- Replaced `createDeploymentUser` with `createOrAdoptDeploymentUser`:
  - Detects existing users by name
  - Adopts users tagged with `ManagedBy: create-aws-starter-kit`
  - Throws clear error for untagged users (safety - won't hijack external users)
  - Logs "Adopting existing deployment user" when re-run
- Added `getAccessKeyCount()` to check key count before creation
- Enhanced `createAccessKey()` to detect 2-key limit and throw actionable error
- Kept backward compatibility via export alias

**src/commands/setup-aws-envs.ts changes:**
- Skip existing accounts on re-run (checks config.accounts)
- Skip existing deployment users on re-run (checks config.deploymentUsers)
- Shows which resources are being reused vs newly created
- Summary table output format:
  ```
  Summary:
    Environment  Account ID      Deployment User
    dev          123456789012    myapp-dev-deploy
    stage        234567890123    myapp-stage-deploy
    prod         345678901234    myapp-prod-deploy
  ```
- Clear next step: `npx create-aws-project initialize-github dev`

**src/commands/initialize-github.ts changes:**
- Uses existing deployment user from `config.deploymentUsers[env]` when available
- Shows "Using existing deployment user: {name}" in spinner
- Only creates access key (not full user) in two-step flow
- Shows "Deployment User: {name}" instead of full IAM ARN
- Adds note: "Deployment user was created by setup-aws-envs. Access key created for GitHub."
- Maintains backward compatibility: falls back to full user creation if deploymentUsers not in config

**src/utils/project-context.ts changes:**
- Added `deploymentUsers?: Record<string, string>` to ProjectConfigMinimal interface

### Documentation (Task 3)
- Updated .planning/REQUIREMENTS.md with CLI-01/02/03 requirements
- Documented two-step flow architecture and backward compatibility

## Task Commits

| Task | Commit | Description |
|------|--------|-------------|
| 2 | 61dbad0 | feat(15-01): harden IAM operations for idempotent re-runs |
| 3 | 557f3d4 | docs(15-01): document CLI architecture changes in REQUIREMENTS |

## Files Created/Modified

**Modified (6 files):**
- `src/aws/iam.ts` - Idempotent user creation with tag-based adoption, access key limit detection
- `src/commands/setup-aws-envs.ts` - Skip existing resources, summary table output
- `src/commands/initialize-github.ts` - Two-step flow, read from config, cleaner output
- `src/utils/project-context.ts` - deploymentUsers field in config interface
- `.planning/REQUIREMENTS.md` - CLI-01/02/03 requirements documented
- (Task 1 verified existing changes to src/github/secrets.ts, templates/, .planning/PROJECT.md)

**No files created** - All changes were enhancements to existing files.

## Decisions Made

**1. Tag-based adoption (safety-first approach)**
- Only adopt existing IAM users if they have `ManagedBy: create-aws-starter-kit` tag
- This prevents accidentally hijacking unrelated IAM users with the same name
- Clear error message if user exists but lacks the tag

**2. Access key limit detection**
- Proactively check key count before attempting creation
- Throw actionable error with AWS Console path when limit reached
- Better UX than getting cryptic LimitExceeded error from AWS

**3. Summary table format**
- Shows all three environments in aligned table format
- Easier to verify account IDs and user names at a glance
- Follows common CLI tool patterns (kubectl, terraform)

**4. Deployment user name (not ARN) in output**
- Users care about the name, not the full ARN
- Cleaner output, less visual noise
- ARN can be constructed if needed from account ID + name

**5. Backward compatibility preserved**
- `createDeploymentUser` export alias ensures old code still works
- `initialize-github` checks for `config.deploymentUsers` before using it
- Older projects without deploymentUsers field fall back to full user creation

## Deviations from Plan

None - plan executed exactly as written. All verification checks passed before Task 2 implementation.

## Issues Encountered

None. All code changes compiled cleanly, all 118 tests passed on first run.

## Next Phase Readiness

**Phase 15 is COMPLETE.** All v1.5 requirements verified and committed:

- ✅ ENC-01/02/03: libsodium encryption with createRequire pattern
- ✅ TPL-01/02/03: Template dependency and configuration fixes
- ✅ CLI-01/02/03: Two-step CLI flow with idempotent re-runs
- ✅ DOC-01: PROJECT.md key decisions updated

**Ready to ship v1.5.0** with:
- Fixed GitHub secrets encryption (libsodium)
- Fixed template dependencies and Jest compatibility
- Hardened CLI commands for production use
- Complete documentation of design decisions

**No blockers.** Generated projects now build and test successfully in all 14 configurations (validated in phase 14).
