/**
 * initialize-github command
 *
 * Configures GitHub Environment with AWS credentials for a single environment
 * Must be run from inside a project directory
 * Requires environment name as argument (dev, stage, prod)
 *
 * Full implementation in Phase 7
 */

import pc from 'picocolors';
import { requireProjectContext } from '../utils/project-context.js';

const VALID_ENVIRONMENTS = ['dev', 'stage', 'prod'] as const;
type Environment = (typeof VALID_ENVIRONMENTS)[number];

/**
 * Validates environment argument
 * @param env Environment name to validate
 * @returns true if valid, false otherwise
 */
function isValidEnvironment(env: string): env is Environment {
  return VALID_ENVIRONMENTS.includes(env as Environment);
}

/**
 * Runs the initialize-github command
 *
 * @param args Command arguments - expects environment name as first arg
 */
export async function runInitializeGitHub(args: string[]): Promise<void> {
  // Validate we're in a project directory
  const context = await requireProjectContext();

  // Validate environment argument
  const envArg = args[0];

  if (!envArg) {
    console.error(pc.red('Error:') + ' Environment name required.');
    console.error('');
    console.error('Usage:');
    console.error(`  ${pc.cyan('npx create-aws-project initialize-github <env>')}`);
    console.error('');
    console.error('Where <env> is one of: ' + VALID_ENVIRONMENTS.join(', '));
    console.error('');
    console.error('Example:');
    console.error(`  ${pc.cyan('npx create-aws-project initialize-github dev')}`);
    process.exit(1);
  }

  if (!isValidEnvironment(envArg)) {
    console.error(pc.red('Error:') + ` Invalid environment: ${pc.bold(envArg)}`);
    console.error('');
    console.error('Valid environments: ' + VALID_ENVIRONMENTS.join(', '));
    process.exit(1);
  }

  // Stub implementation - will be replaced in Phase 7
  console.log('');
  console.log(pc.cyan('initialize-github') + ` ${pc.bold(envArg)}`);
  console.log('');
  console.log(`Project: ${pc.bold(context.config.projectName)}`);
  console.log(`Environment: ${pc.bold(envArg)}`);
  console.log(`Config: ${context.configPath}`);
  console.log('');
  console.log(pc.yellow('This command will be implemented in Phase 7.'));
  console.log('');
  console.log('It will:');
  console.log(`  1. Create IAM deployment user for ${envArg} environment`);
  console.log(`  2. Configure GitHub Environment with AWS credentials`);
  console.log(`  3. Validate environment exists in project config`);
}
