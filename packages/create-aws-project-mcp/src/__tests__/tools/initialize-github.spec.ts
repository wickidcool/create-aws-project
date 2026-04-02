import { describe, it, expect, jest, beforeEach, afterEach } from "@jest/globals";

// ────────────────────────────────────────────────────────────────────────────
// Mock: create-aws-project
// ────────────────────────────────────────────────────────────────────────────
const mockRunInitializeGitHubNonInteractive = jest.fn<
  (args: { repoUrl: string; environments?: string[] }) => Promise<{
    results: Array<{ environment: string; success: boolean; error?: string }>;
    successCount: number;
    totalCount: number;
  }>
>();

jest.unstable_mockModule("create-aws-project", () => ({
  runInitializeGitHubNonInteractive: mockRunInitializeGitHubNonInteractive,
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
const { registerInitializeGitHubTool } = await import(
  "../../tools/initialize-github.js"
);

// ────────────────────────────────────────────────────────────────────────────
// Helper: create a mock McpServer that captures registered handlers
// ────────────────────────────────────────────────────────────────────────────
type ToolHandler = (
  args: Record<string, unknown>,
  extra: Record<string, unknown>
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

// ────────────────────────────────────────────────────────────────────────────
// Mock result helpers
// ────────────────────────────────────────────────────────────────────────────
const MOCK_SUCCESS_RESULT = {
  results: [
    { environment: "dev", success: true },
    { environment: "stage", success: true },
    { environment: "prod", success: true },
  ],
  successCount: 3,
  totalCount: 3,
};

const MOCK_PARTIAL_RESULT = {
  results: [
    { environment: "dev", success: true },
    { environment: "stage", success: false, error: "GitHub API error" },
  ],
  successCount: 1,
  totalCount: 2,
};

// ────────────────────────────────────────────────────────────────────────────
// Setup
// ────────────────────────────────────────────────────────────────────────────
describe("registerInitializeGitHubTool", () => {
  const originalCwd = process.cwd();
  let chdirSpy: ReturnType<typeof jest.spyOn>;

  beforeEach(() => {
    // resetMocks: true clears implementations — must re-configure here
    mockWithCliContext.mockImplementation(async (fn) => ({
      result: await fn(),
      capturedOutput: "",
    }));
    mockRunInitializeGitHubNonInteractive.mockResolvedValue(MOCK_SUCCESS_RESULT);
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

  it("registers tool with name 'initialize_github'", () => {
    const server = createMockServer();
    registerInitializeGitHubTool(server as never);
    expect(server.registerTool).toHaveBeenCalledWith(
      "initialize_github",
      expect.any(Object),
      expect.any(Function)
    );
  });

  it("returns isError: true with actionable message when GITHUB_TOKEN is missing", async () => {
    mockRequireEnvVars.mockImplementation((_vars) => {
      throw new MockMissingCredentialsError(["GITHUB_TOKEN"]);
    });

    const server = createMockServer();
    registerInitializeGitHubTool(server as never);
    const handler = server.getHandler("initialize_github");

    const result = (await handler(
      { projectDir: "/tmp/test-project", repoUrl: "owner/repo" },
      {}
    )) as { isError: boolean; content: { type: string; text: string }[] };

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("GITHUB_TOKEN");
    expect(result.content[0].text).toContain(".mcp.json");
  });

  it("calls requireEnvVars with GITHUB_TOKEN before invoking function", async () => {
    const server = createMockServer();
    registerInitializeGitHubTool(server as never);
    const handler = server.getHandler("initialize_github");

    await handler(
      { projectDir: "/tmp/test-project", repoUrl: "owner/repo" },
      {}
    );

    expect(mockRequireEnvVars).toHaveBeenCalledWith(["GITHUB_TOKEN"]);
  });

  it("calls runInitializeGitHubNonInteractive with correct config when token is present", async () => {
    const server = createMockServer();
    registerInitializeGitHubTool(server as never);
    const handler = server.getHandler("initialize_github");

    await handler(
      {
        projectDir: "/tmp/test-project",
        repoUrl: "https://github.com/owner/repo",
        environments: ["dev", "stage"],
      },
      {}
    );

    expect(mockRunInitializeGitHubNonInteractive).toHaveBeenCalledWith({
      repoUrl: "https://github.com/owner/repo",
      environments: ["dev", "stage"],
    });
  });

  it("calls runInitializeGitHubNonInteractive without environments when not provided", async () => {
    const server = createMockServer();
    registerInitializeGitHubTool(server as never);
    const handler = server.getHandler("initialize_github");

    await handler(
      { projectDir: "/tmp/test-project", repoUrl: "owner/repo" },
      {}
    );

    expect(mockRunInitializeGitHubNonInteractive).toHaveBeenCalledWith({
      repoUrl: "owner/repo",
      environments: undefined,
    });
  });

  it("returns per-environment result JSON on success", async () => {
    const server = createMockServer();
    registerInitializeGitHubTool(server as never);
    const handler = server.getHandler("initialize_github");

    const result = (await handler(
      { projectDir: "/tmp/test-project", repoUrl: "owner/repo" },
      {}
    )) as { content: { type: string; text: string }[] };

    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe("text");
    const parsed = JSON.parse(result.content[0].text) as typeof MOCK_SUCCESS_RESULT;
    expect(parsed.successCount).toBe(3);
    expect(parsed.totalCount).toBe(3);
    expect(parsed.results).toHaveLength(3);
  });

  it("returns partial result JSON when some environments fail", async () => {
    mockRunInitializeGitHubNonInteractive.mockResolvedValue(MOCK_PARTIAL_RESULT);

    const server = createMockServer();
    registerInitializeGitHubTool(server as never);
    const handler = server.getHandler("initialize_github");

    const result = (await handler(
      { projectDir: "/tmp/test-project", repoUrl: "owner/repo" },
      {}
    )) as { content: { type: string; text: string }[] };

    const parsed = JSON.parse(result.content[0].text) as typeof MOCK_PARTIAL_RESULT;
    expect(parsed.successCount).toBe(1);
    expect(parsed.totalCount).toBe(2);
    expect(parsed.results[1].error).toBe("GitHub API error");
  });

  it("changes cwd to projectDir before calling function and restores after", async () => {
    const server = createMockServer();
    registerInitializeGitHubTool(server as never);
    const handler = server.getHandler("initialize_github");

    await handler(
      { projectDir: "/tmp/test-project", repoUrl: "owner/repo" },
      {}
    );

    expect(chdirSpy).toHaveBeenCalledWith("/tmp/test-project");
    expect(chdirSpy).toHaveBeenCalledWith(originalCwd);
  });

  it("restores cwd even when function throws", async () => {
    mockRunInitializeGitHubNonInteractive.mockRejectedValue(
      new Error("GitHub API error")
    );

    const server = createMockServer();
    registerInitializeGitHubTool(server as never);
    const handler = server.getHandler("initialize_github");

    const result = (await handler(
      { projectDir: "/tmp/test-project", repoUrl: "owner/repo" },
      {}
    )) as { isError: boolean };

    expect(result.isError).toBe(true);
    expect(chdirSpy).toHaveBeenCalledWith(originalCwd);
  });

  it("returns isError: true on generic function failure", async () => {
    mockRunInitializeGitHubNonInteractive.mockRejectedValue(
      new Error("Unexpected error")
    );

    const server = createMockServer();
    registerInitializeGitHubTool(server as never);
    const handler = server.getHandler("initialize_github");

    const result = (await handler(
      { projectDir: "/tmp/test-project", repoUrl: "owner/repo" },
      {}
    )) as { isError: boolean; content: { type: string; text: string }[] };

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toBe("Unexpected error");
  });
});
