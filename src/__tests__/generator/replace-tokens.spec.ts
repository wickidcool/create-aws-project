import { describe, it, expect } from '@jest/globals';
import {
  replaceTokens,
  processConditionalBlocks,
} from '../../generator/replace-tokens.js';
import type { TokenValues } from '../../templates/types.js';

describe('replaceTokens', () => {
  const mockTokens: TokenValues = {
    PROJECT_NAME: 'my-awesome-app',
    PROJECT_NAME_PASCAL: 'MyAwesomeApp',
    PROJECT_NAME_TITLE: 'My Awesome App',
    AWS_REGION: 'us-west-2',
    PACKAGE_SCOPE: '@my-awesome-app',
    BRAND_COLOR: 'blue',
    AUTH_COGNITO: 'false',
    AUTH_AUTH0: 'false',
    AUTH_SOCIAL_LOGIN: 'false',
    AUTH_MFA: 'false',
  };

  describe('single token replacement', () => {
    it('should replace PROJECT_NAME token', () => {
      const content = 'name: {{PROJECT_NAME}}';
      const result = replaceTokens(content, mockTokens);
      expect(result).toBe('name: my-awesome-app');
    });

    it('should replace PROJECT_NAME_PASCAL token', () => {
      const content = 'class {{PROJECT_NAME_PASCAL}}Stack {}';
      const result = replaceTokens(content, mockTokens);
      expect(result).toBe('class MyAwesomeAppStack {}');
    });

    it('should replace AWS_REGION token', () => {
      const content = 'region: {{AWS_REGION}}';
      const result = replaceTokens(content, mockTokens);
      expect(result).toBe('region: us-west-2');
    });

    it('should replace PACKAGE_SCOPE token', () => {
      const content = "import { User } from '{{PACKAGE_SCOPE}}/common-types';";
      const result = replaceTokens(content, mockTokens);
      expect(result).toBe("import { User } from '@my-awesome-app/common-types';");
    });

    it('should replace BRAND_COLOR token', () => {
      const content = 'color: {{BRAND_COLOR}}';
      const result = replaceTokens(content, mockTokens);
      expect(result).toBe('color: blue');
    });

    it('should replace AUTH_COGNITO token', () => {
      const content = 'cognito: {{AUTH_COGNITO}}';
      const result = replaceTokens(content, mockTokens);
      expect(result).toBe('cognito: false');
    });
  });

  describe('multiple token replacement', () => {
    it('should replace multiple different tokens', () => {
      const content = `{
  "name": "{{PROJECT_NAME}}",
  "region": "{{AWS_REGION}}",
  "scope": "{{PACKAGE_SCOPE}}"
}`;
      const result = replaceTokens(content, mockTokens);
      expect(result).toBe(`{
  "name": "my-awesome-app",
  "region": "us-west-2",
  "scope": "@my-awesome-app"
}`);
    });

    it('should replace same token multiple times', () => {
      const content = '{{PROJECT_NAME}} and {{PROJECT_NAME}} again';
      const result = replaceTokens(content, mockTokens);
      expect(result).toBe('my-awesome-app and my-awesome-app again');
    });
  });

  describe('unknown token handling', () => {
    it('should preserve unknown tokens', () => {
      const content = '{{UNKNOWN_TOKEN}} stays';
      const result = replaceTokens(content, mockTokens);
      expect(result).toBe('{{UNKNOWN_TOKEN}} stays');
    });

    it('should replace known tokens and preserve unknown ones', () => {
      const content = '{{PROJECT_NAME}} and {{UNKNOWN_TOKEN}}';
      const result = replaceTokens(content, mockTokens);
      expect(result).toBe('my-awesome-app and {{UNKNOWN_TOKEN}}');
    });
  });

  describe('passthrough for content without tokens', () => {
    it('should return unchanged content when no tokens present', () => {
      const content = 'Regular content without any tokens';
      const result = replaceTokens(content, mockTokens);
      expect(result).toBe('Regular content without any tokens');
    });

    it('should return empty string unchanged', () => {
      const content = '';
      const result = replaceTokens(content, mockTokens);
      expect(result).toBe('');
    });

    it('should not match partial token patterns', () => {
      const content = '{ PROJECT_NAME } and {{ broken';
      const result = replaceTokens(content, mockTokens);
      expect(result).toBe('{ PROJECT_NAME } and {{ broken');
    });
  });
});

describe('processConditionalBlocks', () => {
  const baseTokens: TokenValues = {
    PROJECT_NAME: 'my-awesome-app',
    PROJECT_NAME_PASCAL: 'MyAwesomeApp',
    PROJECT_NAME_TITLE: 'My Awesome App',
    AWS_REGION: 'us-west-2',
    PACKAGE_SCOPE: '@my-awesome-app',
    BRAND_COLOR: 'blue',
    AUTH_COGNITO: 'false',
    AUTH_AUTH0: 'false',
    AUTH_SOCIAL_LOGIN: 'false',
    AUTH_MFA: 'false',
  };

  describe('comment-wrapped conditionals', () => {
    it('should keep content when token is true (removes markers)', () => {
      const tokens = { ...baseTokens, AUTH_COGNITO: 'true' };
      const content = `before
// {{#if AUTH_COGNITO}}
import { CognitoStack } from './cognito';
// {{/if AUTH_COGNITO}}
after`;
      const result = processConditionalBlocks(content, tokens);
      expect(result).toBe(`before
import { CognitoStack } from './cognito';
after`);
    });

    it('should remove entire block when token is false', () => {
      const tokens = { ...baseTokens, AUTH_COGNITO: 'false' };
      const content = `before
// {{#if AUTH_COGNITO}}
import { CognitoStack } from './cognito';
// {{/if AUTH_COGNITO}}
after`;
      const result = processConditionalBlocks(content, tokens);
      expect(result).toBe(`before
after`);
    });

    it('should remove entire block when token is missing', () => {
      const content = `before
// {{#if UNKNOWN_TOKEN}}
some content
// {{/if UNKNOWN_TOKEN}}
after`;
      const result = processConditionalBlocks(content, baseTokens);
      expect(result).toBe(`before
after`);
    });

    it('should handle multiple comment-wrapped blocks', () => {
      const tokens = { ...baseTokens, AUTH_COGNITO: 'true', AUTH_AUTH0: 'false' };
      const content = `// {{#if AUTH_COGNITO}}
import { CognitoStack } from './cognito';
// {{/if AUTH_COGNITO}}
// {{#if AUTH_AUTH0}}
import { Auth0Stack } from './auth0';
// {{/if AUTH_AUTH0}}
const app = new App();`;
      const result = processConditionalBlocks(content, tokens);
      expect(result).toBe(`import { CognitoStack } from './cognito';
const app = new App();`);
    });
  });

  describe('plain conditionals', () => {
    it('should keep content when token is true (removes markers)', () => {
      const tokens = { ...baseTokens, AUTH_COGNITO: 'true' };
      const content = `before
{{#if AUTH_COGNITO}}
Cognito content here
{{/if AUTH_COGNITO}}
after`;
      const result = processConditionalBlocks(content, tokens);
      expect(result).toBe(`before
Cognito content here
after`);
    });

    it('should remove entire block when token is false', () => {
      const tokens = { ...baseTokens, AUTH_COGNITO: 'false' };
      const content = `before
{{#if AUTH_COGNITO}}
Cognito content here
{{/if AUTH_COGNITO}}
after`;
      const result = processConditionalBlocks(content, tokens);
      expect(result).toBe(`before
after`);
    });
  });

  describe('nested content with other tokens', () => {
    it('should preserve tokens inside conditional blocks for later replacement', () => {
      const tokens = { ...baseTokens, AUTH_COGNITO: 'true' };
      const content = `// {{#if AUTH_COGNITO}}
new CognitoStack(app, '{{PROJECT_NAME_PASCAL}}-Cognito');
// {{/if AUTH_COGNITO}}`;
      const result = processConditionalBlocks(content, tokens);
      expect(result).toBe(`new CognitoStack(app, '{{PROJECT_NAME_PASCAL}}-Cognito');
`);
    });
  });

  describe('content preservation', () => {
    it('should preserve content outside of conditional blocks', () => {
      const tokens = { ...baseTokens, AUTH_COGNITO: 'false' };
      const content = `const app = new App();
// {{#if AUTH_COGNITO}}
new CognitoStack(app);
// {{/if AUTH_COGNITO}}
const region = '{{AWS_REGION}}';`;
      const result = processConditionalBlocks(content, tokens);
      expect(result).toBe(`const app = new App();
const region = '{{AWS_REGION}}';`);
    });

    it('should return unchanged content when no conditionals present', () => {
      const content = `const app = new App();
const region = '{{AWS_REGION}}';`;
      const result = processConditionalBlocks(content, baseTokens);
      expect(result).toBe(content);
    });

    it('should return empty string unchanged', () => {
      const result = processConditionalBlocks('', baseTokens);
      expect(result).toBe('');
    });
  });
});

describe('replaceTokens integration with conditionals', () => {
  const baseTokens: TokenValues = {
    PROJECT_NAME: 'my-awesome-app',
    PROJECT_NAME_PASCAL: 'MyAwesomeApp',
    PROJECT_NAME_TITLE: 'My Awesome App',
    AWS_REGION: 'us-west-2',
    PACKAGE_SCOPE: '@my-awesome-app',
    BRAND_COLOR: 'blue',
    AUTH_COGNITO: 'false',
    AUTH_AUTH0: 'false',
    AUTH_SOCIAL_LOGIN: 'false',
    AUTH_MFA: 'false',
  };

  it('should process conditionals before token replacement', () => {
    const tokens = { ...baseTokens, AUTH_COGNITO: 'true' };
    const content = `const appName = '{{PROJECT_NAME_PASCAL}}';
// {{#if AUTH_COGNITO}}
new CognitoStack(app, '{{PROJECT_NAME_PASCAL}}-Cognito');
// {{/if AUTH_COGNITO}}`;
    const result = replaceTokens(content, tokens);
    expect(result).toBe(`const appName = 'MyAwesomeApp';
new CognitoStack(app, 'MyAwesomeApp-Cognito');
`);
  });

  it('should handle AUTH_COGNITO=true keeping Cognito-specific code', () => {
    const tokens = { ...baseTokens, AUTH_COGNITO: 'true' };
    const content = `import * as cdk from 'aws-cdk-lib';
// {{#if AUTH_COGNITO}}
import { CognitoStack } from './auth/cognito-stack';
// {{/if AUTH_COGNITO}}

const app = new cdk.App();`;
    const result = replaceTokens(content, tokens);
    expect(result).toBe(`import * as cdk from 'aws-cdk-lib';
import { CognitoStack } from './auth/cognito-stack';

const app = new cdk.App();`);
  });

  it('should handle AUTH_AUTH0=true keeping Auth0-specific code', () => {
    const tokens = { ...baseTokens, AUTH_AUTH0: 'true' };
    const content = `// {{#if AUTH_AUTH0}}
import { auth0Config } from './auth0-config';
// {{/if AUTH_AUTH0}}
export const config = {};`;
    const result = replaceTokens(content, tokens);
    expect(result).toBe(`import { auth0Config } from './auth0-config';
export const config = {};`);
  });

  it('should remove auth-specific code when provider is false', () => {
    const tokens = { ...baseTokens, AUTH_COGNITO: 'false', AUTH_AUTH0: 'false' };
    const content = `const app = new App();
// {{#if AUTH_COGNITO}}
new CognitoStack(app);
// {{/if AUTH_COGNITO}}
// {{#if AUTH_AUTH0}}
new Auth0Integration(app);
// {{/if AUTH_AUTH0}}
app.synth();`;
    const result = replaceTokens(content, tokens);
    expect(result).toBe(`const app = new App();
app.synth();`);
  });
});
