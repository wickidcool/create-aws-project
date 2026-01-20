import type { ApiGatewayProxyResult } from '{{PACKAGE_SCOPE}}/common-types';
import { HTTP_STATUS, ERROR_CODES } from '{{PACKAGE_SCOPE}}/common-types';
import { successResponse } from '../../utils/response';
import { userService } from '../../services/user-service';
import {
  createLambdaHandler,
  createErrorResult,
  validatePathParameters,
  type ParsedRequest,
} from '../../utils/lambda-handler';

/**
 * DELETE /users/{id} - Delete user
 */
async function deleteUserHandler(
  request: ParsedRequest
): Promise<ApiGatewayProxyResult> {
  // Validate required path parameters
  const validation = validatePathParameters(request.pathParameters, ['id']);
  if (!validation.valid) {
    throw createErrorResult(
      ERROR_CODES.VALIDATION_ERROR,
      'User ID is required',
      HTTP_STATUS.BAD_REQUEST
    );
  }

  const userId = request.pathParameters['id'];
  const deleted = await userService.deleteUser(userId);

  if (!deleted) {
    throw createErrorResult(
      ERROR_CODES.NOT_FOUND,
      'User not found',
      HTTP_STATUS.NOT_FOUND
    );
  }

  return successResponse(null, HTTP_STATUS.OK, 'User deleted successfully');
}

/**
 * Lambda handler wrapper
 */
export const handler = createLambdaHandler(deleteUserHandler, 'DeleteUser');
