# Phase 7: initialize-github Command - Context

**Gathered:** 2026-01-21
**Status:** Ready for planning

<domain>
## Phase Boundary

CLI command that configures GitHub Environment with AWS credentials for a single environment (dev, stage, or prod). Creates IAM deployment user in target account, stores credentials as GitHub secrets, validates environment exists in config first. Users run this per-environment after setup-aws-envs completes.

</domain>

<decisions>
## Implementation Decisions

### Argument handling
- If no argument provided, prompt user interactively to select environment
- Environment names must be strict lowercase only (dev, stage, prod) — error on DEV, Dev, etc.
- If account ID for environment is missing from config, show error with guidance: "No account ID for {env}. Run setup-aws-envs first."
- If GitHub environment already exists, re-configure it (overwrite/update rather than error)

### IAM user creation
- Naming convention: `{project}-{env}-deploy` (e.g., my-app-dev-deploy)
- If IAM user already exists with same name, show error telling user to delete manually
- Permissions should be minimal/scoped for CDK deployment (CloudFormation, S3, IAM:PassRole, etc.) — not AdministratorAccess
- IAM user created directly in target environment account (not management account)

### GitHub integration
- Authenticate via interactive prompt for GitHub PAT (not gh CLI or env var)
- GitHub Environment naming: Capitalized (Development, Staging, Production)
- Secret names: Standard AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY (per-environment isolation via GitHub Environments)
- Detect repo from git remote origin (parse owner/repo from `git remote -v`)

### Progress and output
- Use ora spinners for consistency with setup-aws-envs
- Success message includes full details: environment name, IAM user ARN, GitHub env URL, next steps
- Next step guidance shows both: remaining environments to configure + how to deploy
- Errors should be verbose — show full error message + error type for debugging

### Claude's Discretion
- Exact IAM policy document for minimal CDK permissions
- Exact prompts wording for PAT collection
- Error message formatting details
- How to handle git remote parsing edge cases

</decisions>

<specifics>
## Specific Ideas

- Pattern should feel consistent with setup-aws-envs (ora spinners, error handling style, picocolors)
- IAM user permissions should follow principle of least privilege while still allowing CDK to work

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 07-initialize-github*
*Context gathered: 2026-01-21*
