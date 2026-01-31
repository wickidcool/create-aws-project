# Phase 15: Formalize Bug Fixes - Research

**Researched:** 2026-01-31
**Domain:** Bug fix verification, testing infrastructure, CLI error handling
**Confidence:** HIGH

## Summary

This phase is unique: all code changes are already implemented in the working tree. The research focuses on understanding what verification and hardening patterns are needed for the five bug fix categories: (1) GitHub secrets encryption (libsodium-wrappers), (2) template dependency fixes (testing-library), (3) Expo/Jest compatibility (jest-jasmine2), (4) ESM runtime fixes (createRequire), and (5) CLI architecture changes (IAM user creation moved to setup-aws-envs).

The standard approach is: verify existing changes work via build/test commands, harden error handling per context decisions (idempotent operations, graceful failures, clear output), commit verified changes with descriptive messages, and document key decisions in PROJECT.md.

Key challenges include ensuring idempotent IAM operations (skip existing, detect and adopt, handle access key limits), proper error messaging for partial failures, and confirming all test suites pass with the new dependencies.

**Primary recommendation:** Verify build and tests pass first, then harden error handling in setup-aws-envs and initialize-github commands following AWS SDK best practices for idempotent resource creation.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| libsodium-wrappers | ^0.7.15 | GitHub secrets encryption | Official GitHub docs recommend libsodium for crypto_box_seal sealed box encryption |
| @aws-sdk/client-iam | ^3.971.0 | AWS IAM operations | Official AWS SDK v3 for Node.js with typed API |
| @testing-library/dom | ^10.4.0 | DOM testing utilities | Peer dependency for @testing-library/react v16+ |
| jest-jasmine2 | ^30.2.0 | Jest test runner | Alternative runner for Jest 30 when jest-circus has compatibility issues |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @testing-library/react-native | ^12.4.0 | React Native testing | Built-in extend-expect replaces deprecated jest-native |
| createRequire | Node.js built-in | CJS module loading in ESM | When ESM build has broken imports but CJS build works |
| ora | ^9.1.0 | CLI progress spinners | AWS operations feedback during long-running operations |
| picocolors | ^1.1.1 | Terminal colors | Success/error messaging in CLI output |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| libsodium-wrappers | tweetnacl | tweetnacl lacks Blake2b needed for GitHub sealed boxes; causes 422 errors |
| jest-jasmine2 | jest-circus (default) | jest-circus conflicts with Expo SDK 53 runtime; jasmine2 maintains compatibility |
| createRequire | Dynamic import() | Dynamic import doesn't help when ESM build has broken static imports |
| @testing-library/react-native/extend-expect | @testing-library/jest-native | jest-native is deprecated; react-native v12.4+ has built-in matchers |

**Installation:**
```bash
# Already in package.json (verify, don't reinstall)
npm install libsodium-wrappers @types/libsodium-wrappers
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── commands/            # CLI command implementations
│   ├── setup-aws-envs.ts       # AWS Organization and IAM user creation
│   └── initialize-github.ts    # GitHub secrets configuration
├── aws/                # AWS service modules
│   └── iam.ts                  # IAM user/policy/key operations
├── github/             # GitHub service modules
│   └── secrets.ts              # Encryption and secrets API
└── utils/              # Shared utilities
    └── project-context.ts      # Config file interface
```

### Pattern 1: Idempotent AWS Resource Creation
**What:** Check if resource exists before creating; handle NoSuchEntityException gracefully
**When to use:** All AWS IAM operations (CreateUser, CreatePolicy, CreateAccessKey)
**Example:**
```typescript
// Source: src/aws/iam.ts (implemented)
async function userExists(client: IAMClient, userName: string): Promise<boolean> {
  try {
    const command = new GetUserCommand({ UserName: userName });
    await client.send(command);
    return true;
  } catch (error) {
    if (error instanceof NoSuchEntityException) {
      return false;
    }
    throw error;
  }
}

export async function createDeploymentUser(
  client: IAMClient,
  userName: string
): Promise<void> {
  // Check if user already exists
  if (await userExists(client, userName)) {
    throw new Error(
      `IAM user "${userName}" already exists. Delete manually before retrying.`
    );
  }
  // ... create user
}
```

### Pattern 2: Incremental Config Updates
**What:** Save progress after each successful resource creation
**When to use:** Multi-step operations like creating 3 environment accounts/users
**Example:**
```typescript
// Source: src/commands/setup-aws-envs.ts (implemented)
function updateConfig(
  configPath: string,
  accounts: Record<string, string>,
  deploymentUsers?: Record<string, string>
): void {
  const content = readFileSync(configPath, 'utf-8');
  const config = JSON.parse(content);

  config.accounts = { ...config.accounts, ...accounts };
  if (deploymentUsers) {
    config.deploymentUsers = { ...config.deploymentUsers, ...deploymentUsers };
  }

  writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n', 'utf-8');
}

// Save after EACH successful account/user creation
for (const env of ENVIRONMENTS) {
  // ... create account
  updateConfig(configPath, accounts);

  // ... create user
  updateConfig(configPath, accounts, deploymentUsers);
}
```

### Pattern 3: Backward Compatible CLI Commands
**What:** Check for new config field; fall back to old behavior if missing
**When to use:** When splitting functionality between commands (e.g., initialize-github now uses existing user)
**Example:**
```typescript
// Source: src/commands/initialize-github.ts (implemented)
const existingUserName = config.deploymentUsers?.[env];
let userName: string;
let credentials: { accessKeyId: string; secretAccessKey: string };

if (existingUserName) {
  // New path: setup-aws-envs already created user
  spinner.text = `Creating access key for existing user ${existingUserName}...`;
  userName = existingUserName;
  credentials = await createAccessKey(iamClient, userName);
} else {
  // Old path: full user creation for backward compat
  spinner.text = `Creating IAM deployment user...`;
  const fullCredentials = await createDeploymentUserWithCredentials(
    iamClient,
    projectName,
    env,
    accountId
  );
  userName = fullCredentials.userName;
  credentials = fullCredentials;
}
```

### Pattern 4: ESM CJS Interop with createRequire
**What:** Use Node.js createRequire to load CommonJS build when ESM build is broken
**When to use:** When library's ESM build has broken relative imports but CJS build works
**Example:**
```typescript
// Source: src/github/secrets.ts (implemented)
import { createRequire } from 'node:module';

// Use createRequire to load the CJS build of libsodium-wrappers.
// The ESM build has a broken relative import for its libsodium dependency.
const require = createRequire(import.meta.url);
const sodium = require('libsodium-wrappers') as typeof import('libsodium-wrappers');

export async function encryptSecret(
  publicKey: string,
  secretValue: string
): Promise<string> {
  await sodium.ready;

  const publicKeyBytes = sodium.from_base64(
    publicKey,
    sodium.base64_variants.ORIGINAL
  );
  const secretBytes = sodium.from_string(secretValue);
  const encryptedBytes = sodium.crypto_box_seal(secretBytes, publicKeyBytes);

  return sodium.to_base64(encryptedBytes, sodium.base64_variants.ORIGINAL);
}
```

### Anti-Patterns to Avoid
- **Creating resources without existence check:** Leads to non-idempotent operations that fail on retry
- **Saving config only at the end:** Partial failures lose all progress; user must start over
- **Breaking backward compatibility:** Older projects without new config fields must still work
- **Using ESM imports for broken packages:** If ESM build has issues, use createRequire for CJS build

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| GitHub secrets encryption | Custom crypto implementation | libsodium-wrappers crypto_box_seal | GitHub API uses sealed boxes; requires Blake2b which tweetnacl lacks |
| Checking IAM resource existence | Parsing error messages | AWS SDK typed exceptions (NoSuchEntityException) | SDK provides structured error types; parsing strings is fragile |
| Progress feedback in CLI | Console.log with timestamps | ora spinner library | Handles TTY detection, graceful CI fallback, clean animations |
| CJS/ESM interop | Bundling or transpiling | Node.js createRequire | Built-in solution; no build complexity |
| Testing React Native components | Custom test utilities | @testing-library/react-native v12.4+ | Built-in extend-expect matchers; deprecates jest-native |
| Jest test runner for Expo | Custom runner or patches | jest-jasmine2 (bundled with Jest 30) | Official alternative runner when jest-circus has conflicts |

**Key insight:** These bug fixes all involve known ecosystem solutions. The pattern is: research the official recommendation (GitHub docs for encryption, AWS SDK for IAM, testing-library for React testing), then implement the standard approach. Don't invent custom workarounds.

## Common Pitfalls

### Pitfall 1: Non-Idempotent AWS Resource Creation
**What goes wrong:** CreateUser called on existing user throws EntityAlreadyExists error; partial failures leave state inconsistent
**Why it happens:** AWS API calls aren't idempotent by default; must implement check-then-create pattern
**How to avoid:** Always check resource existence with GetUser/GetPolicy before creating; handle NoSuchEntityException to distinguish "doesn't exist" from other errors
**Warning signs:** Retry after failure throws "already exists" errors; config file shows some environments but not others

### Pitfall 2: Access Key Limit (Max 2 per IAM User)
**What goes wrong:** CreateAccessKey fails with LimitExceeded when user already has 2 keys
**Why it happens:** AWS IAM limits users to 2 active access keys; intended for rotation scenarios
**How to avoid:** Per context decisions, detect limit and offer to rotate (delete oldest, create new); ListAccessKeys to check count before creating
**Warning signs:** "Cannot exceed quota for AccessKeysPerUser" error message from AWS SDK

### Pitfall 3: libsodium ESM Import Errors
**What goes wrong:** Direct ESM import of libsodium-wrappers fails with module resolution errors at runtime
**Why it happens:** libsodium-wrappers ESM build has broken relative import path to libsodium.js dependency
**How to avoid:** Use createRequire to load CJS build instead of ESM import; documented in PROJECT.md key decisions
**Warning signs:** "Cannot find module" errors at runtime despite successful build; errors reference libsodium internals

### Pitfall 4: Missing Peer Dependencies in Generated Projects
**What goes wrong:** npm install shows peer dependency warnings; tests fail with "Cannot find module @testing-library/dom"
**Why it happens:** @testing-library/react v16+ moved dom to peer dependency; must be explicitly installed
**How to avoid:** Include @testing-library/dom in generated project's devDependencies; verify with npm ls
**Warning signs:** Peer dependency warnings during npm install; test failures referencing dom queries

### Pitfall 5: Jest 30 + Expo SDK 53 Test Failures
**What goes wrong:** Mobile tests fail with runtime errors or incompatibilities in test environment
**Why it happens:** Default jest-circus runner has compatibility issues with Expo SDK 53
**How to avoid:** Use testRunner: 'jest-jasmine2' in jest.config.ts for mobile projects; documented in PROJECT.md
**Warning signs:** Tests that passed in Expo SDK 52 fail after upgrading; errors in test runner initialization

### Pitfall 6: Deprecated @testing-library/jest-native
**What goes wrong:** Import '@testing-library/jest-native/extend-expect' causes deprecation warnings or fails
**Why it happens:** jest-native is deprecated; functionality moved into @testing-library/react-native v12.4+
**How to avoid:** Use '@testing-library/react-native/extend-expect' instead; built-in matchers replace jest-native
**Warning signs:** Deprecation warnings during npm install; jest-native in package.json but not maintained

## Code Examples

Verified patterns from official sources:

### GitHub Secrets Encryption (libsodium)
```typescript
// Source: https://docs.github.com/en/rest/guides/encrypting-secrets-for-the-rest-api
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const sodium = require('libsodium-wrappers') as typeof import('libsodium-wrappers');

export async function encryptSecret(
  publicKey: string,
  secretValue: string
): Promise<string> {
  await sodium.ready;

  const publicKeyBytes = sodium.from_base64(
    publicKey,
    sodium.base64_variants.ORIGINAL
  );
  const secretBytes = sodium.from_string(secretValue);
  const encryptedBytes = sodium.crypto_box_seal(secretBytes, publicKeyBytes);

  return sodium.to_base64(encryptedBytes, sodium.base64_variants.ORIGINAL);
}
```

### AWS IAM Error Handling (NoSuchEntityException)
```typescript
// Source: AWS SDK for JavaScript v3 IAM examples
import { IAMClient, GetUserCommand, NoSuchEntityException } from '@aws-sdk/client-iam';

async function userExists(client: IAMClient, userName: string): Promise<boolean> {
  try {
    const command = new GetUserCommand({ UserName: userName });
    await client.send(command);
    return true;
  } catch (error) {
    if (error instanceof NoSuchEntityException) {
      return false;
    }
    throw error;
  }
}
```

### Testing Library DOM Peer Dependency
```json
// Source: https://github.com/testing-library/react-testing-library/releases/tag/v16.0.0
{
  "devDependencies": {
    "@testing-library/react": "^16.3.2",
    "@testing-library/dom": "^10.4.0",
    "@testing-library/jest-dom": "^6.9.1"
  }
}
```

### React Native Testing Setup (extend-expect)
```typescript
// Source: https://callstack.github.io/react-native-testing-library/docs/migration/jest-matchers
// apps/mobile/src/test-setup.ts
import '@testing-library/react-native/extend-expect';
```

### Jest Expo Configuration (jest-jasmine2)
```typescript
// Source: https://github.com/expo/expo/issues/37445 (community workaround)
// apps/mobile/jest.config.ts
export default {
  displayName: 'mobile',
  preset: 'jest-expo',
  testRunner: 'jest-jasmine2',  // Alternative to jest-circus for Expo SDK 53
  // ... other config
};
```

### Node.js ESM CJS Interop
```typescript
// Source: https://nodejs.org/api/esm.html
import { createRequire } from 'node:module';

// Create require function scoped to current module
const require = createRequire(import.meta.url);

// Load CJS module when ESM import is broken
const cjsModule = require('package-name');
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| tweetnacl for GitHub encryption | libsodium-wrappers crypto_box_seal | v1.5 (2026-01) | Fixes 422 errors from GitHub API; proper sealed box implementation |
| @testing-library/jest-native | @testing-library/react-native/extend-expect | v12.4+ (2024) | jest-native deprecated; built-in matchers in react-native library |
| jest-circus (default runner) | jest-jasmine2 for Expo projects | Expo SDK 53 + Jest 30 | Compatibility fix; jasmine2 maintains stability with Expo runtime |
| ESM import of libsodium | createRequire for CJS build | v1.5 (2026-01) | Workaround for broken ESM build; CJS stable until upstream fix |
| IAM user creation in initialize-github | IAM user creation in setup-aws-envs | v1.5 (2026-01) | All AWS resources created together; initialize-github just creates access key |

**Deprecated/outdated:**
- **tweetnacl/tweetnacl-util:** Replaced by libsodium-wrappers. tweetnacl lacks Blake2b needed for GitHub sealed boxes.
- **@testing-library/jest-native:** Deprecated; use @testing-library/react-native/extend-expect (built-in since v12.4).
- **react-test-renderer:** Deprecated for React 19+; use @testing-library/react-native instead.

## Open Questions

Things that couldn't be fully resolved:

1. **Access key rotation implementation details**
   - What we know: AWS SDK has ListAccessKeys and DeleteAccessKey commands; limit is 2 keys per user
   - What's unclear: Should we auto-rotate oldest key, or prompt user to choose which to delete?
   - Recommendation: Context decisions say "offer to rotate"; implement as error message with manual instructions first, enhance to interactive prompt if needed

2. **Detecting existing IAM users vs. config mismatch**
   - What we know: Context decisions say "detect and adopt if user exists in AWS but not config"
   - What's unclear: How to distinguish "user from previous failed run" vs. "unrelated user with same name"
   - Recommendation: Check user tags (ManagedBy: create-aws-starter-kit) to confirm ownership before adopting

3. **Jest 30 + Expo SDK 53 compatibility timeline**
   - What we know: jest-jasmine2 works as workaround; issues exist in Expo GitHub (expo/expo#37445, #36831)
   - What's unclear: When will upstream fix allow removal of testRunner override?
   - Recommendation: Monitor Expo releases; remove jest-jasmine2 override when SDK 54+ confirms jest-circus compatibility

## Sources

### Primary (HIGH confidence)
- [GitHub Docs: Encrypting secrets for the REST API](https://docs.github.com/en/rest/guides/encrypting-secrets-for-the-rest-api) - libsodium crypto_box_seal encryption
- [Node.js ESM Documentation](https://nodejs.org/api/esm.html) - createRequire for CJS/ESM interop
- [@testing-library/react v16.0.0 release](https://github.com/testing-library/react-testing-library/releases/tag/v16.0.0) - @testing-library/dom peer dependency
- [AWS IAM quotas documentation](https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_iam-quotas.html) - Access key limit (2 per user)
- [AWS IAM GetUser examples](https://docs.aws.amazon.com/IAM/latest/UserGuide/iam_example_iam_GetUser_section.html) - NoSuchEntityException error handling

### Secondary (MEDIUM confidence)
- [Testing Library migration guide](https://callstack.github.io/react-native-testing-library/docs/migration/jest-matchers) - jest-native to react-native/extend-expect
- [Expo unit testing docs](https://docs.expo.dev/develop/unit-testing/) - Jest configuration for Expo projects
- [libsodium sealed boxes documentation](https://libsodium.gitbook.io/doc/public-key_cryptography/sealed_boxes) - crypto_box_seal algorithm details

### Tertiary (LOW confidence)
- [Expo SDK 53 Jest 30 compatibility issues](https://github.com/expo/expo/issues/37445) - Community reports of jest-circus conflicts
- [AWS IAM idempotency patterns](https://repost.aws/knowledge-center/ecs-not-idempotent-service-creation) - General AWS idempotency practices

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries verified via official docs and package.json
- Architecture: HIGH - Code already implemented and visible in git diff
- Pitfalls: HIGH - Based on official AWS/GitHub docs and known ecosystem issues

**Research date:** 2026-01-31
**Valid until:** 2026-02-28 (30 days - stable technologies, but monitor Expo SDK releases)
