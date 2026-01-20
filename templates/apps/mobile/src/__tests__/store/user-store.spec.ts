import { useUserStore } from '../../store/user-store';
import type { User } from '{{PACKAGE_SCOPE}}/common-types';

describe('useUserStore', () => {
  const mockUser: User = {
    id: '1',
    email: 'test@example.com',
    name: 'Test User',
    createdAt: '2024-01-01T00:00:00.000Z',
  };

  beforeEach(() => {
    // Reset store before each test
    useUserStore.setState({
      user: null,
      users: [],
      isLoading: false,
      error: null,
    });
  });

  describe('initial state', () => {
    it('should have null user', () => {
      expect(useUserStore.getState().user).toBeNull();
    });

    it('should have empty users array', () => {
      expect(useUserStore.getState().users).toEqual([]);
    });

    it('should not be loading', () => {
      expect(useUserStore.getState().isLoading).toBe(false);
    });

    it('should have no error', () => {
      expect(useUserStore.getState().error).toBeNull();
    });
  });

  describe('setUser', () => {
    it('should set the current user', () => {
      useUserStore.getState().setUser(mockUser);
      expect(useUserStore.getState().user).toEqual(mockUser);
    });

    it('should clear the current user when set to null', () => {
      useUserStore.getState().setUser(mockUser);
      useUserStore.getState().setUser(null);
      expect(useUserStore.getState().user).toBeNull();
    });
  });

  describe('setUsers', () => {
    it('should set the users array', () => {
      const users = [mockUser, { ...mockUser, id: '2', email: 'test2@example.com' }];
      useUserStore.getState().setUsers(users);
      expect(useUserStore.getState().users).toEqual(users);
    });
  });

  describe('addUser', () => {
    it('should add a user to the array', () => {
      useUserStore.getState().addUser(mockUser);
      expect(useUserStore.getState().users).toContainEqual(mockUser);
    });

    it('should append to existing users', () => {
      const existingUser = { ...mockUser, id: '0' };
      useUserStore.setState({ users: [existingUser] });

      useUserStore.getState().addUser(mockUser);

      expect(useUserStore.getState().users).toHaveLength(2);
      expect(useUserStore.getState().users[0]).toEqual(existingUser);
      expect(useUserStore.getState().users[1]).toEqual(mockUser);
    });
  });

  describe('updateUser', () => {
    it('should update a user in the array', () => {
      useUserStore.setState({ users: [mockUser] });

      useUserStore.getState().updateUser('1', { name: 'Updated Name' });

      expect(useUserStore.getState().users[0].name).toBe('Updated Name');
    });

    it('should update the current user if it matches', () => {
      useUserStore.setState({ user: mockUser, users: [mockUser] });

      useUserStore.getState().updateUser('1', { name: 'Updated Name' });

      expect(useUserStore.getState().user?.name).toBe('Updated Name');
    });

    it('should not update current user if id does not match', () => {
      useUserStore.setState({ user: mockUser, users: [mockUser] });

      useUserStore.getState().updateUser('different-id', { name: 'Updated Name' });

      expect(useUserStore.getState().user?.name).toBe('Test User');
    });
  });

  describe('removeUser', () => {
    it('should remove a user from the array', () => {
      useUserStore.setState({ users: [mockUser] });

      useUserStore.getState().removeUser('1');

      expect(useUserStore.getState().users).toHaveLength(0);
    });

    it('should clear current user if it matches removed user', () => {
      useUserStore.setState({ user: mockUser, users: [mockUser] });

      useUserStore.getState().removeUser('1');

      expect(useUserStore.getState().user).toBeNull();
    });

    it('should not clear current user if id does not match', () => {
      useUserStore.setState({ user: mockUser, users: [mockUser] });

      useUserStore.getState().removeUser('different-id');

      expect(useUserStore.getState().user).toEqual(mockUser);
    });
  });

  describe('loading state', () => {
    it('should set loading to true', () => {
      useUserStore.getState().setLoading(true);
      expect(useUserStore.getState().isLoading).toBe(true);
    });

    it('should set loading to false', () => {
      useUserStore.setState({ isLoading: true });
      useUserStore.getState().setLoading(false);
      expect(useUserStore.getState().isLoading).toBe(false);
    });
  });

  describe('error handling', () => {
    it('should set error message', () => {
      useUserStore.getState().setError('Something went wrong');
      expect(useUserStore.getState().error).toBe('Something went wrong');
    });

    it('should clear error', () => {
      useUserStore.setState({ error: 'Some error' });
      useUserStore.getState().clearError();
      expect(useUserStore.getState().error).toBeNull();
    });
  });
});
