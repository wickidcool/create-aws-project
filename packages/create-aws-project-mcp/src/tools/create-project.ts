import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { runCreateProjectNonInteractive } from "create-aws-project";
import { withCliContext } from "../utils/cli-context.js";

export function registerCreateProjectTool(server: McpServer): void {
  server.registerTool(
    "create_project",
    {
      description:
        "Scaffold a new AWS project directory with platform selection, auth, and CI/CD configuration.",
      inputSchema: {
        name: z.string().describe("Project name (must be valid npm package name)"),
        outputDir: z
          .string()
          .optional()
          .describe("Output directory (defaults to cwd)"),
        platforms: z.array(z.enum(["web", "mobile", "api"])).optional(),
        auth: z.enum(["none", "cognito", "auth0"]).optional(),
        features: z
          .array(z.enum(["github-actions", "vscode-config"]))
          .optional(),
        region: z.string().optional().describe("AWS region (default: us-east-1)"),
        brandColor: z
          .enum(["blue", "purple", "teal", "green", "orange"])
          .optional(),
      },
    },
    async (args, extra) => {
      const progressToken = extra._meta?.progressToken;

      try {
        if (progressToken !== undefined) {
          await extra.sendNotification({
            method: "notifications/progress",
            params: {
              progressToken,
              progress: 0,
              total: 2,
            },
          });
        }

        const { result } = await withCliContext(() =>
          runCreateProjectNonInteractive(args)
        );

        if (progressToken !== undefined) {
          await extra.sendNotification({
            method: "notifications/progress",
            params: {
              progressToken,
              progress: 2,
              total: 2,
            },
          });
        }

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({ projectDir: result.projectDir }),
            },
          ],
        };
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        return {
          isError: true,
          content: [
            {
              type: "text" as const,
              text: error.message,
            },
          ],
        };
      }
    }
  );
}
