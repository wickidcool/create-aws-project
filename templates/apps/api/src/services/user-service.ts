import type { User, CreateUserRequest, UpdateUserRequest } from '{{PACKAGE_SCOPE}}/common-types';
import { UserDynamoModel } from '../models/UserModel';

/**
 * User Service
 * Handles all business logic for user management with DynamoDB backend
 */
export class UserService {
  private userModel: UserDynamoModel;

  constructor() {
    this.userModel = new UserDynamoModel();
  }

  /**
   * Get all users
   */
  async getAllUsers(): Promise<User[]> {
    const users = await this.userModel.scanAll();
    return users.map(user => this.userModel.toUserType(user));
  }

  /**
   * Get user by ID
   */
  async getUserById(id: string): Promise<User | null> {
    const user = await this.userModel.getById(id);
    return user ? this.userModel.toUserType(user) : null;
  }

  /**
   * Get user by email
   */
  async getUserByEmail(email: string): Promise<User | null> {
    const user = await this.userModel.getByEmail(email);
    return user ? this.userModel.toUserType(user) : null;
  }

  /**
   * Create a new user
   */
  async createUser(request: CreateUserRequest): Promise<User> {
    // Check if user with email already exists
    const existingUser = await this.userModel.getByEmail(request.email);
    if (existingUser) {
      throw new Error(`User with email ${request.email} already exists`);
    }

    const user = await this.userModel.create({
      email: request.email,
      name: request.name,
    });

    return this.userModel.toUserType(user);
  }

  /**
   * Update an existing user
   */
  async updateUser(id: string, request: UpdateUserRequest): Promise<User | null> {
    const updatedUser = await this.userModel.update(id, {
      ...(request.name && { name: request.name }),
    });

    return updatedUser ? this.userModel.toUserType(updatedUser) : null;
  }

  /**
   * Delete a user
   */
  async deleteUser(id: string): Promise<boolean> {
    return await this.userModel.delete(id);
  }

  /**
   * Delete multiple users
   */
  async batchDeleteUsers(ids: string[]): Promise<{ success: string[]; failed: Array<{ id: string; error: string }> }> {
    return await this.userModel.batchDelete(ids);
  }

  /**
   * Check if user exists
   */
  async userExists(id: string): Promise<boolean> {
    const user = await this.userModel.getById(id);
    return user !== null;
  }

  /**
   * Get user count
   */
  async getUserCount(): Promise<number> {
    const users = await this.userModel.scanAll();
    return users.length;
  }

  /**
   * Get users created after a specific date
   */
  async getUsersCreatedAfter(date: string): Promise<User[]> {
    const users = await this.userModel.getByCreatedAfter(date);
    return users.map(user => this.userModel.toUserType(user));
  }
}

// Export singleton instance
export const userService = new UserService();
