# Roadmap: create-aws-project

## Milestones

- **v1.2 AWS Organizations Support** - Phases 1-3 (shipped 2026-01-20)
- **v1.3 CLI Architecture Refactor** - Phases 4-9 (shipped 2026-01-23)
- **v1.4 Generated Project Validation** - Phases 10-14 (shipped 2026-01-24)
- **v1.5 Bug Fixes & Stability** - Phase 15 (shipped 2026-01-31)
- **v1.5.1 Fixes & Git Setup** - Phase 16 (shipped 2026-02-01)
- **v1.6 End-to-End AWS Setup** - Phases 17-22 (shipped 2026-02-13)
- **v1.7 AI-Friendly CLI** - Phases 23-25 (in progress)

---

## Phases

### v1.2-v1.6 (Completed)

Phases 1-22 are complete. See `.planning/milestones/` for archived phase details and `.planning/MILESTONES.md` for milestone summaries.

---

### v1.7 AI-Friendly CLI (In Progress)

---

#### Phase 23 - Template Fix: Configurable Auth Test Mock

**Goal:** App.spec.tsx test mock correctly handles authenticated vs unauthenticated states without spurious fetch calls.

**Status:** Done (already implemented — commit phase)

**Dependencies:** None

**Requirements:** FIX-01

**Success Criteria:**
1. App.spec.tsx renders without triggering fetch on mount when the user is unauthenticated.
2. App.spec.tsx triggers fetch on mount when the user is authenticated.
3. Auth state is configurable per test without modifying the mock module.

---

#### Phase 24 - Non-Interactive Wizard Mode

**Goal:** The create-aws-project CLI can run entirely without user input by reading a JSON config file, enabling AI agents and CI pipelines to generate projects programmatically.

**Status:** Planned

**Dependencies:** Phase 23

**Requirements:** NI-01, NI-02, NI-03, NI-04, NI-05, NI-06

**Plans:** 2 plans

Plans:
- [ ] 24-01-PLAN.md — TDD: Non-interactive config schema + loader (Zod schema, defaults, validation, tests)
- [ ] 24-02-PLAN.md — Wire --config flag into CLI (detection, runNonInteractive, skip git, E2E verification)

**Success Criteria:**
1. Running `npx create-aws-project --config project.json` with only `{"name": "my-app"}` generates a project with all other values at their defaults (platforms: web+api, auth: none, features: github-actions+vscode-config, region: us-east-1, brandColor: blue).
2. Running with a complete config file produces a project with every specified value applied, with no prompts shown at any point.
3. Running with an invalid config value (e.g., unknown platform or missing name) prints a clear error listing every validation failure and exits non-zero without prompting.
4. Running with `--config` does not perform git init or any GitHub repo setup after project generation.

---

#### Phase 25 - Non-Interactive setup-aws-envs

**Goal:** setup-aws-envs can run without user input by reading a JSON config file, deriving per-environment emails automatically from a single root email address.

**Status:** Pending

**Dependencies:** Phase 24

**Requirements:** NI-07, NI-08, NI-09

**Success Criteria:**
1. Running `setup-aws-envs --config aws.json` with `{"email": "owner@example.com"}` completes the full AWS setup flow with no interactive prompts.
2. Per-environment root emails are automatically derived: `owner-dev@example.com`, `owner-stage@example.com`, `owner-prod@example.com`.
3. Running without `--config` continues to prompt interactively (no regression).

---

## Progress

| Phase | Name | Requirements | Status |
|-------|------|--------------|--------|
| 1-3 | v1.2 AWS Organizations Support | — | Complete |
| 4-9 | v1.3 CLI Architecture Refactor | — | Complete |
| 10-14 | v1.4 Generated Project Validation | — | Complete |
| 15 | v1.5 Bug Fixes & Stability | — | Complete |
| 16 | v1.5.1 Fixes & Git Setup | — | Complete |
| 17-22 | v1.6 End-to-End AWS Setup | — | Complete |
| 23 | Template Fix: Configurable Auth Test Mock | FIX-01 | Done |
| 24 | Non-Interactive Wizard Mode | NI-01, NI-02, NI-03, NI-04, NI-05, NI-06 | Planned |
| 25 | Non-Interactive setup-aws-envs | NI-07, NI-08, NI-09 | Pending |

**v1.7 coverage:** 10/10 requirements mapped
