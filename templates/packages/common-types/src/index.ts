/**
 * {{PACKAGE_SCOPE}}/common-types
 *
 * Shared TypeScript types for the monorepo
 *
 * This package provides common types used across frontend and backend:
 * - User types and API requests
 * - API response structures
 * - AWS Lambda event/context types
 * - Common utilities and constants
 * - Authentication types (Cognito/Auth0)
 */

// Re-export all types for convenience
export * from './user.types';
export * from './api.types';
export * from './lambda.types';
export * from './common.types';
export * from './auth.types';
