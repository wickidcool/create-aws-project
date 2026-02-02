# Phase 16: Fixes & Git Setup - Research

**Researched:** 2026-02-01
**Domain:** CLI argument handling, documentation fixes, git operations, GitHub API
**Confidence:** HIGH

## Summary

This phase has two independent workstreams: (1) CLI bug fixes (project name arg passthrough and documentation corrections) and (2) optional git repository setup after project generation.

The CLI fixes are straightforward code changes. FIX-01 requires passing the CLI argument from `process.argv` through `runCreate()` into the wizard's `projectNamePrompt` as a dynamic `initial` value. FIX-02 requires correcting stale `create-aws-starter-kit` references in `src/cli.ts` (help text and banner) and `templates/root/README.md` (npm link).

The git setup feature adds post-generation prompts for GitHub repo URL and PAT, then uses `child_process.execSync` for git operations and the existing `@octokit/rest` dependency for repo creation. The existing codebase already has all needed patterns: `@octokit/rest` client creation in `src/github/secrets.ts`, PAT prompting in `src/commands/initialize-github.ts`, and `execSync` usage for git commands.

**Primary recommendation:** Implement as two independent plans -- one for CLI fixes (FIX-01, FIX-02) and one for git setup (GIT-01 through GIT-06).

## Standard Stack

### Core (Already in dependencies)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@octokit/rest` | ^22.0.1 | GitHub API for repo creation | Already a dependency, used in `src/github/secrets.ts` |
| `prompts` | ^2.4.2 | Interactive wizard prompts | Already used for all wizard prompts |
| `ora` | ^9.1.0 | Spinner for git operations | Already used in `initialize-github` command |
| `picocolors` | ^1.1.1 | Terminal coloring | Already used throughout codebase |

### Core (Node.js built-in)

| Module | Purpose | Why |
|--------|---------|-----|
| `child_process.execSync` | Git CLI operations (init, add, commit, remote, push) | Already used in `src/commands/initialize-github.ts:53` for `git remote get-url origin`. Production dependency (not devDep like `execa`). |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `child_process.execSync` | `simple-git` npm package | Adds a dependency for something `execSync` handles in ~10 lines. Not justified. |
| `child_process.execSync` | `isomorphic-git` | Heavy library for a simple init/commit/push sequence. Overkill. |
| `child_process.execSync` | `execa` (already in devDeps) | `execa` is a devDependency for tests only. Cannot use in production code without moving to dependencies. `execSync` is built-in and sufficient. |

**No new dependencies needed.**

## Architecture Patterns

### Current CLI Flow (relevant code paths)

```
src/index.ts          # Entry: calls run()
src/cli.ts            # run(): argv parsing, switch routing, runCreate()
  -> src/wizard.ts    # runWizard(): prompts array, returns ProjectConfig
    -> src/prompts/project-name.ts  # projectNamePrompt (static initial: 'my-aws-app')
  -> src/generator/generate-project.ts  # generateProject(config, outputDir)
  -> writeConfigFile()
  -> printNextSteps()
```

### FIX-01: Project Name Arg Passthrough

**Current behavior:** `runCreate(args)` receives `args` but never uses them. The `projectNamePrompt` has a hardcoded `initial: 'my-aws-app'`.

**Required change:** Extract project name from args in `runCreate()`, pass it to the wizard.

The `prompts` library supports `initial` as a function: `(prev, values, prompt) => string`. Two implementation approaches:

**Approach A: Modify prompt object before calling prompts**
```typescript
// In cli.ts runCreate()
const nameArg = args.find(arg => !arg.startsWith('-'));
if (nameArg) {
  projectNamePrompt.initial = nameArg;
}
const config = await runWizard();
```
Problem: Mutates shared module state. If runCreate is called twice (unlikely but bad practice), the mutation persists.

**Approach B (RECOMMENDED): Pass nameArg to runWizard, which passes to prompts**
```typescript
// wizard.ts
export async function runWizard(options?: { defaultName?: string }): Promise<ProjectConfig | null> {
  const prompts = [
    { ...projectNamePrompt, ...(options?.defaultName ? { initial: options.defaultName } : {}) },
    platformsPrompt,
    // ...
  ];
}

// cli.ts
async function runCreate(args: string[]): Promise<void> {
  // First non-flag, non-command arg is the project name
  const nameArg = args.find(arg => !arg.startsWith('-'));
  const config = await runWizard(nameArg ? { defaultName: nameArg } : undefined);
}
```

**Key detail:** In `runCreate`, `args` already has the command filtered out because in the `default` case of the switch, `args` is the full `process.argv.slice(2)`. When the user runs `npx create-aws-project my-app`, `args = ['my-app']`. The first non-flag argument IS the project name (it fell through from the default case because `my-app` is not a known command).

**Validation:** The existing `validateProjectName()` in the prompt's `validate` function will still validate user input. The `initial` value just pre-fills; the user can change it.

### FIX-02: Documentation Corrections

**Issues found (all HIGH confidence, verified by reading source files):**

1. **`src/cli.ts` lines 63-86, 97:** Help text and banner say `create-aws-starter-kit` (old package name). Should be `create-aws-project`.

2. **`templates/root/README.md` line 112:** npm link URL says `https://www.npmjs.com/package/create-aws-starter-kit`. Should be `https://www.npmjs.com/package/create-aws-project`.

Note: The `src/aws/iam.ts` lines 136, 157, 287 also reference `create-aws-starter-kit` in IAM tags (`ManagedBy` tag value). However, changing these would break idempotent adoption of existing IAM users created by v1.5.0. **Do NOT change the IAM tag values** -- they are operational identifiers, not user-facing documentation.

### GIT-01 through GIT-06: Post-Generation Git Setup

**Flow design:**

```
runCreate(args)
  |
  v
runWizard(options)        # Existing wizard prompts
  |
  v
generateProject()         # Existing generation
writeConfigFile()         # Existing config write
  |
  v
promptGitSetup()          # NEW: Ask for repo URL (skippable)
  |                         If skipped -> skip all git (GIT-06)
  v
promptGitHubPAT()         # NEW: Ask for PAT (GIT-02)
  |
  v
gitInit(outputDir)        # NEW: git init + git add + git commit (GIT-03)
  |
  v
ensureRepoExists()        # NEW: Check repo via API, create if needed (GIT-05)
  |
  v
pushToRemote()            # NEW: git remote add + git push (GIT-04)
  |
  v
printNextSteps()          # Existing (adjust messaging)
```

**Where git setup goes:** After `writeConfigFile()` in `runCreate()`, before `printNextSteps()`. The git operations happen in the generated project directory (`outputDir`), not the current directory.

### Recommended Project Structure for New Code

```
src/
├── cli.ts                          # MODIFY: pass nameArg to runWizard, add git setup after generation
├── wizard.ts                       # MODIFY: accept options with defaultName
├── prompts/
│   └── project-name.ts             # NO CHANGE (initial override happens in wizard.ts)
├── git/
│   └── setup.ts                    # NEW: git init, commit, push, repo creation
├── github/
│   └── secrets.ts                  # NO CHANGE (reuse createGitHubClient, parseGitHubUrl)
└── commands/
    └── initialize-github.ts        # NO CHANGE (reference for patterns)
```

### Pattern: Git Operations Module

```typescript
// src/git/setup.ts
import { execSync } from 'node:child_process';
import { Octokit } from '@octokit/rest';
import ora from 'ora';
import pc from 'picocolors';

interface GitSetupConfig {
  repoUrl: string;       // GitHub URL (https://github.com/owner/repo)
  pat: string;           // GitHub PAT
  owner: string;         // Parsed from URL
  repo: string;          // Parsed from URL
  projectDir: string;    // Absolute path to generated project
}

/**
 * Initialize git repo, create initial commit
 */
export function gitInitAndCommit(projectDir: string): void {
  execSync('git init', { cwd: projectDir, stdio: 'pipe' });
  execSync('git add .', { cwd: projectDir, stdio: 'pipe' });
  execSync('git commit -m "Initial commit from create-aws-project"', {
    cwd: projectDir,
    stdio: 'pipe',
  });
}

/**
 * Check if remote repo exists, create if not
 */
export async function ensureRemoteRepoExists(
  octokit: Octokit,
  owner: string,
  repo: string
): Promise<void> {
  try {
    await octokit.rest.repos.get({ owner, repo });
    // Repo exists, nothing to do
  } catch (error: unknown) {
    if (error instanceof Error && 'status' in error && (error as any).status === 404) {
      // Repo doesn't exist, create it
      await octokit.rest.repos.createForAuthenticatedUser({
        name: repo,
        private: true,  // Default to private
        auto_init: false, // We already have content
      });
    } else {
      throw error;
    }
  }
}

/**
 * Add remote and push. Uses PAT embedded in HTTPS URL for auth.
 */
export function pushToRemote(
  projectDir: string,
  owner: string,
  repo: string,
  pat: string
): void {
  // Use PAT-embedded URL to avoid credential prompts
  const authUrl = `https://${pat}@github.com/${owner}/${repo}.git`;
  execSync(`git remote add origin ${authUrl}`, {
    cwd: projectDir,
    stdio: 'pipe',
  });
  execSync('git push -u origin main', {
    cwd: projectDir,
    stdio: 'pipe',
  });
}
```

### Pattern: Post-Generation Prompts

```typescript
// In cli.ts or a new module

import prompts from 'prompts';
import pc from 'picocolors';

interface GitPromptResult {
  repoUrl?: string;
  pat?: string;
}

async function promptGitSetup(): Promise<GitPromptResult> {
  console.log('');
  console.log(pc.bold('GitHub Repository (optional)'));
  console.log(pc.dim('Set up a GitHub repository for your project. Press Enter to skip.'));
  console.log('');

  const { repoUrl } = await prompts({
    type: 'text',
    name: 'repoUrl',
    message: 'GitHub repository URL:',
    hint: 'Press Enter to skip',
    // Empty string = skipped
  });

  // GIT-06: If skipped, skip everything
  if (!repoUrl || !repoUrl.trim()) {
    return {};
  }

  // GIT-02: If URL provided, prompt for PAT
  const { pat } = await prompts({
    type: 'password',
    name: 'pat',
    message: 'GitHub Personal Access Token:',
    validate: (value: string) => {
      if (!value.trim()) return 'Token is required to push to GitHub';
      if (!value.startsWith('ghp_') && !value.startsWith('github_pat_')) {
        return 'Invalid token format. Expected ghp_ or github_pat_ prefix.';
      }
      return true;
    },
  });

  return { repoUrl: repoUrl.trim(), pat };
}
```

### Anti-Patterns to Avoid

- **Do NOT store the PAT anywhere** -- not in config files, not in git history, not in environment variables. Use it once for the push and discard.
- **Do NOT set the remote URL with embedded PAT permanently** -- after pushing, replace the remote URL with the clean HTTPS URL (without the token) so the PAT does not persist in `.git/config`.
- **Do NOT log the PAT or the auth URL** -- use `stdio: 'pipe'` on all execSync calls involving the token.
- **Do NOT run git operations in the wrong directory** -- always pass `{ cwd: projectDir }` to `execSync`.
- **Do NOT create the repo under an org** -- `createForAuthenticatedUser` creates under the authenticated user. If the owner from the URL is different from the authenticated user, the repo may need `createInOrg`. Handle this with a check.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| GitHub URL parsing | Custom regex parser | `parseGitHubUrl()` from `src/github/secrets.ts` | Already handles HTTPS, SSH, and `owner/repo` formats |
| GitHub API client | Raw fetch calls | `createGitHubClient()` from `src/github/secrets.ts` | Already configured, typed, tested |
| PAT validation | Custom regex | Reuse pattern from `initialize-github.ts:88-90` | Same `ghp_` / `github_pat_` prefix check |
| npm package name validation | Custom regex | `validateProjectName()` from `src/validation/project-name.ts` | Uses `validate-npm-package-name` |
| Spinner patterns | Console.log progress | `ora` (already a dependency) | Consistent with existing commands |

## Common Pitfalls

### Pitfall 1: PAT Leaking into .git/config

**What goes wrong:** Setting remote with `https://TOKEN@github.com/...` leaves the token in `.git/config` permanently.
**Why it happens:** `git remote add origin https://token@github.com/...` stores the full URL.
**How to avoid:** After pushing, immediately replace the remote URL with the clean version:
```typescript
execSync(`git remote set-url origin https://github.com/${owner}/${repo}.git`, {
  cwd: projectDir,
  stdio: 'pipe',
});
```
**Warning signs:** Running `git remote -v` in generated project shows token in URL.

### Pitfall 2: Git User Not Configured

**What goes wrong:** `git commit` fails with "Please tell me who you are" if user has no global git config.
**Why it happens:** Fresh machines or CI environments may not have `user.name` and `user.email` configured.
**How to avoid:** Set local git config for the commit, or detect and warn:
```typescript
try {
  execSync('git config user.name', { cwd: projectDir, stdio: 'pipe' });
} catch {
  execSync('git config user.name "create-aws-project"', { cwd: projectDir, stdio: 'pipe' });
  execSync('git config user.email "noreply@create-aws-project"', { cwd: projectDir, stdio: 'pipe' });
}
```
**Warning signs:** Commit step throws with error message about identity.

### Pitfall 3: Repo Exists but User Lacks Push Access

**What goes wrong:** `repos.get()` succeeds (repo exists and is public) but `git push` fails with 403.
**Why it happens:** The PAT may not have write access to the repo, or the repo belongs to someone else.
**How to avoid:** Wrap push in try/catch with a clear error message about permissions. The `repo` scope on the PAT grants push access to repos the user owns or has write access to.
**Warning signs:** Push step fails with authentication error after repo check succeeded.

### Pitfall 4: Org Repo Creation Requires Different API

**What goes wrong:** `createForAuthenticatedUser()` creates repos under the user, not an org.
**Why it happens:** If the repo URL specifies an org as owner (e.g., `github.com/my-org/my-repo`), the API call creates the repo under the wrong owner.
**How to avoid:** Compare the `owner` from the URL with the authenticated user's login. If different, try `createInOrg` instead:
```typescript
const { data: user } = await octokit.rest.users.getAuthenticated();
if (owner === user.login) {
  await octokit.rest.repos.createForAuthenticatedUser({ name: repo, private: true });
} else {
  await octokit.rest.repos.createInOrg({ org: owner, name: repo, private: true });
}
```
**Warning signs:** Repo created under personal account instead of org.

### Pitfall 5: Default Branch Name Mismatch

**What goes wrong:** `git push -u origin main` fails because local branch is called `master` (git default on some systems).
**Why it happens:** Git's default branch name depends on `init.defaultBranch` config. Some systems default to `master`.
**How to avoid:** Explicitly set the branch name after init:
```typescript
execSync('git init', { cwd: projectDir, stdio: 'pipe' });
execSync('git checkout -b main', { cwd: projectDir, stdio: 'pipe' });
```
Or use `git init -b main` (Git 2.28+, Node 22 systems almost certainly have this).
**Warning signs:** Push fails with "src refspec main does not match any".

### Pitfall 6: Mutating Shared Prompt Object

**What goes wrong:** Setting `projectNamePrompt.initial = nameArg` mutates the module-level export.
**Why it happens:** JavaScript objects are passed by reference; modifying the imported object changes it globally.
**How to avoid:** Spread the prompt object to create a new one: `{ ...projectNamePrompt, initial: nameArg }`.
**Warning signs:** Tests or subsequent calls see stale initial values.

### Pitfall 7: CLI Arg Confusion With Command Routing

**What goes wrong:** `npx create-aws-project my-app` -- `my-app` could be confused with a command name.
**Why it happens:** The switch statement's `default` case already handles this correctly (unknown "commands" fall through to `runCreate`). The `args` passed to `runCreate` is the full `process.argv.slice(2)`.
**How to avoid:** In `runCreate(args)`, extract the project name as the first non-flag argument: `args.find(a => !a.startsWith('-'))`. This is the same as what the switch statement already does to find `command`.
**Warning signs:** Running `npx create-aws-project --help my-app` should show help, not create. This already works because `--help` is checked before the switch.

## Code Examples

### Example 1: Passing Default Name to Wizard (FIX-01)

```typescript
// src/wizard.ts - Modified signature
export interface WizardOptions {
  defaultName?: string;
}

export async function runWizard(options: WizardOptions = {}): Promise<ProjectConfig | null> {
  const namePrompt = options.defaultName
    ? { ...projectNamePrompt, initial: options.defaultName }
    : projectNamePrompt;

  const response = await prompts(
    [
      namePrompt,
      platformsPrompt,
      authProviderPrompt,
      authFeaturesPrompt,
      featuresPrompt,
      awsRegionPrompt,
      themePrompt,
    ],
    {
      onCancel: () => {
        console.log(`\n${pc.red('x')} Setup cancelled`);
        process.exit(0);
      },
    }
  );
  // ... rest unchanged
}
```

```typescript
// src/cli.ts - Modified runCreate
async function runCreate(args: string[]): Promise<void> {
  printWelcome();
  console.log('');

  // Extract project name from positional arg (FIX-01)
  const nameArg = args.find(arg => !arg.startsWith('-'));

  const config = await runWizard(nameArg ? { defaultName: nameArg } : undefined);
  // ... rest unchanged
}
```

### Example 2: Git Init and Commit (GIT-03)

```typescript
// Source: Node.js child_process docs + existing pattern in initialize-github.ts:53
import { execSync } from 'node:child_process';

function gitInitAndCommit(projectDir: string): void {
  // Use -b main to ensure consistent branch name regardless of git config
  execSync('git init -b main', { cwd: projectDir, stdio: 'pipe' });
  execSync('git add .', { cwd: projectDir, stdio: 'pipe' });
  execSync('git commit -m "Initial commit from create-aws-project"', {
    cwd: projectDir,
    stdio: 'pipe',
  });
}
```

### Example 3: Ensure Remote Repo Exists (GIT-05)

```typescript
// Source: @octokit/rest repos API
import { Octokit } from '@octokit/rest';

async function ensureRemoteRepoExists(
  octokit: Octokit,
  owner: string,
  repo: string
): Promise<void> {
  try {
    await octokit.rest.repos.get({ owner, repo });
  } catch (error: unknown) {
    if (error instanceof Error && 'status' in error && (error as any).status === 404) {
      // Determine if owner is user or org
      const { data: user } = await octokit.rest.users.getAuthenticated();
      if (owner === user.login) {
        await octokit.rest.repos.createForAuthenticatedUser({
          name: repo,
          private: true,
          auto_init: false,
        });
      } else {
        await octokit.rest.repos.createInOrg({
          org: owner,
          name: repo,
          private: true,
          auto_init: false,
        });
      }
    } else {
      throw error;
    }
  }
}
```

### Example 4: Push with PAT then Clean Remote URL (GIT-04)

```typescript
function pushToRemote(
  projectDir: string,
  owner: string,
  repo: string,
  pat: string
): void {
  const authUrl = `https://${pat}@github.com/${owner}/${repo}.git`;
  const cleanUrl = `https://github.com/${owner}/${repo}.git`;

  // Set remote with auth
  execSync(`git remote add origin ${authUrl}`, {
    cwd: projectDir,
    stdio: 'pipe',
  });

  // Push initial commit
  execSync('git push -u origin main', {
    cwd: projectDir,
    stdio: 'pipe',
  });

  // CRITICAL: Replace remote URL to remove PAT from .git/config
  execSync(`git remote set-url origin ${cleanUrl}`, {
    cwd: projectDir,
    stdio: 'pipe',
  });
}
```

### Example 5: Documentation Fix Locations (FIX-02)

```
File: src/cli.ts
  Line 63:  "create-aws-starter-kit [command] [options]"  -> "create-aws-project [command] [options]"
  Line 78:  "create-aws-starter-kit                         Run interactive wizard"  -> "create-aws-project ..."
  Line 79:  "create-aws-starter-kit setup-aws-envs          Create AWS accounts"  -> "create-aws-project ..."
  Line 80:  "create-aws-starter-kit initialize-github dev   Configure dev environment"  -> "create-aws-project ..."
  Line 83:  "create-aws-starter-kit my-app"  -> "create-aws-project my-app"
  Line 84:  "create-aws-starter-kit setup-aws-envs"  -> "create-aws-project setup-aws-envs"
  Line 85:  "create-aws-starter-kit initialize-github dev"  -> "create-aws-project initialize-github dev"
  Line 86:  "create-aws-starter-kit --help"  -> "create-aws-project --help"
  Line 97:  "create-aws-starter-kit" (banner)  -> "create-aws-project"

File: templates/root/README.md
  Line 112: "https://www.npmjs.com/package/create-aws-starter-kit"  -> "https://www.npmjs.com/package/create-aws-project"
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Password auth for git push | PAT-based auth (token in URL) | GitHub Aug 2021 | Must use PAT in HTTPS URL |
| `git init` (default branch varies) | `git init -b main` | Git 2.28 (Jul 2020) | Explicit branch name avoids master/main confusion |
| Classic PATs only (`ghp_`) | Fine-grained PATs (`github_pat_`) also supported | GitHub Oct 2022 | Token validation must accept both prefixes |

**Deprecated/outdated:**
- Password-based git push: No longer supported by GitHub since Aug 2021
- `create-aws-starter-kit` package name: Renamed to `create-aws-project`, but old name persists in source code

## Open Questions

1. **Should the repo be created as private by default?**
   - What we know: `createForAuthenticatedUser` accepts `private: true|false`. Most scaffolded projects start private.
   - What's unclear: Whether to prompt or just default to private.
   - Recommendation: Default to private. Users can change visibility in GitHub settings.

2. **What if git is not installed?**
   - What we know: `execSync('git init')` will throw if git is not on PATH.
   - What's unclear: How common this is for target users (Node.js developers).
   - Recommendation: Check for git availability before prompting. If not found, skip git setup with a helpful message.

3. **Should we handle the case where the user provides an org URL but the PAT lacks org repo creation scope?**
   - What we know: `createInOrg` requires the PAT to have org permissions.
   - What's unclear: What specific error Octokit throws for insufficient org permissions.
   - Recommendation: Wrap in try/catch with clear error message about required scopes.

## Sources

### Primary (HIGH confidence)
- **Codebase analysis**: `src/cli.ts`, `src/wizard.ts`, `src/prompts/project-name.ts`, `src/commands/initialize-github.ts`, `src/github/secrets.ts`, `templates/root/README.md`, `package.json` -- all read directly
- **Node.js docs**: `child_process.execSync` -- built-in module, well-documented
- **`prompts` npm README**: Confirmed `initial` accepts function for dynamic values

### Secondary (MEDIUM confidence)
- [@octokit/rest v22 docs](https://octokit.github.io/rest.js/v22) -- `repos.createForAuthenticatedUser`, `repos.get`, `repos.createInOrg` methods verified
- [GitHub community discussions](https://github.com/orgs/community/discussions/23419) -- PAT-embedded HTTPS URL format for git push

### Tertiary (LOW confidence)
- None -- all findings verified against codebase or official documentation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new dependencies, everything already in codebase
- Architecture (FIX-01): HIGH -- verified `prompts` library `initial` supports functions; verified CLI arg flow
- Architecture (FIX-02): HIGH -- all stale references found by searching source code
- Architecture (GIT-*): HIGH -- patterns exist in codebase (`execSync` in initialize-github, `@octokit/rest` in secrets.ts)
- Pitfalls: HIGH -- derived from standard git/GitHub API patterns and codebase analysis

**Research date:** 2026-02-01
**Valid until:** 2026-03-01 (stable domain, no fast-moving dependencies)
