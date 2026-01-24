import { withTempDir } from './temp-dir.js';
import { runCommand } from './run-command.js';
import { generateProject } from '../../generator/generate-project.js';
import type { ProjectConfig } from '../../types.js';

export interface ValidationStepResult {
  step: 'install' | 'build' | 'test';
  success: boolean;
  exitCode: number;
  output: string;
  timedOut: boolean;
  duration: number;
}

export interface ValidationResult {
  success: boolean;
  failedStep?: 'install' | 'build' | 'test';
  steps: ValidationStepResult[];
  totalDuration: number;
}

export async function validateGeneratedProject(
  config: ProjectConfig,
  timeout: number = 600000 // 10 minutes per step
): Promise<ValidationResult> {
  return withTempDir('validate-', async (dir) => {
    const steps: ValidationStepResult[] = [];
    const overallStart = Date.now();

    // Generate project into temp directory
    await generateProject(config, dir, { onProgress: () => {} });

    // Step 1: npm install (generated projects don't have package-lock.json)
    const installStart = Date.now();
    const installResult = await runCommand('npm', ['install'], dir, timeout);
    const installDuration = Date.now() - installStart;

    steps.push({
      step: 'install',
      success: installResult.success,
      exitCode: installResult.exitCode,
      output: installResult.output,
      timedOut: installResult.timedOut,
      duration: installDuration,
    });

    if (!installResult.success) {
      return {
        success: false,
        failedStep: 'install',
        steps,
        totalDuration: Date.now() - overallStart,
      };
    }

    // Step 2: npm run build:all (generated projects use Nx run-many)
    const buildStart = Date.now();
    const buildResult = await runCommand('npm', ['run', 'build:all'], dir, timeout);
    const buildDuration = Date.now() - buildStart;

    steps.push({
      step: 'build',
      success: buildResult.success,
      exitCode: buildResult.exitCode,
      output: buildResult.output,
      timedOut: buildResult.timedOut,
      duration: buildDuration,
    });

    if (!buildResult.success) {
      return {
        success: false,
        failedStep: 'build',
        steps,
        totalDuration: Date.now() - overallStart,
      };
    }

    // Step 3: npm test
    const testStart = Date.now();
    const testResult = await runCommand('npm', ['test'], dir, timeout);
    const testDuration = Date.now() - testStart;

    steps.push({
      step: 'test',
      success: testResult.success,
      exitCode: testResult.exitCode,
      output: testResult.output,
      timedOut: testResult.timedOut,
      duration: testDuration,
    });

    if (!testResult.success) {
      return {
        success: false,
        failedStep: 'test',
        steps,
        totalDuration: Date.now() - overallStart,
      };
    }

    // All steps passed
    return {
      success: true,
      steps,
      totalDuration: Date.now() - overallStart,
    };
  });
}
