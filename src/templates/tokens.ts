/**
 * Template Token Constants
 *
 * Placeholder tokens used throughout template files for project customization.
 * Uses double-brace syntax {{TOKEN}} because:
 * - Distinct from JS template literals (${}), EJS (<%%>), Mustache ({{}})
 * - Easy to search/replace with simple regex
 * - Visible in any file type (JSON, TS, MD)
 */

export const TOKENS = {
  /** Project name in kebab-case (e.g., my-awesome-app) */
  PROJECT_NAME: '{{PROJECT_NAME}}',
  /** Project name in PascalCase for class names, stack names (e.g., MyAwesomeApp) */
  PROJECT_NAME_PASCAL: '{{PROJECT_NAME_PASCAL}}',
  /** Project name in Title Case for display (e.g., My Awesome App) */
  PROJECT_NAME_TITLE: '{{PROJECT_NAME_TITLE}}',
  /** AWS region (e.g., us-east-1) */
  AWS_REGION: '{{AWS_REGION}}',
  /** Package scope derived from project name (e.g., @my-awesome-app) */
  PACKAGE_SCOPE: '{{PACKAGE_SCOPE}}',
  /** Brand color for theme (e.g., blue, purple, teal, green, orange) */
  BRAND_COLOR: '{{BRAND_COLOR}}',
  /** Organization enabled flag ('true' or 'false') */
  ORG_ENABLED: '{{ORG_ENABLED}}',
  /** Organization name */
  ORG_NAME: '{{ORG_NAME}}',
  /** JSON array of {environment, accountId} objects for flexible environment handling */
  ORG_ACCOUNTS_JSON: '{{ORG_ACCOUNTS_JSON}}',
  /** Development environment AWS Account ID (empty if not selected) */
  DEV_ACCOUNT_ID: '{{DEV_ACCOUNT_ID}}',
  /** Staging environment AWS Account ID (empty if not selected) */
  STAGE_ACCOUNT_ID: '{{STAGE_ACCOUNT_ID}}',
  /** Production environment AWS Account ID (empty if not selected) */
  PROD_ACCOUNT_ID: '{{PROD_ACCOUNT_ID}}',
} as const;

/** Regex pattern to match any {{TOKEN_NAME}} placeholder */
export const TOKEN_PATTERN = /\{\{([A-Z_]+)\}\}/g;

/** Type representing valid token names */
export type TokenName = keyof typeof TOKENS;
