/**
 * setup-aws-envs command
 *
 * Sets up AWS Organizations and environment accounts (dev, stage, prod)
 * Must be run from inside a project directory
 */

import ora from 'ora';
import prompts from 'prompts';
import pc from 'picocolors';
import { readFileSync, writeFileSync } from 'node:fs';
import { requireProjectContext } from '../utils/project-context.js';
import {
  createOrganizationsClient,
  checkExistingOrganization,
  createOrganization,
  createAccount,
  waitForAccountCreation,
} from '../aws/organizations.js';

/**
 * Email addresses for each environment account
 */
interface EnvironmentEmails {
  dev: string;
  stage: string;
  prod: string;
}

/**
 * Environment names for account creation
 */
const ENVIRONMENTS = ['dev', 'stage', 'prod'] as const;

/**
 * Validates an email address format
 * @param value Email string to validate
 * @returns true if valid, error message string if invalid
 */
function validateEmail(value: string): boolean | string {
  if (!value.trim()) {
    return 'Email is required';
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    return 'Invalid email format';
  }
  return true;
}

/**
 * Validates email format and uniqueness
 * @param value Email string to validate
 * @param existing Array of already collected emails
 * @returns true if valid and unique, error message string if invalid
 */
function validateUniqueEmail(value: string, existing: string[]): boolean | string {
  const emailValid = validateEmail(value);
  if (emailValid !== true) {
    return emailValid;
  }

  const lower = value.toLowerCase();
  if (existing.some((e) => e?.toLowerCase() === lower)) {
    return 'Each account requires a unique email address';
  }
  return true;
}

/**
 * Collects unique email addresses for each environment account
 * @param projectName Project name for display
 * @returns EnvironmentEmails object with dev, stage, prod emails
 */
async function collectEmails(projectName: string): Promise<EnvironmentEmails> {
  console.log('');
  console.log(pc.bold('AWS Account Configuration'));
  console.log('');
  console.log(`Setting up environment accounts for ${pc.cyan(projectName)}`);
  console.log('');
  console.log('Each AWS environment account requires a unique root email address.');
  console.log(pc.dim('Tip: Use email aliases like yourname+dev@company.com'));
  console.log('');

  const onCancel = (): void => {
    console.log(`\n${pc.red('x')} Setup cancelled`);
    process.exit(1);
  };

  // Collect emails sequentially to enable uniqueness validation
  const devResponse = await prompts(
    {
      type: 'text',
      name: 'dev',
      message: 'Dev account root email:',
      validate: validateEmail,
    },
    { onCancel }
  );

  if (!devResponse.dev) {
    console.log(pc.red('Error:') + ' Dev email is required.');
    process.exit(1);
  }

  const stageResponse = await prompts(
    {
      type: 'text',
      name: 'stage',
      message: 'Stage account root email:',
      validate: (v: string): boolean | string => validateUniqueEmail(v, [devResponse.dev]),
    },
    { onCancel }
  );

  if (!stageResponse.stage) {
    console.log(pc.red('Error:') + ' Stage email is required.');
    process.exit(1);
  }

  const prodResponse = await prompts(
    {
      type: 'text',
      name: 'prod',
      message: 'Prod account root email:',
      validate: (v: string): boolean | string =>
        validateUniqueEmail(v, [devResponse.dev, stageResponse.stage]),
    },
    { onCancel }
  );

  if (!prodResponse.prod) {
    console.log(pc.red('Error:') + ' Prod email is required.');
    process.exit(1);
  }

  return {
    dev: devResponse.dev,
    stage: stageResponse.stage,
    prod: prodResponse.prod,
  };
}

/**
 * Updates the config file with account IDs
 * @param configPath Path to the config file
 * @param accounts Record of environment to account ID
 */
function updateConfigAccounts(configPath: string, accounts: Record<string, string>): void {
  const content = readFileSync(configPath, 'utf-8');
  const config = JSON.parse(content);

  config.accounts = { ...config.accounts, ...accounts };

  writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n', 'utf-8');
}

/**
 * Handles AWS-specific errors with actionable messages
 * @param error The error to handle
 * @returns never - always exits
 */
function handleAwsError(error: unknown): never {
  console.error('');

  if (!(error instanceof Error)) {
    console.error(pc.red('Error:') + ' Unknown error occurred');
    process.exit(1);
  }

  switch (error.name) {
    case 'AccessDeniedException':
      console.error(pc.red('Error: Insufficient AWS permissions'));
      console.error('');
      console.error('Your AWS credentials need the following permissions:');
      console.error('  - organizations:DescribeOrganization');
      console.error('  - organizations:CreateOrganization');
      console.error('  - organizations:CreateAccount');
      console.error('  - organizations:DescribeCreateAccountStatus');
      console.error('');
      console.error('Ensure you are using credentials from the management account.');
      break;

    case 'AWSOrganizationsNotInUseException':
      console.error(
        pc.red('Error: Unexpected state - no organization exists after creation attempt')
      );
      console.error('This may be a temporary AWS issue. Please try again in a few minutes.');
      break;

    case 'ConstraintViolationException':
      console.error(pc.red('Error: AWS Organizations limit reached'));
      console.error('');
      console.error(error.message);
      console.error('');
      console.error('You may have hit the account creation limit. Contact AWS Support.');
      break;

    case 'FinalizingOrganizationException':
      console.error(pc.red('Error: AWS Organization is still initializing'));
      console.error('Please wait about an hour and try again.');
      break;

    case 'TooManyRequestsException':
      console.error(pc.red('Error: AWS rate limit exceeded'));
      console.error('Please wait a few minutes and try again.');
      break;

    default:
      console.error(pc.red('Error:') + ` ${error.message}`);
      if (error.name) {
        console.error(pc.dim(`Error type: ${error.name}`));
      }
  }

  process.exit(1);
}

/**
 * Runs the setup-aws-envs command
 *
 * Creates AWS Organizations and environment accounts (dev, stage, prod)
 *
 * @param _args Command arguments (unused)
 */
export async function runSetupAwsEnvs(_args: string[]): Promise<void> {
  // 1. Validate we're in a project directory
  const context = await requireProjectContext();
  const { config, configPath } = context;

  // 2. Check if already configured (warn but don't abort - allows retry after partial failure)
  const existingAccounts = config.accounts ?? {};
  if (Object.keys(existingAccounts).length > 0) {
    console.log('');
    console.log(pc.yellow('Warning:') + ' AWS accounts already configured in this project:');
    for (const [env, id] of Object.entries(existingAccounts)) {
      console.log(`  ${env}: ${id}`);
    }
    console.log('');
    console.log(pc.dim('Continuing will create additional accounts...'));
  }

  // 3. Collect emails (all input before any AWS calls - per research pitfall #6)
  const emails = await collectEmails(config.projectName);

  // 4. Execute AWS operations with progress spinner
  const spinner = ora('Starting AWS Organizations setup...').start();

  try {
    // Organizations API requires us-east-1 (region-locked per research pitfall #1)
    const client = createOrganizationsClient('us-east-1');

    // Check/create organization
    spinner.text = 'Checking for existing AWS Organization...';
    let orgId = await checkExistingOrganization(client);

    if (!orgId) {
      spinner.text = 'Creating AWS Organization...';
      orgId = await createOrganization(client);
      spinner.succeed(`Created AWS Organization: ${orgId}`);
    } else {
      spinner.succeed(`Using existing AWS Organization: ${orgId}`);
    }

    // Create accounts sequentially (per research - AWS rate limits require sequential)
    const accounts: Record<string, string> = {};

    for (const env of ENVIRONMENTS) {
      spinner.start(`Creating ${env} account (this may take several minutes)...`);

      const accountName = `${config.projectName}-${env}`;
      const { requestId } = await createAccount(client, emails[env], accountName);

      spinner.text = `Waiting for ${env} account creation...`;
      const result = await waitForAccountCreation(client, requestId);

      accounts[env] = result.accountId;

      // Save after EACH successful account (per research pitfall #3 - handle partial success)
      updateConfigAccounts(configPath, accounts);

      spinner.succeed(`Created ${env} account: ${result.accountId}`);
    }

    // Final success
    console.log('');
    console.log(pc.green('AWS environment setup complete!'));
    console.log('');
    console.log('Account IDs saved to config:');
    for (const [env, id] of Object.entries(accounts)) {
      console.log(`  ${env}: ${id}`);
    }
    console.log('');
    console.log(pc.bold('Next step:'));
    console.log(`  ${pc.cyan('npx create-aws-project initialize-github dev')}`);
  } catch (error) {
    spinner.fail('AWS setup failed');
    handleAwsError(error);
  }
}
