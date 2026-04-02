import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

interface DeploymentCredentials {
  userName: string;
  accessKeyId: string;
  secretAccessKey: string;
}

interface ProjectConfigMinimal {
  configVersion?: string;
  projectName: string;
  platforms: string[];
  awsRegion: string;
  authProvider?: string;
  features?: string[];
  theme?: string;
  createdAt?: string;
  accounts?: Record<string, string>;
  deploymentUsers?: Record<string, string>;
  deploymentCredentials?: Record<string, DeploymentCredentials>;
}

export function registerGetProjectStatusTool(server: McpServer): void {
  server.registerTool(
    "get_project_status",
    {
      description:
        "Read the .aws-starter-config.json from a project directory and return structured status with next steps.",
      inputSchema: {
        projectDir: z
          .string()
          .describe("Absolute path to the project directory"),
      },
    },
    async (args: { projectDir: string }) => {
      const configPath = join(args.projectDir, ".aws-starter-config.json");

      try {
        const raw = await readFile(configPath, "utf-8");
        const config = JSON.parse(raw) as ProjectConfigMinimal;

        const accounts = config.accounts ?? {};
        const deploymentCredentials = config.deploymentCredentials ?? {};

        const nextSteps: string[] = [];

        const hasAccounts = Object.keys(accounts).length > 0;
        const hasCredentials = Object.keys(deploymentCredentials).length > 0;

        if (!hasAccounts) {
          nextSteps.push(
            "Run setup_aws_envs to configure AWS accounts"
          );
        }

        if (!hasCredentials) {
          nextSteps.push(
            "Run setup_aws_envs to create deployment credentials"
          );
        }

        if (hasAccounts && hasCredentials) {
          nextSteps.push("Project is fully configured. Ready to deploy.");
        }

        const status = {
          projectName: config.projectName,
          configVersion: config.configVersion,
          awsRegion: config.awsRegion,
          platforms: config.platforms,
          accounts: config.accounts,
          deploymentUsers: config.deploymentUsers,
          deploymentCredentials: config.deploymentCredentials,
          nextSteps,
        };

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(status),
            },
          ],
        };
      } catch (err) {
        const message =
          err instanceof Error ? err.message : String(err);
        return {
          isError: true,
          content: [
            {
              type: "text" as const,
              text: `Failed to read project config: ${message}`,
            },
          ],
        };
      }
    }
  );
}
