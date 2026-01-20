/**
 * Authenticated user information
 */
export interface AuthUser {
  id: string;           // Cognito sub
  email: string;
  emailVerified: boolean;
  groups?: string[];
}

/**
 * Auth state for UI consumption
 */
export interface AuthState {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: Error | null;
}

/**
 * Auth context actions
 */
export interface AuthActions {
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  confirmSignUp: (email: string, code: string) => Promise<void>;
  forgotPassword: (email: string) => Promise<void>;
  confirmForgotPassword: (email: string, code: string, newPassword: string) => Promise<void>;
}

/**
 * Complete auth context type
 */
export type AuthContextType = AuthState & AuthActions;
