import { CognitoJwtVerifier } from 'aws-jwt-verify';
import type { CognitoJwtPayload } from 'aws-jwt-verify/jwt-model';
import { errorResponse } from '../utils/response';
import { ERROR_CODES, HTTP_STATUS } from '{{PACKAGE_SCOPE}}/common-types';

/**
 * Authenticated user information extracted from JWT token
 */
export interface AuthUser {
  /** Cognito user ID (subject claim) */
  sub: string;
  /** User's email address (if available in token) */
  email?: string;
  /** Cognito groups the user belongs to */
  groups?: string[];
  /** Full JWT payload for additional claims access */
  tokenPayload: CognitoJwtPayload;
}

// Verifier instantiated outside handler for JWKS caching across Lambda invocations
const verifier = CognitoJwtVerifier.create({
  userPoolId: process.env['COGNITO_USER_POOL_ID']!,
  tokenUse: 'access',
  clientId: process.env['COGNITO_CLIENT_ID']!,
});

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
    const payload = await verifier.verify(token);
    return {
      sub: payload.sub,
      email: payload['email'] as string | undefined,
      groups: payload['cognito:groups'] as string[] | undefined,
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
    const authHeader = (event as Record<string, Record<string, string>>)['headers']?.['authorization'] ||
                       (event as Record<string, Record<string, string>>)['headers']?.['Authorization'];

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
