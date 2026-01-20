/**
 * Common Types and Constants
 *
 * Shared utility types and constant values used across the application
 */

/**
 * Utility Types
 */

/**
 * Makes a type nullable (can be T or null)
 */
export type Nullable<T> = T | null;

/**
 * Makes a type optional (can be T or undefined)
 */
export type Optional<T> = T | undefined;

/**
 * Constants
 */

/**
 * HTTP status codes
 */
export const HTTP_STATUS = {
    OK: 200,
    CREATED: 201,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    INTERNAL_SERVER_ERROR: 500,
} as const;

/**
 * Application error codes
 */
export const ERROR_CODES = {
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    NOT_FOUND: 'NOT_FOUND',
    UNAUTHORIZED: 'UNAUTHORIZED',
    INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;
