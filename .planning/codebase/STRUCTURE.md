# Codebase Structure

**Analysis Date:** 2026-01-20

## Directory Layout

```
create-aws-starter-kit/
├── src/                    # TypeScript source code
│   ├── index.ts           # CLI entry point (shebang)
│   ├── cli.ts             # CLI orchestration
│   ├── wizard.ts          # Prompt aggregation
│   ├── types.ts           # Core domain types
│   ├── prompts/           # Individual prompt definitions
│   ├── validation/        # Input validation utilities
│   ├── templates/         # Template config & token processing
│   ├── generator/         # File generation logic
│   └── __tests__/         # Jest test suites
├── templates/              # Template source files (copied to projects)
│   ├── root/              # Shared root-level files
│   ├── packages/          # Shared code packages
│   ├── apps/              # Platform applications
│   ├── .github/           # GitHub Actions (optional)
│   └── .vscode/           # VSCode config (optional)
├── dist/                   # Compiled JavaScript output
├── package.json           # Project manifest
├── tsconfig.json          # TypeScript config
├── jest.config.ts         # Jest config
└── eslint.config.js       # ESLint config
```

## Directory Purposes

**src/**
- Purpose: TypeScript source code for the CLI tool
- Contains: All business logic, prompts, validation, generation
- Key files: `index.ts`, `cli.ts`, `wizard.ts`, `types.ts`
- Subdirectories: `prompts/`, `validation/`, `templates/`, `generator/`, `__tests__/`

**src/prompts/**
- Purpose: Individual prompt definitions for the wizard
- Contains: PromptObject exports for each user input
- Key files: `project-name.ts`, `platforms.ts`, `auth.ts`, `features.ts`, `aws-config.ts`, `theme.ts`

**src/validation/**
- Purpose: Input validation utilities
- Contains: Validation functions for user input
- Key files: `project-name.ts`

**src/templates/**
- Purpose: Template configuration and token processing
- Contains: Token constants, manifest definitions, type definitions
- Key files: `tokens.ts`, `types.ts`, `manifest.ts`, `index.ts`

**src/generator/**
- Purpose: Core file generation logic
- Contains: File copying, token replacement, conditional processing
- Key files: `generate-project.ts`, `copy-file.ts`, `replace-tokens.ts`, `index.ts`

**src/__tests__/**
- Purpose: Jest test suites
- Contains: Unit and integration tests
- Subdirectories: `generator/`, `validation/`

**templates/**
- Purpose: Template source files copied to generated projects
- Contains: All files with `{{TOKEN}}` placeholders
- Key subdirs: `root/`, `packages/`, `apps/`

**templates/apps/**
- Purpose: Platform-specific applications
- Contains: `web/` (React+Vite), `mobile/` (React Native+Expo), `api/` (Lambda+CDK)

## Key File Locations

**Entry Points:**
- `src/index.ts` - CLI entry point (shebang `#!/usr/bin/env node`)
- `src/cli.ts` - Main CLI orchestration (`run()` function)
- `src/wizard.ts` - Prompt aggregation (`runWizard()` function)

**Configuration:**
- `tsconfig.json` - TypeScript compiler options
- `tsconfig.spec.json` - Test TypeScript config
- `jest.config.ts` - Jest test runner config
- `eslint.config.js` - ESLint config
- `.nvmrc` - Node version (22.16.0)
- `.npmrc` - npm config (legacy-peer-deps)

**Core Logic:**
- `src/types.ts` - ProjectConfig, AuthConfig, Feature, BrandColor, AuthProvider
- `src/templates/manifest.ts` - Template structure and `deriveTokenValues()`
- `src/generator/generate-project.ts` - Main generation orchestrator
- `src/generator/replace-tokens.ts` - Token and conditional processing

**Testing:**
- `src/__tests__/generator.spec.ts` - Manifest and token derivation tests
- `src/__tests__/wizard.spec.ts` - Wizard prompt tests
- `src/__tests__/generator/replace-tokens.spec.ts` - Token replacement tests
- `src/__tests__/validation/project-name.spec.ts` - Validation tests

## Naming Conventions

**Files:**
- kebab-case for all TypeScript files: `project-name.ts`, `replace-tokens.ts`
- `*.spec.ts` for test files (not `.test.ts`)
- `index.ts` for barrel exports

**Directories:**
- kebab-case: `common-types`, `api-client`
- Plural for collections: `prompts/`, `templates/`, `packages/`, `apps/`

**Special Patterns:**
- `__tests__/` for test directories (Jest convention)
- `.js` extensions in imports (ESM requirement)

## Where to Add New Code

**New Prompt:**
- Implementation: `src/prompts/{name}.ts`
- Integration: Import in `src/wizard.ts`
- Tests: `src/__tests__/wizard.spec.ts`

**New Validation:**
- Implementation: `src/validation/{name}.ts`
- Usage: Import in relevant prompt file
- Tests: `src/__tests__/validation/{name}.spec.ts`

**New Token:**
- Definition: `src/templates/tokens.ts` (add to TOKENS object)
- Derivation: `src/templates/manifest.ts` (add to `deriveTokenValues()`)
- Types: `src/templates/types.ts` (add to TokenValues)

**New Template Files:**
- Files: `templates/{category}/{path}`
- Manifest: Update `src/templates/manifest.ts`

**Utilities:**
- Shared helpers: `src/utils/` (create if needed)
- String utilities: Currently inline in `src/templates/manifest.ts`

## Special Directories

**dist/**
- Purpose: Compiled JavaScript and TypeScript declarations
- Source: Generated by `npm run build` (tsc)
- Committed: No (in .gitignore)

**templates/**
- Purpose: Template source files with `{{TOKEN}}` placeholders
- Source: Manually maintained
- Committed: Yes
- Note: Contains unprocessed tokens, excluded from test coverage

**node_modules/**
- Purpose: npm dependencies
- Committed: No (in .gitignore)

---

*Structure analysis: 2026-01-20*
*Update when directory structure changes*
