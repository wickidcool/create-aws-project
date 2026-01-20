import { createApiClient, createConfigFromEnv } from '{{PACKAGE_SCOPE}}/api-client';

/**
 * Configured API client instance
 *
 * Configuration is loaded from environment variables:
 * - EXPO_PUBLIC_API_BASE_URL: API base URL (default: http://localhost:3000)
 * - EXPO_PUBLIC_API_TIMEOUT: Request timeout in milliseconds
 * - EXPO_PUBLIC_API_KEY: API key for authentication
 * - EXPO_PUBLIC_API_WITH_CREDENTIALS: Whether to send credentials
 * - EXPO_PUBLIC_API_DEBUG: Enable debug logging
 *
 * Create a .env file in the mobile app directory with these variables.
 * See ENV_EXAMPLE.md in the api-client package for more details.
 */
export const apiClient = createApiClient(createConfigFromEnv());
