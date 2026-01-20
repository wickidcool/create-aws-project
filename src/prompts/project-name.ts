import type { PromptObject } from 'prompts';
import { validateProjectName } from '../validation/project-name.js';

export const projectNamePrompt: PromptObject = {
  type: 'text',
  name: 'projectName',
  message: 'Project name:',
  initial: 'my-aws-app',
  validate: (value) => validateProjectName(value)
};
