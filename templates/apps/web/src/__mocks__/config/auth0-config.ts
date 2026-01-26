/**
 * Mock Auth0 configuration for tests
 */
export interface Auth0Config {
  domain: string;
  clientId: string;
  audience?: string;
  redirectUri: string;
}

export const auth0Config: Auth0Config = {
  domain: 'test.auth0.com',
  clientId: 'test-client-id',
  audience: 'https://test-api',
  redirectUri: 'http://localhost:3000',
};
