import ora from 'ora';
import pc from 'picocolors';
import { getConfigsByTier, type TestTier, type TestConfiguration } from './fixtures/index.js';
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

// CLI entry point - parse tier argument and run suite
const tier = (process.argv[2] as TestTier | undefined) ?? 'core';

// Validate tier argument
const validTiers: TestTier[] = ['smoke', 'core', 'full'];
if (!validTiers.includes(tier as TestTier)) {
  console.error(pc.red(`\nError: Invalid tier "${tier}". Valid options: ${validTiers.join(', ')}\n`));
  process.exit(1);
}

// Run the validation suite
runValidationSuite(tier).catch((error) => {
  console.error(pc.red('\nFatal error during validation:'));
  console.error(error);
  process.exit(1);
});
