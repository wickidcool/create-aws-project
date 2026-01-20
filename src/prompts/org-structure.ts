import type { PromptObject } from 'prompts';
import pc from 'picocolors';

export const enableOrgPrompt: PromptObject = {
  type: 'select',
  name: 'enableOrg',
  message: 'Set up AWS Organizations with separate accounts per environment?',
  choices: [
    { title: `${pc.yellow('○')} No (single account)`, value: false },
    { title: `${pc.cyan('◆')} Yes (multi-account)`, value: true },
  ],
  initial: 0,
  hint: '- Creates separate AWS accounts for each environment'
};

export const orgNamePrompt: PromptObject = {
  type: (prev) => prev ? 'text' : null,
  name: 'orgName',
  message: 'Organization name:',
  initial: (_prev: unknown, values: Record<string, unknown>) => `${values.projectName}-org`,
  validate: (value: string) => value.trim().length > 0 || 'Organization name is required'
};

export const orgEnvironmentsPrompt: PromptObject = {
  type: (_prev, values) => values.enableOrg ? 'multiselect' : null,
  name: 'orgEnvironments',
  message: 'Select environments to create accounts for:',
  choices: [
    { title: 'dev', value: 'dev', selected: true },
    { title: 'stage', value: 'stage', selected: true },
    { title: 'prod', value: 'prod', selected: true },
    { title: 'qa', value: 'qa', selected: false },
    { title: 'sandbox', value: 'sandbox', selected: false },
  ],
  hint: '- Space to toggle, Enter to confirm',
  min: 1
};

export const devEmailPrompt: PromptObject = {
  type: (_prev, values) => values.enableOrg && values.orgEnvironments?.includes('dev') ? 'text' : null,
  name: 'devEmail',
  message: 'Dev account root email:',
  validate: (value: string) => {
    if (!value.trim()) return 'Email is required';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'Invalid email format';
    return true;
  }
};

export const stageEmailPrompt: PromptObject = {
  type: (_prev, values) => values.enableOrg && values.orgEnvironments?.includes('stage') ? 'text' : null,
  name: 'stageEmail',
  message: 'Stage account root email:',
  validate: (value: string) => {
    if (!value.trim()) return 'Email is required';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'Invalid email format';
    return true;
  }
};

export const prodEmailPrompt: PromptObject = {
  type: (_prev, values) => values.enableOrg && values.orgEnvironments?.includes('prod') ? 'text' : null,
  name: 'prodEmail',
  message: 'Prod account root email:',
  validate: (value: string) => {
    if (!value.trim()) return 'Email is required';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'Invalid email format';
    return true;
  }
};

export const qaEmailPrompt: PromptObject = {
  type: (_prev, values) => values.enableOrg && values.orgEnvironments?.includes('qa') ? 'text' : null,
  name: 'qaEmail',
  message: 'QA account root email:',
  validate: (value: string) => {
    if (!value.trim()) return 'Email is required';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'Invalid email format';
    return true;
  }
};

export const sandboxEmailPrompt: PromptObject = {
  type: (_prev, values) => values.enableOrg && values.orgEnvironments?.includes('sandbox') ? 'text' : null,
  name: 'sandboxEmail',
  message: 'Sandbox account root email:',
  validate: (value: string) => {
    if (!value.trim()) return 'Email is required';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'Invalid email format';
    return true;
  }
};
