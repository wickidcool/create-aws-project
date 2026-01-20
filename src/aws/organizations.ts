import {
  OrganizationsClient,
  CreateOrganizationCommand,
  CreateAccountCommand,
  DescribeCreateAccountStatusCommand,
  DescribeOrganizationCommand,
  AlreadyInOrganizationException,
  CreateAccountState,
} from '@aws-sdk/client-organizations';
import pc from 'picocolors';

/**
 * AWS Organizations service module
 *
 * Provides functions to create AWS Organizations and member accounts
 * programmatically during project generation.
 */

/**
 * Creates a configured OrganizationsClient
 * @param region - AWS region (defaults to us-east-1 as Organizations API is global)
 * @returns Configured OrganizationsClient instance
 */
export function createOrganizationsClient(region: string = 'us-east-1'): OrganizationsClient {
  return new OrganizationsClient({ region });
}

/**
 * Checks if the current AWS account is already part of an organization
 * @param client - OrganizationsClient instance
 * @returns Organization ID if exists, null if not in an organization
 */
export async function checkExistingOrganization(
  client: OrganizationsClient
): Promise<string | null> {
  try {
    const command = new DescribeOrganizationCommand({});
    const response = await client.send(command);
    return response.Organization?.Id ?? null;
  } catch (error) {
    // AWSOrganizationsNotInUseException means no organization exists
    if (error instanceof Error && error.name === 'AWSOrganizationsNotInUseException') {
      return null;
    }
    throw error;
  }
}

/**
 * Creates a new AWS Organization with all features enabled
 * @param client - OrganizationsClient instance
 * @returns Organization ID of the newly created organization
 * @throws Error if organization creation fails (except for already existing)
 */
export async function createOrganization(client: OrganizationsClient): Promise<string> {
  try {
    const command = new CreateOrganizationCommand({
      FeatureSet: 'ALL',
    });
    const response = await client.send(command);

    if (!response.Organization?.Id) {
      throw new Error('Organization created but no ID returned');
    }

    return response.Organization.Id;
  } catch (error) {
    // If already in an organization, return the existing org ID
    if (error instanceof AlreadyInOrganizationException) {
      const existingOrgId = await checkExistingOrganization(client);
      if (existingOrgId) {
        return existingOrgId;
      }
      throw new Error('Already in organization but could not retrieve organization ID');
    }
    throw error;
  }
}

/**
 * Result of an account creation request
 */
export interface CreateAccountResult {
  requestId: string;
}

/**
 * Creates a new AWS account within the organization
 * @param client - OrganizationsClient instance
 * @param email - Email address for the new account's root user
 * @param accountName - Display name for the account
 * @returns CreateAccountStatus ID for polling
 */
export async function createAccount(
  client: OrganizationsClient,
  email: string,
  accountName: string
): Promise<CreateAccountResult> {
  const command = new CreateAccountCommand({
    Email: email,
    AccountName: accountName,
  });

  const response = await client.send(command);

  if (!response.CreateAccountStatus?.Id) {
    throw new Error('Account creation initiated but no request ID returned');
  }

  return {
    requestId: response.CreateAccountStatus.Id,
  };
}

/**
 * Result of a completed account creation
 */
export interface AccountCreationResult {
  accountId: string;
  accountName: string;
}

/**
 * Polls the account creation status until completion or timeout
 * @param client - OrganizationsClient instance
 * @param createAccountRequestId - The request ID from createAccount
 * @param timeoutMs - Maximum time to wait in milliseconds (default: 5 minutes)
 * @returns Account ID when creation succeeds
 * @throws Error if creation fails or times out
 */
export async function waitForAccountCreation(
  client: OrganizationsClient,
  createAccountRequestId: string,
  timeoutMs: number = 300000
): Promise<AccountCreationResult> {
  const pollIntervalMs = 5000; // 5 seconds
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    const command = new DescribeCreateAccountStatusCommand({
      CreateAccountRequestId: createAccountRequestId,
    });

    const response = await client.send(command);
    const status = response.CreateAccountStatus;

    if (!status) {
      throw new Error('No status returned for account creation request');
    }

    // Use State field (not deprecated Status field)
    const state = status.State as CreateAccountState;

    if (state === 'SUCCEEDED') {
      if (!status.AccountId) {
        throw new Error('Account creation succeeded but no account ID returned');
      }
      return {
        accountId: status.AccountId,
        accountName: status.AccountName ?? '',
      };
    }

    if (state === 'FAILED') {
      const reason = status.FailureReason ?? 'Unknown failure reason';
      throw new Error(`Account creation failed: ${reason}`);
    }

    // State is IN_PROGRESS, continue polling
    await sleep(pollIntervalMs);
  }

  throw new Error(`Account creation timed out after ${timeoutMs / 1000} seconds`);
}

/**
 * Account configuration for environment creation
 */
export interface EnvironmentAccountConfig {
  environment: string;
  email: string;
}

/**
 * Result of environment account creation
 */
export interface EnvironmentAccountResult {
  environment: string;
  email: string;
  accountId: string;
}

/**
 * Creates multiple environment accounts sequentially
 * @param client - OrganizationsClient instance
 * @param orgName - Organization name prefix for account names
 * @param accounts - Array of environment and email configurations
 * @returns Array of created account results
 */
export async function createEnvironmentAccounts(
  client: OrganizationsClient,
  orgName: string,
  accounts: EnvironmentAccountConfig[]
): Promise<EnvironmentAccountResult[]> {
  const results: EnvironmentAccountResult[] = [];

  console.log(pc.cyan('\nCreating AWS environment accounts...'));
  console.log(pc.dim('Note: AWS rate limits require sequential account creation\n'));

  for (const account of accounts) {
    const accountName = `${orgName}-${account.environment}`;

    console.log(pc.yellow(`Creating account: ${accountName}`));
    console.log(pc.dim(`  Email: ${account.email}`));

    try {
      // Initiate account creation
      const { requestId } = await createAccount(client, account.email, accountName);

      console.log(pc.dim(`  Request ID: ${requestId}`));
      console.log(pc.dim('  Waiting for account creation (this may take a few minutes)...'));

      // Wait for completion
      const result = await waitForAccountCreation(client, requestId);

      console.log(pc.green(`  Account created: ${result.accountId}`));

      results.push({
        environment: account.environment,
        email: account.email,
        accountId: result.accountId,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.log(pc.red(`  Failed to create account: ${message}`));
      throw new Error(`Failed to create ${account.environment} account: ${message}`);
    }
  }

  console.log(pc.green(`\nSuccessfully created ${results.length} environment accounts`));

  return results;
}

/**
 * Helper function to sleep for a specified duration
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
