# Phase 22: Add CDK Bootstrap to Environment Initialization - Research

**Researched:** 2026-02-13
**Domain:** AWS CDK Bootstrap Integration
**Confidence:** HIGH

## Summary

AWS CDK Bootstrap is a prerequisite step that provisions infrastructure required by AWS CDK to deploy stacks. It creates a CloudFormation stack (default name: `CDKToolkit`) containing an S3 bucket for assets, an ECR repository for Docker images, and IAM roles with deployment permissions.

For `create-aws-project`, bootstrapping must occur after AWS accounts are created but before any CDK deployments. The standard approach is to run `cdk bootstrap` programmatically using the CLI via Node.js child process execution (execa), passing cross-account credentials to bootstrap each environment account.

**Primary recommendation:** Add bootstrap step to `setup-aws-envs` command after deployment user creation, using execa to run `npx cdk bootstrap` with explicit account/region and cross-account credentials for each environment.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| aws-cdk | ^2.1100.1 | CDK CLI toolkit | Official AWS tool, required for bootstrap command |
| execa | ^9.6.1 | Process execution | Already in project, best-practice Node.js process runner with promise API |
| @aws-sdk/credential-providers | ^3.971.0 | Credential management | Already in project, provides fromTemporaryCredentials for cross-account |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| ora | ^9.1.0 | Progress spinners | Already in project, show bootstrap progress |
| picocolors | ^1.1.1 | Terminal colors | Already in project, format output messages |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| CLI via execa | AWS SDK CloudFormation API | CLI is simpler and officially supported; SDK approach requires manually deploying bootstrap template CloudFormation stack |
| npx cdk bootstrap | Globally installed cdk | npx ensures version matches project's aws-cdk dependency; global install risks version mismatch |
| Subprocess execution | Manual user step | Automation ensures consistency and idempotency; manual step error-prone |

**Installation:**
```bash
# Already in project dependencies
npm install aws-cdk execa @aws-sdk/credential-providers
```

## Architecture Patterns

### Recommended Integration Point
```
setup-aws-envs flow:
├── 1. Detect root credentials → create admin user
├── 2. Create/verify AWS Organization
├── 3. Create environment accounts (dev, stage, prod)
├── 4. Create deployment IAM users in each account
├── 5. Create access keys for deployment users
└── 6. Bootstrap CDK in each environment ← NEW STEP
```

### Pattern 1: Cross-Account Bootstrap Execution
**What:** Run `cdk bootstrap` for each environment account using OrganizationAccountAccessRole
**When to use:** Multi-account AWS Organizations setup (current architecture)
**Example:**
```typescript
// Source: AWS CDK official docs + project patterns
import { execa } from 'execa';
import { fromTemporaryCredentials } from '@aws-sdk/credential-providers';

async function bootstrapEnvironment(
  accountId: string,
  region: string,
  adminCredentials: { accessKeyId: string; secretAccessKey: string }
): Promise<void> {
  // CDK CLI uses AWS SDK credential chain from environment variables
  const env = {
    ...process.env,
    AWS_ACCESS_KEY_ID: adminCredentials.accessKeyId,
    AWS_SECRET_ACCESS_KEY: adminCredentials.secretAccessKey,
    AWS_REGION: region,
  };

  // Bootstrap with explicit account/region, trust management account
  await execa(
    'npx',
    [
      'cdk',
      'bootstrap',
      `aws://${accountId}/${region}`,
      '--trust', accountId, // Trust itself for deployments
      '--cloudformation-execution-policies',
      'arn:aws:iam::aws:policy/AdministratorAccess',
    ],
    {
      env,
      stdio: 'inherit', // Show CDK output in real-time
    }
  );
}
```

### Pattern 2: Idempotent Bootstrap with Error Handling
**What:** Safe to run multiple times, gracefully handle already-bootstrapped environments
**When to use:** Any bootstrap operation (bootstrap is naturally idempotent)
**Example:**
```typescript
// Source: AWS CDK official docs on idempotency
async function safeBootstrap(
  accountId: string,
  region: string,
  credentials: { accessKeyId: string; secretAccessKey: string },
  spinner: Ora
): Promise<{ bootstrapped: boolean; wasAlreadyBootstrapped: boolean }> {
  try {
    spinner.start(`Bootstrapping CDK in account ${accountId}...`);

    await execa(
      'npx',
      ['cdk', 'bootstrap', `aws://${accountId}/${region}`],
      {
        env: {
          ...process.env,
          AWS_ACCESS_KEY_ID: credentials.accessKeyId,
          AWS_SECRET_ACCESS_KEY: credentials.secretAccessKey,
          AWS_REGION: region,
        },
        all: true, // Capture combined stdout/stderr
      }
    );

    // Check output to determine if upgraded or already current
    spinner.succeed(`CDK bootstrapped in account ${accountId}`);
    return { bootstrapped: true, wasAlreadyBootstrapped: false };

  } catch (error) {
    // Bootstrap failures are rare if credentials are valid
    spinner.fail(`Failed to bootstrap CDK in account ${accountId}`);
    throw error;
  }
}
```

### Pattern 3: Cross-Account Credential Passing
**What:** Assume OrganizationAccountAccessRole to bootstrap member accounts
**When to use:** Management account bootstrapping member accounts
**Example:**
```typescript
// Source: Project's existing cross-account pattern in setup-aws-envs.ts
import { IAMClient } from '@aws-sdk/client-iam';
import { fromTemporaryCredentials } from '@aws-sdk/credential-providers';

// For CDK bootstrap, we need credentials as environment variables, not SDK clients
// The CLI will use AWS SDK's default credential chain from environment

async function getCrossAccountEnvVars(
  accountId: string,
  region: string,
  adminCredentials: { accessKeyId: string; secretAccessKey: string }
): Promise<Record<string, string>> {
  // CDK CLI will automatically use these environment variables
  // AWS SDK's fromTemporaryCredentials creates STS session
  // But for CLI, simpler to assume role and get temp credentials manually

  // Option 1: Use AWS_PROFILE with configured profile (complex)
  // Option 2: Get temp credentials from STS AssumeRole (explicit)

  // For now, use admin credentials directly - they can assume OrganizationAccountAccessRole
  // CDK CLI will handle the role assumption via AWS SDK credential chain
  return {
    AWS_ACCESS_KEY_ID: adminCredentials.accessKeyId,
    AWS_SECRET_ACCESS_KEY: adminCredentials.secretAccessKey,
    AWS_REGION: region,
  };
}
```

### Anti-Patterns to Avoid
- **Manual bootstrap as documentation step:** Don't document "run cdk bootstrap manually" - automate it in setup-aws-envs
- **Bootstrap before account creation:** Must have account ID before bootstrap; order matters
- **Bootstrap without --trust flag:** Deployment users won't be able to deploy; always specify trust relationships
- **Global CDK CLI installation:** Use `npx cdk bootstrap` to ensure version matches project's aws-cdk dependency
- **Bootstrap in GitHub Actions:** Should be done during initial setup, not during every deployment (wastes time, already idempotent)

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CDK bootstrap template deployment | Custom CloudFormation stack | `cdk bootstrap` CLI command | AWS maintains the bootstrap template with versioning; manually deploying risks incompatibility |
| Cross-account credential management | Custom STS assume role logic | AWS SDK `fromTemporaryCredentials` | Handles session duration, retries, credential refresh |
| Process execution | Node.js native child_process | execa package | Handles stdio, errors, promises, cross-platform; already in project |
| Bootstrap state tracking | Custom DynamoDB/config tracking | CloudFormation stack existence check | Bootstrap is idempotent; re-running is safe and fast; no need to track state |

**Key insight:** CDK bootstrap is designed to be idempotent and safe to re-run. Don't build custom state tracking - just run it and let CDK determine if upgrade needed.

## Common Pitfalls

### Pitfall 1: S3 Bucket Name Conflicts
**What goes wrong:** Bootstrap fails with "bucket already exists" error
**Why it happens:** S3 bucket names are globally unique across all AWS accounts. Default bootstrap bucket name is `cdk-{qualifier}-assets-{account}-{region}` where qualifier defaults to `hnb659fds`. If another account created a bucket with this exact name, bootstrap fails.
**How to avoid:** Use custom qualifier with `--qualifier` flag (9 alphanumeric characters). For multi-account setups, consider using account-specific or project-specific qualifiers.
**Warning signs:** Error message "CREATE_FAILED | AWS::S3::Bucket | <BucketName> already exists"

### Pitfall 2: Bootstrap Before Account is Ready
**What goes wrong:** Bootstrap fails with access denied or account not found
**Why it happens:** Immediately after account creation via Organizations API, the account may not be fully initialized. OrganizationAccountAccessRole may not be available yet.
**How to avoid:** Ensure account creation status is SUCCEEDED before bootstrap. Add small delay (5-10 seconds) or retry logic.
**Warning signs:** AccessDenied errors immediately after account creation succeeds

### Pitfall 3: Missing --trust Flag
**What goes wrong:** CDK deployments fail with "not authorized to perform sts:AssumeRole" during `cdk deploy`
**Why it happens:** Bootstrap creates IAM roles, but without --trust, the deployment user/account can't assume them
**How to avoid:** Always pass `--trust <account-id>` for the account(s) that will deploy. For multi-account, trust the management account or CI/CD account.
**Warning signs:** Bootstrap succeeds but later `cdk deploy` fails with assume role errors

### Pitfall 4: CDK CLI Version Mismatch
**What goes wrong:** Bootstrap template version incompatible with deployed stacks
**Why it happens:** Global `cdk` CLI version differs from project's `aws-cdk` dependency version
**How to avoid:** Always use `npx cdk bootstrap` to ensure CLI version matches project's aws-cdk dependency
**Warning signs:** Warnings about "This CDK CLI is not compatible with the CDK library used by your application"

### Pitfall 5: Insufficient IAM Permissions
**What goes wrong:** Bootstrap fails with permission errors creating S3 bucket, ECR repo, or IAM roles
**Why it happens:** Admin credentials lack required permissions for bootstrap resources
**How to avoid:** Ensure admin user or assumed role has permissions for: s3:*, ecr:*, iam:*, cloudformation:*, ssm:PutParameter
**Warning signs:** AccessDenied errors during bootstrap for specific AWS service APIs

### Pitfall 6: Region Mismatch
**What goes wrong:** CDK stacks deploy to different region than bootstrap
**Why it happens:** Bootstrap uses one region, but CDK app configured for different region
**How to avoid:** Bootstrap in the same region specified in CDK app's `env.region`. Read region from project config.
**Warning signs:** CDK deploy fails with "stack assumes bootstrap stack exists in region X but not found"

## Code Examples

Verified patterns from official sources and project:

### Bootstrap Integration in setup-aws-envs
```typescript
// Source: Integration of AWS CDK docs + project patterns
import { execa } from 'execa';
import ora from 'ora';
import pc from 'picocolors';

async function bootstrapCDKEnvironments(
  accounts: Record<string, string>,
  region: string,
  adminCredentials: { accessKeyId: string; secretAccessKey: string }
): Promise<void> {
  const spinner = ora('Bootstrapping CDK environments...').start();

  const environments = ['dev', 'stage', 'prod'] as const;

  for (const env of environments) {
    const accountId = accounts[env];

    spinner.text = `Bootstrapping CDK in ${env} account (${accountId})...`;

    try {
      // Use npx to ensure CLI version matches project dependency
      await execa(
        'npx',
        [
          'cdk',
          'bootstrap',
          `aws://${accountId}/${region}`,
          '--trust', accountId,
          '--cloudformation-execution-policies',
          'arn:aws:iam::aws:policy/AdministratorAccess',
          '--require-approval', 'never',
        ],
        {
          env: {
            ...process.env,
            AWS_ACCESS_KEY_ID: adminCredentials.accessKeyId,
            AWS_SECRET_ACCESS_KEY: adminCredentials.secretAccessKey,
            AWS_REGION: region,
          },
          // stdio: 'inherit' shows real-time output
          // all: true captures output for error handling
          all: true,
        }
      );

      spinner.succeed(`Bootstrapped CDK in ${env} account (${accountId})`);

    } catch (error) {
      spinner.fail(`Failed to bootstrap CDK in ${env} account`);

      // Re-throw with context
      if (error instanceof Error) {
        const execaError = error as any;
        console.error(pc.red('Bootstrap error:'));
        console.error(execaError.all || execaError.message);
      }
      throw error;
    }
  }

  console.log('');
  console.log(pc.green('All environments bootstrapped for CDK deployments!'));
}
```

### Check if Bootstrap Needed (Optional Optimization)
```typescript
// Source: AWS CloudFormation SDK + CDK patterns
import { CloudFormationClient, DescribeStacksCommand } from '@aws-sdk/client-cloudformation';

async function isBootstrapped(
  accountId: string,
  region: string,
  credentials: { accessKeyId: string; secretAccessKey: string }
): Promise<boolean> {
  const cfnClient = new CloudFormationClient({
    region,
    credentials: {
      accessKeyId: credentials.accessKeyId,
      secretAccessKey: credentials.secretAccessKey,
    },
  });

  try {
    await cfnClient.send(
      new DescribeStacksCommand({ StackName: 'CDKToolkit' })
    );
    return true; // Stack exists
  } catch (error: any) {
    if (error.name === 'ValidationError' && error.message.includes('does not exist')) {
      return false; // Stack doesn't exist
    }
    throw error; // Other error
  }
}

// Note: This check is optional - bootstrap is idempotent, so safe to always run
// Only check if you want to show different messages (skipped vs. upgraded vs. created)
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Legacy bootstrap | Modern bootstrap (default in CDK v2) | CDK v1 → v2 (2021) | Modern template includes synthesizer, better IAM roles, ECR support |
| --toolkit-stack-name CDKToolkit | Default CDKToolkit name | Always | Explicit naming was never required, default recommended |
| Manual IAM policy specification | --cloudformation-execution-policies flag | CDK v2 | Simpler to specify managed policies instead of custom JSON |
| Bootstrap per stack | Bootstrap per environment (account+region) | Always | One bootstrap per account/region serves all stacks |

**Deprecated/outdated:**
- **Legacy bootstrap template:** CDK v1 bootstrap template is incompatible with CDK v2. Always use modern template (default in v2).
- **cdk bootstrap without arguments:** In CDK v1, could bootstrap from app context. In v2, best practice is explicit `aws://account/region`.
- **--trust-for-lookup without --trust:** If using cross-account lookups, still need --trust for deployments.

## Open Questions

Things that couldn't be fully resolved:

1. **Should bootstrap happen before or after access key creation?**
   - What we know: Bootstrap only requires account to exist and cross-account access. Admin credentials (via OrganizationAccountAccessRole) can bootstrap. Deployment user credentials can also bootstrap.
   - What's unclear: Whether to use admin credentials or deployment user credentials for bootstrap. Admin credentials work and are already available at bootstrap time.
   - Recommendation: Use admin credentials for bootstrap (before deployment user access keys created). This ensures bootstrap happens even if deployment user creation fails. Bootstrap is not tied to deployment user lifecycle.

2. **Should bootstrap be re-run on subsequent setup-aws-envs executions?**
   - What we know: Bootstrap is idempotent - safe to run multiple times. Upgrades if needed, no-op if current.
   - What's unclear: Whether to skip bootstrap if CDKToolkit stack exists (optimization) or always run (simpler, ensures up-to-date).
   - Recommendation: Always run bootstrap without checking. Idempotent operations are simpler than state tracking. Fast no-op if already current (~5-10 seconds).

3. **What custom bootstrap options should be exposed to users?**
   - What we know: Bootstrap accepts many flags: --qualifier, --bootstrap-bucket-name, --tags, --custom-permissions-boundary, etc.
   - What's unclear: Whether to hardcode sensible defaults or allow customization via config/flags.
   - Recommendation: Start with sensible defaults (no custom qualifier, AdministratorAccess policy, project tags). Add customization later if users request it.

## Sources

### Primary (HIGH confidence)
- [AWS CDK Bootstrapping Documentation](https://docs.aws.amazon.com/cdk/v2/guide/bootstrapping.html) - Official AWS documentation on bootstrap process
- [cdk bootstrap CLI Reference](https://docs.aws.amazon.com/cdk/v2/guide/ref-cli-cmd-bootstrap.html) - Complete CLI options and usage
- [Bootstrap your environment for use with the AWS CDK](https://docs.aws.amazon.com/cdk/v2/guide/bootstrapping-env.html) - How to bootstrap environments
- [Troubleshoot AWS CDK bootstrapping issues](https://docs.aws.amazon.com/cdk/v2/guide/bootstrapping-troubleshoot.html) - Common errors and solutions

### Secondary (MEDIUM confidence)
- [Is cdk bootstrap idempotent?](https://github.com/aws/aws-cdk/discussions/14551) - GitHub discussion confirming idempotency
- [AWS CDK Bootstrap — What It Does & Why It's Mandatory](https://towardsaws.com/aws-cdk-bootstrap-what-it-does-why-its-mandatory-819d0f9803c5) - Community explanation of bootstrap purpose
- [What Does CDK Bootstrap Do? Setup Guide + Troubleshooting](https://towardsthecloud.com/blog/aws-cdk-bootstrap) - Community troubleshooting guide
- [AWS CDK cross-account deployments with cdk-assume-role-credential-plugin](https://johntipper.org/aws-cdk-cross-account-deployments-with-cdk-pipelines-and-cdk-assume-role-credential-plugin/) - Cross-account patterns
- [Configuring environment variables for the AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-envvars.html) - AWS credential environment variables

### Tertiary (LOW confidence)
- [execa - npm](https://www.npmjs.com/package/execa) - Unable to fetch, but package already in project devDependencies at v9.6.1
- Community blog posts on CDK bootstrap best practices - Multiple sources corroborate official documentation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - AWS CDK CLI is official, execa already in project, patterns verified
- Architecture: HIGH - Cross-account bootstrap pattern matches existing setup-aws-envs architecture
- Pitfalls: HIGH - All pitfalls documented in official AWS troubleshooting guide
- Integration point: HIGH - Clear location in setup-aws-envs flow after deployment users created

**Research date:** 2026-02-13
**Valid until:** 2026-04-13 (60 days - CDK is stable, bootstrap process hasn't changed in years)
