import { jest } from "@jest/globals";
import { withCliContext } from "../../utils/cli-context.js";

describe("withCliContext", () => {
  it("captures stdout writes and returns result", async () => {
    const { result, capturedOutput } = await withCliContext(async () => {
      process.stdout.write("hello");
      return 42;
    });

    expect(result).toBe(42);
    expect(capturedOutput).toBe("hello");
  });

  it("captures multiple stdout writes", async () => {
    const { capturedOutput } = await withCliContext(async () => {
      process.stdout.write("foo");
      process.stdout.write("bar");
      process.stdout.write("baz");
    });

    expect(capturedOutput).toBe("foobarbaz");
  });

  it("does not leak stdout writes to real stdout", async () => {
    // Capture the reference to process.stdout.write that exists before we enter withCliContext
    // withCliContext replaces it with a capture function; writes inside must NOT reach this reference
    const writesBeforeContext: string[] = [];
    const sentinelWrite = (chunk: string | Uint8Array): boolean => {
      writesBeforeContext.push(
        typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8")
      );
      return true;
    };

    const originalWrite = process.stdout.write;
    (process.stdout.write as unknown) = sentinelWrite;

    try {
      await withCliContext(async () => {
        // Inside here, process.stdout.write is the capture function, NOT sentinelWrite
        process.stdout.write("should be captured, not leaked");
      });

      // sentinelWrite should NOT have been called inside the wrapped function
      expect(writesBeforeContext).toHaveLength(0);
    } finally {
      (process.stdout.write as unknown) = originalWrite;
    }
  });

  it("intercepts process.exit and throws", async () => {
    await expect(
      withCliContext(async () => {
        process.exit(1);
      })
    ).rejects.toThrow("exit code 1");
  });

  it("restores process.stdout.write after success", async () => {
    const writeBefore = process.stdout.write;

    await withCliContext(async () => {
      // simple successful function
    });

    expect(process.stdout.write).toBe(writeBefore);
  });

  it("restores process.stdout.write after error", async () => {
    const writeBefore = process.stdout.write;

    await expect(
      withCliContext(async () => {
        throw new Error("intentional error");
      })
    ).rejects.toThrow("intentional error");

    expect(process.stdout.write).toBe(writeBefore);
  });

  it("restores process.exit after exit interception", async () => {
    const exitBefore = process.exit;

    await expect(
      withCliContext(async () => {
        process.exit(0);
      })
    ).rejects.toThrow("exit code 0");

    expect(process.exit).toBe(exitBefore);
  });
});

// Keep jest import used (suppress unused warning)
void jest;
