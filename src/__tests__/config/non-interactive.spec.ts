import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Mock picocolors to avoid console output issues in tests
jest.unstable_mockModule('picocolors', () => ({
  __esModule: true,
  default: {
    red: (s: string) => s,
    green: (s: string) => s,
    blue: (s: string) => s,
    yellow: (s: string) => s,
    cyan: (s: string) => s,
    magenta: (s: string) => s,
    bold: (s: string) => s,
    dim: (s: string) => s,
  },
}));

// Dynamic import after mocking
const { loadNonInteractiveConfig } = await import('../../config/non-interactive.js');

// Helper to write a temp config file and return its path
function writeTempConfig(content: unknown): string {
  const tmpFile = join(tmpdir(), `non-interactive-test-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
  writeFileSync(tmpFile, typeof content === 'string' ? content : JSON.stringify(content));
  return tmpFile;
}

describe('loadNonInteractiveConfig', () => {
  beforeEach(() => {
    // Mock process.exit to throw so tests can catch exit calls
    jest.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit called');
    }) as () => never);

    // Suppress console.error output during tests
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  describe('schema defaults (NI-04)', () => {
    it('applies all defaults when only name is provided', () => {
      const tmpFile = writeTempConfig({ name: 'my-app' });

      const config = loadNonInteractiveConfig(tmpFile);

      expect(config.projectName).toBe('my-app');
      expect(config.platforms).toEqual(['web', 'api']);
      expect(config.auth.provider).toBe('none');
      expect(config.auth.features).toEqual([]);
      expect(config.features).toEqual(['github-actions', 'vscode-config']);
      expect(config.awsRegion).toBe('us-east-1');
      expect(config.brandColor).toBe('blue');
    });

    it('uses specified values when all fields provided', () => {
      const tmpFile = writeTempConfig({
        name: 'full-app',
        platforms: ['web', 'mobile', 'api'],
        auth: 'cognito',
        authFeatures: ['social-login', 'mfa'],
        features: ['github-actions'],
        region: 'eu-west-1',
        brandColor: 'purple',
      });

      const config = loadNonInteractiveConfig(tmpFile);

      expect(config.projectName).toBe('full-app');
      expect(config.platforms).toEqual(['web', 'mobile', 'api']);
      expect(config.auth.provider).toBe('cognito');
      expect(config.auth.features).toEqual(['social-login', 'mfa']);
      expect(config.features).toEqual(['github-actions']);
      expect(config.awsRegion).toBe('eu-west-1');
      expect(config.brandColor).toBe('purple');
    });
  });

  describe('schema validation (NI-05)', () => {
    it('exits with error when name is missing', () => {
      const tmpFile = writeTempConfig({});

      expect(() => loadNonInteractiveConfig(tmpFile)).toThrow('process.exit called');
      expect(process.exit).toHaveBeenCalledWith(1);
      expect(console.error).toHaveBeenCalledWith(expect.stringContaining('name'));
    });

    it('exits with error when name is empty string', () => {
      const tmpFile = writeTempConfig({ name: '' });

      expect(() => loadNonInteractiveConfig(tmpFile)).toThrow('process.exit called');
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('exits with error for invalid platform value', () => {
      const tmpFile = writeTempConfig({ name: 'x', platforms: ['invalid'] });

      expect(() => loadNonInteractiveConfig(tmpFile)).toThrow('process.exit called');
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('exits with error for invalid auth provider', () => {
      const tmpFile = writeTempConfig({ name: 'x', auth: 'firebase' });

      expect(() => loadNonInteractiveConfig(tmpFile)).toThrow('process.exit called');
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('exits with error for invalid region', () => {
      const tmpFile = writeTempConfig({ name: 'x', region: 'mars-1' });

      expect(() => loadNonInteractiveConfig(tmpFile)).toThrow('process.exit called');
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('exits with error for invalid brand color', () => {
      const tmpFile = writeTempConfig({ name: 'x', brandColor: 'red' });

      expect(() => loadNonInteractiveConfig(tmpFile)).toThrow('process.exit called');
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('reports multiple validation failures at once', () => {
      const tmpFile = writeTempConfig({
        // name missing AND multiple invalid fields
        platforms: ['bad'],
        auth: 'bad',
        region: 'bad',
      });

      expect(() => loadNonInteractiveConfig(tmpFile)).toThrow('process.exit called');
      expect(process.exit).toHaveBeenCalledWith(1);
      // At least 3 distinct error calls for the 3+ failing fields
      expect((console.error as jest.Mock).mock.calls.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('auth normalization', () => {
    it('silently drops authFeatures when auth is none', () => {
      const tmpFile = writeTempConfig({
        name: 'x',
        auth: 'none',
        authFeatures: ['social-login'],
      });

      const config = loadNonInteractiveConfig(tmpFile);

      expect(config.auth.features).toEqual([]);
    });

    it('preserves authFeatures when auth is cognito', () => {
      const tmpFile = writeTempConfig({
        name: 'x',
        auth: 'cognito',
        authFeatures: ['mfa'],
      });

      const config = loadNonInteractiveConfig(tmpFile);

      expect(config.auth.features).toEqual(['mfa']);
    });
  });

  describe('file errors', () => {
    it('exits with error for non-existent file', () => {
      expect(() => loadNonInteractiveConfig('/nonexistent/path.json')).toThrow('process.exit called');
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('exits with error for invalid JSON', () => {
      const tmpFile = writeTempConfig('not json {{{');

      expect(() => loadNonInteractiveConfig(tmpFile)).toThrow('process.exit called');
      expect(process.exit).toHaveBeenCalledWith(1);
    });
  });

  describe('project name validation', () => {
    it('exits with error for invalid npm package name', () => {
      // npm package names cannot have uppercase letters
      const tmpFile = writeTempConfig({ name: 'UPPERCASE' });

      expect(() => loadNonInteractiveConfig(tmpFile)).toThrow('process.exit called');
      expect(process.exit).toHaveBeenCalledWith(1);
    });
  });
});
