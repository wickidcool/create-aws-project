# Phase 14: CI Integration - Research

**Researched:** 2026-01-24
**Domain:** GitHub Actions CI/CD workflows with matrix testing
**Confidence:** HIGH

## Summary

GitHub Actions matrix strategy is the established pattern for running test suites across multiple configurations in parallel. The platform provides native support for matrix-based job parallelization with built-in caching, timeout controls, and error reporting mechanisms specifically designed for long-running test suites.

For this phase, we need two workflows: a PR workflow running core tier (5 configs: smoke + core) and a release workflow running the full matrix (14 configs). GitHub Actions provides all necessary primitives: matrix strategy for parallel execution, built-in npm caching via setup-node@v6, job summaries for aggregating results, and workflow commands for annotations and error output.

The local-runner.ts already handles CI detection (via `process.env.CI === 'true'`) and outputs plain logs instead of TTY spinners. This means the validation logic is ready for CI without modification - only workflow files need creation.

**Primary recommendation:** Use GitHub Actions matrix strategy with setup-node@v6 caching, fail-fast: false for full visibility, and GITHUB_STEP_SUMMARY for aggregated test results.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| actions/checkout | v4 | Clone repository code | Official GitHub action, supports LFS and submodules |
| actions/setup-node | v6 | Install Node.js runtime | Official action with automatic npm caching (released Jan 2026) |
| GitHub Actions matrix | native | Parallel job execution | Built into GitHub Actions workflow syntax |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| actions/upload-artifact | v4 | Upload logs/outputs | For debugging failed validations |
| actions/download-artifact | v5 | Retrieve artifacts | When aggregating results across jobs |
| GITHUB_STEP_SUMMARY | native | Job summary display | Aggregating matrix results into readable format |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| GitHub Actions | CircleCI, Travis | GitHub Actions is free, integrated, and has best matrix support |
| Matrix strategy | Sequential loop | Matrix runs in parallel (15-20min → 2-3min with parallelization) |
| setup-node caching | actions/cache manually | setup-node v6 has automatic caching, simpler config |

**Installation:**
```bash
# No npm packages needed - all GitHub Actions features
# Workflows defined in .github/workflows/*.yml
```

## Architecture Patterns

### Recommended Project Structure
```
.github/
├── workflows/
│   ├── pr-validation.yml       # PR workflow (core tier)
│   └── release-validation.yml  # Release workflow (full tier)
```

### Pattern 1: Matrix Strategy for Multi-Config Testing
**What:** Define a matrix with configuration names, run validation npm script for each
**When to use:** When running the same test command across multiple configurations
**Example:**
```yaml
# Source: https://docs.github.com/en/actions/using-jobs/using-a-matrix-for-your-jobs
jobs:
  validate:
    runs-on: ubuntu-latest
    strategy:
      fail-fast: false  # Run all configs even if one fails
      matrix:
        config:
          - web-api-cognito
          - web-cognito
          - mobile-auth0
          - api-cognito
          - full-auth0
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v6
        with:
          node-version: 22
          cache: 'npm'
      - run: npm ci
      - run: npm run test:e2e -- ${{ matrix.config }}
```

### Pattern 2: PR vs Release Trigger Separation
**What:** Different workflows for different triggers with different tier execution
**When to use:** When PR checks need to be fast but release validation needs to be comprehensive
**Example:**
```yaml
# PR workflow - runs on pull requests
on:
  pull_request:
    branches:
      - main

# Release workflow - runs on releases
on:
  release:
    types: [published]
```

### Pattern 3: Job Summary for Aggregated Results
**What:** Write Markdown to GITHUB_STEP_SUMMARY to display test results in workflow UI
**When to use:** When matrix produces multiple results that need aggregation for easy review
**Example:**
```bash
# Source: https://docs.github.com/en/actions/using-workflows/workflow-commands-for-github-actions
echo "### Validation Results" >> $GITHUB_STEP_SUMMARY
echo "| Config | Status | Duration |" >> $GITHUB_STEP_SUMMARY
echo "|--------|--------|----------|" >> $GITHUB_STEP_SUMMARY
echo "| ${{ matrix.config }} | ✓ PASS | 2.3s |" >> $GITHUB_STEP_SUMMARY
```

### Pattern 4: Upload Artifacts on Failure
**What:** Upload logs and error output when validation fails for debugging
**When to use:** Always - critical for understanding CI failures
**Example:**
```yaml
# Source: https://docs.github.com/en/actions/using-workflows/storing-workflow-data-as-artifacts
- name: Upload logs on failure
  if: failure()
  uses: actions/upload-artifact@v4
  with:
    name: validation-logs-${{ matrix.config }}
    path: |
      /tmp/test-*/validation.log
    retention-days: 7
```

### Anti-Patterns to Avoid
- **fail-fast: true (default):** Hides failures in other configs. Use `fail-fast: false` to see all failures.
- **Sequential execution:** Don't run configs sequentially. Use matrix for parallelization.
- **No timeout:** Long-running jobs can hang. Always set `timeout-minutes` at job level.
- **Caching node_modules:** Cache package manager cache (~/.npm), not node_modules. setup-node handles this.
- **Running full matrix on PRs:** Too slow (15-20min). Use core tier (5 configs, ~2-3min).

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Parallel test execution | Custom job orchestration | GitHub Actions matrix strategy | Built-in parallelization, automatic job distribution, native UI support |
| npm dependency caching | Custom cache scripts | setup-node@v6 with cache: 'npm' | Automatic cache key generation, restores from ~/.npm, handles lockfile changes |
| Test result aggregation | Custom reporting service | GITHUB_STEP_SUMMARY | Native Markdown rendering, supports tables/code/links, visible in PR checks |
| Error annotations | Custom log parsing | Workflow commands (::error, ::warning) | Automatic file/line linking, shows in PR diff, integrates with branch protection |
| Artifact management | Custom S3/storage | actions/upload-artifact@v4 | Automatic retention management, built-in download UI, free for public repos |

**Key insight:** GitHub Actions provides enterprise-grade CI primitives as built-in features. Custom solutions add complexity without value.

## Common Pitfalls

### Pitfall 1: Matrix Job Naming Conflicts
**What goes wrong:** When using matrix, GitHub generates job names like "validate (web-api-cognito)". If you reference jobs by name in branch protection, typos block merges.
**Why it happens:** Branch protection rules require exact job name matches. Matrix jobs have auto-generated names.
**How to avoid:** Use a separate "CI Complete" job that depends on all matrix jobs. Require only this single job in branch protection.
**Warning signs:** "Required check never completes" even though workflow runs succeed.

**Example:**
```yaml
jobs:
  validate:
    strategy:
      matrix:
        config: [web-cognito, api-cognito]
    # ... validation steps

  ci-complete:
    needs: validate
    runs-on: ubuntu-latest
    steps:
      - run: echo "All validations passed"
```

### Pitfall 2: Node Version Mismatch Between Local and CI
**What goes wrong:** Tests pass locally but fail in CI, or vice versa, due to Node version differences.
**Why it happens:** Local dev uses system Node (might be 18 or 20), CI uses specified version (22 in package.json engines).
**How to avoid:** Always specify node-version in setup-node that matches package.json engines field.
**Warning signs:** "module not found" or syntax errors that don't appear locally.

### Pitfall 3: CI Environment Variable Not Set
**What goes wrong:** local-runner.ts displays spinner in CI, polluting logs with ANSI escape codes.
**Why it happens:** GitHub Actions auto-sets CI=true, but some local tools/scripts don't.
**How to avoid:** Verify CI detection with explicit env block in workflow: `env: CI: true`.
**Warning signs:** Workflow logs show garbled output like "^[[?25l^[[36m⠋^[[39m".

### Pitfall 4: Timeout Too Short for npm install
**What goes wrong:** npm install step times out in CI, especially on first run without cache.
**Why it happens:** Default timeout is 360 minutes (6 hours), but individual steps have no timeout unless specified.
**How to avoid:** Set timeout-minutes: 10 at job level (covers all steps). Single validation should be 1-2min, giving buffer.
**Warning signs:** Jobs hang indefinitely or timeout after 6 hours.

### Pitfall 5: Artifacts Not Uploaded on Failure
**What goes wrong:** Test fails, but no logs available to debug because upload step didn't run.
**Why it happens:** By default, steps don't run after a failure unless `if: always()` or `if: failure()` is specified.
**How to avoid:** Add `if: failure()` to upload-artifact steps for logs.
**Warning signs:** "Job failed but I can't see what went wrong."

### Pitfall 6: Running Matrix Twice (PR + Push)
**What goes wrong:** Pushing to PR branch triggers workflow twice: once for push, once for pull_request.
**Why it happens:** Default on: push runs on all branches, including PR branches.
**How to avoid:** Use `on: pull_request` only (not `on: push`) for PR validation workflow.
**Warning signs:** Workflow runs appear duplicated in Actions tab.

### Pitfall 7: Release Workflow Triggers on Draft Releases
**What goes wrong:** Release workflow runs when creating draft release, before it's ready.
**Why it happens:** Default release trigger includes created, edited, etc. Draft releases emit created event.
**How to avoid:** Use `types: [published]` to run only when release is published (not draft).
**Warning signs:** Workflow runs on every draft edit/save.

## Code Examples

Verified patterns from official sources:

### PR Validation Workflow (Core Tier)
```yaml
# Source: https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions
name: PR Validation

on:
  pull_request:
    branches:
      - main

jobs:
  validate:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    strategy:
      fail-fast: false
      matrix:
        # Core tier: smoke + core = 5 configs
        config:
          - web-api-cognito    # smoke tier
          - web-cognito        # core tier
          - mobile-auth0       # core tier
          - api-cognito        # core tier
          - full-auth0         # core tier

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v6
        with:
          node-version: 22
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Validate configuration
        run: npm run test:e2e -- ${{ matrix.config }}
        env:
          CI: true

      - name: Upload logs on failure
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: validation-logs-${{ matrix.config }}
          path: /tmp/test-*/validation.log
          retention-days: 7

  ci-complete:
    needs: validate
    runs-on: ubuntu-latest
    steps:
      - run: echo "All core validations passed"
```

### Release Validation Workflow (Full Tier)
```yaml
# Source: https://docs.github.com/en/actions/using-workflows/events-that-trigger-workflows
name: Release Validation

on:
  release:
    types: [published]  # Only published releases, not drafts

jobs:
  validate:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    strategy:
      fail-fast: false
      matrix:
        # Full tier: all 14 configs
        config:
          - web-api-cognito
          - web-cognito
          - mobile-auth0
          - api-cognito
          - full-auth0
          - web-auth0
          - mobile-cognito
          - api-auth0
          - web-mobile-cognito
          - web-mobile-auth0
          - web-api-auth0
          - mobile-api-cognito
          - mobile-api-auth0
          - full-cognito

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v6
        with:
          node-version: 22
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Validate configuration
        run: npm run test:e2e -- ${{ matrix.config }}
        env:
          CI: true

      - name: Upload logs on failure
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: validation-logs-${{ matrix.config }}
          path: /tmp/test-*/validation.log
          retention-days: 7

  release-complete:
    needs: validate
    runs-on: ubuntu-latest
    steps:
      - run: echo "All 14 configurations validated successfully"
```

### Creating Job Summary with Results
```bash
# Source: https://docs.github.com/en/actions/using-workflows/workflow-commands-for-github-actions
# Add to validation step after npm run test:e2e
{
  echo "### Validation: ${{ matrix.config }}"
  echo ""
  echo "**Status:** ✓ Passed"
  echo ""
  echo "**Duration:** ${SECONDS}s"
} >> $GITHUB_STEP_SUMMARY
```

### Error Annotation for Failed Validation
```bash
# Source: https://docs.github.com/en/actions/using-workflows/workflow-commands-for-github-actions
# Add to validation step on failure
if [ $? -ne 0 ]; then
  echo "::error title=Validation Failed::Configuration ${{ matrix.config }} failed validation"
fi
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| setup-node@v3 | setup-node@v6 | Jan 2026 | Automatic npm caching when packageManager field exists in package.json |
| Manual cache action | Built-in setup-node caching | v4 (2023) | Simpler config, better cache key generation |
| Annotations only | Job Summaries + Annotations | May 2022 | Rich Markdown reports in workflow UI |
| upload-artifact@v3 | upload-artifact@v4 | Dec 2023 | Faster uploads, better compression |
| actions/checkout@v3 | actions/checkout@v4 | Sep 2023 | Updated Node.js runtime, better LFS support |

**Deprecated/outdated:**
- setup-node@v3 and earlier: No automatic caching, requires manual cache action
- upload-artifact@v3: Slower, larger artifact sizes
- Using on: [push, pull_request]: Causes duplicate runs on PR branches, use on: pull_request only

## Open Questions

No significant open questions. All necessary functionality is well-documented and stable.

## Sources

### Primary (HIGH confidence)
- https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions - Workflow syntax reference
- https://docs.github.com/en/actions/using-jobs/using-a-matrix-for-your-jobs - Matrix strategy documentation
- https://docs.github.com/en/actions/using-workflows/caching-dependencies-to-speed-up-workflows - Caching guide
- https://docs.github.com/en/actions/using-workflows/events-that-trigger-workflows - Workflow triggers
- https://docs.github.com/en/actions/using-workflows/workflow-commands-for-github-actions - Workflow commands (annotations, summaries)
- https://docs.github.com/en/actions/using-workflows/storing-workflow-data-as-artifacts - Artifact management
- https://github.com/actions/setup-node - setup-node v6 documentation
- https://github.blog/news-insights/product-news/supercharging-github-actions-with-job-summaries/ - Job summaries announcement

### Secondary (MEDIUM confidence)
- [GitHub Actions Matrix Strategy: Basics, Tutorial & Best Practices](https://codefresh.io/learn/github-actions/github-actions-matrix/) - Matrix best practices 2026
- [GitHub Actions in 2026: The Complete Guide to Monorepo CI/CD](https://dev.to/pockit_tools/github-actions-in-2026-the-complete-guide-to-monorepo-cicd-and-self-hosted-runners-1jop) - Current practices
- [Optimizing GitHub Actions with Matrix Builds](https://github.com/orgs/community/discussions/148131) - Community discussion on optimization
- [Managing a branch protection rule](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/managing-a-branch-protection-rule) - Branch protection integration

### Tertiary (LOW confidence)
- None - all findings verified with official documentation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All official GitHub Actions, well-documented and stable
- Architecture: HIGH - Patterns verified from official GitHub docs and community best practices
- Pitfalls: HIGH - Common issues documented in GitHub community discussions and official troubleshooting

**Research date:** 2026-01-24
**Valid until:** 2026-04-24 (90 days - GitHub Actions is stable, slow-moving)
