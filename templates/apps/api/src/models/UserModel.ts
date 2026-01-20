import { DynamoModel, BaseModel, generateUUID } from '../lib/dynamo';
import type { User as UserType } from '{{PACKAGE_SCOPE}}/common-types';

/**
 * User interface extending BaseModel for DynamoDB
 */
export interface UserModel extends BaseModel {
  email: string;
  name: string;
}

/**
 * User Model for DynamoDB operations
 * Extends DynamoModel to provide user-specific functionality
 */
export class UserDynamoModel extends DynamoModel<UserModel> {
  constructor(tableName?: string, region?: string) {
    super(
      tableName || process.env['DYNAMODB_TABLE'] || '{{PROJECT_NAME}}-table',
      region || process.env['AWS_REGION'] || 'us-east-1'
    );
  }

  /**
   * Get entity name for logging
   */
  protected getEntityName(): string {
    return 'User';
  }

  /**
   * Generate unique ID for new users
   */
  protected async generateId(data: UserModel): Promise<string> {
    return generateUUID();
  }

  /**
   * Set GSI keys for user queries
   * GSI1: Query users by email
   * GSI2: Query users by creation date
   */
  protected setGSIKeys(entity: UserModel, now: string): void {
    // GSI1: For email lookups
    entity.pk1 = 'USER';
    entity.sk1 = `EMAIL#${entity.email}`;

    // GSI2: For time-based queries
    entity.pk2 = 'USER';
    entity.sk2 = `CREATED#${now}`;
  }

  /**
   * Transform UserModel to User type for API responses
   */
  toUserType(userModel: UserModel): UserType {
    return {
      id: userModel.id,
      email: userModel.email,
      name: userModel.name,
      createdAt: userModel.createdAt,
      updatedAt: userModel.updatedAt,
    };
  }

  /**
   * Get user by email
   */
  async getByEmail(email: string): Promise<UserModel | null> {
    try {
      this.logger.info(`Getting user by email: ${email}`);

      const results = await this.queryByGSI(
        'GSI1',
        'pk1 = :pk AND sk1 = :sk',
        {
          ':pk': 'USER',
          ':sk': `EMAIL#${email}`,
        }
      );

      return results.length > 0 ? results[0] : null;
    } catch (error) {
      this.logger.error('Error getting user by email', { email, error });
      throw error;
    }
  }

  /**
   * Get users created after a specific date
   */
  async getByCreatedAfter(date: string): Promise<UserModel[]> {
    try {
      this.logger.info(`Getting users created after: ${date}`);

      return await this.queryByGSI(
        'GSI2',
        'pk2 = :pk AND sk2 > :sk',
        {
          ':pk': 'USER',
          ':sk': `CREATED#${date}`,
        }
      );
    } catch (error) {
      this.logger.error('Error getting users by created date', { date, error });
      throw error;
    }
  }
}
