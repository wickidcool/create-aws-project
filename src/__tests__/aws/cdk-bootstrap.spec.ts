import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// Mock execa
const mockExeca = jest.fn<
  (
    command: string,
    args: string[],
    options?: { all?: boolean; env?: Record<string, string> }
  ) => Promise<{ all?: string }>
>();

jest.unstable_mockModule('execa', () => ({
  execa: mockExeca,
}));

// Mock AWS SDK STS client
/* eslint-disable @typescript-eslint/no-explicit-any */
const mockSTSSend = jest.fn<(command: any) => Promise<any>>();
const mockAssumeRoleCommand = jest.fn<(input: any) => any>();
/* eslint-enable @typescript-eslint/no-explicit-any */

/* eslint-disable @typescript-eslint/no-explicit-any */
jest.unstable_mockModule('@aws-sdk/client-sts', () => {
  class MockSTSClient {
    send = mockSTSSend;
  }
  return {
    STSClient: MockSTSClient,
    AssumeRoleCommand: mockAssumeRoleCommand,
  };
});
/* eslint-enable @typescript-eslint/no-explicit-any */

// Mock ora (for spinner type)
const mockOra = {
  text: '',
  succeed: jest.fn(),
  fail: jest.fn(),
};

const { bootstrapCDKEnvironment, bootstrapAllEnvironments } = await import(
  '../../aws/cdk-bootstrap.js'
);

describe('cdk-bootstrap', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockOra.text = '';
    // Mock AssumeRoleCommand to return the input
    mockAssumeRoleCommand.mockImplementation((input) => input);
  });

  describe('bootstrapCDKEnvironment', () => {
    it('calls execa with correct npx cdk bootstrap command', async () => {
      mockExeca.mockResolvedValue({ all: 'Bootstrap successful' });

      await bootstrapCDKEnvironment({
        accountId: '123456789012',
        region: 'us-west-2',
        credentials: {
          accessKeyId: 'AKIATEST',
          secretAccessKey: 'secret123',
          sessionToken: 'token123',
        },
      });

      expect(mockExeca).toHaveBeenCalledWith(
        'npx',
        [
          'cdk',
          'bootstrap',
          'aws://123456789012/us-west-2',
          '--trust',
          '123456789012',
          '--cloudformation-execution-policies',
          'arn:aws:iam::aws:policy/AdministratorAccess',
          '--require-approval',
          'never',
        ],
        expect.objectContaining({
          all: true,
        })
      );
    });

    it('passes credentials as environment variables', async () => {
      mockExeca.mockResolvedValue({ all: 'Bootstrap successful' });

      await bootstrapCDKEnvironment({
        accountId: '123456789012',
        region: 'us-west-2',
        credentials: {
          accessKeyId: 'AKIATEST',
          secretAccessKey: 'secret123',
          sessionToken: 'token123',
        },
      });

      const callArgs = mockExeca.mock.calls[0];
      const options = callArgs[2] as { env?: Record<string, string> };

      expect(options.env).toBeDefined();
      expect(options.env?.AWS_ACCESS_KEY_ID).toBe('AKIATEST');
      expect(options.env?.AWS_SECRET_ACCESS_KEY).toBe('secret123');
      expect(options.env?.AWS_SESSION_TOKEN).toBe('token123');
      expect(options.env?.AWS_REGION).toBe('us-west-2');
    });

    it('omits session token from env if not provided', async () => {
      mockExeca.mockResolvedValue({ all: 'Bootstrap successful' });

      await bootstrapCDKEnvironment({
        accountId: '123456789012',
        region: 'us-west-2',
        credentials: {
          accessKeyId: 'AKIATEST',
          secretAccessKey: 'secret123',
        },
      });

      const callArgs = mockExeca.mock.calls[0];
      const options = callArgs[2] as { env?: Record<string, string> };

      expect(options.env).toBeDefined();
      expect(options.env?.AWS_ACCESS_KEY_ID).toBe('AKIATEST');
      expect(options.env?.AWS_SECRET_ACCESS_KEY).toBe('secret123');
      expect(options.env?.AWS_SESSION_TOKEN).toBeUndefined();
      expect(options.env?.AWS_REGION).toBe('us-west-2');
    });

    it('returns success result on successful execution', async () => {
      mockExeca.mockResolvedValue({ all: 'Bootstrap successful' });

      const result = await bootstrapCDKEnvironment({
        accountId: '123456789012',
        region: 'us-west-2',
        credentials: {
          accessKeyId: 'AKIATEST',
          secretAccessKey: 'secret123',
        },
      });

      expect(result.success).toBe(true);
      expect(result.output).toBe('Bootstrap successful');
    });

    it('returns failure result with output on error', async () => {
      const error = new Error('Bootstrap failed');
      (error as { all?: string }).all = 'Error: Stack already exists';
      mockExeca.mockRejectedValue(error);

      const result = await bootstrapCDKEnvironment({
        accountId: '123456789012',
        region: 'us-west-2',
        credentials: {
          accessKeyId: 'AKIATEST',
          secretAccessKey: 'secret123',
        },
      });

      expect(result.success).toBe(false);
      expect(result.output).toBe('Error: Stack already exists');
    });

    it('uses error message if all property not available', async () => {
      const error = new Error('Bootstrap failed');
      mockExeca.mockRejectedValue(error);

      const result = await bootstrapCDKEnvironment({
        accountId: '123456789012',
        region: 'us-west-2',
        credentials: {
          accessKeyId: 'AKIATEST',
          secretAccessKey: 'secret123',
        },
      });

      expect(result.success).toBe(false);
      expect(result.output).toBe('Bootstrap failed');
    });
  });

  describe('bootstrapAllEnvironments', () => {
    beforeEach(() => {
      // Mock successful STS AssumeRole responses
      mockSTSSend.mockResolvedValue({
        Credentials: {
          AccessKeyId: 'ASIATEMP123',
          SecretAccessKey: 'tempsecret123',
          SessionToken: 'temptoken123',
        },
      });

      // Mock successful bootstrap
      mockExeca.mockResolvedValue({ all: 'Bootstrap successful' });
    });

    it('calls bootstrapCDKEnvironment for each environment', async () => {
      await bootstrapAllEnvironments({
        accounts: {
          dev: '111111111111',
          stage: '222222222222',
          prod: '333333333333',
        },
        region: 'us-east-1',
        adminCredentials: {
          accessKeyId: 'AKIAADMIN',
          secretAccessKey: 'adminsecret',
        },
        spinner: mockOra as any, // eslint-disable-line @typescript-eslint/no-explicit-any
      });

      // Should call execa 3 times (once per environment)
      expect(mockExeca).toHaveBeenCalledTimes(3);

      // Verify each environment was bootstrapped
      expect(mockExeca).toHaveBeenCalledWith(
        'npx',
        expect.arrayContaining(['aws://111111111111/us-east-1']),
        expect.any(Object)
      );
      expect(mockExeca).toHaveBeenCalledWith(
        'npx',
        expect.arrayContaining(['aws://222222222222/us-east-1']),
        expect.any(Object)
      );
      expect(mockExeca).toHaveBeenCalledWith(
        'npx',
        expect.arrayContaining(['aws://333333333333/us-east-1']),
        expect.any(Object)
      );
    });

    it('assumes OrganizationAccountAccessRole for each account', async () => {
      await bootstrapAllEnvironments({
        accounts: {
          dev: '111111111111',
          stage: '222222222222',
          prod: '333333333333',
        },
        region: 'us-east-1',
        adminCredentials: {
          accessKeyId: 'AKIAADMIN',
          secretAccessKey: 'adminsecret',
        },
        spinner: mockOra as any, // eslint-disable-line @typescript-eslint/no-explicit-any
      });

      // Should call AssumeRoleCommand 3 times (once per environment)
      expect(mockAssumeRoleCommand).toHaveBeenCalledTimes(3);

      // Verify role ARNs for each environment
      const calls = mockAssumeRoleCommand.mock.calls;
      expect(calls[0][0].RoleArn).toBe(
        'arn:aws:iam::111111111111:role/OrganizationAccountAccessRole'
      );
      expect(calls[1][0].RoleArn).toBe(
        'arn:aws:iam::222222222222:role/OrganizationAccountAccessRole'
      );
      expect(calls[2][0].RoleArn).toBe(
        'arn:aws:iam::333333333333:role/OrganizationAccountAccessRole'
      );
    });

    it('updates spinner text for each environment', async () => {
      await bootstrapAllEnvironments({
        accounts: {
          dev: '111111111111',
          stage: '222222222222',
          prod: '333333333333',
        },
        region: 'us-east-1',
        adminCredentials: {
          accessKeyId: 'AKIAADMIN',
          secretAccessKey: 'adminsecret',
        },
        spinner: mockOra as any, // eslint-disable-line @typescript-eslint/no-explicit-any
      });

      expect(mockOra.succeed).toHaveBeenCalledTimes(3);
      expect(mockOra.succeed).toHaveBeenCalledWith(
        'CDK bootstrapped in dev account (111111111111)'
      );
      expect(mockOra.succeed).toHaveBeenCalledWith(
        'CDK bootstrapped in stage account (222222222222)'
      );
      expect(mockOra.succeed).toHaveBeenCalledWith(
        'CDK bootstrapped in prod account (333333333333)'
      );
    });

    it('throws error and fails spinner if bootstrap fails', async () => {
      mockExeca.mockResolvedValueOnce({ all: 'Success' }); // dev succeeds
      mockExeca.mockRejectedValueOnce({
        all: 'Error: CDK bootstrap failed',
        message: 'Error: CDK bootstrap failed',
      }); // stage fails

      await expect(
        bootstrapAllEnvironments({
          accounts: {
            dev: '111111111111',
            stage: '222222222222',
            prod: '333333333333',
          },
          region: 'us-east-1',
          adminCredentials: null,
          spinner: mockOra as any, // eslint-disable-line @typescript-eslint/no-explicit-any
        })
      ).rejects.toThrow('CDK bootstrap failed in stage account');

      expect(mockOra.fail).toHaveBeenCalledWith(
        'CDK bootstrap failed in stage account'
      );
    });

    it('works with null adminCredentials (uses default credentials)', async () => {
      await bootstrapAllEnvironments({
        accounts: {
          dev: '111111111111',
        },
        region: 'us-east-1',
        adminCredentials: null,
        spinner: mockOra as any, // eslint-disable-line @typescript-eslint/no-explicit-any
      });

      expect(mockSTSSend).toHaveBeenCalled();
      expect(mockExeca).toHaveBeenCalled();
    });

    it('skips environments with missing account IDs', async () => {
      await bootstrapAllEnvironments({
        accounts: {
          dev: '111111111111',
          // stage missing
          prod: '333333333333',
        },
        region: 'us-east-1',
        adminCredentials: {
          accessKeyId: 'AKIAADMIN',
          secretAccessKey: 'adminsecret',
        },
        spinner: mockOra as any, // eslint-disable-line @typescript-eslint/no-explicit-any
      });

      // Should only call execa twice (dev and prod, skip stage)
      expect(mockExeca).toHaveBeenCalledTimes(2);
    });
  });
});
