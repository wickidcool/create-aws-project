/**
 * DynamoDB model base classes
 * Provides abstract base class for DynamoDB CRUD operations with GSI support
 */

export { DynamoModel, BaseModel, DynamoModelConfig } from './dynamo-model';
export {
  removeGSIFields,
  generateUUID,
  getCurrentTimestamp,
  GSIFieldNames,
} from './utils';
