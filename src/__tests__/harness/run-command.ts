import { execa } from 'execa';

export interface CommandResult {
  success: boolean;
  exitCode: number;
  output: string;
}

export async function runCommand(
  command: string,
  args: string[],
  cwd: string
): Promise<CommandResult> {
  try {
    const result = await execa(command, args, {
      cwd,
      all: true,
    });
    return {
      success: true,
      exitCode: result.exitCode ?? 0,
      output: result.all ?? '',
    };
  } catch (error) {
    const execaError = error as { exitCode?: number; all?: string; message?: string };
    return {
      success: false,
      exitCode: execaError.exitCode ?? 1,
      output: execaError.all ?? execaError.message ?? '',
    };
  }
}
