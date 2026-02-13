import { STSClient, AssumeRoleCommand } from '@aws-sdk/client-sts';
import { execa } from 'execa';
import type { Ora } from 'ora';
import pc from 'picocolors';

/**
 * AWS CDK Bootstrap module
 *
 * Provides functions to bootstrap AWS CDK in environment accounts,
 * preparing them for CDK deployments with proper trust policies.
 */

const ENVIRONMENTS = ['dev', 'stage', 'prod'] as const;

/**
 * Credentials for AWS API operations
 */
export interface AWSCredentials {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
}

/**
 * Options for bootstrapping a single CDK environment
 */
export interface BootstrapCDKEnvironmentOptions {
  accountId: string;
  region: string;
  credentials: AWSCredentials;
}

/**
 * Result of a CDK bootstrap operation
 */
export interface BootstrapResult {
  success: boolean;
  output: string;
}

/**
 * Options for bootstrapping all environments
 */
export interface BootstrapAllEnvironmentsOptions {
  accounts: Record<string, string>;
  region: string;
  adminCredentials: AWSCredentials | null;
  spinner: Ora;
}

/**
 * Bootstraps AWS CDK in a single environment account
 *
 * Runs `cdk bootstrap` via npx to prepare the account for CDK deployments.
 * Bootstrap creates the necessary CloudFormation stack with S3 bucket and ECR
 * repository for CDK deployment assets.
 *
 * @param options - Bootstrap options including account ID, region, and credentials
 * @returns Promise resolving to bootstrap result with success status and output
 *
 * @example
 * ```typescript
 * const result = await bootstrapCDKEnvironment({
 *   accountId: '123456789012',
 *   region: 'us-west-2',
 *   credentials: { accessKeyId: 'AKIA...', secretAccessKey: 'secret...', sessionToken: 'token...' }
 * });
 * if (!result.success) {
 *   console.error('Bootstrap failed:', result.output);
 * }
 * ```
 */
export async function bootstrapCDKEnvironment(
  options: BootstrapCDKEnvironmentOptions
): Promise<BootstrapResult> {
  const { accountId, region, credentials } = options;

  try {
    const args = [
      'cdk',
      'bootstrap',
      `aws://${accountId}/${region}`,
      '--trust',
      accountId,
      '--cloudformation-execution-policies',
      'arn:aws:iam::aws:policy/AdministratorAccess',
      '--require-approval',
      'never',
    ];

    const env: Record<string, string | undefined> = {
      ...process.env,
      AWS_ACCESS_KEY_ID: credentials.accessKeyId,
      AWS_SECRET_ACCESS_KEY: credentials.secretAccessKey,
      AWS_REGION: region,
    };

    // Add session token if present (for temporary credentials)
    if (credentials.sessionToken) {
      env.AWS_SESSION_TOKEN = credentials.sessionToken;
    }

    const result = await execa('npx', args, {
      all: true,
      env,
    });

    return {
      success: true,
      output: result.all || '',
    };
  } catch (error: unknown) {
    const execaError = error as { all?: string; message: string };
    return {
      success: false,
      output: execaError.all || execaError.message,
    };
  }
}

/**
 * Bootstraps AWS CDK in all environment accounts (dev, stage, prod)
 *
 * Iterates through all environments, assumes the OrganizationAccountAccessRole
 * in each account, and runs CDK bootstrap. This prepares all environments for
 * CDK deployments with proper trust relationships and execution policies.
 *
 * @param options - Bootstrap options including account map, region, admin credentials, and spinner
 * @throws Error if bootstrap fails in any environment
 *
 * @example
 * ```typescript
 * await bootstrapAllEnvironments({
 *   accounts: { dev: '111111111111', stage: '222222222222', prod: '333333333333' },
 *   region: 'us-west-2',
 *   adminCredentials: { accessKeyId: 'AKIA...', secretAccessKey: 'secret...' },
 *   spinner: ora()
 * });
 * ```
 */
export async function bootstrapAllEnvironments(
  options: BootstrapAllEnvironmentsOptions
): Promise<void> {
  const { accounts, region, adminCredentials, spinner } = options;

  for (const env of ENVIRONMENTS) {
    const accountId = accounts[env];
    if (!accountId) {
      continue;
    }

    spinner.text = `Bootstrapping CDK in ${env} account (${accountId})...`;

    // Get cross-account credentials via STS AssumeRole
    const stsClient = new STSClient({
      region,
      ...(adminCredentials && { credentials: adminCredentials }),
    });

    const assumeRoleCommand = new AssumeRoleCommand({
      RoleArn: `arn:aws:iam::${accountId}:role/OrganizationAccountAccessRole`,
      RoleSessionName: `create-aws-project-bootstrap-${Date.now()}`,
      DurationSeconds: 900,
    });

    const assumeRoleResponse = await stsClient.send(assumeRoleCommand);

    if (
      !assumeRoleResponse.Credentials?.AccessKeyId ||
      !assumeRoleResponse.Credentials?.SecretAccessKey ||
      !assumeRoleResponse.Credentials?.SessionToken
    ) {
      spinner.fail(`Failed to assume role in ${env} account`);
      throw new Error(`Failed to get temporary credentials for ${env} account`);
    }

    const credentials: AWSCredentials = {
      accessKeyId: assumeRoleResponse.Credentials.AccessKeyId,
      secretAccessKey: assumeRoleResponse.Credentials.SecretAccessKey,
      sessionToken: assumeRoleResponse.Credentials.SessionToken,
    };

    // Bootstrap the environment
    const result = await bootstrapCDKEnvironment({
      accountId,
      region,
      credentials,
    });

    if (!result.success) {
      spinner.fail(`CDK bootstrap failed in ${env} account`);
      console.error(pc.red('Bootstrap error:'));
      console.error(result.output);
      throw new Error(`CDK bootstrap failed in ${env} account`);
    }

    spinner.succeed(`CDK bootstrapped in ${env} account (${accountId})`);
  }

  console.log(pc.green('All environments bootstrapped for CDK deployments!'));
}
