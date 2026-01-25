import ora from 'ora';
import pc from 'picocolors';
import { getConfigsByTier, getConfigByName, TEST_MATRIX, type TestTier, type TestConfiguration } from './fixtures/index.js';
import { validateGeneratedProject, type ValidationResult } from './validate-project.js';

// CI detection: disable spinner animations in CI environments
const isCI = process.env.CI === 'true' || !process.stdout.isTTY;

export async function runValidationSuite(tier: TestTier = 'core'): Promise<void> {
  const configs = getConfigsByTier(tier);
  const results: ValidationResult[] = [];
  const spinner = isCI ? null : ora();

  console.log(pc.bold(`\nRunning ${configs.length} validation tests (tier: ${tier})\n`));

  for (let i = 0; i < configs.length; i++) {
    const config = configs[i];
    const progress = `Testing ${i + 1}/${configs.length}: ${config.name}`;

    // Show progress indicator
    if (spinner) {
      spinner.start(progress);
    } else {
      console.log(progress);
    }

    try {
      const result = await validateGeneratedProject(config.config);
      results.push(result);

      if (result.success) {
        if (spinner) {
          spinner.succeed(pc.green(progress));
        } else {
          console.log(pc.green(`✓ PASS: ${progress}`));
        }
      } else {
        const failMsg = `${progress} (failed at ${result.failedStep})`;
        if (spinner) {
          spinner.fail(pc.red(failMsg));
        } else {
          console.error(pc.red(`✗ FAIL: ${failMsg}`));
        }

        // Display error output immediately after failure
        const failedStep = result.steps.find(s => !s.success);
        if (failedStep) {
          console.error(pc.red('\n--- Error Output ---'));
          console.error(failedStep.output);
          console.error(pc.red('--- End Error Output ---\n'));
        }
      }
    } catch (error) {
      const exceptionMsg = `${progress} (exception)`;
      if (spinner) {
        spinner.fail(pc.red(exceptionMsg));
      } else {
        console.error(pc.red(`✗ FAIL: ${exceptionMsg}`));
      }
      console.error(error);

      // Push a failed result for the summary
      results.push({
        success: false,
        steps: [],
        totalDuration: 0,
      });
    } finally {
      // Ensure spinner is stopped even on exception
      if (spinner && spinner.isSpinning) {
        spinner.stop();
      }
    }
  }

  // Display summary table
  displaySummary(results, configs);

  // Exit with appropriate code for CI integration
  const allPassed = results.every(r => r.success);
  process.exit(allPassed ? 0 : 1);
}

async function runSingleConfig(configName: string): Promise<void> {
  const spinner = isCI ? null : ora();

  console.log(pc.bold(`\nRunning single configuration: ${configName}\n`));

  const testConfig = getConfigByName(configName);
  const progress = `Testing: ${testConfig.name}`;

  // Show progress indicator
  if (spinner) {
    spinner.start(progress);
  } else {
    console.log(progress);
  }

  try {
    const result = await validateGeneratedProject(testConfig.config);

    if (result.success) {
      if (spinner) {
        spinner.succeed(pc.green(progress));
      } else {
        console.log(pc.green(`✓ PASS: ${progress}`));
      }
    } else {
      const failMsg = `${progress} (failed at ${result.failedStep})`;
      if (spinner) {
        spinner.fail(pc.red(failMsg));
      } else {
        console.error(pc.red(`✗ FAIL: ${failMsg}`));
      }

      // Display error output immediately after failure
      const failedStep = result.steps.find(s => !s.success);
      if (failedStep) {
        console.error(pc.red('\n--- Error Output ---'));
        console.error(failedStep.output);
        console.error(pc.red('--- End Error Output ---\n'));
      }
    }

    // Display summary table
    displaySummary([result], [testConfig]);

    // Exit with appropriate code for CI integration
    process.exit(result.success ? 0 : 1);
  } catch (error) {
    const exceptionMsg = `${progress} (exception)`;
    if (spinner) {
      spinner.fail(pc.red(exceptionMsg));
    } else {
      console.error(pc.red(`✗ FAIL: ${exceptionMsg}`));
    }
    console.error(error);

    process.exit(1);
  } finally {
    // Ensure spinner is stopped even on exception
    if (spinner && spinner.isSpinning) {
      spinner.stop();
    }
  }
}

function displaySummary(results: ValidationResult[], configs: TestConfiguration[]): void {
  const rows = results.map((result, i) => ({
    config: configs[i].name,
    status: result.success ? pc.green('✓ PASS') : pc.red('✗ FAIL'),
    failedStep: result.failedStep ?? '-',
    duration: `${(result.totalDuration / 1000).toFixed(1)}s`,
  }));

  console.log(pc.bold('\n=== Validation Summary ===\n'));
  console.table(rows);

  const passed = results.filter(r => r.success).length;
  const total = results.length;
  const passRate = total > 0 ? ((passed / total) * 100).toFixed(1) : '0.0';

  console.log(pc.bold(`\nResults: ${passed}/${total} passed (${passRate}%)`));
}

// CLI entry point - parse tier or config name argument and run
const arg = process.argv[2] ?? 'core';

// Validate argument - check if it's a valid tier or config name
const validTiers: TestTier[] = ['smoke', 'core', 'full'];
const validConfigNames = TEST_MATRIX.map(c => c.name);

if (validTiers.includes(arg as TestTier)) {
  // It's a tier - run the validation suite
  runValidationSuite(arg as TestTier).catch((error) => {
    console.error(pc.red('\nFatal error during validation:'));
    console.error(error);
    process.exit(1);
  });
} else if (validConfigNames.includes(arg)) {
  // It's a specific config name - run single config
  runSingleConfig(arg).catch((error) => {
    console.error(pc.red('\nFatal error during validation:'));
    console.error(error);
    process.exit(1);
  });
} else {
  // Invalid argument - show error with all valid options
  console.error(pc.red(`\nError: Invalid argument "${arg}"`));
  console.error(pc.bold('\nValid tiers:'));
  console.error(`  ${validTiers.join(', ')}`);
  console.error(pc.bold('\nValid configuration names:'));
  console.error(`  ${validConfigNames.join(', ')}`);
  console.error('');
  process.exit(1);
}
