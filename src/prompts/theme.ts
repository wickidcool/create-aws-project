import type { PromptObject } from 'prompts';
import pc from 'picocolors';

export const themePrompt: PromptObject = {
  type: 'select',
  name: 'brandColor',
  message: 'Choose your brand color:',
  choices: [
    { title: `${pc.blue('●')} Blue`, value: 'blue' },
    { title: `${pc.magenta('●')} Purple`, value: 'purple' },
    { title: `${pc.cyan('●')} Teal`, value: 'teal' },
    { title: `${pc.green('●')} Green`, value: 'green' },
    { title: `${pc.yellow('●')} Orange`, value: 'orange' }
  ],
  initial: 0
};
