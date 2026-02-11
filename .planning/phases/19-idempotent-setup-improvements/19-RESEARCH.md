# Phase 19: Idempotent Setup Improvements - Research

**Researched:** 2026-02-11
**Domain:** Idempotent CLI operations, conditional prompting, resumable workflows, state-based skip logic
**Confidence:** HIGH

## Summary

Phase 19 makes `setup-aws-envs` fully idempotent by eliminating redundant prompts when re-running the command. The current implementation (Phase 18) already handles partial failures by persisting state after each successful operation, but it still prompts for all three account emails even when accounts already exist in the config.

Idempotent operations are fundamental to reliable CLI tools. An idempotent configuration is one where the system can be repeatedly configured to the same state, and the outcome will always be the same, regardless of how many times the operation is applied. The key principle: check current state first, only prompt for missing data, only perform operations that haven't completed yet.

The challenge: We need to determine which accounts need to be created (and thus require email prompts) versus which already exist. The solution involves querying AWS Organizations' ListAccounts API to match existing accounts by name, then only prompting for emails of accounts that need creation.

**Primary recommendation:** Query AWS Organizations ListAccounts API before collecting emails, match existing accounts by name pattern (`{projectName}-{env}`), build a map of which environments need creation, and conditionally prompt for only those emails using the `prompts` library's type function feature to skip unnecessary prompts.

## Standard Stack

No new libraries required. This phase uses existing dependencies with advanced features:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| prompts | Already in use | Conditional user prompts | Supports type functions for dynamic prompt skipping based on state |
| @aws-sdk/client-organizations | 3.x | ListAccounts API | Official AWS SDK, already used for organization management |
| @aws-sdk/client-iam | 3.x | IAM operations | Already used, no changes needed |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| ora | Already in use | Progress spinners | Display status during AWS API calls |
| picocolors | Already in use | Terminal colors | User feedback and warnings |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| AWS ListAccounts API | Config file only | Config could be stale or manually edited. AWS is source of truth for what accounts exist. |
| Dynamic type functions in prompts | Separate prompt arrays for missing vs existing | More complex code, loses sequential validation, harder to maintain |
| Prompt then skip creation | Skip prompt entirely | Avoids collecting unnecessary data, cleaner UX, faster re-runs |

**Installation:**
```bash
# No new dependencies required
```

## Architecture Patterns

### Recommended Control Flow
```
1. Load config and detect existing state
2. Query AWS Organizations ListAccounts
3. Match accounts by name to determine what needs creation
4. Conditionally prompt for emails (only missing accounts)
5. Execute AWS operations (skip existing, create missing)
6. Update config after each successful step
```

### Pattern 1: Pre-Flight State Discovery

**What:** Query AWS Organizations to determine which accounts already exist before prompting user

**When to use:** When you need to skip prompts for resources that already exist in AWS

**Example:**
```typescript
// In setup-aws-envs.ts - BEFORE collecting emails

// Query AWS Organizations for existing accounts
spinner.start('Checking existing AWS accounts...');
const existingAccounts = await listOrganizationAccounts(client);

// Build map of which environments already have accounts
const accountsByEnv = new Map<string, string>();
for (const env of ENVIRONMENTS) {
  const accountName = `${config.projectName}-${env}`;
  const existing = existingAccounts.find(acc => acc.Name === accountName);
  if (existing) {
    accountsByEnv.set(env, existing.Id);
    spinner.info(`Found existing ${env} account: ${existing.Id}`);
  }
}

// Determine which environments need creation
const needsCreation = ENVIRONMENTS.filter(env => !accountsByEnv.has(env));
```

**Rationale:** AWS is the source of truth for what accounts exist. Config could be stale, manually edited, or from a different machine. Query AWS first to get accurate state.

### Pattern 2: Conditional Prompting with Type Functions

**What:** Use `prompts` library's type function feature to dynamically skip prompts based on state

**When to use:** When some inputs may already be satisfied and shouldn't be re-requested

**Example:**
```typescript
// Build conditional prompts array
const emailPrompts = [
  {
    type: () => needsCreation.includes('dev') ? 'text' : null,
    name: 'dev',
    message: 'Dev account root email:',
    validate: validateEmail,
  },
  {
    type: (prev, values) => needsCreation.includes('stage') ? 'text' : null,
    name: 'stage',
    message: 'Stage account root email:',
    validate: (v: string) => validateUniqueEmail(v, [values.dev].filter(Boolean)),
  },
  {
    type: (prev, values) => needsCreation.includes('prod') ? 'text' : null,
    name: 'prod',
    message: 'Prod account root email:',
    validate: (v: string) => validateUniqueEmail(v, [values.dev, values.stage].filter(Boolean)),
  },
];

// Prompt only for missing accounts
const emails = await prompts(emailPrompts, { onCancel });
```

**Rationale:** When `type` returns `null` or a falsy value, `prompts` automatically skips that question. This provides clean conditional logic without complex branching.

### Pattern 3: Merge Existing and Newly Created State

**What:** Combine accounts from config/AWS query with newly created accounts

**When to use:** When some resources exist and others need creation

**Example:**
```typescript
// Start with existing accounts from AWS query
const accounts: Record<string, string> = { ...existingAccounts };

// Create only missing accounts
for (const env of needsCreation) {
  if (!emails[env]) {
    // User didn't provide email (shouldn't happen with validation, but safety check)
    continue;
  }

  spinner.start(`Creating ${env} account...`);
  const accountName = `${config.projectName}-${env}`;
  const { requestId } = await createAccount(client, emails[env], accountName);

  const result = await waitForAccountCreation(client, requestId);
  accounts[env] = result.accountId;

  // Save after each successful creation (partial failure resilience)
  updateConfig(configPath, accounts);

  spinner.succeed(`Created ${env} account: ${result.accountId}`);
}
```

**Rationale:** Preserve existing accounts, only create what's missing, update config progressively. Matches established pattern from Phase 18.

### Pattern 4: ListAccounts with Pagination

**What:** Properly handle AWS Organizations ListAccounts pagination to avoid missing accounts

**When to use:** When querying for existing accounts in an organization that might have many accounts

**Example:**
```typescript
// In src/aws/organizations.ts - NEW function

import { ListAccountsCommand, type Account } from '@aws-sdk/client-organizations';

/**
 * Lists all accounts in the organization
 * Handles pagination automatically
 */
export async function listOrganizationAccounts(
  client: OrganizationsClient
): Promise<Account[]> {
  const accounts: Account[] = [];
  let nextToken: string | undefined;

  do {
    const command = new ListAccountsCommand({
      NextToken: nextToken,
    });

    const response = await client.send(command);

    if (response.Accounts) {
      accounts.push(...response.Accounts);
    }

    nextToken = response.NextToken;
  } while (nextToken);

  return accounts;
}
```

**Rationale:** AWS Organizations ListAccounts can return paginated results (max 20 per page). Must continue requesting until NextToken is null to get all accounts. This prevents missing accounts that would cause duplicate creation attempts.

### Anti-Patterns to Avoid

- **Config-only state detection:** Don't rely solely on config file to determine what exists. Config could be stale, manually edited, or deleted. Query AWS as source of truth.

- **Prompt then ignore:** Don't collect all emails then skip creation. Skip the prompt entirely if account exists. Better UX, clearer intent.

- **Single-shot prompts without validation chaining:** Don't break up sequential prompts. Keep dev → stage → prod flow for uniqueness validation.

- **Matching accounts by email in ListAccounts:** Don't match by email. Emails are root account addresses and not returned in ListAccounts response. Match by account Name field instead.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Conditional prompt logic | Custom prompt filtering or multiple prompt functions | `prompts` type function returning null/falsy | Built-in feature, cleaner code, maintains prompt array structure |
| Account existence checking | Parse config file or cache | AWS Organizations ListAccounts API | AWS is source of truth, handles multi-machine scenarios, detects manual account creation |
| Pagination handling | Manual loop with break conditions | do-while loop checking NextToken !== null | Standard AWS pagination pattern, prevents infinite loops, clear termination condition |
| Email uniqueness validation | Set-based deduplication after collection | Sequential prompts with validateUniqueEmail checking previous values | Immediate feedback, prevents invalid input, matches existing pattern |

**Key insight:** The `prompts` library already supports conditional prompt skipping via type functions. Don't build custom prompt orchestration logic when the library provides this natively.

## Common Pitfalls

### Pitfall 1: Matching Accounts by Email Instead of Name

**What goes wrong:** Developer tries to match existing accounts using the email addresses collected from user, but ListAccounts doesn't return email in a usable way for matching

**Why it happens:** Intuitive to think "I have emails, I'll match by email" but AWS Organizations ListAccounts returns account email only for display, not guaranteed to match creation email

**How to avoid:**
- Match accounts by Name field using pattern `{projectName}-{env}`
- Account names are set during creation and won't change
- Names are reliable identifiers for accounts you created

**Warning signs:**
- Accounts exist but are recreated anyway
- Email matching logic fails to find accounts
- Duplicate account creation attempts

**Prevention:**
```typescript
// WRONG: Matching by email (unreliable)
const existing = existingAccounts.find(acc => acc.Email === emails.dev);

// RIGHT: Match by name pattern
const accountName = `${config.projectName}-${env}`;
const existing = existingAccounts.find(acc => acc.Name === accountName);
```

### Pitfall 2: Forgetting Pagination in ListAccounts

**What goes wrong:** ListAccounts returns only first page of results (max 20 accounts), missing accounts beyond page 1, causing duplicate creation attempts

**Why it happens:** Developer assumes single API call returns all accounts, doesn't check NextToken

**How to avoid:**
- Always use do-while loop with NextToken check
- Continue requesting until NextToken returns null/undefined
- Accumulate all accounts from all pages

**Warning signs:**
- Works in test orgs with <20 accounts, fails in production with more accounts
- Accounts exist but aren't detected
- Error: "An account with that name already exists"

**Prevention:**
```typescript
// WRONG: Single call (misses accounts beyond page 1)
const response = await client.send(new ListAccountsCommand({}));
const accounts = response.Accounts || [];

// RIGHT: Paginate until exhausted
let nextToken: string | undefined;
do {
  const response = await client.send(new ListAccountsCommand({ NextToken: nextToken }));
  accounts.push(...(response.Accounts || []));
  nextToken = response.NextToken;
} while (nextToken);
```

### Pitfall 3: Race Condition Between ListAccounts and Config State

**What goes wrong:** Config has accounts from previous run, ListAccounts shows fewer accounts (e.g., account was deleted), state becomes inconsistent

**Why it happens:** Config and AWS state can diverge when accounts are deleted externally or from another machine

**How to avoid:**
- Treat AWS as source of truth for existence
- Use config for IDs to preserve but validate against AWS
- Merge config accounts with AWS-discovered accounts
- Log warnings when config has accounts not found in AWS

**Warning signs:**
- Config shows 3 accounts but AWS shows 1
- Setup tries to create account that's in config but not AWS
- Account ID in config doesn't exist in AWS anymore

**Prevention:**
```typescript
// Merge strategy: AWS existence takes precedence
const existingFromAws = new Map<string, string>();
for (const account of awsAccounts) {
  const envMatch = ENVIRONMENTS.find(e => account.Name === `${projectName}-${e}`);
  if (envMatch) {
    existingFromAws.set(envMatch, account.Id);
  }
}

// Check for accounts in config but not in AWS
const configAccounts = config.accounts ?? {};
for (const [env, accountId] of Object.entries(configAccounts)) {
  if (!existingFromAws.has(env)) {
    console.warn(pc.yellow('Warning:') + ` Account ${env} (${accountId}) in config not found in AWS Organization`);
    console.warn(pc.dim('It may have been deleted. Will attempt to recreate if needed.'));
  }
}
```

### Pitfall 4: Breaking Email Uniqueness Validation

**What goes wrong:** When skipping some email prompts, uniqueness validation breaks because it references undefined values

**Why it happens:** validateUniqueEmail checks against previous prompt values, but if dev was skipped, values.dev is undefined

**How to avoid:**
- Filter validation array to remove undefined/null values
- Use `.filter(Boolean)` to remove falsy values before passing to validation
- Handle optional chaining in validation function

**Warning signs:**
- Validation error when it shouldn't occur
- Can't enter stage email because dev validation fails
- TypeError: Cannot read property 'toLowerCase' of undefined

**Prevention:**
```typescript
// WRONG: Passes undefined to validation
validate: (v: string) => validateUniqueEmail(v, [values.dev, values.stage])

// RIGHT: Filter out undefined values
validate: (v: string) => validateUniqueEmail(v, [values.dev, values.stage].filter(Boolean))

// ALSO RIGHT: Handle in validation function
function validateUniqueEmail(value: string, existing: string[]): boolean | string {
  const emailValid = validateEmail(value);
  if (emailValid !== true) return emailValid;

  const lower = value.toLowerCase();
  // Filter out undefined/null before checking
  if (existing.filter(Boolean).some(e => e.toLowerCase() === lower)) {
    return 'Each account requires a unique email address';
  }
  return true;
}
```

### Pitfall 5: Prompting Before Admin User Setup

**What goes wrong:** User is prompted for emails before admin user creation completes, then admin user creation fails, wasting user's input

**Why it happens:** Developer moves email collection before root detection and admin user setup

**How to avoid:**
- Keep email collection AFTER admin user setup
- Only collect input after all prerequisite AWS operations complete
- Fail fast on authentication/permission issues before user interaction

**Warning signs:**
- User enters 3 emails, then command fails on credentials
- User prompted for input, then told to fix AWS permissions
- Poor UX: input collection followed by early failure

**Prevention:**
```typescript
// Correct flow (existing pattern):
// 1. Validate project context
// 2. Check/create admin user (can fail early on auth/permission)
// 3. Discover existing accounts from AWS
// 4. Collect emails for missing accounts (late in flow, only after AWS access confirmed)
// 5. Create accounts
// 6. Create deployment users
// 7. Create access keys
```

## Code Examples

### ListAccounts Implementation

```typescript
// Source: AWS Organizations API documentation + codebase pattern

import {
  ListAccountsCommand,
  type Account,
  type OrganizationsClient,
} from '@aws-sdk/client-organizations';

/**
 * Lists all accounts in the organization
 * Handles pagination automatically to retrieve all accounts
 *
 * @param client OrganizationsClient instance
 * @returns Array of all accounts in the organization
 */
export async function listOrganizationAccounts(
  client: OrganizationsClient
): Promise<Account[]> {
  const accounts: Account[] = [];
  let nextToken: string | undefined;

  // Paginate until all accounts retrieved
  do {
    const command = new ListAccountsCommand({
      NextToken: nextToken,
    });

    const response = await client.send(command);

    if (response.Accounts) {
      accounts.push(...response.Accounts);
    }

    nextToken = response.NextToken;
  } while (nextToken);

  return accounts;
}
```

### Account Discovery Before Email Collection

```typescript
// In setup-aws-envs.ts - INSERT BEFORE collectEmails()

// Query AWS for existing accounts AFTER admin user setup
spinner.start('Checking for existing AWS accounts...');
const allAccounts = await listOrganizationAccounts(client);

// Map accounts by environment
const existingAccountsByEnv = new Map<string, string>();
for (const account of allAccounts) {
  for (const env of ENVIRONMENTS) {
    const expectedName = `${config.projectName}-${env}`;
    if (account.Name === expectedName && account.Id) {
      existingAccountsByEnv.set(env, account.Id);
    }
  }
}

// Determine which environments need creation
const environmentsNeedingCreation = ENVIRONMENTS.filter(
  env => !existingAccountsByEnv.has(env)
);

// Show what was found
for (const [env, accountId] of existingAccountsByEnv.entries()) {
  spinner.info(`Found existing ${env} account: ${accountId}`);
}

spinner.stop();

// If all accounts exist, skip email collection entirely
if (environmentsNeedingCreation.length === 0) {
  console.log('');
  console.log(pc.green('All environment accounts already exist.'));
  console.log('');
  console.log('Proceeding to deployment user setup...');
  console.log('');
} else {
  // Collect emails only for accounts that need creation
  const emails = await collectEmails(config.projectName, environmentsNeedingCreation);
}
```

### Modified Email Collection with Conditional Prompts

```typescript
// Modified collectEmails function signature and implementation

/**
 * Collects unique email addresses for environment accounts that need creation
 *
 * @param projectName Project name for display
 * @param environmentsToCreate Array of environments that need account creation
 * @returns Record of environment to email (only for environments that need creation)
 */
async function collectEmails(
  projectName: string,
  environmentsToCreate: typeof ENVIRONMENTS[number][]
): Promise<Record<string, string>> {
  console.log('');
  console.log(pc.bold('AWS Account Configuration'));
  console.log('');
  console.log(`Setting up environment accounts for ${pc.cyan(projectName)}`);
  console.log('');

  if (environmentsToCreate.length < ENVIRONMENTS.length) {
    console.log(pc.dim(`Note: Only collecting emails for accounts that need creation.`));
    console.log('');
  }

  console.log('Each AWS environment account requires a unique root email address.');
  console.log(pc.dim('Tip: Use email aliases like yourname+dev@company.com'));
  console.log('');

  const onCancel = (): void => {
    console.log(`\n${pc.red('x')} Setup cancelled`);
    process.exit(1);
  };

  // Build conditional prompts based on which environments need creation
  const prompts = [
    {
      type: () => environmentsToCreate.includes('dev') ? 'text' : null,
      name: 'dev',
      message: 'Dev account root email:',
      validate: validateEmail,
    },
    {
      type: (prev: any, values: any) => environmentsToCreate.includes('stage') ? 'text' : null,
      name: 'stage',
      message: 'Stage account root email:',
      validate: (v: string, values: any) =>
        validateUniqueEmail(v, [values.dev].filter(Boolean)),
    },
    {
      type: (prev: any, values: any) => environmentsToCreate.includes('prod') ? 'text' : null,
      name: 'prod',
      message: 'Prod account root email:',
      validate: (v: string, values: any) =>
        validateUniqueEmail(v, [values.dev, values.stage].filter(Boolean)),
    },
  ];

  const responses = await prompts(prompts, { onCancel });

  // Validate we got emails for all needed environments
  for (const env of environmentsToCreate) {
    if (!responses[env]) {
      console.log(pc.red('Error:') + ` ${env} email is required.`);
      process.exit(1);
    }
  }

  return responses as Record<string, string>;
}
```

### Account Creation Loop with Existing Account Merge

```typescript
// In setup-aws-envs.ts - Modified account creation section

// Start with existing accounts discovered from AWS
const accounts: Record<string, string> = {};
for (const [env, accountId] of existingAccountsByEnv.entries()) {
  accounts[env] = accountId;
}

// Create only accounts that don't exist
for (const env of ENVIRONMENTS) {
  // Skip if account already exists in AWS
  if (existingAccountsByEnv.has(env)) {
    spinner.succeed(`Using existing ${env} account: ${existingAccountsByEnv.get(env)}`);
    continue;
  }

  // Check if we have email for this environment (should always be true if validation worked)
  if (!emails[env]) {
    spinner.warn(`No email provided for ${env}, skipping account creation`);
    continue;
  }

  spinner.start(`Creating ${env} account (this may take several minutes)...`);

  const accountName = `${config.projectName}-${env}`;
  const { requestId } = await createAccount(client, emails[env], accountName);

  spinner.text = `Waiting for ${env} account creation...`;
  const result = await waitForAccountCreation(client, requestId);

  accounts[env] = result.accountId;

  // Save after EACH successful account (partial failure resilience)
  updateConfig(configPath, accounts);

  spinner.succeed(`Created ${env} account: ${result.accountId}`);
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Always prompt for all three emails | Conditionally prompt only for missing accounts | Phase 19 (2026-02) | Better UX on re-runs, faster recovery from failures, idempotent behavior |
| Config file as only state source | Query AWS Organizations as source of truth | Phase 19 (2026-02) | Handles multi-machine scenarios, detects manual changes, more reliable |
| Sequential individual prompts | Prompt array with type functions | Phase 19 (2026-02) | Cleaner code, maintains validation chain, easier to extend |
| Single-page ListAccounts | Paginated ListAccounts with NextToken | Phase 19 (2026-02) | Handles orgs with >20 accounts, prevents missing accounts |

**Deprecated/outdated:**
- **Unconditional email collection:** Replaced by conditional prompts that skip existing accounts
- **Config-only state detection:** Replaced by AWS Organizations query for ground truth

## Open Questions

1. **Should we warn users when AWS state diverges from config?**
   - What we know: Config can have accounts that don't exist in AWS (deleted externally)
   - What's unclear: Whether to warn, error, or silently handle divergence
   - Recommendation: Log warning but continue. Let user know config is stale but don't block. AWS state wins.

2. **What if account exists in AWS but not in config?**
   - What we know: User might have created account manually or from different machine
   - What's unclear: Should we adopt it or ignore it
   - Recommendation: Adopt by name pattern match, update config, proceed with deployment user setup. Helps migration scenarios.

3. **Should we support account email updates?**
   - What we know: AWS Organizations doesn't support changing account root email via API (requires AWS Console)
   - What's unclear: Whether to detect email mismatch and warn user
   - Recommendation: Skip email mismatch detection. ListAccounts doesn't reliably return email for comparison. Document that email changes must be done in AWS Console.

4. **Handle SUSPENDED or PENDING_CLOSURE account states?**
   - What we know: Accounts can be in states other than ACTIVE
   - What's unclear: Should we skip, warn, or error on non-ACTIVE accounts
   - Recommendation: Check State field (not deprecated Status field), warn if non-ACTIVE but continue. Let user decide if they need to reactivate.

## Sources

### Primary (HIGH confidence)
- [Conditional Prompting Using Prompts - John Wargo](https://johnwargo.com/posts/2024/conditional-prompting-using-prompts/)
- [AWS Organizations ListAccounts API Documentation](https://docs.aws.amazon.com/organizations/latest/APIReference/API_ListAccounts.html)
- [AWS Organizations CLI Reference - list-accounts](https://awscli.amazonaws.com/v2/documentation/api/latest/reference/organizations/list-accounts.html)
- [GitHub - terkelg/prompts](https://github.com/terkelg/prompts) - Conditional prompts with type functions
- Codebase analysis: src/commands/setup-aws-envs.ts, src/aws/organizations.ts
- Phase 18 Research: .planning/phases/18-architecture-simplification/18-RESEARCH.md

### Secondary (MEDIUM confidence)
- [Idempotent configuration management - TechTarget](https://www.techtarget.com/searchitoperations/tip/Idempotent-configuration-management-sets-things-right-no-matter-what)
- [Making retries safe with idempotent APIs - AWS Builders Library](https://aws.amazon.com/builders-library/making-retries-safe-with-idempotent-APIs/)
- [Ensuring idempotency in Amazon EC2 API requests](https://docs.aws.amazon.com/ec2/latest/devguide/ec2-api-idempotency.html)
- [Checkpointing and Resuming Workflows - Microsoft Learn](https://learn.microsoft.com/en-us/agent-framework/tutorials/workflows/checkpointing-and-resuming)
- [Building CLI apps with TypeScript in 2026](https://hackers.pub/@hongminhee/2026/typescript-cli-2026)

### Tertiary (LOW confidence)
- [Resumable uploads - Google Cloud Storage](https://docs.cloud.google.com/storage/docs/resumable-uploads)
- [Configuring a template - copier](https://copier.readthedocs.io/en/stable/configuring/)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Using existing libraries (prompts, AWS SDK), no new dependencies
- Architecture: HIGH - Patterns verified in prompts documentation and AWS API docs, follows established Phase 18 patterns
- Pitfalls: HIGH - Based on AWS SDK documentation (pagination, State vs Status), prompts library behavior, and common CLI patterns

**Research date:** 2026-02-11
**Valid until:** 2026-04-11 (60 days - stable domain, prompts library and AWS Organizations API unlikely to change)
