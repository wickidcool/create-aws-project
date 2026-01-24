import { describe, test, expect, jest, beforeEach } from '@jest/globals';
import type { ProjectConfig } from '../../types.js';

// Create typed mock functions
const mockWithTempDir = jest.fn<
  <T>(prefix: string, callback: (dir: string) => Promise<T>) => Promise<T>
>();

const mockRunCommand = jest.fn<
  (
    command: string,
    args: string[],
    cwd: string,
    timeout?: number
  ) => Promise<{
    success: boolean;
    exitCode: number;
    output: string;
    timedOut: boolean;
  }>
>();

const mockGenerateProject = jest.fn<
  (
    config: ProjectConfig,
    targetDir: string,
    options?: { onProgress?: () => void }
  ) => Promise<void>
>();

jest.unstable_mockModule('./temp-dir.js', () => ({
  withTempDir: mockWithTempDir,
}));

jest.unstable_mockModule('./run-command.js', () => ({
  runCommand: mockRunCommand,
}));

jest.unstable_mockModule('../../generator/generate-project.js', () => ({
  generateProject: mockGenerateProject,
}));

// Dynamic import after mocking
const { validateGeneratedProject } = await import('./validate-project.js');

function createTestConfig(): ProjectConfig {
  return {
    projectName: 'test-project',
    platforms: ['web'],
    awsRegion: 'us-east-1',
    features: [],
    brandColor: 'blue',
    auth: { provider: 'none', features: [] },
  };
}

describe('validateGeneratedProject', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default: withTempDir calls the callback with a fake directory
    mockWithTempDir.mockImplementation(async (prefix, callback) => {
      return callback('/tmp/fake-dir');
    });
    // Default: generateProject resolves successfully
    mockGenerateProject.mockResolvedValue(undefined);
  });

  test('returns success when all steps pass', async () => {
    // Mock all commands succeeding
    mockRunCommand.mockResolvedValue({
      success: true,
      exitCode: 0,
      output: 'success',
      timedOut: false,
    });

    const config = createTestConfig();
    const result = await validateGeneratedProject(config);

    expect(result.success).toBe(true);
    expect(result.steps).toHaveLength(3);
    expect(result.steps[0].step).toBe('install');
    expect(result.steps[1].step).toBe('build');
    expect(result.steps[2].step).toBe('test');
    expect(result.failedStep).toBeUndefined();
  });

  test('returns failure when npm ci fails', async () => {
    // First call (npm ci) fails, others succeed
    mockRunCommand
      .mockResolvedValueOnce({
        success: false,
        exitCode: 1,
        output: 'install failed',
        timedOut: false,
      })
      .mockResolvedValue({
        success: true,
        exitCode: 0,
        output: 'success',
        timedOut: false,
      });

    const config = createTestConfig();
    const result = await validateGeneratedProject(config);

    expect(result.success).toBe(false);
    expect(result.failedStep).toBe('install');
    expect(result.steps).toHaveLength(1);
    expect(result.steps[0].step).toBe('install');
    expect(result.steps[0].success).toBe(false);
  });

  test('returns failure when npm run build fails', async () => {
    // First call succeeds, second fails
    mockRunCommand
      .mockResolvedValueOnce({
        success: true,
        exitCode: 0,
        output: 'install success',
        timedOut: false,
      })
      .mockResolvedValueOnce({
        success: false,
        exitCode: 1,
        output: 'build failed',
        timedOut: false,
      })
      .mockResolvedValue({
        success: true,
        exitCode: 0,
        output: 'success',
        timedOut: false,
      });

    const config = createTestConfig();
    const result = await validateGeneratedProject(config);

    expect(result.success).toBe(false);
    expect(result.failedStep).toBe('build');
    expect(result.steps).toHaveLength(2);
    expect(result.steps[0].step).toBe('install');
    expect(result.steps[1].step).toBe('build');
    expect(result.steps[1].success).toBe(false);
  });

  test('returns failure when npm test fails', async () => {
    // First two succeed, third fails
    mockRunCommand
      .mockResolvedValueOnce({
        success: true,
        exitCode: 0,
        output: 'install success',
        timedOut: false,
      })
      .mockResolvedValueOnce({
        success: true,
        exitCode: 0,
        output: 'build success',
        timedOut: false,
      })
      .mockResolvedValueOnce({
        success: false,
        exitCode: 1,
        output: 'test failed',
        timedOut: false,
      });

    const config = createTestConfig();
    const result = await validateGeneratedProject(config);

    expect(result.success).toBe(false);
    expect(result.failedStep).toBe('test');
    expect(result.steps).toHaveLength(3);
    expect(result.steps[0].step).toBe('install');
    expect(result.steps[1].step).toBe('build');
    expect(result.steps[2].step).toBe('test');
    expect(result.steps[2].success).toBe(false);
  });

  test('tracks timedOut in step results', async () => {
    // Mock a timeout on the build step
    mockRunCommand
      .mockResolvedValueOnce({
        success: true,
        exitCode: 0,
        output: 'install success',
        timedOut: false,
      })
      .mockResolvedValueOnce({
        success: false,
        exitCode: 1,
        output: 'build timed out',
        timedOut: true,
      });

    const config = createTestConfig();
    const result = await validateGeneratedProject(config);

    expect(result.success).toBe(false);
    expect(result.failedStep).toBe('build');
    expect(result.steps).toHaveLength(2);
    expect(result.steps[1].timedOut).toBe(true);
  });

  test('passes timeout to runCommand', async () => {
    mockRunCommand.mockResolvedValue({
      success: true,
      exitCode: 0,
      output: 'success',
      timedOut: false,
    });

    const config = createTestConfig();
    const customTimeout = 300000; // 5 minutes
    await validateGeneratedProject(config, customTimeout);

    // Verify runCommand was called with the custom timeout
    expect(mockRunCommand).toHaveBeenCalledWith('npm', ['install'], '/tmp/fake-dir', customTimeout);
    expect(mockRunCommand).toHaveBeenCalledWith(
      'npm',
      ['run', 'build:all'],
      '/tmp/fake-dir',
      customTimeout
    );
    expect(mockRunCommand).toHaveBeenCalledWith('npm', ['test'], '/tmp/fake-dir', customTimeout);
  });

  test('calls generateProject with config and directory', async () => {
    mockRunCommand.mockResolvedValue({
      success: true,
      exitCode: 0,
      output: 'success',
      timedOut: false,
    });

    const config = createTestConfig();
    await validateGeneratedProject(config);

    // Verify generateProject was called with the config and temp dir
    expect(mockGenerateProject).toHaveBeenCalledWith(config, '/tmp/fake-dir', {
      onProgress: expect.any(Function),
    });
  });
});
