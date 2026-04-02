import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { runSetupAwsEnvsNonInteractive } from "create-aws-project";
import { withCliContext } from "../utils/cli-context.js";
import { requireEnvVars, MissingCredentialsError } from "./errors.js";

export function registerSetupAwsEnvsTool(server: McpServer): void {
  server.registerTool(
    "setup_aws_envs",
    {
      description:
        "Set up AWS Organizations and environment accounts (dev, stage, prod) with IAM deployment users, access keys, and CDK bootstrap. Requires AWS credentials in the MCP server environment.",
      inputSchema: {
        projectDir: z
          .string()
          .describe("Absolute path to the project directory"),
        email: z
          .string()
          .describe("Root email for deriving per-environment account emails"),
      },
    },
    async (args, extra) => {
      const progressToken = extra._meta?.progressToken;

      try {
        requireEnvVars(["AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY"]);

        if (progressToken !== undefined) {
          await extra.sendNotification({
            method: "notifications/progress",
            params: {
              progressToken,
              progress: 0,
              total: 3,
            },
          });
        }

        const originalCwd = process.cwd();

        try {
          process.chdir(args.projectDir);

          await withCliContext(() =>
            runSetupAwsEnvsNonInteractive({ email: args.email })
          );
        } finally {
          process.chdir(originalCwd);
        }

        if (progressToken !== undefined) {
          await extra.sendNotification({
            method: "notifications/progress",
            params: {
              progressToken,
              progress: 2,
              total: 3,
            },
          });
        }

        if (progressToken !== undefined) {
          await extra.sendNotification({
            method: "notifications/progress",
            params: {
              progressToken,
              progress: 3,
              total: 3,
            },
          });
        }

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({ success: true, projectDir: args.projectDir }),
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
