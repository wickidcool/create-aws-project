import { StrictMode } from 'react';
import * as ReactDOM from 'react-dom/client';
import { ChakraProvider } from '@chakra-ui/react';
// {{#if AUTH_COGNITO}}
import { Amplify } from 'aws-amplify';
import { amplifyConfig } from './config/amplify-config';
import { AuthProvider } from './auth';
// {{/if AUTH_COGNITO}}
// {{#if AUTH_AUTH0}}
import { AuthProvider } from './auth';
// {{/if AUTH_AUTH0}}
import App from './App';
import theme from './theme';

// {{#if AUTH_COGNITO}}
Amplify.configure(amplifyConfig);
// {{/if AUTH_COGNITO}}

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

root.render(
  <StrictMode>
    <ChakraProvider theme={theme}>
      {/* {{#if AUTH_COGNITO}} */}
      <AuthProvider>
      {/* {{/if AUTH_COGNITO}} */}
      {/* {{#if AUTH_AUTH0}} */}
      <AuthProvider>
      {/* {{/if AUTH_AUTH0}} */}
        <App />
      {/* {{#if AUTH_COGNITO}} */}
      </AuthProvider>
      {/* {{/if AUTH_COGNITO}} */}
      {/* {{#if AUTH_AUTH0}} */}
      </AuthProvider>
      {/* {{/if AUTH_AUTH0}} */}
    </ChakraProvider>
  </StrictMode>
);
