# Phase 25: Non-Interactive setup-aws-envs - Context

**Gathered:** 2026-02-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Make `setup-aws-envs` runnable without user input via `--config <path>`. The config provides a root email address; per-environment emails are auto-derived by inserting `-{env}` before `@`. The interactive flow remains unchanged when `--config` is not provided.

Requirements: NI-07, NI-08, NI-09

</domain>

<decisions>
## Implementation Decisions

### GitHub setup handling
- Always auto-run `initialize-github --all` after AWS setup completes in non-interactive mode — no prompt, no config flag
- Pass `--all` flag to `initialize-github` to skip its own interactive prompts
- If `initialize-github` fails (missing token, API error, etc.), `setup-aws-envs` still exits 0 with a warning — AWS setup is the primary goal
- Announce the GitHub step before running: print a message like "Setting up GitHub environments..." before invoking, then show result

### Output behavior
- Non-interactive mode shows the same step-by-step output as interactive mode — progress messages, account creation status, credentials table
- Print each derived email as it's used (e.g., "Using dev email: owner-dev@example.com") for transparency
- Partial failure behavior identical to interactive: save config after each successful step, exit non-zero on failure, re-running resumes
- Final success summary table identical to interactive mode — no JSON output flag needed

### Claude's Discretion
- Config schema validation approach (follow Phase 24 Zod patterns)
- Email derivation edge case handling (plus aliases, subdomains)
- Exact error message formatting for invalid config
- Where to detect `--config` in the setup-aws-envs flow

</decisions>

<specifics>
## Specific Ideas

- Follow Phase 24's pattern: Zod schema, clear validation errors, `--config` flag detection
- The only required config field is `email` — keep the schema minimal like Phase 24's `name`-only minimum

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 25-non-interactive-setup-aws-envs*
*Context gathered: 2026-02-18*
