import type { ResourcesConfig } from 'aws-amplify';

/**
 * Amplify configuration for Cognito authentication
 * Values should be set via environment variables
 */
export const amplifyConfig: ResourcesConfig = {
  Auth: {
    Cognito: {
      userPoolId: import.meta.env['VITE_COGNITO_USER_POOL_ID'] ?? '',
      userPoolClientId: import.meta.env['VITE_COGNITO_CLIENT_ID'] ?? '',
      // Optional: Identity Pool for AWS credentials
      // identityPoolId: import.meta.env['VITE_COGNITO_IDENTITY_POOL_ID'],
      loginWith: {
        email: true,
      },
      signUpVerificationMethod: 'code',
      userAttributes: {
        email: { required: true },
      },
      passwordFormat: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireNumbers: true,
      },
    },
  },
};
