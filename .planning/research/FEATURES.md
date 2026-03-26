# Feature Landscape: MCP Server Tools for create-aws-project

**Domain:** MCP server wrapping a CLI tool with long-running operations, credential-bearing commands, and AI-agent orchestration
**Researched:** 2026-03-25
**Confidence:** HIGH (MCP protocol spec verified at modelcontextprotocol.io; tool design patterns verified with TypeScript SDK docs; credential patterns derived from official MCP debugging guide + AWS SDK patterns)

---

## Executive Summary

This research answers four specific design questions about the four MCP tools, then maps findings to table stakes / differentiators / anti-features.

**The central tension in this domain:** MCP tools are synchronous request-response. Long-running operations (30+ seconds) must either return synchronously (acceptable — clients do wait) or stream progress via `notifications/progress`. Credentials must never appear in tool input schemas for AI-orchestrated flows; they belong in the server's environment, read at startup.

**Recommended design philosophy for these four tools:** Each tool maps 1:1 to an existing `--config` mode call. Tools accept the same fields as the Zod schemas already define. The MCP server reads credentials from its inherited environment at startup. Tools execute synchronously and emit progress notifications throughout. Errors return `isError: true` with actionable messages, never throw.

---

## Design Decisions by Tool

### 1. `create_project`

**What it wraps:** The `--config` non-interactive wizard mode (equivalent to passing a `project.json` file).

**Input Schema:**

```json
{
  "type": "object",
  "properties": {
    "name": {
      "type": "string",
      "description": "Project name (npm package name format, required). Example: my-app"
    },
    "outputDirectory": {
      "type": "string",
      "description": "Absolute path where the project directory will be created. Defaults to cwd/name."
    },
    "platforms": {
      "type": "array",
      "items": { "type": "string", "enum": ["web", "mobile", "api"] },
      "description": "Platforms to include. Defaults to [\"web\", \"api\"]."
    },
    "auth": {
      "type": "string",
      "enum": ["none", "cognito", "auth0"],
      "description": "Authentication provider. Defaults to \"none\"."
    },
    "authFeatures": {
      "type": "array",
      "items": { "type": "string", "enum": ["social-login", "mfa"] },
      "description": "Auth features (ignored if auth is \"none\"). Defaults to []."
    },
    "features": {
      "type": "array",
      "items": { "type": "string", "enum": ["github-actions", "vscode-config"] },
      "description": "Optional features. Defaults to [\"github-actions\", \"vscode-config\"]."
    },
    "region": {
      "type": "string",
      "enum": ["us-east-1", "us-west-2", "eu-west-1", "eu-central-1", "ap-northeast-1", "ap-southeast-2"],
      "description": "AWS region. Defaults to \"us-east-1\"."
    },
    "brandColor": {
      "type": "string",
      "enum": ["blue", "purple", "teal", "green", "orange"],
      "description": "Brand color theme. Defaults to \"blue\"."
    }
  },
  "required": ["name"]
}
```

**Rationale:** Mirrors `NonInteractiveConfigSchema` exactly, with `outputDirectory` added so an agent can control where the project lands. Only `name` is required. All defaults match existing wizard defaults so the agent can call with minimal inputs.

**Long-running operation handling:**

Project generation takes approximately 15-45 seconds (template copying, npm install, git init). The MCP progress notification mechanism handles this cleanly:

1. Client includes `progressToken` in the `_meta` field of the `tools/call` request.
2. Server emits `notifications/progress` messages throughout execution:
   - `{ progress: 1, total: 6, message: "Validating config..." }`
   - `{ progress: 2, total: 6, message: "Generating project files..." }`
   - `{ progress: 3, total: 6, message: "Installing dependencies..." }`
   - `{ progress: 4, total: 6, message: "Initializing git repository..." }`
   - `{ progress: 5, total: 6, message: "Writing .aws-starter-config.json..." }`
   - `{ progress: 6, total: 6, message: "Complete." }`
3. Tool returns the final result synchronously after all steps complete.

If the client does not supply a `progressToken`, the server simply omits progress notifications and returns the final result — this is spec-compliant behavior (servers MAY choose not to send notifications).

**Output Schema (structured):**

```json
{
  "type": "object",
  "properties": {
    "projectPath": { "type": "string", "description": "Absolute path to created project" },
    "projectName": { "type": "string" },
    "platforms": { "type": "array", "items": { "type": "string" } },
    "configPath": { "type": "string", "description": "Path to .aws-starter-config.json" }
  }
}
```

The agent needs `projectPath` to `cd` into the project before calling subsequent tools.

---

### 2. `setup_aws_envs`

**What it wraps:** The `setup-aws-envs --config <file>` command. The `--config` file only needs the root `email` field; all other state comes from `.aws-starter-config.json`.

**Credential handling — the core question:**

AWS credentials (access key, secret key, region) should **NOT** be tool inputs. They should be read from the MCP server's environment at startup time.

**Why environment, not tool inputs:**

- The MCP protocol does not have a "sensitive" field type. Any input field is visible in the `tools/call` request, which clients log, display to users, and may transmit to the LLM context. Credentials in inputs become credentials in logs.
- The official MCP debugging guide explicitly shows credential injection via the `env` key in `claude_desktop_config.json` / `.mcp.json`:
  ```json
  {
    "mcpServers": {
      "create-aws-project": {
        "command": "npx",
        "args": ["-y", "create-aws-project-mcp"],
        "env": {
          "AWS_ACCESS_KEY_ID": "...",
          "AWS_SECRET_ACCESS_KEY": "..."
        }
      }
    }
  }
  ```
- The AWS SDK already reads `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, and `AWS_PROFILE` from the environment. When the MCP server inherits the user's shell environment (via stdio transport), it automatically picks up whatever credentials the user has configured. This is zero-friction for the common case.
- MCP servers launched via stdio inherit the launching process's environment variables. For a user running Claude Code in their terminal, `AWS_PROFILE` or `~/.aws/credentials` default credentials will be present automatically.

**Key finding on env inheritance:** Per the MCP debugging guide, stdio servers inherit "only a limited subset of environment variables automatically (the exact set is platform-dependent)." This means the generated `.mcp.json` template should explicitly pass through the relevant AWS env vars if they are known, or the server's documentation must instruct users to configure them in the client's `env` block.

**Input Schema:**

```json
{
  "type": "object",
  "properties": {
    "projectPath": {
      "type": "string",
      "description": "Absolute path to the project directory (must contain .aws-starter-config.json). If omitted, the server's current working directory is used."
    },
    "email": {
      "type": "string",
      "description": "Root email address for AWS account email derivation (e.g. owner@example.com). Sub-account emails are derived as owner-dev@example.com, owner-stage@example.com, owner-prod@example.com."
    }
  },
  "required": ["email"]
}
```

**Rationale:** `email` is the only non-derivable input — it is the human decision that cannot be inferred. Everything else (org name, region, account names) comes from `.aws-starter-config.json`. `projectPath` allows the agent to pass an explicit path rather than relying on cwd.

**Long-running operation handling:**

AWS org setup takes 3-10 minutes (account creation has AWS-side delays). Progress notifications are essential:

- `{ progress: 1, total: 8, message: "Verifying AWS credentials..." }`
- `{ progress: 2, total: 8, message: "Checking for root credentials..." }`
- `{ progress: 3, total: 8, message: "Creating AWS Organization..." }`
- `{ progress: 4, total: 8, message: "Creating dev account..." }`
- `{ progress: 5, total: 8, message: "Creating stage account..." }`
- `{ progress: 6, total: 8, message: "Creating prod account..." }`
- `{ progress: 7, total: 8, message: "Creating IAM deployment users..." }`
- `{ progress: 8, total: 8, message: "Running CDK bootstrap in all accounts..." }`

**Output Schema:**

```json
{
  "type": "object",
  "properties": {
    "organizationId": { "type": "string" },
    "accounts": {
      "type": "object",
      "description": "Map of environment to account ID",
      "additionalProperties": { "type": "string" }
    },
    "configPath": { "type": "string", "description": "Path to updated .aws-starter-config.json" },
    "credentialsWritten": {
      "type": "boolean",
      "description": "Whether deployment credentials were written to config for initialize_github to consume"
    }
  }
}
```

---

### 3. `initialize_github`

**What it wraps:** The `initialize-github --all` batch mode (or per-environment call). Reads deployment credentials from `.aws-starter-config.json` (written by `setup_aws_envs`).

**Credential handling — GitHub PAT:**

Same principle as AWS credentials: the GitHub PAT should come from the environment, not a tool input.

**Why:**
- PATs in tool inputs are PATs in LLM context. Claude Code, Cursor, and other AI agents show tool calls to users and potentially log them.
- The conventional solution is `GITHUB_TOKEN` environment variable, which is the universal GitHub credential environment variable used by GitHub Actions, the GitHub CLI, and virtually all GitHub tooling.
- The MCP server reads `GITHUB_TOKEN` (or `GITHUB_PAT`) from its environment at startup. If absent, the tool returns an informative error: `"GITHUB_TOKEN environment variable is not set. Add it to your .mcp.json env configuration."`

**Input Schema:**

```json
{
  "type": "object",
  "properties": {
    "projectPath": {
      "type": "string",
      "description": "Absolute path to the project directory. If omitted, server's cwd is used."
    },
    "environments": {
      "type": "array",
      "items": { "type": "string", "enum": ["dev", "stage", "prod"] },
      "description": "Environments to configure. Defaults to all three: [\"dev\", \"stage\", \"prod\"]."
    }
  },
  "required": []
}
```

**Rationale:** No required fields. An agent that has just run `setup_aws_envs` with the same `projectPath` can call this with no arguments. The `environments` field allows partial setup for retry scenarios (e.g., only re-run `prod` if `dev` and `stage` already succeeded).

**Output Schema:**

```json
{
  "type": "object",
  "properties": {
    "configured": {
      "type": "array",
      "items": { "type": "string" },
      "description": "Environments successfully configured"
    },
    "failed": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "environment": { "type": "string" },
          "error": { "type": "string" }
        }
      },
      "description": "Environments that failed with error details"
    },
    "repositoryUrl": { "type": "string", "description": "GitHub repository URL if detected" }
  }
}
```

**Partial failure handling:** Unlike a CLI that exits on first error, the MCP tool should attempt all environments and report successes and failures separately. The agent can decide whether to retry the failed ones.

---

### 4. `get_project_status`

**What it wraps:** A read-only operation — parse `.aws-starter-config.json` and return a structured status report. No CLI equivalent today; this is new logic.

**Input Schema:**

```json
{
  "type": "object",
  "properties": {
    "projectPath": {
      "type": "string",
      "description": "Absolute path to the project directory. If omitted, server searches upward from cwd."
    }
  },
  "required": []
}
```

**What information is most useful to an AI agent:**

An AI agent calling this tool needs to answer: "What has been done, what is incomplete, and what should I do next?" The response should be structured to answer all three.

**Output Schema:**

```json
{
  "type": "object",
  "properties": {
    "projectName": { "type": "string" },
    "projectPath": { "type": "string" },
    "configVersion": { "type": "string" },
    "platforms": { "type": "array", "items": { "type": "string" } },
    "awsRegion": { "type": "string" },
    "auth": {
      "type": "object",
      "properties": {
        "provider": { "type": "string" },
        "features": { "type": "array", "items": { "type": "string" } }
      }
    },
    "setup": {
      "type": "object",
      "description": "Completion status of each setup phase",
      "properties": {
        "projectGenerated": { "type": "boolean" },
        "awsOrgCreated": { "type": "boolean" },
        "awsAccountsCreated": {
          "type": "object",
          "properties": {
            "dev": { "type": "boolean" },
            "stage": { "type": "boolean" },
            "prod": { "type": "boolean" }
          }
        },
        "deploymentUsersCreated": { "type": "boolean" },
        "cdkBootstrapped": { "type": "boolean" },
        "githubSecretsConfigured": {
          "type": "object",
          "properties": {
            "dev": { "type": "boolean" },
            "stage": { "type": "boolean" },
            "prod": { "type": "boolean" }
          }
        }
      }
    },
    "accounts": {
      "type": "object",
      "description": "Map of environment to AWS account ID (populated after setup_aws_envs)",
      "additionalProperties": { "type": "string" }
    },
    "nextSteps": {
      "type": "array",
      "items": { "type": "string" },
      "description": "Ordered list of recommended next actions for this project"
    },
    "warnings": {
      "type": "array",
      "items": { "type": "string" },
      "description": "Non-blocking issues the agent should be aware of"
    }
  }
}
```

**The `nextSteps` field is the most agent-useful feature.** Rather than forcing the AI to reason about config state, the tool computes the recommended action sequence:

```
Example output for a newly-generated project:
nextSteps: [
  "Run setup_aws_envs to create AWS Organization and accounts",
  "Run initialize_github to configure GitHub deployment secrets",
  "Push to GitHub to trigger first CI/CD run"
]

Example output after setup_aws_envs but before initialize_github:
nextSteps: [
  "Run initialize_github to configure GitHub deployment secrets"
]
```

---

## Table Stakes

Features the four tools must have for the agent experience to work at all.

| Feature | Why Essential | Tool(s) | Complexity |
|---------|---------------|---------|------------|
| **Environment-based credential injection** | Prevents credentials in LLM context; AWS SDK reads env vars natively | setup_aws_envs, initialize_github | Low |
| **`projectPath` input on all tools** | Agent must control where operations run; cwd from stdio is non-deterministic | All four | Low |
| **Structured output (JSON)** | Agents need to parse results to chain tool calls (`projectPath` from create → next tools) | All four | Low |
| **`isError: true` results with actionable messages** | Agents must know when to retry vs. abort; must distinguish "credentials missing" from "AWS error" | All four | Low |
| **Progress notifications** | create_project (~30s) and setup_aws_envs (~5-10min) will appear hung without progress | create_project, setup_aws_envs | Medium |
| **`nextSteps` in get_project_status** | Reduces agent reasoning about setup state; removes need for agent to understand config schema | get_project_status | Medium |
| **No interactive prompts** | MCP tools cannot prompt; any `prompts()` call will hang or crash | All four | Low |
| **Idempotent execution** | Agent may retry tools on failure; re-runs must not duplicate AWS resources | setup_aws_envs, initialize_github | Medium (already built) |
| **Missing credential detection at startup** | Tool must fail fast with clear message if `GITHUB_TOKEN` or AWS creds are absent | setup_aws_envs, initialize_github | Low |
| **Consistent error format** | Agent needs parseable errors: `{ isError: true, content: [{ type: "text", text: "AWS_ACCESS_KEY_ID not set. Configure via env in .mcp.json." }] }` | All four | Low |

---

## Differentiators

Features that make the agent experience meaningfully better, not just functional.

| Feature | Value | Tool(s) | Complexity |
|---------|-------|---------|------------|
| **`nextSteps` derived from config state** | Agent can call get_project_status and get a todo list, not just raw config dump | get_project_status | Low |
| **Partial failure reporting in initialize_github** | Agent can retry only the failed environments, not redo everything | initialize_github | Low |
| **Per-environment completion booleans** | Agent can check "is dev configured?" without parsing credential structures | get_project_status | Low |
| **outputSchema declaration** | Clients can validate structured responses; enables type-safe agent integration | All four | Low |
| **Progress messages with human-readable text** | "Creating prod account (this can take 1-2 minutes)" tells the user what's happening in Claude's UI | setup_aws_envs | Low |
| **`warnings` array in status** | Non-blocking alerts: "AWS credentials are root — consider using IAM admin" surfaced without blocking | get_project_status | Low |
| **Explicit credential source in error messages** | "AWS_ACCESS_KEY_ID not set — add to .mcp.json env block: { \"AWS_ACCESS_KEY_ID\": \"your-key\" }" | All four | Low |
| **Tool annotations (readOnly for status)** | `get_project_status` can be annotated `{ "readOnly": true }` so clients skip confirmation prompts | get_project_status | Low |
| **configPath in all outputs** | Every tool returns the path to the config file it read/wrote; agent can pass it to next tool explicitly | All four | Low |

---

## Anti-Features

Things to explicitly NOT build. Each is a common mistake in this domain.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **`awsAccessKeyId` / `awsSecretAccessKey` as tool inputs** | Credentials appear in tool call logs, LLM context, and client UIs. Security risk. | Read from env vars (`AWS_ACCESS_KEY_ID`, `AWS_PROFILE`, etc.) via AWS SDK default chain |
| **`githubToken` / `githubPat` as tool inputs** | Same issue. PATs in tool inputs = PATs in Claude's context. | Read `GITHUB_TOKEN` from environment at server startup |
| **Interactive fallback when creds are missing** | Cannot prompt in MCP; will hang or error. Confusing for users who expect a prompt. | Return `isError: true` with exact instruction: "Set GITHUB_TOKEN in .mcp.json env block" |
| **Calling `process.exit()` on validation failure** | Will kill the MCP server process; all subsequent tool calls fail permanently. | Return `{ isError: true }` result, never exit the process |
| **Passing raw `.aws-starter-config.json` content to agent** | Exposes secretAccessKey fields to LLM context. Config contains deployment credentials after setup_aws_envs runs. | Only expose summary fields in get_project_status; strip credential values |
| **Using `console.log()` in the MCP server** | On stdio transport, stdout is the JSON-RPC channel. console.log corrupts the protocol. | Use `console.error()` or MCP logging notifications exclusively |
| **Blocking on npm install without progress** | create_project runs npm install which can take 30+ seconds silently. Tool appears hung. | Emit progress notification during npm install phase |
| **Requiring --config file path as input** | Forces agent to write temp files. Adds file management complexity to agent workflow. | Accept inline config as tool inputs (already structured) |
| **Merging create_project + setup_aws_envs into one tool** | Conflates two separable concerns; reduces agent flexibility to run phases independently | Keep tools separate and composable. Agent orchestrates sequence. |
| **Requiring tools run from inside project directory** | Stdio cwd is non-deterministic. Tool may be called from any directory. | Accept explicit `projectPath` input on all tools; fall back to cwd-search only if omitted |
| **Silently swallowing AWS errors** | If account creation fails due to email conflict, agent must know to retry with different email | Return structured error with AWS error code and message |

---

## Feature Dependencies (Composability Map)

The tools are designed to be called in sequence by an agent:

```
create_project(name, ...)
  → returns: projectPath, configPath

get_project_status(projectPath)
  → returns: nextSteps = ["Run setup_aws_envs"]

setup_aws_envs(projectPath, email)
  → writes deployment credentials to .aws-starter-config.json
  → returns: accounts, credentialsWritten=true

initialize_github(projectPath)
  → reads deployment credentials from .aws-starter-config.json
  → returns: configured=["dev","stage","prod"]

get_project_status(projectPath)
  → returns: nextSteps = ["Push to GitHub to trigger first CI/CD run"]
```

The `projectPath` is the thread connecting all four tools. An agent receives it from `create_project` and passes it to every subsequent call.

---

## Existing Patterns Worth Following

**AWS MCP servers (community, not official):** Available MCP servers for AWS services exist but none specifically wrap a project scaffolding CLI. The AWS SDK v3 credential chain pattern (environment → profile → instance metadata) is the established approach.

**Official MCP filesystem server:** Uses Zod schemas for input validation, returns structured JSON in `structuredContent` alongside human-readable `text` content. Both text and structured output should be provided for compatibility with clients that may not support `structuredContent`.

**TypeScript SDK `server.registerTool` pattern:**

```typescript
server.registerTool(
  "create_project",
  {
    description: "Scaffold a new React/RN/Lambda/CDK monorepo project",
    inputSchema: { name: z.string().min(1).describe("..."), ... },
    annotations: { title: "Create Project" }
  },
  async ({ name, ... }, { progressToken }) => {
    // progressToken from request metadata enables progress notifications
    if (progressToken) {
      await server.sendProgressNotification({ progressToken, progress: 1, total: 6, message: "Validating config..." });
    }
    // ... execute ...
    return {
      content: [{ type: "text", text: "Project created at /path/to/project" }],
      structuredContent: { projectPath: "...", projectName: "..." }
    };
  }
);
```

**Confidence:** HIGH — verified with official TypeScript SDK docs at `modelcontextprotocol.io`.

---

## MVP Recommendation

For v1.8 to function end-to-end with an AI agent:

**Must build (table stakes):**
1. All four tools with input schemas above
2. Environment-based credential reading (`AWS_ACCESS_KEY_ID`, `GITHUB_TOKEN`)
3. `projectPath` input on all tools
4. Structured JSON output on all tools
5. `isError: true` with actionable messages
6. `process.exit()` removal from config/validation functions (or create non-exiting variants for MCP use)
7. `console.log` → `console.error` in MCP server code
8. Progress notifications for `create_project` and `setup_aws_envs`
9. `nextSteps` array in `get_project_status`

**Defer to post-MVP:**
- `outputSchema` declarations (nice but not required for function)
- `annotations.readOnly` on `get_project_status` (client-side optimization)
- Partial failure reporting granularity in `initialize_github` (can return all-or-nothing initially)
- `warnings` array in status (useful but low urgency)

---

## Known Implementation Constraints

**`process.exit()` in existing code:** The current `loadNonInteractiveConfig()` and `loadSetupAwsEnvsConfig()` functions call `process.exit(1)` on validation failure. In an MCP server, this kills the server process, not just the current request. These functions need either non-exiting variants or a try/catch wrapper in MCP tool handlers that catches the exit.

**`console.log` in wizard and command code:** The existing CLI commands use `console.log` extensively for progress output. The MCP server must redirect or suppress this output, since on stdio transport any stdout write corrupts the JSON-RPC protocol. Option: use a capture wrapper or create MCP-specific execution paths that emit progress via notifications instead.

**Working directory assumption:** Existing commands use `find-up` to locate `.aws-starter-config.json` from cwd. This works when the user `cd`s into the project directory. In MCP context, the server's cwd may be arbitrary. The `projectPath` input parameter gives the agent explicit control, and the server should resolve config from that path rather than cwd.

---

## Sources

**Official MCP Documentation (HIGH confidence):**
- [MCP Tools Specification](https://modelcontextprotocol.io/specification/2025-11-25/server/tools) — Tool schema, isError, structured content
- [MCP Progress Tracking](https://modelcontextprotocol.io/specification/2025-11-25/basic/utilities/progress) — progressToken, notifications/progress format
- [MCP Debugging Guide](https://modelcontextprotocol.io/docs/tools/debugging) — env variable inheritance, stdio transport constraints, console.log warning
- [MCP Cancellation](https://modelcontextprotocol.io/specification/2025-11-25/basic/utilities/cancellation) — Cancellation notification format
- [Build an MCP Server (TypeScript)](https://modelcontextprotocol.io/docs/develop/build-server) — server.registerTool pattern, StdioServerTransport, console.error requirement

**Project Codebase (HIGH confidence):**
- `/src/config/non-interactive.ts` — NonInteractiveConfigSchema (exact field names, types, defaults)
- `/src/config/non-interactive-aws.ts` — SetupAwsEnvsConfigSchema, deriveEnvironmentEmails
- `/src/utils/project-context.ts` — ProjectConfigMinimal shape, DeploymentCredentials structure
- `/src/types.ts` — ProjectConfig, OrgConfig, AuthConfig interfaces
- `/src/commands/initialize-github.ts` — GitHub PAT prompting pattern (to understand what to replace)

**Research date:** 2026-03-25
