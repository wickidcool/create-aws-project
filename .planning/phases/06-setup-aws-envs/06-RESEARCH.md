# Phase 6: setup-aws-envs Command - Research

**Researched:** 2026-01-21
**Domain:** AWS Organizations API, CLI progress indicators, config file updates
**Confidence:** HIGH

## Summary

This phase implements the `setup-aws-envs` command that creates AWS Organizations and environment accounts (dev, stage, prod). The existing codebase already has comprehensive AWS Organizations infrastructure in `src/aws/organizations.ts` with all core functions (createOrganizationsClient, checkExistingOrganization, createOrganization, createAccount, waitForAccountCreation, createEnvironmentAccounts). The command stub exists at `src/commands/setup-aws-envs.ts` with `requireProjectContext()` already integrated.

The primary work is: (1) collecting email addresses via prompts, (2) calling existing organization functions, (3) showing progress with a spinner, (4) updating the config file with account IDs, and (5) handling errors gracefully.

**Key findings:**
1. **Existing infrastructure is solid:** The `organizations.ts` module handles all AWS API complexity including async account creation polling, timeout handling, and basic error handling.
2. **Prompts already exist:** `src/prompts/org-structure.ts` has email prompts that can be reused/adapted.
3. **Config update is simple:** Read JSON, update accounts object, write back.
4. **Progress indication:** Use `ora` spinner for elegant async operation feedback.

**Primary recommendation:** Implement the command by wiring together existing components. Add ora for progress indication. The main new code is the command orchestration logic and config file update.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @aws-sdk/client-organizations | 3.700+ | AWS Organizations API | Already in package.json, existing wrapper functions |
| prompts | 2.4.2 | Interactive email collection | Already used throughout project |
| ora | 9.0.0 | Progress spinner | De facto standard for CLI spinners, pure ESM |
| picocolors | 1.1.1 | Terminal colors | Already used throughout project |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| find-up | 8.0.0 | Config discovery | Already used via requireProjectContext() |
| node:fs | built-in | Config file read/write | Native, synchronous sufficient for small JSON |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| ora | cli-spinner | cli-spinner simpler but ora has better promise integration |
| ora | @topcli/spinner | topcli allows multiple spinners but overkill for sequential steps |
| node:fs | write-file-atomic | Atomic writes safer but adds dependency; CLI is single-user, low risk |

**Installation:**
```bash
npm install ora
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── commands/
│   └── setup-aws-envs.ts    # MODIFY: Implement full command logic
├── aws/
│   └── organizations.ts     # NO CHANGE: Already complete
├── prompts/
│   └── org-structure.ts     # REUSE: Email prompts exist
├── utils/
│   └── project-context.ts   # NO CHANGE: requireProjectContext() works
│   └── config-file.ts       # NEW: Config file update utility (optional)
└── types.ts                 # NO CHANGE: Types already defined
```

### Pattern 1: Sequential Async Operations with Spinner
**What:** Show spinner during long-running AWS operations, update text as steps progress
**When to use:** Account creation takes minutes; users need feedback
**Example:**
```typescript
// Source: ora documentation + AWS SDK patterns
import ora from 'ora';

async function setupAwsEnvironments(config: AwsStarterConfig): Promise<void> {
  const spinner = ora('Checking AWS Organizations...').start();

  try {
    // Step 1: Check/create organization
    const client = createOrganizationsClient(config.awsRegion);
    spinner.text = 'Checking for existing organization...';

    let orgId = await checkExistingOrganization(client);
    if (!orgId) {
      spinner.text = 'Creating AWS Organization...';
      orgId = await createOrganization(client);
      spinner.succeed(`Created organization: ${orgId}`);
    } else {
      spinner.succeed(`Using existing organization: ${orgId}`);
    }

    // Step 2: Create accounts sequentially
    for (const env of environments) {
      spinner.start(`Creating ${env} account...`);
      const result = await createAccountWithPolling(client, env, emails[env]);
      spinner.succeed(`Created ${env} account: ${result.accountId}`);
    }

    spinner.succeed('All environment accounts created');
  } catch (error) {
    spinner.fail('Setup failed');
    throw error;
  }
}
```

### Pattern 2: Email Prompt Collection
**What:** Collect unique email for each environment account
**When to use:** Before any AWS API calls
**Example:**
```typescript
// Source: prompts library patterns + existing org-structure.ts
import prompts from 'prompts';

interface EnvironmentEmails {
  dev: string;
  stage: string;
  prod: string;
}

async function collectEmails(projectName: string): Promise<EnvironmentEmails> {
  console.log('');
  console.log(pc.bold('AWS Account Setup'));
  console.log(pc.dim('Each environment needs a unique email address for the root user.'));
  console.log(pc.dim('Tip: Use email aliases like yourname+dev@company.com'));
  console.log('');

  const response = await prompts([
    {
      type: 'text',
      name: 'dev',
      message: 'Dev account email:',
      validate: validateEmail,
    },
    {
      type: 'text',
      name: 'stage',
      message: 'Stage account email:',
      validate: (value) => validateUniqueEmail(value, [response.dev]),
    },
    {
      type: 'text',
      name: 'prod',
      message: 'Prod account email:',
      validate: (value) => validateUniqueEmail(value, [response.dev, response.stage]),
    },
  ], {
    onCancel: () => {
      console.log(pc.red('Setup cancelled'));
      process.exit(1);
    }
  });

  return response as EnvironmentEmails;
}
```

### Pattern 3: Config File Update
**What:** Read config, add account IDs, write back
**When to use:** After successful account creation
**Example:**
```typescript
// Source: Node.js best practices for JSON files
import { readFileSync, writeFileSync } from 'node:fs';

interface AwsStarterConfig {
  configVersion: string;
  projectName: string;
  // ... other fields
  accounts: Record<string, string>;
}

function updateConfigWithAccounts(
  configPath: string,
  accounts: Record<string, string>
): void {
  // Read current config
  const content = readFileSync(configPath, 'utf-8');
  const config = JSON.parse(content) as AwsStarterConfig;

  // Update accounts
  config.accounts = {
    ...config.accounts,
    ...accounts,
  };

  // Write back with formatting
  writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
}
```

### Pattern 4: Graceful Error Handling
**What:** Catch AWS-specific errors and provide actionable messages
**When to use:** Any AWS API call
**Example:**
```typescript
// Source: AWS SDK v3 error handling patterns
function handleAwsError(error: unknown): never {
  if (!(error instanceof Error)) {
    throw error;
  }

  const errorName = error.name;

  switch (errorName) {
    case 'AccessDeniedException':
      console.error('');
      console.error(pc.red('Error: Insufficient AWS permissions'));
      console.error('');
      console.error('Required permissions:');
      console.error('  - organizations:CreateOrganization');
      console.error('  - organizations:CreateAccount');
      console.error('  - organizations:DescribeOrganization');
      console.error('  - organizations:DescribeCreateAccountStatus');
      console.error('');
      console.error('Ensure your AWS credentials have these permissions.');
      break;

    case 'AWSOrganizationsNotInUseException':
      console.error(pc.red('Error: No AWS Organization exists'));
      console.error('This error should not occur - please report as bug.');
      break;

    case 'ConstraintViolationException':
      console.error(pc.red('Error: AWS account limit reached'));
      console.error('');
      console.error(error.message);
      console.error('');
      console.error('Contact AWS Support to increase your account limit.');
      break;

    case 'FinalizingOrganizationException':
      console.error(pc.red('Error: Organization still initializing'));
      console.error('Wait one hour and try again.');
      break;

    default:
      console.error(pc.red(`Error: ${error.message}`));
  }

  process.exit(1);
}
```

### Anti-Patterns to Avoid
- **Creating accounts in parallel:** AWS rate limits require sequential creation
- **Ignoring partial success:** If 2/3 accounts created, save those IDs before failing
- **Hardcoding regions:** Use config.awsRegion, though Organizations API is us-east-1 only
- **Skipping email validation:** Invalid emails cause cryptic AWS errors
- **Not checking for duplicate emails:** Each account needs unique email

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Progress indication | Manual console.log timestamps | ora | Handles terminal clearing, colors, spinners |
| Account creation polling | Custom setInterval loop | Existing waitForAccountCreation() | Already handles timeout, state checking |
| Email validation | Simple regex | Existing validation in org-structure.ts | Handles edge cases |
| Config file detection | process.cwd() path construction | requireProjectContext() | Handles subdirectories via find-up |

**Key insight:** 90% of the functionality already exists. This phase is primarily orchestration.

## Common Pitfalls

### Pitfall 1: AWS Organizations Region Lock
**What goes wrong:** API calls fail with UnsupportedAPIEndpointException
**Why it happens:** Organizations API only works in us-east-1, but config might have different region
**How to avoid:** Always create OrganizationsClient with us-east-1, ignore config.awsRegion for this API
**Warning signs:** Error contains "not available in the current AWS Region"

### Pitfall 2: Account Creation Timeout Too Short
**What goes wrong:** Command reports timeout but account was created
**Why it happens:** AWS says "few minutes" but can take 5+ minutes under load
**How to avoid:** Keep existing 5-minute timeout in waitForAccountCreation(), consider increasing
**Warning signs:** Sporadic "timed out" errors followed by successful manual verification

### Pitfall 3: Partial Success State
**What goes wrong:** 2/3 accounts created, command fails, no record of partial progress
**Why it happens:** Error thrown after some accounts created, config not updated
**How to avoid:** Update config after EACH successful account creation, not at end
**Warning signs:** User runs command again, gets "email already in use" for previously created accounts

### Pitfall 4: Spinner Blocks on Sync Operations
**What goes wrong:** Spinner freezes during file read/write
**Why it happens:** ora animations run on event loop; sync operations block it
**How to avoid:** File I/O is fast enough to not matter, but stop spinner before sync operations if concerned
**Warning signs:** Spinner pauses for a beat during config file updates

### Pitfall 5: Duplicate Email Across Accounts
**What goes wrong:** AWS rejects account creation with unclear error
**Why it happens:** Each AWS account in org needs globally unique root email
**How to avoid:** Validate emails are unique across all three environments before calling AWS
**Warning signs:** "Email already in use" or "InvalidInputException" from CreateAccount

### Pitfall 6: User Cancels Mid-Creation
**What goes wrong:** Account creation started but user Ctrl+C, inconsistent state
**Why it happens:** prompts onCancel triggers process.exit during AWS operation
**How to avoid:** Don't use onCancel during AWS operations; collect all inputs first, then execute
**Warning signs:** "Setup cancelled" message but AWS operations continue in background

## Code Examples

Verified patterns from official sources:

### Full Command Implementation Structure
```typescript
// Source: Combined from existing codebase + best practices
import ora from 'ora';
import prompts from 'prompts';
import pc from 'picocolors';
import { readFileSync, writeFileSync } from 'node:fs';
import { requireProjectContext } from '../utils/project-context.js';
import {
  createOrganizationsClient,
  checkExistingOrganization,
  createOrganization,
  createAccount,
  waitForAccountCreation,
} from '../aws/organizations.js';

interface EnvironmentEmails {
  dev: string;
  stage: string;
  prod: string;
}

const ENVIRONMENTS = ['dev', 'stage', 'prod'] as const;

export async function runSetupAwsEnvs(_args: string[]): Promise<void> {
  // 1. Validate project context
  const context = await requireProjectContext();

  // 2. Check if already configured
  if (Object.keys(context.config.accounts || {}).length > 0) {
    console.log(pc.yellow('Warning:') + ' AWS accounts already configured.');
    // Show existing and offer to continue/abort
  }

  // 3. Collect emails (all input before any AWS calls)
  const emails = await collectEmails(context.config.projectName);

  // 4. Execute AWS operations with progress
  const spinner = ora('Starting AWS Organizations setup...').start();

  try {
    // Organizations API requires us-east-1
    const client = createOrganizationsClient('us-east-1');

    // Check/create organization
    spinner.text = 'Checking for existing AWS Organization...';
    let orgId = await checkExistingOrganization(client);

    if (!orgId) {
      spinner.text = 'Creating AWS Organization...';
      orgId = await createOrganization(client);
      spinner.succeed(`Created AWS Organization: ${orgId}`);
    } else {
      spinner.succeed(`Using existing AWS Organization: ${orgId}`);
    }

    // Create accounts sequentially
    const accounts: Record<string, string> = {};

    for (const env of ENVIRONMENTS) {
      spinner.start(`Creating ${env} account (this may take several minutes)...`);

      const accountName = `${context.config.projectName}-${env}`;
      const { requestId } = await createAccount(client, emails[env], accountName);

      spinner.text = `Waiting for ${env} account creation...`;
      const result = await waitForAccountCreation(client, requestId);

      accounts[env] = result.accountId;

      // Save after each successful account
      updateConfigAccounts(context.configPath, accounts);

      spinner.succeed(`Created ${env} account: ${result.accountId}`);
    }

    // Final success
    console.log('');
    console.log(pc.green('AWS environment setup complete!'));
    console.log('');
    console.log('Account IDs saved to config:');
    for (const [env, id] of Object.entries(accounts)) {
      console.log(`  ${env}: ${id}`);
    }
    console.log('');
    console.log(pc.bold('Next step:'));
    console.log(`  ${pc.cyan('npx create-aws-project initialize-github dev')}`);

  } catch (error) {
    spinner.fail('AWS setup failed');
    handleAwsError(error);
  }
}
```

### Email Collection with Validation
```typescript
// Source: Existing org-structure.ts patterns + prompts docs
function validateEmail(value: string): boolean | string {
  if (!value.trim()) return 'Email is required';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'Invalid email format';
  return true;
}

function validateUniqueEmail(value: string, existing: string[]): boolean | string {
  const emailValid = validateEmail(value);
  if (emailValid !== true) return emailValid;

  const lower = value.toLowerCase();
  if (existing.some(e => e?.toLowerCase() === lower)) {
    return 'Each account requires a unique email address';
  }
  return true;
}

async function collectEmails(projectName: string): Promise<EnvironmentEmails> {
  console.log('');
  console.log(pc.bold('AWS Account Configuration'));
  console.log('');
  console.log('Each AWS environment account requires a unique root email address.');
  console.log(pc.dim('Tip: Use email aliases like yourname+dev@company.com'));
  console.log('');

  const response = await prompts([
    {
      type: 'text',
      name: 'dev',
      message: 'Dev account root email:',
      validate: validateEmail,
    },
    {
      type: 'text',
      name: 'stage',
      message: 'Stage account root email:',
      validate: (v) => validateUniqueEmail(v, [response.dev]),
    },
    {
      type: 'text',
      name: 'prod',
      message: 'Prod account root email:',
      validate: (v) => validateUniqueEmail(v, [response.dev, response.stage]),
    },
  ], {
    onCancel: () => {
      console.log(`\n${pc.red('x')} Setup cancelled`);
      process.exit(1);
    }
  });

  if (!response.dev || !response.stage || !response.prod) {
    console.log(pc.red('Error:') + ' All email addresses are required.');
    process.exit(1);
  }

  return response as EnvironmentEmails;
}
```

### Config File Update
```typescript
// Source: Node.js fs patterns
interface AwsStarterConfig {
  configVersion: string;
  projectName: string;
  platforms: string[];
  authProvider: string;
  features: string[];
  awsRegion: string;
  theme: string;
  createdAt: string;
  accounts: Record<string, string>;
}

function updateConfigAccounts(
  configPath: string,
  accounts: Record<string, string>
): void {
  const content = readFileSync(configPath, 'utf-8');
  const config = JSON.parse(content) as AwsStarterConfig;

  config.accounts = { ...config.accounts, ...accounts };

  writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n', 'utf-8');
}
```

### Error Handler
```typescript
// Source: AWS SDK v3 error handling + project patterns
function handleAwsError(error: unknown): never {
  console.error('');

  if (!(error instanceof Error)) {
    console.error(pc.red('Error:') + ' Unknown error occurred');
    process.exit(1);
  }

  switch (error.name) {
    case 'AccessDeniedException':
      console.error(pc.red('Error: Insufficient AWS permissions'));
      console.error('');
      console.error('Your AWS credentials need the following permissions:');
      console.error('  - organizations:DescribeOrganization');
      console.error('  - organizations:CreateOrganization');
      console.error('  - organizations:CreateAccount');
      console.error('  - organizations:DescribeCreateAccountStatus');
      console.error('');
      console.error('Ensure you are using credentials from the management account.');
      break;

    case 'AWSOrganizationsNotInUseException':
      console.error(pc.red('Error: Unexpected state - no organization exists after creation attempt'));
      console.error('This may be a temporary AWS issue. Please try again in a few minutes.');
      break;

    case 'ConstraintViolationException':
      console.error(pc.red('Error: AWS Organizations limit reached'));
      console.error('');
      console.error(error.message);
      console.error('');
      console.error('You may have hit the account creation limit. Contact AWS Support.');
      break;

    case 'FinalizingOrganizationException':
      console.error(pc.red('Error: AWS Organization is still initializing'));
      console.error('Please wait about an hour and try again.');
      break;

    case 'TooManyRequestsException':
      console.error(pc.red('Error: AWS rate limit exceeded'));
      console.error('Please wait a few minutes and try again.');
      break;

    default:
      console.error(pc.red('Error:') + ` ${error.message}`);
      if (error.name) {
        console.error(pc.dim(`Error type: ${error.name}`));
      }
  }

  process.exit(1);
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Inline org setup in wizard | Separate setup-aws-envs command | v1.3 (this milestone) | Better error handling, optional setup |
| Status field for account state | State field for account state | Sept 2025 AWS update | More granular lifecycle info |
| Basic console.log progress | ora spinner | Common practice | Better UX for long operations |

**Deprecated/outdated:**
- AWS Organizations `Status` field: Use `State` field instead (deprecated Sept 2025, removed Sept 2026)
- Inline wizard prompts: Moved to setup-aws-envs command

## Open Questions

Things that couldn't be fully resolved:

1. **Account creation timeout duration**
   - What we know: AWS says "few minutes", existing code uses 5 minutes
   - What's unclear: Whether 5 minutes is always sufficient under load
   - Recommendation: Keep 5 minutes, document that user can retry if timeout

2. **Handling existing accounts with missing config**
   - What we know: User might have created accounts manually, config shows empty
   - What's unclear: How to detect/associate existing accounts
   - Recommendation: Out of scope for v1.3; document manual config update option

3. **ora version compatibility**
   - What we know: ora 9.x is pure ESM, project uses ESM
   - What's unclear: Any issues with Node 22+ and ora 9
   - Recommendation: Use ora ^9.0.0, test during implementation

## Sources

### Primary (HIGH confidence)
- [AWS SDK for JavaScript v3 Organizations](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/client/organizations/) - CreateAccount, CreateOrganization API documentation
- [AWS Organizations API Reference](https://docs.aws.amazon.com/organizations/latest/APIReference/API_CreateAccount.html) - Exception types, status values
- [ora npm package](https://www.npmjs.com/package/ora) - Spinner library documentation
- Codebase analysis: `src/aws/organizations.ts` - Existing implementation
- Codebase analysis: `src/prompts/org-structure.ts` - Existing email prompts

### Secondary (MEDIUM confidence)
- [AWS Organizations Best Practices](https://docs.aws.amazon.com/organizations/latest/userguide/orgs_best-practices_member-acct.html) - Account lifecycle management
- [AWS Blog: Account State Information](https://aws.amazon.com/blogs/mt/updates-to-account-status-information-in-aws-organizations/) - State vs Status field changes
- [npm-compare: CLI spinners](https://npm-compare.com/cli-progress,cli-spinners,ora,progress) - Spinner library comparison

### Tertiary (LOW confidence)
- WebSearch results on Node.js JSON file updates - General patterns, not specific to this use case

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - ora is de facto standard, AWS SDK already in use
- Architecture: HIGH - Building on existing infrastructure with clear patterns
- Pitfalls: HIGH - Derived from AWS documentation and codebase analysis
- Code examples: HIGH - Combined from existing codebase + official documentation

**Research date:** 2026-01-21
**Valid until:** 2026-03-21 (60 days - AWS SDK stable, ora stable)

## Implementation Checklist

Quick reference for planner:

### Files to Modify
1. `src/commands/setup-aws-envs.ts` - Replace stub with full implementation

### Files to Add (optional)
1. None required - can inline config update

### Files NOT to Modify
1. `src/aws/organizations.ts` - Already complete
2. `src/utils/project-context.ts` - Already provides requireProjectContext()
3. `src/prompts/org-structure.ts` - Can reference but prompts may be inline

### Dependencies to Add
```bash
npm install ora
```

### Key Implementation Steps
1. Add ora dependency
2. Implement email collection prompts
3. Implement config file update function
4. Implement error handler
5. Wire together in runSetupAwsEnvs()
6. Test with AWS credentials
