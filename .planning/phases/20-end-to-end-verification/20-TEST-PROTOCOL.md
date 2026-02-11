# Phase 20 End-to-End Verification Test Protocol

## Purpose

This protocol verifies the complete end-to-end workflow of create-aws-project v1.6, from project generation through AWS Organizations setup to GitHub deployment configuration. It confirms that the full workflow works reliably with real AWS credentials and that all commands are idempotent.

**Last executed:** [To be filled after test execution]

**Estimated duration:** 30-60 minutes (test cases 1-5), additional time for optional test case 6

## Prerequisites

Before starting, ensure you have:

- [ ] **AWS Management Account** with root credentials (access key ID + secret access key)
  - Root user email and password
  - Root access keys created (via AWS Console → Security Credentials)
  - Note: This must be a dedicated test account or you must be willing to create an Organization
- [ ] **No existing AWS Organization** in the account (or willingness to use existing one)
- [ ] **GitHub Account** with repository access
  - Personal Access Token with `repo` scope ([create one](https://github.com/settings/tokens/new))
  - Existing repository or willingness to create one for testing
- [ ] **Development Environment**
  - Node.js 22+ installed (`node --version`)
  - This project cloned locally
  - Project built successfully (`npm run build`)
  - Terminal with AWS credentials configured

## Environment Setup

Configure AWS root credentials for this test session:

```bash
# Set AWS root credentials as environment variables
export AWS_ACCESS_KEY_ID="your-root-access-key-id"
export AWS_SECRET_ACCESS_KEY="your-root-secret-access-key"
export AWS_REGION="us-east-1"

# Verify credentials are set
echo "Access Key: ${AWS_ACCESS_KEY_ID:0:10}..."
```

**Important:** These must be **root user** credentials (not IAM user) to test the root detection feature.

---

## Test Case 1: Fresh Project Generation

**Purpose:** Verify that the project generation wizard works and creates a valid configuration file.

### Steps

1. **Generate a new project with timestamp suffix to ensure uniqueness:**

   ```bash
   cd /tmp
   npx create-aws-project e2e-test-$(date +%s)
   ```

   When prompted, provide these choices:
   - Project name: [accept default or use custom name]
   - Select platforms: **Web Application** and **REST API** (use arrow keys + space)
   - Authentication: **AWS Cognito**
   - Select additional features: **None** (skip)
   - AWS region: **us-east-1**
   - Brand color: **blue** (or any choice)
   - GitHub repository setup: **No** (we'll configure this later)

2. **Record the project name** (you'll need it for subsequent tests):

   ```
   Project name: _______________________
   ```

3. **Verify project structure created:**

   ```bash
   cd [project-name]
   ls -la
   ```

   Expected files:
   - `.aws-starter-config.json`
   - `package.json`
   - `apps/` directory
   - `infrastructure/` directory

4. **Verify config file contents:**

   ```bash
   cat .aws-starter-config.json
   ```

   Expected JSON structure:
   ```json
   {
     "configVersion": "1.0",
     "projectName": "...",
     "platforms": ["web", "api"],
     "authProvider": "cognito",
     "features": [],
     "awsRegion": "us-east-1",
     "theme": "blue",
     "createdAt": "...",
     "accounts": {}
   }
   ```

### Pass Criteria

- ✓ Project directory created without errors
- ✓ `.aws-starter-config.json` exists with correct structure
- ✓ `package.json` exists
- ✓ `platforms` field contains `["web", "api"]`
- ✓ `authProvider` is `"cognito"`
- ✓ `accounts` object is empty (will be populated by setup-aws-envs)

### Notes

```
[Record any issues, warnings, or observations here]
```

---

## Test Case 2: Setup AWS Environments (Root Credentials)

**Purpose:** Verify that setup-aws-envs detects root credentials, creates admin IAM user, creates AWS Organization and accounts, and configures deployment users with credentials.

**Prerequisites:**
- Test Case 1 passed
- AWS root credentials configured in environment (see Environment Setup)
- Inside generated project directory

### Steps

1. **Run setup-aws-envs from inside the generated project:**

   ```bash
   cd [project-name-from-test-case-1]
   npx create-aws-project setup-aws-envs
   ```

2. **Observe root credential detection output:**

   Expected console output should include:
   ```
   Root credentials detected.
   Creating admin IAM user for subsequent operations...
   ```

3. **Verify admin user creation:**

   Expected output:
   ```
   Created admin user: [project-name]-admin
   Admin credentials will be used for all subsequent AWS operations in this session.
   ```

   OR (if user already existed):
   ```
   Adopted existing admin user: [project-name]-admin
   ```

4. **Observe Organization creation/adoption:**

   Expected output:
   ```
   Created AWS Organization: o-xxxxxxxxxx
   ```

   OR:
   ```
   Using existing AWS Organization: o-xxxxxxxxxx
   ```

5. **Enter email addresses when prompted:**

   The command will prompt for three unique email addresses:
   - Dev account root email: `[your-email]+dev-test@domain.com`
   - Stage account root email: `[your-email]+stage-test@domain.com`
   - Prod account root email: `[your-email]+prod-test@domain.com`

   **Tip:** Use email aliases (Gmail supports `+` suffix, e.g., `yourname+dev@gmail.com`)

6. **Wait for account creation (5-15 minutes total):**

   Expected output for each environment:
   ```
   Creating dev account (this may take several minutes)...
   Waiting for dev account creation...
   Created dev account: 123456789012
   ```

   **Note:** Account creation typically takes 2-5 minutes per account. AWS creates them sequentially.

7. **Verify deployment user creation:**

   Expected output for each environment:
   ```
   Creating deployment user in dev account...
   Creating deployment policy for dev...
   Created deployment user: [project-name]-dev-deploy
   ```

8. **Verify access key creation:**

   Expected output:
   ```
   Creating access key for dev deployment user...
   Created access key for [project-name]-dev-deploy
   ```

9. **Review final summary table:**

   Expected output:
   ```
   AWS environment setup complete!

   Summary:
     Environment      Account ID       Deployment User                Access Key
     dev              123456789012     [project-name]-dev-deploy      AKIA...
     stage            234567890123     [project-name]-stage-deploy    AKIA...
     prod             345678901234     [project-name]-prod-deploy     AKIA...
   ```

10. **Verify config file updated:**

    ```bash
    cat .aws-starter-config.json
    ```

    The file should now include:
    - `adminUser` object with `userName` and `accessKeyId`
    - `accounts` object with dev/stage/prod account IDs
    - `deploymentUsers` object with deployment user names
    - `deploymentCredentials` object with credentials for each environment

### Verification Checklist

In AWS Console:

- [ ] Navigate to AWS Organizations console
- [ ] Verify Organization exists
- [ ] Verify three accounts listed (dev, stage, prod) with correct names: `[project-name]-dev`, `[project-name]-stage`, `[project-name]-prod`
- [ ] Navigate to IAM console (management account)
- [ ] Verify admin IAM user exists: `[project-name]-admin`
- [ ] Verify admin user has access key created
- [ ] Switch to dev account (using account switcher or CLI)
- [ ] Verify deployment IAM user exists: `[project-name]-dev-deploy`
- [ ] Verify deployment user has access key created
- [ ] Repeat for stage and prod accounts

### Pass Criteria

- ✓ Command completes without errors
- ✓ Output shows "Root credentials detected"
- ✓ Admin IAM user created (or adopted if already exists)
- ✓ AWS Organization created (or existing one used)
- ✓ All 3 environment accounts created (dev, stage, prod)
- ✓ Deployment users created in each account
- ✓ Access keys created for each deployment user
- ✓ `.aws-starter-config.json` updated with:
  - `adminUser` populated
  - `accounts` populated with 3 account IDs
  - `deploymentUsers` populated
  - `deploymentCredentials` populated
- ✓ Total execution time is reasonable (< 20 minutes)

### Troubleshooting

**If "AccessDeniedException":** Verify you're using root credentials, not IAM user credentials.

**If "Email already in use":** Use different email addresses (previous test may have used them).

**If account creation times out:** AWS account creation can take up to 5 minutes per account. Wait patiently. If it exceeds 10 minutes for one account, check AWS Console for account status.

**If eventual consistency errors:** The command includes retry logic. Occasional retries are normal.

### Notes

```
[Record execution time, account IDs, any warnings or observations]

Admin user created: ___________________
Organization ID: ___________________
Dev account ID: ___________________
Stage account ID: ___________________
Prod account ID: ___________________
Execution time: ___________________
```

---

## Test Case 3: Idempotent Re-run of setup-aws-envs

**Purpose:** Verify that running setup-aws-envs a second time is safe, does not create duplicate resources, and does not prompt for emails again.

**Prerequisites:**
- Test Case 2 passed
- Still in the same project directory
- AWS credentials still configured

### Steps

1. **Run setup-aws-envs again in the same project:**

   ```bash
   npx create-aws-project setup-aws-envs
   ```

2. **Verify NO email prompts shown:**

   The command should NOT ask for email addresses because accounts already exist.

3. **Observe resource adoption messages:**

   Expected output should include:
   ```
   Warning: AWS accounts already configured in this project:
     dev: 123456789012 (user: [project-name]-dev-deploy)
     stage: 234567890123 (user: [project-name]-stage-deploy)
     prod: 345678901234 (user: [project-name]-prod-deploy)

   Continuing will skip existing accounts and create any missing ones...
   ```

   Then:
   ```
   Note: Admin user [project-name]-admin already configured.
   Using existing admin user. If you have switched to IAM credentials, root detection is skipped.
   ```

   Then:
   ```
   Using existing AWS Organization: o-xxxxxxxxxx
   Found existing dev account: 123456789012
   Found existing stage account: 234567890123
   Found existing prod account: 345678901234

   All environment accounts already exist in AWS.
   Skipping email collection, proceeding to deployment user setup...
   ```

   Then:
   ```
   Using existing deployment user: [project-name]-dev-deploy
   Using existing deployment user: [project-name]-stage-deploy
   Using existing deployment user: [project-name]-prod-deploy
   ```

   Then:
   ```
   Using existing credentials for dev: AKIA...
   Using existing credentials for stage: AKIA...
   Using existing credentials for prod: AKIA...
   ```

4. **Verify no errors:**

   The command should complete successfully with the same summary table as Test Case 2.

5. **Verify config file unchanged:**

   ```bash
   cat .aws-starter-config.json
   ```

   Account IDs, user names, and credentials should be identical to Test Case 2.

### Verification Checklist

In AWS Console:

- [ ] Navigate to IAM console
- [ ] Verify admin user still has only ONE access key (not duplicated)
- [ ] Navigate to dev account IAM
- [ ] Verify deployment user still has only ONE access key (not duplicated)
- [ ] No new users created
- [ ] No duplicate policies created

### Pass Criteria

- ✓ Command completes without errors
- ✓ NO email prompts displayed (accounts already exist)
- ✓ Output shows "Using existing..." for all resources
- ✓ Output shows "Admin user already configured"
- ✓ Output shows "All environment accounts already exist"
- ✓ No duplicate resources created in AWS
- ✓ Config file unchanged (same account IDs, same credentials)
- ✓ Execution time is fast (< 2 minutes, no account creation delays)

### Notes

```
[Record any differences from first run, warnings, or observations]

Second run execution time: ___________________
Any duplicate resources? ___________________
```

---

## Test Case 4: Initialize GitHub Environment

**Purpose:** Verify that initialize-github pushes deployment credentials to GitHub Environment secrets.

**Prerequisites:**
- Test Case 2 passed (setup-aws-envs completed)
- GitHub Personal Access Token with `repo` scope ready
- GitHub repository exists (or create one for testing)

### Steps

1. **Create or identify a GitHub repository for testing:**

   Option A: Use an existing test repository

   Option B: Create a new repository via GitHub web UI:
   - Go to https://github.com/new
   - Repository name: `e2e-test-[timestamp]` or similar
   - Visibility: Private (recommended for testing)
   - Do not initialize with README (we'll push generated code later)

   **Record repository URL:**
   ```
   Repository: https://github.com/[owner]/[repo]
   Owner: ___________________
   Repo name: ___________________
   ```

2. **Initialize git in the project if not already done:**

   ```bash
   git init
   git remote add origin https://github.com/[owner]/[repo].git
   ```

3. **Run initialize-github for dev environment:**

   ```bash
   npx create-aws-project initialize-github dev
   ```

4. **Observe repository detection:**

   Expected output:
   ```
   Detected repository: [owner]/[repo]
   ```

   OR (if no remote):
   ```
   Note: Could not detect GitHub repository from git remote.

   GitHub Repository

   Enter your GitHub repository in owner/repo format.
   Example: myusername/my-project

   GitHub repository (owner/repo):
   ```

   If prompted, enter `[owner]/[repo]`.

5. **Enter GitHub Personal Access Token when prompted:**

   ```
   GitHub Authentication

   A Personal Access Token is required to configure GitHub secrets.
   Token must have "repo" scope for environment secrets access.

   Create a token at: https://github.com/settings/tokens/new

   GitHub Personal Access Token: [enter your PAT]
   ```

6. **Observe environment creation:**

   Expected output:
   ```
   Initializing dev environment...
   Configuring GitHub Environment "Development"...
   Configured Development environment

   dev environment setup complete!

   Credentials pushed to GitHub:
     Deployment User: [project-name]-dev-deploy
     Access Key ID: AKIA...
     GitHub Environment: Development

   View secrets at:
     https://github.com/[owner]/[repo]/settings/environments
   ```

7. **Verify secrets in GitHub Console:**

   - Navigate to https://github.com/[owner]/[repo]/settings/environments
   - Click on "Development" environment
   - Verify three secrets exist:
     - `AWS_ACCESS_KEY_ID`
     - `AWS_SECRET_ACCESS_KEY`
     - `AWS_REGION`
   - Note: Secret values are hidden (this is correct)

8. **Verify secret values match config (optional, requires GitHub API or Actions test):**

   You can verify by checking the access key ID matches what's in `.aws-starter-config.json`:

   ```bash
   cat .aws-starter-config.json | grep -A 3 '"dev"'
   ```

   The `accessKeyId` should match the one shown in the initialize-github output.

### Pass Criteria

- ✓ Command completes without errors
- ✓ GitHub Environment "Development" created
- ✓ Three secrets set: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION
- ✓ Secret values match credentials in `.aws-starter-config.json`
- ✓ Console output includes correct repository URL

### Notes

```
[Record repository used, any authentication issues, or observations]

GitHub repo: ___________________
Environment created: ___________________
Secrets visible in console: ___________________
```

---

## Test Case 5: Idempotent Re-run of initialize-github

**Purpose:** Verify that running initialize-github a second time updates secrets without errors or duplicates.

**Prerequisites:**
- Test Case 4 passed
- GitHub PAT still available

### Steps

1. **Run initialize-github dev again:**

   ```bash
   npx create-aws-project initialize-github dev
   ```

2. **Enter GitHub PAT when prompted:**

   (Same token as Test Case 4)

3. **Observe output:**

   Expected output should be identical to Test Case 4:
   ```
   Detected repository: [owner]/[repo]

   [... GitHub Authentication prompt ...]

   Initializing dev environment...
   Configuring GitHub Environment "Development"...
   Configured Development environment

   dev environment setup complete!
   ```

4. **Verify secrets still exist in GitHub Console:**

   - Navigate to https://github.com/[owner]/[repo]/settings/environments
   - Click on "Development" environment
   - Verify three secrets still exist (no duplicates)
   - Secrets were updated (overwritten), not duplicated

### Pass Criteria

- ✓ Command completes without errors
- ✓ Secrets are updated (not duplicated)
- ✓ GitHub Environment still shows exactly 3 secrets
- ✓ No "secret already exists" errors

### Notes

```
[Record any differences from first run or observations]

Second run execution time: ___________________
Any errors? ___________________
```

---

## Test Case 6: Full Deployment Verification (Optional)

**Purpose:** Verify that the generated project deploys successfully using GitHub Actions and the configured credentials.

**Prerequisites:**
- All previous test cases passed
- Generated project pushed to GitHub repository
- Development environment configured in GitHub
- Willingness to wait for CDK bootstrap and deployment (10-20 minutes)

**Note:** This test case is optional because it requires significant time and AWS resources. However, it provides the strongest evidence that the end-to-end workflow is complete.

### Steps

1. **Commit and push generated project to GitHub:**

   ```bash
   git add .
   git commit -m "Initial commit: generated project for e2e test"
   git push -u origin main
   ```

2. **Verify GitHub Actions workflow exists:**

   - Navigate to https://github.com/[owner]/[repo]/actions
   - Verify a workflow file exists (should be auto-detected from `.github/workflows/`)

3. **Trigger workflow (if not auto-triggered by push):**

   Option A: Push triggers deployment automatically

   Option B: Manually trigger workflow via GitHub Actions UI

4. **Monitor deployment:**

   - Watch GitHub Actions workflow progress
   - Expected stages:
     1. Checkout code
     2. Install dependencies
     3. Run tests
     4. CDK bootstrap (first run only)
     5. CDK deploy

5. **Verify CDK bootstrap succeeds:**

   Expected in workflow logs:
   ```
   Bootstrapping environment aws://123456789012/us-east-1...
   ```

6. **Verify CDK deploy succeeds:**

   Expected in workflow logs:
   ```
   Stack [project-name]-dev-stack
   Deployment time: ...
   ```

7. **Verify application accessible:**

   - Find deployed application URL in CDK output
   - Visit URL in browser
   - Verify application loads

### Pass Criteria

- ✓ Git push succeeds
- ✓ GitHub Actions workflow triggered
- ✓ CDK bootstrap completes successfully
- ✓ CDK deploy completes successfully
- ✓ Application accessible at deployed URL
- ✓ No authentication/permission errors in workflow logs

### Troubleshooting

**If "Access Denied" during bootstrap:** Verify deployment user policy includes CDK permissions. The policy created by setup-aws-envs should include this.

**If workflow doesn't trigger:** Check that `.github/workflows/` directory exists and has workflow YAML file.

**If CDK deploy times out:** CDK deployments can take 10-15 minutes on first run. Be patient.

### Notes

```
[Record deployment time, application URL, any errors]

Deployment time: ___________________
Application URL: ___________________
Any errors: ___________________
```

---

## Verification Report Template

After executing all test cases, record results in the table below. This will be used to create the verification report.

| Test Case | Status | Evidence | Notes |
|-----------|--------|----------|-------|
| 1. Fresh Project Generation | ☐ PASS ☐ FAIL | Config file created, correct structure | |
| 2. Setup AWS Environments (Root) | ☐ PASS ☐ FAIL | Root detected, admin user created, 3 accounts created, credentials configured | |
| 3. Idempotent setup-aws-envs | ☐ PASS ☐ FAIL | No email prompts, all resources adopted, no duplicates | |
| 4. Initialize GitHub | ☐ PASS ☐ FAIL | Development environment created, 3 secrets set | |
| 5. Idempotent initialize-github | ☐ PASS ☐ FAIL | Secrets updated, no duplicates | |
| 6. Full Deployment (Optional) | ☐ PASS ☐ FAIL ☐ SKIP | CDK deploy succeeded, app accessible | |

### Phase 20 Success Criteria Verification

Based on test results, verify the three Phase 20 success criteria:

1. **Full workflow completes without errors**
   - ☐ YES ☐ NO
   - Evidence: Test cases 1, 2, 4 all passed
   - Notes: _______________________________________________

2. **Generated project has correct deployment configuration**
   - ☐ YES ☐ NO
   - Evidence: Config file contains accounts, users, credentials; GitHub has secrets
   - Notes: _______________________________________________

3. **Re-running commands is safe and idempotent**
   - ☐ YES ☐ NO
   - Evidence: Test cases 3 and 5 passed (no duplicates, no errors)
   - Notes: _______________________________________________

**Overall Phase 20 Status:** ☐ PASS ☐ FAIL

---

## Cleanup Instructions

After testing is complete, clean up test resources to avoid ongoing costs:

### AWS Resources

**Warning:** Account closure is permanent and takes 90 days. Only close test accounts you created specifically for this test.

1. **Delete IAM access keys:**

   In management account:
   ```bash
   # List access keys for admin user
   aws iam list-access-keys --user-name [project-name]-admin

   # Delete each key
   aws iam delete-access-key --user-name [project-name]-admin --access-key-id AKIA...
   ```

   In each environment account (dev, stage, prod):
   ```bash
   # Assume OrganizationAccountAccessRole to access child account
   # Then delete deployment user access keys
   aws iam delete-access-key --user-name [project-name]-dev-deploy --access-key-id AKIA...
   ```

2. **Delete IAM policies:**

   ```bash
   # In each environment account
   aws iam detach-user-policy --user-name [project-name]-dev-deploy --policy-arn arn:aws:iam::123456789012:policy/[project-name]-dev-cdk-deploy
   aws iam delete-policy --policy-arn arn:aws:iam::123456789012:policy/[project-name]-dev-cdk-deploy
   ```

3. **Delete IAM users:**

   ```bash
   # Management account admin user
   aws iam delete-user --user-name [project-name]-admin

   # Each deployment user
   aws iam delete-user --user-name [project-name]-dev-deploy
   aws iam delete-user --user-name [project-name]-stage-deploy
   aws iam delete-user --user-name [project-name]-prod-deploy
   ```

4. **Close AWS accounts (optional, permanent):**

   AWS accounts cannot be deleted immediately. To close them:
   - Log into each account as root user
   - Navigate to Account Settings
   - Click "Close Account"
   - Account enters 90-day closure period
   - After 90 days, account is permanently deleted

   **Alternative:** Leave accounts open for future testing. They have no ongoing costs if no resources are deployed.

5. **Remove Organization (optional, only if you created it for testing):**

   To remove the Organization:
   - All member accounts must be removed first (close or remove from org)
   - This is destructive and irreversible
   - Only do this if you created the Organization specifically for this test

### GitHub Resources

1. **Delete GitHub Environment secrets:**

   - Navigate to https://github.com/[owner]/[repo]/settings/environments
   - Click "Development" environment
   - Delete each secret (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION)
   - Or delete entire environment

2. **Delete GitHub repository (if created for testing):**

   - Navigate to https://github.com/[owner]/[repo]/settings
   - Scroll to "Danger Zone"
   - Click "Delete this repository"
   - Confirm deletion

### Local Files

1. **Delete generated project directory:**

   ```bash
   cd /tmp
   rm -rf [project-name]
   ```

2. **Unset AWS credentials (if you want to clear them):**

   ```bash
   unset AWS_ACCESS_KEY_ID
   unset AWS_SECRET_ACCESS_KEY
   unset AWS_REGION
   ```

---

## Expected Timings

For reference, expected timings for each test case:

| Test Case | Expected Duration | Notes |
|-----------|-------------------|-------|
| 1. Project Generation | 1-2 minutes | Depends on network speed for npx |
| 2. Setup AWS Envs | 15-20 minutes | 5-15 min for account creation, 2-5 min for IAM setup |
| 3. Idempotent setup | 30-60 seconds | Fast, no resource creation |
| 4. Initialize GitHub | 10-20 seconds | API calls only |
| 5. Idempotent GitHub | 10-20 seconds | API calls only |
| 6. Full Deployment | 15-30 minutes | CDK bootstrap + deploy |
| **Total (cases 1-5)** | **20-25 minutes** | Excludes optional case 6 |
| **Total (all cases)** | **35-55 minutes** | Includes optional case 6 |

---

## Troubleshooting Common Issues

### AWS Credential Errors

**Error:** "The security token included in the request is invalid"

**Cause:** Expired credentials or incorrect credentials

**Fix:** Verify credentials are valid:
```bash
aws sts get-caller-identity
```

Expected output should show root account ARN: `arn:aws:iam::123456789012:root`

---

### Email Already In Use

**Error:** "Email address already in use"

**Cause:** Email addresses from previous test run or existing accounts

**Fix:** Use different email addresses, or delete previous test accounts

---

### Rate Limiting

**Error:** "TooManyRequestsException"

**Cause:** AWS API rate limits exceeded

**Fix:** Wait 5-10 minutes and retry. The command includes retry logic for eventual consistency but not for rate limits.

---

### GitHub Authentication Failed

**Error:** "GitHub authentication failed"

**Cause:** Invalid or expired Personal Access Token

**Fix:**
1. Verify token has `repo` scope
2. Create new token at https://github.com/settings/tokens/new
3. Ensure token belongs to repository owner

---

### Eventual Consistency Delays

**Observation:** "Waiting for account creation..." takes longer than expected

**Cause:** AWS Organizations eventual consistency

**Fix:** This is normal. Account creation typically takes 2-5 minutes but can occasionally take up to 10 minutes. The command will wait automatically.

---

## References

- [AWS Organizations Documentation](https://docs.aws.amazon.com/organizations/)
- [GitHub Environments Documentation](https://docs.github.com/en/actions/deployment/targeting-different-environments/using-environments-for-deployment)
- [create-aws-project README](../../README.md)
- [Phase 20 Research](./20-RESEARCH.md)

---

**Test protocol version:** 1.0
**Created:** 2026-02-11
**Last updated:** 2026-02-11
