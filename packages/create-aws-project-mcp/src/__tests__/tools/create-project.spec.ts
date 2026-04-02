import { describe, it, expect, jest, beforeEach } from "@jest/globals";

// ────────────────────────────────────────────────────────────────────────────
// Mock: create-aws-project
// ────────────────────────────────────────────────────────────────────────────
const mockRunCreateProjectNonInteractive = jest.fn<
  (args: { name: string }) => Promise<{ projectDir: string }>
>();

jest.unstable_mockModule("create-aws-project", () => ({
  runCreateProjectNonInteractive: mockRunCreateProjectNonInteractive,
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
// Dynamic import after all mocks are set up
// ────────────────────────────────────────────────────────────────────────────
const { registerCreateProjectTool } = await import(
  "../../tools/create-project.js"
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
    sendNotification: jest.fn<(n: unknown) => Promise<void>>().mockResolvedValue(undefined),
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Setup
// ────────────────────────────────────────────────────────────────────────────
describe("registerCreateProjectTool", () => {
  beforeEach(() => {
    // resetMocks: true clears implementations — must re-configure here
    mockWithCliContext.mockImplementation(async (fn) => ({
      result: await fn(),
      capturedOutput: "",
    }));
    mockRunCreateProjectNonInteractive.mockResolvedValue({
      projectDir: "/tmp/my-project",
    });
  });

  it("registers tool with name 'create_project'", () => {
    const server = createMockServer();
    registerCreateProjectTool(server as never);
    expect(server.registerTool).toHaveBeenCalledWith(
      "create_project",
      expect.any(Object),
      expect.any(Function)
    );
  });

  it("calls runCreateProjectNonInteractive with correct args when invoked with just name", async () => {
    const server = createMockServer();
    registerCreateProjectTool(server as never);
    const handler = server.getHandler("create_project");

    await handler({ name: "my-app" }, makeExtra());

    expect(mockRunCreateProjectNonInteractive).toHaveBeenCalledWith({
      name: "my-app",
    });
  });

  it("passes optional fields (outputDir, region, platforms) through", async () => {
    const server = createMockServer();
    registerCreateProjectTool(server as never);
    const handler = server.getHandler("create_project");

    await handler(
      { name: "my-app", outputDir: "/tmp", region: "eu-west-1", platforms: ["web", "api"] },
      makeExtra()
    );

    expect(mockRunCreateProjectNonInteractive).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "my-app",
        outputDir: "/tmp",
        region: "eu-west-1",
        platforms: ["web", "api"],
      })
    );
  });

  it("returns JSON content with projectDir on success", async () => {
    const server = createMockServer();
    registerCreateProjectTool(server as never);
    const handler = server.getHandler("create_project");

    const result = await handler({ name: "my-app" }, makeExtra()) as {
      content: { type: string; text: string }[];
    };

    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({
      projectDir: "/tmp/my-project",
    });
  });

  it("returns isError: true with error message when the function throws", async () => {
    mockRunCreateProjectNonInteractive.mockRejectedValue(
      new Error("Directory already exists")
    );

    const server = createMockServer();
    registerCreateProjectTool(server as never);
    const handler = server.getHandler("create_project");

    const result = await handler({ name: "my-app" }, makeExtra()) as {
      isError: boolean;
      content: { type: string; text: string }[];
    };

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toBe("Directory already exists");
  });

  it("emits progress notifications when extra._meta.progressToken is present", async () => {
    const server = createMockServer();
    registerCreateProjectTool(server as never);
    const handler = server.getHandler("create_project");
    const extra = makeExtra("test-token");

    await handler({ name: "my-app" }, extra);

    expect(extra.sendNotification).toHaveBeenCalledTimes(2);
    expect(extra.sendNotification).toHaveBeenNthCalledWith(1, {
      method: "notifications/progress",
      params: { progressToken: "test-token", progress: 0, total: 2 },
    });
    expect(extra.sendNotification).toHaveBeenNthCalledWith(2, {
      method: "notifications/progress",
      params: { progressToken: "test-token", progress: 2, total: 2 },
    });
  });

  it("does NOT emit progress when extra._meta.progressToken is undefined", async () => {
    const server = createMockServer();
    registerCreateProjectTool(server as never);
    const handler = server.getHandler("create_project");
    const extra = makeExtra(undefined);

    await handler({ name: "my-app" }, extra);

    expect(extra.sendNotification).not.toHaveBeenCalled();
  });
});
