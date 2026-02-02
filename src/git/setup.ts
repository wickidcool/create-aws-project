import { execSync } from 'node:child_process';
import prompts from 'prompts';
import ora from 'ora';
import pc from 'picocolors';
import { parseGitHubUrl, createGitHubClient } from '../github/secrets.js';

/**
 * Git setup module
 *
 * Provides optional GitHub repository setup after project generation.
 * Users can push their generated project to GitHub in the same wizard flow.
 * Fully optional - pressing Enter skips all git operations.
 */

/**
 * Checks if git is available on the system
 * @returns true if git is installed and available, false otherwise
 */
export function isGitAvailable(): boolean {
  try {
    execSync('git --version', { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Prompts user for optional GitHub repository setup
 * @returns Repository URL and PAT if user wants git setup, null if skipped
 */
export async function promptGitSetup(): Promise<{ repoUrl: string; pat: string } | null> {
  // Skip if git is not available
  if (!isGitAvailable()) {
    return null;
  }

  console.log('');
  console.log(pc.bold('GitHub Repository (optional)'));
  console.log(pc.dim('Push your project to a GitHub repository. Press Enter to skip.'));
  console.log('');

  // Prompt for repo URL
  const repoResponse = await prompts({
    type: 'text',
    name: 'repoUrl',
    message: 'GitHub repository URL:',
  });

  const repoUrl = repoResponse.repoUrl?.trim();
  if (!repoUrl) {
    return null; // User skipped
  }

  // Validate the URL
  try {
    parseGitHubUrl(repoUrl);
  } catch (error) {
    if (error instanceof Error) {
      console.log(pc.red('Error: ') + error.message);
    }
    return null;
  }

  // Prompt for PAT
  const patResponse = await prompts(
    {
      type: 'password',
      name: 'pat',
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
        // User cancelled PAT prompt
        return;
      },
    }
  );

  if (!patResponse.pat) {
    return null; // User cancelled
  }

  return { repoUrl, pat: patResponse.pat };
}

/**
 * Sets up git repository with initial commit and pushes to GitHub
 * Creates the remote repository if it doesn't exist
 * @param projectDir - Path to the project directory
 * @param repoUrl - GitHub repository URL
 * @param pat - GitHub Personal Access Token
 */
export async function setupGitRepository(
  projectDir: string,
  repoUrl: string,
  pat: string
): Promise<void> {
  const spinner = ora();

  try {
    // Parse the URL
    const { owner, repo } = parseGitHubUrl(repoUrl);

    // Create Octokit client
    const octokit = createGitHubClient(pat);

    // Git init
    spinner.start('Initializing git repository...');
    execSync('git init -b main', { cwd: projectDir, stdio: 'pipe' });

    // Check for git user config, set if not configured
    try {
      execSync('git config user.name', { cwd: projectDir, stdio: 'pipe' });
    } catch {
      // User config not set, use defaults
      execSync('git config user.name "create-aws-project"', { cwd: projectDir, stdio: 'pipe' });
      execSync('git config user.email "noreply@create-aws-project"', { cwd: projectDir, stdio: 'pipe' });
    }

    execSync('git add .', { cwd: projectDir, stdio: 'pipe' });
    execSync('git commit -m "Initial commit from create-aws-project"', { cwd: projectDir, stdio: 'pipe' });
    spinner.succeed('Git repository initialized');

    // Ensure remote repo exists
    spinner.start('Checking GitHub repository...');
    try {
      await octokit.rest.repos.get({ owner, repo });
      spinner.succeed(`Repository ${owner}/${repo} found`);
    } catch (error: any) {
      if (error.status === 404) {
        // Repo doesn't exist, create it
        const { data: user } = await octokit.rest.users.getAuthenticated();
        if (owner === user.login) {
          // Create in user's account
          await octokit.rest.repos.createForAuthenticatedUser({
            name: repo,
            private: true,
            auto_init: false,
          });
        } else {
          // Create in organization
          await octokit.rest.repos.createInOrg({
            org: owner,
            name: repo,
            private: true,
            auto_init: false,
          });
        }
        spinner.succeed(`Created repository ${owner}/${repo}`);
      } else {
        throw error;
      }
    }

    // Push to remote
    spinner.start('Pushing to GitHub...');
    const authUrl = `https://${pat}@github.com/${owner}/${repo}.git`;
    execSync(`git remote add origin ${authUrl}`, { cwd: projectDir, stdio: 'pipe' });
    execSync('git push -u origin main', { cwd: projectDir, stdio: 'pipe' });

    // CRITICAL: Remove PAT from .git/config
    const cleanUrl = `https://github.com/${owner}/${repo}.git`;
    execSync(`git remote set-url origin ${cleanUrl}`, { cwd: projectDir, stdio: 'pipe' });

    spinner.succeed(`Pushed to ${owner}/${repo}`);
  } catch (error) {
    // Git setup failure should not prevent the user from using their project
    if (spinner.isSpinning) {
      spinner.fail();
    }

    console.log(pc.yellow('Warning:') + ' Git setup failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
    console.log(pc.dim('Your project was created successfully. You can set up git manually.'));
  }
}
