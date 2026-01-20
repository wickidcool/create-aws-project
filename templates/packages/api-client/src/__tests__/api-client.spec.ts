import axios from 'axios';
import { ApiClient, ApiError, createApiClient } from '../api-client';
import type { User, CreateUserRequest, UpdateUserRequest } from '{{PACKAGE_SCOPE}}/common-types';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('ApiClient', () => {
  let apiClient: ApiClient;
  const mockAxiosInstance = {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
    defaults: {
      headers: {
        common: {} as Record<string, string>,
      },
      baseURL: '',
    },
    interceptors: {
      response: {
        use: jest.fn(),
      },
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockedAxios.create.mockReturnValue(mockAxiosInstance as any);

    apiClient = new ApiClient({
      baseURL: 'https://api.example.com',
      timeout: 5000,
    });
  });

  describe('constructor', () => {
    it('should create axios instance with correct config', () => {
      expect(mockedAxios.create).toHaveBeenCalledWith({
        baseURL: 'https://api.example.com',
        timeout: 5000,
        headers: {
          'Content-Type': 'application/json',
        },
        withCredentials: false,
      });
    });

    it('should create axios instance with custom headers', () => {
      new ApiClient({
        baseURL: 'https://api.example.com',
        headers: {
          'X-Custom-Header': 'value',
        },
      });

      expect(mockedAxios.create).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: {
            'Content-Type': 'application/json',
            'X-Custom-Header': 'value',
          },
        })
      );
    });
  });

  describe('createApiClient', () => {
    it('should create and return ApiClient instance', () => {
      const client = createApiClient({ baseURL: 'https://api.example.com' });
      expect(client).toBeInstanceOf(ApiClient);
    });
  });

  describe('setAuthToken', () => {
    it('should set authorization header', () => {
      apiClient.setAuthToken('test-token');
      expect(mockAxiosInstance.defaults.headers.common['Authorization']).toBe('Bearer test-token');
    });
  });

  describe('clearAuthToken', () => {
    it('should remove authorization header', () => {
      mockAxiosInstance.defaults.headers.common['Authorization'] = 'Bearer test-token';
      apiClient.clearAuthToken();
      expect(mockAxiosInstance.defaults.headers.common['Authorization']).toBeUndefined();
    });
  });

  describe('setBaseURL', () => {
    it('should update base URL', () => {
      apiClient.setBaseURL('https://new-api.example.com');
      expect(mockAxiosInstance.defaults.baseURL).toBe('https://new-api.example.com');
    });
  });

  describe('getUsers', () => {
    it('should fetch all users', async () => {
      const mockUsers: User[] = [
        { id: '1', email: 'user1@example.com', name: 'User 1', createdAt: '2024-01-01' },
        { id: '2', email: 'user2@example.com', name: 'User 2', createdAt: '2024-01-02' },
      ];

      mockAxiosInstance.get.mockResolvedValue({
        data: {
          success: true,
          data: mockUsers,
        },
      });

      const users = await apiClient.getUsers();

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/users', undefined);
      expect(users).toEqual(mockUsers);
    });

    it('should throw error for invalid response format', async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: {
          success: false,
        },
      });

      await expect(apiClient.getUsers()).rejects.toThrow('Invalid response format');
    });
  });

  describe('getUser', () => {
    it('should fetch user by ID', async () => {
      const mockUser: User = {
        id: '1',
        email: 'user@example.com',
        name: 'Test User',
        createdAt: '2024-01-01',
      };

      mockAxiosInstance.get.mockResolvedValue({
        data: {
          success: true,
          data: mockUser,
        },
      });

      const user = await apiClient.getUser('1');

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/users/1', undefined);
      expect(user).toEqual(mockUser);
    });

    it('should throw error for invalid response format', async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: {
          success: false,
        },
      });

      await expect(apiClient.getUser('1')).rejects.toThrow('Invalid response format');
    });
  });

  describe('createUser', () => {
    it('should create a new user', async () => {
      const newUser: CreateUserRequest = {
        email: 'new@example.com',
        name: 'New User',
      };

      const createdUser: User = {
        id: '3',
        ...newUser,
        createdAt: '2024-01-03',
      };

      mockAxiosInstance.post.mockResolvedValue({
        data: {
          success: true,
          data: createdUser,
        },
      });

      const user = await apiClient.createUser(newUser);

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/api/users', newUser, undefined);
      expect(user).toEqual(createdUser);
    });

    it('should throw error for invalid response format', async () => {
      mockAxiosInstance.post.mockResolvedValue({
        data: {
          success: false,
        },
      });

      await expect(
        apiClient.createUser({ email: 'test@example.com', name: 'Test' })
      ).rejects.toThrow('Invalid response format');
    });
  });

  describe('updateUser', () => {
    it('should update an existing user', async () => {
      const updates: UpdateUserRequest = {
        name: 'Updated Name',
      };

      const updatedUser: User = {
        id: '1',
        email: 'user@example.com',
        name: 'Updated Name',
        createdAt: '2024-01-01',
      };

      mockAxiosInstance.put.mockResolvedValue({
        data: {
          success: true,
          data: updatedUser,
        },
      });

      const user = await apiClient.updateUser('1', updates);

      expect(mockAxiosInstance.put).toHaveBeenCalledWith('/api/users/1', updates, undefined);
      expect(user).toEqual(updatedUser);
    });

    it('should throw error for invalid response format', async () => {
      mockAxiosInstance.put.mockResolvedValue({
        data: {
          success: false,
        },
      });

      await expect(apiClient.updateUser('1', { name: 'Test' })).rejects.toThrow(
        'Invalid response format'
      );
    });
  });

  describe('deleteUser', () => {
    it('should delete a user', async () => {
      mockAxiosInstance.delete.mockResolvedValue({
        data: {
          success: true,
        },
      });

      await apiClient.deleteUser('1');

      expect(mockAxiosInstance.delete).toHaveBeenCalledWith('/api/users/1', undefined);
    });
  });

  describe('getAxiosInstance', () => {
    it('should return the axios instance', () => {
      const instance = apiClient.getAxiosInstance();
      expect(instance).toBe(mockAxiosInstance);
    });
  });
});

describe('Response Interceptor Error Handling', () => {
  let apiClient: ApiClient;
  let successHandler: (response: any) => any;
  let errorHandler: (error: any) => never;

  beforeEach(() => {
    jest.clearAllMocks();

    // Capture the handlers when interceptors.response.use is called
    const mockAxiosInstance = {
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
      delete: jest.fn(),
      defaults: {
        headers: {
          common: {} as Record<string, string>,
        },
        baseURL: '',
      },
      interceptors: {
        response: {
          use: jest.fn((sucHandler, errHandler) => {
            successHandler = sucHandler;
            errorHandler = errHandler;
          }),
        },
      },
    };

    (axios as jest.Mocked<typeof axios>).create.mockReturnValue(mockAxiosInstance as any);
    apiClient = new ApiClient({ baseURL: 'https://api.example.com' });
  });

  it('should pass through successful responses', () => {
    const mockResponse = { data: { success: true }, status: 200 };
    const result = successHandler(mockResponse);
    expect(result).toBe(mockResponse);
  });

  it('should handle server error with API error format', () => {
    const axiosError = {
      response: {
        status: 400,
        data: {
          error: {
            message: 'Validation failed',
            code: 'VALIDATION_ERROR',
            details: { field: 'email' },
          },
        },
      },
      message: 'Request failed',
    };

    expect(() => errorHandler(axiosError)).toThrow(ApiError);
    try {
      errorHandler(axiosError);
    } catch (e) {
      const error = e as ApiError;
      expect(error.message).toBe('Validation failed');
      expect(error.statusCode).toBe(400);
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.details).toEqual({ field: 'email' });
    }
  });

  it('should handle server error without API error format', () => {
    const axiosError = {
      response: {
        status: 500,
        data: { message: 'Internal server error' },
      },
      message: 'Server error',
    };

    expect(() => errorHandler(axiosError)).toThrow(ApiError);
    try {
      errorHandler(axiosError);
    } catch (e) {
      const error = e as ApiError;
      expect(error.message).toBe('Server error');
      expect(error.statusCode).toBe(500);
      expect(error.code).toBe('API_ERROR');
    }
  });

  it('should handle network error (no response)', () => {
    const axiosError = {
      request: {},
      message: 'Network Error',
    };

    expect(() => errorHandler(axiosError)).toThrow(ApiError);
    try {
      errorHandler(axiosError);
    } catch (e) {
      const error = e as ApiError;
      expect(error.message).toBe('No response from server');
      expect(error.statusCode).toBeUndefined();
      expect(error.code).toBe('NETWORK_ERROR');
    }
  });

  it('should handle request setup error', () => {
    const axiosError = {
      message: 'Invalid URL',
    };

    expect(() => errorHandler(axiosError)).toThrow(ApiError);
    try {
      errorHandler(axiosError);
    } catch (e) {
      const error = e as ApiError;
      expect(error.message).toBe('Invalid URL');
      expect(error.statusCode).toBeUndefined();
      expect(error.code).toBe('REQUEST_ERROR');
    }
  });
});

describe('ApiError', () => {
  it('should create error with all properties', () => {
    const error = new ApiError(
      'Test error',
      400,
      'TEST_ERROR',
      { field: 'email' }
    );

    expect(error.message).toBe('Test error');
    expect(error.statusCode).toBe(400);
    expect(error.code).toBe('TEST_ERROR');
    expect(error.details).toEqual({ field: 'email' });
    expect(error.name).toBe('ApiError');
  });

  it('should create error with minimal properties', () => {
    const error = new ApiError('Simple error');

    expect(error.message).toBe('Simple error');
    expect(error.statusCode).toBeUndefined();
    expect(error.code).toBeUndefined();
    expect(error.details).toBeUndefined();
  });
});
