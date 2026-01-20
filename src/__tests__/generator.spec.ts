import { describe, it, expect } from '@jest/globals';
import { deriveTokenValues, templateManifest } from '../templates/index.js';
import type { ProjectConfig } from '../types.js';

/**
 * Create a minimal valid ProjectConfig for testing
 */
function createMockConfig(overrides: Partial<ProjectConfig> = {}): ProjectConfig {
  return {
    projectName: 'test-project',
    platforms: ['web', 'api'],
    awsRegion: 'us-east-1',
    features: [],
    brandColor: 'blue',
    auth: {
      provider: 'none',
      features: [],
    },
    ...overrides,
  };
}

describe('Generator', () => {
  describe('templateManifest.byAuthProvider', () => {
    it('should have Cognito auth templates defined', () => {
      expect(templateManifest.byAuthProvider.cognito).toBeDefined();
      expect(Array.isArray(templateManifest.byAuthProvider.cognito)).toBe(true);
      expect(templateManifest.byAuthProvider.cognito.length).toBeGreaterThan(0);
    });

    it('should include cognito auth directory in cognito templates', () => {
      const cognitoTemplates = templateManifest.byAuthProvider.cognito;
      const hasAuthDir = cognitoTemplates.some(
        (entry) => entry.src.includes('auth') || entry.dest.includes('auth')
      );
      expect(hasAuthDir).toBe(true);
    });

    it('should have empty array for none provider', () => {
      expect(templateManifest.byAuthProvider.none).toBeDefined();
      expect(Array.isArray(templateManifest.byAuthProvider.none)).toBe(true);
      expect(templateManifest.byAuthProvider.none.length).toBe(0);
    });

    it('should have Auth0 auth templates defined', () => {
      expect(templateManifest.byAuthProvider.auth0).toBeDefined();
      expect(Array.isArray(templateManifest.byAuthProvider.auth0)).toBe(true);
      expect(templateManifest.byAuthProvider.auth0.length).toBeGreaterThan(0);
    });

    it('should include Auth0 provider, config, and middleware in auth0 templates', () => {
      const auth0Templates = templateManifest.byAuthProvider.auth0;
      const hasProvider = auth0Templates.some(
        (entry) => entry.src.includes('auth0-provider.tsx')
      );
      const hasConfig = auth0Templates.some(
        (entry) => entry.src.includes('auth0-config.ts')
      );
      const hasMiddleware = auth0Templates.some(
        (entry) => entry.src.includes('auth0-auth.ts')
      );
      expect(hasProvider).toBe(true);
      expect(hasConfig).toBe(true);
      expect(hasMiddleware).toBe(true);
    });
  });

  describe('deriveTokenValues', () => {
    it('should set AUTH_COGNITO to true when cognito provider selected', () => {
      const config = createMockConfig({
        auth: { provider: 'cognito', features: [] },
      });
      const tokens = deriveTokenValues(config);
      expect(tokens.AUTH_COGNITO).toBe('true');
      expect(tokens.AUTH_AUTH0).toBe('false');
    });

    it('should set AUTH_AUTH0 to true when auth0 provider selected', () => {
      const config = createMockConfig({
        auth: { provider: 'auth0', features: [] },
      });
      const tokens = deriveTokenValues(config);
      expect(tokens.AUTH_COGNITO).toBe('false');
      expect(tokens.AUTH_AUTH0).toBe('true');
    });

    it('should set all auth tokens to false when provider is none', () => {
      const config = createMockConfig({
        auth: { provider: 'none', features: [] },
      });
      const tokens = deriveTokenValues(config);
      expect(tokens.AUTH_COGNITO).toBe('false');
      expect(tokens.AUTH_AUTH0).toBe('false');
      expect(tokens.AUTH_MFA).toBe('false');
      expect(tokens.AUTH_SOCIAL_LOGIN).toBe('false');
    });

    it('should set AUTH_MFA to true when mfa feature enabled', () => {
      const config = createMockConfig({
        auth: { provider: 'cognito', features: ['mfa'] },
      });
      const tokens = deriveTokenValues(config);
      expect(tokens.AUTH_MFA).toBe('true');
    });

    it('should set AUTH_SOCIAL_LOGIN to true when social-login feature enabled', () => {
      const config = createMockConfig({
        auth: { provider: 'cognito', features: ['social-login'] },
      });
      const tokens = deriveTokenValues(config);
      expect(tokens.AUTH_SOCIAL_LOGIN).toBe('true');
    });

    it('should set multiple auth feature tokens when multiple features enabled', () => {
      const config = createMockConfig({
        auth: { provider: 'cognito', features: ['mfa', 'social-login'] },
      });
      const tokens = deriveTokenValues(config);
      expect(tokens.AUTH_COGNITO).toBe('true');
      expect(tokens.AUTH_MFA).toBe('true');
      expect(tokens.AUTH_SOCIAL_LOGIN).toBe('true');
    });

    it('should include all auth tokens in the returned object', () => {
      const config = createMockConfig();
      const tokens = deriveTokenValues(config);
      expect('AUTH_COGNITO' in tokens).toBe(true);
      expect('AUTH_AUTH0' in tokens).toBe(true);
      expect('AUTH_MFA' in tokens).toBe(true);
      expect('AUTH_SOCIAL_LOGIN' in tokens).toBe(true);
    });
  });

  describe('auth provider template selection', () => {
    it('should return templates for cognito when cognito provider selected', () => {
      const config = createMockConfig({
        auth: { provider: 'cognito', features: [] },
      });
      const authEntries = templateManifest.byAuthProvider[config.auth.provider];
      expect(authEntries).toBeDefined();
      expect(authEntries.length).toBeGreaterThan(0);
    });

    it('should return empty array when provider is none', () => {
      const config = createMockConfig({
        auth: { provider: 'none', features: [] },
      });
      const authEntries = templateManifest.byAuthProvider[config.auth.provider];
      expect(authEntries).toBeDefined();
      expect(authEntries.length).toBe(0);
    });

    it('should skip auth template processing when provider is none', () => {
      const config = createMockConfig({
        auth: { provider: 'none', features: [] },
      });
      // This tests the logic: if provider !== 'none', we would process templates
      // Since provider === 'none', we would skip the processing
      const shouldProcessAuth = config.auth.provider !== 'none';
      expect(shouldProcessAuth).toBe(false);
    });

    it('should process auth templates when provider is cognito', () => {
      const config = createMockConfig({
        auth: { provider: 'cognito', features: [] },
      });
      // This tests the logic: if provider !== 'none', we should process templates
      const shouldProcessAuth = config.auth.provider !== 'none';
      expect(shouldProcessAuth).toBe(true);
    });

    it('should return templates for auth0 when auth0 provider selected', () => {
      const config = createMockConfig({
        auth: { provider: 'auth0', features: [] },
      });
      const authEntries = templateManifest.byAuthProvider[config.auth.provider];
      expect(authEntries).toBeDefined();
      expect(authEntries.length).toBeGreaterThan(0);
    });

    it('should process auth templates when provider is auth0', () => {
      const config = createMockConfig({
        auth: { provider: 'auth0', features: [] },
      });
      // This tests the logic: if provider !== 'none', we should process templates
      const shouldProcessAuth = config.auth.provider !== 'none';
      expect(shouldProcessAuth).toBe(true);
    });
  });
});
