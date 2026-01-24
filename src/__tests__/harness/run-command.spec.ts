import { describe, it, expect } from '@jest/globals';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import { runCommand } from './run-command.js';
import { withTempDir } from './temp-dir.js';

describe('runCommand', () => {
  it('succeeds with zero exit code', async () => {
    await withTempDir('test-harness-', async (dir) => {
      const result = await runCommand('node', ['--version'], dir);
      expect(result.success).toBe(true);
      expect(result.exitCode).toBe(0);
      expect(result.output).toContain('v');
    });
  });

  it('captures stdout', async () => {
    await withTempDir('test-harness-', async (dir) => {
      const result = await runCommand(
        'node',
        ['-e', "console.log('hello')"],
        dir
      );
      expect(result.success).toBe(true);
      expect(result.output).toContain('hello');
    });
  });

  it('returns failure for non-zero exit', async () => {
    await withTempDir('test-harness-', async (dir) => {
      const result = await runCommand('node', ['-e', 'process.exit(1)'], dir);
      expect(result.success).toBe(false);
      expect(result.exitCode).toBe(1);
    });
  });

  it('captures stderr on failure', async () => {
    await withTempDir('test-harness-', async (dir) => {
      const result = await runCommand(
        'node',
        ['-e', "console.error('err'); process.exit(1)"],
        dir
      );
      expect(result.success).toBe(false);
      expect(result.output).toContain('err');
    });
  });

  it('works in specified cwd', async () => {
    await withTempDir('test-harness-', async (dir) => {
      const testFile = join(dir, 'test.txt');
      await writeFile(testFile, 'test content');

      const result = await runCommand(
        'node',
        ['-e', "const fs = require('fs'); console.log(fs.readFileSync('test.txt', 'utf8'))"],
        dir
      );
      expect(result.success).toBe(true);
      expect(result.output).toContain('test content');
    });
  });
});
