/**
 * initialize-github command
 *
 * Configures GitHub Environment with AWS credentials for a single environment
 * Must be run from inside a project directory
 * Requires environment name as argument (dev, stage, prod)
 */

import ora from 'ora';
import prompts from 'prompts';
import pc from 'picocolors';
import { z } from 'zod';
import { execSync } from 'node:child_process';
import { requireProjectContext, detectProjectContext } from '../utils/project-context.js';
import {
  createGitHubClient,
  setEnvironmentCredentials,
  parseGitHubUrl,
  type GitHubRepoInfo,
} from '../github/secrets.js';

const VALID_ENVIRONMENTS = ['dev', 'stage', 'prod'] as const;
type Environment = (typeof VALID_ENVIRONMENTS)[number];

/**
 * GitHub environment display names
 */
const GITHUB_ENV_NAMES: Record<string, string> = {
  dev: 'Development',
  stage: 'Staging',
  prod: 'Production',
};

/**
 * Validates environment argument
 * @param env Environment name to validate
 * @returns true if valid, false otherwise
 */
function isValidEnvironment(env: string): env is Environment {
  return VALID_ENVIRONMENTS.includes(env as Environment);
}

/**
 * Attempts to extract GitHub repo owner/name from git remote
 * @returns GitHubRepoInfo if successful, null if fails or not GitHub
 */
function getGitRemoteOrigin(): GitHubRepoInfo | null {
  try {
    const remote = execSync('git remote get-url origin', {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();

    return parseGitHubUrl(remote);
  } catch {
    // Git not initialized, no remote, or parse failure
    return null;
  }
}

/**
 * Prompts user for GitHub Personal Access Token
 * @returns GitHub PAT string
 */
async function promptForGitHubPAT(): Promise<string> {
  console.log('');
  console.log(pc.bold('GitHub Authentication'));
  console.log('');
  console.log('A Personal Access Token is required to configure GitHub secrets.');
  console.log(pc.dim('Token must have "repo" scope for environment secrets access.'));
  console.log('');
  console.log('Create a token at: https://github.com/settings/tokens/new');
  console.log('');

  const response = await prompts(
    {
      type: 'password',
      name: 'token',
      message: 'GitHub Personal Access Token:',
      validate: (value: string): boolean | string => {
        if (!value.trim()) {
          return 'Token is required';
        }
        // GitHub tokens start with ghp_ (classic) or github_pat_ (fine-grained)
        if (!value.startsWith('ghp_') && !value.startsWith('github_pat_')) {
          return 'Invalid token format. Expected ghp_ or github_pat_ prefix.';
        }
        return true;
      },
    },
    {
      onCancel: (): void => {
        console.log(`\n${pc.red('x')} Setup cancelled`);
        process.exit(1);
      },
    }
  );

  if (!response.token) {
    console.error(pc.red('Error:') + ' GitHub token is required.');
    process.exit(1);
  }

  return response.token;
}

/**
 * Prompts user to select environment from configured ones
 * @param configuredEnvs List of environments with account IDs
 * @returns Selected environment name
 */
async function promptForEnvironment(configuredEnvs: string[]): Promise<Environment> {
  console.log('');
  console.log(pc.bold('Environment Selection'));
  console.log('');

  const response = await prompts(
    {
      type: 'select',
      name: 'env',
      message: 'Select environment to configure:',
      choices: configuredEnvs.map((env) => ({
        title: `${env} (${GITHUB_ENV_NAMES[env]})`,
        value: env,
      })),
    },
    {
      onCancel: (): void => {
        console.log(`\n${pc.red('x')} Setup cancelled`);
        process.exit(1);
      },
    }
  );

  if (!response.env) {
    console.error(pc.red('Error:') + ' Environment selection is required.');
    process.exit(1);
  }

  return response.env as Environment;
}

/**
 * Prompts user for GitHub repository owner/name
 * @returns GitHubRepoInfo with owner and repo
 */
async function promptForRepoInfo(): Promise<GitHubRepoInfo> {
  console.log('');
  console.log(pc.bold('GitHub Repository'));
  console.log('');
  console.log('Enter your GitHub repository in owner/repo format.');
  console.log(pc.dim('Example: myusername/my-project'));
  console.log('');

  const response = await prompts(
    {
      type: 'text',
      name: 'repo',
      message: 'GitHub repository (owner/repo):',
      validate: (value: string): boolean | string => {
        if (!value.trim()) {
          return 'Repository is required';
        }
        if (!/^[^/]+\/[^/]+$/.test(value.trim())) {
          return 'Format must be owner/repo (e.g., username/project-name)';
        }
        return true;
      },
    },
    {
      onCancel: (): void => {
        console.log(`\n${pc.red('x')} Setup cancelled`);
        process.exit(1);
      },
    }
  );

  if (!response.repo) {
    console.error(pc.red('Error:') + ' Repository is required.');
    process.exit(1);
  }

  return parseGitHubUrl(response.repo);
}

/**
 * Determines batch environments from CLI args
 * @param args Command arguments
 * @param config Project config with deployment credentials
 * @returns Array of environments to configure
 */
function determineBatchEnvironments(
  args: string[],
  config: { deploymentCredentials?: Record<string, unknown> }
): Environment[] {
  if (args.includes('--all')) {
    const envs = VALID_ENVIRONMENTS.filter(
      env => config.deploymentCredentials?.[env]
    );
    if (envs.length === 0) {
      console.error(pc.red('Error:') + ' No environments have credentials configured.');
      console.error('Run setup-aws-envs first to create deployment credentials:');
      console.error(`  ${pc.cyan('npx create-aws-project setup-aws-envs')}`);
      process.exit(1);
    }
    return [...envs];
  }

  // Multiple positional arguments (filter out flags)
  const envArgs = args.filter(arg => !arg.startsWith('--'));

  for (const envArg of envArgs) {
    if (envArg !== envArg.toLowerCase()) {
      console.error(pc.red('Error:') + ` Environment must be lowercase: ${pc.bold(envArg)}`);
      console.error(`Did you mean: ${pc.cyan(envArg.toLowerCase())}?`);
      process.exit(1);
    }
    if (!isValidEnvironment(envArg)) {
      console.error(pc.red('Error:') + ` Invalid environment: ${pc.bold(envArg)}`);
      console.error('Valid environments: ' + VALID_ENVIRONMENTS.join(', '));
      process.exit(1);
    }
    if (!config.deploymentCredentials?.[envArg]) {
      console.error(pc.red('Error:') + ` No credentials for ${pc.bold(envArg)}.`);
      console.error('Run setup-aws-envs first to create deployment credentials:');
      console.error(`  ${pc.cyan('npx create-aws-project setup-aws-envs')}`);
      process.exit(1);
    }
  }

  return envArgs as Environment[];
}

/**
 * Handles GitHub errors with actionable messages
 * @param error The error to handle
 * @returns never - always exits
 */
function handleError(error: unknown): never {
  console.error('');

  if (!(error instanceof Error)) {
    console.error(pc.red('Error:') + ' Unknown error occurred');
    process.exit(1);
  }

  // GitHub authentication errors
  if (error.message.includes('authentication failed') || error.name === 'HttpError') {
    console.error(pc.red('Error: GitHub authentication failed'));
    console.error('');
    console.error('Ensure your Personal Access Token:');
    console.error('  1. Has "repo" scope enabled');
    console.error('  2. Belongs to the repository owner or has access');
    console.error('  3. Is not expired');
    console.error('');
    console.error('Create a new token at: https://github.com/settings/tokens/new');
    process.exit(1);
  }

  // Default error handling
  console.error(pc.red('Error:') + ` ${error.message}`);
  if (error.name) {
    console.error(pc.dim(`Error type: ${error.name}`));
  }
  process.exit(1);
}

/**
 * Runs the initialize-github command
 *
 * @param args Command arguments - expects environment name as first arg (optional)
 */
export async function runInitializeGitHub(args: string[]): Promise<void> {
  // 1. Validate we're in a project directory
  const context = await requireProjectContext();
  const { config } = context;

  // 2. Detect batch mode
  const nonFlagArgs = args.filter(a => !a.startsWith('--'));
  const isBatchMode = args.includes('--all') || nonFlagArgs.length > 1;

  if (isBatchMode) {
    // BATCH MODE: Configure multiple environments
    const environments = determineBatchEnvironments(args, config);

    // Get repository info once (try git remote, fallback to prompt)
    let repoInfo: GitHubRepoInfo | null = getGitRemoteOrigin();

    if (!repoInfo) {
      console.log('');
      console.log(pc.yellow('Note:') + ' Could not detect GitHub repository from git remote.');
      repoInfo = await promptForRepoInfo();
    } else {
      console.log('');
      console.log(`Detected repository: ${pc.cyan(`${repoInfo.owner}/${repoInfo.repo}`)}`);
    }

    // Prompt for GitHub PAT once
    const pat = await promptForGitHubPAT();

    // Create GitHub client once
    const githubClient = createGitHubClient(pat);

    // Track results for each environment
    const results: Array<{ env: string; success: boolean; error?: string }> = [];

    // Process each environment
    for (const env of environments) {
      const spinner = ora(`Configuring ${env} environment...`).start();

      try {
        const credentials = config.deploymentCredentials?.[env];
        if (!credentials) {
          throw new Error(`No deployment credentials found for ${env}`);
        }

        const githubEnvName = GITHUB_ENV_NAMES[env];
        spinner.text = `Configuring GitHub Environment "${githubEnvName}"...`;

        await setEnvironmentCredentials(
          githubClient,
          repoInfo.owner,
          repoInfo.repo,
          githubEnvName,
          credentials.accessKeyId,
          credentials.secretAccessKey
        );

        spinner.succeed(`Configured ${githubEnvName} environment`);
        results.push({ env, success: true });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        spinner.fail(`Failed ${env}`);
        results.push({ env, success: false, error: errorMessage });
      }
    }

    // Show batch summary
    console.log('');
    console.log(pc.bold('Batch Configuration Summary'));
    console.log('');

    for (const result of results) {
      if (result.success) {
        console.log(`  ${pc.green('✓')} Configured ${GITHUB_ENV_NAMES[result.env]} environment`);
      } else {
        console.log(`  ${pc.red('✗')} Failed ${result.env}: ${result.error}`);
      }
    }

    const successCount = results.filter(r => r.success).length;
    console.log('');
    console.log(`Successfully configured ${successCount} of ${results.length} environments`);

    if (successCount < results.length) {
      console.log('');
      console.log('You can retry failed environments individually:');
      for (const result of results) {
        if (!result.success) {
          console.log(`  ${pc.cyan(`npx create-aws-project initialize-github ${result.env}`)}`);
        }
      }
    }

    console.log('');
    console.log('View secrets at:');
    console.log(`  ${pc.cyan(`https://github.com/${repoInfo.owner}/${repoInfo.repo}/settings/environments`)}`);
    console.log('');

    // Exit with error code if any failed
    if (successCount < results.length) {
      process.exit(1);
    }

    return;
  }

  // SINGLE MODE (existing behavior, unchanged)
  // 2. Determine environment
  let env: Environment;

  if (args[0]) {
    // Environment provided as argument
    const envArg = args[0];

    // Validate it's lowercase (enforce consistency)
    if (envArg !== envArg.toLowerCase()) {
      console.error(pc.red('Error:') + ` Environment must be lowercase: ${pc.bold(envArg)}`);
      console.error('');
      console.error(`Did you mean: ${pc.cyan(envArg.toLowerCase())}?`);
      process.exit(1);
    }

    if (!isValidEnvironment(envArg)) {
      console.error(pc.red('Error:') + ` Invalid environment: ${pc.bold(envArg)}`);
      console.error('');
      console.error('Valid environments: ' + VALID_ENVIRONMENTS.join(', '));
      process.exit(1);
    }

    env = envArg;
  } else {
    // Interactive environment selection
    const configuredEnvs = VALID_ENVIRONMENTS.filter(
      (e) => config.deploymentCredentials?.[e]
    );

    if (configuredEnvs.length === 0) {
      console.error(pc.red('Error:') + ' No environments configured.');
      console.error('');
      console.error('Run setup-aws-envs first to create deployment credentials:');
      console.error(`  ${pc.cyan('npx create-aws-project setup-aws-envs')}`);
      process.exit(1);
    }

    env = await promptForEnvironment(configuredEnvs);
  }

  // 3. Get repository info (try git remote, fallback to prompt)
  let repoInfo: GitHubRepoInfo | null = getGitRemoteOrigin();

  if (!repoInfo) {
    console.log('');
    console.log(pc.yellow('Note:') + ' Could not detect GitHub repository from git remote.');
    repoInfo = await promptForRepoInfo();
  } else {
    console.log('');
    console.log(`Detected repository: ${pc.cyan(`${repoInfo.owner}/${repoInfo.repo}`)}`);
  }

  // 4. Prompt for GitHub PAT (always interactive per CONTEXT.md)
  const pat = await promptForGitHubPAT();

  // 5. Execute GitHub setup
  const spinner = ora(`Initializing ${env} environment...`).start();

  try {
    // Step 1: Validate deployment credentials exist in config
    const credentials = config.deploymentCredentials?.[env];
    if (!credentials) {
      spinner.fail(`No deployment credentials found for ${env}`);
      console.error('');

      // Check if user exists but credentials don't (migration case)
      if (config.deploymentUsers?.[env]) {
        console.error(pc.yellow('Note:') + ' Deployment user exists but credentials were not found.');
        console.error('Your project may have been set up with an older version.');
        console.error('');
      }

      console.error('Run setup-aws-envs first to create deployment credentials:');
      console.error(`  ${pc.cyan('npx create-aws-project setup-aws-envs')}`);
      process.exit(1);
    }

    // Step 2: Configure GitHub environment
    const githubEnvName = GITHUB_ENV_NAMES[env];
    spinner.text = `Configuring GitHub Environment "${githubEnvName}"...`;
    const githubClient = createGitHubClient(pat);
    await setEnvironmentCredentials(
      githubClient,
      repoInfo.owner,
      repoInfo.repo,
      githubEnvName,
      credentials.accessKeyId,
      credentials.secretAccessKey
    );

    spinner.succeed(`Configured ${githubEnvName} environment`);

    // Success summary
    console.log('');
    console.log(pc.green(`${env} environment setup complete!`));
    console.log('');
    console.log('Credentials pushed to GitHub:');
    console.log(`  Deployment User: ${pc.cyan(credentials.userName)}`);
    console.log(`  Access Key ID: ${pc.cyan(credentials.accessKeyId)}`);
    console.log(`  GitHub Environment: ${pc.cyan(githubEnvName)}`);
    console.log('');
    console.log('View secrets at:');
    console.log(`  ${pc.cyan(`https://github.com/${repoInfo.owner}/${repoInfo.repo}/settings/environments`)}`);
    console.log('');

    // Show next steps (other environments if any remain)
    const remainingEnvs = VALID_ENVIRONMENTS.filter(
      (e) => e !== env && config.deploymentCredentials?.[e]
    );

    if (remainingEnvs.length > 0) {
      console.log(pc.bold('Next steps:'));
      console.log('');
      console.log('Configure remaining environments:');
      for (const remainingEnv of remainingEnvs) {
        console.log(`  ${pc.cyan(`npx create-aws-project initialize-github ${remainingEnv}`)}`);
      }
      console.log('');
    } else {
      console.log(pc.bold('All environments configured!'));
      console.log('');
      console.log(pc.bold('Get started:'));
      console.log('');
      console.log(`  ${pc.cyan('npm install')}`);
      console.log('');

      if (config.platforms?.includes('web')) {
        console.log(`  ${pc.gray('# Start web app')}`);
        console.log(`  ${pc.cyan('npm run web')}`);
        console.log('');
      }

      if (config.platforms?.includes('mobile')) {
        console.log(`  ${pc.gray('# Start mobile app')}`);
        console.log(`  ${pc.cyan('npm run mobile')}`);
        console.log('');
      }

      if (config.platforms?.includes('api')) {
        console.log(`  ${pc.gray('# Deploy API')}`);
        console.log(`  ${pc.cyan('npm run cdk:deploy')}`);
        console.log('');
      }
    }
  } catch (error) {
    spinner.fail(`Failed to configure ${env} environment`);
    handleError(error);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Non-interactive API (for MCP tool handlers and programmatic use)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Config object accepted by runInitializeGitHubNonInteractive.
 * GITHUB_TOKEN is NOT a field here — it is read from process.env.GITHUB_TOKEN.
 */
export interface InitializeGitHubConfig {
  /** Repository in any supported format: owner/repo, https://github.com/owner/repo, or git@github.com:owner/repo */
  repoUrl: string;
  /** Environments to configure. Defaults to all environments that have deploymentCredentials in the project config. */
  environments?: string[];
}

/** Per-environment result entry */
export interface InitializeGitHubEnvResult {
  environment: string;
  success: boolean;
  error?: string;
}

/** Aggregate result returned by runInitializeGitHubNonInteractive */
export interface InitializeGitHubResult {
  results: InitializeGitHubEnvResult[];
  successCount: number;
  totalCount: number;
}

const InitializeGitHubConfigSchema = z.object({
  repoUrl: z.string().min(1, 'repoUrl is required'),
  environments: z
    .array(z.enum(['dev', 'stage', 'prod']))
    .optional(),
});

/**
 * Runs GitHub environment credential initialization in non-interactive mode.
 *
 * - Reads GITHUB_TOKEN from process.env (never accepts it as a parameter, per CRED-01)
 * - Calls setEnvironmentCredentials for each environment with individual try/catch
 *   so one failure does NOT abort the remaining environments
 * - Returns a structured result with per-environment success/failure status
 * - Never calls process.exit() or prompts() — throws on fatal errors
 *
 * @param config Structured config with repoUrl and optional environments list
 * @throws Error if GITHUB_TOKEN is missing, config is invalid, or project context not found
 */
export async function runInitializeGitHubNonInteractive(
  config: InitializeGitHubConfig
): Promise<InitializeGitHubResult> {
  // 1. Validate config
  const parsed = InitializeGitHubConfigSchema.safeParse(config);
  if (!parsed.success) {
    throw new Error(`Invalid config: ${parsed.error.message}`);
  }
  const validConfig = parsed.data;

  // 2. Read GITHUB_TOKEN from environment (CRED-01: credentials from env only)
  const token = process.env.GITHUB_TOKEN;
  if (!token || !token.trim()) {
    throw new Error(
      'GITHUB_TOKEN environment variable is not set. Set it in your .mcp.json env block: { "env": { "GITHUB_TOKEN": "ghp_..." } }'
    );
  }

  // 3. Detect project context
  const context = await detectProjectContext();
  if (!context) {
    throw new Error(
      'Not inside a project directory. This command must be run from inside a project created with: npx create-aws-project <project-name>'
    );
  }

  // 4. Parse repo URL (handles owner/repo, HTTPS, and SSH formats)
  const repoInfo = parseGitHubUrl(validConfig.repoUrl);

  // 5. Determine which environments to configure
  const environments: string[] =
    validConfig.environments ??
    VALID_ENVIRONMENTS.filter(
      (env) => context.config.deploymentCredentials?.[env]
    );

  // 6. Create GitHub client once
  const client = createGitHubClient(token);

  // 7. Process each environment with individual try/catch for partial failure semantics
  const results: InitializeGitHubEnvResult[] = [];

  for (const env of environments) {
    try {
      const creds = context.config.deploymentCredentials?.[env];
      if (!creds) {
        results.push({
          environment: env,
          success: false,
          error: 'No deployment credentials found',
        });
        continue;
      }

      const githubEnvName = GITHUB_ENV_NAMES[env];
      await setEnvironmentCredentials(
        client,
        repoInfo.owner,
        repoInfo.repo,
        githubEnvName,
        creds.accessKeyId,
        creds.secretAccessKey
      );

      results.push({ environment: env, success: true });
    } catch (error) {
      results.push({
        environment: env,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return {
    results,
    successCount: results.filter((r) => r.success).length,
    totalCount: results.length,
  };
}
