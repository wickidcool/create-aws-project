import { describe, it, expect, jest, beforeEach } from "@jest/globals";

// ────────────────────────────────────────────────────────────────────────────
// Mock: node:fs/promises
// ────────────────────────────────────────────────────────────────────────────
const mockReadFile = jest.fn<
  (path: string, encoding: string) => Promise<string>
>();

jest.unstable_mockModule("node:fs/promises", () => ({
  readFile: mockReadFile,
}));

// ────────────────────────────────────────────────────────────────────────────
// Dynamic import after all mocks are set up
// ────────────────────────────────────────────────────────────────────────────
const { registerGetProjectStatusTool } = await import(
  "../../tools/get-project-status.js"
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
// Mock data
// ────────────────────────────────────────────────────────────────────────────
const MOCK_CONFIG_EMPTY_ACCOUNTS = {
  configVersion: "1.0",
  projectName: "test-project",
  platforms: ["web", "api"],
  awsRegion: "us-east-1",
  authProvider: "none",
  features: ["github-actions"],
  theme: "blue",
  createdAt: "2026-01-01T00:00:00.000Z",
  accounts: {},
};

const MOCK_CONFIG_FULLY_CONFIGURED = {
  ...MOCK_CONFIG_EMPTY_ACCOUNTS,
  accounts: { dev: "123456789012", stage: "234567890123" },
  deploymentUsers: { dev: "deploy-dev", stage: "deploy-stage" },
  deploymentCredentials: {
    dev: {
      userName: "deploy-dev",
      accessKeyId: "AKIADEV",
      secretAccessKey: "secretdev",
    },
    stage: {
      userName: "deploy-stage",
      accessKeyId: "AKIASTAGE",
      secretAccessKey: "secretstage",
    },
  },
};

// ────────────────────────────────────────────────────────────────────────────
// Setup
// ────────────────────────────────────────────────────────────────────────────
describe("registerGetProjectStatusTool", () => {
  beforeEach(() => {
    // resetMocks: true clears implementations — must re-configure per test
  });

  it("registers tool with name 'get_project_status'", () => {
    const server = createMockServer();
    registerGetProjectStatusTool(server as never);
    expect(server.registerTool).toHaveBeenCalledWith(
      "get_project_status",
      expect.any(Object),
      expect.any(Function)
    );
  });

  it("returns full status JSON for a valid config file with accounts and credentials", async () => {
    mockReadFile.mockResolvedValue(JSON.stringify(MOCK_CONFIG_FULLY_CONFIGURED));

    const server = createMockServer();
    registerGetProjectStatusTool(server as never);
    const handler = server.getHandler("get_project_status");

    const result = await handler(
      { projectDir: "/tmp/test-project" },
      {}
    ) as { content: { type: string; text: string }[] };

    expect(result.content).toHaveLength(1);
    const parsed = JSON.parse(result.content[0].text) as Record<string, unknown>;
    expect(parsed.projectName).toBe("test-project");
    expect(parsed.awsRegion).toBe("us-east-1");
    expect(parsed.platforms).toEqual(["web", "api"]);
    expect(parsed.configVersion).toBe("1.0");
  });

  it("computes nextSteps suggesting setup_aws_envs when accounts are empty", async () => {
    mockReadFile.mockResolvedValue(JSON.stringify(MOCK_CONFIG_EMPTY_ACCOUNTS));

    const server = createMockServer();
    registerGetProjectStatusTool(server as never);
    const handler = server.getHandler("get_project_status");

    const result = await handler(
      { projectDir: "/tmp/test-project" },
      {}
    ) as { content: { type: string; text: string }[] };

    const parsed = JSON.parse(result.content[0].text) as { nextSteps: string[] };
    expect(parsed.nextSteps).toContain(
      "Run setup_aws_envs to configure AWS accounts"
    );
    expect(parsed.nextSteps).toContain(
      "Run setup_aws_envs to create deployment credentials"
    );
  });

  it("computes nextSteps saying 'fully configured' when everything is present", async () => {
    mockReadFile.mockResolvedValue(JSON.stringify(MOCK_CONFIG_FULLY_CONFIGURED));

    const server = createMockServer();
    registerGetProjectStatusTool(server as never);
    const handler = server.getHandler("get_project_status");

    const result = await handler(
      { projectDir: "/tmp/test-project" },
      {}
    ) as { content: { type: string; text: string }[] };

    const parsed = JSON.parse(result.content[0].text) as { nextSteps: string[] };
    expect(parsed.nextSteps).toContain(
      "Project is fully configured. Ready to deploy."
    );
    expect(parsed.nextSteps).not.toContain(
      "Run setup_aws_envs to configure AWS accounts"
    );
  });

  it("returns isError: true when config file does not exist (ENOENT)", async () => {
    const enoent = Object.assign(new Error("ENOENT: no such file or directory"), {
      code: "ENOENT",
    });
    mockReadFile.mockRejectedValue(enoent);

    const server = createMockServer();
    registerGetProjectStatusTool(server as never);
    const handler = server.getHandler("get_project_status");

    const result = await handler(
      { projectDir: "/tmp/nonexistent" },
      {}
    ) as { isError: boolean; content: { type: string; text: string }[] };

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Failed to read project config:");
    expect(result.content[0].text).toContain("ENOENT");
  });

  it("returns isError: true when config file is invalid JSON", async () => {
    mockReadFile.mockResolvedValue("{ invalid json }");

    const server = createMockServer();
    registerGetProjectStatusTool(server as never);
    const handler = server.getHandler("get_project_status");

    const result = await handler(
      { projectDir: "/tmp/test-project" },
      {}
    ) as { isError: boolean; content: { type: string; text: string }[] };

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Failed to read project config:");
  });
});
