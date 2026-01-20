import type { PromptObject } from 'prompts';

export const platformsPrompt: PromptObject = {
  type: 'multiselect',
  name: 'platforms',
  message: 'Select platforms (space to toggle, enter to confirm):',
  choices: [
    { title: 'Web (React + Vite + Chakra UI)', value: 'web', selected: true },
    { title: 'Mobile (React Native + Expo)', value: 'mobile' },
    { title: 'API (AWS Lambda + DynamoDB)', value: 'api', selected: true }
  ],
  min: 1,
  hint: '- At least one required'
};
