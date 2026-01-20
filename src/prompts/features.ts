import type { PromptObject } from 'prompts';

export const featuresPrompt: PromptObject = {
  type: 'multiselect',
  name: 'features',
  message: 'Include optional features (space to toggle):',
  choices: [
    { title: 'GitHub Actions (CI/CD workflows)', value: 'github-actions', selected: true },
    { title: 'VSCode Config (settings, extensions)', value: 'vscode-config', selected: true }
  ],
  hint: '- All optional'
};
