# Phase 18: Architecture Simplification - Research

**Researched:** 2026-02-11
**Domain:** Command architecture refactoring, credential lifecycle management, separation of concerns
**Confidence:** HIGH

## Summary

Phase 18 consolidates all AWS/IAM operations into `setup-aws-envs` and isolates GitHub operations in `initialize-github`. The current architecture has `initialize-github` performing both AWS operations (creating IAM users/access keys via cross-account role assumption) and GitHub operations (pushing secrets). This creates unnecessary coupling and complexity.

The refactoring moves IAM access key creation from `initialize-github` to `setup-aws-envs`, stores credentials in the project config file, and transforms `initialize-github` into a read-config-and-push operation. This follows established CLI patterns where credential acquisition is separated from credential distribution.

**Key architectural insight:** AWS credentials (access keys) are deployment artifacts that should be created during infrastructure setup, not during GitHub configuration. The current flow creates credentials "just in time" when pushing to GitHub; the new flow pre-creates credentials during AWS setup and stores them for later distribution.

**Primary recommendation:** Extend the existing config schema to store deployment credentials (accessKeyId + secretAccessKey) per environment, create access keys in `setup-aws-envs` immediately after creating deployment users, and modify `initialize-github` to read credentials from config instead of making AWS API calls.

## Standard Stack

No new libraries required. This phase refactors existing code using the current stack:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @aws-sdk/client-iam | 3.x | IAM operations (already used) | Official AWS SDK for IAM user/key management |
| node:fs | Built-in | Config file persistence | Native Node.js file system operations |
| JSON | Built-in | Config serialization | Standard format for CLI config files |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @octokit/rest | Already in use | GitHub API operations | Already used for secrets management |
| prompts | Already in use | User prompts | Already used for GitHub PAT input |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Plain JSON config | Encrypted credential store | More secure but requires additional dependencies and complexity. Plain JSON acceptable because: (1) local filesystem access already implies compromise, (2) credentials are deployment-scoped not admin-level, (3) consistent with existing adminUser storage pattern |
| Config file storage | Environment variables | Less persistent across command runs, harder for users to inspect/debug |
| Immediate key creation | Deferred key creation on GitHub push | Current approach; rejected because it couples AWS operations to GitHub operations unnecessarily |

**Installation:**
```bash
# No new dependencies required
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── commands/
│   ├── setup-aws-envs.ts     # AWS/IAM operations only (expanded)
│   └── initialize-github.ts   # GitHub operations only (simplified)
├── aws/
│   └── iam.ts                 # IAM client and operations
├── github/
│   └── secrets.ts             # GitHub secrets API
└── utils/
    └── project-context.ts     # Config schema and persistence
```

### Pattern 1: Credential Creation During Infrastructure Setup

**What:** Create IAM access keys immediately after creating deployment users in `setup-aws-envs`, store them in config

**When to use:** For credentials that are deployment artifacts needed by downstream operations

**Example:**
```typescript
// In setup-aws-envs.ts - AFTER creating deployment users
for (const env of ENVIRONMENTS) {
  // ... existing user creation code ...

  spinner.start(`Creating access key for ${env} deployment user...`);

  const credentials = await createAccessKey(iamClient, userName);

  deploymentCredentials[env] = {
    userName: userName,
    accessKeyId: credentials.accessKeyId,
    secretAccessKey: credentials.secretAccessKey,
  };

  // Persist after EACH successful key creation (partial failure resilience)
  updateConfig(configPath, accounts, deploymentUsers, deploymentCredentials);

  spinner.succeed(`Created access key for ${userName}`);
}
```

**Rationale:** Credentials are infrastructure artifacts that belong with infrastructure creation. Separating credential creation from credential distribution follows the single responsibility principle.

### Pattern 2: Config-Based Credential Distribution

**What:** Read pre-created credentials from config and distribute to target systems (GitHub)

**When to use:** For operations that consume credentials but don't create them

**Example:**
```typescript
// In initialize-github.ts - SIMPLIFIED to read-only operations
export async function runInitializeGitHub(args: string[]): Promise<void> {
  const context = await requireProjectContext();
  const { config } = context;

  // Determine environment
  const env = determineEnvironment(args, config);

  // Validate credentials exist in config
  const credentials = config.deploymentCredentials?.[env];
  if (!credentials) {
    console.error(pc.red('Error:') + ` No deployment credentials for ${env}.`);
    console.error('Run setup-aws-envs first to create credentials.');
    process.exit(1);
  }

  // Get repository info and PAT (GitHub-only operations)
  const repoInfo = getGitRemoteOrigin() || await promptForRepoInfo();
  const pat = await promptForGitHubPAT();

  // Push credentials to GitHub (no AWS API calls)
  const spinner = ora(`Configuring ${env} environment...`).start();
  const githubClient = createGitHubClient(pat);
  await setEnvironmentCredentials(
    githubClient,
    repoInfo.owner,
    repoInfo.repo,
    GITHUB_ENV_NAMES[env],
    credentials.accessKeyId,
    credentials.secretAccessKey
  );

  spinner.succeed(`Configured ${env} environment`);
}
```

### Pattern 3: Progressive Config Updates with Partial Failure Resilience

**What:** Update config file after each successful operation to preserve partial progress

**When to use:** For multi-step operations where later steps might fail

**Example:**
```typescript
// Already established pattern in setup-aws-envs
for (const env of ENVIRONMENTS) {
  // Step 1: Create user
  await createDeploymentUser(iamClient, userName);

  // Step 2: Create policy and attach
  const policyArn = await createCDKDeploymentPolicy(iamClient, policyName, accountId);
  await attachPolicyToUser(iamClient, userName, policyArn);

  // Step 3: Create access key (NEW)
  const credentials = await createAccessKey(iamClient, userName);

  // Save after EACH environment completes
  updateConfig(configPath, accounts, deploymentUsers, deploymentCredentials);
}
```

**Rationale:** If access key creation fails for prod but succeeds for dev/stage, user can re-run command and skip successful environments. Matches existing pattern established for account creation.

### Anti-Patterns to Avoid

- **Just-in-time credential creation:** Don't create AWS credentials during GitHub operations. This couples unrelated systems and makes `initialize-github` dependent on AWS API availability.

- **Credential creation without storage:** Don't create access keys and immediately use them without persisting. If GitHub push fails, user loses credentials and must manually delete keys to retry.

- **Mixing concerns in commands:** Don't have `initialize-github` make AWS API calls. It should be GitHub-only: prompt for PAT, read config, push secrets.

- **Secret access key retrieval:** Don't attempt to retrieve secret access keys after creation. AWS returns them only once at creation time. Store immediately or lose forever.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Encrypted credential storage | Custom encryption for config file | Plain JSON with filesystem permissions | AWS SDK clients already handle credentials from plaintext files (~/.aws/credentials). Adding encryption introduces key management complexity. Deployment credentials are already scoped/limited, not admin-level. |
| Credential rotation | Manual key deletion/recreation logic | Document manual rotation process | IAM access key rotation is infrequent for deployment users. Automated rotation adds significant complexity. Better to document: delete old key in AWS Console, re-run setup-aws-envs. |
| Cross-command state management | Custom state/session system | Config file as single source of truth | Config file already established as shared state. Each command reads config, validates required fields, operates, updates config. Simple and debuggable. |

**Key insight:** Over-engineering credential security creates more problems than it solves. AWS deployment credentials stored in a local JSON file on the user's filesystem is the same security model as `~/.aws/credentials`. The risk isn't file access (filesystem access = game over), it's git commit (already mitigated by .gitignore).

## Common Pitfalls

### Pitfall 1: Exposing Secret Access Keys in Git

**What goes wrong:** User accidentally commits config file with secret access keys to version control

**Why it happens:** Config file contains sensitive credentials, similar to .env files

**How to avoid:**
- Ensure `.aws-starter-config.json` is in `.gitignore` (already present from wizard)
- Add warning comment in config file: "DO NOT COMMIT - Contains AWS credentials"
- Document that config file must remain local

**Warning signs:**
- Config file appears in `git status` output
- Config file present in repository history

**Prevention:**
```typescript
// When writing config with credentials, add warning comment
const configWithWarning = {
  _warning: "DO NOT COMMIT: Contains AWS deployment credentials",
  ...config
};
writeFileSync(configPath, JSON.stringify(configWithWarning, null, 2) + '\n');
```

### Pitfall 2: Access Key Limit Exceeded on Re-run

**What goes wrong:** User re-runs setup-aws-envs after partial failure, hits 2-key limit per IAM user

**Why it happens:** Previous run created access key before failing later. AWS limits users to 2 active access keys.

**How to avoid:**
- Check existing key count before creating new key (already implemented in `createAccessKey`)
- Store accessKeyId in config so re-runs can detect "we already have a key"
- Provide actionable error message with AWS Console link

**Warning signs:**
- LimitExceeded error during access key creation
- Config has userName but no credentials

**Prevention:**
```typescript
// In setup-aws-envs: Skip key creation if credentials already exist
const existingCredentials = config.deploymentCredentials?.[env];
if (existingCredentials) {
  spinner.succeed(`Using existing access key for ${env}: ${existingCredentials.accessKeyId}`);
  continue;
}

// Otherwise create new key (with existing limit check)
const credentials = await createAccessKey(iamClient, userName);
```

### Pitfall 3: IAM Eventual Consistency After Key Creation

**What goes wrong:** Access key created but not immediately usable, causing GitHub secret push to fail validation

**Why it happens:** IAM has eventual consistency - newly created access keys may not work immediately

**How to avoid:**
- Don't validate credentials immediately after creation
- Accept that GitHub will use credentials later (in GitHub Actions), giving IAM time to propagate
- If validation needed, implement exponential backoff retry (already established pattern from Phase 17)

**Warning signs:**
- Credentials fail validation immediately after creation
- Works on retry but not first run

**Prevention:**
```typescript
// Don't attempt to validate newly created credentials
// GitHub Actions will use them minutes/hours later, IAM will be consistent by then

// If validation is absolutely required:
await retryWithBackoff(
  async () => {
    const testClient = new IAMClient({
      credentials: {
        accessKeyId: credentials.accessKeyId,
        secretAccessKey: credentials.secretAccessKey,
      },
    });
    await testClient.send(new GetUserCommand({ UserName: userName }));
  },
  { maxRetries: 5, baseDelayMs: 1000 }
);
```

### Pitfall 4: Backward Compatibility Breaking Change

**What goes wrong:** Older projects without deploymentCredentials break when running initialize-github

**Why it happens:** Config schema changed, older projects have userName but not credentials

**How to avoid:**
- Optional chaining when accessing config.deploymentCredentials
- Graceful error message directing user to re-run setup-aws-envs
- Consider migration path: detect userName without credentials, offer to create keys

**Warning signs:**
- TypeError: Cannot read property 'accessKeyId' of undefined
- Older projects fail after tool update

**Prevention:**
```typescript
// In initialize-github: Graceful handling of missing credentials
const credentials = config.deploymentCredentials?.[env];

if (!credentials) {
  // Check if we have userName but no credentials (migration case)
  if (config.deploymentUsers?.[env]) {
    console.error(pc.yellow('Note:') + ' Deployment user exists but credentials not found.');
    console.error('Your project was set up with an older version.');
    console.error('Re-run setup-aws-envs to create access keys:');
    console.error(`  ${pc.cyan('npx create-aws-project setup-aws-envs')}`);
  } else {
    console.error(pc.red('Error:') + ' No deployment credentials configured.');
    console.error('Run setup-aws-envs first.');
  }
  process.exit(1);
}
```

## Code Examples

Verified patterns from codebase analysis:

### Config Schema Extension
```typescript
// Source: src/utils/project-context.ts (extended for Phase 18)

export interface DeploymentCredentials {
  userName: string;
  accessKeyId: string;
  secretAccessKey: string;
}

export interface ProjectConfigMinimal {
  projectName: string;
  platforms: string[];
  awsRegion: string;
  configVersion?: string;
  accounts?: Record<string, string>;
  deploymentUsers?: Record<string, string>;
  deploymentCredentials?: Record<string, DeploymentCredentials>;  // NEW
  adminUser?: {
    userName: string;
    accessKeyId: string;
  };
}
```

### Credential Creation in setup-aws-envs
```typescript
// Source: Modified setup-aws-envs.ts pattern

// After deployment user creation loop (around line 430)
const deploymentCredentials: Record<string, DeploymentCredentials> = {};

for (const env of ENVIRONMENTS) {
  // Skip if credentials already exist
  if (config.deploymentCredentials?.[env]) {
    spinner.succeed(`Using existing credentials for ${env}`);
    continue;
  }

  const userName = deploymentUsers[env];
  const accountId = accounts[env];

  spinner.start(`Creating access key for ${env} deployment user...`);

  // Cross-account IAM client (already established pattern)
  const iamClient = createCrossAccountIAMClient(config.awsRegion, accountId);

  // Create access key (existing function)
  const credentials = await createAccessKey(iamClient, userName);

  deploymentCredentials[env] = {
    userName: userName,
    accessKeyId: credentials.accessKeyId,
    secretAccessKey: credentials.secretAccessKey,
  };

  // Update config after each successful key creation
  updateConfigWithCredentials(configPath, deploymentCredentials);

  spinner.succeed(`Created access key for ${userName}`);
}
```

### Simplified initialize-github
```typescript
// Source: Modified initialize-github.ts

export async function runInitializeGitHub(args: string[]): Promise<void> {
  const context = await requireProjectContext();
  const { config } = context;

  // Determine environment (existing logic)
  const env = determineEnvironment(args, config);

  // CHANGE: Validate credentials exist (no AWS calls)
  const credentials = config.deploymentCredentials?.[env];
  if (!credentials) {
    console.error(pc.red('Error:') + ` No deployment credentials for ${env}.`);
    console.error('Run setup-aws-envs first to create credentials.');
    process.exit(1);
  }

  // Get repo info and PAT (existing GitHub-only logic)
  const repoInfo = getGitRemoteOrigin() || await promptForRepoInfo();
  const pat = await promptForGitHubPAT();

  // CHANGE: Push to GitHub without AWS operations
  const spinner = ora(`Configuring ${env} environment...`).start();

  const githubClient = createGitHubClient(pat);
  await setEnvironmentCredentials(
    githubClient,
    repoInfo.owner,
    repoInfo.repo,
    GITHUB_ENV_NAMES[env],
    credentials.accessKeyId,
    credentials.secretAccessKey
  );

  spinner.succeed(`Configured ${GITHUB_ENV_NAMES[env]} environment`);

  // Success output (simplified)
  console.log('');
  console.log(pc.green(`${env} environment configured!`));
  console.log('');
  console.log('Credentials pushed to GitHub:');
  console.log(`  User: ${pc.cyan(credentials.userName)}`);
  console.log(`  Key ID: ${pc.cyan(credentials.accessKeyId)}`);
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Just-in-time credential creation in initialize-github | Pre-create credentials in setup-aws-envs, store in config | Phase 18 (2026-02) | Separates concerns, allows initialize-github to work offline (no AWS API), simplifies retry logic |
| AWS operations mixed with GitHub operations | AWS operations isolated in setup-aws-envs, GitHub operations isolated in initialize-github | Phase 18 (2026-02) | Clear command boundaries, easier testing, better error isolation |
| No credential storage | Credentials stored in config file | Phase 18 (2026-02) | Enables credential reuse, supports offline GitHub configuration, matches ~/.aws/credentials model |

**Deprecated/outdated:**
- **initialize-github creates IAM users:** Replaced by setup-aws-envs creating users and keys together
- **Cross-account role assumption in initialize-github:** Replaced by reading credentials from config

## Open Questions

1. **Should we support credential rotation within the CLI?**
   - What we know: AWS best practice recommends rotating access keys periodically
   - What's unclear: Whether automated rotation adds enough value to justify complexity
   - Recommendation: Start without rotation, document manual process (delete key in AWS Console, re-run setup-aws-envs). Add automated rotation in future phase if users request it.

2. **How should we handle credential migration for existing projects?**
   - What we know: Projects from Phase 17 have deploymentUsers but not deploymentCredentials
   - What's unclear: Whether to auto-migrate (create keys on first initialize-github) or require explicit re-run
   - Recommendation: Require explicit re-run of setup-aws-envs. Safer, clearer user intent, avoids silent AWS operations.

3. **Should initialize-github work on a per-environment basis or batch all environments?**
   - What we know: Current design is per-environment (user runs command for each env)
   - What's unclear: Whether batch mode would improve UX (single PAT prompt, push all envs)
   - Recommendation: Keep per-environment for now. Matches current UX, allows env-specific testing, supports incremental rollout. Can add --all flag in future.

## Sources

### Primary (HIGH confidence)
- Codebase analysis: src/commands/setup-aws-envs.ts, src/commands/initialize-github.ts, src/aws/iam.ts, src/utils/project-context.ts
- AWS SDK for JavaScript v3: @aws-sdk/client-iam usage patterns
- Phase 17 verification: .planning/phases/17-root-credential-handling/17-VERIFICATION.md
- [Setting Credentials in Node.js - AWS SDK for JavaScript](https://docs.aws.amazon.com/sdk-for-javascript/v2/developer-guide/setting-credentials-node.html)
- [Security best practices in IAM](https://docs.aws.amazon.com/IAM/latest/UserGuide/best-practices.html)

### Secondary (MEDIUM confidence)
- [Best practices for CLI authentication - WorkOS](https://workos.com/blog/best-practices-for-cli-authentication-a-technical-guide)
- [Secrets Management - OWASP Cheat Sheet Series](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html)
- [Store access keys for programmatic access - Amazon Keyspaces](https://docs.aws.amazon.com/keyspaces/latest/devguide/aws.credentials.manage.html)

### Tertiary (LOW confidence)
- [How to Handle Secrets on the Command Line - Smallstep](https://smallstep.com/blog/command-line-secrets/)
- [Best Secrets Management Tools 2026 - Cycode](https://cycode.com/blog/best-secrets-management-tools/)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - No new dependencies, using existing AWS SDK patterns
- Architecture: HIGH - Clear separation of concerns, follows established CLI patterns, matches existing codebase structure
- Pitfalls: HIGH - All pitfalls derived from codebase analysis and AWS SDK documentation, not speculation

**Research date:** 2026-02-11
**Valid until:** 2026-04-11 (60 days - stable domain, AWS SDK patterns unlikely to change)
