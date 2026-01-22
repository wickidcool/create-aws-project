# Phase 5: Wizard Simplification - Research

**Researched:** 2026-01-21
**Domain:** CLI wizard modification, config file generation, prompt library patterns
**Confidence:** HIGH

## Summary

This phase simplifies the main wizard by removing AWS Organizations prompts (moving that functionality to `setup-aws-envs` command) and adding config file generation. The research focused on understanding the existing codebase structure to identify precise modification points.

**Key findings:**

1. **Wizard structure is clean:** The `wizard.ts` file uses the `prompts` library with a single array of 15 prompt objects. Removing org-related prompts (8 of them) is straightforward - just remove from the array and clean up imports/processing.

2. **Config file pattern already exists:** The `project-context.ts` utility already expects `.aws-starter-config.json` to exist. This phase adds the generation side to match the consumption side built in Phase 4.

3. **Next steps messaging is centralized:** The `printNextSteps()` function in `cli.ts` is the single place to add the `setup-aws-envs` guidance.

**Primary recommendation:** Remove org prompts from wizard.ts, add `writeConfigFile()` call in `cli.ts` after project generation, modify `printNextSteps()` to include setup-aws-envs. No new dependencies needed.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| prompts | 2.4.2 | Interactive prompts | Already used in wizard, well-understood API |
| node:fs | built-in | File writing | Native, no dependency needed for JSON write |
| picocolors | 1.1.1 | Terminal output | Already used throughout codebase |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| find-up | 8.0.0 | Config discovery | Already used in project-context.ts, not needed for this phase |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| JSON.stringify | yaml | YAML more readable but JSON matches existing pattern |
| Direct fs.writeFileSync | Template in manifest | Template approach not suitable for dynamic config content |

**Installation:**
```bash
# No new dependencies needed
```

## Architecture Patterns

### Recommended Project Structure
Current structure remains unchanged. Modifications are within existing files:
```
src/
├── wizard.ts              # MODIFY: Remove org prompts, simplify return type
├── cli.ts                 # MODIFY: Add config file write, update next steps
├── prompts/
│   └── org-structure.ts   # REMOVE OR KEEP: Can keep file (unused) or delete
├── types.ts               # MODIFY: org field becomes optional (already is)
└── utils/
    └── project-context.ts # NO CHANGE: Already expects config file
```

### Pattern 1: Prompt Array Modification
**What:** Removing prompts from the prompts array to skip them entirely
**When to use:** When removing functionality from wizard (not just hiding conditionally)
**Example:**
```typescript
// Source: Current wizard.ts pattern
// BEFORE (15 prompts):
const response = await prompts([
  projectNamePrompt,
  platformsPrompt,
  authProviderPrompt,
  authFeaturesPrompt,
  featuresPrompt,
  awsRegionPrompt,
  enableOrgPrompt,      // REMOVE
  orgNamePrompt,        // REMOVE
  orgEnvironmentsPrompt, // REMOVE
  devEmailPrompt,       // REMOVE
  stageEmailPrompt,     // REMOVE
  prodEmailPrompt,      // REMOVE
  qaEmailPrompt,        // REMOVE
  sandboxEmailPrompt,   // REMOVE
  themePrompt
]);

// AFTER (7 prompts):
const response = await prompts([
  projectNamePrompt,
  platformsPrompt,
  authProviderPrompt,
  authFeaturesPrompt,
  featuresPrompt,
  awsRegionPrompt,
  themePrompt
]);
```

### Pattern 2: Config File Generation
**What:** Writing project settings to JSON file during project creation
**When to use:** After project directory is created, before next steps display
**Example:**
```typescript
// Source: Node.js best practices + existing project-context.ts patterns
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

interface AwsStarterConfig {
  projectName: string;
  platforms: string[];
  authProvider: string;
  features: string[];
  awsRegion: string;
  theme: string;
  createdAt: string;
  accounts: Record<string, string>;  // Empty placeholder
}

function writeConfigFile(outputDir: string, config: ProjectConfig): void {
  const configContent: AwsStarterConfig = {
    projectName: config.projectName,
    platforms: config.platforms,
    authProvider: config.auth.provider,
    features: config.features,
    awsRegion: config.awsRegion,
    theme: config.brandColor,
    createdAt: new Date().toISOString(),
    accounts: {},  // Placeholder for setup-aws-envs to populate
  };

  const configPath = join(outputDir, '.aws-starter-config.json');
  writeFileSync(configPath, JSON.stringify(configContent, null, 2), 'utf-8');
}
```

### Pattern 3: Next Steps Messaging Update
**What:** Adding setup-aws-envs guidance to post-wizard messaging
**When to use:** After success message, as final instruction
**Example:**
```typescript
// Source: Current cli.ts printNextSteps pattern
function printNextSteps(projectName: string, platforms: string[]): void {
  console.log('');
  console.log(pc.bold('Next steps:'));
  console.log('');
  console.log(`  ${pc.cyan('cd')} ${projectName}`);
  console.log(`  ${pc.cyan('npm install')}`);
  console.log('');

  // ... platform-specific commands ...

  // Add at end of existing next steps
  console.log(`  ${pc.gray('# Configure AWS environments for deployment')}`);
  console.log(`  ${pc.cyan('npx create-aws-project setup-aws-envs')}`);
  console.log('');

  console.log(pc.gray('Happy coding!'));
}
```

### Anti-Patterns to Avoid
- **Leaving dead code:** Don't just comment out org prompts - remove completely
- **Hardcoding config structure:** Use a type/interface for config file structure
- **Blocking on config write:** Config write is fast; no need for async
- **Overcomplicating accounts placeholder:** Simple empty object `{}` is clearer than complex structure

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JSON pretty-print | Manual formatting | JSON.stringify(obj, null, 2) | Built-in, handles edge cases |
| ISO timestamp | Manual date formatting | new Date().toISOString() | Standard format, timezone-safe |
| File path joining | String concatenation | path.join() | Cross-platform path handling |

**Key insight:** This phase is almost entirely removal/simplification. The only new code is a small function to write the config file. Keep it minimal.

## Common Pitfalls

### Pitfall 1: Forgetting to Update Test Expectations
**What goes wrong:** Tests fail because they expect 15 prompts but now there are 7
**Why it happens:** wizard.spec.ts explicitly checks prompt count
**How to avoid:** Update test in wizard.spec.ts that checks `(promptsArg as PromptObject[]).length`
**Warning signs:** Test assertion `expect((promptsArg as PromptObject[]).length).toBe(15)` fails

### Pitfall 2: Leaving Org Processing Logic
**What goes wrong:** Runtime errors because `response.enableOrg` is undefined
**Why it happens:** Code in wizard.ts processes org fields that no longer exist
**How to avoid:** Remove the entire `if (response.enableOrg)` block and related code
**Warning signs:** TypeScript errors about undefined properties, runtime undefined references

### Pitfall 3: Breaking Import Cleanup
**What goes wrong:** Build errors from unused imports
**Why it happens:** Removing prompts but keeping imports from org-structure.ts
**How to avoid:** Remove all org-structure.ts imports from wizard.ts
**Warning signs:** ESLint unused-vars errors, TypeScript import errors

### Pitfall 4: Config File in Wrong Location
**What goes wrong:** setup-aws-envs can't find config file
**Why it happens:** Writing to cwd instead of outputDir
**How to avoid:** Use `join(outputDir, '.aws-starter-config.json')` explicitly
**Warning signs:** Config file appears in tool directory instead of project directory

### Pitfall 5: Forgetting AWS Organizations Removal from cli.ts
**What goes wrong:** Wizard simplified but cli.ts still tries to run org setup
**Why it happens:** AWS Organizations setup code remains in runCreate()
**How to avoid:** Remove the entire `if (config.org?.enabled)` block from cli.ts
**Warning signs:** Code referencing org config that no longer exists

## Code Examples

Verified patterns from official sources:

### Simplified Wizard (wizard.ts)
```typescript
// Source: Current wizard.ts modified per requirements
import prompts from 'prompts';
import pc from 'picocolors';
import type { AuthConfig, ProjectConfig } from './types.js';
import { projectNamePrompt } from './prompts/project-name.js';
import { platformsPrompt } from './prompts/platforms.js';
import { authProviderPrompt, authFeaturesPrompt } from './prompts/auth.js';
import { featuresPrompt } from './prompts/features.js';
import { awsRegionPrompt } from './prompts/aws-config.js';
import { themePrompt } from './prompts/theme.js';
// REMOVED: All org-structure.ts imports

export async function runWizard(): Promise<ProjectConfig | null> {
  const response = await prompts(
    [
      projectNamePrompt,
      platformsPrompt,
      authProviderPrompt,
      authFeaturesPrompt,
      featuresPrompt,
      awsRegionPrompt,
      themePrompt
      // REMOVED: All org prompts
    ],
    {
      onCancel: () => {
        console.log(`\n${pc.red('x')} Setup cancelled`);
        process.exit(0);
      }
    }
  );

  // Validate all required fields present
  if (!response.projectName || !response.platforms?.length || !response.awsRegion || !response.brandColor) {
    return null;
  }

  // features defaults to empty array if all deselected
  if (!response.features) {
    response.features = [];
  }

  // Construct auth config with defaults
  const auth: AuthConfig = {
    provider: response.authProvider || 'none',
    features: response.authFeatures || [],
  };

  // REMOVED: Entire org config construction block

  const config: ProjectConfig = {
    projectName: response.projectName,
    platforms: response.platforms,
    awsRegion: response.awsRegion,
    features: response.features,
    brandColor: response.brandColor,
    auth,
    // REMOVED: org field assignment
  };

  return config;
}
```

### Config File Write (cli.ts addition)
```typescript
// Source: Node.js fs documentation + existing patterns
import { writeFileSync } from 'node:fs';

/**
 * Config file structure for .aws-starter-config.json
 */
interface AwsStarterConfig {
  projectName: string;
  platforms: string[];
  authProvider: string;
  features: string[];
  awsRegion: string;
  theme: string;
  createdAt: string;
  accounts: Record<string, string>;
}

/**
 * Write project configuration file
 * Called after project generation, before next steps display
 */
function writeConfigFile(outputDir: string, config: ProjectConfig): void {
  const configContent: AwsStarterConfig = {
    projectName: config.projectName,
    platforms: config.platforms,
    authProvider: config.auth.provider,
    features: config.features,
    awsRegion: config.awsRegion,
    theme: config.brandColor,
    createdAt: new Date().toISOString(),
    accounts: {},
  };

  const configPath = join(outputDir, '.aws-starter-config.json');
  writeFileSync(configPath, JSON.stringify(configContent, null, 2), 'utf-8');
}
```

### Updated runCreate Flow (cli.ts)
```typescript
// Source: Current cli.ts modified per requirements
async function runCreate(_args: string[]): Promise<void> {
  printWelcome();
  console.log('');

  const config = await runWizard();

  if (!config) {
    console.log('\nProject creation cancelled.');
    process.exit(1);
  }

  // REMOVED: Entire AWS Organizations setup block (if config.org?.enabled)

  const outputDir = resolve(process.cwd(), config.projectName);

  if (existsSync(outputDir)) {
    console.log('');
    console.log(pc.red('Error:') + ` Directory ${pc.cyan(config.projectName)} already exists.`);
    console.log('Please choose a different project name or remove the existing directory.');
    process.exit(1);
  }

  mkdirSync(outputDir, { recursive: true });

  console.log('');
  await generateProject(config, outputDir);

  // NEW: Write config file after project generation
  writeConfigFile(outputDir, config);

  console.log('');
  console.log(pc.green('x') + ` Created ${pc.bold(config.projectName)} successfully!`);

  printNextSteps(config.projectName, config.platforms);

  process.exit(0);
}
```

### Updated Next Steps (cli.ts)
```typescript
// Source: Current cli.ts printNextSteps modified per requirements
function printNextSteps(projectName: string, platforms: string[]): void {
  console.log('');
  console.log(pc.bold('Next steps:'));
  console.log('');
  console.log(`  ${pc.cyan('cd')} ${projectName}`);
  console.log(`  ${pc.cyan('npm install')}`);
  console.log('');

  if (platforms.includes('web')) {
    console.log(`  ${pc.gray('# Start web app')}`);
    console.log(`  ${pc.cyan('npm run web')}`);
    console.log('');
  }

  if (platforms.includes('mobile')) {
    console.log(`  ${pc.gray('# Start mobile app')}`);
    console.log(`  ${pc.cyan('npm run mobile')}`);
    console.log('');
  }

  if (platforms.includes('api')) {
    console.log(`  ${pc.gray('# Deploy API')}`);
    console.log(`  ${pc.cyan('npm run cdk:deploy')}`);
    console.log('');
  }

  // NEW: setup-aws-envs guidance at end
  console.log(`  ${pc.gray('# Configure AWS environments')}`);
  console.log(`  ${pc.cyan('npx create-aws-project setup-aws-envs')}`);
  console.log('');

  console.log(pc.gray('Happy coding!'));
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Wizard does org setup inline | Wizard generates config, setup-aws-envs runs later | v1.3 (this milestone) | Better error handling, optional org setup |
| No config file generated | .aws-starter-config.json created | v1.3 (this milestone) | Post-install commands can read project settings |
| Generic "Happy coding!" end | Specific setup-aws-envs guidance | v1.3 (this milestone) | Clear next action for deployment |

**Deprecated/outdated:**
- Inline AWS Organizations prompts in wizard (moved to setup-aws-envs command)
- setup-github command (replaced by initialize-github in Phase 4)

## Open Questions

Things that couldn't be fully resolved:

1. **configVersion field**
   - What we know: User decision in CONTEXT.md says "Claude's discretion"
   - What's unclear: Whether version bumps would require config migrations
   - Recommendation: Include `configVersion: "1.0"` field for future-proofing. Minimal cost, enables version checks later.

2. **accounts placeholder structure**
   - What we know: User decided empty placeholder should show structure
   - What's unclear: Exact shape - empty object `{}` vs named placeholders
   - Recommendation: Empty object `{}` with comment in documentation. Avoids misleading placeholders that look like real values.

3. **org-structure.ts file handling**
   - What we know: Will be unused after removing org prompts
   - What's unclear: Delete file or keep for future use
   - Recommendation: Delete file to avoid confusion. Can recreate if needed in setup-aws-envs phase.

## Sources

### Primary (HIGH confidence)
- Codebase analysis: `src/wizard.ts` - Current wizard implementation
- Codebase analysis: `src/cli.ts` - Current CLI flow and next steps
- Codebase analysis: `src/utils/project-context.ts` - Config file expectations
- Codebase analysis: `src/prompts/*.ts` - All prompt definitions

### Secondary (MEDIUM confidence)
- Phase 4 Research: Command routing patterns, config file name decision
- CONTEXT.md: User decisions on prompt order, config structure, messaging

### Tertiary (LOW confidence)
- None - all findings verified against codebase

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Using existing libraries, no new dependencies
- Architecture: HIGH - Simple modifications to existing files, patterns already established
- Pitfalls: HIGH - Identified from direct codebase analysis (test expectations, import cleanup)
- Code examples: HIGH - Derived directly from current codebase with specific modifications

**Research date:** 2026-01-21
**Valid until:** 2026-03-21 (60 days - stable, codebase-specific)

## Modification Checklist

Quick reference for planner:

### Files to Modify
1. `src/wizard.ts` - Remove org prompts and processing
2. `src/cli.ts` - Remove org setup, add config write, update next steps
3. `src/__tests__/wizard.spec.ts` - Update prompt count expectation (15 -> 7)

### Files to Potentially Remove
1. `src/prompts/org-structure.ts` - No longer used (optional, can keep)

### Files NOT to Modify
1. `src/types.ts` - OrgConfig already optional, keep for setup-aws-envs phase
2. `src/utils/project-context.ts` - Already expects config file
3. `src/generator/*` - No changes needed

### Imports to Remove from wizard.ts
```typescript
// Remove these imports:
import {
  enableOrgPrompt,
  orgNamePrompt,
  orgEnvironmentsPrompt,
  devEmailPrompt,
  stageEmailPrompt,
  prodEmailPrompt,
  qaEmailPrompt,
  sandboxEmailPrompt,
} from './prompts/org-structure.js';
```

### Imports to Remove from cli.ts
```typescript
// Remove these imports:
import {
  createOrganizationsClient,
  checkExistingOrganization,
  createOrganization,
  createEnvironmentAccounts,
} from './aws/organizations.js';
```
