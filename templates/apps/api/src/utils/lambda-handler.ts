import type {
  ApiGatewayProxyEvent,
  ApiGatewayProxyResult,
} from '{{PACKAGE_SCOPE}}/common-types';
import { HTTP_STATUS, ERROR_CODES } from '{{PACKAGE_SCOPE}}/common-types';
import { errorResponse } from './response';

/**
 * Parsed request data from API Gateway event
 */
export interface ParsedRequest<TBody = unknown> {
  pathParameters: Record<string, string>;
  queryParameters: Record<string, string>;
  headers: Record<string, string>;
  body: TBody | null;
  rawBody: string | null;
  httpMethod: string;
  path: string;
}

/**
 * Handler function type that receives parsed request data
 */
export type HandlerFunction<TBody = unknown, TResponse = unknown> = (
  request: ParsedRequest<TBody>
) => Promise<TResponse>;

/**
 * Parse the API Gateway event into a more convenient format
 */
export function parseRequest<TBody = unknown>(
  event: ApiGatewayProxyEvent
): ParsedRequest<TBody> {
  const pathParameters = event.pathParameters || {};
  const queryParameters = event.queryStringParameters || {};
  const headers = event.headers || {};
  const rawBody = event.body;

  let body: TBody | null = null;
  if (rawBody) {
    try {
      body = JSON.parse(rawBody) as TBody;
    } catch (error) {
      // Body parsing will be handled by validation in handlers
      body = null;
    }
  }

  return {
    pathParameters,
    queryParameters,
    headers,
    body,
    rawBody,
    httpMethod: event.httpMethod,
    path: event.path,
  };
}

/**
 * Validate that required path parameters are present
 */
export function validatePathParameters(
  pathParameters: Record<string, string>,
  required: string[]
): { valid: boolean; missing?: string[] } {
  const missing = required.filter(param => !pathParameters[param]);

  if (missing.length > 0) {
    return { valid: false, missing };
  }

  return { valid: true };
}

/**
 * Validate that request body is present
 */
export function validateBodyPresent(
  body: unknown,
  rawBody: string | null
): { valid: boolean; error?: string } {
  if (!rawBody) {
    return { valid: false, error: 'Request body is required' };
  }

  if (!body) {
    return { valid: false, error: 'Invalid JSON in request body' };
  }

  return { valid: true };
}

/**
 * Wrapper for Lambda handlers that handles common request parsing and error handling
 *
 * @param handlerFn - The handler function to execute
 * @param handlerName - Name of the handler for logging purposes
 */
export function createLambdaHandler<TBody = unknown, TResponse = unknown>(
  handlerFn: HandlerFunction<TBody, TResponse>,
  handlerName: string
) {
  return async (event: ApiGatewayProxyEvent): Promise<ApiGatewayProxyResult> => {
    console.log(`[${handlerName}] Event:`, JSON.stringify(event, null, 2));

    try {
      const parsedRequest = parseRequest<TBody>(event);

      console.log(`[${handlerName}] Parsed request:`, {
        pathParameters: parsedRequest.pathParameters,
        queryParameters: parsedRequest.queryParameters,
        httpMethod: parsedRequest.httpMethod,
        path: parsedRequest.path,
        hasBody: !!parsedRequest.body,
      });

      const result = await handlerFn(parsedRequest);
      return result as ApiGatewayProxyResult;
    } catch (error) {
      console.error(`[${handlerName}] Error:`, error);

      // If error is already an ApiGatewayProxyResult, return it
      if (error && typeof error === 'object' && 'statusCode' in error && 'body' in error) {
        return error as ApiGatewayProxyResult;
      }

      // Otherwise, return a generic error
      return errorResponse(
        ERROR_CODES.INTERNAL_ERROR,
        `Failed to process request in ${handlerName}`,
        HTTP_STATUS.INTERNAL_SERVER_ERROR
      );
    }
  };
}

/**
 * Create an error result that can be thrown and caught by the handler wrapper
 */
export function createErrorResult(
  code: string,
  message: string,
  statusCode: (typeof HTTP_STATUS)[keyof typeof HTTP_STATUS],
  details?: Record<string, unknown>
): ApiGatewayProxyResult {
  return errorResponse(code, message, statusCode, details);
}
