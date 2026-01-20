---
phase: 03-template-updates-integration
plan: 01
subsystem: infra
tags: [cdk, aws, multi-account, organizations, github-actions]

# Dependency graph
requires:
  - phase: 01-aws-organizations-foundation
    provides: Token system with ORG_ENABLED, DEV_ACCOUNT_ID, STAGE_ACCOUNT_ID, PROD_ACCOUNT_ID
  - phase: 02-github-deployment-command
    provides: GitHub Environments with AWS credentials per environment
provides:
  - CDK app multi-account deployment logic
  - Environment-aware deploy action
  - Environment-specific npm scripts
affects: [03-02, generated-projects]

# Tech tracking
tech-stack:
  added: []
  patterns: [handlebars-conditionals, environment-context]

key-files:
  modified:
    - templates/apps/api/cdk/app.ts
    - templates/.github/actions/deploy-cdk/action.yml
    - templates/root/package.json

key-decisions:
  - "Handlebars conditionals for ORG_ENABLED backward compatibility"
  - "Account ID lookup from tokens via accountIds map"
  - "Fallback to CDK_DEFAULT_ACCOUNT when environment not in map"

patterns-established:
  - "Use {{#if ORG_ENABLED}} for multi-account vs single-account code paths"
  - "Pass -c environment=X to all CDK commands"

issues-created: []

# Metrics
duration: 2min
completed: 2026-01-20
---

# Phase 3 Plan 01: CDK Stack Updates for Cross-Account Deployment Summary

**CDK templates and deploy action updated to select AWS account ID based on environment using conditional Handlebars blocks**

## Performance

- **Duration:** 2 min
- **Started:** 2026-01-20T18:31:55Z
- **Completed:** 2026-01-20T18:33:30Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments

- CDK app.ts now uses accountIds map to select correct account for dev/stage/prod
- Conditional blocks ({{#if ORG_ENABLED}}) ensure v1.1 backward compatibility
- deploy-cdk action passes environment context to CDK
- npm scripts updated with -c environment= parameter for all deploy commands

## Task Commits

Each task was committed atomically:

1. **Task 1: Update CDK app for multi-account deployment** - `8705104` (feat)
2. **Task 2: Update deploy-cdk action to pass environment** - `952bc33` (feat)
3. **Task 3: Update package.json CDK scripts** - `43fcbfb` (feat)

## Files Created/Modified

- `templates/apps/api/cdk/app.ts` - Added accountIds map and conditional account selection
- `templates/.github/actions/deploy-cdk/action.yml` - Added -c environment parameter to deploy command
- `templates/root/package.json` - Updated cdk:deploy scripts with environment context

## Decisions Made

- Used Handlebars {{#if ORG_ENABLED}} conditionals so existing v1.1 projects (ORG_ENABLED=false) work unchanged
- Account lookup uses simple map access with CDK_DEFAULT_ACCOUNT fallback
- Region now uses {{AWS_REGION}} token for consistency with other templates

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## Next Phase Readiness

- CDK templates now support both single-account and multi-account modes
- Ready for 03-02: GitHub workflow updates for multi-environment secrets

---
*Phase: 03-template-updates-integration*
*Completed: 2026-01-20*
