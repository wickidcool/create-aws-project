import axios, { type AxiosInstance, type AxiosRequestConfig, AxiosError } from 'axios';
import type {
  User,
  CreateUserRequest,
  UpdateUserRequest,
  ApiResponse,
  ApiError as ApiErrorType,
} from '{{PACKAGE_SCOPE}}/common-types';

/**
 * Configuration options for the API client
 */
export interface ApiClientConfig {
  /**
   * Base URL for the API (e.g., 'https://api.example.com' or 'http://localhost:3000')
   */
  baseURL: string;

  /**
   * Request timeout in milliseconds (default: 30000)
   */
  timeout?: number;

  /**
   * Additional headers to include in all requests
   */
  headers?: Record<string, string>;

  /**
   * Whether to send cookies with requests (default: false)
   */
  withCredentials?: boolean;
}

/**
 * Custom error class for API errors
 */
export class ApiError extends Error {
  public readonly statusCode?: number;
  public readonly code?: string;
  public readonly details?: unknown;

  constructor(message: string, statusCode?: number, code?: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;

    // Restore prototype chain for instanceof checks
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

/**
 * API Client for the monorepo
 *
 * Provides type-safe methods for interacting with the backend API.
 */
export class ApiClient {
  private client: AxiosInstance;

  constructor(config: ApiClientConfig) {
    this.client = axios.create({
      baseURL: config.baseURL,
      timeout: config.timeout || 30000,
      headers: {
        'Content-Type': 'application/json',
        ...config.headers,
      },
      withCredentials: config.withCredentials || false,
    });

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        if (error.response) {
          // Server responded with error status
          const data = error.response.data as ApiResponse<unknown> | ApiErrorType | undefined;

          if (data && typeof data === 'object' && 'error' in data) {
            const apiError = data.error as ApiErrorType;
            throw new ApiError(
              apiError.message,
              error.response.status,
              apiError.code,
              apiError.details
            );
          }

          throw new ApiError(
            error.message,
            error.response.status,
            'API_ERROR',
            error.response.data
          );
        } else if (error.request) {
          // Request made but no response received
          throw new ApiError('No response from server', undefined, 'NETWORK_ERROR');
        } else {
          // Something else happened
          throw new ApiError(error.message, undefined, 'REQUEST_ERROR');
        }
      }
    );
  }

  /**
   * Set authentication token
   */
  public setAuthToken(token: string): void {
    this.client.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  }

  /**
   * Clear authentication token
   */
  public clearAuthToken(): void {
    delete this.client.defaults.headers.common['Authorization'];
  }

  /**
   * Update the base URL
   */
  public setBaseURL(baseURL: string): void {
    this.client.defaults.baseURL = baseURL;
  }

  /**
   * Get all users
   */
  public async getUsers(config?: AxiosRequestConfig): Promise<User[]> {
    const response = await this.client.get<ApiResponse<User[]>>('/api/users', config);
    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    throw new ApiError('Invalid response format');
  }

  /**
   * Get user by ID
   */
  public async getUser(id: string, config?: AxiosRequestConfig): Promise<User> {
    const response = await this.client.get<ApiResponse<User>>(`/api/users/${id}`, config);
    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    throw new ApiError('Invalid response format');
  }

  /**
   * Create a new user
   */
  public async createUser(
    data: CreateUserRequest,
    config?: AxiosRequestConfig
  ): Promise<User> {
    const response = await this.client.post<ApiResponse<User>>('/api/users', data, config);
    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    throw new ApiError('Invalid response format');
  }

  /**
   * Update an existing user
   */
  public async updateUser(
    id: string,
    data: UpdateUserRequest,
    config?: AxiosRequestConfig
  ): Promise<User> {
    const response = await this.client.put<ApiResponse<User>>(`/api/users/${id}`, data, config);
    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    throw new ApiError('Invalid response format');
  }

  /**
   * Delete a user
   */
  public async deleteUser(id: string, config?: AxiosRequestConfig): Promise<void> {
    await this.client.delete(`/api/users/${id}`, config);
  }

  /**
   * Get the underlying axios instance for advanced usage
   */
  public getAxiosInstance(): AxiosInstance {
    return this.client;
  }
}

/**
 * Factory function to create an API client
 */
export function createApiClient(config: ApiClientConfig): ApiClient {
  return new ApiClient(config);
}
