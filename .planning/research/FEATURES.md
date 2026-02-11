# Feature Landscape: AWS Root Credential Handling & Idempotent Setup

**Domain:** CLI tools for AWS account bootstrapping from root credentials
**Researched:** 2026-02-10
**Confidence:** MEDIUM (verified with official AWS docs, some patterns from community sources)

## Executive Summary

This research covers feature expectations for CLI tools that handle AWS account bootstrapping starting from root credentials (the natural state for new AWS accounts). The key insight: **root credential detection and graceful handoff to IAM admin is table stakes** for this domain, but most existing tools ignore it and fail cryptically.

AWS's official position: root credentials should be used only for initial setup, then immediately transition to IAM admin. CLI tools must facilitate this transition, not fight it.

---

## Table Stakes

Features users expect when bootstrapping AWS accounts with root credentials. Missing these = incomplete/frustrating UX.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Root credential detection** | Users naturally start with root (new AWS account) | Low | Check ARN from `aws sts get-caller-identity`: root user ARN is `arn:aws:iam::ACCOUNT:root` |
| **Clear root user messaging** | Users need to understand what's happening and why | Low | "Detected root credentials. Will create IAM admin and transition automatically." |
| **Automatic IAM admin creation** | AWS best practice: don't use root for operations | Medium | Create IAM user with AdministratorAccess, programmatic access enabled |
| **Credential handoff guidance** | Users must switch from root to IAM admin credentials | Low | Explicit instructions: "Update ~/.aws/credentials with these new credentials" |
| **Idempotent account creation** | Re-runs must skip existing accounts without failing | Medium | Check Organizations API before creating, skip if exists |
| **Idempotent user creation** | Re-runs must skip existing IAM users without failing | Medium | Check IAM API before creating, skip if exists |
| **Smart email handling** | Don't prompt for emails if accounts already exist | Low | Query Organizations API first, only prompt for missing accounts |
| **State persistence** | Save progress between steps for recovery | Medium | Config file updated after each successful operation |
| **Partial completion recovery** | Resume from failure point, not restart from beginning | High | Requires step tracking + idempotency for all operations |
| **Credential validation** | Verify credentials work before starting operations | Low | Call `aws sts get-caller-identity` before any setup |
| **Permission checking** | Verify credentials have required permissions | Medium | Attempt Organizations/IAM operations, fail fast with clear errors |
| **Role assumption detection** | Detect if using IAM user with AssumeRole permissions vs root | Medium | Check ARN format: `:assumed-role/` vs `:root` vs `:user/` |

### Rationale for Table Stakes

These features solve the **two stated problems**:
1. **Root credential failures**: Detection + messaging + handoff eliminates cryptic failures
2. **Re-run email prompts**: Smart email handling + idempotency eliminates redundant prompts

Without these, the tool feels broken for its primary use case (new AWS accounts naturally have root credentials).

---

## Differentiators

Features that set this CLI apart from alternatives. Not expected, but highly valued when present.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Zero-touch root-to-admin** | Fully automated transition with no manual credential swapping | High | Store IAM admin keys in config, offer to update ~/.aws/credentials automatically |
| **Progressive credential validation** | Test each permission before using it, fail early with actionable errors | Medium | Instead of "operation failed", show "need Organizations:CreateOrganization permission" |
| **Email alias generation** | Suggest email aliases (user+dev@example.com) for new accounts | Low | Reduces friction for multi-account setup |
| **Credential security warnings** | Warn if root access keys are long-lived, suggest disabling after setup | Low | Align with AWS best practices for root key management |
| **Multi-step undo capability** | Rollback partially completed setups | Very High | Requires comprehensive state tracking + reversal logic |
| **Setup dry-run mode** | Show what will be created without creating it | Medium | Preview all operations before execution |
| **Credential rotation guidance** | Suggest when/how to rotate IAM admin credentials | Low | "IAM admin created 90 days ago, consider rotating" |
| **MFA enforcement setup** | Configure MFA requirements for IAM admin during creation | Medium | Additional security layer from the start |
| **Automated root key deletion** | Offer to delete root access keys after IAM admin creation | Low | Best practice: root should not have programmatic access |
| **Setup verification testing** | Test that created resources work correctly | Medium | Actually attempt to assume roles, create test resources |
| **Migration from existing setup** | Adopt existing Organizations/IAM users into tool's management | High | Requires tagging strategy (already partially implemented) |

### Competitive Positioning

**Most AWS bootstrapping tools** (Terraform, CDK, aws-vault):
- Assume you already have IAM credentials
- Require manual root-to-admin transition
- Fail with cryptic errors on root credentials

**This tool can differentiate** by:
- Accepting root credentials gracefully
- Automating the entire transition
- Providing clear guidance at each step

---

## Anti-Features

Features to explicitly NOT build. Common mistakes in this domain.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Storing root credentials long-term** | Violates AWS security best practices | Create IAM admin immediately, transition, then optionally offer to delete root keys |
| **Silent credential auto-switching** | Users lose track of what identity is being used | Always show "Now using: [identity ARN]" messages |
| **Automatic root key creation** | Root should not have programmatic access except initial setup | Only support existing root keys, never create new ones |
| **Complex credential management system** | Don't reinvent aws-vault, aws-sso, etc. | Use standard ~/.aws/credentials, integrate with existing tools |
| **GUI/web-based credential entry** | Adds security risk (browser storage, network transmission) | CLI-only, use existing AWS CLI credentials |
| **Credential storage in project files** | Security risk if committed to git | Only reference AWS profiles/env vars, never store keys in .planning/ |
| **Automatic MFA handling** | Can't be automated reliably, causes frustration | Prompt user for MFA token when needed, clear error messages |
| **Full AWS account management** | Scope creep into account governance, billing, etc. | Focus on initial bootstrapping only, defer to AWS Control Tower for ongoing management |
| **Custom IAM policies for admin** | Tempting to "improve" on AWS AdministratorAccess | Use AWS-managed AdministratorAccess policy, let users customize later |
| **Multi-region bootstrapping in single command** | Overwhelming, failure in one region blocks all | Focus on single region, let users re-run for additional regions |

### Anti-Pattern: "Smart" Credential Detection

**Don't:** Try to auto-detect which credentials to use from environment variables, profiles, SSO, etc.

**Why:** AWS CLI already has a complex credential chain. Duplicating it leads to:
- Inconsistent behavior vs. standard AWS tools
- User confusion ("why did it use different credentials than aws-cli?")
- Maintenance burden as AWS adds new credential mechanisms

**Instead:** Use AWS SDK default credential chain. Let users set credentials via standard mechanisms (AWS_PROFILE, AWS_ACCESS_KEY_ID, etc.). Show which identity was detected.

---

## Feature Dependencies

### Dependency Graph

```
Credential Validation (must run first)
  |
  └─> Root Credential Detection
        |
        ├─> Root User Messaging
        |     |
        |     └─> IAM Admin Creation (if root detected)
        |           |
        |           └─> Credential Handoff Guidance
        |
        └─> Permission Checking
              |
              └─> Idempotent Operations (account/user creation)
                    |
                    ├─> Smart Email Handling
                    └─> State Persistence
                          |
                          └─> Partial Completion Recovery
```

### Critical Path for Root Credential Flow

1. **Detect credentials** (`aws sts get-caller-identity`)
2. **If root user** (ARN contains `:root`):
   - Show clear message about root usage
   - Check if IAM admin already exists
   - If not: Create IAM admin with AdministratorAccess
   - Store IAM admin credentials in config
   - Offer to update ~/.aws/credentials
   - Show explicit "switch to IAM admin now" guidance
3. **Continue with setup** using IAM admin credentials

### Idempotency Dependencies

All create operations must check existence first:
- Organizations → `list-organizations` (if empty, create; else use existing)
- Accounts → `list-accounts` (create only missing accounts)
- IAM Users → `get-user` (catch NoSuchEntity error, then create)
- Access Keys → `list-access-keys` (check before creating new)

---

## MVP Recommendation

For addressing the two stated problems (root failures, re-run email prompts):

### Phase 1: Root Detection & Messaging (Minimal viable fix)
**Goal:** Stop failing cryptically on root credentials

**Features:**
1. Credential validation (detect root via ARN check)
2. Clear root user messaging
3. Manual credential handoff guidance

**Complexity:** Low
**User flow:**
```
$ npx create-aws-project setup-aws-envs

⚠️  Detected root user credentials
AWS best practice: Create IAM admin user for daily operations

Options:
1. Continue with root (not recommended, will create IAM admin)
2. Exit and switch to IAM credentials
3. Learn more about root vs IAM users

Choice: 1

Creating IAM admin user 'aws-deployment-admin'...
✓ Created user
✓ Attached AdministratorAccess policy
✓ Created access keys

📋 ACTION REQUIRED:
Update ~/.aws/credentials with these credentials:

[default]
aws_access_key_id = AKIAIOSFODNN7EXAMPLE
aws_secret_access_key = wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY

Then re-run this command with IAM credentials.
```

### Phase 2: Idempotent Operations (Fix re-run issues)
**Goal:** Eliminate redundant email prompts and support safe re-runs

**Features:**
1. Idempotent account creation
2. Idempotent user creation
3. Smart email handling
4. State persistence (already exists)

**Complexity:** Medium

### Phase 3: Automated Handoff (Premium UX)
**Goal:** Zero manual steps for credential transition

**Features:**
1. Zero-touch root-to-admin (automatic credential switching)
2. Setup verification testing
3. Optional root key deletion

**Complexity:** High

### Defer to Post-MVP

- Multi-step undo capability (very high complexity)
- Dry-run mode (medium complexity, nice-to-have)
- MFA enforcement setup (medium complexity, advanced use case)
- Credential rotation guidance (low value for initial setup)

---

## Domain-Specific Patterns

### Pattern: Credential Type Detection

**Standard approach:**
```javascript
const identity = await sts.getCallerIdentity();
const arn = identity.Arn;

// Root user: arn:aws:iam::123456789012:root
// IAM user: arn:aws:iam::123456789012:user/username
// Assumed role: arn:aws:sts::123456789012:assumed-role/role-name/session-name

const isRoot = arn.endsWith(':root');
const isIAMUser = arn.includes(':user/');
const isAssumedRole = arn.includes(':assumed-role/');
```

**Confidence:** HIGH (verified with official AWS documentation)

### Pattern: Idempotent Resource Creation

**Standard approach:**
```javascript
async function ensureIAMUser(username) {
  try {
    const user = await iam.getUser({ UserName: username });
    console.log('✓ IAM user already exists');
    return user.User;
  } catch (error) {
    if (error.name === 'NoSuchEntity') {
      console.log('Creating IAM user...');
      const result = await iam.createUser({ UserName: username });
      return result.User;
    }
    throw error; // Other errors are real problems
  }
}
```

**Confidence:** HIGH (standard AWS SDK pattern)

### Pattern: Progressive Permission Checking

**Standard approach:**
```javascript
async function checkPermissions() {
  const checks = [
    { name: 'Organizations', test: () => orgs.describeOrganization() },
    { name: 'IAM', test: () => iam.listUsers({ MaxItems: 1 }) },
    { name: 'STS', test: () => sts.getCallerIdentity() }
  ];

  for (const check of checks) {
    try {
      await check.test();
      console.log(`✓ ${check.name} access verified`);
    } catch (error) {
      console.error(`✗ ${check.name} access denied`);
      console.error(`  Required permission: ${check.name}:*`);
      process.exit(1);
    }
  }
}
```

**Confidence:** MEDIUM (community pattern, not official AWS guidance)

### Pattern: Email Alias Generation

**Standard approach:**
```javascript
function generateAccountEmails(baseEmail, accounts) {
  // user@example.com → user+dev@example.com, user+stage@example.com
  const [localPart, domain] = baseEmail.split('@');
  return accounts.map(acc => `${localPart}+${acc}@${domain}`);
}
```

**Constraint:** AWS account emails must be unique. Plus-addressing (RFC 5233) works with most providers but is rejected by some. Alternative: sequential numbering (user+1@, user+2@).

**Confidence:** LOW (community pattern, not universally reliable)

---

## Implementation Considerations

### Existing Features to Leverage

Your tool already has:
- ✓ Idempotent account creation (skips existing)
- ✓ Idempotent user creation (skips existing)
- ✓ Tag-based IAM user adoption (re-run support)
- ✓ Config file persistence

**Gap:** These don't run when root credentials can't assume roles. Need to add root detection BEFORE these operations.

### Integration Points

**Where root detection should happen:**
```
CLI entry point
  |
  └─> Credential validation ← INSERT ROOT DETECTION HERE
        |
        └─> Existing setup-aws-envs flow
              |
              ├─> Create organization (currently fails with root)
              └─> Create IAM users (currently fails with root)
```

**Required changes:**
1. Add credential detection at start of `setup-aws-envs`
2. If root detected: Run IAM admin creation sub-flow
3. Either auto-switch credentials OR exit with guidance
4. Continue with existing logic using IAM credentials

### Testing Challenges

**Problem:** Hard to test root credential flows without actual root credentials.

**Solution:**
- Mock AWS SDK calls with conditional responses based on ARN
- Test root detection logic in isolation (unit tests)
- Manual QA with actual new AWS account (integration test)
- Document test account setup in development docs

---

## Sources

### Official AWS Documentation
- [AWS account root user](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_root-user.html)
- [Root user best practices](https://docs.aws.amazon.com/IAM/latest/UserGuide/root-user-best-practices.html)
- [IAM identifiers (ARN format)](https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_identifiers.html)
- [GetCallerIdentity API](https://docs.aws.amazon.com/STS/latest/APIReference/API_GetCallerIdentity.html)
- [CreateAccount API](https://docs.aws.amazon.com/organizations/latest/APIReference/API_CreateAccount.html)
- [Creating member accounts in AWS Organizations](https://docs.aws.amazon.com/organizations/latest/userguide/orgs_manage_accounts_create.html)
- [AWS CLI configuration files](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-files.html)
- [Enabling command prompts in AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/cli-usage-parameters-prompting.html)

### AWS Blogs & Announcements
- [Centrally managing root access for customers using AWS Organizations](https://aws.amazon.com/blogs/aws/centrally-managing-root-access-for-customers-using-aws-organizations/)
- [An Easier Way to Determine the Presence of AWS Account Access Keys](https://aws.amazon.com/blogs/security/an-easier-way-to-determine-the-presence-of-aws-account-access-keys/)
- [Building fault-tolerant applications with AWS Lambda durable functions](https://aws.amazon.com/blogs/compute/building-fault-tolerant-long-running-application-with-aws-lambda-durable-functions/)
- [Introducing AWS Step Functions redrive](https://aws.amazon.com/blogs/compute/introducing-aws-step-functions-redrive-a-new-way-to-restart-workflows/)

### Community Resources & Patterns
- [AWS CDK vs Terraform: The Complete 2026 Comparison](https://towardsthecloud.com/blog/aws-cdk-vs-terraform)
- [What Does CDK Bootstrap Do?](https://towardsthecloud.com/blog/aws-cdk-bootstrap)
- [Node.js CLI Apps Best Practices](https://github.com/lirantal/nodejs-cli-apps-best-practices)
- [How to Create a CLI Tool with Node.js (2026)](https://oneuptime.com/blog/post/2026-01-22-nodejs-create-cli-tool/view)
- [Progressive Disclosure Matters: Applying 90s UX Wisdom to 2026 AI Agents](https://aipositive.substack.com/p/progressive-disclosure-matters)

### Technical References
- [Making retries safe with idempotent APIs (AWS Builders Library)](https://aws.amazon.com/builders-library/making-retries-safe-with-idempotent-APIs/)
- [AWS CLI retry behavior](https://docs.aws.amazon.com/sdkref/latest/guide/feature-retry-behavior.html)
- [Process credential provider](https://docs.aws.amazon.com/sdkref/latest/guide/feature-process-credentials.html)

**Research date:** 2026-02-10
**Confidence level:** MEDIUM (AWS official docs verified, implementation patterns from community sources)
