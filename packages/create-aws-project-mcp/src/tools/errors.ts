/**
 * Error thrown when required environment variables for a tool are missing.
 * Distinct from input validation errors — callers can check `error.type === 'MISSING_CREDENTIALS'`
 * to differentiate credential config issues from bad tool inputs.
 */
export class MissingCredentialsError extends Error {
  readonly type = 'MISSING_CREDENTIALS' as const;
  readonly missingVars: string[];

  constructor(missingVars: string[]) {
    const snippet = formatMcpJsonSnippet(missingVars);
    super(
      `Missing required credentials: ${missingVars.join(', ')}\n\n` +
      `Add them to your .mcp.json env block:\n\n${snippet}`
    );
    this.name = 'MissingCredentialsError';
    this.missingVars = missingVars;
  }
}

function formatMcpJsonSnippet(vars: string[]): string {
  const envBlock: Record<string, string> = {};
  for (const v of vars) {
    envBlock[v] = 'YOUR_VALUE_HERE';
  }
  return JSON.stringify(
    { mcpServers: { 'create-aws-project': { env: envBlock } } },
    null,
    2
  );
}

/**
 * Check that all required environment variables are present and non-empty.
 * Throws MissingCredentialsError listing all missing vars if any are absent.
 */
export function requireEnvVars(vars: string[]): void {
  const missing = vars.filter(v => !process.env[v]?.trim());
  if (missing.length > 0) {
    throw new MissingCredentialsError(missing);
  }
}
