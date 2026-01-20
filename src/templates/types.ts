import type { ProjectConfig, Feature, AuthProvider } from '../types.js';

/** Mapping of token names to their replacement values */
export interface TokenValues {
  PROJECT_NAME: string;
  PROJECT_NAME_PASCAL: string;
  PROJECT_NAME_TITLE: string;
  AWS_REGION: string;
  PACKAGE_SCOPE: string;
  BRAND_COLOR: string;
  AUTH_COGNITO: string;
  AUTH_AUTH0: string;
  AUTH_SOCIAL_LOGIN: string;
  AUTH_MFA: string;
  /** Organization enabled flag ('true' or 'false') */
  ORG_ENABLED?: string;
  /** Organization name */
  ORG_NAME?: string;
  /** JSON array of {environment, accountId} objects for templates needing full list */
  ORG_ACCOUNTS_JSON?: string;
  /** Development environment AWS Account ID (empty if not selected) */
  DEV_ACCOUNT_ID?: string;
  /** Staging environment AWS Account ID (empty if not selected) */
  STAGE_ACCOUNT_ID?: string;
  /** Production environment AWS Account ID (empty if not selected) */
  PROD_ACCOUNT_ID?: string;
}

/** Platform identifiers for conditional templates */
export type Platform = 'web' | 'mobile' | 'api';

/** A single template file entry */
export interface TemplateFile {
  /** Source path relative to templates/ directory */
  src: string;
  /** Destination path relative to output directory (may contain tokens) */
  dest: string;
  /** Which platforms this file belongs to (undefined = all platforms) */
  platforms?: Platform[];
}

/** Complete template manifest */
export interface TemplateManifest {
  /** Files that are always included */
  shared: TemplateFile[];
  /** Files grouped by platform */
  byPlatform: Record<Platform, TemplateFile[]>;
  /** Files grouped by feature */
  byFeature: Record<Feature, TemplateFile[]>;
  /** Files grouped by auth provider */
  byAuthProvider: Record<AuthProvider, TemplateFile[]>;
}

/** Function to derive token values from ProjectConfig */
export type DeriveTokenValues = (config: ProjectConfig) => TokenValues;

/** Re-export Feature and AuthProvider types for convenience */
export type { Feature, AuthProvider };
