/**
 * API Response Types
 *
 * Standard response structures for API endpoints
 */

/**
 * Standard API response wrapper
 */
export interface ApiResponse<T = unknown> {
    success: boolean;
    data?: T;
    error?: ApiError;
    message?: string;
}

/**
 * Error details structure
 */
export interface ApiError {
    code: string;
    message: string;
    details?: Record<string, unknown>;
}
