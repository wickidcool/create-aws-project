import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';

// Mock getAccessKeyCount from iam.ts
const mockGetAccessKeyCount = jest.fn<() => Promise<number>>();

jest.unstable_mockModule('../../aws/iam.js', () => ({
  getAccessKeyCount: mockGetAccessKeyCount,
}));

// Mock AWS SDK clients
/* eslint-disable @typescript-eslint/no-explicit-any */
const mockSTSSend = jest.fn<(command: any) => Promise<any>>();
const mockIAMSend = jest.fn<(command: any) => Promise<any>>();
/* eslint-enable @typescript-eslint/no-explicit-any */

/* eslint-disable @typescript-eslint/no-explicit-any */
jest.unstable_mockModule('@aws-sdk/client-sts', () => {
  class MockSTSClient {
    send = mockSTSSend;
  }
  return {
    STSClient: MockSTSClient,
    GetCallerIdentityCommand: jest.fn((input: any) => input),
  };
});

jest.unstable_mockModule('@aws-sdk/client-iam', () => {
  class MockIAMClient {
    send = mockIAMSend;
  }
  class NoSuchEntityException extends Error {
    constructor(message?: string) {
      super(message);
      this.name = 'NoSuchEntityException';
    }
  }
  return {
    IAMClient: MockIAMClient,
    CreateUserCommand: jest.fn((input: any) => input),
    GetUserCommand: jest.fn((input: any) => input),
    AttachUserPolicyCommand: jest.fn((input: any) => input),
    CreateAccessKeyCommand: jest.fn((input: any) => input),
    ListUserTagsCommand: jest.fn((input: any) => input),
    NoSuchEntityException,
  };
});
/* eslint-enable @typescript-eslint/no-explicit-any */

const {
  isRootUser,
  detectRootCredentials,
  retryWithBackoff,
  createOrAdoptAdminUser,
} = await import('../../aws/root-credentials.js');

describe('root-credentials', () => {
  describe('isRootUser', () => {
    it('returns true for root ARN', () => {
      expect(isRootUser('arn:aws:iam::123456789012:root')).toBe(true);
    });

    it('returns false for IAM user ARN', () => {
      expect(isRootUser('arn:aws:iam::123456789012:user/admin')).toBe(false);
    });

    it('returns false for different IAM user', () => {
      expect(isRootUser('arn:aws:iam::123456789012:user/deploy')).toBe(false);
    });

    it('returns false for assumed role ARN', () => {
      expect(isRootUser('arn:aws:sts::123456789012:assumed-role/role-name/session')).toBe(false);
    });

    it('returns false for empty string', () => {
      expect(isRootUser('')).toBe(false);
    });
  });

  describe('detectRootCredentials', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('detects root credentials correctly', async () => {
      mockSTSSend.mockResolvedValueOnce({
        Arn: 'arn:aws:iam::123456789012:root',
        Account: '123456789012',
        UserId: '123456789012',
      });

      const result = await detectRootCredentials('us-east-1');

      expect(result.arn).toBe('arn:aws:iam::123456789012:root');
      expect(result.accountId).toBe('123456789012');
      expect(result.userId).toBe('123456789012');
      expect(result.isRoot).toBe(true);
    });

    it('detects IAM user credentials correctly', async () => {
      mockSTSSend.mockResolvedValueOnce({
        Arn: 'arn:aws:iam::123456789012:user/admin',
        Account: '123456789012',
        UserId: 'AIDACKCEVSQ6C2EXAMPLE',
      });

      const result = await detectRootCredentials('us-east-1');

      expect(result.isRoot).toBe(false);
    });

    it('propagates errors from STS', async () => {
      mockSTSSend.mockRejectedValueOnce(new Error('Access denied'));

      await expect(detectRootCredentials('us-east-1')).rejects.toThrow('Access denied');
    });
  });

  describe('retryWithBackoff', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('returns result on first success', async () => {
      const fn = jest.fn<() => Promise<string>>().mockResolvedValue('success');

      const promise = retryWithBackoff(fn, { baseDelayMs: 10 });

      await jest.runAllTimersAsync();
      const result = await promise;

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('retries on failure and eventually succeeds', async () => {
      const fn = jest.fn<() => Promise<string>>()
        .mockRejectedValueOnce(new Error('Fail 1'))
        .mockRejectedValueOnce(new Error('Fail 2'))
        .mockResolvedValue('success');

      const promise = retryWithBackoff(fn, { baseDelayMs: 10, maxRetries: 5 });

      await jest.runAllTimersAsync();
      const result = await promise;

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('throws last error after all retries fail', async () => {
      const fn = jest.fn<() => Promise<string>>();
      fn.mockRejectedValue(new Error('Permanent failure'));

      const promise = retryWithBackoff(fn, { baseDelayMs: 10, maxRetries: 2 });
      jest.runAllTimersAsync();

      try {
        await promise;
        throw new Error('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe('Permanent failure');
      }
      expect(fn).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });

    it('respects maxRetries option', async () => {
      const fn = jest.fn<() => Promise<string>>();
      fn.mockRejectedValue(new Error('Always fails'));

      const promise = retryWithBackoff(fn, { baseDelayMs: 10, maxRetries: 3 });
      jest.runAllTimersAsync();

      try {
        await promise;
        throw new Error('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe('Always fails');
      }
      expect(fn).toHaveBeenCalledTimes(4); // Initial + 3 retries
    });
  });

  describe('createOrAdoptAdminUser', () => {
    beforeEach(() => {
      jest.clearAllMocks();
      mockGetAccessKeyCount.mockReset();
    });

    it('creates new admin user when user does not exist', async () => {
      // Import the mocked IAMClient and exception class
      const { IAMClient, NoSuchEntityException } = await import('@aws-sdk/client-iam');
      const mockIAMClient = new IAMClient({ region: 'us-east-1' });

      // Use the mocked NoSuchEntityException class
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const noSuchEntityError = new (NoSuchEntityException as any)('User does not exist');

      mockIAMSend
        .mockRejectedValueOnce(noSuchEntityError) // GetUserCommand throws
        .mockResolvedValueOnce({}) // CreateUserCommand succeeds
        .mockResolvedValueOnce({}) // AttachUserPolicyCommand succeeds
        .mockResolvedValueOnce({
          // CreateAccessKeyCommand succeeds
          AccessKey: {
            AccessKeyId: 'AKIAIOSFODNN7EXAMPLE',
            SecretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
          },
        });

      mockGetAccessKeyCount.mockResolvedValue(0);

      const result = await createOrAdoptAdminUser(mockIAMClient, 'test-project');

      expect(result.userName).toBe('test-project-admin');
      expect(result.accessKeyId).toBe('AKIAIOSFODNN7EXAMPLE');
      expect(result.secretAccessKey).toBe('wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY');
      expect(result.adopted).toBe(false);

      // Verify commands were called in order
      expect(mockIAMSend).toHaveBeenCalledTimes(4);
    });

    it('adopts existing managed user with no keys', async () => {
      const { IAMClient } = await import('@aws-sdk/client-iam');
      const mockIAMClient = new IAMClient({ region: 'us-east-1' });

      mockIAMSend
        .mockResolvedValueOnce({}) // GetUserCommand succeeds
        .mockResolvedValueOnce({
          // ListUserTagsCommand returns ManagedBy tag
          Tags: [
            { Key: 'ManagedBy', Value: 'create-aws-starter-kit' },
            { Key: 'Purpose', Value: 'CLI Admin' },
          ],
        })
        .mockResolvedValueOnce({
          // CreateAccessKeyCommand succeeds
          AccessKey: {
            AccessKeyId: 'AKIAIOSFODNN7EXAMPLE',
            SecretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
          },
        });

      mockGetAccessKeyCount.mockResolvedValue(0);

      const result = await createOrAdoptAdminUser(mockIAMClient, 'test-project');

      expect(result.userName).toBe('test-project-admin');
      expect(result.adopted).toBe(true);
      expect(mockIAMSend).toHaveBeenCalledTimes(3);
    });

    it('throws error when existing user is not managed by us', async () => {
      const { IAMClient } = await import('@aws-sdk/client-iam');
      const mockIAMClient = new IAMClient({ region: 'us-east-1' });

      mockIAMSend
        .mockResolvedValueOnce({}) // GetUserCommand succeeds
        .mockResolvedValueOnce({
          // ListUserTagsCommand returns different tag
          Tags: [{ Key: 'Owner', Value: 'SomeoneElse' }],
        });

      await expect(createOrAdoptAdminUser(mockIAMClient, 'test-project')).rejects.toThrow(
        'IAM user "test-project-admin" exists but was not created by this tool'
      );
    });

    it('throws error when existing managed user has keys', async () => {
      const { IAMClient } = await import('@aws-sdk/client-iam');
      const mockIAMClient = new IAMClient({ region: 'us-east-1' });

      mockIAMSend
        .mockResolvedValueOnce({}) // GetUserCommand succeeds
        .mockResolvedValueOnce({
          // ListUserTagsCommand returns ManagedBy tag
          Tags: [{ Key: 'ManagedBy', Value: 'create-aws-starter-kit' }],
        });

      mockGetAccessKeyCount.mockResolvedValue(1);

      await expect(createOrAdoptAdminUser(mockIAMClient, 'test-project')).rejects.toThrow(
        'IAM user "test-project-admin" already exists with 1 access key'
      );
    });
  });
});
