import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerCreateProjectTool } from "./tools/create-project.js";
import { registerGetProjectStatusTool } from "./tools/get-project-status.js";
import { registerSetupAwsEnvsTool } from "./tools/setup-aws-envs.js";
import { registerInitializeGitHubTool } from "./tools/initialize-github.js";

export async function startServer(): Promise<void> {
  const server = new McpServer({
    name: "create-aws-project",
    version: "1.0.0",
  });

  registerCreateProjectTool(server);
  registerGetProjectStatusTool(server);
  registerSetupAwsEnvsTool(server);
  registerInitializeGitHubTool(server);

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("create-aws-project MCP server running on stdio");
}
