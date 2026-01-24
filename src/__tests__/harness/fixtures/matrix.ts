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
 * Get a single configuration by name.
 * Throws if not found (fail-fast for typos).
 */
export function getConfigByName(name: string): TestConfiguration {
  const config = TEST_MATRIX.find(c => c.name === name);
  if (!config) {
    throw new Error(`Configuration "${name}" not found in TEST_MATRIX`);
  }
  return config;
}
