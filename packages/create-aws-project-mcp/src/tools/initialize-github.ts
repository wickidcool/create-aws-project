import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { runInitializeGitHubNonInteractive } from "create-aws-project";
import { withCliContext } from "../utils/cli-context.js";
import { requireEnvVars, MissingCredentialsError } from "./errors.js";

export function registerInitializeGitHubTool(server: McpServer): void {
  server.registerTool(
    "initialize_github",
    {
      description:
        "Configure GitHub repository environments with AWS deployment credentials. Pushes per-environment access keys as GitHub Environment secrets. Requires GITHUB_TOKEN in the MCP server environment.",
      inputSchema: {
        projectDir: z
          .string()
          .describe("Absolute path to the project directory"),
        repoUrl: z
          .string()
          .describe(
            "GitHub repo (owner/repo, HTTPS URL, or SSH URL)"
          ),
        environments: z
          .array(z.enum(["dev", "stage", "prod"]))
          .optional()
          .describe(
            "Environments to configure (defaults to all with credentials)"
          ),
      },
    },
    async (args, _extra) => {
      try {
        requireEnvVars(["GITHUB_TOKEN"]);

        const originalCwd = process.cwd();

        let result;
        try {
          process.chdir(args.projectDir);

          const { result: r } = await withCliContext(() =>
            runInitializeGitHubNonInteractive({
              repoUrl: args.repoUrl,
              environments: args.environments,
            })
          );
          result = r;
        } finally {
          process.chdir(originalCwd);
        }

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(result),
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

export { MissingCredentialsError };
