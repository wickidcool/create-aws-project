# Phase 9: Generated Project Documentation - Research

**Researched:** 2026-01-23
**Domain:** README and documentation for generated Nx monorepo projects
**Confidence:** HIGH

## Summary

This phase adds documentation to the GENERATED PROJECT (output of `npx create-aws-project myapp`), not the CLI tool itself. The generated project currently has NO README or documentation files - users receive a fully-functional monorepo with zero guidance on how to use it.

Research confirms that generated projects should include a single comprehensive README.md file that uses the existing token templating system (`{{PROJECT_NAME}}`, etc.) to personalize content. The README should cover project structure, available commands, AWS setup workflow, and CI/CD pipeline documentation.

**Primary recommendation:** Create a single `templates/root/README.md` file with token placeholders that generates a personalized README for each project. Use conditional blocks (`{{#if PLATFORM}}`) for platform-specific sections. Do NOT create separate ARCHITECTURE.md or CONTRIBUTING.md files - a single README is sufficient for generated starter projects.

## Standard Stack

### Documentation Structure
| Component | Implementation | Purpose | Why Standard |
|-----------|----------------|---------|--------------|
| README.md | `templates/root/README.md` | Main project documentation | Single source of truth, follows npm/GitHub conventions |
| Token templating | `{{PROJECT_NAME}}`, `{{AWS_REGION}}` | Personalization | Existing system in copy-file.ts already supports this |
| Conditional blocks | `{{#if WEB}}` / `{{/if WEB}}` | Platform-specific content | Existing replace-tokens.ts supports this pattern |

### No Additional Files Needed
| What | Why Not Needed |
|------|----------------|
| ARCHITECTURE.md | Generated projects have predictable structure; include architecture in README |
| CONTRIBUTING.md | Starter projects don't need contribution guidelines |
| CHANGELOG.md | Each generated project starts fresh |
| docs/ folder | Overkill for starter kit; README suffices |

**Key insight:** Create-react-app, create-next-app, and similar generators include only a README.md in generated projects. Multi-file documentation is appropriate for libraries and frameworks, not starter kits.

## Architecture Patterns

### Recommended README Structure for Generated Projects

Based on README best practices and the specific needs of this monorepo:

```markdown
# {{PROJECT_NAME}}

## Quick Start
- npm install
- npm run web / npm run mobile
- npm run cdk:deploy

## Project Structure
- /apps/web - React + Vite web app
- /apps/mobile - React Native + Expo mobile app
- /apps/api - AWS Lambda + CDK API
- /packages/common-types - Shared TypeScript types
- /packages/api-client - Shared API client

## Available Commands
[Table of npm scripts with descriptions]

## AWS Setup
[Post-generation workflow: setup-aws-envs, initialize-github]

## CI/CD Workflows
[GitHub Actions explanation: pull-request, deploy-dev, deploy-stage, deploy-prod]

## Environment Variables
[.env.example documentation]

## Technology Stack
[Brief overview of frameworks used]
```

### Pattern 1: Token-Based Personalization

**What:** Use existing `{{TOKEN}}` system for dynamic content
**When to use:** Project name, AWS region, any user-selected values
**Example:**
```markdown
# {{PROJECT_NAME}}

A full-stack application deployed to AWS in **{{AWS_REGION}}**.

## Deploy to AWS
\`\`\`bash
npm run cdk:deploy  # Deploys to {{AWS_REGION}}
\`\`\`
```

**Source:** Existing `src/generator/copy-file.ts` - all `.md` files already receive token replacement (line 10: `const textExtensions = [..., '.md', ...]`).

### Pattern 2: Conditional Sections

**What:** Include/exclude sections based on selected platforms
**When to use:** Platform-specific documentation (web commands when web selected, etc.)
**Example:**
```markdown
## Available Commands

{{#if WEB}}
### Web App
| Command | Description |
|---------|-------------|
| `npm run web` | Start web development server |
| `npm run build:web` | Build web app for production |
{{/if WEB}}

{{#if MOBILE}}
### Mobile App
| Command | Description |
|---------|-------------|
| `npm run mobile` | Start Expo development server |
| `npm run mobile:ios` | Run on iOS simulator |
{{/if MOBILE}}
```

**Source:** Existing `src/generator/replace-tokens.ts` - plain conditional pattern supported (line 21-22).

### Pattern 3: Static Documentation for Shared Concepts

**What:** Document shared infrastructure regardless of platform selection
**When to use:** AWS setup, CI/CD, monorepo structure
**Example:** The AWS setup workflow (setup-aws-envs, initialize-github) applies to all generated projects and should NOT be conditional.

### Anti-Patterns to Avoid

- **Over-documentation:** Don't document every file - generated projects are self-explanatory to developers
- **Duplicating CLI README:** The generated README explains how to USE the project, not how to CREATE it
- **External links for basics:** npm commands, Nx basics should be self-contained, not linked
- **Version-specific docs:** Don't mention specific library versions in README (they'll go stale)

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Token replacement in README | Custom processing | Existing `copyFileWithTokens()` | `.md` already in textExtensions list |
| Conditional platform sections | Template variants | `{{#if TOKEN}}` blocks | Already supported by replace-tokens.ts |
| Multiple README files | Platform-specific READMEs | Single README with conditionals | Simpler, all info in one place |
| Documentation generation | Separate doc tool | Static markdown template | No build step needed |

**Key insight:** The existing templating system is fully capable of generating personalized, conditional documentation. No new infrastructure needed.

## Common Pitfalls

### Pitfall 1: Creating Token for Every Platform
**What goes wrong:** Adding `WEB: 'true'`, `MOBILE: 'true'`, `API: 'true'` tokens
**Why it happens:** Seems like the obvious way to enable conditionals
**How to avoid:** Check what tokens already exist - the system may already have platform flags or can derive them
**Warning signs:** Adding tokens that duplicate information from ProjectConfig

**Investigation needed:** Check if platform-specific tokens already exist in `src/templates/types.ts` and `src/templates/manifest.ts`.

### Pitfall 2: README Too Long
**What goes wrong:** Including every detail makes README overwhelming
**Why it happens:** Trying to be comprehensive
**How to avoid:** Focus on "getting started" - link to official docs for deep dives
**Warning signs:** README exceeds 300 lines

### Pitfall 3: Duplicating CLI README Content
**What goes wrong:** Generated project README repeats setup-aws-envs/initialize-github details already in CLI README
**Why it happens:** Want users to have all info they need
**How to avoid:** Generated README should reference the CLI for detailed troubleshooting, include only essential steps
**Warning signs:** Nearly identical sections in both READMEs

### Pitfall 4: Forgetting to Test All Platform Combinations
**What goes wrong:** README has broken conditionals or missing sections for certain platform combos
**Why it happens:** Only testing with all platforms selected
**How to avoid:** Test: web-only, mobile-only, api-only, web+api, web+mobile, all platforms
**Warning signs:** Empty sections or orphaned headers in generated README

## Code Examples

### Token Values Available

From `src/templates/types.ts`:
```typescript
export interface TokenValues {
  PROJECT_NAME: string;
  PROJECT_NAME_PASCAL: string;
  PROJECT_NAME_TITLE: string;
  AWS_REGION: string;
  PACKAGE_SCOPE: string;
  BRAND_COLOR: string;
  AUTH_COGNITO: string;     // 'true' or 'false'
  AUTH_AUTH0: string;       // 'true' or 'false'
  AUTH_SOCIAL_LOGIN: string;
  AUTH_MFA: string;
  ORG_ENABLED?: string;
  // ... account IDs
}
```

### Conditional Block Syntax

From `src/generator/replace-tokens.ts`:
```typescript
// Plain conditional (for markdown, yml, etc.):
// {{#if TOKEN}}
// ...content...
// {{/if TOKEN}}

// Comment-wrapped (for TypeScript, JavaScript):
// // {{#if TOKEN}}
// import { Something } from './something';
// // {{/if TOKEN}}
```

**Note:** For README.md, use the plain conditional syntax (no `//` prefix).

### manifest.json Entry

The README needs to be added to the manifest:
```json
{
  "shared": [
    { "src": "root/README.md", "dest": "README.md" },
    // ... existing entries
  ]
}
```

Source: `/Users/alwick/development/projects/create-aws-starter-kit/templates/manifest.json`

### Available npm Scripts (from generated package.json)

Key scripts users need to know about:
```
npm run web          - Start web dev server (port 3000)
npm run mobile       - Start Expo dev server
npm run mobile:ios   - Run on iOS simulator
npm run mobile:android - Run on Android emulator
npm run build:web    - Build web for production
npm run build:api    - Build Lambda functions
npm run test         - Run all tests
npm run test:coverage - Run tests with coverage
npm run lint         - Lint all projects
npm run cdk:deploy   - Deploy to AWS (dev)
npm run cdk:deploy:stage - Deploy to staging
npm run cdk:deploy:prod - Deploy to production
```

Source: `/Users/alwick/development/projects/create-aws-starter-kit/templates/root/package.json`

### GitHub Workflows in Generated Projects

| Workflow | Trigger | What It Does |
|----------|---------|--------------|
| `pull-request.yml` | Any PR | Lint, test, build validation |
| `deploy-dev.yml` | Push to main | Deploy to development environment |
| `deploy-stage.yml` | Manual | Deploy to staging environment |
| `deploy-prod.yml` | Manual | Deploy to production environment |

Source: `/Users/alwick/development/projects/create-aws-starter-kit/templates/.github/workflows/`

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| No documentation in generated projects | README.md with token templating | This phase | Users get immediate guidance |
| Separate setup docs | Integrated AWS setup section | This phase | Single reference point |

**Current state:**
- Generated projects have ZERO documentation files
- Users must reference CLI README or external docs
- No project-specific guidance on structure or commands

## Open Questions

1. **Platform-specific tokens**
   - What we know: TokenValues has auth-related boolean tokens (`AUTH_COGNITO`, etc.)
   - What's unclear: Are there existing platform tokens (`WEB`, `MOBILE`, `API`)?
   - Recommendation: Check deriveTokenValues() in manifest.ts - may need to add platform tokens

2. **GitHub workflows conditional inclusion**
   - What we know: `.github/` is in shared (always copied)
   - What's unclear: Should README section on CI/CD be conditional on `github-actions` feature?
   - Recommendation: If github-actions feature is off, .github/ isn't copied, so README section can be unconditional (users who have the workflows will see docs for them)

3. **Auth provider documentation**
   - What we know: Auth can be cognito, auth0, or none
   - What's unclear: Should README include auth-specific setup steps?
   - Recommendation: Keep auth section minimal in generated README - auth setup is complex enough to warrant separate exploration

## Sources

### Primary (HIGH confidence)
- `/Users/alwick/development/projects/create-aws-starter-kit/src/generator/copy-file.ts` - Token replacement for .md files confirmed
- `/Users/alwick/development/projects/create-aws-starter-kit/src/generator/replace-tokens.ts` - Conditional block syntax confirmed
- `/Users/alwick/development/projects/create-aws-starter-kit/src/templates/types.ts` - Available token values
- `/Users/alwick/development/projects/create-aws-starter-kit/templates/root/package.json` - Available npm scripts
- `/Users/alwick/development/projects/create-aws-starter-kit/templates/manifest.json` - Template structure
- `/Users/alwick/development/projects/create-aws-starter-kit/README.md` - CLI README structure (Phase 8 output)

### Secondary (MEDIUM confidence)
- [Make a README](https://www.makeareadme.com/) - README best practices
- [Nx Monorepo Documentation](https://nx.dev/docs/concepts/decisions/why-monorepos) - Monorepo patterns

### Tertiary (LOW confidence)
- WebSearch for create-next-app README patterns - general validation that single README is standard

## Metadata

**Confidence breakdown:**
- Documentation structure: HIGH - based on direct codebase analysis
- Token templating: HIGH - verified in source code
- Conditional syntax: HIGH - verified in replace-tokens.ts
- README content organization: MEDIUM - based on industry patterns

**Research date:** 2026-01-23
**Valid until:** This research remains valid as long as the templating system (copy-file.ts, replace-tokens.ts) is unchanged.

## Implementation Checklist

For the planner, here are the verified capabilities:

- [x] `.md` files receive token replacement (copy-file.ts line 10)
- [x] `{{#if TOKEN}}` blocks work in markdown (replace-tokens.ts line 21)
- [x] TokenValues interface defines available tokens (types.ts)
- [x] manifest.json controls which files are copied (manifest.json)
- [x] Root files go in `templates/root/` directory

**To implement:**
1. Create `templates/root/README.md` with token placeholders
2. Add entry to manifest.json shared array
3. May need to add platform tokens (`WEB`, `MOBILE`, `API`) to deriveTokenValues() for conditionals
4. Test with various platform combinations
