export type Feature = 'github-actions' | 'vscode-config';

export type BrandColor = 'blue' | 'purple' | 'teal' | 'green' | 'orange';

export type AuthProvider = 'cognito' | 'auth0' | 'none';

export type AuthFeature = 'social-login' | 'mfa';

export interface AuthConfig {
  provider: AuthProvider;
  features: AuthFeature[];
}

export interface ProjectConfig {
  projectName: string;
  platforms: ('web' | 'mobile' | 'api')[];
  awsRegion: string;
  features: Feature[];
  brandColor: BrandColor;
  auth: AuthConfig;
}
