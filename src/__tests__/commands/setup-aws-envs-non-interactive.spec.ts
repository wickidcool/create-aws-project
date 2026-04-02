/**
 * Unit tests for runSetupAwsEnvsNonInteractive
 *
 * These tests prove:
 * - Invalid config throws (not process.exit)
 * - Missing project context throws (not process.exit)
 * - process.exit is never called on success
 * - Returns void on success
 * - AWS errors are thrown (not process.exit)
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';

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
// Mock: root-credentials
// ────────────────────────────────────────────────────────────────────────────
const mockDetectRootCredentials = jest.fn<() => Promise<unknown>>();
const mockCreateOrAdoptAdminUser = jest.fn<() => Promise<unknown>>();

jest.unstable_mockModule('../../aws/root-credentials.js', () => ({
  detectRootCredentials: mockDetectRootCredentials,
  createOrAdoptAdminUser: mockCreateOrAdoptAdminUser,
}));

// ────────────────────────────────────────────────────────────────────────────
// Mock: organizations
// ────────────────────────────────────────────────────────────────────────────
const mockCheckExistingOrganization = jest.fn<() => Promise<string | null>>();
const mockCreateOrganization = jest.fn<() => Promise<string>>();
const mockCreateAccount = jest.fn<() => Promise<unknown>>();
const mockWaitForAccountCreation = jest.fn<() => Promise<unknown>>();
const mockListOrganizationAccounts = jest.fn<() => Promise<unknown[]>>();

jest.unstable_mockModule('../../aws/organizations.js', () => ({
  createOrganizationsClient: jest.fn(() => ({})),
  checkExistingOrganization: mockCheckExistingOrganization,
  createOrganization: mockCreateOrganization,
  createAccount: mockCreateAccount,
  waitForAccountCreation: mockWaitForAccountCreation,
  listOrganizationAccounts: mockListOrganizationAccounts,
}));

// ────────────────────────────────────────────────────────────────────────────
// Mock: iam
// ────────────────────────────────────────────────────────────────────────────
const mockCreateOrAdoptDeploymentUser = jest.fn<() => Promise<unknown>>();
const mockCreateCDKDeploymentPolicy = jest.fn<() => Promise<string>>();
const mockAttachPolicyToUser = jest.fn<() => Promise<unknown>>();
const mockCreateAccessKey = jest.fn<() => Promise<unknown>>();

jest.unstable_mockModule('../../aws/iam.js', () => ({
  createIAMClient: jest.fn(() => ({})),
  createCrossAccountIAMClient: jest.fn(() => ({})),
  createOrAdoptDeploymentUser: mockCreateOrAdoptDeploymentUser,
  createCDKDeploymentPolicy: mockCreateCDKDeploymentPolicy,
  attachPolicyToUser: mockAttachPolicyToUser,
  createAccessKey: mockCreateAccessKey,
}));

// ────────────────────────────────────────────────────────────────────────────
// Mock: cdk-bootstrap
// ────────────────────────────────────────────────────────────────────────────
const mockBootstrapAllEnvironments = jest.fn<() => Promise<void>>();

jest.unstable_mockModule('../../aws/cdk-bootstrap.js', () => ({
  bootstrapAllEnvironments: mockBootstrapAllEnvironments,
}));

// ────────────────────────────────────────────────────────────────────────────
// Mock: initialize-github (should NOT be called)
// ────────────────────────────────────────────────────────────────────────────
const mockRunInitializeGitHub = jest.fn<() => Promise<void>>();

jest.unstable_mockModule('../../commands/initialize-github.js', () => ({
  runInitializeGitHub: mockRunInitializeGitHub,
}));

// ────────────────────────────────────────────────────────────────────────────
// Mock: AWS SDK clients (prevent real network calls)
// ────────────────────────────────────────────────────────────────────────────
/* eslint-disable @typescript-eslint/no-explicit-any */
jest.unstable_mockModule('@aws-sdk/client-iam', () => ({
  IAMClient: jest.fn(() => ({})),
}));

jest.unstable_mockModule('@aws-sdk/client-organizations', () => ({
  OrganizationsClient: jest.fn(() => ({})),
}));

jest.unstable_mockModule('@aws-sdk/credential-providers', () => ({
  fromTemporaryCredentials: jest.fn(() => ({})),
}));
/* eslint-enable @typescript-eslint/no-explicit-any */

// ────────────────────────────────────────────────────────────────────────────
// Mock: fs (to prevent real file I/O from updateConfig)
// ────────────────────────────────────────────────────────────────────────────
const mockReadFileSync = jest.fn<() => string>();
const mockWriteFileSync = jest.fn<() => void>();

jest.unstable_mockModule('node:fs', () => ({
  readFileSync: mockReadFileSync,
  writeFileSync: mockWriteFileSync,
}));

// ────────────────────────────────────────────────────────────────────────────
// Dynamic imports after all mocks are set up
// ────────────────────────────────────────────────────────────────────────────
const { runSetupAwsEnvsNonInteractive } = await import(
  '../../commands/setup-aws-envs.js'
);

// ────────────────────────────────────────────────────────────────────────────
// Test helpers
// ────────────────────────────────────────────────────────────────────────────
const VALID_CONFIG = { email: 'owner@example.com' };

const MOCK_PROJECT_CONTEXT = {
  configPath: '/fake/path/.aws-starter-config.json',
  projectRoot: '/fake/path',
  config: {
    projectName: 'test-project',
    awsRegion: 'us-east-1',
    platforms: [],
    accounts: {},
    deploymentUsers: {},
    deploymentCredentials: {},
  },
};

const FAKE_CONFIG_JSON = JSON.stringify({ projectName: 'test-project', awsRegion: 'us-east-1', platforms: [] });

function setupSuccessfulAwsMocks(): void {
  mockDetectProjectContext.mockResolvedValue(MOCK_PROJECT_CONTEXT);
  mockDetectRootCredentials.mockResolvedValue({ isRoot: false, arn: 'arn:aws:iam::123:user/test', accountId: '123', userId: 'test' });
  mockCheckExistingOrganization.mockResolvedValue('o-existing123');
  mockListOrganizationAccounts.mockResolvedValue([]);
  mockCreateOrAdoptDeploymentUser.mockResolvedValue({ userName: 'test-project-dev-deploy' });
  mockCreateCDKDeploymentPolicy.mockResolvedValue('arn:aws:iam::123:policy/test-policy');
  mockAttachPolicyToUser.mockResolvedValue(undefined);
  mockCreateAccessKey.mockResolvedValue({
    accessKeyId: 'AKIATEST',
    secretAccessKey: 'secrettest',
  });
  mockCreateAccount.mockResolvedValue({ requestId: 'req-123' });
  mockWaitForAccountCreation.mockResolvedValue({ accountId: '111111111111' });
  mockBootstrapAllEnvironments.mockResolvedValue(undefined);
  mockReadFileSync.mockReturnValue(FAKE_CONFIG_JSON);
  mockWriteFileSync.mockReturnValue(undefined);
}

describe('runSetupAwsEnvsNonInteractive', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Test 1: Throws on invalid config (missing email)
  // ──────────────────────────────────────────────────────────────────────────
  it('throws on invalid config with missing email', async () => {
    await expect(
      runSetupAwsEnvsNonInteractive({} as { email: string })
    ).rejects.toThrow(/Invalid config/i);
  });

  it('throws on invalid config with empty email', async () => {
    await expect(
      runSetupAwsEnvsNonInteractive({ email: '' })
    ).rejects.toThrow(/Invalid config/i);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Test 2: Throws on missing project context (not process.exit)
  // ──────────────────────────────────────────────────────────────────────────
  it('throws when detectProjectContext returns null', async () => {
    mockDetectProjectContext.mockResolvedValue(null);

    await expect(
      runSetupAwsEnvsNonInteractive(VALID_CONFIG)
    ).rejects.toThrow(/Not inside a project directory/i);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Test 3: Never calls process.exit
  // ──────────────────────────────────────────────────────────────────────────
  it('never calls process.exit on successful run', async () => {
    setupSuccessfulAwsMocks();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation(((_code?: any) => {
      throw new Error('process.exit was called unexpectedly');
    }) as typeof process.exit);

    try {
      await runSetupAwsEnvsNonInteractive(VALID_CONFIG);
    } finally {
      exitSpy.mockRestore();
    }

    expect(exitSpy).not.toHaveBeenCalled();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Test 4: Returns void on success
  // ──────────────────────────────────────────────────────────────────────────
  it('returns void (undefined) on successful run', async () => {
    setupSuccessfulAwsMocks();

    const result = await runSetupAwsEnvsNonInteractive(VALID_CONFIG);

    expect(result).toBeUndefined();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Test 5: Throws on AWS error (does not call process.exit)
  // ──────────────────────────────────────────────────────────────────────────
  it('throws when an AWS operation fails', async () => {
    mockDetectProjectContext.mockResolvedValue(MOCK_PROJECT_CONTEXT);
    mockDetectRootCredentials.mockResolvedValue({ isRoot: false, arn: 'arn:aws:iam::123:user/test', accountId: '123', userId: 'test' });
    mockCheckExistingOrganization.mockRejectedValue(
      Object.assign(new Error('Access denied'), { name: 'AccessDeniedException' })
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation(((_code?: any) => {
      throw new Error('process.exit was called unexpectedly');
    }) as typeof process.exit);

    try {
      await expect(
        runSetupAwsEnvsNonInteractive(VALID_CONFIG)
      ).rejects.toThrow('Access denied');
    } finally {
      exitSpy.mockRestore();
    }

    expect(exitSpy).not.toHaveBeenCalled();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Test 6: Never calls runInitializeGitHub
  // ──────────────────────────────────────────────────────────────────────────
  it('does not call runInitializeGitHub', async () => {
    setupSuccessfulAwsMocks();

    await runSetupAwsEnvsNonInteractive(VALID_CONFIG);

    expect(mockRunInitializeGitHub).not.toHaveBeenCalled();
  });
});
