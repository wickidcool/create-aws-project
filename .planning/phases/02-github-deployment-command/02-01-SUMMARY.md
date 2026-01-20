---
phase: 02-github-deployment-command
plan: 01
subsystem: infra
tags: [aws-sdk, iam, deployment-users, access-keys, least-privilege]

# Dependency graph
requires:
  - phase: 01-aws-organizations-foundation
    provides: AWS SDK v3 patterns, Organizations service module
provides:
  - IAM client factory
  - Deployment user creation with /deployment/ path
  - CDK deployment policy with least-privilege permissions
  - Access key credential generation
  - High-level orchestrator for complete user setup
affects: [02-03, cli-integration, github-secrets-setup]

# Tech tracking
tech-stack:
  added: ["@aws-sdk/client-iam"]
  patterns: [aws-sdk-v3-client-pattern, least-privilege-policies, idempotent-resource-creation]

key-files:
  created: [src/aws/iam.ts]
  modified: [package.json, package-lock.json]

key-decisions:
  - "Path /deployment/ for all deployment users for easy identification and cleanup"
  - "Least-privilege policy includes CDK bootstrap resources plus common deployment targets"
  - "Idempotent creation: check if user/policy exists before creating"

patterns-established:
  - "IAM deployment user naming: {project}-{environment}-deploy"
  - "Policy naming: {project}-{environment}-cdk-deploy"
  - "Resource tagging with Purpose=CDK Deployment and ManagedBy=create-aws-starter-kit"

issues-created: []

# Metrics
duration: 1min
completed: 2026-01-20
---

# Phase 02 Plan 01: IAM Service Module Summary

**AWS IAM SDK integration with deployment user creation, least-privilege CDK policies, and access key generation for GitHub Actions deployment**

## Performance

- **Duration:** 1 min
- **Started:** 2026-01-20T19:00:00Z
- **Completed:** 2026-01-20T19:01:30Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Added @aws-sdk/client-iam as production dependency
- Created comprehensive IAM service module with 6 exported functions
- Implemented least-privilege CDK deployment policy covering CloudFormation, S3, Lambda, API Gateway, DynamoDB, CloudFront, and Cognito
- Added idempotent resource creation (checks for existing users/policies)
- Progress feedback via picocolors consistent with organizations.ts

## Task Commits

Each task was committed atomically:

1. **Task 1: Add AWS SDK IAM dependency** - `48659e6` (chore)
2. **Task 2: Create IAM service module** - `6242722` (feat)

## Files Created/Modified

- `package.json` - Added @aws-sdk/client-iam dependency
- `package-lock.json` - Updated lockfile with 2 new packages
- `src/aws/iam.ts` - New IAM service module with:
  - `createIAMClient()` - Factory for IAMClient
  - `createDeploymentUser()` - Creates user with /deployment/ path
  - `createCDKDeploymentPolicy()` - Minimal CDK deployment permissions
  - `attachPolicyToUser()` - Attaches policy to user
  - `createAccessKey()` - Generates access key credentials
  - `createDeploymentUserWithCredentials()` - High-level orchestrator

## Decisions Made

- **Path /deployment/** for all deployment users: Makes it easy to identify and clean up deployment users vs other IAM users.
- **Least-privilege policy design**: Policy includes only permissions needed for CDK deployment:
  - CloudFormation for stack management
  - S3 for CDK bootstrap bucket (restricted to cdk-*-assets-{accountId}-*)
  - IAM PassRole and STS AssumeRole for CDK execution roles
  - SSM for CDK context parameters
  - Lambda, API Gateway, DynamoDB, CloudFront, Cognito for actual resource deployment
- **Idempotent creation**: Functions check if user/policy exists before creating, allowing reruns without failures.
- **Resource tagging**: All created resources tagged with Purpose=CDK Deployment and ManagedBy=create-aws-starter-kit for audit/cleanup.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## Next Phase Readiness

- IAM service module ready for integration with GitHub secrets setup (02-03)
- All exported functions documented with TypeScript types
- Pattern consistent with organizations.ts for easy integration
- Ready for parallel completion with 02-02 (GitHub API module)

---
*Phase: 02-github-deployment-command*
*Completed: 2026-01-20*
