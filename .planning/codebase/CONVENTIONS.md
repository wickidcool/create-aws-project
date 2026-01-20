# Coding Conventions

**Analysis Date:** 2026-01-20

## Naming Patterns

**Files:**
- kebab-case for all TypeScript files: `project-name.ts`, `replace-tokens.ts`, `copy-file.ts`
- `*.spec.ts` for test files (Jest convention)
- `index.ts` for barrel exports

**Functions:**
- camelCase for all functions: `validateProjectName()`, `replaceTokens()`, `deriveTokenValues()`
- No special prefix for async functions
- Descriptive names with verb prefixes: `copyFileWithTokens()`, `processConditionalBlocks()`

**Variables:**
- camelCase for variables: `projectName`, `outputDir`, `templatesDir`
- SCREAMING_SNAKE_CASE for constants: `TOKEN_PATTERN`, `COMMENT_CONDITIONAL_PATTERN`
- No underscore prefix for private (TypeScript private keyword instead)

**Types:**
- PascalCase for interfaces: `ProjectConfig`, `AuthConfig`, `GenerateOptions`
- PascalCase for type aliases: `Feature`, `BrandColor`, `AuthProvider`
- Union types use lowercase string literals: `'cognito' | 'auth0' | 'none'`

## Code Style

**Formatting:**
- 2 space indentation (consistent throughout)
- Semicolons required
- Single quotes for strings (convention, not enforced)
- No Prettier config (ESLint handles formatting)

**Linting:**
- ESLint with flat config (`eslint.config.js`)
- @typescript-eslint/recommended rules
- Unused variables must start with underscore (`argsIgnorePattern: '^_'`)
- Run: `npm run lint`, `npm run lint:fix`

**TypeScript:**
- Strict mode enabled (`strict: true`)
- ES2022 target
- NodeNext module resolution
- Declaration files generated

## Import Organization

**Order:**
1. Node.js built-ins (`node:fs`, `node:path`, `node:url`)
2. External packages (`prompts`, `picocolors`)
3. Internal modules (relative imports)
4. Type imports (`import type { }`)

**Grouping:**
- Blank line between groups
- `.js` extension required for local imports (ESM)

**Path Aliases:**
- None configured
- Relative imports used: `./wizard.js`, `../validation/project-name.js`

## Error Handling

**Patterns:**
- Validation functions return `true` or error string
- CLI uses process.exit(1) on failure
- Top-level catch in `index.ts` logs to stderr

**Error Types:**
- Validation errors: Return string message (prompt rejection)
- File errors: Synchronous operations may throw
- Cancellation: Return null from wizard

## Logging

**Framework:**
- Console.log for normal output
- Console.error for errors
- Console.warn for warnings

**Patterns:**
- picocolors for colored output (`pc.green()`, `pc.cyan()`, `pc.bold()`)
- Success messages in green
- Error messages to stderr
- No structured logging (CLI context)

## Comments

**When to Comment:**
- Explain why, not what
- Document regex patterns with examples
- JSDoc for public functions

**JSDoc/TSDoc:**
- Required for exported functions
- Use @param, @returns, @example tags
- Include usage examples for complex functions

**TODO Comments:**
- None found in current codebase (clean)
- Format if used: `// TODO: description`

## Function Design

**Size:**
- Keep functions focused and single-purpose
- Extract helpers for complex logic

**Parameters:**
- Use typed interfaces for complex parameters
- Destructure objects when accessing multiple properties
- Max 3-4 parameters before using options object

**Return Values:**
- Explicit return types
- `true | string` pattern for validation (success or error message)
- `null` for cancellation/abort scenarios

## Module Design

**Exports:**
- Named exports preferred
- Barrel files (`index.ts`) for public API
- One export per file for prompts

**Barrel Files:**
- `src/generator/index.ts` - Re-exports generator functions
- `src/templates/index.ts` - Re-exports tokens and types

**Module Pattern:**
- Each prompt is a standalone PromptObject export
- Each generator function is independently importable
- Types separated from implementation

---

*Convention analysis: 2026-01-20*
*Update when patterns change*
