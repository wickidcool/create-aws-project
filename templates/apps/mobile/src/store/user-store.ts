import { create } from 'zustand';
import type { User } from '{{PACKAGE_SCOPE}}/common-types';

interface UserState {
  user: User | null;
  users: User[];
  isLoading: boolean;
  error: string | null;
  setUser: (user: User | null) => void;
  setUsers: (users: User[]) => void;
  addUser: (user: User) => void;
  updateUser: (id: string, updates: Partial<User>) => void;
  removeUser: (id: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
}

export const useUserStore = create<UserState>((set) => ({
  user: null,
  users: [],
  isLoading: false,
  error: null,

  setUser: (user) => set({ user }),

  setUsers: (users) => set({ users }),

  addUser: (user) =>
    set((state) => ({
      users: [...state.users, user],
    })),

  updateUser: (id, updates) =>
    set((state) => ({
      users: state.users.map((u) =>
        u.id === id ? { ...u, ...updates } : u
      ),
      user:
        state.user?.id === id
          ? { ...state.user, ...updates }
          : state.user,
    })),

  removeUser: (id) =>
    set((state) => ({
      users: state.users.filter((u) => u.id !== id),
      user: state.user?.id === id ? null : state.user,
    })),

  setLoading: (loading) => set({ isLoading: loading }),

  setError: (error) => set({ error }),

  clearError: () => set({ error: null }),
}));
