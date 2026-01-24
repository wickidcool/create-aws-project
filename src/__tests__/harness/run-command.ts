import { execa } from 'execa';

export interface CommandResult {
  success: boolean;
  exitCode: number;
  output: string;
  timedOut: boolean;
}

export async function runCommand(
  command: string,
  args: string[],
  cwd: string,
  timeout: number = 600000 // 10 minutes default
): Promise<CommandResult> {
  try {
    const result = await execa(command, args, {
      cwd,
      all: true,
      timeout,
    });
    return {
      success: true,
      exitCode: result.exitCode ?? 0,
      output: result.all ?? '',
      timedOut: false,
    };
  } catch (error) {
    const execaError = error as {
      exitCode?: number;
      all?: string;
      message?: string;
      timedOut?: boolean;
    };
    return {
      success: false,
      exitCode: execaError.exitCode ?? 1,
      output: execaError.all ?? execaError.message ?? '',
      timedOut: execaError.timedOut ?? false,
    };
  }
}
