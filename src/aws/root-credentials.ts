import {
  IAMClient,
  CreateUserCommand,
  GetUserCommand,
  AttachUserPolicyCommand,
  CreateAccessKeyCommand,
  ListUserTagsCommand,
  NoSuchEntityException,
} from '@aws-sdk/client-iam';
import { STSClient, GetCallerIdentityCommand } from '@aws-sdk/client-sts';
import pc from 'picocolors';
import { getAccessKeyCount } from './iam.js';

/**
 * AWS Root Credential Detection and Admin User Management
 *
 * Provides functions to detect root credentials and create/adopt admin IAM users
 * in the management account for cross-account operations.
 */

/**
 * Caller identity information from STS GetCallerIdentity
 */
export interface CallerIdentity {
  arn: string;
  accountId: string;
  userId: string;
  isRoot: boolean;
}

/**
 * Admin user creation result
 */
export interface AdminUserResult {
  userName: string;
  accessKeyId: string;
  secretAccessKey: string;
  adopted: boolean; // true if existing user was adopted, false if newly created
}

/**
 * Checks if an ARN represents a root user
 * @param arn - AWS ARN to check
 * @returns true if ARN ends with :root
 */
export function isRootUser(arn: string): boolean {
  return arn.endsWith(':root');
}

/**
 * Detects if the current AWS credentials are for a root user
 * @param region - AWS region for STS client
 * @returns Caller identity with root status flag
 */
export async function detectRootCredentials(region: string): Promise<CallerIdentity> {
  const client = new STSClient({ region });
  const command = new GetCallerIdentityCommand({});
  const response = await client.send(command);

  if (!response.Arn || !response.Account || !response.UserId) {
    throw new Error('GetCallerIdentity returned incomplete response');
  }

  return {
    arn: response.Arn,
    accountId: response.Account,
    userId: response.UserId,
    isRoot: isRootUser(response.Arn),
  };
}

/**
 * Helper function to sleep for retry backoff
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retries a function with exponential backoff
 * @param fn - Async function to retry
 * @param options - Retry configuration
 * @returns Result of the function
 * @throws Last error if all retries fail
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options?: {
    maxRetries?: number;
    baseDelayMs?: number;
    description?: string;
  }
): Promise<T> {
  const maxRetries = options?.maxRetries ?? 5;
  const baseDelayMs = options?.baseDelayMs ?? 1000;
  const description = options?.description ?? 'operation';

  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < maxRetries) {
        const delay = baseDelayMs * Math.pow(2, attempt);
        console.log(pc.dim(`  Retrying ${description} (attempt ${attempt + 1}/${maxRetries})...`));
        await sleep(delay);
      }
    }
  }

  throw lastError;
}

/**
 * Creates access key for admin user
 * @param client - IAMClient instance
 * @param userName - Admin user name
 * @returns Access key credentials
 * @throws Error if user already has 2 access keys
 */
export async function createAccessKeyForAdmin(
  client: IAMClient,
  userName: string
): Promise<{ accessKeyId: string; secretAccessKey: string }> {
  // Check access key limit before attempting creation
  const keyCount = await getAccessKeyCount(client, userName);
  if (keyCount >= 2) {
    throw new Error(
      `IAM user ${userName} already has 2 access keys (AWS maximum). Delete an existing key in AWS Console > IAM > Users > ${userName} > Security credentials before retrying.`
    );
  }

  const command = new CreateAccessKeyCommand({
    UserName: userName,
  });

  const response = await client.send(command);

  if (!response.AccessKey?.AccessKeyId || !response.AccessKey?.SecretAccessKey) {
    throw new Error('Access key created but credentials not returned');
  }

  console.log(pc.green(`  Created access key for ${userName}`));

  return {
    accessKeyId: response.AccessKey.AccessKeyId,
    secretAccessKey: response.AccessKey.SecretAccessKey,
  };
}

/**
 * Creates or adopts an admin user in the management account
 * @param client - IAMClient instance
 * @param projectName - Project name for user naming
 * @returns Admin user credentials
 * @throws Error if user exists but not managed by this tool or has existing keys
 */
export async function createOrAdoptAdminUser(
  client: IAMClient,
  projectName: string
): Promise<AdminUserResult> {
  const userName = `${projectName}-admin`;

  // Check if user already exists
  try {
    await client.send(new GetUserCommand({ UserName: userName }));

    // User exists - check if managed by us
    const tagsCommand = new ListUserTagsCommand({ UserName: userName });
    const tagsResponse = await client.send(tagsCommand);

    const isManagedByUs = tagsResponse.Tags?.some(
      (tag) => tag.Key === 'ManagedBy' && tag.Value === 'create-aws-starter-kit'
    ) ?? false;

    if (!isManagedByUs) {
      throw new Error(
        `IAM user "${userName}" exists but was not created by this tool. Delete it or use a different project name.`
      );
    }

    // Managed by us - check key count
    const keyCount = await getAccessKeyCount(client, userName);
    if (keyCount >= 1) {
      throw new Error(
        `IAM user "${userName}" already exists with ${keyCount} access key(s). This tool cannot retrieve existing secret keys. Please delete all access keys for this user in AWS Console > IAM > Users > ${userName} > Security credentials, or provide IAM credentials directly instead of using root credentials.`
      );
    }

    // No keys - create new key and adopt
    console.log(pc.yellow(`  Adopting existing admin user: ${userName}`));
    const credentials = await retryWithBackoff(
      () => createAccessKeyForAdmin(client, userName),
      { description: 'access key creation' }
    );

    return {
      userName,
      accessKeyId: credentials.accessKeyId,
      secretAccessKey: credentials.secretAccessKey,
      adopted: true,
    };
  } catch (error) {
    // User doesn't exist - create new
    if (error instanceof NoSuchEntityException) {
      console.log(pc.cyan(`  Creating admin user: ${userName}`));

      // Create user
      await client.send(
        new CreateUserCommand({
          UserName: userName,
          Path: '/admin/',
          Tags: [
            { Key: 'Purpose', Value: 'CLI Admin' },
            { Key: 'ManagedBy', Value: 'create-aws-starter-kit' },
          ],
        })
      );

      console.log(pc.green(`  Created IAM user: ${userName}`));

      // Attach AdministratorAccess policy
      await client.send(
        new AttachUserPolicyCommand({
          UserName: userName,
          PolicyArn: 'arn:aws:iam::aws:policy/AdministratorAccess',
        })
      );

      console.log(pc.green(`  Attached AdministratorAccess policy`));

      // Create access key with retry for IAM eventual consistency
      const credentials = await retryWithBackoff(
        () => createAccessKeyForAdmin(client, userName),
        { description: 'access key creation after user creation' }
      );

      return {
        userName,
        accessKeyId: credentials.accessKeyId,
        secretAccessKey: credentials.secretAccessKey,
        adopted: false,
      };
    }

    // Other error - propagate
    throw error;
  }
}
