import type { ProjectConfig, AuthProvider } from '../types.js';
import type { TokenValues, TemplateManifest } from './types.js';

/**
 * Convert kebab-case to PascalCase
 * my-awesome-app -> MyAwesomeApp
 */
function toPascalCase(str: string): string {
  return str
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join('');
}

/**
 * Convert kebab-case to Title Case
 * my-awesome-app -> My Awesome App
 */
function toTitleCase(str: string): string {
  return str
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Find account ID for a specific environment name
 */
function findAccountIdByEnvironment(
  accounts: Array<{ environment: string; accountId?: string }> | undefined,
  environment: string
): string {
  const account = accounts?.find(
    (a) => a.environment.toLowerCase() === environment.toLowerCase()
  );
  return account?.accountId ?? '';
}

/**
 * Derive all token values from user's ProjectConfig
 */
export function deriveTokenValues(config: ProjectConfig): TokenValues {
  // Build organization accounts JSON for flexible environment handling
  const orgAccounts = config.org?.accounts?.map((a) => ({
    environment: a.environment,
    accountId: a.accountId ?? '',
  })) ?? [];

  return {
    PROJECT_NAME: config.projectName,
    PROJECT_NAME_PASCAL: toPascalCase(config.projectName),
    PROJECT_NAME_TITLE: toTitleCase(config.projectName),
    AWS_REGION: config.awsRegion,
    PACKAGE_SCOPE: `@${config.projectName}`,
    BRAND_COLOR: config.brandColor,
    AUTH_COGNITO: config.auth.provider === 'cognito' ? 'true' : 'false',
    AUTH_AUTH0: config.auth.provider === 'auth0' ? 'true' : 'false',
    AUTH_SOCIAL_LOGIN: config.auth.features.includes('social-login') ? 'true' : 'false',
    AUTH_MFA: config.auth.features.includes('mfa') ? 'true' : 'false',
    // Organization tokens
    ORG_ENABLED: config.org?.enabled ? 'true' : 'false',
    ORG_NAME: config.org?.organizationName ?? '',
    ORG_ACCOUNTS_JSON: JSON.stringify(orgAccounts),
    // Common environment account IDs for backward compatibility
    DEV_ACCOUNT_ID: findAccountIdByEnvironment(config.org?.accounts, 'dev'),
    STAGE_ACCOUNT_ID: findAccountIdByEnvironment(config.org?.accounts, 'stage'),
    PROD_ACCOUNT_ID: findAccountIdByEnvironment(config.org?.accounts, 'prod'),
  };
}

/**
 * Template manifest defining shared and platform-specific files
 * This matches the structure in templates/manifest.json
 */
export const templateManifest: TemplateManifest = {
  shared: [
    { src: 'root/package.json', dest: 'package.json' },
    { src: 'root/tsconfig.base.json', dest: 'tsconfig.base.json' },
    { src: 'root/nx.json', dest: 'nx.json' },
    { src: 'root/jest.preset.js', dest: 'jest.preset.js' },
    { src: 'root/eslint.config.js', dest: 'eslint.config.js' },
    { src: 'root/.npmrc', dest: '.npmrc' },
    { src: 'root/.nvmrc', dest: '.nvmrc' },
    { src: 'root/.editorconfig', dest: '.editorconfig' },
    { src: 'root/.gitignore', dest: '.gitignore' },
    { src: 'packages/common-types', dest: 'packages/common-types' },
    { src: 'packages/api-client', dest: 'packages/api-client' },
  ],
  byPlatform: {
    web: [{ src: 'apps/web', dest: 'apps/web' }],
    mobile: [{ src: 'apps/mobile', dest: 'apps/mobile' }],
    api: [{ src: 'apps/api', dest: 'apps/api' }],
  },
  byFeature: {
    'github-actions': [{ src: '.github', dest: '.github' }],
    'vscode-config': [{ src: '.vscode', dest: '.vscode' }],
  },
  byAuthProvider: {
    cognito: [
      { src: 'apps/api/cdk/auth', dest: 'apps/api/cdk/auth' },
      { src: 'apps/web/src/auth/cognito-provider.tsx', dest: 'apps/web/src/auth/cognito-provider.tsx' },
      { src: 'apps/web/src/config/amplify-config.ts', dest: 'apps/web/src/config/amplify-config.ts' },
      { src: 'apps/api/src/middleware/cognito-auth.ts', dest: 'apps/api/src/middleware/cognito-auth.ts' },
    ],
    auth0: [
      { src: 'apps/web/src/auth/auth0-provider.tsx', dest: 'apps/web/src/auth/auth0-provider.tsx' },
      { src: 'apps/web/src/config/auth0-config.ts', dest: 'apps/web/src/config/auth0-config.ts' },
      { src: 'apps/api/src/middleware/auth0-auth.ts', dest: 'apps/api/src/middleware/auth0-auth.ts' },
    ],
    none: [],
  },
};
