import prompts from 'prompts';
import pc from 'picocolors';
import type { AuthConfig, OrgAccountConfig, OrgConfig, ProjectConfig } from './types.js';
import { projectNamePrompt } from './prompts/project-name.js';
import { platformsPrompt } from './prompts/platforms.js';
import { authProviderPrompt, authFeaturesPrompt } from './prompts/auth.js';
import { featuresPrompt } from './prompts/features.js';
import { awsRegionPrompt } from './prompts/aws-config.js';
import { themePrompt } from './prompts/theme.js';
import {
  enableOrgPrompt,
  orgNamePrompt,
  orgEnvironmentsPrompt,
  devEmailPrompt,
  stageEmailPrompt,
  prodEmailPrompt,
  qaEmailPrompt,
  sandboxEmailPrompt,
} from './prompts/org-structure.js';

export async function runWizard(): Promise<ProjectConfig | null> {
  const response = await prompts(
    [
      projectNamePrompt,
      platformsPrompt,
      authProviderPrompt,
      authFeaturesPrompt,
      featuresPrompt,
      awsRegionPrompt,
      enableOrgPrompt,
      orgNamePrompt,
      orgEnvironmentsPrompt,
      devEmailPrompt,
      stageEmailPrompt,
      prodEmailPrompt,
      qaEmailPrompt,
      sandboxEmailPrompt,
      themePrompt
    ],
    {
      onCancel: () => {
        console.log(`\n${pc.red('✖')} Setup cancelled`);
        process.exit(0);
      }
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

  // Construct org config if enabled
  let org: OrgConfig | undefined;
  if (response.enableOrg) {
    const accounts: OrgAccountConfig[] = [];
    const emailMap: Record<string, string | undefined> = {
      dev: response.devEmail,
      stage: response.stageEmail,
      prod: response.prodEmail,
      qa: response.qaEmail,
      sandbox: response.sandboxEmail,
    };

    for (const env of response.orgEnvironments || []) {
      const email = emailMap[env];
      if (email) {
        accounts.push({ environment: env, email });
      }
    }

    org = {
      enabled: true,
      organizationName: response.orgName,
      accounts,
    };
  }

  const config: ProjectConfig = {
    projectName: response.projectName,
    platforms: response.platforms,
    awsRegion: response.awsRegion,
    features: response.features,
    brandColor: response.brandColor,
    auth,
  };

  if (org) {
    config.org = org;
  }

  return config;
}
