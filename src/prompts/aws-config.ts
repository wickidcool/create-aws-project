import type { PromptObject } from 'prompts';

export const awsRegionPrompt: PromptObject = {
  type: 'select',
  name: 'awsRegion',
  message: 'AWS Region:',
  choices: [
    { title: 'US East (N. Virginia) - us-east-1', value: 'us-east-1' },
    { title: 'US West (Oregon) - us-west-2', value: 'us-west-2' },
    { title: 'EU (Ireland) - eu-west-1', value: 'eu-west-1' },
    { title: 'EU (Frankfurt) - eu-central-1', value: 'eu-central-1' },
    { title: 'Asia Pacific (Tokyo) - ap-northeast-1', value: 'ap-northeast-1' },
    { title: 'Asia Pacific (Sydney) - ap-southeast-2', value: 'ap-southeast-2' }
  ],
  initial: 0
};
