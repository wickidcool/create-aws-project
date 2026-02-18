import * as z from 'zod';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import pc from 'picocolors';
import { validateProjectName } from '../validation/project-name.js';
import type { ProjectConfig } from '../types.js';

// Valid value constants (as const tuples for Zod enum compatibility)
const VALID_PLATFORMS = ['web', 'mobile', 'api'] as const;
const VALID_AUTH_PROVIDERS = ['none', 'cognito', 'auth0'] as const;
const VALID_AUTH_FEATURES = ['social-login', 'mfa'] as const;
const VALID_FEATURES = ['github-actions', 'vscode-config'] as const;
const VALID_REGIONS = [
  'us-east-1',
  'us-west-2',
  'eu-west-1',
  'eu-central-1',
  'ap-northeast-1',
  'ap-southeast-2',
] as const;
const VALID_BRAND_COLORS = ['blue', 'purple', 'teal', 'green', 'orange'] as const;

/**
 * Zod schema for the non-interactive JSON config file.
 * Only `name` is required; all other fields have defaults matching NI-04 spec.
 */
export const NonInteractiveConfigSchema = z.object({
  name: z.string().min(1, { message: 'name is required' }),
  platforms: z.array(z.enum(VALID_PLATFORMS)).min(1).default(['web', 'api']),
  auth: z.enum(VALID_AUTH_PROVIDERS).default('none'),
  authFeatures: z.array(z.enum(VALID_AUTH_FEATURES)).default([]),
  features: z.array(z.enum(VALID_FEATURES)).default(['github-actions', 'vscode-config']),
  region: z.enum(VALID_REGIONS).default('us-east-1'),
  brandColor: z.enum(VALID_BRAND_COLORS).default('blue'),
});

export type NonInteractiveConfig = z.infer<typeof NonInteractiveConfigSchema>;

/**
 * Load, validate, and return a ProjectConfig from a JSON config file path.
 * Exits with code 1 and prints all errors if validation fails.
 */
export function loadNonInteractiveConfig(configPath: string): ProjectConfig {
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
  const result = NonInteractiveConfigSchema.safeParse(rawData);

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

  const cfg = result.data;

  // 5. Additional project name validation via existing npm package name validator
  const nameValidation = validateProjectName(cfg.name);
  if (nameValidation !== true) {
    console.error(pc.red('Error:') + ' Invalid config file:');
    console.error('');
    console.error(`  ${pc.red('x')} name: ${nameValidation}`);
    console.error('');
    process.exit(1);
  }

  // 6. Map to ProjectConfig — silently drop authFeatures when auth is 'none'
  return {
    projectName: cfg.name,
    platforms: cfg.platforms,
    awsRegion: cfg.region,
    features: cfg.features,
    brandColor: cfg.brandColor,
    auth: {
      provider: cfg.auth,
      features: cfg.auth === 'none' ? [] : cfg.authFeatures,
    },
  };
}
