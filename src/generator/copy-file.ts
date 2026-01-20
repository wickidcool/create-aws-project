import { readFileSync, writeFileSync, mkdirSync, readdirSync, copyFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { replaceTokens } from './replace-tokens.js';
import type { TokenValues } from '../templates/types.js';

/**
 * Check if a file should have token replacement (text files only)
 */
function shouldReplaceTokens(filename: string): boolean {
  const textExtensions = ['.ts', '.tsx', '.js', '.jsx', '.json', '.md', '.yml', '.yaml', '.html', '.css'];
  const ext = filename.substring(filename.lastIndexOf('.'));
  return textExtensions.includes(ext);
}

/**
 * Copy a single file with token replacement
 * @param srcPath - Source file path
 * @param destPath - Destination file path
 * @param tokens - Token values for replacement
 */
export function copyFileWithTokens(srcPath: string, destPath: string, tokens: TokenValues): void {
  // Ensure destination directory exists
  mkdirSync(dirname(destPath), { recursive: true });

  if (shouldReplaceTokens(srcPath)) {
    // Text file - read, replace tokens, write
    const content = readFileSync(srcPath, 'utf-8');
    const replaced = replaceTokens(content, tokens);
    writeFileSync(destPath, replaced, 'utf-8');
  } else {
    // Binary file - direct copy
    copyFileSync(srcPath, destPath);
  }
}

/**
 * Recursively copy a directory with token replacement
 * @param srcDir - Source directory path
 * @param destDir - Destination directory path
 * @param tokens - Token values for replacement
 */
export function copyDirectoryWithTokens(srcDir: string, destDir: string, tokens: TokenValues): void {
  mkdirSync(destDir, { recursive: true });

  const entries = readdirSync(srcDir, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = join(srcDir, entry.name);
    let destName = entry.name;

    // Handle .template extension - rename back to original
    if (destName.endsWith('.template')) {
      destName = destName.replace('.template', '');
    }

    const destPath = join(destDir, destName);

    if (entry.isDirectory()) {
      copyDirectoryWithTokens(srcPath, destPath, tokens);
    } else {
      copyFileWithTokens(srcPath, destPath, tokens);
    }
  }
}
