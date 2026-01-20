/**
 * API Client Configuration Utilities
 *
 * Provides environment-aware configuration for the API client.
 * Works across different environments (web, mobile, Node.js)
 */

import type { ApiClientConfig } from './api-client';

/**
 * Environment-specific configuration options
 */
export interface EnvironmentConfig {
  /**
   * API base URL (e.g., 'https://api.example.com')
   */
  apiBaseUrl?: string;

  /**
   * Request timeout in milliseconds
   */
  apiTimeout?: string | number;

  /**
   * API key or token for authentication
   */
  apiKey?: string;

  /**
   * Whether to send credentials (cookies) with requests
   */
  apiWithCredentials?: string | boolean;

  /**
   * Enable debug logging
   */
  apiDebug?: string | boolean;
}

/**
 * Default configuration values
 */
const DEFAULT_CONFIG = {
  baseURL: 'http://localhost:3000',
  timeout: 30000,
  withCredentials: false,
  debug: false,
} as const;

/**
 * Convert string values to appropriate types
 */
function parseValue<T>(value: string | T | undefined, defaultValue: T): T {
  if (value === undefined) return defaultValue;
  if (typeof value !== 'string') return value;

  // Handle boolean strings
  if (typeof defaultValue === 'boolean') {
    return (value.toLowerCase() === 'true') as T;
  }

  // Handle number strings
  if (typeof defaultValue === 'number') {
    const parsed = parseInt(value, 10);
    return (isNaN(parsed) ? defaultValue : parsed) as T;
  }

  return value as T;
}

/**
 * Get environment variable value
 *
 * Supports multiple environment variable naming conventions:
 * - Vite: VITE_API_BASE_URL
 * - Expo: EXPO_PUBLIC_API_BASE_URL
 * - Node.js: API_BASE_URL
 */
function getEnvVar(name: string): string | undefined {
  // Check Node.js process.env (works for both Node.js and React Native/Expo)
  if (typeof process !== 'undefined' && process.env) {
    // Try EXPO_PUBLIC_ prefix first (for React Native/Expo)
    const expoVar = process.env[`EXPO_PUBLIC_${name}`] as string | undefined;
    if (expoVar) return expoVar;

    // Try VITE_ prefix (for Vite)
    const viteVar = process.env[`VITE_${name}`] as string | undefined;
    if (viteVar) return viteVar;

    // Try regular name (for Node.js)
    const nodeVar = process.env[name] as string | undefined;
    if (nodeVar) return nodeVar;
  }

  return undefined;
}

/**
 * Create API client configuration from environment variables
 *
 * Environment variable mapping:
 * - VITE_API_BASE_URL / EXPO_PUBLIC_API_BASE_URL / API_BASE_URL
 * - VITE_API_TIMEOUT / EXPO_PUBLIC_API_TIMEOUT / API_TIMEOUT
 * - VITE_API_KEY / EXPO_PUBLIC_API_KEY / API_KEY
 * - VITE_API_WITH_CREDENTIALS / EXPO_PUBLIC_API_WITH_CREDENTIALS / API_WITH_CREDENTIALS
 * - VITE_API_DEBUG / EXPO_PUBLIC_API_DEBUG / API_DEBUG
 *
 * @param overrides - Optional configuration overrides
 * @returns API client configuration
 */
export function createConfigFromEnv(overrides?: Partial<ApiClientConfig>): ApiClientConfig {
  const baseURL = getEnvVar('API_BASE_URL') || DEFAULT_CONFIG.baseURL;
  const timeout = parseValue(getEnvVar('API_TIMEOUT'), DEFAULT_CONFIG.timeout);
  const withCredentials = parseValue(getEnvVar('API_WITH_CREDENTIALS'), DEFAULT_CONFIG.withCredentials);
  const apiKey = getEnvVar('API_KEY');
  const debug = parseValue(getEnvVar('API_DEBUG'), DEFAULT_CONFIG.debug);

  // Build headers
  const headers: Record<string, string> = {};
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  // Log configuration in debug mode
  if (debug) {
    console.log('[API Client] Configuration:', {
      baseURL,
      timeout,
      withCredentials,
      hasApiKey: !!apiKey,
    });
  }

  return {
    baseURL,
    timeout,
    withCredentials,
    headers,
    ...overrides,
  };
}

/**
 * Get default API base URL based on environment
 *
 * Auto-detects the appropriate URL:
 * - In production (web): Uses window.location.origin
 * - In development (web): Uses localhost:3000
 * - With env var: Uses provided URL
 *
 * @returns The base URL for API requests
 */
export function getDefaultBaseURL(): string {
  // Check for explicit environment variable
  const envUrl = getEnvVar('API_BASE_URL');
  if (envUrl) return envUrl;

  // In browser, check if we're in production
  if (typeof window !== 'undefined') {
    const origin = window.location.origin;

    // If running on localhost, assume API is on port 3000
    if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
      return 'http://localhost:3000';
    }

    // In production, API is at same origin (CloudFront setup)
    return origin;
  }

  // Default fallback
  return DEFAULT_CONFIG.baseURL;
}

/**
 * Create API client configuration with smart defaults
 *
 * @param overrides - Optional configuration overrides
 * @returns API client configuration
 */
export function createConfig(overrides?: Partial<ApiClientConfig>): ApiClientConfig {
  const baseURL = overrides?.baseURL || getDefaultBaseURL();

  return createConfigFromEnv({
    ...overrides,
    baseURL,
  });
}

/**
 * Export default configuration values for reference
 */
export const DEFAULT_API_CONFIG = DEFAULT_CONFIG;
