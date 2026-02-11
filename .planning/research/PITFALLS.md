# Domain Pitfalls: Root Credential Bootstrapping and Idempotent AWS Setup

**Domain:** CLI tool for AWS root credential detection, IAM admin user creation, and idempotent multi-account setup
**Researched:** 2026-02-10
**Context:** Adding root credential handling to existing npx CLI that creates AWS Organizations and cross-account IAM users

## Critical Pitfalls

Mistakes that cause command failures, security issues, or require rewrites.

### Pitfall 1: Root User Cannot Assume Roles

**What goes wrong:** Root credentials fail at `AssumeRole` call when trying to create IAM users in member accounts via `OrganizationAccountAccessRole`.

**Why it happens:** AWS blocks root users from assuming any IAM role, including organization cross-account roles. The CLI detects root credentials but then fails when calling `createCrossAccountIAMClient()` at line 322 of setup-aws-envs.ts.

**Consequences:**
- Setup completes organization and account creation successfully
- Fails partway through IAM user creation loop
- Config file has accounts but no deploymentUsers
- User must manually create admin IAM user and re-run command
- Error message is cryptic: "Not authorized to perform: sts:AssumeRole"

**Prevention:**
1. Detect root credentials early via `STS.GetCallerIdentity` (check if ARN ends with `:root`)
2. Create admin IAM user in management account BEFORE account creation loop
3. Switch credential provider to use admin user credentials for all cross-account operations
4. Store admin credentials in memory only (never write to disk)

**Detection:**
- Watch for `GetCallerIdentity` ARN pattern: `arn:aws:iam::123456789012:root` (no user segment)
- Test with actual root credentials (cannot be mocked accurately)
- E2E test: Root credentials → full setup → GitHub secrets created

**Phase assignment:** Phase 1 (root detection and admin creation)

**Confidence:** HIGH - Verified in [AWS IAM troubleshooting documentation](https://docs.aws.amazon.com/IAM/latest/UserGuide/troubleshoot_roles.html) and [Netflix Security Monkey issue #1026](https://github.com/Netflix/security_monkey/issues/1026)

---

### Pitfall 2: IAM Eventual Consistency Window (3-4 seconds)

**What goes wrong:** IAM user/policy creation succeeds, but immediate use (access key creation, policy attachment, AssumeRole with new credentials) fails with "User not found" or "Access denied."

**Why it happens:** IAM uses distributed system with eventual consistency. Changes propagate to all regions/endpoints within 3-4 seconds. SDK doesn't wait automatically.

**Consequences:**
- `CreateAccessKey` fails immediately after `CreateUser`
- `AttachUserPolicy` succeeds but policy not effective for 3-4 seconds
- New admin credentials fail to assume roles for 3-4 seconds
- Command appears flaky (works sometimes, fails other times depending on timing)

**Prevention:**

**Strategy 1: Exponential backoff with retry (recommended)**
```typescript
async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  maxRetries: number = 5,
  baseDelay: number = 1000
): Promise<T> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (attempt === maxRetries - 1) throw error;

      // Only retry on consistency-related errors
      if (!isRetryableError(error)) throw error;

      const delay = baseDelay * Math.pow(2, attempt);
      const jitter = Math.random() * 1000;
      await sleep(delay + jitter);
    }
  }
  throw new Error('Retry limit exceeded');
}

function isRetryableError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;

  const retryableErrors = [
    'NoSuchEntity',
    'InvalidClientTokenId',
    'AccessDenied', // May be consistency-related if user/policy just created
  ];

  return retryableErrors.some(name => error.name === name);
}
```

**Strategy 2: Fixed wait after IAM mutations (fallback)**
```typescript
async function createAdminUserWithWait(client: IAMClient, userName: string) {
  await createUser(client, userName);

  // Wait for eventual consistency (5 seconds = 3-4s propagation + 1s buffer)
  await sleep(5000);

  return userName;
}
```

**AWS SDK note:** The AWS SDK for JavaScript v3 includes automatic retry with exponential backoff, but only for throttling errors (429, TooManyRequestsException). It does NOT retry eventual consistency errors like NoSuchEntity.

**What to retry:**
- `CreateAccessKey` after `CreateUser`
- First `AssumeRole` with new credentials after `CreateUser` + `AttachUserPolicy`
- Any operation using newly created credentials

**What NOT to retry:**
- `CreateUser` itself (idempotency via existence check)
- `CreateAccount` (asynchronous, has separate wait mechanism)

**Detection:**
- E2E test with immediate operations after IAM mutations
- Monitor for `NoSuchEntity` errors in production
- Test in multiple AWS regions (consistency varies by endpoint)

**Phase assignment:** Phase 2 (admin user creation with retry logic)

**Confidence:** HIGH - Verified in [AWS IAM troubleshooting](https://docs.aws.amazon.com/IAM/latest/UserGuide/troubleshoot.html), [research on IAM persistence](https://hackingthe.cloud/aws/post_exploitation/iam_persistence_eventual_consistency/), and [HashiCorp Vault issue #3115](https://github.com/hashicorp/vault/issues/3115)

---

### Pitfall 3: Credential Provider Chain Caching

**What goes wrong:** SDK creates IAM client with root credentials, then code creates admin user and expects next IAM operation to use admin credentials, but SDK continues using cached root credentials.

**Why it happens:** AWS SDK `AwsCredentialsProviderChain` caches the first successful provider and reuses it. Setting environment variables mid-execution doesn't switch credentials for existing clients.

**Consequences:**
- Admin user created successfully
- Subsequent operations still use root credentials
- `AssumeRole` fails (root can't assume roles)
- Config shows admin user exists but wasn't actually used
- Confusing: "Why is AssumeRole failing after admin creation?"

**Prevention:**

**Option 1: Create new clients with explicit credentials (recommended)**
```typescript
// After admin user creation
const adminCredentials = {
  accessKeyId: adminAccessKey.accessKeyId,
  secretAccessKey: adminAccessKey.secretAccessKey,
};

// Create fresh client with explicit credentials
const adminIAMClient = new IAMClient({
  region,
  credentials: adminCredentials, // Explicit, bypasses provider chain
});

// Use adminIAMClient for all subsequent operations
```

**Option 2: Use StaticCredentialProvider**
```typescript
import { StaticCredentialProvider } from '@aws-sdk/credential-providers';

const adminClient = new IAMClient({
  region,
  credentials: new StaticCredentialProvider({
    accessKeyId: adminAccessKey.accessKeyId,
    secretAccessKey: adminAccessKey.secretAccessKey,
  }),
});
```

**What NOT to do:**
- Set `AWS_ACCESS_KEY_ID` environment variables mid-execution
- Expect existing clients to pick up new credentials
- Rely on `reuseLastProviderEnabled(false)` (doesn't help with existing clients)

**Detection:**
- Call `STS.GetCallerIdentity` after switching credentials
- Verify ARN changes from `:root` to `:user/admin-name`
- Log credential source at each operation

**Phase assignment:** Phase 2 (credential switching architecture)

**Confidence:** HIGH - Verified in [AWS SDK credential provider chain docs](https://docs.aws.amazon.com/sdk-for-java/latest/developer-guide/credentials-chain.html) and [JavaScript provider chain API](https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/CredentialProviderChain.html)

---

### Pitfall 4: Partial Failure State Management

**What goes wrong:** Command creates organization and 1-2 accounts successfully, then fails on third account or IAM user creation. Config file has partial data. Re-running prompts for emails again, tries to recreate accounts, gets `EMAIL_ALREADY_EXISTS` error.

**Why it happens:** Current implementation collects all emails upfront (line 259), but accounts may already exist from previous failed run. Email validation doesn't check AWS for existing accounts.

**Consequences:**
- User runs setup, fails partway through
- Re-runs command, enters same emails
- Gets confusing error: "EMAIL_ALREADY_EXISTS"
- User doesn't know which accounts exist or which emails to use
- Manually checks AWS Console to discover account IDs
- Edits config.json directly (error-prone)

**Prevention:**

**Strategy 1: Check existing accounts before prompting (recommended)**
```typescript
async function collectEmails(
  projectName: string,
  existingAccounts: Record<string, string>,
  orgClient: OrganizationsClient
): Promise<EnvironmentEmails> {
  // Identify which accounts are missing
  const missingEnvs = ENVIRONMENTS.filter(env => !existingAccounts[env]);

  if (missingEnvs.length === 0) {
    console.log('All accounts already configured.');
    return { dev: '', stage: '', prod: '' }; // Won't be used
  }

  console.log(`Need to create ${missingEnvs.length} account(s): ${missingEnvs.join(', ')}`);

  // Only prompt for missing environments
  const emails: Partial<EnvironmentEmails> = {};
  for (const env of missingEnvs) {
    const response = await prompts({
      type: 'text',
      name: env,
      message: `${env} account root email:`,
      validate: validateEmail,
    });
    emails[env] = response[env];
  }

  return emails as EnvironmentEmails;
}
```

**Strategy 2: Handle EMAIL_ALREADY_EXISTS gracefully**
```typescript
async function createAccountIfNeeded(
  client: OrganizationsClient,
  email: string,
  accountName: string,
  existingAccountId?: string
): Promise<string> {
  if (existingAccountId) {
    return existingAccountId; // Skip creation
  }

  try {
    const { requestId } = await createAccount(client, email, accountName);
    const result = await waitForAccountCreation(client, requestId);
    return result.accountId;
  } catch (error) {
    if (error instanceof Error && error.name === 'EmailAlreadyExistsException') {
      // Account exists but not in config - need manual recovery
      throw new Error(
        `An AWS account with email ${email} already exists but is not in this project's config. ` +
        `Find the account ID in AWS Console > Organizations and add it to config.json manually, ` +
        `or use a different email address.`
      );
    }
    throw error;
  }
}
```

**Strategy 3: Atomic config updates**
```typescript
function appendToConfig(configPath: string, updates: Partial<ConfigFile>): void {
  // Read current state
  const content = readFileSync(configPath, 'utf-8');
  const config = JSON.parse(content);

  // Merge updates (preserves existing data)
  Object.assign(config, updates);

  // Atomic write: write to temp file, then rename
  const tempPath = `${configPath}.tmp`;
  writeFileSync(tempPath, JSON.stringify(config, null, 2) + '\n', 'utf-8');
  renameSync(tempPath, configPath);
}
```

**Current code already does:** Save after each successful account (line 301), save after each successful user (line 332). This is good but not sufficient if email collection happens before checking existing accounts.

**Detection:**
- E2E test: Run setup-aws-envs, kill process after first account, re-run
- Verify no duplicate email prompts
- Verify command completes without manual intervention

**Phase assignment:** Phase 1 (idempotent email collection)

**Confidence:** HIGH - Observed in current code structure and verified EMAIL_ALREADY_EXISTS behavior in [AWS Organizations troubleshooting](https://docs.aws.amazon.com/organizations/latest/userguide/orgs_troubleshoot.html) and [AWS re:Post](https://repost.aws/knowledge-center/organizations-error-email-already-exists)

---

### Pitfall 5: Admin User Access Key Limit (2 keys maximum)

**What goes wrong:** CLI creates admin user with access key on first run. User re-runs command (testing, after failure). Second run tries to create another access key, hits AWS limit of 2 keys per user. Third run fails immediately with "User already has 2 access keys."

**Why it happens:** AWS enforces hard limit of 2 access keys per IAM user. Current code checks limit for deployment users (line 361) but not for admin user creation.

**Consequences:**
- First run: Success
- Second run: Success (now has 2 keys)
- Third run: Hard failure, requires manual AWS Console access to delete old keys
- Security issue: Multiple long-lived keys scattered across command runs
- User must manually track which key is current

**Prevention:**

**Strategy 1: Adopt existing admin user without creating new keys (recommended)**
```typescript
async function getOrCreateAdminUser(
  client: IAMClient,
  userName: string
): Promise<{ userName: string; accessKey?: AccessKeyCredentials }> {
  // Check if admin user already exists
  const exists = await userExists(client, userName);

  if (exists) {
    console.log(`Admin user ${userName} already exists, reusing credentials`);

    // Check key count
    const keyCount = await getAccessKeyCount(client, userName);

    if (keyCount >= 2) {
      throw new Error(
        `Admin user ${userName} already has ${keyCount} access keys (AWS maximum: 2). ` +
        `This command needs to create credentials for the admin user. ` +
        `Please delete an existing key in AWS Console > IAM > Users > ${userName} > Security credentials, ` +
        `then re-run this command.`
      );
    }

    if (keyCount >= 1) {
      // Has room for one more key, but user should use existing credentials
      console.log('⚠ Admin user has existing access key. Using existing credentials.');
      console.log('  Store admin credentials securely for future use.');

      // Don't create new key - user should reuse existing
      return { userName };
    }
  }

  // Create new user + key
  await createUser(client, userName);
  await sleep(5000); // Wait for consistency

  const accessKey = await createAccessKey(client, userName);

  return { userName, accessKey };
}
```

**Strategy 2: Store admin credentials in project config (NOT RECOMMENDED)**
```typescript
// DON'T DO THIS - security risk
config.adminCredentials = {
  accessKeyId: '...',
  secretAccessKey: '...', // Never store in plaintext config
};
```

**Strategy 3: Prompt user for admin credentials on subsequent runs**
```typescript
async function getAdminCredentials(
  userName: string
): Promise<AccessKeyCredentials> {
  console.log(`Admin user ${userName} already exists.`);
  console.log('Enter existing admin credentials (or press Ctrl+C to exit and create new user):');

  const response = await prompts([
    {
      type: 'password',
      name: 'accessKeyId',
      message: 'Admin Access Key ID:',
    },
    {
      type: 'password',
      name: 'secretAccessKey',
      message: 'Admin Secret Access Key:',
    },
  ]);

  return response as AccessKeyCredentials;
}
```

**Best practice:** Use AWS Secrets Manager or SSM Parameter Store for admin credentials, but adds complexity for npx tool.

**Practical recommendation:** Create admin user with ONE access key, display prominently, instruct user to store in password manager. On subsequent runs, prompt for existing credentials or offer to create deployment users only (skip admin creation).

**Detection:**
- E2E test: Run setup-aws-envs 3 times with same project
- Verify command doesn't fail on access key limit

**Phase assignment:** Phase 2 (admin credential management)

**Confidence:** HIGH - Verified in [IAM quotas documentation](https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_iam-quotas.html) and observed in current code at line 361-365

---

### Pitfall 6: Security - Admin Credentials in Memory

**What goes wrong:** Admin access key created, used to create deployment users, then command exits. Credentials remain in terminal scrollback, shell history, or process memory dumps. User copies credentials incorrectly, loses them, or they leak.

**Why it happens:** CLI displays credentials for user to store, but provides no structured export. User must manually copy from terminal output.

**Consequences:**
- Credentials visible in terminal scrollback (security issue on shared computers)
- User copies incorrectly, has to recreate admin user
- No audit trail of when credentials were created/used
- Credentials may be logged by terminal multiplexers (tmux, screen)

**Prevention:**

**Strategy 1: Display credentials once with clear instructions**
```typescript
console.log('');
console.log(pc.bold.yellow('IMPORTANT: Admin User Credentials'));
console.log(pc.yellow('━'.repeat(60)));
console.log('');
console.log('Save these credentials securely. They will NOT be shown again.');
console.log('');
console.log(`Admin User: ${pc.cyan(userName)}`);
console.log(`Access Key ID: ${pc.cyan(credentials.accessKeyId)}`);
console.log(`Secret Access Key: ${pc.cyan(credentials.secretAccessKey)}`);
console.log('');
console.log(pc.dim('Recommended: Store in password manager or AWS Secrets Manager'));
console.log('');

// Prompt user to confirm they saved credentials
const { confirmed } = await prompts({
  type: 'confirm',
  name: 'confirmed',
  message: 'Have you saved these credentials?',
  initial: false,
});

if (!confirmed) {
  console.log(pc.red('Credentials not saved. Exiting...'));
  process.exit(1);
}

// Clear credentials from memory
credentials.accessKeyId = '***';
credentials.secretAccessKey = '***';
```

**Strategy 2: Write credentials to temporary file**
```typescript
import { writeFileSync, chmodSync, unlinkSync } from 'node:fs';

const credsPath = '/tmp/aws-admin-credentials.txt';
writeFileSync(
  credsPath,
  `Admin User: ${userName}\n` +
  `Access Key ID: ${credentials.accessKeyId}\n` +
  `Secret Access Key: ${credentials.secretAccessKey}\n`,
  { mode: 0o600 } // Owner read/write only
);

console.log(`Credentials written to: ${credsPath}`);
console.log('Copy to password manager, then delete file.');

// Wait for user confirmation
await prompts({ type: 'confirm', name: 'done', message: 'Delete credentials file?' });
unlinkSync(credsPath);
```

**Strategy 3: Offer to store in AWS Secrets Manager**
```typescript
const { storeInSecretsManager } = await prompts({
  type: 'confirm',
  name: 'storeInSecretsManager',
  message: 'Store admin credentials in AWS Secrets Manager?',
  initial: true,
});

if (storeInSecretsManager) {
  const secretsClient = new SecretsManagerClient({ region });
  await secretsClient.send(new CreateSecretCommand({
    Name: `${projectName}/admin-credentials`,
    SecretString: JSON.stringify({
      username: userName,
      accessKeyId: credentials.accessKeyId,
      secretAccessKey: credentials.secretAccessKey,
    }),
    Tags: [
      { Key: 'Project', Value: projectName },
      { Key: 'ManagedBy', Value: 'create-aws-starter-kit' },
    ],
  }));

  console.log('Credentials stored in AWS Secrets Manager');
}
```

**What NOT to do:**
- Store in project config.json (checked into git)
- Store in environment variables (visible in process list)
- Log credentials (captured by logging systems)
- Write to world-readable temp files

**Detection:**
- Security audit: Check if credentials appear in project files
- Test: Run command, check git status, verify no credential files staged

**Phase assignment:** Phase 2 (admin credential display)

**Confidence:** MEDIUM - Based on Node.js security best practices from [Node.js official docs](https://nodejs.org/en/learn/getting-started/security-best-practices) and [OWASP Node.js practices](https://www.nodejs-security.com/blog/owasp-nodejs-authentication-authorization-cryptography-practices)

---

## Moderate Pitfalls

Mistakes that cause delays, confusion, or technical debt but don't block functionality.

### Pitfall 7: Organizations API Region Lock

**What goes wrong:** Code creates IAMClient with user's configured region (e.g., `us-west-2`), then tries to call Organizations API, gets "UnrecognizedClientException."

**Why it happens:** AWS Organizations API is region-locked to `us-east-1`. Must always use `us-east-1` regardless of user's preferred region.

**Consequences:**
- Command fails immediately with cryptic error
- User thinks their credentials are invalid
- Works in `us-east-1` but fails in other regions (confusing regional behavior)

**Prevention:**
```typescript
// Always use us-east-1 for Organizations API
const orgClient = new OrganizationsClient({ region: 'us-east-1' });

// Use user's preferred region for other services
const iamClient = new IAMClient({ region: config.awsRegion });
```

**Current code:** Already handles this correctly at line 266 (`createOrganizationsClient('us-east-1')`).

**Detection:**
- Test with non-us-east-1 region in config
- Verify Organizations calls succeed

**Phase assignment:** N/A (already handled, but document for awareness)

**Confidence:** HIGH - Current code already implements this correctly

---

### Pitfall 8: STS GetCallerIdentity for Root Detection

**What goes wrong:** Code tries to detect root credentials by checking if user has specific permissions (e.g., `iam:ListUsers`). This fails because root has all permissions, so check always passes. Need different detection method.

**Why it happens:** Permission checks can't distinguish root from admin IAM user (both may have full permissions).

**Consequences:**
- False positives: Admin users detected as root
- False negatives: Root users not detected
- AssumeRole fails later with confusing error

**Prevention:**

**Correct detection via GetCallerIdentity ARN:**
```typescript
import { STSClient, GetCallerIdentityCommand } from '@aws-sdk/client-sts';

async function isRootUser(region: string = 'us-east-1'): Promise<boolean> {
  const client = new STSClient({ region });
  const command = new GetCallerIdentityCommand({});
  const response = await client.send(command);

  // Root user ARN: arn:aws:iam::123456789012:root
  // IAM user ARN: arn:aws:iam::123456789012:user/username
  // IAM role ARN: arn:aws:sts::123456789012:assumed-role/role-name/session

  const arn = response.Arn;

  if (!arn) {
    throw new Error('GetCallerIdentity returned no ARN');
  }

  return arn.endsWith(':root');
}
```

**Why this works:** ARN format definitively indicates credential type. No ambiguity.

**What NOT to check:**
- Account ID alone (root and IAM users share account ID)
- Permissions (root has all, admin may have all)
- Username field (doesn't exist for root in GetCallerIdentity)

**Detection:**
- Test with actual root credentials
- Test with admin IAM user with AdministratorAccess
- Test with limited IAM user
- Verify correct classification in all cases

**Phase assignment:** Phase 1 (root detection)

**Confidence:** HIGH - Verified in [AWS STS GetCallerIdentity docs](https://docs.aws.amazon.com/STS/latest/APIReference/API_GetCallerIdentity.html) and [common usage patterns](https://www.pulumi.com/what-is/run-aws-sts-get-caller-identity-with-dynamic-credentials/)

---

### Pitfall 9: Admin User Naming Collision

**What goes wrong:** User creates project "myapp", CLI creates admin user "myapp-admin". User later creates another project "myapp", CLI tries to create "myapp-admin" again, fails because IAM user names are globally unique per account.

**Why it happens:** Admin user lives in management account (shared across all projects). Deployment users live in member accounts (isolated per project). If multiple projects use same name, admin users collide.

**Consequences:**
- Second project setup fails immediately
- Error message: "User myapp-admin already exists"
- User must manually choose different project name
- No clear guidance on resolution

**Prevention:**

**Strategy 1: Include timestamp in admin user name**
```typescript
const timestamp = Date.now();
const adminUserName = `${projectName}-admin-${timestamp}`;
```
**Downside:** Ugly names, still only allows one project setup at a time (eventual consistency window).

**Strategy 2: Check and adopt existing admin user**
```typescript
async function getOrCreateProjectAdmin(
  client: IAMClient,
  projectName: string
): Promise<{ userName: string; isNew: boolean }> {
  const userName = `${projectName}-admin`;

  if (await userExists(client, userName)) {
    // Check if user is tagged for this project
    const hasProjectTag = await userHasTag(client, userName, 'Project', projectName);

    if (hasProjectTag) {
      // Adopt existing admin for this project
      return { userName, isNew: false };
    } else {
      // Admin exists for different project - suggest different name
      throw new Error(
        `An admin user named "${userName}" already exists for a different project. ` +
        `Please use a different project name or delete the existing admin user.`
      );
    }
  }

  // Create new admin user
  await createUser(client, userName, [
    { Key: 'Project', Value: projectName },
    { Key: 'Purpose', Value: 'Organization Admin' },
    { Key: 'ManagedBy', Value: 'create-aws-starter-kit' },
  ]);

  return { userName, isNew: true };
}
```

**Strategy 3: Namespace admin users by AWS account ID**
```typescript
const accountId = await getAccountId(); // From GetCallerIdentity
const adminUserName = `${projectName}-admin-${accountId.slice(-6)}`;
```
**Downside:** Account ID doesn't prevent collisions (same account + same project name still collides).

**Best practice:** Tag-based adoption (Strategy 2). If project name matches tag, reuse admin. Otherwise, error with clear resolution.

**Detection:**
- E2E test: Create two projects with same name
- Verify second setup handles existing admin gracefully

**Phase assignment:** Phase 1 (admin user creation with tags)

**Confidence:** MEDIUM - Based on IAM user uniqueness constraints and current tag-based adoption pattern for deployment users (line 132-148)

---

### Pitfall 10: CreateAccount Asynchronous Polling Timeout

**What goes wrong:** `CreateAccount` returns immediately with request ID. `waitForAccountCreation` polls status. Account creation takes 8-10 minutes (unusually slow). Polling times out after 5 minutes, command fails, but account is still being created in background.

**Why it happens:** AWS account creation is asynchronous and can take "several minutes" according to docs. No guaranteed SLA. Polling timeout too short.

**Consequences:**
- Command fails but account created successfully
- Re-run tries to create again with same email
- Gets EMAIL_ALREADY_EXISTS error
- User manually finds account ID, adds to config

**Prevention:**

**Current implementation:** Line 295 shows `waitForAccountCreation` with no explicit timeout. Need to verify implementation.

```typescript
async function waitForAccountCreation(
  client: OrganizationsClient,
  requestId: string,
  maxWaitSeconds: number = 600 // 10 minutes
): Promise<{ accountId: string }> {
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitSeconds * 1000) {
    const command = new DescribeCreateAccountStatusCommand({ CreateAccountRequestId: requestId });
    const response = await client.send(command);

    const status = response.CreateAccountStatus?.State;

    if (status === 'SUCCEEDED') {
      const accountId = response.CreateAccountStatus?.AccountId;
      if (!accountId) {
        throw new Error('Account creation succeeded but no account ID returned');
      }
      return { accountId };
    }

    if (status === 'FAILED') {
      const reason = response.CreateAccountStatus?.FailureReason;
      throw new Error(`Account creation failed: ${reason}`);
    }

    // Still IN_PROGRESS - wait and poll again
    await sleep(10000); // Poll every 10 seconds
  }

  throw new Error(
    `Account creation timed out after ${maxWaitSeconds} seconds. ` +
    `The account may still be creating. Check AWS Console > Organizations > Accounts ` +
    `and add the account ID to config.json if creation succeeds.`
  );
}
```

**Recommended timeout:** 10 minutes (600 seconds) based on observed account creation times.

**Detection:**
- E2E test with actual account creation (slow, expensive)
- Monitor production account creation times
- Set timeout generously to avoid false failures

**Phase assignment:** Phase 1 (verify existing timeout, extend if needed)

**Confidence:** HIGH - Verified in [AWS Organizations CreateAccount docs](https://docs.aws.amazon.com/organizations/latest/APIReference/API_CreateAccount.html) stating "asynchronous" and "may take several minutes"

---

## Minor Pitfalls

Mistakes that cause annoyance but are easily fixed.

### Pitfall 11: Config File Race Condition

**What goes wrong:** Two parallel operations (unlikely but possible with future concurrency) try to update config.json simultaneously. One write overwrites the other, losing data.

**Why it happens:** Read-modify-write without locking. Current code (line 160-169) reads, modifies, writes without atomic guarantees.

**Consequences:**
- Very rare (current code is sequential)
- If happens: Data loss, confusing state
- Possible if future refactor adds parallelism

**Prevention:**
```typescript
import { readFileSync, writeFileSync, renameSync } from 'node:fs';

function atomicConfigUpdate(
  configPath: string,
  updateFn: (config: ConfigFile) => ConfigFile
): void {
  // Read
  const content = readFileSync(configPath, 'utf-8');
  const config = JSON.parse(content);

  // Modify
  const updated = updateFn(config);

  // Write atomically via rename
  const tempPath = `${configPath}.${Date.now()}.tmp`;
  writeFileSync(tempPath, JSON.stringify(updated, null, 2) + '\n', 'utf-8');
  renameSync(tempPath, configPath); // Atomic on POSIX systems
}
```

**Detection:**
- Code review for concurrent writes
- Stress test with rapid command invocations

**Phase assignment:** Phase 3 (polish)

**Confidence:** LOW - Race condition theoretical in current sequential code

---

### Pitfall 12: Spinner State on Error

**What goes wrong:** Ora spinner left spinning after error, terminal state corrupted, subsequent output overlaps with spinner.

**Why it happens:** Error thrown before `spinner.fail()` called. Current code (line 350) calls `spinner.fail()` in catch block, which is correct, but need to ensure all error paths call it.

**Consequences:**
- Terminal looks broken
- User has to clear terminal
- Unprofessional UX

**Prevention:**

**Current code:** Already has `spinner.fail()` at line 350. Good.

**Ensure coverage:**
```typescript
let spinner: Ora | undefined;

try {
  spinner = ora('Starting...').start();

  // ... operations ...

  spinner.succeed('Complete');
} catch (error) {
  if (spinner) {
    spinner.fail('Failed');
  }
  throw error;
} finally {
  // Ensure spinner is stopped even if error thrown
  if (spinner?.isSpinning) {
    spinner.stop();
  }
}
```

**Detection:**
- Test all error paths
- Verify spinner stops gracefully

**Phase assignment:** Phase 3 (polish)

**Confidence:** HIGH - Current code already handles this, just verify completeness

---

## Phase-Specific Warnings

Pitfalls mapped to v1.6 milestone phases with specific guidance.

| Phase | Focus | Critical Pitfalls | Prevention Approach |
|-------|-------|------------------|---------------------|
| **Phase 1: Root Detection & Admin Creation** | Detect root credentials via STS, create admin IAM user | #1 (root can't assume roles), #4 (partial failure recovery), #8 (root detection method) | - Use GetCallerIdentity ARN check<br>- Create admin BEFORE account loop<br>- Tag admin users for adoption<br>- Skip email prompts if accounts exist |
| **Phase 2: Admin Credential Management** | Store/retrieve admin credentials, switch credential providers | #2 (eventual consistency), #3 (credential provider caching), #5 (access key limit), #6 (credential security) | - Retry with exponential backoff<br>- Create new IAMClient with explicit credentials<br>- Check key count before creation<br>- Display credentials once with confirmation |
| **Phase 3: Idempotent Cross-Account Setup** | Use admin credentials for AssumeRole to member accounts | #2 (eventual consistency on AssumeRole), #9 (admin naming collision), #10 (account creation timeout) | - Retry AssumeRole with new admin credentials<br>- Adopt existing admin via tags<br>- Set 10-minute timeout for waitForAccountCreation |

## Integration Pitfalls with Existing System

Mistakes specific to adding root/admin handling to the existing CLI.

### Integration Pitfall 1: Backward Compatibility

**Issue:** Existing projects created with root credentials directly. Adding admin user requirement breaks existing workflows.

**Prevention:**
- Admin creation is optional: If caller identity is not root, skip admin creation
- Existing config files work without modification
- Command detects presence of admin credentials and uses them if available

**Detection:**
- Test setup-aws-envs with existing project config
- Test with IAM user credentials (should skip admin creation)
- Test with root credentials (should create admin)

---

### Integration Pitfall 2: initialize-github Credential Dependency

**Issue:** `initialize-github` currently uses caller's credentials to assume role and create deployment user access keys. If admin user created but credentials not passed through, initialize-github fails.

**Prevention:**

**Option 1: Store admin credentials in config** (NOT RECOMMENDED - security risk)

**Option 2: Detect and prompt for admin credentials**
```typescript
async function getCredentialsForInitializeGithub(): Promise<Credentials> {
  const identity = await getCallerIdentity();

  if (identity.arn.endsWith(':root')) {
    throw new Error(
      'Cannot run initialize-github with root credentials. ' +
      'Please configure AWS CLI with the admin user credentials created during setup-aws-envs.'
    );
  }

  // Use current credentials (IAM user or admin)
  return getDefaultCredentials();
}
```

**Option 3: Document credential requirement**
```typescript
console.log('');
console.log(pc.bold('Next Steps:'));
console.log('');
console.log('1. Configure AWS CLI with admin credentials:');
console.log(`   ${pc.cyan('aws configure --profile myapp-admin')}`);
console.log('');
console.log('2. Run initialize-github for each environment:');
console.log(`   ${pc.cyan('AWS_PROFILE=myapp-admin npx create-aws-project initialize-github dev')}`);
console.log('');
```

**Recommended:** Option 2 + Option 3 (detect root and error with clear instructions).

**Detection:**
- E2E test: setup-aws-envs with root → initialize-github with root (should error)
- E2E test: setup-aws-envs with root → initialize-github with admin (should succeed)

---

## Validation Checklist

Use this before declaring v1.6 milestone complete.

**Root Detection:**
- [ ] GetCallerIdentity returns correct ARN format
- [ ] Root user correctly identified (ARN ends with `:root`)
- [ ] IAM user not falsely identified as root
- [ ] Detection happens before any account creation

**Admin User Creation:**
- [ ] Admin user created in management account
- [ ] Admin user has AdministratorAccess policy attached
- [ ] Admin user tagged with Project and ManagedBy
- [ ] Access key created and displayed to user
- [ ] User prompted to confirm credentials saved
- [ ] Credentials cleared from memory after display

**Credential Switching:**
- [ ] New IAMClient created with explicit admin credentials
- [ ] GetCallerIdentity confirms using admin credentials (not root)
- [ ] AssumeRole succeeds with admin credentials
- [ ] Cross-account IAM operations use admin credentials

**Idempotency:**
- [ ] Re-running setup-aws-envs with same project name succeeds
- [ ] Existing admin user adopted (no creation attempt)
- [ ] Existing accounts detected (no email prompts)
- [ ] Existing deployment users adopted (no recreation)
- [ ] Config file updated correctly on partial success

**Eventual Consistency:**
- [ ] Wait 5 seconds after admin user creation before use
- [ ] Retry AssumeRole with exponential backoff
- [ ] Retry access key creation with exponential backoff
- [ ] Verify credentials work before proceeding

**Error Handling:**
- [ ] Root credentials attempting AssumeRole shows clear error
- [ ] EMAIL_ALREADY_EXISTS shows resolution steps
- [ ] Access key limit (2 keys) shows resolution steps
- [ ] Partial failure preserves config state
- [ ] Spinner stops on all error paths

**Integration:**
- [ ] initialize-github works with admin credentials
- [ ] initialize-github rejects root credentials with instructions
- [ ] Existing projects without admin continue working
- [ ] Backward compatible with v1.5.1 configs

---

## Sources

**AWS Official Documentation:**
- [IAM Troubleshooting](https://docs.aws.amazon.com/IAM/latest/UserGuide/troubleshoot.html) - Eventual consistency, root user limitations
- [IAM Quotas](https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_iam-quotas.html) - Access key limits, resource limits
- [Organizations Troubleshooting](https://docs.aws.amazon.com/organizations/latest/userguide/orgs_troubleshoot.html) - Account creation errors
- [STS GetCallerIdentity](https://docs.aws.amazon.com/STS/latest/APIReference/API_GetCallerIdentity.html) - Root detection method
- [Root User Best Practices](https://docs.aws.amazon.com/IAM/latest/UserGuide/root-user-best-practices.html) - Root credential management
- [Organizations CreateAccount](https://docs.aws.amazon.com/organizations/latest/APIReference/API_CreateAccount.html) - Asynchronous operations
- [AWS SDK Retry Behavior](https://docs.aws.amazon.com/sdkref/latest/guide/feature-retry-behavior.html) - Retry strategies
- [AWS SDK Credential Provider Chain](https://docs.aws.amazon.com/sdk-for-java/latest/developer-guide/credentials-chain.html) - Credential caching

**Community Resources:**
- [IAM Persistence through Eventual Consistency - Hacking The Cloud](https://hackingthe.cloud/aws/post_exploitation/iam_persistence_eventual_consistency/) - 3-4 second propagation window
- [HashiCorp Vault Issue #3115](https://github.com/hashicorp/vault/issues/3115) - IAM eventual consistency in practice
- [Netflix Security Monkey Issue #1026](https://github.com/Netflix/security_monkey/issues/1026) - Root cannot assume roles
- [AWS re:Post: EMAIL_ALREADY_EXISTS](https://repost.aws/knowledge-center/organizations-error-email-already-exists) - Error handling strategies
- [Node.js Security Best Practices](https://nodejs.org/en/learn/getting-started/security-best-practices) - Credential storage
- [AWS Retry with Backoff Pattern](https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/retry-backoff.html) - Implementation guidance

**Confidence Levels:**
- **HIGH**: Verified in official AWS documentation or observed in current codebase
- **MEDIUM**: Based on best practices and community experience
- **LOW**: Theoretical risk, not observed in practice
