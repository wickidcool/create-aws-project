# Phase 8: Documentation Updates - Context

**Gathered:** 2026-01-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Update README.md to reflect the new CLI architecture: simplified wizard (no AWS Organizations prompts), new post-install commands (setup-aws-envs, initialize-github), and updated workflow. No new documentation files — updates to existing README.md only.

</domain>

<decisions>
## Implementation Decisions

### Workflow structure
- Step-by-step walkthrough for post-install setup flow
- Include expected terminal output for key steps
- New "Post-Install Setup" section after Quick Start (dedicated, clearly separated)
- Link to separate Prerequisites section rather than inline prerequisites

### README sections to update
- AWS Organizations prompts move from wizard section to Post-Install Setup section
- Commands (setup-aws-envs, initialize-github) explained inline within workflow — no separate Command Reference sections
- No mention of deprecated setup-github command (clean break)
- Add troubleshooting section for common AWS/GitHub setup errors

### Command reference format
- Usage + 1-2 practical examples per command (not full reference)
- Show one environment (dev) as example, mention others exist
- Explain what commands do under the hood (IAM users, Organizations, etc.)
- Document interactive prompts (what the CLI asks for, so users can prepare)

### Tone and audience
- Assume AWS newcomer audience
- Link to AWS docs for concepts (Organizations, IAM) rather than inline explanations
- Friendly and conversational tone — casual, approachable, uses "you" and "we"
- Include "why" context — explain rationale for per-environment setup and the overall flow

### Claude's Discretion
- Exact section ordering in README
- Troubleshooting section content (based on actual error scenarios in code)
- How much terminal output to show per step
- Whether to use callout boxes/admonitions

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches for technical documentation.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 08-documentation-updates*
*Context gathered: 2026-01-22*
