---
status: complete
phase: 15-formalize-bug-fixes
source: [15-01-SUMMARY.md]
started: 2026-01-31T15:50:00Z
updated: 2026-01-31T15:58:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Build compiles cleanly
expected: `npm run build` completes with zero TypeScript errors. No warnings about tweetnacl or module resolution.
result: pass

### 2. All unit tests pass
expected: `npm test` runs 8 test suites, all 118 tests pass. No failures or skipped tests.
result: pass

### 3. Encryption uses libsodium (not tweetnacl)
expected: Open `src/github/secrets.ts`. It imports libsodium-wrappers via createRequire (not tweetnacl). There's a comment explaining why createRequire is needed. The encryption function uses `crypto_box_seal`.
result: pass

### 4. Template mobile test setup correct
expected: Open `templates/apps/mobile/src/test-setup.ts` — imports `@testing-library/react-native/extend-expect` (not deprecated `jest-native`). Open `templates/apps/mobile/jest.config.ts` — uses `jest-jasmine2` as testRunner.
result: pass

### 5. IAM hardening: idempotent user creation
expected: Open `src/aws/iam.ts`. There's a `createOrAdoptDeploymentUser` function that checks if user exists, verifies `ManagedBy` tag before adopting. `getAccessKeyCount` checks key count. `createAccessKey` throws clear error at 2-key limit with AWS Console path.
result: pass

### 6. setup-aws-envs: skip existing on re-run
expected: Open `src/commands/setup-aws-envs.ts`. The IAM user creation loop checks `config.deploymentUsers?.[env]` and skips environments that already have users. Final output shows a summary table with Environment, Account ID, and Deployment User columns.
result: pass

### 7. initialize-github: two-step flow with backward compat
expected: Open `src/commands/initialize-github.ts`. When `config.deploymentUsers[env]` exists, it uses that user name and only creates an access key. When it doesn't exist, falls back to full user creation (backward compat). Output shows "Deployment User: {name}" not full ARN. When using existing user, shows note about setup-aws-envs.
result: pass

## Summary

total: 7
passed: 7
issues: 0
pending: 0
skipped: 0

## Gaps

[none]
