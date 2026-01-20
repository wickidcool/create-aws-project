/**
 * User Domain Types
 *
 * Contains all user-related types and interfaces
 */

/**
 * User entity
 */
export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: string;
  updatedAt?: string;
}

/**
 * Request body for creating a new user
 */
export interface CreateUserRequest {
  email: string;
  name: string;
}

/**
 * Request body for updating an existing user
 */
export interface UpdateUserRequest {
  name?: string;
}
