import type {
  ApiGatewayProxyResult,
  UpdateUserRequest,
} from '{{PACKAGE_SCOPE}}/common-types';
import { HTTP_STATUS, ERROR_CODES } from '{{PACKAGE_SCOPE}}/common-types';
import { successResponse } from '../../utils/response';
import { validate, getValidationErrors } from '../../utils/validator';
import { userService } from '../../services/user-service';
import {
  createLambdaHandler,
  createErrorResult,
  validatePathParameters,
  validateBodyPresent,
  type ParsedRequest,
} from '../../utils/lambda-handler';
import { updateUserSchema } from '../../schemas/user.schema';

/**
 * PUT /users/{id} - Update user
 */
async function updateUserHandler(
  request: ParsedRequest<UpdateUserRequest>
): Promise<ApiGatewayProxyResult> {
  // Validate required path parameters
  const pathValidation = validatePathParameters(request.pathParameters, ['id']);
  if (!pathValidation.valid) {
    throw createErrorResult(
      ERROR_CODES.VALIDATION_ERROR,
      'User ID is required',
      HTTP_STATUS.BAD_REQUEST
    );
  }

  // Validate body is present
  const bodyValidation = validateBodyPresent(request.body, request.rawBody);
  if (!bodyValidation.valid) {
    throw createErrorResult(
      ERROR_CODES.VALIDATION_ERROR,
      bodyValidation.error || 'Request body is required',
      HTTP_STATUS.BAD_REQUEST
    );
  }

  // Validate request data with AJV schema
  const validation = validate(updateUserSchema, request.body);
  if (!validation.valid) {
    throw createErrorResult(
      ERROR_CODES.VALIDATION_ERROR,
      getValidationErrors(validation.errors),
      HTTP_STATUS.BAD_REQUEST,
      { errors: validation.errors }
    );
  }

  const userId = request.pathParameters['id'];
  const updatedUser = await userService.updateUser(userId, request.body as UpdateUserRequest);

  if (!updatedUser) {
    throw createErrorResult(
      ERROR_CODES.NOT_FOUND,
      'User not found',
      HTTP_STATUS.NOT_FOUND
    );
  }

  return successResponse(updatedUser, HTTP_STATUS.OK, 'User updated successfully');
}

/**
 * Lambda handler wrapper
 */
export const handler = createLambdaHandler(updateUserHandler, 'UpdateUser');
