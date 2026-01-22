# Phase 5: Wizard Simplification - Context

**Gathered:** 2026-01-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Simplify the main wizard to only handle project scaffolding. Remove AWS Organizations setup (moved to post-install commands). Generate `.aws-starter-config.json` with project settings for downstream commands to read.

</domain>

<decisions>
## Implementation Decisions

### Prompt Flow
- Keep all existing prompts: project name, platforms, auth, features, region, theme
- Keep current prompt order: name → platforms → auth → features → region → theme
- Preserve existing conditional behavior (whatever dependencies exist today)
- Silent removal of AWS Organizations prompts — no inline mention needed
- Post-wizard messaging will guide users to setup-aws-envs

### Config File Structure
- File: `.aws-starter-config.json` in project root
- Pretty-printed JSON (human-readable, indented)
- Include timestamp: `createdAt` field for debugging/audit
- Include placeholders for AWS account IDs (empty `accounts` section shows what will be populated by setup-aws-envs)
- Contents: projectName, platforms, authProvider, features, awsRegion, theme, createdAt, accounts (empty placeholder)

### Post-Wizard Messaging
- setup-aws-envs appears at the end of "Next steps" (after platform-specific commands)
- Inline mention, not a prominent separate section
- Show first step only (setup-aws-envs) — that command will guide to initialize-github
- Present as next step, not optional: "Next: Run setup-aws-envs to configure AWS"

### Claude's Discretion
- Whether to include configVersion field (versioning decision)
- Exact wording of post-wizard messaging
- How to structure the empty accounts placeholder

</decisions>

<specifics>
## Specific Ideas

- Config file should feel complete even before running setup-aws-envs — placeholders show user the structure
- Post-wizard flow: cd → npm install → run commands → then setup-aws-envs for deployment

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 05-wizard-simplification*
*Context gathered: 2026-01-22*
