export interface CliContextResult<T> {
  result: T;
  capturedOutput: string;
}

export async function withCliContext<T>(
  fn: () => Promise<T>
): Promise<CliContextResult<T>> {
  const chunks: Buffer[] = [];
  let interceptedExitCode: number | undefined;

  const originalWrite = process.stdout.write.bind(process.stdout);
  const originalExit = process.exit.bind(process);

  (process.stdout.write as unknown) = (
    chunk: string | Uint8Array,
    encodingOrCallback?: BufferEncoding | ((err?: Error | null) => void),
    callback?: (err?: Error | null) => void
  ): boolean => {
    if (typeof chunk === "string") {
      chunks.push(Buffer.from(chunk, "utf8"));
    } else {
      chunks.push(Buffer.from(chunk));
    }

    const cb =
      typeof encodingOrCallback === "function" ? encodingOrCallback : callback;
    if (cb) cb();
    return true;
  };

  (process.exit as unknown) = (code?: number): never => {
    interceptedExitCode = code ?? 0;
    throw new Error(`process.exit(${interceptedExitCode}) intercepted`);
  };

  try {
    const result = await fn();
    return { result, capturedOutput: Buffer.concat(chunks).toString("utf8") };
  } catch (err) {
    if (interceptedExitCode !== undefined) {
      throw new Error(`Command failed with exit code ${interceptedExitCode}`);
    }
    throw err;
  } finally {
    (process.stdout.write as unknown) = originalWrite;
    (process.exit as unknown) = originalExit;
  }
}
