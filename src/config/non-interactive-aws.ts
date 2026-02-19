import * as z from 'zod';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import pc from 'picocolors';

/**
 * Zod schema for the non-interactive JSON config file for setup-aws-envs.
 * Only `email` is required — all other AWS setup config lives in .aws-starter-config.json.
 */
export const SetupAwsEnvsConfigSchema = z.object({
  email: z.string().min(1, { message: 'email is required' }),
});

export type SetupAwsEnvsConfig = z.infer<typeof SetupAwsEnvsConfigSchema>;

/**
 * Load, validate, and return a SetupAwsEnvsConfig from a JSON config file path.
 * Exits with code 1 and prints all errors if validation fails.
 * Also exits with code 1 if the email does not contain an '@' sign.
 */
export function loadSetupAwsEnvsConfig(configPath: string): SetupAwsEnvsConfig {
  // 1. Resolve path relative to cwd
  const absolutePath = resolve(process.cwd(), configPath);

  // 2. Read file — fail fast if not found or unreadable
  let rawContent: string;
  try {
    rawContent = readFileSync(absolutePath, 'utf-8');
  } catch {
    console.error(pc.red('Error:') + ` Cannot read config file: ${absolutePath}`);
    process.exit(1);
  }

  // 3. Parse JSON — fail fast if invalid
  let rawData: unknown;
  try {
    rawData = JSON.parse(rawContent);
  } catch {
    console.error(pc.red('Error:') + ` Config file is not valid JSON: ${absolutePath}`);
    process.exit(1);
  }

  // 4. Validate with Zod — collect ALL errors in one pass
  const result = SetupAwsEnvsConfigSchema.safeParse(rawData);

  if (!result.success) {
    console.error(pc.red('Error:') + ' Invalid config file:');
    console.error('');
    for (const issue of result.error.issues) {
      const fieldPath = issue.path.length > 0 ? issue.path.join('.') : '(root)';
      console.error(`  ${pc.red('x')} ${fieldPath}: ${issue.message}`);
    }
    console.error('');
    process.exit(1);
  }

  // 5. Additional email format check — must contain '@' for derivation to work correctly
  if (!result.data.email.includes('@')) {
    console.error(pc.red('Error:') + ' Invalid config file:');
    console.error('');
    console.error(`  ${pc.red('x')} email: must be a valid email address`);
    console.error('');
    process.exit(1);
  }

  return result.data;
}

/**
 * Derive per-environment email addresses from a root email.
 * Inserts -{env} between the local part and the domain.
 *
 * Example:
 *   deriveEnvironmentEmails('owner@example.com', ['dev', 'stage', 'prod'])
 *   → { dev: 'owner-dev@example.com', stage: 'owner-stage@example.com', prod: 'owner-prod@example.com' }
 *
 * Handles plus aliases: 'user+tag@company.com' → 'user+tag-dev@company.com'
 * Handles subdomains: 'admin@sub.example.com' → 'admin-dev@sub.example.com'
 */
export function deriveEnvironmentEmails(
  rootEmail: string,
  environments: readonly string[]
): Record<string, string> {
  const atIndex = rootEmail.lastIndexOf('@');
  const localPart = rootEmail.slice(0, atIndex);
  const domain = rootEmail.slice(atIndex); // includes '@'

  const derived: Record<string, string> = {};
  for (const env of environments) {
    derived[env] = `${localPart}-${env}${domain}`;
  }
  return derived;
}
