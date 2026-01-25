import type { ApiGatewayProxyResult } from '{{PACKAGE_SCOPE}}/common-types';
import { HTTP_STATUS } from '{{PACKAGE_SCOPE}}/common-types';
import { successResponse } from '../../utils/response';
import {
  createLambdaHandler,
  type ParsedRequest,
} from '../../utils/lambda-handler';
// {{#if AUTH_COGNITO}}
import { requireAuth, type AuthUser } from '../../middleware/cognito-auth';
// {{/if AUTH_COGNITO}}
// {{#if AUTH_AUTH0}}
import { requireAuth, type AuthUser } from '../../middleware/auth0-auth';
// {{/if AUTH_AUTH0}}

/**
 * Extended request type that includes authenticated user
 */
// {{#if AUTH_COGNITO}}
interface AuthenticatedRequest extends ParsedRequest {
  user: AuthUser;
}
// {{/if AUTH_COGNITO}}
// {{#if AUTH_AUTH0}}
interface AuthenticatedRequest extends ParsedRequest {
  user: AuthUser;
}
// {{/if AUTH_AUTH0}}

/**
 * GET /users/me - Get current authenticated user
 * This endpoint requires authentication
 */
async function getMeHandler(
  request: ParsedRequest
): Promise<ApiGatewayProxyResult> {
  // {{#if AUTH_COGNITO}}
  const authRequest = request as AuthenticatedRequest;
  const user = authRequest.user;

  return successResponse({
    id: user.sub,
    email: user.email,
    emailVerified: user.tokenPayload['email_verified'],
    groups: user.groups || [],
  }, HTTP_STATUS.OK);
  // {{/if AUTH_COGNITO}}
  // {{#if AUTH_AUTH0}}
  const authRequest = request as AuthenticatedRequest;
  const user = authRequest.user;

  return successResponse({
    id: user.sub,
    email: user.email,
    emailVerified: user.tokenPayload['email_verified'],
    permissions: user.permissions || [],
  }, HTTP_STATUS.OK);
  // {{/if AUTH_AUTH0}}
}

/**
 * Lambda handler with authentication middleware
 */
// {{#if AUTH_COGNITO}}
export const handler = requireAuth(
  createLambdaHandler(getMeHandler, 'GetMe')
);
// {{/if AUTH_COGNITO}}
// {{#if AUTH_AUTH0}}
export const handler = requireAuth(
  createLambdaHandler(getMeHandler, 'GetMe')
);
// {{/if AUTH_AUTH0}}
