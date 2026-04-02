/**
 * Unit tests for runInitializeGitHubNonInteractive
 *
 * These tests prove:
 * - Missing GITHUB_TOKEN throws with actionable message referencing .mcp.json
 * - Invalid config throws (missing repoUrl)
 * - Missing project context throws (not process.exit)
 * - Successful run returns per-env success results
 * - Partial failures are captured (not thrown) — other envs still processed
 * - Envs without credentials are recorded as failures, not thrown
 * - setEnvironmentCredentials is called with GITHUB_ENV_NAMES (e.g. "Development" not "dev")
 * - process.exit is never called
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';

// ────────────────────────────────────────────────────────────────────────────
// Mock: project-context
// ────────────────────────────────────────────────────────────────────────────
const mockDetectProjectContext = jest.fn<() => Promise<unknown>>();

jest.unstable_mockModule('../../utils/project-context.js', () => ({
  detectProjectContext: mockDetectProjectContext,
  requireProjectContext: jest.fn(),
  CONFIG_FILE: '.aws-starter-config.json',
}));

// ────────────────────────────────────────────────────────────────────────────
// Mock: github/secrets
// ────────────────────────────────────────────────────────────────────────────
const mockCreateGitHubClient = jest.fn<() => object>();
const mockSetEnvironmentCredentials = jest.fn<
  (client: object, owner: string, repo: string, env: string, accessKeyId: string, secretAccessKey: string) => Promise<void>
>();
const mockParseGitHubUrl = jest.fn<() => { owner: string; repo: string }>();

jest.unstable_mockModule('../../github/secrets.js', () => ({
  createGitHubClient: mockCreateGitHubClient,
  setEnvironmentCredentials: mockSetEnvironmentCredentials,
  parseGitHubUrl: mockParseGitHubUrl,
  getRepositoryPublicKey: jest.fn(),
  getEnvironmentPublicKey: jest.fn(),
  setEnvironmentSecret: jest.fn(),
  setRepositorySecret: jest.fn(),
  ensureEnvironmentExists: jest.fn(),
  encryptSecret: jest.fn(),
}));

// ────────────────────────────────────────────────────────────────────────────
// Dynamic imports after all mocks are set up
// ────────────────────────────────────────────────────────────────────────────
const { runInitializeGitHubNonInteractive } = await import(
  '../../commands/initialize-github.js'
);

// ────────────────────────────────────────────────────────────────────────────
// Test helpers
// ────────────────────────────────────────────────────────────────────────────
const MOCK_CLIENT = {};

const MOCK_REPO_INFO = { owner: 'test-owner', repo: 'test-repo' };

const MOCK_CREDENTIALS = {
  dev: { userName: 'test-dev-deploy', accessKeyId: 'AKIADEV', secretAccessKey: 'secretdev' },
  stage: { userName: 'test-stage-deploy', accessKeyId: 'AKIASTAGE', secretAccessKey: 'secretstage' },
  prod: { userName: 'test-prod-deploy', accessKeyId: 'AKIAPROD', secretAccessKey: 'secretprod' },
};

const MOCK_PROJECT_CONTEXT = {
  configPath: '/fake/path/.aws-starter-config.json',
  projectRoot: '/fake/path',
  config: {
    projectName: 'test-project',
    awsRegion: 'us-east-1',
    platforms: [],
    accounts: {},
    deploymentUsers: {},
    deploymentCredentials: MOCK_CREDENTIALS,
  },
};

const VALID_CONFIG = { repoUrl: 'test-owner/test-repo' };

function setupSuccessfulMocks(): void {
  mockCreateGitHubClient.mockReturnValue(MOCK_CLIENT);
  mockParseGitHubUrl.mockReturnValue(MOCK_REPO_INFO);
  mockDetectProjectContext.mockResolvedValue(MOCK_PROJECT_CONTEXT);
  mockSetEnvironmentCredentials.mockResolvedValue(undefined);
}

describe('runInitializeGitHubNonInteractive', () => {
  const originalGitHubToken = process.env.GITHUB_TOKEN;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.GITHUB_TOKEN = 'ghp_testtoken123';
  });

  afterEach(() => {
    if (originalGitHubToken === undefined) {
      delete process.env.GITHUB_TOKEN;
    } else {
      process.env.GITHUB_TOKEN = originalGitHubToken;
    }
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Test 1: Throws on missing GITHUB_TOKEN
  // ──────────────────────────────────────────────────────────────────────────
  it('throws with actionable message when GITHUB_TOKEN is not set', async () => {
    delete process.env.GITHUB_TOKEN;

    await expect(
      runInitializeGitHubNonInteractive(VALID_CONFIG)
    ).rejects.toThrow('GITHUB_TOKEN');

    await expect(
      runInitializeGitHubNonInteractive(VALID_CONFIG)
    ).rejects.toThrow('.mcp.json');
  });

  it('throws when GITHUB_TOKEN is an empty string', async () => {
    process.env.GITHUB_TOKEN = '';

    await expect(
      runInitializeGitHubNonInteractive(VALID_CONFIG)
    ).rejects.toThrow('GITHUB_TOKEN');
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Test 2: Throws on invalid config (missing repoUrl)
  // ──────────────────────────────────────────────────────────────────────────
  it('throws on invalid config with missing repoUrl', async () => {
    await expect(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      runInitializeGitHubNonInteractive({} as any)
    ).rejects.toThrow(/Invalid config/i);
  });

  it('throws on invalid config with empty repoUrl', async () => {
    await expect(
      runInitializeGitHubNonInteractive({ repoUrl: '' })
    ).rejects.toThrow(/Invalid config/i);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Test 3: Throws on missing project context
  // ──────────────────────────────────────────────────────────────────────────
  it('throws when detectProjectContext returns null', async () => {
    mockDetectProjectContext.mockResolvedValue(null);
    mockParseGitHubUrl.mockReturnValue(MOCK_REPO_INFO);

    await expect(
      runInitializeGitHubNonInteractive(VALID_CONFIG)
    ).rejects.toThrow(/Not inside a project directory/i);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Test 4: Returns per-env success results when all succeed
  // ──────────────────────────────────────────────────────────────────────────
  it('returns successCount: 3, totalCount: 3 when all three envs succeed', async () => {
    setupSuccessfulMocks();

    const result = await runInitializeGitHubNonInteractive(VALID_CONFIG);

    expect(result.successCount).toBe(3);
    expect(result.totalCount).toBe(3);
    expect(result.results).toHaveLength(3);
    expect(result.results.every((r) => r.success)).toBe(true);
  });

  it('returns results with correct environment names', async () => {
    setupSuccessfulMocks();

    const result = await runInitializeGitHubNonInteractive(VALID_CONFIG);

    const envNames = result.results.map((r) => r.environment);
    expect(envNames).toContain('dev');
    expect(envNames).toContain('stage');
    expect(envNames).toContain('prod');
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Test 5: Handles partial failure — 2 succeed, 1 fails
  // ──────────────────────────────────────────────────────────────────────────
  it('captures partial failure without throwing — records failure and continues', async () => {
    setupSuccessfulMocks();

    // Fail stage, succeed dev and prod
    mockSetEnvironmentCredentials
      .mockResolvedValueOnce(undefined) // dev succeeds
      .mockRejectedValueOnce(new Error('API rate limit exceeded')) // stage fails
      .mockResolvedValueOnce(undefined); // prod succeeds

    const result = await runInitializeGitHubNonInteractive(VALID_CONFIG);

    expect(result.successCount).toBe(2);
    expect(result.totalCount).toBe(3);

    const stageResult = result.results.find((r) => r.environment === 'stage');
    expect(stageResult?.success).toBe(false);
    expect(stageResult?.error).toContain('API rate limit exceeded');

    const devResult = result.results.find((r) => r.environment === 'dev');
    expect(devResult?.success).toBe(true);

    const prodResult = result.results.find((r) => r.environment === 'prod');
    expect(prodResult?.success).toBe(true);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Test 6: Skips envs without credentials (records failure, doesn't throw)
  // ──────────────────────────────────────────────────────────────────────────
  it('records stage as failure with "No deployment credentials" when only dev creds exist', async () => {
    mockCreateGitHubClient.mockReturnValue(MOCK_CLIENT);
    mockParseGitHubUrl.mockReturnValue(MOCK_REPO_INFO);
    mockSetEnvironmentCredentials.mockResolvedValue(undefined);
    mockDetectProjectContext.mockResolvedValue({
      ...MOCK_PROJECT_CONTEXT,
      config: {
        ...MOCK_PROJECT_CONTEXT.config,
        deploymentCredentials: {
          dev: MOCK_CREDENTIALS.dev,
          // stage and prod have no credentials
        },
      },
    });

    const result = await runInitializeGitHubNonInteractive({
      repoUrl: 'test-owner/test-repo',
      environments: ['dev', 'stage'],
    });

    expect(result.totalCount).toBe(2);

    const devResult = result.results.find((r) => r.environment === 'dev');
    expect(devResult?.success).toBe(true);

    const stageResult = result.results.find((r) => r.environment === 'stage');
    expect(stageResult?.success).toBe(false);
    expect(stageResult?.error).toMatch(/No deployment credentials/i);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Test 7: Uses GITHUB_ENV_NAMES mapping (calls with "Development" not "dev")
  // ──────────────────────────────────────────────────────────────────────────
  it('calls setEnvironmentCredentials with "Development" for env "dev"', async () => {
    setupSuccessfulMocks();

    await runInitializeGitHubNonInteractive({
      repoUrl: 'test-owner/test-repo',
      environments: ['dev'],
    });

    expect(mockSetEnvironmentCredentials).toHaveBeenCalledWith(
      MOCK_CLIENT,
      'test-owner',
      'test-repo',
      'Development',
      MOCK_CREDENTIALS.dev.accessKeyId,
      MOCK_CREDENTIALS.dev.secretAccessKey
    );
  });

  it('calls setEnvironmentCredentials with "Staging" for env "stage"', async () => {
    setupSuccessfulMocks();

    await runInitializeGitHubNonInteractive({
      repoUrl: 'test-owner/test-repo',
      environments: ['stage'],
    });

    expect(mockSetEnvironmentCredentials).toHaveBeenCalledWith(
      MOCK_CLIENT,
      'test-owner',
      'test-repo',
      'Staging',
      MOCK_CREDENTIALS.stage.accessKeyId,
      MOCK_CREDENTIALS.stage.secretAccessKey
    );
  });

  it('calls setEnvironmentCredentials with "Production" for env "prod"', async () => {
    setupSuccessfulMocks();

    await runInitializeGitHubNonInteractive({
      repoUrl: 'test-owner/test-repo',
      environments: ['prod'],
    });

    expect(mockSetEnvironmentCredentials).toHaveBeenCalledWith(
      MOCK_CLIENT,
      'test-owner',
      'test-repo',
      'Production',
      MOCK_CREDENTIALS.prod.accessKeyId,
      MOCK_CREDENTIALS.prod.secretAccessKey
    );
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Test 8: Never calls process.exit
  // ──────────────────────────────────────────────────────────────────────────
  it('never calls process.exit on successful run', async () => {
    setupSuccessfulMocks();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation(((_code?: any) => {
      throw new Error('process.exit was called unexpectedly');
    }) as typeof process.exit);

    try {
      await runInitializeGitHubNonInteractive(VALID_CONFIG);
    } finally {
      exitSpy.mockRestore();
    }

    expect(exitSpy).not.toHaveBeenCalled();
  });

  it('never calls process.exit even when an env fails', async () => {
    setupSuccessfulMocks();
    mockSetEnvironmentCredentials.mockRejectedValue(new Error('Network error'));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation(((_code?: any) => {
      throw new Error('process.exit was called unexpectedly');
    }) as typeof process.exit);

    try {
      await runInitializeGitHubNonInteractive(VALID_CONFIG);
    } finally {
      exitSpy.mockRestore();
    }

    expect(exitSpy).not.toHaveBeenCalled();
  });
});
