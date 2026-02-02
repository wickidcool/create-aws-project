import prompts from 'prompts';
import pc from 'picocolors';
import type { AuthConfig, ProjectConfig } from './types.js';
import { projectNamePrompt } from './prompts/project-name.js';
import { platformsPrompt } from './prompts/platforms.js';
import { authProviderPrompt, authFeaturesPrompt } from './prompts/auth.js';
import { featuresPrompt } from './prompts/features.js';
import { awsRegionPrompt } from './prompts/aws-config.js';
import { themePrompt } from './prompts/theme.js';

export interface WizardOptions {
  defaultName?: string;
}

export async function runWizard(options: WizardOptions = {}): Promise<ProjectConfig | null> {
  // Create name prompt with optional default override
  const namePrompt = options.defaultName
    ? { ...projectNamePrompt, initial: options.defaultName }
    : projectNamePrompt;
  const response = await prompts(
    [
      namePrompt,
      platformsPrompt,
      authProviderPrompt,
      authFeaturesPrompt,
      featuresPrompt,
      awsRegionPrompt,
      themePrompt,
    ],
    {
      onCancel: () => {
        console.log(`\n${pc.red('✖')} Setup cancelled`);
        process.exit(0);
      },
    }
  );

  // Validate all required fields present
  if (!response.projectName || !response.platforms?.length || !response.awsRegion || !response.brandColor) {
    return null;
  }

  // features defaults to empty array if all deselected
  if (!response.features) {
    response.features = [];
  }

  // Construct auth config with defaults
  const auth: AuthConfig = {
    provider: response.authProvider || 'none',
    features: response.authFeatures || [],
  };

  const config: ProjectConfig = {
    projectName: response.projectName,
    platforms: response.platforms,
    awsRegion: response.awsRegion,
    features: response.features,
    brandColor: response.brandColor,
    auth,
  };

  return config;
}
