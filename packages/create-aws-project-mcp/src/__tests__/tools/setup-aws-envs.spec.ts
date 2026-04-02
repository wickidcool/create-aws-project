import { describe, it, expect, jest, beforeEach, afterEach } from "@jest/globals";

// ────────────────────────────────────────────────────────────────────────────
// Mock: create-aws-project
// ────────────────────────────────────────────────────────────────────────────
const mockRunSetupAwsEnvsNonInteractive = jest.fn<
  (args: { email: string }) => Promise<void>
>();

jest.unstable_mockModule("create-aws-project", () => ({
  runSetupAwsEnvsNonInteractive: mockRunSetupAwsEnvsNonInteractive,
}));

// ────────────────────────────────────────────────────────────────────────────
// Mock: cli-context
// ────────────────────────────────────────────────────────────────────────────
const mockWithCliContext = jest.fn<
  <T>(fn: () => Promise<T>) => Promise<{ result: T; capturedOutput: string }>
>();

jest.unstable_mockModule("../../utils/cli-context.js", () => ({
  withCliContext: mockWithCliContext,
}));

// ────────────────────────────────────────────────────────────────────────────
// Mock: errors module
// ────────────────────────────────────────────────────────────────────────────
const mockRequireEnvVars = jest.fn<(vars: string[]) => void>();

class MockMissingCredentialsError extends Error {
  readonly type = "MISSING_CREDENTIALS" as const;
  readonly missingVars: string[];
  constructor(missingVars: string[]) {
    super(
      `Missing required credentials: ${missingVars.join(", ")}\n\nAdd them to your .mcp.json env block:\n\n${JSON.stringify(
        {
          mcpServers: {
            "create-aws-project": {
              env: Object.fromEntries(missingVars.map((v) => [v, "YOUR_VALUE_HERE"])),
            },
          },
        },
        null,
        2
      )}`
    );
    this.name = "MissingCredentialsError";
    this.missingVars = missingVars;
  }
}

jest.unstable_mockModule("../../tools/errors.js", () => ({
  requireEnvVars: mockRequireEnvVars,
  MissingCredentialsError: MockMissingCredentialsError,
}));

// ────────────────────────────────────────────────────────────────────────────
// Dynamic import after all mocks are set up
// ────────────────────────────────────────────────────────────────────────────
const { registerSetupAwsEnvsTool } = await import(
  "../../tools/setup-aws-envs.js"
);

// ────────────────────────────────────────────────────────────────────────────
// Helper: create a mock McpServer that captures registered handlers
// ────────────────────────────────────────────────────────────────────────────
type ToolHandler = (
  args: Record<string, unknown>,
  extra: {
    _meta?: { progressToken?: string | number };
    sendNotification: jest.MockedFunction<(n: unknown) => Promise<void>>;
  }
) => Promise<unknown>;

function createMockServer(): {
  registerTool: jest.MockedFunction<
    (name: string, schema: unknown, handler: ToolHandler) => void
  >;
  getHandler: (name: string) => ToolHandler;
} {
  const handlers = new Map<string, ToolHandler>();
  const registerTool = jest.fn(
    (name: string, _schema: unknown, handler: ToolHandler) => {
      handlers.set(name, handler);
    }
  );
  return {
    registerTool,
    getHandler: (name: string) => {
      const h = handlers.get(name);
      if (!h) throw new Error(`No handler for tool: ${name}`);
      return h;
    },
  };
}

function makeExtra(progressToken?: string | number) {
  return {
    _meta: progressToken !== undefined ? { progressToken } : undefined,
    sendNotification: jest
      .fn<(n: unknown) => Promise<void>>()
      .mockResolvedValue(undefined),
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Setup
// ────────────────────────────────────────────────────────────────────────────
describe("registerSetupAwsEnvsTool", () => {
  const originalCwd = process.cwd();
  let chdirSpy: ReturnType<typeof jest.spyOn>;

  beforeEach(() => {
    // resetMocks: true clears implementations — must re-configure here
    mockWithCliContext.mockImplementation(async (fn) => ({
      result: await fn(),
      capturedOutput: "",
    }));
    mockRunSetupAwsEnvsNonInteractive.mockResolvedValue(undefined);
    mockRequireEnvVars.mockReturnValue(undefined);

    // Mock process.chdir to prevent real directory changes in tests
    chdirSpy = jest
      .spyOn(process, "chdir")
      .mockImplementation((_path: string) => undefined);
  });

  afterEach(() => {
    chdirSpy.mockRestore();
    // Ensure cwd is always restored even if a test fails
    try {
      process.chdir(originalCwd);
    } catch {
      // ignore
    }
  });

  it("registers tool with name 'setup_aws_envs'", () => {
    const server = createMockServer();
    registerSetupAwsEnvsTool(server as never);
    expect(server.registerTool).toHaveBeenCalledWith(
      "setup_aws_envs",
      expect.any(Object),
      expect.any(Function)
    );
  });

  it("returns isError: true with .mcp.json snippet when AWS_ACCESS_KEY_ID is missing", async () => {
    mockRequireEnvVars.mockImplementation((_vars) => {
      throw new MockMissingCredentialsError(["AWS_ACCESS_KEY_ID"]);
    });

    const server = createMockServer();
    registerSetupAwsEnvsTool(server as never);
    const handler = server.getHandler("setup_aws_envs");

    const result = (await handler(
      { projectDir: "/tmp/test-project", email: "test@example.com" },
      makeExtra()
    )) as { isError: boolean; content: { type: string; text: string }[] };

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("AWS_ACCESS_KEY_ID");
    expect(result.content[0].text).toContain(".mcp.json");
  });

  it("returns isError: true with .mcp.json snippet when AWS_SECRET_ACCESS_KEY is missing", async () => {
    mockRequireEnvVars.mockImplementation((_vars) => {
      throw new MockMissingCredentialsError(["AWS_SECRET_ACCESS_KEY"]);
    });

    const server = createMockServer();
    registerSetupAwsEnvsTool(server as never);
    const handler = server.getHandler("setup_aws_envs");

    const result = (await handler(
      { projectDir: "/tmp/test-project", email: "test@example.com" },
      makeExtra()
    )) as { isError: boolean; content: { type: string; text: string }[] };

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("AWS_SECRET_ACCESS_KEY");
    expect(result.content[0].text).toContain(".mcp.json");
  });

  it("calls requireEnvVars with AWS credential vars before invoking function", async () => {
    const server = createMockServer();
    registerSetupAwsEnvsTool(server as never);
    const handler = server.getHandler("setup_aws_envs");

    await handler(
      { projectDir: "/tmp/test-project", email: "test@example.com" },
      makeExtra()
    );

    expect(mockRequireEnvVars).toHaveBeenCalledWith([
      "AWS_ACCESS_KEY_ID",
      "AWS_SECRET_ACCESS_KEY",
    ]);
  });

  it("calls runSetupAwsEnvsNonInteractive with email arg when credentials are present", async () => {
    const server = createMockServer();
    registerSetupAwsEnvsTool(server as never);
    const handler = server.getHandler("setup_aws_envs");

    await handler(
      { projectDir: "/tmp/test-project", email: "admin@example.com" },
      makeExtra()
    );

    expect(mockRunSetupAwsEnvsNonInteractive).toHaveBeenCalledWith({
      email: "admin@example.com",
    });
  });

  it("changes cwd to projectDir before calling function and restores after", async () => {
    const server = createMockServer();
    registerSetupAwsEnvsTool(server as never);
    const handler = server.getHandler("setup_aws_envs");

    await handler(
      { projectDir: "/tmp/test-project", email: "test@example.com" },
      makeExtra()
    );

    expect(chdirSpy).toHaveBeenCalledWith("/tmp/test-project");
    // Should restore to original cwd afterward
    expect(chdirSpy).toHaveBeenCalledWith(originalCwd);
  });

  it("restores cwd even when function throws", async () => {
    mockRunSetupAwsEnvsNonInteractive.mockRejectedValue(
      new Error("AWS setup failed")
    );

    const server = createMockServer();
    registerSetupAwsEnvsTool(server as never);
    const handler = server.getHandler("setup_aws_envs");

    const result = (await handler(
      { projectDir: "/tmp/test-project", email: "test@example.com" },
      makeExtra()
    )) as { isError: boolean; content: { type: string; text: string }[] };

    expect(result.isError).toBe(true);
    // cwd should have been restored
    expect(chdirSpy).toHaveBeenCalledWith(originalCwd);
  });

  it("returns isError: true with message on generic function failure", async () => {
    mockRunSetupAwsEnvsNonInteractive.mockRejectedValue(
      new Error("Network timeout")
    );

    const server = createMockServer();
    registerSetupAwsEnvsTool(server as never);
    const handler = server.getHandler("setup_aws_envs");

    const result = (await handler(
      { projectDir: "/tmp/test-project", email: "test@example.com" },
      makeExtra()
    )) as { isError: boolean; content: { type: string; text: string }[] };

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toBe("Network timeout");
  });

  it("emits progress notifications when progressToken is provided", async () => {
    const server = createMockServer();
    registerSetupAwsEnvsTool(server as never);
    const handler = server.getHandler("setup_aws_envs");
    const extra = makeExtra("test-token");

    await handler(
      { projectDir: "/tmp/test-project", email: "test@example.com" },
      extra
    );

    expect(extra.sendNotification).toHaveBeenCalledTimes(3);
    expect(extra.sendNotification).toHaveBeenNthCalledWith(1, {
      method: "notifications/progress",
      params: { progressToken: "test-token", progress: 0, total: 3 },
    });
    expect(extra.sendNotification).toHaveBeenNthCalledWith(2, {
      method: "notifications/progress",
      params: { progressToken: "test-token", progress: 2, total: 3 },
    });
    expect(extra.sendNotification).toHaveBeenNthCalledWith(3, {
      method: "notifications/progress",
      params: { progressToken: "test-token", progress: 3, total: 3 },
    });
  });

  it("does NOT emit progress when progressToken is absent", async () => {
    const server = createMockServer();
    registerSetupAwsEnvsTool(server as never);
    const handler = server.getHandler("setup_aws_envs");
    const extra = makeExtra(undefined);

    await handler(
      { projectDir: "/tmp/test-project", email: "test@example.com" },
      extra
    );

    expect(extra.sendNotification).not.toHaveBeenCalled();
  });

  it("returns success JSON on successful execution", async () => {
    const server = createMockServer();
    registerSetupAwsEnvsTool(server as never);
    const handler = server.getHandler("setup_aws_envs");

    const result = (await handler(
      { projectDir: "/tmp/test-project", email: "test@example.com" },
      makeExtra()
    )) as { content: { type: string; text: string }[] };

    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe("text");
    const parsed = JSON.parse(result.content[0].text) as Record<string, unknown>;
    expect(parsed.success).toBe(true);
    expect(parsed.projectDir).toBe("/tmp/test-project");
  });
});
