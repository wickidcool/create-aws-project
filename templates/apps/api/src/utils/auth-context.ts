import type { APIGatewayProxyEvent } from 'aws-lambda';
import type { AuthUser } from '../middleware/cognito-auth';

/**
 * Get auth user from request context
 * Used when auth is handled by API Gateway authorizer instead of middleware
 *
 * @param event - API Gateway proxy event with authorizer claims
 * @returns AuthUser if claims present in context, null otherwise
 */
export function getAuthUserFromContext(event: APIGatewayProxyEvent): AuthUser | null {
  const claims = event.requestContext?.authorizer?.claims;

  if (!claims) {
    return null;
  }

  return {
    sub: claims.sub,
    email: claims.email,
    groups: claims['cognito:groups']?.split(','),
    tokenPayload: claims as AuthUser['tokenPayload'],
  };
}

/**
 * Check if user has required group membership
 *
 * @param user - Authenticated user
 * @param groupName - Name of the Cognito group to check
 * @returns true if user belongs to the specified group
 *
 * @example
 * ```typescript
 * if (hasGroup(user, 'admins')) {
 *   // User is an admin
 * }
 * ```
 */
export function hasGroup(user: AuthUser, groupName: string): boolean {
  return user.groups?.includes(groupName) ?? false;
}

/**
 * Check if user is the owner of a resource
 *
 * @param user - Authenticated user
 * @param resourceOwnerId - The owner ID stored on the resource
 * @returns true if the user's sub matches the resource owner ID
 *
 * @example
 * ```typescript
 * if (!isOwner(user, document.ownerId)) {
 *   return errorResponse(ERROR_CODES.FORBIDDEN, 'Not authorized');
 * }
 * ```
 */
export function isOwner(user: AuthUser, resourceOwnerId: string): boolean {
  return user.sub === resourceOwnerId;
}
