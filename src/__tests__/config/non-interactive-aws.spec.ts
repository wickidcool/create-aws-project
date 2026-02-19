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
const { loadSetupAwsEnvsConfig, deriveEnvironmentEmails } = await import(
  '../../config/non-interactive-aws.js'
);

// Helper to write a temp config file and return its path
function writeTempConfig(content: unknown): string {
  const tmpFile = join(
    tmpdir(),
    `non-interactive-aws-test-${Date.now()}-${Math.random().toString(36).slice(2)}.json`
  );
  writeFileSync(tmpFile, typeof content === 'string' ? content : JSON.stringify(content));
  return tmpFile;
}

describe('deriveEnvironmentEmails', () => {
  it('derives standard dev/stage/prod emails from a simple address', () => {
    const result = deriveEnvironmentEmails('owner@example.com', ['dev', 'stage', 'prod']);

    expect(result.dev).toBe('owner-dev@example.com');
    expect(result.stage).toBe('owner-stage@example.com');
    expect(result.prod).toBe('owner-prod@example.com');
  });

  it('handles plus alias emails', () => {
    const result = deriveEnvironmentEmails('user+tag@company.com', ['dev']);

    expect(result.dev).toBe('user+tag-dev@company.com');
  });

  it('handles subdomain emails', () => {
    const result = deriveEnvironmentEmails('admin@sub.example.com', ['dev']);

    expect(result.dev).toBe('admin-dev@sub.example.com');
  });

  it('returns an empty object for an empty environments array', () => {
    const result = deriveEnvironmentEmails('owner@example.com', []);

    expect(result).toEqual({});
  });
});

describe('loadSetupAwsEnvsConfig', () => {
  beforeEach(() => {
    // Mock process.exit to throw so tests can catch exit calls
    jest.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit called');
    }) as () => never);

    // Suppress console.error output during tests
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  describe('schema validation (valid configs)', () => {
    it('loads valid config with email field only', () => {
      const tmpFile = writeTempConfig({ email: 'owner@example.com' });

      const config = loadSetupAwsEnvsConfig(tmpFile);

      expect(config.email).toBe('owner@example.com');
    });

    it('strips unknown keys silently', () => {
      const tmpFile = writeTempConfig({ email: 'owner@example.com', unknown: 'value', extra: 42 });

      const config = loadSetupAwsEnvsConfig(tmpFile);

      expect(config.email).toBe('owner@example.com');
      expect((config as Record<string, unknown>).unknown).toBeUndefined();
      expect((config as Record<string, unknown>).extra).toBeUndefined();
    });
  });

  describe('schema validation (invalid configs)', () => {
    it('exits with error when email is missing', () => {
      const tmpFile = writeTempConfig({});

      expect(() => loadSetupAwsEnvsConfig(tmpFile)).toThrow('process.exit called');
      expect(process.exit).toHaveBeenCalledWith(1);
      expect(console.error).toHaveBeenCalledWith(expect.stringContaining('email'));
    });

    it('exits with error when email is empty string', () => {
      const tmpFile = writeTempConfig({ email: '' });

      expect(() => loadSetupAwsEnvsConfig(tmpFile)).toThrow('process.exit called');
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('exits with error when email has no @ sign', () => {
      const tmpFile = writeTempConfig({ email: 'notanemail' });

      expect(() => loadSetupAwsEnvsConfig(tmpFile)).toThrow('process.exit called');
      expect(process.exit).toHaveBeenCalledWith(1);
      expect(console.error).toHaveBeenCalledWith(expect.stringContaining('email'));
    });
  });

  describe('file errors', () => {
    it('exits with error for non-existent file', () => {
      expect(() => loadSetupAwsEnvsConfig('/nonexistent/path/aws-config.json')).toThrow(
        'process.exit called'
      );
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('exits with error for invalid JSON content', () => {
      const tmpFile = writeTempConfig('not json {{{');

      expect(() => loadSetupAwsEnvsConfig(tmpFile)).toThrow('process.exit called');
      expect(process.exit).toHaveBeenCalledWith(1);
    });
  });
});
