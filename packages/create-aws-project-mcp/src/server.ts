import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

export async function startServer(): Promise<void> {
  const server = new McpServer({
    name: "create-aws-project",
    version: "1.0.0",
  });

  // Tools will be registered here in Phase 28

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("create-aws-project MCP server running on stdio");
}
