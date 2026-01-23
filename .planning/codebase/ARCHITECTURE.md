# Architecture

**Analysis Date:** 2026-01-20

## Pattern Overview

**Overall:** Layered CLI Scaffolding Application with Template Engine

**Key Characteristics:**
- Single-purpose CLI tool (project generator)
- Template-based file generation with token substitution
- Interactive wizard for configuration
- No persistent state or backend

## Layers

**CLI Entry Layer:**
- Purpose: Parse command-line arguments, show help/version, invoke wizard
- Contains: Argument parsing, error handling, post-generation messaging
- Location: `src/index.ts`, `src/cli.ts`
- Depends on: Configuration layer, Generation layer
- Used by: User via command line

**Configuration Layer:**
- Purpose: Gather user preferences through interactive prompts
- Contains: Prompt definitions, validation logic, config aggregation
- Location: `src/wizard.ts`, `src/prompts/*.ts`, `src/validation/*.ts`, `src/types.ts`
- Depends on: prompts library, validation utilities
- Used by: CLI layer

**Template Transformation Layer:**
- Purpose: Convert user configuration into token values and manage template structure
- Contains: Token constants, manifest definitions, token derivation
- Location: `src/templates/tokens.ts`, `src/templates/types.ts`, `src/templates/manifest.ts`
- Depends on: Configuration types
- Used by: Generation layer

**File Generation Layer:**
- Purpose: Copy templates to output directory with token substitution
- Contains: File copying, directory traversal, token replacement, conditional processing
- Location: `src/generator/generate-project.ts`, `src/generator/copy-file.ts`, `src/generator/replace-tokens.ts`
- Depends on: Template layer, Node.js fs module
- Used by: CLI layer

## Data Flow

**CLI Command Execution:**

1. User runs: `npx create-aws-project my-project`
2. `src/index.ts` → `src/cli.ts:run()` - Parse args (--help, --version, or continue)
3. `src/wizard.ts:runWizard()` - Execute interactive prompts:
   - `projectNamePrompt` → validates via `validation/project-name.ts`
   - `platformsPrompt` → selects web|mobile|api
   - `authProviderPrompt` → selects cognito|auth0|none
   - `authFeaturesPrompt` → conditional on auth; selects social-login|mfa
   - `featuresPrompt` → selects github-actions|vscode-config
   - `awsRegionPrompt` → selects AWS region
   - `themePrompt` → selects brand color
4. Responses aggregated into `ProjectConfig` object
5. `cli.ts` validates config, resolves output directory
6. `generator/generate-project.ts:generateProject()`:
   - Calls `templates/manifest.ts:deriveTokenValues()` → transforms config to tokens
   - Copies shared templates with token replacement
   - Copies platform-specific templates (web, mobile, api)
   - Copies feature-specific templates (github-actions, vscode-config)
   - Copies auth-provider-specific templates (cognito, auth0)
7. Success message and next steps printed

**State Management:**
- File-based output only (creates project directory)
- No persistent state
- Each CLI invocation is independent

## Key Abstractions

**Token Pattern:**
- Purpose: Template placeholders using `{{TOKEN}}` syntax
- Examples: `{{PROJECT_NAME}}`, `{{AWS_REGION}}`, `{{AUTH_COGNITO}}`
- Pattern: Two-phase replacement (conditionals first, then tokens)
- Location: `src/templates/tokens.ts`, `src/generator/replace-tokens.ts`

**Template Manifest:**
- Purpose: Declarative mapping of template files to conditions
- Examples: `templateManifest.shared`, `templateManifest.byPlatform.web`
- Pattern: Enables conditional file inclusion based on user selections
- Location: `src/templates/manifest.ts`

**Prompt Objects:**
- Purpose: Encapsulate prompt configuration
- Examples: `projectNamePrompt`, `platformsPrompt`, `themePrompt`
- Pattern: Standalone exports, composable in wizard
- Location: `src/prompts/*.ts`

**ProjectConfig:**
- Purpose: Aggregate user input into typed configuration
- Examples: `config.platforms`, `config.auth.provider`, `config.features`
- Pattern: Single source of truth for generation
- Location: `src/types.ts`

## Entry Points

**CLI Entry:**
- Location: `src/index.ts`
- Triggers: User runs `npx create-aws-starter-kit` or global command
- Responsibilities: Shebang entry, delegates to `cli.run()`

**Main CLI Function:**
- Location: `src/cli.ts:run()`
- Triggers: Called from index.ts
- Responsibilities: Arg parsing, wizard orchestration, generation invocation, messaging

**Wizard Entry:**
- Location: `src/wizard.ts:runWizard()`
- Triggers: Called from cli.ts when no --help/--version
- Responsibilities: Execute prompts, aggregate responses into ProjectConfig

## Error Handling

**Strategy:** Throw exceptions, catch at CLI level, log and exit

**Patterns:**
- Validation errors return strings (prompt rejection)
- File errors use synchronous operations (crash on failure)
- Top-level catch in `index.ts` logs to stderr and exits with code 1

## Cross-Cutting Concerns

**Logging:**
- Console.log for normal output
- Console.error for errors
- picocolors for colored terminal output

**Validation:**
- `validate-npm-package-name` for project name validation
- Manual validation in wizard for user cancellation
- File existence checks before generation

**File Operations:**
- Synchronous operations throughout (acceptable for CLI context)
- Token replacement for text files
- Binary files copied as-is

---

*Architecture analysis: 2026-01-20*
*Update when major patterns change*
