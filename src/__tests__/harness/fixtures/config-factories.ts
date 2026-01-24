import type { ProjectConfig, AuthProvider, BrandColor } from '../../../types.js';

type Platform = 'web' | 'mobile' | 'api';

interface ConfigOverrides {
  projectName?: string;
  platforms?: Platform[];
  awsRegion?: string;
  features?: ('github-actions' | 'vscode-config')[];
  brandColor?: BrandColor;
  authProvider?: AuthProvider;
  authFeatures?: ('social-login' | 'mfa')[];
}

/**
 * Create a base configuration with sensible defaults.
 * All factories should call this to ensure consistent structure.
 */
function createBaseConfig(overrides: ConfigOverrides = {}): ProjectConfig {
  const authProvider = overrides.authProvider ?? 'cognito';
  return {
    projectName: overrides.projectName ?? 'test-project',
    platforms: overrides.platforms ?? ['web', 'api'],
    awsRegion: overrides.awsRegion ?? 'us-east-1',
    features: overrides.features ?? [],
    brandColor: overrides.brandColor ?? 'blue',
    auth: {
      provider: authProvider,
      features: authProvider === 'none' ? [] : (overrides.authFeatures ?? []),
    },
  };
}

// Single platform factories
export const createWebCognitoConfig = (): ProjectConfig =>
  createBaseConfig({ projectName: 'test-web-cognito', platforms: ['web'], authProvider: 'cognito' });

export const createWebAuth0Config = (): ProjectConfig =>
  createBaseConfig({ projectName: 'test-web-auth0', platforms: ['web'], authProvider: 'auth0' });

export const createMobileCognitoConfig = (): ProjectConfig =>
  createBaseConfig({
    projectName: 'test-mobile-cognito',
    platforms: ['mobile'],
    authProvider: 'cognito',
  });

export const createMobileAuth0Config = (): ProjectConfig =>
  createBaseConfig({ projectName: 'test-mobile-auth0', platforms: ['mobile'], authProvider: 'auth0' });

export const createApiCognitoConfig = (): ProjectConfig =>
  createBaseConfig({ projectName: 'test-api-cognito', platforms: ['api'], authProvider: 'cognito' });

export const createApiAuth0Config = (): ProjectConfig =>
  createBaseConfig({ projectName: 'test-api-auth0', platforms: ['api'], authProvider: 'auth0' });

// Double platform factories
export const createWebMobileCognitoConfig = (): ProjectConfig =>
  createBaseConfig({
    projectName: 'test-web-mobile-cognito',
    platforms: ['web', 'mobile'],
    authProvider: 'cognito',
  });

export const createWebMobileAuth0Config = (): ProjectConfig =>
  createBaseConfig({
    projectName: 'test-web-mobile-auth0',
    platforms: ['web', 'mobile'],
    authProvider: 'auth0',
  });

export const createWebApiCognitoConfig = (): ProjectConfig =>
  createBaseConfig({
    projectName: 'test-web-api-cognito',
    platforms: ['web', 'api'],
    authProvider: 'cognito',
  });

export const createWebApiAuth0Config = (): ProjectConfig =>
  createBaseConfig({
    projectName: 'test-web-api-auth0',
    platforms: ['web', 'api'],
    authProvider: 'auth0',
  });

export const createMobileApiCognitoConfig = (): ProjectConfig =>
  createBaseConfig({
    projectName: 'test-mobile-api-cognito',
    platforms: ['mobile', 'api'],
    authProvider: 'cognito',
  });

export const createMobileApiAuth0Config = (): ProjectConfig =>
  createBaseConfig({
    projectName: 'test-mobile-api-auth0',
    platforms: ['mobile', 'api'],
    authProvider: 'auth0',
  });

// Triple platform factories
export const createFullStackCognitoConfig = (): ProjectConfig =>
  createBaseConfig({
    projectName: 'test-full-cognito',
    platforms: ['web', 'mobile', 'api'],
    authProvider: 'cognito',
  });

export const createFullStackAuth0Config = (): ProjectConfig =>
  createBaseConfig({
    projectName: 'test-full-auth0',
    platforms: ['web', 'mobile', 'api'],
    authProvider: 'auth0',
  });
