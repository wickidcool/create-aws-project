import { existsSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import pc from 'picocolors';
import { copyFileWithTokens, copyDirectoryWithTokens } from './copy-file.js';
import { deriveTokenValues, templateManifest } from '../templates/index.js';
import type { ProjectConfig } from '../types.js';
import type { Platform, Feature, AuthProvider, TemplateFile } from '../templates/types.js';

/**
 * Options for project generation
 */
export interface GenerateOptions {
  onProgress?: (message: string) => void;
}

/**
 * Get the templates directory path
 */
function getTemplatesDir(): string {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  // Navigate from dist/src/generator to templates/
  return join(__dirname, '..', '..', 'templates');
}

/**
 * Copy a template entry (file or directory) to output
 */
function copyTemplateEntry(
  entry: TemplateFile,
  templatesDir: string,
  outputDir: string,
  tokens: ReturnType<typeof deriveTokenValues>
): void {
  const srcPath = join(templatesDir, entry.src);
  const destPath = join(outputDir, entry.dest);

  if (!existsSync(srcPath)) {
    console.warn(`Warning: Template not found: ${entry.src}`);
    return;
  }

  const stats = statSync(srcPath);
  if (stats.isDirectory()) {
    copyDirectoryWithTokens(srcPath, destPath, tokens);
  } else {
    copyFileWithTokens(srcPath, destPath, tokens);
  }
}

/**
 * Generate a project from templates based on user configuration
 * @param config - User's project configuration from wizard
 * @param outputDir - Directory where project will be created
 * @param options - Optional generation options including progress callback
 */
export async function generateProject(
  config: ProjectConfig,
  outputDir: string,
  options: GenerateOptions = {}
): Promise<void> {
  const { onProgress = (msg) => console.log(msg) } = options;
  const templatesDir = getTemplatesDir();
  const tokens = deriveTokenValues(config);

  onProgress(pc.cyan('Creating project structure...'));

  // 1. Copy all shared files
  onProgress('  Copying shared configuration...');
  for (const entry of templateManifest.shared) {
    copyTemplateEntry(entry, templatesDir, outputDir, tokens);
  }

  // 2. Copy platform-specific files based on user selection
  for (const platform of config.platforms) {
    onProgress(`  Copying ${platform} app...`);
    const platformEntries = templateManifest.byPlatform[platform as Platform];
    if (platformEntries) {
      for (const entry of platformEntries) {
        copyTemplateEntry(entry, templatesDir, outputDir, tokens);
      }
    }
  }

  // 3. Copy feature-specific files based on user selection
  for (const feature of config.features) {
    onProgress(`  Adding ${feature}...`);
    const featureEntries = templateManifest.byFeature[feature as Feature];
    if (featureEntries) {
      for (const entry of featureEntries) {
        copyTemplateEntry(entry, templatesDir, outputDir, tokens);
      }
    }
  }

  // 4. Copy auth provider-specific files based on user selection
  if (config.auth.provider !== 'none') {
    onProgress(`  Adding ${config.auth.provider} authentication...`);
    const authEntries = templateManifest.byAuthProvider[config.auth.provider as AuthProvider];
    if (authEntries) {
      for (const entry of authEntries) {
        copyTemplateEntry(entry, templatesDir, outputDir, tokens);
      }
    }
  }

  onProgress(pc.green('✔') + ' Project structure created');
}
