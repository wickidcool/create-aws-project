# Phase 12: Test Fixtures and Matrix - Research

**Researched:** 2026-01-24
**Domain:** TypeScript test fixtures, factory patterns, configuration matrix, tiered test execution
**Confidence:** HIGH

## Summary

This phase creates the configuration matrix and fixture factories for validating all 14 generated project configurations (7 platform combinations x 2 auth providers). The research focused on TypeScript factory patterns for test data, tier-based test execution strategies, and how to structure the matrix to ensure adequate coverage in PR workflows while reserving full matrix runs for releases.

The standard approach uses simple factory functions (not a library) that return typed `ProjectConfig` objects, with each configuration tagged by tier (smoke, core, full). The codebase already has a `createTestConfig()` pattern in existing tests that should be extended. Factories should be pure functions with optional parameter overrides for flexibility.

The project defines 14 configurations:
- **7 platform combinations:** web, mobile, api, web+mobile, web+api, mobile+api, web+mobile+api
- **2 auth providers:** cognito, auth0 (excluding 'none' for validation since it's the simplest path)

**Primary recommendation:** Create config factory functions in `src/__tests__/harness/fixtures.ts` that produce all 14 configurations with descriptive names and tier assignments. Core tier (4 configs) must cover every platform AND every auth provider for PR validation.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | 5.9.3 | Type-safe factory functions | Project already uses strict TypeScript; factories benefit from type checking |
| Jest | 30.2.0 | Test framework | Already in project, provides test organization and assertions |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| (none needed) | - | - | Simple factory functions don't require a library; the project's existing `ProjectConfig` type is sufficient |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Simple factory functions | Fishery library | Fishery adds ORM-like features not needed here; simple functions are clearer |
| Simple factory functions | Interface Forge | Over-engineered for 14 static configs; adds dependencies |
| Manual config objects | Factory functions | Factories reduce duplication and ensure type safety |

**Installation:**
```bash
# No additional packages needed
# Uses existing TypeScript and Jest
```

## Architecture Patterns

### Recommended Project Structure
```
src/__tests__/harness/
  fixtures/
    config-factories.ts     # Factory functions for ProjectConfig
    matrix.ts               # TEST_MATRIX array with tier tags
    index.ts                # Public exports
  temp-dir.ts               # Phase 10
  run-command.ts            # Phase 10
  validate-project.ts       # Phase 11
```

### Pattern 1: Config Factory Functions
**What:** Pure functions that return valid `ProjectConfig` objects with optional overrides
**When to use:** Creating test configurations with consistent defaults
**Example:**
```typescript
// Source: Project codebase pattern (generator.spec.ts)
import type { ProjectConfig, AuthProvider } from '../../../types.js';

/**
 * Create a base configuration with sensible defaults
 */
function createBaseConfig(overrides: Partial<ProjectConfig> = {}): ProjectConfig {
  return {
    projectName: 'test-project',
    platforms: ['web', 'api'],
    awsRegion: 'us-east-1',
    features: [],
    brandColor: 'blue',
    auth: { provider: 'none', features: [] },
    ...overrides,
  };
}

/**
 * Factory for web-only + cognito configuration
 */
export function createWebCognitoConfig(): ProjectConfig {
  return createBaseConfig({
    projectName: 'test-web-cognito',
    platforms: ['web'],
    auth: { provider: 'cognito', features: [] },
  });
}

/**
 * Factory for mobile-only + auth0 configuration
 */
export function createMobileAuth0Config(): ProjectConfig {
  return createBaseConfig({
    projectName: 'test-mobile-auth0',
    platforms: ['mobile'],
    auth: { provider: 'auth0', features: [] },
  });
}
```

### Pattern 2: Matrix Definition with Tiers
**What:** Array of test configurations with tier assignments for selective execution
**When to use:** Organizing configurations for CI tiered execution
**Example:**
```typescript
// Source: Project research (FEATURES.md pattern)
export type TestTier = 'smoke' | 'core' | 'full';

export interface TestConfiguration {
  /** Descriptive name for reporting (e.g., "web-api-cognito") */
  name: string;
  /** The actual ProjectConfig to generate and validate */
  config: ProjectConfig;
  /** Execution tier: smoke (fastest), core (PR), full (release) */
  tier: TestTier;
}

export const TEST_MATRIX: TestConfiguration[] = [
  // Smoke tier: minimal sanity check
  {
    name: 'web-api-cognito',
    tier: 'smoke',
    config: createWebApiCognitoConfig(),
  },

  // Core tier: coverage of all platforms and auth providers
  {
    name: 'web-cognito',
    tier: 'core',
    config: createWebCognitoConfig(),
  },
  {
    name: 'mobile-auth0',
    tier: 'core',
    config: createMobileAuth0Config(),
  },
  {
    name: 'api-cognito',
    tier: 'core',
    config: createApiCognitoConfig(),
  },

  // Full tier: all remaining configurations
  {
    name: 'web-auth0',
    tier: 'full',
    config: createWebAuth0Config(),
  },
  // ... remaining 9 configurations
];
```

### Pattern 3: Tier Selection Helpers
**What:** Utility functions to filter configurations by tier
**When to use:** Running different subsets in CI vs local development
**Example:**
```typescript
// Source: Pattern synthesis from tiered testing research
export function getConfigsByTier(tier: TestTier): TestConfiguration[] {
  switch (tier) {
    case 'smoke':
      // Only smoke-tagged configs (1 config)
      return TEST_MATRIX.filter(c => c.tier === 'smoke');
    case 'core':
      // Smoke + core configs (4-5 configs for PR)
      return TEST_MATRIX.filter(c => c.tier === 'smoke' || c.tier === 'core');
    case 'full':
      // All 14 configurations (release)
      return TEST_MATRIX;
  }
}

// Usage in tests or CI
const configs = getConfigsByTier(process.env.TEST_TIER as TestTier || 'core');
```

### Anti-Patterns to Avoid
- **Mutable shared fixtures:** Don't create a single config object that tests mutate. Each factory call should return a fresh object.
- **Complex factory libraries for static data:** 14 configurations don't need Fishery or similar. Simple functions are clearer.
- **Testing 'none' auth provider:** Excluding 'none' reduces matrix to 14 configs. 'none' is the simplest path and implicitly tested by other auth providers working.
- **Snapshot testing configurations:** Don't snapshot generated projects. Validate build/test success instead.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Type-safe config creation | Manual object literals everywhere | Factory functions with `ProjectConfig` type | Catches missing fields at compile time |
| Tier filtering | Custom filtering logic per test file | Centralized `getConfigsByTier()` | Single source of truth for tier definitions |
| Config naming | Ad-hoc string concatenation | Descriptive `name` field in `TestConfiguration` | Consistent naming for CI reporting |
| Platform combinations | Manual listing | Programmatic combination generation | Ensures all 7 combinations are covered |

**Key insight:** The project already has `ProjectConfig` types and existing test patterns. Extend these rather than introducing new patterns.

## Common Pitfalls

### Pitfall 1: Incomplete Core Tier Coverage
**What goes wrong:** Core tier misses a platform or auth provider, allowing broken configurations to pass PR checks
**Why it happens:** Optimizing for speed by reducing core tier too much
**How to avoid:**
- Core tier MUST include: at least one config with each platform (web, mobile, api) AND at least one config with each auth provider (cognito, auth0)
- Minimum 4 configurations: web+cognito, mobile+auth0, api+cognito, one multi-platform
**Warning signs:**
- PR passes but release workflow finds failures
- User reports broken mobile or auth0 configurations

### Pitfall 2: Tight Coupling Between Factory Functions
**What goes wrong:** Changing one factory breaks others because they share mutable state
**Why it happens:** Factories reference a shared "default config" object that gets mutated
**How to avoid:**
- Each factory should call `createBaseConfig()` which creates a fresh object
- Never mutate the returned config object
- Use spread operator for immutable merging: `{ ...base, ...overrides }`
**Warning signs:**
- Tests pass when run individually but fail when run together
- Order-dependent test failures

### Pitfall 3: Project Name Collisions
**What goes wrong:** Multiple configs use the same `projectName`, causing conflicts in generated directories
**Why it happens:** Copy-paste errors when creating factory functions
**How to avoid:**
- Include platform and auth in project name: `test-web-cognito`, `test-mobile-auth0`
- Add a test that verifies all config names in TEST_MATRIX are unique
**Warning signs:**
- Weird test failures about directories already existing
- Flaky tests in parallel execution

### Pitfall 4: Missing Tier Transitions
**What goes wrong:** Smoke passes but core fails because smoke doesn't exercise the same code paths
**Why it happens:** Smoke tier config is too different from core configs
**How to avoid:**
- Smoke config should be a representative "happy path" (e.g., web+api+cognito - the default selection)
- Core tier should include smoke config's tests plus edge cases
**Warning signs:**
- Smoke passes, core fails on the same CI run
- False confidence from green smoke checks

### Pitfall 5: Wrong Auth Features Array
**What goes wrong:** Factory creates config with invalid auth features for the provider
**Why it happens:** Auth features ('social-login', 'mfa') are only valid for cognito/auth0, not 'none'
**How to avoid:**
- When auth.provider is 'none', features array must be empty
- Validation: `if (config.auth.provider === 'none' && config.auth.features.length > 0) throw`
**Warning signs:**
- Generated projects have unexpected auth configuration
- Type errors at runtime not caught by TypeScript

## Code Examples

Verified patterns from project codebase and research:

### Complete Config Factory Module
```typescript
// src/__tests__/harness/fixtures/config-factories.ts
import type { ProjectConfig, AuthProvider, BrandColor } from '../../../types.js';

type Platform = 'web' | 'mobile' | 'api';

interface ConfigOverrides {
  projectName?: string;
  platforms?: Platform[];
  awsRegion?: string;
  features?: ('github-actions' | 'vscode-config')[];
  brandColor?: BrandColor;
  authProvider?: AuthProvider;
  authFeatures?: ('social-login' | 'mfa')[];
}

/**
 * Create a base configuration with sensible defaults
 * All factories should call this to ensure consistent structure
 */
function createBaseConfig(overrides: ConfigOverrides = {}): ProjectConfig {
  const authProvider = overrides.authProvider ?? 'cognito';
  return {
    projectName: overrides.projectName ?? 'test-project',
    platforms: overrides.platforms ?? ['web', 'api'],
    awsRegion: overrides.awsRegion ?? 'us-east-1',
    features: overrides.features ?? [],
    brandColor: overrides.brandColor ?? 'blue',
    auth: {
      provider: authProvider,
      features: authProvider === 'none' ? [] : (overrides.authFeatures ?? []),
    },
  };
}

// Single platform factories
export const createWebCognitoConfig = (): ProjectConfig =>
  createBaseConfig({ projectName: 'test-web-cognito', platforms: ['web'], authProvider: 'cognito' });

export const createWebAuth0Config = (): ProjectConfig =>
  createBaseConfig({ projectName: 'test-web-auth0', platforms: ['web'], authProvider: 'auth0' });

export const createMobileCognitoConfig = (): ProjectConfig =>
  createBaseConfig({ projectName: 'test-mobile-cognito', platforms: ['mobile'], authProvider: 'cognito' });

export const createMobileAuth0Config = (): ProjectConfig =>
  createBaseConfig({ projectName: 'test-mobile-auth0', platforms: ['mobile'], authProvider: 'auth0' });

export const createApiCognitoConfig = (): ProjectConfig =>
  createBaseConfig({ projectName: 'test-api-cognito', platforms: ['api'], authProvider: 'cognito' });

export const createApiAuth0Config = (): ProjectConfig =>
  createBaseConfig({ projectName: 'test-api-auth0', platforms: ['api'], authProvider: 'auth0' });

// Double platform factories
export const createWebMobileCognitoConfig = (): ProjectConfig =>
  createBaseConfig({ projectName: 'test-web-mobile-cognito', platforms: ['web', 'mobile'], authProvider: 'cognito' });

export const createWebMobileAuth0Config = (): ProjectConfig =>
  createBaseConfig({ projectName: 'test-web-mobile-auth0', platforms: ['web', 'mobile'], authProvider: 'auth0' });

export const createWebApiCognitoConfig = (): ProjectConfig =>
  createBaseConfig({ projectName: 'test-web-api-cognito', platforms: ['web', 'api'], authProvider: 'cognito' });

export const createWebApiAuth0Config = (): ProjectConfig =>
  createBaseConfig({ projectName: 'test-web-api-auth0', platforms: ['web', 'api'], authProvider: 'auth0' });

export const createMobileApiCognitoConfig = (): ProjectConfig =>
  createBaseConfig({ projectName: 'test-mobile-api-cognito', platforms: ['mobile', 'api'], authProvider: 'cognito' });

export const createMobileApiAuth0Config = (): ProjectConfig =>
  createBaseConfig({ projectName: 'test-mobile-api-auth0', platforms: ['mobile', 'api'], authProvider: 'auth0' });

// Triple platform factories
export const createFullStackCognitoConfig = (): ProjectConfig =>
  createBaseConfig({ projectName: 'test-full-cognito', platforms: ['web', 'mobile', 'api'], authProvider: 'cognito' });

export const createFullStackAuth0Config = (): ProjectConfig =>
  createBaseConfig({ projectName: 'test-full-auth0', platforms: ['web', 'mobile', 'api'], authProvider: 'auth0' });
```

### Complete Matrix Definition
```typescript
// src/__tests__/harness/fixtures/matrix.ts
import type { ProjectConfig } from '../../../types.js';
import * as factories from './config-factories.js';

export type TestTier = 'smoke' | 'core' | 'full';

export interface TestConfiguration {
  name: string;
  config: ProjectConfig;
  tier: TestTier;
}

/**
 * Complete test matrix: 14 configurations (7 platforms x 2 auth providers)
 *
 * Tier assignments:
 * - smoke: 1 config (quick sanity check)
 * - core: 4 configs (PR validation - covers all platforms and auth providers)
 * - full: 9 configs (release validation - remaining combinations)
 */
export const TEST_MATRIX: TestConfiguration[] = [
  // === SMOKE TIER (1 config) ===
  // Most common configuration - web+api with cognito
  { name: 'web-api-cognito', tier: 'smoke', config: factories.createWebApiCognitoConfig() },

  // === CORE TIER (4 configs) ===
  // Ensures every platform and every auth provider is tested on PRs
  { name: 'web-cognito', tier: 'core', config: factories.createWebCognitoConfig() },
  { name: 'mobile-auth0', tier: 'core', config: factories.createMobileAuth0Config() },
  { name: 'api-cognito', tier: 'core', config: factories.createApiCognitoConfig() },
  { name: 'full-auth0', tier: 'core', config: factories.createFullStackAuth0Config() },

  // === FULL TIER (9 remaining configs) ===
  // All other combinations for release validation
  { name: 'web-auth0', tier: 'full', config: factories.createWebAuth0Config() },
  { name: 'mobile-cognito', tier: 'full', config: factories.createMobileCognitoConfig() },
  { name: 'api-auth0', tier: 'full', config: factories.createApiAuth0Config() },
  { name: 'web-mobile-cognito', tier: 'full', config: factories.createWebMobileCognitoConfig() },
  { name: 'web-mobile-auth0', tier: 'full', config: factories.createWebMobileAuth0Config() },
  { name: 'web-api-auth0', tier: 'full', config: factories.createWebApiAuth0Config() },
  { name: 'mobile-api-cognito', tier: 'full', config: factories.createMobileApiCognitoConfig() },
  { name: 'mobile-api-auth0', tier: 'full', config: factories.createMobileApiAuth0Config() },
  { name: 'full-cognito', tier: 'full', config: factories.createFullStackCognitoConfig() },
];

/**
 * Get configurations by tier (cumulative)
 * - 'smoke' returns smoke configs only (1)
 * - 'core' returns smoke + core configs (5)
 * - 'full' returns all configs (14)
 */
export function getConfigsByTier(tier: TestTier): TestConfiguration[] {
  switch (tier) {
    case 'smoke':
      return TEST_MATRIX.filter(c => c.tier === 'smoke');
    case 'core':
      return TEST_MATRIX.filter(c => c.tier === 'smoke' || c.tier === 'core');
    case 'full':
      return TEST_MATRIX;
  }
}

/**
 * Get a single configuration by name
 * Throws if not found (fail-fast for typos)
 */
export function getConfigByName(name: string): TestConfiguration {
  const config = TEST_MATRIX.find(c => c.name === name);
  if (!config) {
    throw new Error(`Configuration "${name}" not found in TEST_MATRIX`);
  }
  return config;
}
```

### Tests for Fixtures
```typescript
// src/__tests__/harness/fixtures/fixtures.spec.ts
import { describe, it, expect } from '@jest/globals';
import { TEST_MATRIX, getConfigsByTier, getConfigByName } from './matrix.js';
import type { ProjectConfig } from '../../../types.js';

describe('Test Fixtures', () => {
  describe('TEST_MATRIX', () => {
    it('should define exactly 14 configurations', () => {
      expect(TEST_MATRIX).toHaveLength(14);
    });

    it('should have unique names for all configurations', () => {
      const names = TEST_MATRIX.map(c => c.name);
      const uniqueNames = new Set(names);
      expect(uniqueNames.size).toBe(names.length);
    });

    it('should have unique project names for all configurations', () => {
      const projectNames = TEST_MATRIX.map(c => c.config.projectName);
      const uniqueNames = new Set(projectNames);
      expect(uniqueNames.size).toBe(projectNames.length);
    });

    it('should cover all 7 platform combinations', () => {
      const platformSets = TEST_MATRIX.map(c =>
        [...c.config.platforms].sort().join('+')
      );
      const uniquePlatforms = new Set(platformSets);
      expect(uniquePlatforms.size).toBe(7);
    });

    it('should cover both auth providers (cognito, auth0)', () => {
      const authProviders = TEST_MATRIX.map(c => c.config.auth.provider);
      const uniqueProviders = new Set(authProviders);
      expect(uniqueProviders).toContain('cognito');
      expect(uniqueProviders).toContain('auth0');
      expect(uniqueProviders).not.toContain('none');
    });
  });

  describe('getConfigsByTier', () => {
    it('should return 1 config for smoke tier', () => {
      const configs = getConfigsByTier('smoke');
      expect(configs).toHaveLength(1);
    });

    it('should return 5 configs for core tier (smoke + core)', () => {
      const configs = getConfigsByTier('core');
      expect(configs).toHaveLength(5);
    });

    it('should return all 14 configs for full tier', () => {
      const configs = getConfigsByTier('full');
      expect(configs).toHaveLength(14);
    });

    it('core tier should include at least one config per platform', () => {
      const configs = getConfigsByTier('core');
      const platforms = new Set<string>();
      for (const config of configs) {
        for (const platform of config.config.platforms) {
          platforms.add(platform);
        }
      }
      expect(platforms).toContain('web');
      expect(platforms).toContain('mobile');
      expect(platforms).toContain('api');
    });

    it('core tier should include at least one config per auth provider', () => {
      const configs = getConfigsByTier('core');
      const providers = new Set(configs.map(c => c.config.auth.provider));
      expect(providers).toContain('cognito');
      expect(providers).toContain('auth0');
    });
  });

  describe('getConfigByName', () => {
    it('should return config when name exists', () => {
      const config = getConfigByName('web-api-cognito');
      expect(config.name).toBe('web-api-cognito');
    });

    it('should throw when name does not exist', () => {
      expect(() => getConfigByName('nonexistent')).toThrow(
        'Configuration "nonexistent" not found in TEST_MATRIX'
      );
    });
  });

  describe('Config validity', () => {
    it.each(TEST_MATRIX)('$name should have valid ProjectConfig structure', ({ config }) => {
      // Required fields
      expect(config.projectName).toBeDefined();
      expect(config.platforms.length).toBeGreaterThan(0);
      expect(config.awsRegion).toBeDefined();
      expect(config.brandColor).toBeDefined();
      expect(config.auth.provider).toBeDefined();

      // Valid values
      expect(['web', 'mobile', 'api']).toEqual(
        expect.arrayContaining(config.platforms)
      );
      expect(['cognito', 'auth0', 'none']).toContain(config.auth.provider);
    });
  });
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| JSON fixture files | Factory functions | 2020+ | Type safety, flexibility, no file I/O |
| Heavy fixture libraries (factory_bot) | Lightweight TypeScript factories | 2022+ | Less overhead for static data |
| Single test tier | smoke/core/full tiers | Standard practice | Better CI/CD integration, faster feedback |
| Manual config enumeration | Systematic matrix | Standard practice | Ensures complete coverage |

**Deprecated/outdated:**
- **JSON fixture files:** Type-unsafe, require manual updates when types change
- **Heavy factory libraries:** Overkill for 14 static configurations

## Open Questions

Things that couldn't be fully resolved:

1. **Should factories accept overrides or be completely static?**
   - What we know: Static factories (no parameters) are simpler but less flexible
   - What's unclear: Will Phase 13/14 need to customize configs (e.g., different project names)?
   - Recommendation: Keep factories parameter-free for now. If customization needed, add `createBaseConfig` export for ad-hoc use.

2. **Should 'none' auth provider be tested?**
   - What we know: Project research says exclude 'none' for validation (simplest path)
   - What's unclear: Is 'none' implicitly tested or could it break independently?
   - Recommendation: Exclude 'none' from matrix. If it breaks, it would likely break cognito/auth0 first. Can add later if issues arise.

3. **How many configs in core tier?**
   - What we know: Must cover all 3 platforms and both auth providers
   - What's unclear: Is 4-5 configs the right balance between coverage and speed?
   - Recommendation: Start with 5 configs (1 smoke + 4 core). Adjust based on CI timing.

## Sources

### Primary (HIGH confidence)
- Project codebase: `src/__tests__/generator.spec.ts` - existing `createMockConfig()` pattern
- Project codebase: `src/types.ts` - `ProjectConfig` interface definition
- Project research: `.planning/research/FEATURES.md` - matrix definition and tier strategy
- Project research: `.planning/research/PITFALLS.md` - testing pitfalls

### Secondary (MEDIUM confidence)
- [TypeScript Factory Pattern with Parameters](https://copyprogramming.com/howto/typescript-factory-pattern-with-parameters) - Factory pattern best practices
- [Stepping up Our Test Fixture Game With Fishery](https://medium.com/leaselock-engineering/stepping-up-our-test-fixture-game-with-fishery-be22b76d1f22) - Factory vs fixtures rationale
- [Don't use fixtures in Cypress and unit tests - use factories](https://dev.to/dgreene1/don-t-use-fixtures-in-cypress-and-unit-tests-use-factories-5cnh) - Why factories over JSON fixtures
- [Smoke Testing Guide: Process, Tools & Best Practices](https://www.testingxperts.com/blog/smoke-testing/) - Tier strategy
- [CI/CD Test Automation: Key Strategies](https://testgrid.io/blog/ci-cd-test-automation/) - Pipeline integration

### Tertiary (LOW confidence)
- WebSearch results for tiered testing strategies - general patterns, verified against project requirements

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Uses existing project patterns, no new dependencies
- Architecture: HIGH - Patterns derived from project codebase and established practices
- Pitfalls: HIGH - Based on project research documents and ecosystem best practices

**Research date:** 2026-01-24
**Valid until:** 2026-02-24 (30 days - stable domain, patterns unlikely to change)
