/**
 * Auth0 configuration
 * Values should be set via environment variables
 */
export interface Auth0Config {
  domain: string;
  clientId: string;
  audience?: string;
  redirectUri: string;
}

export const auth0Config: Auth0Config = {
  domain: import.meta.env.VITE_AUTH0_DOMAIN || '',
  clientId: import.meta.env.VITE_AUTH0_CLIENT_ID || '',
  audience: import.meta.env.VITE_AUTH0_AUDIENCE || undefined,
  redirectUri: typeof window !== 'undefined' ? window.location.origin : '',
};
