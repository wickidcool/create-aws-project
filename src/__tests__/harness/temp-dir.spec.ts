import { describe, it, expect } from '@jest/globals';
import { existsSync } from 'fs';
import { withTempDir } from './temp-dir.js';

describe('withTempDir', () => {
  it('creates unique directory', async () => {
    await withTempDir('test-harness-', async (dir) => {
      expect(existsSync(dir)).toBe(true);
      expect(dir).toContain('test-harness-');
    });
  });

  it('cleans up after success', async () => {
    let tempPath = '';
    await withTempDir('test-harness-', async (dir) => {
      tempPath = dir;
      expect(existsSync(dir)).toBe(true);
    });
    expect(existsSync(tempPath)).toBe(false);
  });

  it('cleans up after error', async () => {
    let tempPath = '';
    await expect(
      withTempDir('test-harness-', async (dir) => {
        tempPath = dir;
        throw new Error('Test error');
      })
    ).rejects.toThrow('Test error');
    expect(existsSync(tempPath)).toBe(false);
  });

  it('returns callback result', async () => {
    const result = await withTempDir('test-harness-', async () => {
      return 'test-value';
    });
    expect(result).toBe('test-value');
  });

  it('concurrent calls create separate directories', async () => {
    const dirs = await Promise.all([
      withTempDir('test-harness-', async (dir) => dir),
      withTempDir('test-harness-', async (dir) => dir),
    ]);
    expect(dirs[0]).not.toBe(dirs[1]);
  });
});
