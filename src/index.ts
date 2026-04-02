#!/usr/bin/env node

// Named exports for programmatic use (MCP package)
export { runCreateProjectNonInteractive } from './cli.js';
export type { CreateProjectOptions } from './cli.js';

export { runSetupAwsEnvsNonInteractive } from './commands/setup-aws-envs.js';
export type { SetupAwsEnvsNonInteractiveConfig } from './commands/setup-aws-envs.js';

export { runInitializeGitHubNonInteractive } from './commands/initialize-github.js';
export type {
  InitializeGitHubConfig,
  InitializeGitHubResult,
  InitializeGitHubEnvResult,
} from './commands/initialize-github.js';

// CLI entry point — only runs when this file is the main module
import { fileURLToPath } from 'node:url';
import { run } from './cli.js';

const isMainModule = process.argv[1] === fileURLToPath(import.meta.url);
if (isMainModule) {
  run().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
