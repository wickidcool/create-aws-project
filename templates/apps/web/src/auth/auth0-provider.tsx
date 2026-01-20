import { createContext, useCallback, type ReactNode } from 'react';
import { Auth0Provider as Auth0ProviderBase, useAuth0 } from '@auth0/auth0-react';
import { auth0Config } from '../config/auth0-config';
import type { AuthContextType, AuthUser } from '{{PACKAGE_SCOPE}}/common-types';

export const AuthContext = createContext<AuthContextType | null>(null);

interface AuthProviderProps {
  children: ReactNode;
}

/**
 * Internal component that uses Auth0 hooks (must be inside Auth0ProviderBase)
 */
function AuthContextProvider({ children }: AuthProviderProps) {
  const {
    user: auth0User,
    isLoading,
    isAuthenticated,
    error: auth0Error,
    loginWithRedirect,
    logout,
  } = useAuth0();

  // Map Auth0 user to our AuthUser type
  const user: AuthUser | null = auth0User
    ? {
        id: auth0User.sub || '',
        email: auth0User.email || '',
        emailVerified: auth0User.email_verified || false,
      }
    : null;

  const error = auth0Error || null;

  const signIn = useCallback(async (_email: string, _password: string) => {
    // Auth0 uses redirect-based auth, email/password are handled by Auth0 login page
    await loginWithRedirect();
  }, [loginWithRedirect]);

  const signUp = useCallback(async (_email: string, _password: string) => {
    // Auth0 handles signup via the same redirect flow with screen_hint
    await loginWithRedirect({
      authorizationParams: {
        screen_hint: 'signup',
      },
    });
  }, [loginWithRedirect]);

  const signOut = useCallback(async () => {
    logout({
      logoutParams: {
        returnTo: window.location.origin,
      },
    });
  }, [logout]);

  const confirmSignUp = useCallback(async (_email: string, _code: string) => {
    throw new Error('confirmSignUp is not supported with Auth0. Email verification is handled automatically by Auth0.');
  }, []);

  const forgotPassword = useCallback(async (_email: string) => {
    throw new Error('forgotPassword is not supported with Auth0. Password reset is handled via the Auth0 Universal Login.');
  }, []);

  const confirmForgotPassword = useCallback(async (_email: string, _code: string, _newPassword: string) => {
    throw new Error('confirmForgotPassword is not supported with Auth0. Password reset is handled via the Auth0 Universal Login.');
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

/**
 * Auth0 authentication provider that wraps @auth0/auth0-react
 * and adapts to our AuthContextType interface
 */
export function AuthProvider({ children }: AuthProviderProps) {
  return (
    <Auth0ProviderBase
      domain={auth0Config.domain}
      clientId={auth0Config.clientId}
      authorizationParams={{
        redirect_uri: auth0Config.redirectUri,
        ...(auth0Config.audience && { audience: auth0Config.audience }),
      }}
    >
      <AuthContextProvider>{children}</AuthContextProvider>
    </Auth0ProviderBase>
  );
}
