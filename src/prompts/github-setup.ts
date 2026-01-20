import prompts from 'prompts';
import type { PromptObject } from 'prompts';
import pc from 'picocolors';

/**
 * GitHub setup prompts module
 *
 * Provides prompts for the setup-github command to collect
 * configuration for IAM deployment users and GitHub secrets.
 */

/**
 * Configuration for an environment with AWS profile
 */
export interface EnvironmentConfig {
  environment: string;
  accountId: string;
  awsProfile: string;
}

/**
 * Complete configuration from the GitHub setup wizard
 */
export interface GitHubSetupConfig {
  projectName: string;
  awsRegion: string;
  environments: EnvironmentConfig[];
  github: {
    owner: string;
    repo: string;
    token: string;
  };
}

/**
 * Validates kebab-case project name
 */
function isKebabCase(value: string): boolean {
  return /^[a-z][a-z0-9-]*[a-z0-9]$/.test(value) || /^[a-z]$/.test(value);
}

/**
 * Project name prompt - used as prefix for IAM users
 */
export const projectNamePrompt: PromptObject = {
  type: 'text',
  name: 'projectName',
  message: 'Project name (used as prefix for IAM users):',
  validate: (value: string) => {
    if (!value.trim()) return 'Project name is required';
    if (value.length > 20) return 'Project name must be 20 characters or less';
    if (!isKebabCase(value)) return 'Project name must be kebab-case (e.g., my-app)';
    return true;
  },
  format: (value: string) => value.trim().toLowerCase(),
};

/**
 * AWS region selection prompt
 */
export const awsRegionPrompt: PromptObject = {
  type: 'select',
  name: 'awsRegion',
  message: 'AWS Region:',
  choices: [
    { title: 'US East (N. Virginia) - us-east-1', value: 'us-east-1' },
    { title: 'US West (Oregon) - us-west-2', value: 'us-west-2' },
    { title: 'EU (Ireland) - eu-west-1', value: 'eu-west-1' },
    { title: 'EU (Frankfurt) - eu-central-1', value: 'eu-central-1' },
    { title: 'Asia Pacific (Tokyo) - ap-northeast-1', value: 'ap-northeast-1' },
    { title: 'Asia Pacific (Sydney) - ap-southeast-2', value: 'ap-southeast-2' },
  ],
  initial: 0,
};

/**
 * Environments multiselect prompt
 */
export const environmentsPrompt: PromptObject = {
  type: 'multiselect',
  name: 'environments',
  message: 'Select environments to configure:',
  choices: [
    { title: 'dev', value: 'dev', selected: true },
    { title: 'stage', value: 'stage', selected: true },
    { title: 'prod', value: 'prod', selected: true },
  ],
  hint: '- Space to toggle, Enter to confirm',
  min: 1,
};

/**
 * Validates 12-digit AWS account ID
 */
function isValidAccountId(value: string): boolean {
  return /^\d{12}$/.test(value);
}

/**
 * Creates account ID prompt for a specific environment
 */
function createAccountIdPrompt(environment: string): PromptObject {
  return {
    type: 'text',
    name: `accountId_${environment}`,
    message: `AWS Account ID for ${environment}:`,
    validate: (value: string) => {
      if (!value.trim()) return 'Account ID is required';
      if (!isValidAccountId(value.trim())) return 'Account ID must be a 12-digit number';
      return true;
    },
    format: (value: string) => value.trim(),
  };
}

/**
 * Creates AWS profile prompt for a specific environment
 */
function createAwsProfilePrompt(environment: string): PromptObject {
  return {
    type: 'text',
    name: `awsProfile_${environment}`,
    message: `AWS profile for ${environment} account:`,
    initial: 'default',
    format: (value: string) => value.trim() || 'default',
  };
}

/**
 * GitHub repository prompt - accepts various formats
 */
export const githubRepoPrompt: PromptObject = {
  type: 'text',
  name: 'githubRepo',
  message: 'GitHub repository (owner/repo or URL):',
  validate: (value: string) => {
    if (!value.trim()) return 'Repository is required';
    // Try to parse the URL to validate format
    const trimmed = value.trim();
    const cleanUrl = trimmed.replace(/\/$/, '').replace(/\.git$/, '');

    // Check supported formats
    const httpsMatch = cleanUrl.match(/^https?:\/\/github\.com\/([^/]+)\/([^/]+)$/);
    const sshMatch = cleanUrl.match(/^git@github\.com:([^/]+)\/([^/]+)$/);
    const shortMatch = cleanUrl.match(/^([^/]+)\/([^/]+)$/);

    if (!httpsMatch && !sshMatch && !shortMatch) {
      return 'Invalid format. Use: owner/repo, https://github.com/owner/repo, or git@github.com:owner/repo';
    }
    return true;
  },
  format: (value: string) => value.trim(),
};

/**
 * GitHub Personal Access Token prompt
 */
export const githubTokenPrompt: PromptObject = {
  type: 'password',
  name: 'githubToken',
  message: 'GitHub Personal Access Token (requires "repo" scope):',
  validate: (value: string) => {
    if (!value.trim()) return 'Token is required';
    return true;
  },
};

/**
 * Parses GitHub repository string to owner/repo
 */
function parseGitHubRepo(url: string): { owner: string; repo: string } {
  const cleanUrl = url.trim().replace(/\/$/, '').replace(/\.git$/, '');

  // Format: https://github.com/owner/repo
  const httpsMatch = cleanUrl.match(/^https?:\/\/github\.com\/([^/]+)\/([^/]+)$/);
  if (httpsMatch) {
    return { owner: httpsMatch[1], repo: httpsMatch[2] };
  }

  // Format: git@github.com:owner/repo
  const sshMatch = cleanUrl.match(/^git@github\.com:([^/]+)\/([^/]+)$/);
  if (sshMatch) {
    return { owner: sshMatch[1], repo: sshMatch[2] };
  }

  // Format: owner/repo
  const shortMatch = cleanUrl.match(/^([^/]+)\/([^/]+)$/);
  if (shortMatch) {
    return { owner: shortMatch[1], repo: shortMatch[2] };
  }

  throw new Error(`Unable to parse GitHub URL: ${url}`);
}

/**
 * Runs the complete GitHub setup wizard
 * @returns Configuration object or null if cancelled
 */
export async function runGitHubSetupWizard(): Promise<GitHubSetupConfig | null> {
  let cancelled = false;

  const onCancel = () => {
    cancelled = true;
    return false;
  };

  // Step 1: Basic configuration
  const basicResponse = await prompts(
    [projectNamePrompt, awsRegionPrompt, environmentsPrompt],
    { onCancel }
  );

  if (cancelled || !basicResponse.projectName || !basicResponse.environments?.length) {
    return null;
  }

  const selectedEnvironments: string[] = basicResponse.environments;

  // Step 2: Account IDs and AWS profiles for each environment
  const environmentPrompts: PromptObject[] = [];
  for (const env of selectedEnvironments) {
    environmentPrompts.push(createAccountIdPrompt(env));
    environmentPrompts.push(createAwsProfilePrompt(env));
  }

  const environmentResponse = await prompts(environmentPrompts, { onCancel });

  if (cancelled) {
    return null;
  }

  // Validate all environment data was collected
  for (const env of selectedEnvironments) {
    if (!environmentResponse[`accountId_${env}`]) {
      return null;
    }
  }

  // Step 3: GitHub configuration
  const githubResponse = await prompts([githubRepoPrompt, githubTokenPrompt], { onCancel });

  if (cancelled || !githubResponse.githubRepo || !githubResponse.githubToken) {
    return null;
  }

  // Parse GitHub repo
  const { owner, repo } = parseGitHubRepo(githubResponse.githubRepo);

  // Build environments array
  const environments: EnvironmentConfig[] = selectedEnvironments.map((env) => ({
    environment: env,
    accountId: environmentResponse[`accountId_${env}`],
    awsProfile: environmentResponse[`awsProfile_${env}`] || 'default',
  }));

  return {
    projectName: basicResponse.projectName,
    awsRegion: basicResponse.awsRegion,
    environments,
    github: {
      owner,
      repo,
      token: githubResponse.githubToken,
    },
  };
}
