import { useUserStore } from '../../store/user-store';
import type { User } from '{{PACKAGE_SCOPE}}/common-types';

describe('UserStore', () => {
  beforeEach(() => {
    // Reset store before each test
    useUserStore.setState({
      user: null,
      users: [],
      isLoading: false,
      error: null,
    });
  });

  it('should initialize with empty state', () => {
    const state = useUserStore.getState();
    expect(state.user).toBeNull();
    expect(state.users).toEqual([]);
    expect(state.isLoading).toBe(false);
    expect(state.error).toBeNull();
  });

  it('should set user', () => {
    const user: User = {
      id: '1',
      email: 'test@example.com',
      name: 'Test User',
      createdAt: new Date().toISOString(),
    };

    useUserStore.getState().setUser(user);
    expect(useUserStore.getState().user).toEqual(user);
  });

  it('should add user to users array', () => {
    const user: User = {
      id: '1',
      email: 'test@example.com',
      name: 'Test User',
      createdAt: new Date().toISOString(),
    };

    useUserStore.getState().addUser(user);
    expect(useUserStore.getState().users).toHaveLength(1);
    expect(useUserStore.getState().users[0]).toEqual(user);
  });

  it('should update user in users array', () => {
    const user: User = {
      id: '1',
      email: 'test@example.com',
      name: 'Test User',
      createdAt: new Date().toISOString(),
    };

    useUserStore.getState().addUser(user);
    useUserStore.getState().updateUser('1', { name: 'Updated User' });

    const updatedUser = useUserStore.getState().users[0];
    expect(updatedUser.name).toBe('Updated User');
  });

  it('should remove user from users array', () => {
    const user: User = {
      id: '1',
      email: 'test@example.com',
      name: 'Test User',
      createdAt: new Date().toISOString(),
    };

    useUserStore.getState().addUser(user);
    expect(useUserStore.getState().users).toHaveLength(1);

    useUserStore.getState().removeUser('1');
    expect(useUserStore.getState().users).toHaveLength(0);
  });

  it('should set loading state', () => {
    useUserStore.getState().setLoading(true);
    expect(useUserStore.getState().isLoading).toBe(true);

    useUserStore.getState().setLoading(false);
    expect(useUserStore.getState().isLoading).toBe(false);
  });

  it('should set and clear error', () => {
    useUserStore.getState().setError('Test error');
    expect(useUserStore.getState().error).toBe('Test error');

    useUserStore.getState().clearError();
    expect(useUserStore.getState().error).toBeNull();
  });

  it('should update current user when updating by id', () => {
    const user: User = {
      id: '1',
      email: 'test@example.com',
      name: 'Test User',
      createdAt: new Date().toISOString(),
    };

    useUserStore.getState().setUser(user);
    useUserStore.getState().addUser(user);
    useUserStore.getState().updateUser('1', { name: 'Updated User' });

    expect(useUserStore.getState().user?.name).toBe('Updated User');
  });

  it('should not update users that do not match the id', () => {
    const user1: User = {
      id: '1',
      email: 'user1@example.com',
      name: 'User One',
      createdAt: new Date().toISOString(),
    };
    const user2: User = {
      id: '2',
      email: 'user2@example.com',
      name: 'User Two',
      createdAt: new Date().toISOString(),
    };

    useUserStore.getState().addUser(user1);
    useUserStore.getState().addUser(user2);
    useUserStore.getState().updateUser('2', { name: 'Updated User Two' });

    const users = useUserStore.getState().users;
    expect(users[0].name).toBe('User One'); // Not updated
    expect(users[1].name).toBe('Updated User Two'); // Updated
  });

  it('should not clear current user when removing a different user', () => {
    const currentUser: User = {
      id: '1',
      email: 'current@example.com',
      name: 'Current User',
      createdAt: new Date().toISOString(),
    };
    const otherUser: User = {
      id: '2',
      email: 'other@example.com',
      name: 'Other User',
      createdAt: new Date().toISOString(),
    };

    useUserStore.getState().setUser(currentUser);
    useUserStore.getState().addUser(currentUser);
    useUserStore.getState().addUser(otherUser);

    // Remove the other user, not the current user
    useUserStore.getState().removeUser('2');

    // Current user should still be set
    expect(useUserStore.getState().user).toEqual(currentUser);
    expect(useUserStore.getState().users).toHaveLength(1);
    expect(useUserStore.getState().users[0].id).toBe('1');
  });

  it('should clear current user when removing the current user', () => {
    const user: User = {
      id: '1',
      email: 'test@example.com',
      name: 'Test User',
      createdAt: new Date().toISOString(),
    };

    useUserStore.getState().setUser(user);
    useUserStore.getState().addUser(user);
    useUserStore.getState().removeUser('1');

    expect(useUserStore.getState().user).toBeNull();
    expect(useUserStore.getState().users).toHaveLength(0);
  });

  it('should set users array', () => {
    const users: User[] = [
      { id: '1', email: 'user1@example.com', name: 'User 1', createdAt: new Date().toISOString() },
      { id: '2', email: 'user2@example.com', name: 'User 2', createdAt: new Date().toISOString() },
    ];

    useUserStore.getState().setUsers(users);
    expect(useUserStore.getState().users).toHaveLength(2);
    expect(useUserStore.getState().users).toEqual(users);
  });
});
