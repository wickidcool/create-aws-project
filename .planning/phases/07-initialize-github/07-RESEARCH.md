# Phase 7: initialize-github Command - Research

**Researched:** 2026-01-22
**Domain:** AWS IAM cross-account access, GitHub API environments/secrets
**Confidence:** HIGH

## Summary

This phase implements the `initialize-github <env>` command that configures GitHub Environment secrets for a single environment (dev, stage, or prod). The command requires cross-account AWS access to create IAM deployment users in member accounts, then uses the GitHub REST API to create environments and store encrypted credentials.

The codebase already has 90% of the required infrastructure:
- `src/aws/iam.ts` - IAM user/policy creation and access key generation
- `src/github/secrets.ts` - GitHub environment creation and secret encryption (using tweetnacl)
- `src/utils/project-context.ts` - Config file loading and validation
- `src/commands/initialize-github.ts` - Command stub with environment validation

The primary new requirement is **cross-account credential handling** using STS AssumeRole to access member accounts from management account credentials.

**Primary recommendation:** Use `fromTemporaryCredentials` from `@aws-sdk/credential-providers` to assume `OrganizationAccountAccessRole` in the target account, then reuse existing `iam.ts` functions for IAM user creation.

## Standard Stack

The established libraries/tools for this domain:

### Core (Already in package.json)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@aws-sdk/client-iam` | ^3.971.0 | IAM user/policy management | AWS official SDK v3 |
| `@aws-sdk/credential-providers` | ^3.971.0 | STS AssumeRole credential provider | Already used for `fromIni` |
| `@octokit/rest` | ^22.0.1 | GitHub REST API client | Official Octokit library |
| `tweetnacl` / `tweetnacl-util` | ^1.0.3 / ^0.15.1 | Secret encryption for GitHub | Already working in codebase |
| `ora` | ^9.1.0 | Spinner for progress feedback | Matches setup-aws-envs |
| `prompts` | ^2.4.2 | Interactive prompts | Project standard |
| `picocolors` | ^1.1.1 | Terminal colors | Project standard |

### New Dependencies Required
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@aws-sdk/client-sts` | ^3.971.0 | **NEEDED** for STS AssumeRole | Cross-account IAM access |

**Note:** `@aws-sdk/credential-providers` handles the credential resolution but `@aws-sdk/client-sts` is needed as a peer dependency for the STS client internals.

**Installation:**
```bash
npm install @aws-sdk/client-sts
```

## Architecture Patterns

### Recommended Flow Structure
```
initialize-github <env>
├── 1. Validate project context (requireProjectContext)
├── 2. Validate/prompt for environment argument
├── 3. Validate account ID exists in config
├── 4. Parse git remote to extract owner/repo
├── 5. Prompt for GitHub PAT
├── 6. Create IAM user in target account (via AssumeRole)
│   ├── Assume OrganizationAccountAccessRole
│   ├── Create IAM deployment user
│   ├── Create/attach CDK deployment policy
│   └── Generate access key credentials
├── 7. Configure GitHub Environment
│   ├── Create/update environment (Development/Staging/Production)
│   └── Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY secrets
└── 8. Display success summary with next steps
```

### Pattern 1: Cross-Account IAM Client Creation
**What:** Create IAM client with assumed role credentials for target account
**When to use:** Any IAM operation in member account from management account

```typescript
// Source: AWS SDK v3 documentation
import { fromTemporaryCredentials } from '@aws-sdk/credential-providers';
import { IAMClient } from '@aws-sdk/client-iam';

function createCrossAccountIAMClient(
  region: string,
  targetAccountId: string
): IAMClient {
  const roleArn = `arn:aws:iam::${targetAccountId}:role/OrganizationAccountAccessRole`;

  return new IAMClient({
    region,
    credentials: fromTemporaryCredentials({
      params: {
        RoleArn: roleArn,
        RoleSessionName: `initialize-github-${Date.now()}`,
        DurationSeconds: 900, // 15 minutes is sufficient
      },
    }),
  });
}
```

### Pattern 2: Git Remote Parsing
**What:** Extract owner/repo from git remote origin
**When to use:** Detecting GitHub repository for secret configuration

```typescript
// Source: Existing codebase pattern from src/github/secrets.ts
import { execSync } from 'node:child_process';

function getGitRemoteOrigin(): { owner: string; repo: string } | null {
  try {
    const output = execSync('git remote get-url origin', { encoding: 'utf-8' });
    const url = output.trim();
    return parseGitHubUrl(url); // Already exists in github/secrets.ts
  } catch {
    return null; // Not a git repo or no origin
  }
}
```

### Pattern 3: Environment Name Mapping
**What:** Map lowercase env names to GitHub Environment display names
**When to use:** Creating GitHub Environments with user-friendly names

```typescript
// Per CONTEXT.md: GitHub Environment names should be capitalized
const GITHUB_ENV_NAMES: Record<string, string> = {
  dev: 'Development',
  stage: 'Staging',
  prod: 'Production',
};

function getGitHubEnvironmentName(env: string): string {
  return GITHUB_ENV_NAMES[env] ?? env;
}
```

### Pattern 4: Interactive Environment Selection
**What:** Prompt for environment if not provided as argument
**When to use:** No argument provided to command

```typescript
// Per CONTEXT.md: prompt if no argument provided
import prompts from 'prompts';

async function promptForEnvironment(configuredEnvs: string[]): Promise<string> {
  const choices = configuredEnvs.map(env => ({
    title: env,
    value: env,
  }));

  const response = await prompts({
    type: 'select',
    name: 'env',
    message: 'Select environment to configure:',
    choices,
  });

  if (!response.env) {
    process.exit(1);
  }

  return response.env;
}
```

### Anti-Patterns to Avoid
- **Using gh CLI:** CONTEXT.md specifies prompt for PAT, not gh CLI authentication
- **AdministratorAccess policy:** Must use scoped CDK deployment policy, not full admin
- **Creating new access keys on existing users:** Per CONTEXT.md, error if IAM user exists
- **Environment-suffixed secret names:** Use standard AWS_ACCESS_KEY_ID in each GitHub Environment

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| GitHub secret encryption | Custom encryption | `encryptSecret()` in `github/secrets.ts` | LibSodium sealed box implementation already working |
| URL parsing for GitHub | Regex in command | `parseGitHubUrl()` in `github/secrets.ts` | Handles https, ssh, short formats |
| IAM user/policy creation | New IAM functions | `createDeploymentUserWithCredentials()` in `iam.ts` | Full orchestration with proper sequencing |
| GitHub Environment setup | Raw API calls | `setEnvironmentCredentials()` in `github/secrets.ts` | Creates env, sets both secrets |
| Config validation | Manual JSON parsing | `requireProjectContext()` in `project-context.ts` | Validated, exits with proper error |

**Key insight:** This command is primarily orchestration of existing modules. The only new capability is cross-account credential handling via `fromTemporaryCredentials`.

## Common Pitfalls

### Pitfall 1: STS Region for AssumeRole
**What goes wrong:** Using wrong region for STS calls
**Why it happens:** STS is global but has regional endpoints
**How to avoid:** Use same region as IAM client (typically us-east-1 for consistency with Organizations)
**Warning signs:** `ExpiredTokenException` or `InvalidIdentityToken`

### Pitfall 2: OrganizationAccountAccessRole Not Found
**What goes wrong:** AssumeRole fails with "role does not exist"
**Why it happens:** Role only exists in accounts CREATED by Organizations, not invited accounts
**How to avoid:** Clear error message guiding user to manually create role or use different approach
**Warning signs:** `AccessDenied: User: ... is not authorized to perform: sts:AssumeRole`

### Pitfall 3: IAM User Already Exists with Access Key Limit
**What goes wrong:** User exists but has max (2) access keys, can't create new one
**Why it happens:** Previous partial run or manual user creation
**How to avoid:** Per CONTEXT.md, error telling user to delete manually. Don't auto-delete.
**Warning signs:** `LimitExceeded: Cannot exceed quota for AccessKeysPerUser`

### Pitfall 4: GitHub PAT Insufficient Permissions
**What goes wrong:** 401/403 on environment or secret creation
**Why it happens:** PAT missing `repo` scope (classic) or `environments:write` (fine-grained)
**How to avoid:** Clear error message explaining required scope
**Warning signs:** `HttpError: Resource not accessible by personal access token`

### Pitfall 5: Git Remote Not GitHub
**What goes wrong:** Parsed URL returns non-GitHub host
**Why it happens:** User has GitLab, Bitbucket, or self-hosted remote
**How to avoid:** Validate host is `github.com`, prompt for manual input otherwise
**Warning signs:** URL parsing succeeds but API calls fail

### Pitfall 6: Missing Account ID in Config
**What goes wrong:** Command runs but can't find account ID for environment
**Why it happens:** User didn't run setup-aws-envs or it partially failed
**How to avoid:** Per CONTEXT.md, error with guidance: "No account ID for {env}. Run setup-aws-envs first."
**Warning signs:** `config.accounts[env]` returns undefined

## Code Examples

Verified patterns from official sources and existing codebase:

### Cross-Account IAM Client (New Code)
```typescript
// Source: AWS SDK v3 docs + existing codebase patterns
import { fromTemporaryCredentials } from '@aws-sdk/credential-providers';
import { IAMClient } from '@aws-sdk/client-iam';

export function createCrossAccountIAMClient(
  region: string,
  targetAccountId: string
): IAMClient {
  // OrganizationAccountAccessRole is auto-created in member accounts
  // created via AWS Organizations
  const roleArn = `arn:aws:iam::${targetAccountId}:role/OrganizationAccountAccessRole`;

  return new IAMClient({
    region,
    credentials: fromTemporaryCredentials({
      params: {
        RoleArn: roleArn,
        RoleSessionName: `create-aws-project-${Date.now()}`,
        DurationSeconds: 900,
      },
    }),
  });
}
```

### GitHub PAT Prompt (Matches Existing Style)
```typescript
// Source: Adapted from prompts/github-setup.ts
import prompts from 'prompts';

export async function promptForGitHubPAT(): Promise<string> {
  const response = await prompts({
    type: 'password',
    name: 'token',
    message: 'GitHub Personal Access Token (requires "repo" scope):',
    validate: (value: string) => {
      if (!value.trim()) return 'Token is required';
      // GitHub PATs start with ghp_ (classic) or github_pat_ (fine-grained)
      if (!value.startsWith('ghp_') && !value.startsWith('github_pat_')) {
        return 'Invalid token format. Classic tokens start with ghp_, fine-grained with github_pat_';
      }
      return true;
    },
  });

  if (!response.token) {
    process.exit(1);
  }

  return response.token;
}
```

### Complete Flow Orchestration
```typescript
// Source: Combining existing patterns from setup-aws-envs.ts and setup-github.ts
import ora from 'ora';
import pc from 'picocolors';

async function initializeGitHubEnvironment(
  env: string,
  context: ProjectContext,
  githubPAT: string,
  repoInfo: { owner: string; repo: string }
): Promise<void> {
  const { projectName, awsRegion, accounts } = context.config;
  const accountId = accounts[env];
  const githubEnvName = GITHUB_ENV_NAMES[env];

  const spinner = ora(`Initializing ${env} environment...`).start();

  try {
    // Step 1: Create cross-account IAM client
    spinner.text = `Assuming role in ${env} account (${accountId})...`;
    const iamClient = createCrossAccountIAMClient(awsRegion, accountId);

    // Step 2: Create deployment user and get credentials
    spinner.text = `Creating IAM deployment user...`;
    const credentials = await createDeploymentUserWithCredentials(
      iamClient,
      projectName,
      env,
      accountId
    );

    // Step 3: Configure GitHub
    spinner.text = `Creating GitHub Environment "${githubEnvName}"...`;
    const githubClient = createGitHubClient(githubPAT);

    await setEnvironmentCredentials(
      githubClient,
      repoInfo.owner,
      repoInfo.repo,
      githubEnvName,  // Capitalized per CONTEXT.md
      credentials.accessKeyId,
      credentials.secretAccessKey
    );

    spinner.succeed(`Configured ${githubEnvName} environment`);
  } catch (error) {
    spinner.fail(`Failed to configure ${env} environment`);
    throw error;
  }
}
```

### Error Handler for Cross-Account Access
```typescript
// Source: Adapted from setup-aws-envs.ts handleAwsError pattern
function handleInitializeGitHubError(error: unknown, env: string): never {
  console.error('');

  if (!(error instanceof Error)) {
    console.error(pc.red('Error:') + ' Unknown error occurred');
    process.exit(1);
  }

  // STS AssumeRole errors
  if (error.name === 'AccessDenied' && error.message.includes('AssumeRole')) {
    console.error(pc.red('Error:') + ' Cannot access target AWS account');
    console.error('');
    console.error('This can happen if:');
    console.error('  1. You are not running with management account credentials');
    console.error('  2. The OrganizationAccountAccessRole does not exist in the target account');
    console.error('');
    console.error('Ensure you have AWS credentials configured for the management account.');
    process.exit(1);
  }

  // IAM user already exists
  if (error.name === 'EntityAlreadyExists') {
    const userName = `${context.config.projectName}-${env}-deploy`;
    console.error(pc.red('Error:') + ` IAM user "${userName}" already exists`);
    console.error('');
    console.error('To reconfigure, first delete the existing user:');
    console.error(`  aws iam delete-user --user-name ${userName}`);
    console.error('');
    console.error('Note: You may need to delete access keys and attached policies first.');
    process.exit(1);
  }

  // GitHub authentication
  if (error.message.includes('GitHub authentication failed')) {
    console.error(pc.red('Error:') + ' GitHub authentication failed');
    console.error('');
    console.error('Ensure your Personal Access Token has the "repo" scope.');
    console.error('For fine-grained tokens, you need "Environments: write" permission.');
    process.exit(1);
  }

  // Default error handling
  console.error(pc.red('Error:') + ` ${error.message}`);
  if (error.name) {
    console.error(pc.dim(`Error type: ${error.name}`));
  }
  process.exit(1);
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| AWS SDK v2 `sts.assumeRole()` | `fromTemporaryCredentials` provider | SDK v3 (2020+) | Cleaner credential chain, auto-refresh |
| GitHub classic PAT only | Fine-grained PAT supported | 2022 | More granular permissions possible |
| Manual secret encryption | libsodium sealed box via tweetnacl | Unchanged | Standard GitHub encryption |

**Current best practices:**
- Use `fromTemporaryCredentials` for cross-account, not manual `AssumeRoleCommand` + credential extraction
- Classic PAT with `repo` scope remains simpler than fine-grained for this use case
- GitHub Environments provide per-environment secret isolation (preferred over environment-suffixed names)

## Open Questions

Things that couldn't be fully resolved:

1. **Fine-grained PAT exact permissions**
   - What we know: Classic PAT needs `repo` scope, fine-grained needs "Environments: write"
   - What's unclear: Whether fine-grained works reliably for all environment operations
   - Recommendation: Document both options in prompt help text, suggest classic for simplicity

2. **OrganizationAccountAccessRole in invited accounts**
   - What we know: Role auto-created only in accounts CREATED by Organizations
   - What's unclear: How many users will have invited vs created accounts
   - Recommendation: Clear error message with guidance if role not found

3. **Access key rotation for existing users**
   - What we know: AWS allows max 2 access keys per user
   - What's unclear: Whether to support --force flag or always error
   - Recommendation: Per CONTEXT.md, error and guide to manual deletion (safer)

## Sources

### Primary (HIGH confidence)
- Existing codebase: `src/aws/iam.ts`, `src/github/secrets.ts`, `src/commands/setup-aws-envs.ts`
- [AWS SDK v3 credential-providers documentation](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/Package/-aws-sdk-credential-providers/Variable/fromTemporaryCredentials/)
- [GitHub REST API - Deployment Environments](https://docs.github.com/en/rest/deployments/environments)
- [GitHub REST API - Actions Secrets](https://docs.github.com/en/rest/actions/secrets)

### Secondary (MEDIUM confidence)
- [AWS Organizations OrganizationAccountAccessRole](https://docs.aws.amazon.com/organizations/latest/userguide/orgs_manage_accounts_access-cross-account-role.html)
- [GitHub Personal Access Tokens documentation](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens)

### Tertiary (LOW confidence)
- Web search results for edge cases (marked inline where used)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already in use or peer dependencies
- Architecture: HIGH - Patterns directly from existing codebase
- Pitfalls: MEDIUM - Some based on documentation, some on experience patterns
- Cross-account flow: HIGH - `fromTemporaryCredentials` verified in AWS SDK docs

**Research date:** 2026-01-22
**Valid until:** 60 days (stable APIs, no major version changes expected)
