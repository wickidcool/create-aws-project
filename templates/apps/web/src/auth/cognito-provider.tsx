import { createContext, useCallback, useEffect, useState, type ReactNode } from 'react';
import {
  signIn as amplifySignIn,
  signUp as amplifySignUp,
  signOut as amplifySignOut,
  confirmSignUp as amplifyConfirmSignUp,
  resetPassword,
  confirmResetPassword,
  getCurrentUser,
  fetchAuthSession,
} from 'aws-amplify/auth';
import type { AuthContextType, AuthUser } from '{{PACKAGE_SCOPE}}/common-types';

export const AuthContext = createContext<AuthContextType | null>(null);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const isAuthenticated = user !== null;

  // Check for existing session on mount
  useEffect(() => {
    checkAuthState();
  }, []);

  async function checkAuthState() {
    try {
      const currentUser = await getCurrentUser();
      const session = await fetchAuthSession();

      setUser({
        id: currentUser.userId,
        email: currentUser.signInDetails?.loginId || '',
        emailVerified: true,
        groups: session.tokens?.accessToken?.payload['cognito:groups'] as string[] | undefined,
      });
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }

  const signIn = useCallback(async (email: string, password: string) => {
    setIsLoading(true);
    setError(null);
    try {
      await amplifySignIn({ username: email, password });
      await checkAuthState();
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Sign in failed'));
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    setIsLoading(true);
    setError(null);
    try {
      await amplifySignUp({
        username: email,
        password,
        options: { userAttributes: { email } },
      });
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Sign up failed'));
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    setIsLoading(true);
    try {
      await amplifySignOut();
      setUser(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Sign out failed'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  const confirmSignUp = useCallback(async (email: string, code: string) => {
    setIsLoading(true);
    try {
      await amplifyConfirmSignUp({ username: email, confirmationCode: code });
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Confirmation failed'));
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const forgotPassword = useCallback(async (email: string) => {
    setIsLoading(true);
    try {
      await resetPassword({ username: email });
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Password reset failed'));
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const confirmForgotPassword = useCallback(async (email: string, code: string, newPassword: string) => {
    setIsLoading(true);
    try {
      await confirmResetPassword({ username: email, confirmationCode: code, newPassword });
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Password reset confirmation failed'));
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated,
    error,
    signIn,
    signUp,
    signOut,
    confirmSignUp,
    forgotPassword,
    confirmForgotPassword,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
