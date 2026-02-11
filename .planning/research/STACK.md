# Technology Stack: Root Credential Handling & IAM Admin Bootstrap

**Project:** create-aws-project
**Research Focus:** Stack dimension for root credential detection, IAM admin creation, and credential switching
**Researched:** 2026-02-10
**Confidence:** HIGH

## Executive Summary

All required AWS SDK capabilities exist in packages already present in the project. No new dependencies needed. The existing AWS SDK v3 packages (`@aws-sdk/client-sts`, `@aws-sdk/client-iam`) provide all APIs for root detection, IAM admin creation, and credential switching. Implementation requires creating new client instances with different credential providers rather than mutating existing clients.

---

## Existing Stack (No Changes Required)

The project already has all necessary AWS SDK packages:

| Technology | Current Version | Latest (2026-02) | Purpose | Status |
|------------|-----------------|------------------|---------|--------|
| @aws-sdk/client-sts | ^3.972.0 | 3.983.0 | Root detection via GetCallerIdentity | ✓ Adequate |
| @aws-sdk/client-iam | ^3.971.0 | 3.983.0 | IAM admin user + access key creation | ✓ Adequate |
| @aws-sdk/credential-providers | ^3.971.0 | 3.983.0 | fromTemporaryCredentials (already used) | ✓ Adequate |

**Recommendation:** Keep existing versions. Current versions (3.971-3.972) are only 11-12 versions behind latest (3.983). The AWS SDK v3 publishes daily/frequent updates for all service clients together. No breaking changes or critical features missing for this use case.

**Rationale for version stability:**
- GetCallerIdentity, CreateUser, CreateAccessKey APIs are stable (existed since v1)
- Credential provider patterns unchanged since v3 GA (Dec 2020)
- Project uses `^` semver ranges, so patch updates automatic
- Upgrading to 3.983.0 provides no functional benefit for this milestone

---

## Core APIs Required

### 1. Root Credential Detection

**Package:** `@aws-sdk/client-sts` (already installed)

**API:** `GetCallerIdentityCommand`

**Response Structure:**
```typescript
{
  UserId: string;      // Unique identifier (format varies by entity type)
  Account: string;     // 12-digit AWS account ID
  Arn: string;         // ARN of the calling identity
  $metadata: { ... }   // Request metadata
}
```

**Root Detection Pattern:**

Root account credentials return ARN: `arn:aws:iam::{accountId}:root`

IAM user credentials return ARN: `arn:aws:iam::{accountId}:user/{userName}`

**Detection logic:**
```typescript
import { STSClient, GetCallerIdentityCommand } from '@aws-sdk/client-sts';

const stsClient = new STSClient({ region: 'us-east-1' });
const identity = await stsClient.send(new GetCallerIdentityCommand({}));

const isRoot = identity.Arn?.endsWith(':root');
```

**Why this works:**
- GetCallerIdentity requires NO permissions (even if explicitly denied, it succeeds)
- ARN format is authoritative source of identity type
- Root ARN always ends with `:root` (no path components)
- IAM user ARN always contains `:user/` segment

**Sources:**
- [GetCallerIdentity API Reference](https://docs.aws.amazon.com/STS/latest/APIReference/API_GetCallerIdentity.html)
- [IAM Identifiers - ARN Format](https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_identifiers.html)
- [GetCallerIdentityCommand SDK v3](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-sts/classes/getcalleridentitycommand.html)

**Confidence:** HIGH - Official AWS documentation confirms ARN format differentiation

---

### 2. IAM Admin User Creation

**Package:** `@aws-sdk/client-iam` (already installed)

**APIs Required:**

#### CreateUser

**Command:** `CreateUserCommand`

**Purpose:** Create IAM user in management account

**Parameters:**
```typescript
{
  UserName: string;     // REQUIRED: IAM user name
  Path?: string;        // Optional: Path prefix (e.g., "/admins/")
  Tags?: Tag[];         // Optional: Resource tags
}
```

**Response:**
```typescript
{
  User: {
    UserName: string;
    UserId: string;
    Arn: string;
    CreateDate: Date;
    Path: string;
  }
}
```

**Idempotency:** NOT idempotent. Throws `EntityAlreadyExistsException` if user exists.

**Handling pattern:**
```typescript
import { IAMClient, CreateUserCommand, GetUserCommand, NoSuchEntityException } from '@aws-sdk/client-iam';

// Check existence first (existing pattern in codebase)
async function userExists(client: IAMClient, userName: string): Promise<boolean> {
  try {
    await client.send(new GetUserCommand({ UserName: userName }));
    return true;
  } catch (error) {
    if (error instanceof NoSuchEntityException) {
      return false;
    }
    throw error;
  }
}

// Then create only if missing
if (!(await userExists(iamClient, 'OrganizationAdmin'))) {
  await iamClient.send(new CreateUserCommand({ UserName: 'OrganizationAdmin' }));
}
```

**Rationale:** Project already uses this exact pattern in `src/aws/iam.ts:61-72`. Reuse existing `userExists` function.

#### CreateAccessKey

**Command:** `CreateAccessKeyCommand`

**Purpose:** Generate programmatic credentials for new IAM user

**Parameters:**
```typescript
{
  UserName: string;     // REQUIRED: IAM user to create key for
}
```

**Response Structure:**
```typescript
{
  AccessKey: {
    UserName: string;
    AccessKeyId: string;          // e.g., "AKIAIOSFODNN7EXAMPLE"
    Status: "Active" | "Inactive"; // Default: "Active"
    SecretAccessKey: string;      // e.g., "wJalrXUtnFEMI/..."
    CreateDate?: Date;            // Key creation timestamp
  }
}
```

**CRITICAL Security Note:**

`SecretAccessKey` is ONLY accessible in the CreateAccessKey response. It cannot be retrieved later. Must be captured immediately and either:
1. Used to create new credential provider
2. Stored securely in config file
3. Both (for persistence across runs)

**Sources:**
- [CreateUser API Reference](https://docs.aws.amazon.com/IAM/latest/APIReference/API_CreateUser.html)
- [CreateAccessKey API Reference](https://docs.aws.amazon.com/IAM/latest/APIReference/API_CreateAccessKey.html)
- [CreateAccessKeyCommand SDK v3](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-iam/classes/createaccesskeycommand.html)
- [EntityAlreadyExistsException handling](https://docs.aws.amazon.com/IAM/latest/APIReference/API_CreateUser.html)

**Confidence:** HIGH - Both APIs stable since IAM v1, existing project uses similar patterns

---

### 3. Attaching Administrator Permissions

**Package:** `@aws-sdk/client-iam` (already installed)

**API:** `AttachUserPolicyCommand` (already used in project)

**Purpose:** Grant AdministratorAccess to new IAM admin user

**Pattern:**
```typescript
import { AttachUserPolicyCommand } from '@aws-sdk/client-iam';

await iamClient.send(new AttachUserPolicyCommand({
  UserName: 'OrganizationAdmin',
  PolicyArn: 'arn:aws:iam::aws:policy/AdministratorAccess'
}));
```

**Why AdministratorAccess:**
- IAM admin needs full permissions to create deploy users in child accounts
- Must assume OrganizationAccountAccessRole (requires sts:AssumeRole)
- Must create users, policies, access keys in child accounts
- Equivalent to root permissions but auditable (CloudTrail logs IAM user actions)

**Existing usage:** Project already uses `AttachUserPolicyCommand` in `src/aws/iam.ts:126`. Reuse pattern.

**Sources:**
- [AttachUserPolicy API Reference](https://docs.aws.amazon.com/IAM/latest/APIReference/API_AttachUserPolicy.html)

**Confidence:** HIGH - Existing project code demonstrates this pattern

---

### 4. Credential Switching (Mid-Execution)

**Package:** None required (JavaScript object literal)

**Pattern:** Static credential object in client constructor

**How to switch credentials mid-execution:**

AWS SDK v3 clients are **immutable** regarding credentials. You cannot update credentials on an existing client instance. Instead, create a new client instance with different credentials.

**Implementation Pattern:**

```typescript
import { IAMClient } from '@aws-sdk/client-iam';
import { STSClient } from '@aws-sdk/client-sts';
import { OrganizationsClient } from '@aws-sdk/client-organizations';

// Phase 1: Use default credential provider (root credentials from CLI/env)
const rootIAMClient = new IAMClient({ region: 'us-east-1' });

// Detect root, create IAM admin, get access keys
const accessKeyResponse = await rootIAMClient.send(
  new CreateAccessKeyCommand({ UserName: 'OrganizationAdmin' })
);

// Phase 2: Create NEW clients with static credentials from access key
const adminCredentials = {
  accessKeyId: accessKeyResponse.AccessKey!.AccessKeyId!,
  secretAccessKey: accessKeyResponse.AccessKey!.SecretAccessKey!
};

const adminIAMClient = new IAMClient({
  region: 'us-east-1',
  credentials: adminCredentials
});

const adminSTSClient = new STSClient({
  region: 'us-east-1',
  credentials: adminCredentials
});

// Phase 3: Use admin clients for cross-account operations
// Now can assume OrganizationAccountAccessRole (root cannot)
```

**Why this pattern:**

1. **No credential provider package needed** - Static credentials are plain JavaScript objects conforming to `AwsCredentialIdentity` interface
2. **Type-safe** - `credentials` property accepts object with `{ accessKeyId, secretAccessKey, sessionToken? }`
3. **Explicit control** - Clear boundary where credential context changes
4. **No mutation** - Original clients remain unchanged (no state management bugs)

**Alternative (NOT recommended for this use case):**

```typescript
// BAD: Using fromTemporaryCredentials for static credentials
import { fromTemporaryCredentials } from '@aws-sdk/credential-providers';

// This is for AssumeRole, NOT for switching to static credentials
const client = new IAMClient({
  credentials: fromTemporaryCredentials({ ... })
});
```

`fromTemporaryCredentials` is for **role assumption**, not static access key usage. The project already uses this correctly for cross-account access (see `src/aws/iam.ts:45`).

**Sources:**
- [Set credentials - AWS SDK v3](https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/setting-credentials.html)
- [Client configuration docs](https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/setting-credentials-node.html)
- [GitHub issue #5731: Not possible to update credentials for existing client](https://github.com/aws/aws-sdk-js-v3/issues/5731)
- [Credential providers documentation](https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/migrate-credential-providers.html)

**Confidence:** HIGH - Official documentation + GitHub issues confirm pattern + project already creates multiple client instances

---

## Integration with Existing Stack

### Current Credential Patterns in Project

**Pattern 1: Default credentials (from environment/profile)**
```typescript
// src/aws/iam.ts:28-30
export function createIAMClient(region: string = 'us-east-1'): IAMClient {
  return new IAMClient({ region });
}
```

**Pattern 2: Cross-account role assumption**
```typescript
// src/aws/iam.ts:38-53
export function createCrossAccountIAMClient(region: string, targetAccountId: string): IAMClient {
  return new IAMClient({
    region,
    credentials: fromTemporaryCredentials({
      params: {
        RoleArn: `arn:aws:iam::${targetAccountId}:role/OrganizationAccountAccessRole`,
        RoleSessionName: `create-aws-project-${Date.now()}`,
        DurationSeconds: 900,
      },
    }),
  });
}
```

**New Pattern 3: Static credentials from created access key**
```typescript
// NEW: Add to src/aws/iam.ts
export function createIAMClientWithCredentials(
  region: string,
  accessKeyId: string,
  secretAccessKey: string
): IAMClient {
  return new IAMClient({
    region,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });
}
```

**Why this fits:**
- Follows existing factory function pattern (`createIAMClient`, `createCrossAccountIAMClient`)
- Explicit credential source in function name
- Type-safe (TypeScript infers correct interface)
- Reusable across all service clients (STSClient, OrganizationsClient, IAMClient)

---

## Execution Flow Architecture

**Milestone Goal:** Enable cross-account operations by switching from root to IAM admin credentials

**Phase Sequence:**

```
┌─────────────────────────────────────────────────────────────────┐
│ PHASE 1: Root Detection (STS)                                   │
│ ─────────────────────────────────────────────────────────────── │
│ • Client: STSClient (default credentials from CLI/env)          │
│ • API: GetCallerIdentityCommand                                 │
│ • Action: Check if Arn ends with ':root'                        │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ PHASE 2: IAM Admin Bootstrap (IAM - using root credentials)     │
│ ─────────────────────────────────────────────────────────────── │
│ • Client: IAMClient (default credentials = root)                │
│ • APIs:                                                          │
│   1. GetUserCommand (check if OrganizationAdmin exists)         │
│   2. CreateUserCommand (create if missing)                      │
│   3. AttachUserPolicyCommand (grant AdministratorAccess)        │
│   4. CreateAccessKeyCommand (generate programmatic credentials) │
│ • Capture: AccessKeyId + SecretAccessKey from response          │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ PHASE 3: Credential Switch (Client Factory)                     │
│ ─────────────────────────────────────────────────────────────── │
│ • Action: Create NEW client instances with static credentials   │
│ • Pattern: { credentials: { accessKeyId, secretAccessKey } }    │
│ • Clients: IAMClient, STSClient, OrganizationsClient (all new)  │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ PHASE 4: Cross-Account Operations (using IAM admin credentials) │
│ ─────────────────────────────────────────────────────────────── │
│ • Client: IAMClient with fromTemporaryCredentials               │
│ • Pattern: Assume OrganizationAccountAccessRole in child account│
│ • Credentials: IAM admin (from Phase 3) → AssumeRole → child    │
│ • APIs: CreateUser, CreateAccessKey, AttachUserPolicy (child)   │
└─────────────────────────────────────────────────────────────────┘
```

**Why root cannot do Phase 4:**

Root credentials cannot assume IAM roles. AWS blocks this for security. The error:
```
AccessDenied: User: arn:aws:iam::{accountId}:root is not authorized
to perform: sts:AssumeRole on resource: arn:aws:iam::{childAccountId}:role/OrganizationAccountAccessRole
```

This is why IAM admin creation is required.

---

## State Persistence (Idempotency)

**Requirement:** Support re-running command without duplicating resources

**Storage:** `.aws-starter-config.json` (existing project config file)

**New fields to add:**
```typescript
interface AWSStarterConfig {
  // ... existing fields ...

  // NEW: IAM admin bootstrap state
  iamAdminUser?: {
    userName: string;           // "OrganizationAdmin"
    created: boolean;           // true after CreateUser succeeds
    accessKeyId?: string;       // Store for re-use (NOT secret key)
    createdAt: string;          // ISO timestamp for audit
  };
}
```

**Security consideration:**

DO NOT store `secretAccessKey` in config file. Store only `accessKeyId` for idempotency checks. If secret is lost and needed again, program can:
1. List access keys for user (`ListAccessKeysCommand`)
2. Delete old key (`DeleteAccessKeyCommand`)
3. Create new key (`CreateAccessKeyCommand`)
4. Capture new secret

**Idempotent flow:**

```typescript
// Check config file
if (config.iamAdminUser?.created) {
  console.log('IAM admin already exists, skipping creation');

  // Verify user still exists (in case manually deleted)
  const exists = await userExists(iamClient, config.iamAdminUser.userName);

  if (!exists) {
    console.log('IAM admin deleted externally, recreating...');
    // Re-run creation flow
  } else {
    // Prompt for credentials or create new access key
  }
} else {
  // Run creation flow
}
```

**Rationale:** Project already uses `.aws-starter-config.json` for account state persistence (see existing commands). Extend same pattern for IAM admin state.

---

## Error Handling Patterns

### Root Detection Errors

**Scenario:** GetCallerIdentity fails (network, auth, etc.)

**Handling:**
```typescript
try {
  const identity = await stsClient.send(new GetCallerIdentityCommand({}));
} catch (error) {
  console.error('Failed to verify AWS credentials');
  console.error('Ensure AWS credentials are configured (aws configure or environment variables)');
  throw error;
}
```

**Rationale:** GetCallerIdentity requires NO permissions, so failure = credential configuration problem, not authorization.

### IAM Admin Creation Errors

**Scenario 1:** User already exists

```typescript
import { EntityAlreadyExistsException } from '@aws-sdk/client-iam';

try {
  await iamClient.send(new CreateUserCommand({ UserName: 'OrganizationAdmin' }));
} catch (error) {
  if (error instanceof EntityAlreadyExistsException) {
    console.log('IAM admin user already exists, proceeding...');
    // Continue to access key creation or credential prompting
  } else {
    throw error;
  }
}
```

**Scenario 2:** Insufficient permissions (not running as root)

```typescript
import { AccessDeniedException } from '@aws-sdk/client-iam';

try {
  await iamClient.send(new CreateUserCommand({ UserName: 'OrganizationAdmin' }));
} catch (error) {
  if (error.name === 'AccessDeniedException') {
    console.error('Insufficient permissions to create IAM user');
    console.error('Ensure you are using root account credentials or an IAM user with iam:CreateUser permission');
    throw error;
  }
  throw error;
}
```

**Scenario 3:** Access key limit reached (2 keys per user max)

```typescript
import { LimitExceededException } from '@aws-sdk/client-iam';

try {
  await iamClient.send(new CreateAccessKeyCommand({ UserName: 'OrganizationAdmin' }));
} catch (error) {
  if (error instanceof LimitExceededException) {
    console.error('IAM user already has maximum (2) access keys');
    console.log('Options:');
    console.log('1. Delete an existing access key via AWS Console');
    console.log('2. Provide existing access key credentials when prompted');
    // Implement key rotation flow or manual credential input
  } else {
    throw error;
  }
}
```

**Sources:**
- [IAM Errors](https://docs.aws.amazon.com/IAM/latest/APIReference/CommonErrors.html)
- [CreateAccessKey Error Codes](https://docs.aws.amazon.com/IAM/latest/APIReference/API_CreateAccessKey.html)

**Confidence:** MEDIUM - Error types from official docs, but specific names/classes may differ slightly in SDK v3

---

## Alternative Approaches Considered

### Alternative 1: Use AWS SSO credentials

**What:** Leverage `fromSSO()` credential provider instead of static access keys

**Pros:**
- No long-lived credentials
- Centralized credential management
- Automatic rotation

**Cons:**
- Requires SSO setup (added complexity)
- CLI tool assumes simple setup (root → IAM admin)
- SSO admin can't assume roles programmatically without explicit role session

**Verdict:** REJECTED - Scope creep. Static access keys are standard for programmatic access.

### Alternative 2: Prompt user for IAM credentials instead of creating

**What:** Detect root, then ask user to create IAM admin manually and input credentials

**Pros:**
- No programmatic IAM user creation (fewer permissions needed)
- User retains control

**Cons:**
- Poor UX (manual steps in wizard flow)
- Defeats "scaffold everything" purpose of CLI
- User may create IAM admin with insufficient permissions

**Verdict:** REJECTED - Automation is core value proposition.

### Alternative 3: Use AWS CloudFormation to create IAM admin

**What:** Deploy CFN stack with IAM user resource instead of SDK calls

**Pros:**
- Declarative infrastructure
- Automatic rollback on failure
- Stack can be deleted cleanly

**Cons:**
- Added complexity (CFN template, stack management)
- Async operation (polling for completion)
- Credential extraction from stack outputs still needed

**Verdict:** REJECTED - SDK calls are simpler for single-user creation. CFN overkill for this use case.

---

## Security Best Practices

### 1. Access Key Handling

**DO:**
- Capture `SecretAccessKey` immediately from CreateAccessKey response
- Use in-memory credential object for client creation
- Optionally persist to config file with restrictive permissions (chmod 600)
- Clear from memory after clients created

**DON'T:**
- Log secret access key to console
- Store in plaintext without file permissions
- Commit to version control
- Reuse for non-AWS-CLI purposes

### 2. IAM Admin Permissions

**DO:**
- Use AdministratorAccess managed policy (simplest, auditable)
- Document that IAM admin = operational account (not root)
- Enable CloudTrail for audit logging

**DON'T:**
- Create custom policy (maintenance burden, may miss permissions)
- Grant root-equivalent permissions via policies (redundant)

### 3. Root Credential Usage

**DO:**
- Use ONLY for initial IAM admin creation
- Recommend disabling root access keys after setup
- Document in README that root only needed once

**DON'T:**
- Store root credentials in config file
- Use root for day-to-day operations
- Encourage repeated root usage

---

## Summary: No New Dependencies

| Requirement | Package | Status |
|-------------|---------|--------|
| Root detection | @aws-sdk/client-sts | ✓ Already installed |
| IAM user creation | @aws-sdk/client-iam | ✓ Already installed |
| Access key creation | @aws-sdk/client-iam | ✓ Already installed |
| Static credentials | N/A (plain object) | ✓ No package needed |
| Cross-account roles | @aws-sdk/credential-providers | ✓ Already installed |

**Implementation readiness:** 100% - No package installation or upgrades required.

---

## Sources

**Official AWS Documentation:**
- [GetCallerIdentity API Reference](https://docs.aws.amazon.com/STS/latest/APIReference/API_GetCallerIdentity.html)
- [IAM Identifiers - ARN Format](https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_identifiers.html)
- [CreateUser API Reference](https://docs.aws.amazon.com/IAM/latest/APIReference/API_CreateUser.html)
- [CreateAccessKey API Reference](https://docs.aws.amazon.com/IAM/latest/APIReference/API_CreateAccessKey.html)
- [AWS SDK v3 - Set Credentials](https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/setting-credentials.html)

**AWS SDK v3 Documentation:**
- [GetCallerIdentityCommand](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-sts/classes/getcalleridentitycommand.html)
- [CreateAccessKeyCommand](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-iam/classes/createaccesskeycommand.html)
- [Credential Providers Package](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/Package/-aws-sdk-credential-providers/)

**Community Resources:**
- [GitHub Issue #5731: Credential updates on existing client](https://github.com/aws/aws-sdk-js-v3/issues/5731) - Confirms new client instances required
- [IAM Examples SDK v3](https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/iam-examples-managing-access-keys.html)

**Confidence Assessment:** HIGH - All findings verified through official AWS documentation or existing project code patterns.
