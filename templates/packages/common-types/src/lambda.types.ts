/**
 * AWS Lambda Types
 *
 * Types for AWS Lambda events, contexts, and responses
 */

/**
 * AWS Lambda execution context
 */
export interface LambdaContext {
    requestId: string;
    functionName: string;
    functionVersion: string;
    memoryLimitInMB: string;
    logGroupName: string;
    logStreamName: string;
}

/**
 * API Gateway proxy event structure
 */
export interface ApiGatewayProxyEvent {
    httpMethod: string;
    path: string;
    pathParameters: Record<string, string> | null;
    queryStringParameters: Record<string, string> | null;
    headers: Record<string, string>;
    body: string | null;
    isBase64Encoded: boolean;
}

/**
 * API Gateway proxy response structure
 */
export interface ApiGatewayProxyResult {
    statusCode: number;
    headers?: Record<string, string>;
    body: string;
}
