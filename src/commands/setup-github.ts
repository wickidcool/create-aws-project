import pc from 'picocolors';
import { fromIni } from '@aws-sdk/credential-providers';
import { IAMClient } from '@aws-sdk/client-iam';
import { runGitHubSetupWizard, type GitHubSetupConfig } from '../prompts/github-setup.js';
import { createDeploymentUserWithCredentials } from '../aws/iam.js';
import { createGitHubClient, setEnvironmentCredentials } from '../github/secrets.js';

/**
 * setup-github command module
 *
 * Orchestrates the complete flow of creating IAM deployment users
 * and configuring GitHub repository secrets for each environment.
 */

/**
 * Prints the setup-github command banner
 */
function printBanner(): void {
  console.log(`
${pc.cyan('=================================================')}
${pc.cyan('          GitHub Deployment Setup')}
${pc.cyan('=================================================')}

This command will:
1. Create IAM deployment users in each AWS account
2. Configure GitHub repository secrets for CI/CD

${pc.dim('Prerequisites:')}
${pc.dim('- AWS CLI profiles configured for each account')}
${pc.dim('- GitHub PAT with "repo" scope')}
`);
}

/**
 * Creates an IAM client configured with credentials from a specific profile
 * @param region - AWS region
 * @param profile - AWS CLI profile name
 * @returns Configured IAMClient
 */
function createIAMClientWithProfile(region: string, profile: string): IAMClient {
  return new IAMClient({
    region,
    credentials: fromIni({ profile }),
  });
}

/**
 * Result of setting up a single environment
 */
interface EnvironmentSetupResult {
  environment: string;
  success: boolean;
  error?: string;
  secretsCreated?: string[];
}

/**
 * Sets up deployment for a single environment
 * @param config - Complete setup configuration
 * @param envConfig - Configuration for this specific environment
 * @returns Setup result
 */
async function setupEnvironment(
  config: GitHubSetupConfig,
  envConfig: { environment: string; accountId: string; awsProfile: string }
): Promise<EnvironmentSetupResult> {
  const { environment, accountId, awsProfile } = envConfig;
  const { projectName, awsRegion, github } = config;

  console.log(pc.cyan(`\n${'='.repeat(50)}`));
  console.log(pc.cyan(`Setting up ${pc.bold(environment)} environment`));
  console.log(pc.cyan('='.repeat(50)));
  console.log(pc.dim(`Account: ${accountId}`));
  console.log(pc.dim(`Profile: ${awsProfile}`));

  try {
    // Step 1: Create IAM client with profile credentials
    console.log(pc.dim(`\nConnecting to AWS using profile "${awsProfile}"...`));
    const iamClient = createIAMClientWithProfile(awsRegion, awsProfile);

    // Step 2: Create deployment user and get credentials
    const credentials = await createDeploymentUserWithCredentials(
      iamClient,
      projectName,
      environment,
      accountId
    );

    // Step 3: Create GitHub client
    console.log(pc.dim('\nConnecting to GitHub...'));
    const githubClient = createGitHubClient(github.token);

    // Step 4: Set GitHub repository secrets
    console.log(pc.dim(`Setting GitHub secrets for ${github.owner}/${github.repo}...`));
    await setEnvironmentCredentials(
      githubClient,
      github.owner,
      github.repo,
      environment,
      credentials.accessKeyId,
      credentials.secretAccessKey
    );

    return {
      environment,
      success: true,
      secretsCreated: [
        'AWS_ACCESS_KEY_ID',
        'AWS_SECRET_ACCESS_KEY',
      ],
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Provide helpful error messages for common issues
    if (errorMessage.includes('Could not load credentials') ||
        errorMessage.includes('SharedIniFileCredentials') ||
        errorMessage.includes('Profile') && errorMessage.includes('not found')) {
      return {
        environment,
        success: false,
        error: `AWS profile "${awsProfile}" not found or invalid. Configure it with: aws configure --profile ${awsProfile}`,
      };
    }

    if (errorMessage.includes('not authorized') ||
        errorMessage.includes('AccessDenied')) {
      return {
        environment,
        success: false,
        error: `Insufficient IAM permissions for profile "${awsProfile}". Ensure the profile has IAM admin access.`,
      };
    }

    if (errorMessage.includes('GitHub authentication failed')) {
      return {
        environment,
        success: false,
        error: 'GitHub authentication failed. Check that your PAT has the "repo" scope.',
      };
    }

    return {
      environment,
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Prints the final summary of setup results
 */
function printSummary(
  config: GitHubSetupConfig,
  results: EnvironmentSetupResult[]
): void {
  console.log(pc.cyan(`\n${'='.repeat(50)}`));
  console.log(pc.cyan('                   Summary'));
  console.log(pc.cyan('='.repeat(50)));

  const successful = results.filter((r) => r.success);
  const failed = results.filter((r) => !r.success);

  console.log(`\nGitHub Repository: ${pc.bold(`${config.github.owner}/${config.github.repo}`)}`);
  console.log(`Project: ${pc.bold(config.projectName)}`);
  console.log('');

  if (successful.length > 0) {
    console.log(pc.green('Successful environments:'));
    for (const result of successful) {
      console.log(pc.green(`  ${pc.bold('+')} ${result.environment}`));
      if (result.secretsCreated) {
        for (const secret of result.secretsCreated) {
          console.log(pc.dim(`      ${secret}`));
        }
      }
    }
  }

  if (failed.length > 0) {
    console.log(pc.red('\nFailed environments:'));
    for (const result of failed) {
      console.log(pc.red(`  ${pc.bold('x')} ${result.environment}`));
      console.log(pc.dim(`      ${result.error}`));
    }
  }

  console.log('');

  if (failed.length === 0) {
    console.log(pc.green(pc.bold('All environments configured successfully!')));
    console.log('');
    console.log(pc.dim('Your GitHub Actions workflows can now deploy to AWS using environment secrets.'));
    console.log(pc.dim('Each environment has AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY configured:'));
    for (const result of successful) {
      console.log(pc.dim(`  - ${result.environment}`));
    }
  } else if (successful.length === 0) {
    console.log(pc.red(pc.bold('Setup failed for all environments.')));
    console.log(pc.dim('Please check the error messages above and try again.'));
  } else {
    console.log(pc.yellow(pc.bold(`Setup completed with errors (${successful.length}/${results.length} succeeded).`)));
    console.log(pc.dim('You can re-run this command to retry failed environments.'));
  }
}

/**
 * Runs the setup-github command
 */
export async function runSetupGitHub(): Promise<void> {
  printBanner();

  // Run the wizard to collect configuration
  const config = await runGitHubSetupWizard();

  if (!config) {
    console.log(pc.yellow('\nSetup cancelled.'));
    return;
  }

  console.log(pc.cyan('\nStarting deployment setup...'));

  // Process each environment
  const results: EnvironmentSetupResult[] = [];

  for (const envConfig of config.environments) {
    const result = await setupEnvironment(config, envConfig);
    results.push(result);

    // If an environment fails, ask whether to continue
    if (!result.success && config.environments.indexOf(envConfig) < config.environments.length - 1) {
      console.log(pc.yellow(`\nEnvironment ${envConfig.environment} failed. Continuing with remaining environments...`));
    }
  }

  // Print summary
  printSummary(config, results);
}
