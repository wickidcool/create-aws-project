import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import pc from 'picocolors';
import { runWizard } from './wizard.js';
import { generateProject } from './generator/index.js';
import type { ProjectConfig } from './types.js';
import { showDeprecationNotice } from './commands/setup-github.js';
import { runSetupAwsEnvs } from './commands/setup-aws-envs.js';
import { runInitializeGitHub } from './commands/initialize-github.js';

/**
 * Config file structure for .aws-starter-config.json
 */
interface AwsStarterConfig {
  configVersion: string;
  projectName: string;
  platforms: string[];
  authProvider: string;
  features: string[];
  awsRegion: string;
  theme: string;
  createdAt: string;
  accounts: Record<string, string>;
}

/**
 * Write project configuration file for downstream commands
 */
function writeConfigFile(outputDir: string, config: ProjectConfig): void {
  const configContent: AwsStarterConfig = {
    configVersion: '1.0',
    projectName: config.projectName,
    platforms: config.platforms,
    authProvider: config.auth.provider,
    features: config.features,
    awsRegion: config.awsRegion,
    theme: config.brandColor,
    createdAt: new Date().toISOString(),
    accounts: {},
  };

  const configPath = join(outputDir, '.aws-starter-config.json');
  writeFileSync(configPath, JSON.stringify(configContent, null, 2), 'utf-8');
}

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

  console.log(`  ${pc.gray('# Configure AWS environments')}`);
  console.log(`  ${pc.cyan('npx create-aws-project setup-aws-envs')}`);
  console.log('');

  console.log(pc.gray('Happy coding!'));
}

/**
 * Run the create project wizard flow
 * This is the default command when no subcommand is specified
 */
async function runCreate(args: string[]): Promise<void> {
  printWelcome();
  console.log('');  // blank line after banner

  // Extract project name from CLI args (first non-flag argument)
  const nameArg = args.find(arg => !arg.startsWith('-'));

  const config = await runWizard(nameArg ? { defaultName: nameArg } : undefined);

  if (!config) {
    console.log('\nProject creation cancelled.');
    process.exit(1);
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

  // Write config file for downstream commands
  writeConfigFile(outputDir, config);

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
      await runSetupAwsEnvs(commandArgs);
      break;

    case 'initialize-github':
      await runInitializeGitHub(commandArgs);
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
