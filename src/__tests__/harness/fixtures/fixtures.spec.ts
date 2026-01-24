import { describe, it, expect } from '@jest/globals';
import { TEST_MATRIX, getConfigsByTier, getConfigByName } from './matrix.js';

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
      const platformSets = TEST_MATRIX.map(c => [...c.config.platforms].sort().join('+'));
      const uniquePlatforms = new Set(platformSets);
      expect(uniquePlatforms.size).toBe(7);
    });

    it('should cover both auth providers (cognito, auth0)', () => {
      const authProviders = TEST_MATRIX.map(c => c.config.auth.provider);
      const uniqueProviders = new Set(authProviders);
      expect(uniqueProviders).toContain('cognito');
      expect(uniqueProviders).toContain('auth0');
    });

    it('should not include auth provider none', () => {
      const authProviders = TEST_MATRIX.map(c => c.config.auth.provider);
      const uniqueProviders = new Set(authProviders);
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
      expect(['web', 'mobile', 'api']).toEqual(expect.arrayContaining(config.platforms));
      expect(['cognito', 'auth0', 'none']).toContain(config.auth.provider);
    });
  });
});
