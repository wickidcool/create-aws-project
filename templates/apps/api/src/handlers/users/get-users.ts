import type { ApiGatewayProxyResult } from '{{PACKAGE_SCOPE}}/common-types';
import { HTTP_STATUS } from '{{PACKAGE_SCOPE}}/common-types';
import { successResponse } from '../../utils/response';
import { userService } from '../../services/user-service';
import {
  createLambdaHandler,
  type ParsedRequest,
} from '../../utils/lambda-handler';

/**
 * GET /users - Get all users
 */
async function getUsersHandler(
  request: ParsedRequest
): Promise<ApiGatewayProxyResult> {
  const userList = await userService.getAllUsers();
  return successResponse(userList, HTTP_STATUS.OK);
}

/**
 * Lambda handler wrapper
 */
export const handler = createLambdaHandler(getUsersHandler, 'GetUsers');
