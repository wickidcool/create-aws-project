import { useContext } from 'react';
// {{#if AUTH_COGNITO}}
import { AuthContext } from './cognito-provider';
// {{/if AUTH_COGNITO}}
// {{#if AUTH_AUTH0}}
import { AuthContext } from './auth0-provider';
// {{/if AUTH_AUTH0}}
import type { AuthContextType } from '{{PACKAGE_SCOPE}}/common-types';

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
