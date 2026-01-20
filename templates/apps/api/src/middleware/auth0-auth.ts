import { createRemoteJWKSet, jwtVerify } from 'jose';
import type { JWTPayload } from 'jose';
import { errorResponse } from '../utils/response';
import { ERROR_CODES, HTTP_STATUS } from '{{PACKAGE_SCOPE}}/common-types';

/**
 * Authenticated user information extracted from Auth0 JWT token
 */
export interface AuthUser {
  /** Auth0 user ID (subject claim) */
  sub: string;
  /** User's email address (if available in token) */
  email?: string;
  /** Auth0 permissions assigned to the user */
  permissions?: string[];
  /** Full JWT payload for additional claims access */
  tokenPayload: JWTPayload;
}

// Auth0 configuration from environment
const AUTH0_DOMAIN = process.env['AUTH0_DOMAIN']!;
const AUTH0_AUDIENCE = process.env['AUTH0_AUDIENCE']!;

// JWKS endpoint for Auth0
const jwksUri = `https://${AUTH0_DOMAIN}/.well-known/jwks.json`;

// Create JWKS client - instantiated outside handler for caching across Lambda invocations
const JWKS = createRemoteJWKSet(new URL(jwksUri));

/**
 * Verify a JWT access token from the Authorization header
 *
 * @param authHeader - The Authorization header value (e.g., "Bearer <token>")
 * @returns The authenticated user if token is valid, null otherwise
 */
export async function verifyToken(authHeader: string | undefined): Promise<AuthUser | null> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.slice(7); // Remove 'Bearer ' prefix

  try {
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: `https://${AUTH0_DOMAIN}/`,
      audience: AUTH0_AUDIENCE,
    });

    return {
      sub: payload.sub!,
      email: payload.email as string | undefined,
      permissions: payload.permissions as string[] | undefined,
      tokenPayload: payload,
    };
  } catch (error) {
    console.error('Token verification failed:', error);
    return null;
  }
}

/**
 * Middleware wrapper that requires authentication for a handler
 *
 * Wraps a handler function to automatically verify the JWT token
 * and pass the authenticated user to the handler.
 *
 * @example
 * ```typescript
 * export const handler = requireAuth(async (event, user) => {
 *   console.log('User ID:', user.sub);
 *   return successResponse({ userId: user.sub });
 * });
 * ```
 *
 * @param handler - Handler function that receives the event and authenticated user
 * @returns Wrapped handler that validates authentication first
 */
export function requireAuth<T>(
  handler: (event: T, user: AuthUser) => Promise<unknown>
): (event: T) => Promise<unknown> {
  return async (event: T) => {
    const authHeader = (event as Record<string, Record<string, string>>).headers?.authorization ||
                       (event as Record<string, Record<string, string>>).headers?.Authorization;

    const user = await verifyToken(authHeader);

    if (!user) {
      return errorResponse(
        ERROR_CODES.UNAUTHORIZED,
        'Invalid or missing authentication token',
        HTTP_STATUS.UNAUTHORIZED
      );
    }

    return handler(event, user);
  };
}
