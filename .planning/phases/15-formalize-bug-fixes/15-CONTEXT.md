# Phase 15: Formalize Bug Fixes - Context

**Gathered:** 2026-01-31
**Status:** Ready for planning

<domain>
## Phase Boundary

Commit and verify all bug fixes discovered during v1.4 validation and real-world usage. Includes encryption fix (libsodium), template fixes (testing-library, Expo compat), CLI architecture change (IAM user creation moved to setup-aws-envs), and ESM runtime fix. All code changes are already implemented — this phase formalizes, hardens error handling, and verifies.

</domain>

<decisions>
## Implementation Decisions

### Error handling
- If IAM user creation fails mid-way (e.g., dev succeeds, stage fails): **stop and report**. User re-runs to continue.
- On re-run after partial failure: **skip existing, create missing** — idempotent. Read config for existing accounts/users, only create what's missing.
- If IAM user exists in AWS but not in config (manually created or config lost): **detect and adopt** — check if user exists, record in config without re-creating.
- If access key limit hit (max 2 per IAM user): **offer to rotate** — detect existing keys, offer to delete the oldest and create a new one.

### Output messaging
- After setup-aws-envs completes: **full summary table** showing account IDs, user names, and policy names for all 3 environments.
- When initialize-github uses existing user from config: **note it explicitly** — "Using existing deployment user: myapp-dev-deploy".
- initialize-github success output: show **just the user name**, not full IAM ARN.
- Post-setup output: **brief inline note** explaining the two-step flow — "Deployment users created. Next: initialize-github to create access keys and push to GitHub."

### Claude's Discretion
- Exact table formatting for summary output
- Retry logic implementation details for key rotation
- How to detect existing IAM users (GetUser vs list)

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches for error detection and output formatting.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 15-formalize-bug-fixes*
*Context gathered: 2026-01-31*
