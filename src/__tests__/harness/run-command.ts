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
  } catch (error: any) {
    return {
      success: false,
      exitCode: error.exitCode ?? 1,
      output: error.all ?? error.message,
    };
  }
}
