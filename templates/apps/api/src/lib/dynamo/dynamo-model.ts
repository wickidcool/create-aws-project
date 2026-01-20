import {
  DynamoDBClient,
  GetItemCommand,
  PutItemCommand,
  UpdateItemCommand,
  DeleteItemCommand,
  ScanCommand,
  QueryCommand,
  BatchWriteItemCommand,
} from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import { Logger } from '@aws-lambda-powertools/logger';
import { removeGSIFields } from './utils';

/**
 * Base model interface for DynamoDB entities
 * All entities should extend this interface
 */
export interface BaseModel {
  id: string;
  createdAt: string;
  updatedAt?: string;
  // GSI keys for flexible querying - common pattern across all models
  pk1?: string;
  sk1?: string;
  pk2?: string;
  sk2?: string;
  pk3?: string;
  sk3?: string;
  pk4?: string;
  sk4?: string;
  pk5?: string;
  sk5?: string;
  pk6?: string;
  sk6?: string;
}

/**
 * Configuration options for DynamoModel
 */
export interface DynamoModelConfig {
  tableName: string;
  region?: string;
  logger?: Logger;
}

/**
 * Abstract base class for DynamoDB models
 * Provides common CRUD operations with GSI support
 *
 * @example
 * ```typescript
 * interface UserModel extends BaseModel {
 *   email: string;
 *   name: string;
 * }
 *
 * class UserDynamoModel extends DynamoModel<UserModel> {
 *   protected getEntityName(): string {
 *     return 'User';
 *   }
 *
 *   protected async generateId(): Promise<string> {
 *     return crypto.randomUUID();
 *   }
 *
 *   protected setGSIKeys(entity: UserModel, now: string): void {
 *     entity.pk1 = 'USER';
 *     entity.sk1 = `EMAIL#${entity.email}`;
 *   }
 * }
 * ```
 */
export abstract class DynamoModel<T extends BaseModel> {
  protected dynamoClient: DynamoDBClient;
  protected tableName: string;
  protected logger: Logger;

  constructor(tableName: string, region?: string, logger?: Logger);
  constructor(config: DynamoModelConfig);
  constructor(
    tableNameOrConfig: string | DynamoModelConfig,
    region?: string,
    logger?: Logger
  ) {
    if (typeof tableNameOrConfig === 'string') {
      this.tableName = tableNameOrConfig;
      this.logger =
        logger ||
        new Logger({
          serviceName: process.env['SERVICE_NAME'] || 'dynamo-client',
          logLevel: (process.env['LOG_LEVEL'] as 'DEBUG' | 'INFO' | 'WARN' | 'ERROR') || 'INFO',
          environment: process.env['NODE_ENV'] || 'development',
        });
      this.dynamoClient = new DynamoDBClient({
        region: region || process.env['AWS_REGION'],
      });
    } else {
      const config = tableNameOrConfig;
      this.tableName = config.tableName;
      this.logger =
        config.logger ||
        new Logger({
          serviceName: process.env['SERVICE_NAME'] || 'dynamo-client',
          logLevel: (process.env['LOG_LEVEL'] as 'DEBUG' | 'INFO' | 'WARN' | 'ERROR') || 'INFO',
          environment: process.env['NODE_ENV'] || 'development',
        });
      this.dynamoClient = new DynamoDBClient({
        region: config.region || process.env['AWS_REGION'],
      });
    }
  }

  /**
   * Get entity name for logging (e.g., "Project", "User", "ContractorGroup")
   */
  protected abstract getEntityName(): string;

  /**
   * Generate the primary key for the entity
   */
  protected abstract generateId(data: T): string | Promise<string>;

  /**
   * Set GSI keys for the entity based on business requirements
   */
  protected abstract setGSIKeys(entity: T, now: string): void;

  /**
   * Transform the data before saving (e.g., remove temporary fields)
   */
  protected transformForSave(entity: T): T | Promise<T> {
    // Default implementation - subclasses can override
    return entity;
  }

  protected getIdWithPrefix(id: string): string {
    const entityName = this.getEntityName().toUpperCase();
    if (id?.startsWith(entityName)) {
      return id;
    }

    return `${entityName}#${id}`;
  }

  protected idHasPrefix(id: string): boolean {
    const entityName = `${this.getEntityName().toUpperCase()}#`;
    return id.startsWith(entityName);
  }

  protected cleanEntityId(id: string): string {
    const entityName = this.getEntityName().toUpperCase();
    if (id.startsWith(entityName)) {
      return id.replace(`${entityName}#`, '');
    }

    return id;
  }

  protected cleanEntity(entity: T): T {
    const result = {
      ...removeGSIFields(entity as unknown as Record<string, unknown>),
      id: this.cleanEntityId(entity.id),
    } as T;

    return result;
  }

  /**
   * Get an entity by its ID
   */
  async getById(id: string): Promise<T | null> {
    try {
      this.logger.info(`Getting ${this.getEntityName()} by ID: ${id}`);

      const command = new GetItemCommand({
        TableName: this.tableName,
        Key: marshall({ id: this.getIdWithPrefix(id) }, { removeUndefinedValues: true }),
      });

      const response = await this.dynamoClient.send(command);
      if (!response.Item) {
        this.logger.info(`${this.getEntityName()} not found: ${id}`);
        return null;
      }

      const entity = unmarshall(response.Item) as T;
      this.logger.info(`${this.getEntityName()} retrieved successfully: ${id}`);
      return this.cleanEntity(entity);
    } catch (error) {
      this.logger.error(`Error retrieving ${this.getEntityName().toLowerCase()} ${id}:`, { error });
      throw new Error(`Failed to retrieve ${this.getEntityName().toLowerCase()}: ${error}`);
    }
  }

  /**
   * Create a new entity
   */
  async create(entityData: Omit<T, keyof BaseModel>): Promise<T> {
    try {
      const now = new Date().toISOString();
      const entity: T = {
        ...entityData,
        createdAt: now,
        updatedAt: now,
      } as T;

      // Set the ID
      if (entity.id === undefined) {
        entity.id = this.getIdWithPrefix(await this.generateId(entity));
      } else {
        entity.id = this.getIdWithPrefix(entity.id);
      }

      // Set GSI keys
      this.setGSIKeys(entity, now);

      // Transform before saving
      const transformedEntity = await this.transformForSave(entity);

      this.logger.info(`Creating ${this.getEntityName()}`, { entity });

      const command = new PutItemCommand({
        TableName: this.tableName,
        Item: marshall(transformedEntity, { removeUndefinedValues: true }),
      });

      await this.dynamoClient.send(command);
      this.logger.info(`${this.getEntityName()} created successfully: ${entity.id}`);

      return {
        ...this.cleanEntity(transformedEntity),
        id: this.cleanEntityId(transformedEntity.id),
      };
    } catch (error) {
      this.logger.error(`Error creating ${this.getEntityName().toLowerCase()}:`, { error });
      throw new Error(`Failed to create ${this.getEntityName().toLowerCase()}: ${error}`);
    }
  }

  /**
   * Update an entity
   */
  async update(id: string, updates: Partial<Omit<T, 'id' | 'createdAt'>>): Promise<T | null> {
    try {
      this.logger.info(`Updating ${this.getEntityName()} by ID: ${id}`, { updates });

      const updateExpression: string[] = [];
      const expressionAttributeNames: Record<string, string> = {};
      const expressionAttributeValues: Record<string, unknown> = {};

      // Add updatedAt automatically
      updates.updatedAt = new Date().toISOString();

      // Build update expression
      Object.entries(updates).forEach(([key, value]) => {
        if (value !== undefined) {
          const attrName = `#${key}`;
          const attrValue = `:${key}`;

          updateExpression.push(`${attrName} = ${attrValue}`);
          expressionAttributeNames[attrName] = key;
          expressionAttributeValues[attrValue] = value;
        }
      });

      if (updateExpression.length === 0) {
        throw new Error('No valid updates provided');
      }

      const command = new UpdateItemCommand({
        TableName: this.tableName,
        Key: marshall({ id: this.getIdWithPrefix(id) }, { removeUndefinedValues: true }),
        UpdateExpression: `SET ${updateExpression.join(', ')}`,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: marshall(expressionAttributeValues, {
          removeUndefinedValues: true,
        }),
        ReturnValues: 'ALL_NEW',
      });

      const response = await this.dynamoClient.send(command);

      if (!response.Attributes) {
        this.logger.info(`${this.getEntityName()} not found for update: ${id}`);
        return null;
      }

      const updatedEntity = unmarshall(response.Attributes) as T;
      this.logger.info(`${this.getEntityName()} updated successfully: ${id}`);
      return updatedEntity;
    } catch (error) {
      this.logger.error(`Error updating ${this.getEntityName().toLowerCase()} ${id}:`, { error });
      throw new Error(`Failed to update ${this.getEntityName().toLowerCase()}: ${error}`);
    }
  }

  /**
   * Delete an entity
   */
  async delete(id: string): Promise<boolean> {
    try {
      this.logger.info(`Deleting ${this.getEntityName()} by ID: ${id}`);

      const command = new DeleteItemCommand({
        TableName: this.tableName,
        Key: marshall({ id: this.getIdWithPrefix(id) }, { removeUndefinedValues: true }),
      });

      await this.dynamoClient.send(command);
      this.logger.info(`${this.getEntityName()} deleted successfully: ${id}`);
      return true;
    } catch (error) {
      this.logger.error(`Error deleting ${this.getEntityName().toLowerCase()} ${id}:`, { error });
      throw new Error(`Failed to delete ${this.getEntityName().toLowerCase()}: ${error}`);
    }
  }

  /**
   * Delete multiple entities in batch using DynamoDB BatchWriteItem
   * Processes up to 25 items per batch (DynamoDB limit)
   * @param ids Array of entity IDs to delete
   * @returns Object with success and failed arrays
   */
  async batchDelete(
    ids: string[]
  ): Promise<{ success: string[]; failed: Array<{ id: string; error: string }> }> {
    try {
      this.logger.info(`Batch deleting ${ids.length} ${this.getEntityName()}(s)`);
      const results = {
        success: [] as string[],
        failed: [] as Array<{ id: string; error: string }>,
      };

      if (ids.length === 0) {
        return results;
      }

      // DynamoDB BatchWriteItem can handle up to 25 items at a time
      const BATCH_SIZE = 25;
      const chunks = [];
      for (let i = 0; i < ids.length; i += BATCH_SIZE) {
        chunks.push(ids.slice(i, i + BATCH_SIZE));
      }

      // Process each chunk
      for (const chunk of chunks) {
        const deleteRequests = chunk.map((id) => ({
          DeleteRequest: {
            Key: marshall({ id: this.getIdWithPrefix(id) }, { removeUndefinedValues: true }),
          },
        }));

        try {
          const command = new BatchWriteItemCommand({
            RequestItems: {
              [this.tableName]: deleteRequests,
            },
          });

          const response = await this.dynamoClient.send(command);

          // Track successful deletions (all items in chunk minus any unprocessed items)
          const unprocessedCount = response.UnprocessedItems?.[this.tableName]?.length || 0;
          const successCount = chunk.length - unprocessedCount;

          // Add successfully deleted IDs to results
          chunk.slice(0, successCount).forEach((id) => {
            results.success.push(id);
            this.logger.info(`${this.getEntityName()} deleted successfully: ${id}`);
          });

          // Handle unprocessed items
          if (response.UnprocessedItems && response.UnprocessedItems[this.tableName]) {
            response.UnprocessedItems[this.tableName].forEach((_item, index: number) => {
              const entityId = chunk[successCount + index];
              results.failed.push({
                id: entityId,
                error: 'Item was not processed due to throughput limits or other issues',
              });
              this.logger.warn(`${this.getEntityName()} deletion unprocessed: ${entityId}`);
            });
          }
        } catch (batchError: unknown) {
          // If batch fails, mark all items in chunk as failed
          const errorMessage =
            batchError instanceof Error ? batchError.message : 'Batch write operation failed';
          chunk.forEach((id) => {
            results.failed.push({
              id,
              error: errorMessage,
            });
            this.logger.error(`${this.getEntityName()} deletion failed: ${id}`, {
              error: batchError,
            });
          });
        }
      }

      this.logger.info(`Batch delete completed for ${this.getEntityName()}`, {
        total: ids.length,
        success: results.success.length,
        failed: results.failed.length,
      });

      return results;
    } catch (error: unknown) {
      this.logger.error(`Error in batch delete for ${this.getEntityName()}:`, { error });
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to batch delete ${this.getEntityName()}s: ${errorMessage}`);
    }
  }

  /**
   * Scan all entities with optional filter
   */
  async scanAll(
    filterExpression?: string,
    expressionAttributeValues?: Record<string, unknown>
  ): Promise<T[]> {
    try {
      const command = new ScanCommand({
        TableName: this.tableName,
        ...(filterExpression && { FilterExpression: filterExpression }),
        ...(expressionAttributeValues && {
          ExpressionAttributeValues: marshall(expressionAttributeValues, {
            removeUndefinedValues: true,
          }),
        }),
      });

      const response = await this.dynamoClient.send(command);
      if (!response.Items) return [];

      const entities = response.Items.map((item) => {
        return unmarshall(item) as T;
      });

      return entities
        .filter((entity) => this.idHasPrefix(entity.id))
        .map((entity) => this.cleanEntity(entity));
    } catch (error) {
      this.logger.error(`Error scanning ${this.getEntityName().toLowerCase()}s:`, { error });
      throw new Error(`Failed to scan ${this.getEntityName().toLowerCase()}s: ${error}`);
    }
  }

  /**
   * Query items using GSI
   */
  async queryByGSI(
    indexName: string,
    keyConditionExpression: string,
    expressionAttributeValues: Record<string, unknown>,
    filterExpression?: string,
    expressionAttributeNames?: Record<string, string>
  ): Promise<T[]> {
    try {
      const command = new QueryCommand({
        TableName: this.tableName,
        IndexName: indexName,
        KeyConditionExpression: keyConditionExpression,
        ExpressionAttributeValues: marshall(expressionAttributeValues, {
          removeUndefinedValues: true,
        }),
        ...(filterExpression && { FilterExpression: filterExpression }),
        ...(expressionAttributeNames && { ExpressionAttributeNames: expressionAttributeNames }),
      });

      const response = await this.dynamoClient.send(command);
      if (!response.Items) return [];

      const entities = response.Items.map((item) => {
        return unmarshall(item) as T;
      });

      this.logger.info(
        `Retrieved ${entities.length} for ${this.getEntityName()}s by GSI: ${indexName}`,
        { entities }
      );
      return entities
        .filter((entity) => this.idHasPrefix(entity.id))
        .map((entity) => this.cleanEntity(entity));
    } catch (error: unknown) {
      this.logger.error(`Error querying ${this.getEntityName()}s by GSI:`, { error });
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to query ${this.getEntityName()}s by GSI: ${errorMessage}`);
    }
  }

  /**
   * Get the DynamoDB client for advanced operations
   */
  protected getClient(): DynamoDBClient {
    return this.dynamoClient;
  }

  /**
   * Get the table name for advanced operations
   */
  protected getTableName(): string {
    return this.tableName;
  }
}
