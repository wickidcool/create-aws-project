import { createApiClient, createConfig } from '{{PACKAGE_SCOPE}}/api-client';

/**
 * API Client instance for the web application
 *
 * Configuration is loaded from environment variables (if available):
 * - VITE_API_BASE_URL: API base URL (optional, auto-detects if not set)
 * - VITE_API_TIMEOUT: Request timeout in milliseconds
 * - VITE_API_KEY: API key for authentication
 * - VITE_API_WITH_CREDENTIALS: Whether to send credentials
 * - VITE_API_DEBUG: Enable debug logging
 *
 * Create a .env.local file in the web app directory with these variables.
 * See .env.example for more details.
 *
 * API URL is automatically derived from current web URL if not set:
 * - Local dev (localhost): http://localhost:3000
 * - Production: https://your-domain.com
 *
 * The API client methods include the /api prefix, so:
 * - Calling getUsers() → https://your-domain.com/api/users
 * - CloudFront routes /api/* to API Gateway
 */
export const apiClient = createApiClient(createConfig());

/**
 * Set authentication token (call this after user login)
 */
export function setAuthToken(token: string): void {
  apiClient.setAuthToken(token);
}

/**
 * Clear authentication token (call this on logout)
 */
export function clearAuthToken(): void {
  apiClient.clearAuthToken();
}
