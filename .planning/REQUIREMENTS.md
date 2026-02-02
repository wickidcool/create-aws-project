# Requirements: v1.5.1 Fixes & Git Setup

**Defined:** 2026-02-01
**Core Value:** Generated projects have production-ready multi-environment AWS infrastructure with automated CI/CD from day one.

## v1 Requirements

### CLI Fixes

- [x] **FIX-01**: Project name passed via `npx create-aws-project <name>` is used as default in wizard name prompt
- [x] **FIX-02**: Documentation shows correct command for AWS Organizations setup

### Git Setup

- [x] **GIT-01**: Wizard includes optional prompt for GitHub repository URL (skippable)
- [x] **GIT-02**: If repo URL provided, wizard prompts for GitHub Personal Access Token
- [x] **GIT-03**: After generation, run `git init` and create initial commit in project directory
- [x] **GIT-04**: Set remote origin and push initial commit to GitHub
- [x] **GIT-05**: If remote repo doesn't exist, create it via GitHub API (`@octokit/rest`) using provided PAT
- [x] **GIT-06**: Git setup skipped entirely when user skips the repo URL prompt

## Out of Scope

| Feature | Reason |
|---------|--------|
| SSH key authentication | PAT is simpler, consistent with existing initialize-github flow |
| GitHub org/team permissions | User provides URL, CLI pushes — permissions are user's responsibility |
| GitLab/Bitbucket support | GitHub only for now |
| Saving PAT for reuse | initialize-github already handles its own PAT; keep flows independent |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| FIX-01 | Phase 16 | Complete |
| FIX-02 | Phase 16 | Complete |
| GIT-01 | Phase 16 | Complete |
| GIT-02 | Phase 16 | Complete |
| GIT-03 | Phase 16 | Complete |
| GIT-04 | Phase 16 | Complete |
| GIT-05 | Phase 16 | Complete |
| GIT-06 | Phase 16 | Complete |

**Coverage:**
- v1 requirements: 8 total
- Mapped to phases: 8
- Unmapped: 0

---
*Requirements defined: 2026-02-01*
