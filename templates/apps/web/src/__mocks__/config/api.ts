import type { User, CreateUserRequest, UpdateUserRequest } from '{{PACKAGE_SCOPE}}/common-types';
import { Axios } from 'axios';

/**
 * Mock API Client for tests
 * Provides a simple mock implementation without external dependencies
 */
export const apiClient = {
  getUsers: (): Promise<User[]> => Promise.resolve([]),
  getUser: (_id: string): Promise<User> => Promise.resolve({
    id: '1',
    email: 'test@example.com',
    name: 'Test User',
    createdAt: new Date().toISOString(),
  }),
  createUser: (_data: CreateUserRequest): Promise<User> => Promise.resolve({
    id: '1',
    email: _data.email,
    name: _data.name,
    createdAt: new Date().toISOString(),
  }),
  updateUser: (_id: string, _data: UpdateUserRequest): Promise<User> => Promise.resolve({
    id: _id,
    email: 'test@example.com',
    name: _data.name || 'Test User',
    createdAt: new Date().toISOString(),
  }),
  deleteUser: (_id: string): Promise<void> => Promise.resolve(),
  setAuthToken: (_token: string) => { console.log('setAuthToken', _token); },
  clearAuthToken: () => { console.log('clearAuthToken'); },
  setBaseURL: (_url: string) => { console.log('setBaseURL', _url); },
  getAxiosInstance: () => ({}) as Axios,
};

export function setAuthToken(_token: string): void {
  // Mock implementation
}

export function clearAuthToken(): void {
  // Mock implementation
}
