/**
 * Jest test setup file
 * Runs before all tests
 */

// Set test environment variables
process.env['NODE_ENV'] = 'test';
process.env['AWS_REGION'] = 'us-east-1';
process.env['DYNAMODB_TABLE'] = 'test-table';
process.env['LOG_LEVEL'] = 'ERROR'; // Reduce log noise in tests
