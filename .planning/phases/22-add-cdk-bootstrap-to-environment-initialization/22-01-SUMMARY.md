---
phase: 22
plan: 01
subsystem: aws-setup
tags: [cdk, bootstrap, aws, cross-account, automation]

dependency_graph:
  requires:
    - "18-01: Credential storage structure"
    - "17-01: setup-aws-envs command structure"
  provides:
    - "CDK bootstrap automation in setup-aws-envs"
    - "Cross-account CDK bootstrap via STS AssumeRole"
    - "Idempotent bootstrap with error handling"
  affects:
    - "Future: CDK deployment commands can rely on bootstrapped environments"

tech_stack:
  added:
    - "@aws-sdk/client-sts for cross-account role assumption"
    - "execa for subprocess execution (already in project)"
  patterns:
    - "Cross-account operations via STS AssumeRole"
    - "Environment variable credential passing to subprocesses"
    - "Idempotent AWS operations (bootstrap safe to re-run)"

key_files:
  created:
    - path: "src/aws/cdk-bootstrap.ts"
      exports: ["bootstrapCDKEnvironment", "bootstrapAllEnvironments"]
      purpose: "CDK bootstrap operations with cross-account support"
    - path: "src/__tests__/aws/cdk-bootstrap.spec.ts"
      purpose: "Unit tests for bootstrap module with ESM mocking"
  modified:
    - path: "src/commands/setup-aws-envs.ts"
      change: "Added bootstrap call after access key creation"
      impact: "Complete end-to-end AWS setup now includes CDK bootstrap"

decisions:
  - id: "22-01-D1"
    what: "Use STS AssumeRole for cross-account bootstrap credentials"
    why: "Consistent with existing cross-account pattern in setup-aws-envs"
    alternatives: "Could have used fromTemporaryCredentials but raw STS allows passing credentials as env vars to subprocess"
  - id: "22-01-D2"
    what: "Pass credentials via environment variables to subprocess"
    why: "AWS CDK CLI (and SDK) automatically reads AWS_* environment variables"
    alternatives: "Could have used AWS profiles, but env vars are simpler and more explicit"
  - id: "22-01-D3"
    what: "No check-before-bootstrap (always run bootstrap)"
    why: "CDK bootstrap is idempotent - safe to run multiple times, simpler than checking if already bootstrapped"
    impact: "Re-running setup-aws-envs always attempts bootstrap (but won't fail or duplicate)"

metrics:
  tasks: 2
  commits: 2
  files_created: 2
  files_modified: 1
  tests_added: 12
  duration: "6 minutes"
  completed: "2026-02-13"
---

# Phase 22 Plan 01: CDK Bootstrap Module Summary

**One-liner:** Automated CDK bootstrap in all environment accounts via STS AssumeRole after setup-aws-envs creates deployment credentials.

## What Was Built

Added CDK bootstrap as the final automated step in the `setup-aws-envs` command flow. After creating deployment users and access keys in dev/stage/prod accounts, the CLI now automatically bootstraps CDK in each environment using cross-account credentials.

**Key components:**

1. **`src/aws/cdk-bootstrap.ts`** - New module with two exported functions:
   - `bootstrapCDKEnvironment()` - Bootstraps a single account via `npx cdk bootstrap`
   - `bootstrapAllEnvironments()` - Orchestrates bootstrap across all environments with STS AssumeRole

2. **`src/commands/setup-aws-envs.ts`** - Integration point:
   - Calls `bootstrapAllEnvironments()` after access key creation loop
   - Passes admin credentials, accounts map, region, and spinner
   - Updated success message to reflect bootstrap completion

3. **`src/__tests__/aws/cdk-bootstrap.spec.ts`** - Comprehensive unit tests:
   - 12 test cases covering success/failure scenarios
   - ESM mocking pattern for execa and AWS SDK
   - Tests for cross-account role assumption and credential handling

## Technical Approach

**Cross-account credential flow:**

```
Admin credentials → STS AssumeRole(OrganizationAccountAccessRole) → Temporary credentials
  → Environment variables (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_SESSION_TOKEN)
  → npx cdk bootstrap subprocess
```

**Bootstrap command structure:**

```bash
npx cdk bootstrap aws://{accountId}/{region} \
  --trust {accountId} \
  --cloudformation-execution-policies arn:aws:iam::aws:policy/AdministratorAccess \
  --require-approval never
```

**Error handling:**

- Bootstrap runs inside existing try/catch block in setup-aws-envs
- Execa captures combined stdout/stderr for error reporting
- On failure: spinner.fail(), console.error with output, throw error
- Errors are caught by handleAwsError() in setup-aws-envs

**Idempotent design:**

- No check-before-bootstrap logic
- CDK bootstrap is safe to run multiple times (CloudFormation stack already-exists is success)
- Re-running setup-aws-envs won't fail or duplicate resources

## Deviations from Plan

None - plan executed exactly as written.

## Verification

✅ All verification criteria met:

1. **TypeScript compilation:** `npx tsc --noEmit` passes with zero errors
2. **Test suite:** All 146 tests pass (12 new bootstrap tests + 134 existing)
3. **Module exports:** `bootstrapCDKEnvironment` and `bootstrapAllEnvironments` exported from cdk-bootstrap.ts
4. **Integration:** setup-aws-envs imports and calls `bootstrapAllEnvironments` after access key creation
5. **Execa command:** Constructs correct `npx cdk bootstrap aws://{accountId}/{region}` with proper flags
6. **Cross-account credentials:** STS AssumeRole resolves credentials, passed as environment variables to subprocess

## Testing

**Test coverage added:**

- ✅ bootstrapCDKEnvironment calls execa with correct args
- ✅ Credentials passed as environment variables
- ✅ Session token omitted if not provided (non-temporary credentials)
- ✅ Success result returned on successful execution
- ✅ Failure result with output on error
- ✅ Error message used if `all` property not available
- ✅ bootstrapAllEnvironments calls bootstrap for each environment
- ✅ AssumeRole called for each account with correct role ARN
- ✅ Spinner text updated for each environment
- ✅ Error thrown and spinner failed if bootstrap fails
- ✅ Works with null adminCredentials (uses default credentials)
- ✅ Skips environments with missing account IDs

**Test patterns established:**

- ESM mocking with `jest.unstable_mockModule`
- Tracking mocks outside module mock for assertion
- Mocking AWS SDK clients (STSClient with send method)
- Mocking subprocess execution (execa)

## Next Phase Readiness

**Enables:**

- Future CDK deployment commands can assume all environments are bootstrapped
- Users don't need to manually run `cdk bootstrap` before first deployment
- CDK stacks can be deployed immediately after setup-aws-envs completes

**Blockers:** None

**Concerns:** None - bootstrap is idempotent and well-tested

**Recommendations:**

- Future CDK deployment commands should document that bootstrap happens automatically
- Consider adding `--skip-bootstrap` flag to setup-aws-envs for advanced users who want manual control
- Monitor for CDK version compatibility (bootstrap format may change in future CDK versions)

## Decisions Made

| ID | Decision | Rationale | Impact |
|----|----------|-----------|--------|
| 22-01-D1 | Use STS AssumeRole for cross-account credentials | Consistent with existing pattern, allows passing credentials to subprocess | Standard cross-account pattern in codebase |
| 22-01-D2 | Pass credentials via environment variables | AWS CLI/SDK automatically reads AWS_* env vars | Simpler than AWS profiles or credential files |
| 22-01-D3 | No check-before-bootstrap (always run) | Bootstrap is idempotent, checking adds complexity | Re-running setup-aws-envs always attempts bootstrap |

## Commands to Verify

```bash
# TypeScript compilation
npx tsc --noEmit

# Run bootstrap tests
npm test -- src/__tests__/aws/cdk-bootstrap.spec.ts

# Run full test suite
npm test

# Verify exports
node -e "import('./src/aws/cdk-bootstrap.js').then(m => console.log(Object.keys(m)))"

# Manual integration test (requires AWS credentials with Organizations access)
# cd <test-project>
# npx create-aws-project setup-aws-envs
# (Should see "Bootstrapping CDK in dev account..." messages after access key creation)
```

## Files Changed

| File | Change Type | Lines Changed | Purpose |
|------|-------------|---------------|---------|
| src/aws/cdk-bootstrap.ts | Created | +202 | Bootstrap module with cross-account support |
| src/__tests__/aws/cdk-bootstrap.spec.ts | Created | +349 | Unit tests for bootstrap module |
| src/commands/setup-aws-envs.ts | Modified | +12/-1 | Integrated bootstrap into command flow |

## Commits

| Hash | Message | Files |
|------|---------|-------|
| 896d390 | feat(22-01): add CDK bootstrap module with cross-account support | cdk-bootstrap.ts, cdk-bootstrap.spec.ts |
| d077e9a | feat(22-01): integrate CDK bootstrap into setup-aws-envs workflow | setup-aws-envs.ts |
