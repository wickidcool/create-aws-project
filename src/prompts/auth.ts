import type { PromptObject } from 'prompts';
import pc from 'picocolors';

export const authProviderPrompt: PromptObject = {
  type: 'select',
  name: 'authProvider',
  message: 'Authentication provider:',
  choices: [
    { title: `${pc.yellow('○')} None (add later)`, value: 'none' },
    { title: `${pc.cyan('◆')} AWS Cognito`, value: 'cognito' },
    { title: `${pc.magenta('◆')} Auth0`, value: 'auth0' },
  ],
  initial: 0,
  hint: '- Cognito for AWS-native, Auth0 for flexibility'
};

export const authFeaturesPrompt: PromptObject = {
  type: (prev) => prev !== 'none' ? 'multiselect' : null,
  name: 'authFeatures',
  message: 'Auth features (space to toggle):',
  choices: [
    { title: 'Social Login (Google, GitHub)', value: 'social-login', selected: false },
    { title: 'Multi-Factor Authentication (MFA)', value: 'mfa', selected: false },
  ],
  hint: '- Email/password always included'
};
