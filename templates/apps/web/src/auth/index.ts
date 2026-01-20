// {{#if AUTH_COGNITO}}
export { AuthProvider, AuthContext } from './cognito-provider';
// {{/if AUTH_COGNITO}}
// {{#if AUTH_AUTH0}}
export { AuthProvider, AuthContext } from './auth0-provider';
// {{/if AUTH_AUTH0}}
export { useAuth } from './use-auth';
