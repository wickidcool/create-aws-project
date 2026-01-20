import type {
  ApiGatewayProxyResult,
  ApiResponse,
  HTTP_STATUS,
} from '{{PACKAGE_SCOPE}}/common-types';

const defaultHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': process.env['ALLOWED_ORIGINS'] || '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export function successResponse<T>(
  data: T,
  statusCode: (typeof HTTP_STATUS)[keyof typeof HTTP_STATUS] = 200,
  message?: string
): ApiGatewayProxyResult {
  const response: ApiResponse<T> = {
    success: true,
    data,
    message,
  };

  return {
    statusCode,
    headers: defaultHeaders,
    body: JSON.stringify(response),
  };
}

export function errorResponse(
  code: string,
  message: string,
  statusCode: (typeof HTTP_STATUS)[keyof typeof HTTP_STATUS] = 500,
  details?: Record<string, unknown>
): ApiGatewayProxyResult {
  const response: ApiResponse = {
    success: false,
    error: {
      code,
      message,
      details,
    },
  };

  return {
    statusCode,
    headers: defaultHeaders,
    body: JSON.stringify(response),
  };
}
