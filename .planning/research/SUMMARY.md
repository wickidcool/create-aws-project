# Project Research Summary

**Project:** create-aws-project v1.6 milestone
**Domain:** CLI tool for AWS account bootstrapping with root credential handling
**Researched:** 2026-02-10
**Confidence:** HIGH

## Executive Summary

This milestone addresses three critical failures in the current AWS setup workflow: (1) root credentials cannot assume cross-account roles, causing setup to fail after account creation but before IAM user deployment, (2) re-running the command prompts for emails even when accounts already exist, and (3) initialize-github fails because it attempts cross-account role assumption with root credentials.

The solution is architectural simplification: **ALL IAM operations move to `setup-aws-envs`**. This command becomes responsible for root detection, IAM admin bootstrap (if root detected), deployment user creation across all accounts, access key generation, and credential storage. The `initialize-github` command is simplified to a pure read-config-and-push operation that takes stored credentials and writes them to GitHub secrets. No cross-account role assumption needed in initialize-github.

The key technical insight: root credentials cannot assume IAM roles (AWS blocks this for security). The workflow must detect root credentials via `GetCallerIdentity` ARN pattern (`arn:aws:iam::ACCOUNT:root`), create an admin IAM user with AdministratorAccess, switch to those credentials, then perform all cross-account operations. The existing AWS SDK v3 packages already provide all needed APIs—no new dependencies required. The critical risk is IAM eventual consistency (3-4 second propagation delay), which requires retry logic with exponential backoff for operations immediately following IAM mutations.

## Key Findings

### Recommended Stack

All required AWS SDK capabilities exist in packages already present in the project. No new dependencies needed. The existing AWS SDK v3 packages provide all APIs for root detection (`@aws-sdk/client-sts`), IAM admin creation (`@aws-sdk/client-iam`), and credential management. Current versions (3.971-3.972) are only 11-12 versions behind latest (3.983) with no breaking changes or missing features for this use case.

**Core technologies:**
- **@aws-sdk/client-sts ^3.972.0**: Root detection via GetCallerIdentity — ARN format definitively identifies root vs IAM user
- **@aws-sdk/client-iam ^3.971.0**: IAM admin user + access key creation — stable APIs unchanged since v1
- **@aws-sdk/credential-providers ^3.971.0**: Cross-account role assumption (already used) — no changes needed

**Critical version note:** Keep existing versions. Upgrading to 3.983.0 provides no functional benefit for this milestone. Project uses `^` semver ranges so patch updates are automatic.

**Implementation pattern:** Static credential objects (plain JavaScript) for credential switching. No credential provider package needed—just create new client instances with `{ credentials: { accessKeyId, secretAccessKey } }` constructor option.

### Expected Features

**Must have (table stakes):**
- **Root credential detection** — Users naturally start with root credentials (new AWS account state), CLI must detect via GetCallerIdentity ARN check
- **Automatic IAM admin creation** — AWS best practice: don't use root for operations, create admin IAM user with AdministratorAccess
- **Idempotent account creation** — Re-runs must skip existing accounts without failing, query Organizations API before prompting for emails
- **Idempotent user creation** — Re-runs must skip existing IAM users without failing, check existence before creation
- **Smart email handling** — Don't prompt for emails if accounts already exist (solves stated problem #2)
- **State persistence** — Save progress after each successful operation for recovery
- **Credential validation** — Verify credentials work before starting operations via GetCallerIdentity

**Should have (competitive differentiators):**
- **Zero-touch root-to-admin** — Fully automated credential transition with no manual swapping (stretch goal)
- **Progressive credential validation** — Test each permission before using it, fail early with actionable errors
- **Email alias generation** — Suggest email aliases (user+dev@example.com) for new accounts
- **Credential security warnings** — Warn if root access keys are long-lived, suggest disabling after setup

**Defer (v2+):**
- Multi-step undo capability (very high complexity)
- Setup dry-run mode (medium complexity, nice-to-have)
- MFA enforcement setup (advanced use case)
- Credential rotation guidance (low value for initial setup)

**Anti-features (explicitly avoid):**
- Storing root credentials long-term (security risk)
- Silent credential auto-switching (users lose track of identity)
- Custom IAM policies for admin (use AWS-managed AdministratorAccess)
- Complex credential management system (don't reinvent aws-vault)

### Architecture Approach

The architectural simplification for v1.6 eliminates cross-account role assumption from `initialize-github` entirely. Instead, `setup-aws-envs` becomes the single orchestrator for all AWS operations:

**Major components:**

1. **setup-aws-envs (expanded responsibilities)**
   - Root detection via STS GetCallerIdentity
   - IAM admin bootstrap (if root detected): CreateUser, AttachUserPolicy, CreateAccessKey
   - Credential switching: Create new clients with admin credentials (not root)
   - Organization and account creation (existing)
   - Cross-account deployment user creation: AssumeRole to each member account with admin credentials
   - Access key generation for deployment users
   - Credential storage in config file
   - **Output:** Fully configured .aws-starter-config.json with all credentials

2. **initialize-github (simplified to read-and-push)**
   - Read stored credentials from .aws-starter-config.json
   - Push credentials to GitHub secrets via GitHub API
   - No AWS operations, no role assumption, no credential generation
   - **Input:** Environment name (dev/stage/prod)
   - **Output:** GitHub repository secrets configured

3. **Credential switching architecture**
   - Phase 1: Use default credentials from CLI/env (root)
   - Phase 2: Create admin IAM user, capture access key response
   - Phase 3: Create NEW client instances with static credentials `{ accessKeyId, secretAccessKey }`
   - Phase 4: Use admin credentials for all cross-account operations via fromTemporaryCredentials

**Key pattern:** AWS SDK v3 clients are immutable regarding credentials. Cannot update credentials on existing client. Must create new client instances when switching credential context.

**Why this fixes the problems:**
- Problem 1 (root can't assume roles): Admin user CAN assume roles, all cross-account ops use admin credentials
- Problem 2 (email prompts on re-run): Check existing accounts before prompting
- Problem 3 (initialize-github fails): No longer attempts cross-account operations, just reads config and pushes to GitHub

### Critical Pitfalls

1. **Root User Cannot Assume Roles** — AWS blocks root credentials from assuming any IAM role, including OrganizationAccountAccessRole. Setup fails partway through with cryptic "Not authorized to perform: sts:AssumeRole" error. **Prevention:** Detect root early via ARN check (`:root` suffix), create admin IAM user BEFORE account creation loop, switch credentials before any AssumeRole calls.

2. **IAM Eventual Consistency Window (3-4 seconds)** — IAM uses distributed system with eventual consistency. CreateUser succeeds but immediate CreateAccessKey or AssumeRole fails with "User not found." Command appears flaky. **Prevention:** Exponential backoff retry for operations after IAM mutations. AWS SDK auto-retries throttling but NOT eventual consistency errors. Must implement custom retry logic for NoSuchEntity, InvalidClientTokenId, AccessDenied after user/policy creation.

3. **Credential Provider Chain Caching** — SDK caches first successful provider. Creating admin user doesn't switch credentials for existing clients. Subsequent operations continue using root credentials, AssumeRole still fails. **Prevention:** Create NEW client instances with explicit credentials object `{ accessKeyId, secretAccessKey }`. Don't set environment variables mid-execution. Don't expect existing clients to pick up new credentials.

4. **Partial Failure State Management** — Command creates organization and 1-2 accounts successfully, fails on third account. Re-run prompts for ALL emails again, tries to recreate accounts, gets EMAIL_ALREADY_EXISTS error. **Prevention:** Check existing accounts BEFORE prompting for emails. Only prompt for missing environments. Handle EMAIL_ALREADY_EXISTS gracefully with recovery instructions.

5. **Admin User Access Key Limit (2 keys maximum)** — AWS enforces hard limit of 2 access keys per IAM user. Third run fails with "User already has 2 access keys." **Prevention:** Check key count before creation. If user exists with 2 keys, error with clear instructions to delete old key. If user exists with 1 key, prompt for existing credentials instead of creating new.

## Implications for Roadmap

Based on research, suggested phase structure for v1.6 milestone:

### Phase 1: Root Detection and Email Deduplication
**Rationale:** Fixes the immediate user-facing failures (root detection, duplicate email prompts) with minimal complexity. Establishes foundation for admin user creation in Phase 2.

**Delivers:**
- Root credential detection via GetCallerIdentity ARN check
- Check existing accounts before email prompts (solves problem #2)
- Graceful error message if root detected (manual fallback for now)
- Idempotent account creation (skip existing)

**Addresses features:**
- Root credential detection (table stakes)
- Smart email handling (table stakes)
- Idempotent account creation (table stakes)

**Avoids pitfalls:**
- #4: Partial failure state management (check before prompt)
- #8: STS GetCallerIdentity for root detection (correct method)

**Implementation notes:**
- Modify collectEmails() to query Organizations API first
- Only prompt for missing environments
- Add isRootUser() helper using GetCallerIdentity
- Display clear message if root detected, exit with instructions

**Complexity:** LOW
**Risk:** LOW (purely additive, no credential switching yet)

---

### Phase 2: Admin User Bootstrap with Credential Switching
**Rationale:** Solves problem #1 (root can't assume roles) by creating admin IAM user and switching credentials. Most complex phase due to eventual consistency handling and credential management.

**Delivers:**
- Admin IAM user creation (CreateUser, AttachUserPolicy)
- Access key generation with secure display
- Credential switching architecture (new client instances)
- Retry logic for IAM eventual consistency
- Tag-based admin user adoption (idempotent re-runs)

**Uses stack elements:**
- @aws-sdk/client-iam for CreateUser, CreateAccessKey, AttachUserPolicy
- Static credential objects for credential switching
- Exponential backoff retry pattern

**Implements architecture component:**
- Credential switching (Phase 3 in architecture flow)
- Admin user bootstrap (Phase 2 in architecture flow)

**Avoids pitfalls:**
- #1: Root user cannot assume roles (create admin before cross-account ops)
- #2: IAM eventual consistency (retry with backoff)
- #3: Credential provider caching (new clients with explicit credentials)
- #5: Access key limit (check count before creation)
- #6: Credential security (display once with confirmation)
- #9: Admin naming collision (tag-based adoption)

**Implementation notes:**
- Add createAdminUserIfNeeded() function with tag-based existence check
- Retry createAccessKey() with exponential backoff (5 retries, base 1s)
- Create new IAMClient instances with admin credentials
- Display credentials with confirmation prompt before proceeding
- Wait 5 seconds after user creation before first use
- Store admin username (NOT credentials) in config

**Complexity:** HIGH
**Risk:** MEDIUM (eventual consistency is inherently timing-dependent)

---

### Phase 3: Move All IAM Operations to setup-aws-envs
**Rationale:** Completes the architectural simplification. Moves deployment user creation from initialize-github to setup-aws-envs, making initialize-github a simple read-and-push operation.

**Delivers:**
- Deployment user creation in setup-aws-envs (using admin credentials)
- Access key generation for all environments
- Credential storage in .aws-starter-config.json
- Simplified initialize-github (no AWS operations)

**Uses stack elements:**
- @aws-sdk/credential-providers for fromTemporaryCredentials (cross-account)
- Existing createCrossAccountIAMClient pattern
- Admin credentials from Phase 2

**Implements architecture component:**
- Cross-account operations (Phase 4 in architecture flow)
- initialize-github simplification

**Avoids pitfalls:**
- #2: IAM eventual consistency (retry AssumeRole with admin credentials)
- #10: CreateAccount timeout (verify existing 10-minute timeout)

**Implementation notes:**
- Extract deployment user creation logic from initialize-github
- Add to setup-aws-envs after account creation loop
- Use admin credentials for AssumeRole (not root)
- Store deployment user credentials in config.deploymentUsers[env]
- Modify initialize-github to read from config instead of creating
- Update config schema to include deploymentUsers object

**Complexity:** MEDIUM
**Risk:** LOW (refactoring existing working code)

---

### Phase 4: Testing and Documentation
**Rationale:** Validate end-to-end workflow with actual root credentials, document the new flow, ensure backward compatibility.

**Delivers:**
- E2E test with root credentials
- E2E test with IAM credentials (skip admin creation)
- Re-run test (idempotency validation)
- Updated README with new workflow
- Validation checklist completion

**Addresses:**
- Backward compatibility (existing projects)
- Integration testing (real AWS account)
- User documentation

**Avoids pitfalls:**
- Integration Pitfall 1: Backward compatibility (test with existing configs)
- Integration Pitfall 2: initialize-github credential dependency (document new flow)

**Implementation notes:**
- Create test AWS account with root credentials
- Run full workflow: setup-aws-envs → initialize-github
- Test re-run scenarios
- Verify spinner state on all error paths (#12)
- Document credential security best practices
- Add troubleshooting guide for common errors

**Complexity:** LOW
**Risk:** LOW (validation only, no new features)

---

### Phase Ordering Rationale

- **Phase 1 first:** Establishes detection foundation, fixes email prompts (quick win), low risk
- **Phase 2 second:** Most complex (credential switching, eventual consistency), needs focused effort
- **Phase 3 third:** Depends on Phase 2 (admin credentials), completes architectural goal
- **Phase 4 last:** Validates all changes together, ensures no regressions

**Dependencies:**
- Phase 2 depends on Phase 1 (root detection)
- Phase 3 depends on Phase 2 (admin credentials)
- Phase 4 depends on all previous phases (full integration)

**Risk mitigation:**
- Phase 1 is purely additive (can be shipped alone)
- Phase 2 is isolated to credential management (no downstream changes yet)
- Phase 3 is refactoring (existing tests catch regressions)
- Phase 4 validates before declaring milestone complete

### Research Flags

**Phases needing deeper research during planning:**
- **Phase 2:** Eventual consistency timing — research varies from "3-4 seconds" to "several seconds." May need empirical testing to determine optimal retry parameters.
- **Phase 2:** Access key security — research handling for when user has existing keys but lost credentials. Options: key rotation, manual deletion guidance, or secrets manager integration.

**Phases with standard patterns (skip research-phase):**
- **Phase 1:** Root detection via GetCallerIdentity is well-documented, single approach
- **Phase 3:** Cross-account IAM operations follow existing codebase patterns
- **Phase 4:** Testing and documentation (no new patterns)

**Additional research recommended:**
- Organizations API rate limits for account creation loop (not found in current research)
- Secrets Manager integration for admin credential storage (deferred to post-MVP, but flag for consideration)

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All APIs verified in AWS SDK v3 documentation, existing packages sufficient, no version upgrades needed |
| Features | MEDIUM | Table stakes validated via AWS best practices docs, differentiators based on competitive analysis (not all competitor features tested) |
| Architecture | HIGH | Credential switching pattern verified in AWS SDK docs and GitHub issues, root role assumption limitation confirmed in IAM troubleshooting docs |
| Pitfalls | HIGH | Critical pitfalls (#1-6) verified in official AWS documentation, eventual consistency window confirmed in multiple sources including HashiCorp Vault issues |

**Overall confidence:** HIGH

**Rationale:** All critical technical decisions (root detection method, credential switching pattern, eventual consistency handling) are validated via official AWS documentation. Stack assessment is based on existing project dependencies (no unknowns). Architecture simplification is proven approach (eliminate cross-account complexity from initialize-github). Only medium confidence area is competitive feature analysis (limited competitor testing).

### Gaps to Address

**Gap 1: Optimal retry parameters for eventual consistency**
- **Issue:** Research indicates 3-4 second propagation, but optimal retry count/backoff not empirically validated
- **Handling:** Start with conservative values (5 retries, exponential backoff from 1s), monitor in production, tune if needed
- **Validation:** E2E testing with actual AWS account will reveal if timing is adequate

**Gap 2: Admin credential storage security**
- **Issue:** Research identifies multiple approaches (display-once, temp file, Secrets Manager) but no clear winner for CLI tool context
- **Handling:** Phase 2 implements display-once with confirmation (simplest), defer Secrets Manager to post-v1.6 based on user feedback
- **Validation:** Security review during Phase 2 implementation

**Gap 3: Edge case - user has existing admin user from different project**
- **Issue:** Tag-based adoption works if admin user is for same project, but collision scenario if different project exists
- **Handling:** Phase 2 implements tag check with clear error message if mismatch, document manual resolution
- **Validation:** E2E test with pre-existing admin user

**Gap 4: Organizations API quota limits**
- **Issue:** No research found on rate limits for CreateAccount calls, relevant if creating many accounts
- **Handling:** Current implementation creates 3 accounts (dev/stage/prod), unlikely to hit limits. Flag for investigation if expanding to more environments
- **Validation:** Monitor AWS Service Quotas console during testing

**Gap 5: Backward compatibility with v1.5.1 configs**
- **Issue:** Existing configs don't have admin user or deployment user credentials stored
- **Handling:** Phase 3 adds new config fields (deploymentUsers), Phase 4 tests with v1.5.1 config to ensure no breaks
- **Validation:** E2E test with existing project config from v1.5.1

## Sources

### Primary (HIGH confidence)

**AWS Official Documentation:**
- [GetCallerIdentity API Reference](https://docs.aws.amazon.com/STS/latest/APIReference/API_GetCallerIdentity.html) — Root detection via ARN format
- [IAM Identifiers - ARN Format](https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_identifiers.html) — Authoritative ARN patterns for root vs user
- [CreateUser API Reference](https://docs.aws.amazon.com/IAM/latest/APIReference/API_CreateUser.html) — User creation, EntityAlreadyExistsException handling
- [CreateAccessKey API Reference](https://docs.aws.amazon.com/IAM/latest/APIReference/API_CreateAccessKey.html) — Access key generation, secret retrieval warning
- [IAM Troubleshooting](https://docs.aws.amazon.com/IAM/latest/UserGuide/troubleshoot_roles.html) — Root cannot assume roles (verified limitation)
- [IAM Quotas](https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_iam-quotas.html) — 2 access key limit per user
- [AWS SDK v3 - Set Credentials](https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/setting-credentials.html) — Static credential object pattern
- [Organizations CreateAccount](https://docs.aws.amazon.com/organizations/latest/APIReference/API_CreateAccount.html) — Asynchronous operations, timing expectations

**AWS SDK v3 Documentation:**
- [GetCallerIdentityCommand](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-sts/classes/getcalleridentitycommand.html) — Response structure
- [CreateAccessKeyCommand](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-iam/classes/createaccesskeycommand.html) — API usage examples
- [Credential Providers Package](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/Package/-aws-sdk-credential-providers/) — fromTemporaryCredentials usage

### Secondary (MEDIUM confidence)

**Community Resources:**
- [IAM Persistence through Eventual Consistency](https://hackingthe.cloud/aws/post_exploitation/iam_persistence_eventual_consistency/) — 3-4 second propagation window validation
- [HashiCorp Vault Issue #3115](https://github.com/hashicorp/vault/issues/3115) — Real-world eventual consistency observations
- [Netflix Security Monkey Issue #1026](https://github.com/Netflix/security_monkey/issues/1026) — Root cannot assume roles (community confirmation)
- [GitHub Issue #5731: Credential updates on existing client](https://github.com/aws/aws-sdk-js-v3/issues/5731) — Confirms new client instances required for credential switching
- [AWS re:Post: EMAIL_ALREADY_EXISTS](https://repost.aws/knowledge-center/organizations-error-email-already-exists) — Error handling strategies

**AWS Best Practices:**
- [Root User Best Practices](https://docs.aws.amazon.com/IAM/latest/UserGuide/root-user-best-practices.html) — Root credential management guidance
- [AWS SDK Retry Behavior](https://docs.aws.amazon.com/sdkref/latest/guide/feature-retry-behavior.html) — Default retry behavior (throttling only, not consistency)
- [AWS Retry with Backoff Pattern](https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/retry-backoff.html) — Implementation guidance

### Tertiary (LOW confidence)

**Security Best Practices:**
- [Node.js Security Best Practices](https://nodejs.org/en/learn/getting-started/security-best-practices) — Credential storage recommendations (general, not AWS-specific)
- [OWASP Node.js Authentication Practices](https://www.nodejs-security.com/blog/owasp-nodejs-authentication-authorization-cryptography-practices) — Referenced but not directly verified for this context

**Feature Research:**
- [AWS CDK vs Terraform Comparison](https://towardsthecloud.com/blog/aws-cdk-vs-terraform) — Competitive analysis for feature expectations
- [Node.js CLI Apps Best Practices](https://github.com/lirantal/nodejs-cli-apps-best-practices) — UX patterns for CLI tools

---

**Research completed:** 2026-02-10
**Ready for roadmap:** Yes
**Architectural decision:** ALL IAM operations in setup-aws-envs, initialize-github becomes read-and-push only
