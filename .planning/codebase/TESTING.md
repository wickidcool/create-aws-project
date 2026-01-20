# Testing Patterns

**Analysis Date:** 2026-01-20

## Test Framework

**Runner:**
- Jest 30.2.0
- Config: `jest.config.ts` in project root

**Assertion Library:**
- Jest built-in expect from `@jest/globals`
- Matchers: toBe, toEqual, toThrow, not.toBe

**Run Commands:**
```bash
npm test                              # Run all tests
npm test -- --watch                   # Watch mode
npm test -- path/to/file.spec.ts     # Single file
npm run test:coverage                 # Coverage report
```

Note: Uses `--experimental-vm-modules` flag for ESM support in Jest.

## Test File Organization

**Location:**
- `src/__tests__/` directory with mirrored structure
- Not co-located with source files

**Naming:**
- `*.spec.ts` for all test files (not `.test.ts`)
- Mirror source file names: `replace-tokens.spec.ts`, `project-name.spec.ts`

**Structure:**
```
src/
  __tests__/
    generator.spec.ts              # Manifest and token tests
    wizard.spec.ts                 # Wizard prompt tests
    generator/
      replace-tokens.spec.ts       # Token replacement tests
    validation/
      project-name.spec.ts         # Validation tests
```

## Test Structure

**Suite Organization:**
```typescript
import { describe, it, expect } from '@jest/globals';

describe('ModuleName', () => {
  describe('functionName', () => {
    it('should handle valid input', () => {
      // arrange
      const input = 'test';

      // act
      const result = functionName(input);

      // assert
      expect(result).toBe(expected);
    });

    it('should handle error case', () => {
      const result = functionName(null);
      expect(result).not.toBe(true);
    });
  });
});
```

**Patterns:**
- Nested describe blocks for grouping (e.g., "valid names", "invalid names")
- One assertion focus per test (multiple expects OK)
- Explicit arrange/act/assert in complex tests

## Mocking

**Framework:**
- Jest built-in mocking
- `jest.mock()` for module mocking
- `jest.unstable_mockModule()` for ESM module mocking

**Patterns:**
```typescript
// ESM module mocking (for wizard tests)
jest.unstable_mockModule('prompts', () => ({
  default: jest.fn()
}));

// Dynamic import after mocking
const { runWizard } = await import('../wizard.js');
```

**What to Mock:**
- External libraries (prompts, picocolors)
- File system operations (when testing in isolation)

**What NOT to Mock:**
- Internal pure functions
- Token replacement logic (test directly)

## Fixtures and Factories

**Test Data:**
```typescript
// Factory function for test configs
function createMockConfig(overrides?: Partial<ProjectConfig>): ProjectConfig {
  return {
    projectName: 'test-project',
    platforms: ['web', 'api'],
    auth: { provider: 'cognito', features: [] },
    features: [],
    awsRegion: 'us-east-1',
    brandColor: 'blue',
    ...overrides
  };
}
```

**Location:**
- Factory functions: Defined in test file near usage
- Multi-line string fixtures: Inline in test for clarity

## Coverage

**Requirements:**
- No enforced coverage target
- Coverage tracked for awareness
- `templates/` directory excluded (contains unprocessed tokens)

**Configuration:**
- Coverage directory: `./coverage`
- testPathIgnorePatterns: `/node_modules/`, `/templates/`, `/dist/`

**View Coverage:**
```bash
npm run test:coverage
open coverage/lcov-report/index.html
```

## Test Types

**Unit Tests:**
- Test single functions in isolation
- Examples: `validation/project-name.spec.ts`, `generator/replace-tokens.spec.ts`
- Fast: Each test <100ms

**Integration Tests:**
- Test multiple modules together
- Examples: `generator.spec.ts` (manifest + token derivation)
- May use mock configs

**E2E Tests:**
- Not implemented
- CLI integration tested manually

## Common Patterns

**Async Testing:**
```typescript
it('should handle async prompt', async () => {
  const mockPrompts = jest.mocked(prompts);
  mockPrompts.mockResolvedValue({ projectName: 'test' });

  const result = await runWizard('test');
  expect(result).toBeDefined();
});
```

**Error Testing:**
```typescript
it('should reject invalid input', () => {
  const result = validateProjectName('My App');
  expect(result).not.toBe(true);
  expect(typeof result).toBe('string');
});

it('should return specific error message', () => {
  const result = validateProjectName('');
  expect(result).toBe('Project name is required');
});
```

**Token Replacement Testing:**
```typescript
it('should replace tokens in content', () => {
  const content = 'Hello {{PROJECT_NAME}}!';
  const tokens = { PROJECT_NAME: 'MyApp' };

  const result = replaceTokens(content, tokens);
  expect(result).toBe('Hello MyApp!');
});

it('should process conditional blocks', () => {
  const content = `// {{#if AUTH_COGNITO}}
import { Cognito } from './cognito';
// {{/if AUTH_COGNITO}}`;
  const tokens = { AUTH_COGNITO: 'true' };

  const result = replaceTokens(content, tokens);
  expect(result).toContain("import { Cognito }");
});
```

**Snapshot Testing:**
- Not used in this codebase
- Prefer explicit assertions for clarity

---

*Testing analysis: 2026-01-20*
*Update when test patterns change*
