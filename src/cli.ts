import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import pc from 'picocolors';
import { runWizard } from './wizard.js';
import { generateProject } from './generator/index.js';
import {
  createOrganizationsClient,
  checkExistingOrganization,
  createOrganization,
  createEnvironmentAccounts,
} from './aws/organizations.js';
import { showDeprecationNotice } from './commands/setup-github.js';

/**
 * Get the version from package.json
 */
function getVersion(): string {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const packageJsonPath = join(__dirname, '..', 'package.json');
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
  return packageJson.version;
}

/**
 * Print help message
 */
function printHelp(): void {
  console.log(`
create-aws-starter-kit [command] [options]

Scaffold a new AWS Starter Kit project with React, Lambda, and CDK infrastructure.

Commands:
  (default)           Create a new project (interactive wizard)
  setup-aws-envs      Set up AWS Organizations and environment accounts
  initialize-github   Configure GitHub Environment for deployment
  setup-github        ${pc.dim('[DEPRECATED]')} Use initialize-github instead

Options:
  --help, -h          Show this help message
  --version, -v       Show version number

Usage:
  create-aws-starter-kit                         Run interactive wizard
  create-aws-starter-kit setup-aws-envs          Create AWS accounts
  create-aws-starter-kit initialize-github dev   Configure dev environment

Examples:
  create-aws-starter-kit my-app
  create-aws-starter-kit setup-aws-envs
  create-aws-starter-kit initialize-github dev
  create-aws-starter-kit --help
`.trim());
}

/**
 * Print welcome banner
 */
function printWelcome(): void {
  console.log(`
╔═══════════════════════════════════════════════════════╗
║                                                       ║
║            create-aws-starter-kit                     ║
║       AWS Starter Kit Project Generator               ║
║                                                       ║
╚═══════════════════════════════════════════════════════╝
`.trim());
}

/**
 * Print post-generation instructions
 */
function printNextSteps(projectName: string, platforms: string[]): void {
  console.log('');
  console.log(pc.bold('Next steps:'));
  console.log('');
  console.log(`  ${pc.cyan('cd')} ${projectName}`);
  console.log(`  ${pc.cyan('npm install')}`);
  console.log('');

  if (platforms.includes('web')) {
    console.log(`  ${pc.gray('# Start web app')}`);
    console.log(`  ${pc.cyan('npm run web')}`);
    console.log('');
  }

  if (platforms.includes('mobile')) {
    console.log(`  ${pc.gray('# Start mobile app')}`);
    console.log(`  ${pc.cyan('npm run mobile')}`);
    console.log('');
  }

  if (platforms.includes('api')) {
    console.log(`  ${pc.gray('# Deploy API')}`);
    console.log(`  ${pc.cyan('npm run cdk:deploy')}`);
    console.log('');
  }

  console.log(pc.gray('Happy coding!'));
}

/**
 * Run the create project wizard flow
 * This is the default command when no subcommand is specified
 */
async function runCreate(_args: string[]): Promise<void> {
  printWelcome();
  console.log('');  // blank line after banner

  const config = await runWizard();

  if (!config) {
    console.log('\nProject creation cancelled.');
    process.exit(1);
  }

  // Set up AWS Organizations if enabled
  if (config.org?.enabled) {
    console.log('');
    console.log(pc.cyan('Setting up AWS Organizations...'));

    try {
      const orgClient = createOrganizationsClient(config.awsRegion);

      // Check if already in an organization
      const existingOrgId = await checkExistingOrganization(orgClient);

      if (existingOrgId) {
        console.log(pc.yellow(`Already in organization: ${existingOrgId}`));
        console.log(pc.dim('Proceeding with existing organization...'));
      } else {
        // Create new organization
        console.log(pc.dim('Creating new AWS Organization...'));
        const orgId = await createOrganization(orgClient);
        console.log(pc.green('✔') + ` Organization created: ${orgId}`);
      }

      // Create environment accounts
      const accountResults = await createEnvironmentAccounts(
        orgClient,
        config.org.organizationName,
        config.org.accounts
      );

      // Update config.org.accounts with returned accountIds
      for (const result of accountResults) {
        const account = config.org.accounts.find(
          (a) => a.environment === result.environment
        );
        if (account) {
          account.accountId = result.accountId;
        }
      }

      console.log('');
      console.log(pc.green('✔') + ' AWS Organizations setup complete');
      console.log(pc.dim('Account IDs:'));
      for (const account of config.org.accounts) {
        console.log(pc.dim(`  ${account.environment}: ${account.accountId}`));
      }
    } catch (error) {
      console.log('');

      // Handle specific AWS errors
      if (error instanceof Error) {
        if (
          error.name === 'CredentialsProviderError' ||
          error.message.includes('Could not load credentials')
        ) {
          console.log(pc.red('Error:') + ' AWS credentials not configured.');
          console.log('');
          console.log('Please configure AWS credentials using one of these methods:');
          console.log('  1. Run: ' + pc.cyan('aws configure'));
          console.log('  2. Set environment variables: ' + pc.cyan('AWS_ACCESS_KEY_ID') + ' and ' + pc.cyan('AWS_SECRET_ACCESS_KEY'));
          console.log('  3. Use an AWS profile: ' + pc.cyan('export AWS_PROFILE=your-profile'));
          process.exit(1);
        }

        if (
          error.name === 'AccessDeniedException' ||
          error.message.includes('not authorized')
        ) {
          console.log(pc.red('Error:') + ' Insufficient AWS permissions.');
          console.log('');
          console.log('Required IAM permissions for AWS Organizations:');
          console.log('  - ' + pc.cyan('organizations:CreateOrganization'));
          console.log('  - ' + pc.cyan('organizations:DescribeOrganization'));
          console.log('  - ' + pc.cyan('organizations:CreateAccount'));
          console.log('  - ' + pc.cyan('organizations:DescribeCreateAccountStatus'));
          process.exit(1);
        }

        // Log which account failed if it's an account creation error
        if (error.message.includes('Failed to create')) {
          console.log(pc.red('Error:') + ` ${error.message}`);
          process.exit(1);
        }
      }

      // Generic error
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.log(pc.red('Error:') + ` AWS Organizations setup failed: ${message}`);
      process.exit(1);
    }
  }

  // Determine output directory
  const outputDir = resolve(process.cwd(), config.projectName);

  // Check if directory already exists
  if (existsSync(outputDir)) {
    console.log('');
    console.log(pc.red('Error:') + ` Directory ${pc.cyan(config.projectName)} already exists.`);
    console.log('Please choose a different project name or remove the existing directory.');
    process.exit(1);
  }

  // Create project directory
  mkdirSync(outputDir, { recursive: true });

  // Generate project
  console.log('');
  await generateProject(config, outputDir);

  // Success message and next steps
  console.log('');
  console.log(pc.green('✔') + ` Created ${pc.bold(config.projectName)} successfully!`);

  printNextSteps(config.projectName, config.platforms);

  process.exit(0);
}

/**
 * Parse command line arguments and run the CLI
 */
export async function run(): Promise<void> {
  const args = process.argv.slice(2);

  // Check for --help or -h
  if (args.includes('--help') || args.includes('-h')) {
    printHelp();
    process.exit(0);
  }

  // Check for --version or -v
  if (args.includes('--version') || args.includes('-v')) {
    console.log(getVersion());
    process.exit(0);
  }

  // Find the command (first non-flag argument)
  const commandIndex = args.findIndex((arg) => !arg.startsWith('-'));
  const command = commandIndex !== -1 ? args[commandIndex] : undefined;
  const commandArgs = commandIndex !== -1 ? args.slice(commandIndex + 1) : [];

  // Route to appropriate command handler
  switch (command) {
    case 'setup-aws-envs':
      // Placeholder for Phase 6
      console.log(pc.cyan('setup-aws-envs') + ' command (coming in Phase 6)');
      console.log(pc.dim('This will set up AWS Organizations and environment accounts.'));
      process.exit(0);
      break;

    case 'initialize-github':
      // Placeholder for Phase 7
      console.log(pc.cyan('initialize-github') + ' command (coming in Phase 7)');
      if (commandArgs[0]) {
        console.log(pc.dim(`Environment: ${commandArgs[0]}`));
      }
      console.log(pc.dim('This will configure GitHub Environment for deployment.'));
      process.exit(0);
      break;

    case 'setup-github':
      // Deprecated command - show notice and exit
      showDeprecationNotice();
      break;

    default:
      // Default: run interactive create wizard
      // This handles both no command and unknown commands
      await runCreate(args);
      break;
  }
}
