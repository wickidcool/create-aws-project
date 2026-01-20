import { TOKEN_PATTERN } from '../templates/tokens.js';
import type { TokenValues } from '../templates/types.js';

/**
 * Pattern to match comment-wrapped conditional blocks:
 * // {{#if TOKEN}}
 * ...content...
 * // {{/if TOKEN}}
 *
 * Uses non-greedy matching and backreference to ensure opening/closing tokens match.
 */
const COMMENT_CONDITIONAL_PATTERN =
  /\/\/\s*\{\{#if\s+(\w+)\}\}\r?\n([\s\S]*?)\/\/\s*\{\{\/if\s+\1\}\}\r?\n?/g;

/**
 * Pattern to match plain conditional blocks (without comment prefix):
 * {{#if TOKEN}}
 * ...content...
 * {{/if TOKEN}}
 */
const PLAIN_CONDITIONAL_PATTERN =
  /\{\{#if\s+(\w+)\}\}\r?\n?([\s\S]*?)\{\{\/if\s+\1\}\}\r?\n?/g;

/**
 * Process conditional blocks in content based on token values.
 *
 * Supports two formats:
 * 1. Comment-wrapped (for TypeScript/JavaScript files):
 *    // {{#if TOKEN}}
 *    import { Something } from './something';
 *    // {{/if TOKEN}}
 *
 * 2. Plain (for other file types):
 *    {{#if TOKEN}}
 *    Some content
 *    {{/if TOKEN}}
 *
 * @param content - File content with conditional blocks
 * @param tokens - Token values (value of 'true' keeps content, anything else removes it)
 * @returns Content with conditional blocks processed
 */
export function processConditionalBlocks(
  content: string,
  tokens: TokenValues
): string {
  let result = content;

  // Process comment-wrapped conditionals first (more specific pattern)
  result = result.replace(
    COMMENT_CONDITIONAL_PATTERN,
    (_match, tokenName: string, blockContent: string) => {
      const tokenValue = tokens[tokenName as keyof TokenValues];
      // Keep content if token value is exactly 'true', otherwise remove entire block
      return tokenValue === 'true' ? blockContent : '';
    }
  );

  // Process plain conditionals
  result = result.replace(
    PLAIN_CONDITIONAL_PATTERN,
    (_match, tokenName: string, blockContent: string) => {
      const tokenValue = tokens[tokenName as keyof TokenValues];
      // Keep content if token value is exactly 'true', otherwise remove entire block
      return tokenValue === 'true' ? blockContent : '';
    }
  );

  return result;
}

/**
 * Replace all {{TOKEN}} placeholders in content with actual values.
 * Processes conditional blocks first, then replaces remaining tokens.
 *
 * @param content - File content with {{TOKEN}} placeholders and conditional blocks
 * @param tokens - Token values to substitute
 * @returns Content with conditionals processed and all tokens replaced
 */
export function replaceTokens(content: string, tokens: TokenValues): string {
  // Process conditional blocks BEFORE token replacement
  const processedContent = processConditionalBlocks(content, tokens);

  // Then replace individual tokens
  return processedContent.replace(TOKEN_PATTERN, (match, tokenName) => {
    const value = tokens[tokenName as keyof TokenValues];
    return value !== undefined ? value : match; // Keep original if unknown token
  });
}
