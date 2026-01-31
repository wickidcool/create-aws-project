import { Octokit } from '@octokit/rest';
import { createRequire } from 'node:module';
import pc from 'picocolors';

// Use createRequire to load the CJS build of libsodium-wrappers.
// The ESM build has a broken relative import for its libsodium dependency.
const require = createRequire(import.meta.url);
const sodium = require('libsodium-wrappers') as typeof import('libsodium-wrappers');

/**
 * GitHub secrets service module
 *
 * Provides functions to manage GitHub environment secrets
 * for AWS deployment credentials via the GitHub REST API.
 *
 * Uses GitHub Environments to organize secrets by environment (dev, stage, prod),
 * with the same secret names in each environment (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY).
 */

/**
 * Creates a configured Octokit client
 * @param token - GitHub Personal Access Token (requires `repo` scope)
 * @returns Configured Octokit instance
 */
export function createGitHubClient(token: string): Octokit {
  return new Octokit({
    auth: token,
  });
}

/**
 * Public key for encrypting secrets
 */
export interface PublicKey {
  keyId: string;
  key: string;
}

/**
 * Fetches the repository's public key for encrypting secrets
 * @param client - Octokit instance
 * @param owner - Repository owner (username or organization)
 * @param repo - Repository name
 * @returns Public key ID and base64-encoded key
 */
export async function getRepositoryPublicKey(
  client: Octokit,
  owner: string,
  repo: string
): Promise<PublicKey> {
  try {
    const response = await client.actions.getRepoPublicKey({
      owner,
      repo,
    });

    return {
      keyId: response.data.key_id,
      key: response.data.key,
    };
  } catch (error) {
    if (error instanceof Error && 'status' in error && error.status === 401) {
      throw new Error(
        'GitHub authentication failed. Ensure your token has the "repo" scope for repository secrets access.'
      );
    }
    throw error;
  }
}

/**
 * Encrypts a secret value using the repository's public key
 * @param publicKey - Base64-encoded repository public key
 * @param secretValue - Plain text secret value to encrypt
 * @returns Base64-encoded encrypted value
 */
export async function encryptSecret(
  publicKey: string,
  secretValue: string
): Promise<string> {
  await sodium.ready;

  const publicKeyBytes = sodium.from_base64(
    publicKey,
    sodium.base64_variants.ORIGINAL
  );
  const secretBytes = sodium.from_string(secretValue);
  const encryptedBytes = sodium.crypto_box_seal(secretBytes, publicKeyBytes);

  return sodium.to_base64(encryptedBytes, sodium.base64_variants.ORIGINAL);
}

/**
 * Creates or ensures a GitHub environment exists
 * @param client - Octokit instance
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param environmentName - Name of the environment (e.g., dev, stage, prod)
 */
export async function ensureEnvironmentExists(
  client: Octokit,
  owner: string,
  repo: string,
  environmentName: string
): Promise<void> {
  try {
    // PUT request creates or updates the environment
    await client.request(
      'PUT /repos/{owner}/{repo}/environments/{environment_name}',
      {
        owner,
        repo,
        environment_name: environmentName,
      }
    );
  } catch (error) {
    if (error instanceof Error && 'status' in error && error.status === 401) {
      throw new Error(
        'GitHub authentication failed. Ensure your token has the "repo" scope for environment access.'
      );
    }
    throw error;
  }
}

/**
 * Fetches the environment's public key for encrypting secrets
 * @param client - Octokit instance
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param environmentName - Name of the environment
 * @returns Public key ID and base64-encoded key
 */
export async function getEnvironmentPublicKey(
  client: Octokit,
  owner: string,
  repo: string,
  environmentName: string
): Promise<PublicKey> {
  try {
    const response = await client.request(
      'GET /repos/{owner}/{repo}/environments/{environment_name}/secrets/public-key',
      {
        owner,
        repo,
        environment_name: environmentName,
      }
    );

    return {
      keyId: response.data.key_id,
      key: response.data.key,
    };
  } catch (error) {
    if (error instanceof Error && 'status' in error && error.status === 401) {
      throw new Error(
        'GitHub authentication failed. Ensure your token has the "repo" scope for environment secrets access.'
      );
    }
    throw error;
  }
}

/**
 * Sets (creates or updates) an environment secret
 * @param client - Octokit instance
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param environmentName - Name of the environment
 * @param secretName - Name of the secret (e.g., AWS_ACCESS_KEY_ID)
 * @param secretValue - Plain text secret value
 */
export async function setEnvironmentSecret(
  client: Octokit,
  owner: string,
  repo: string,
  environmentName: string,
  secretName: string,
  secretValue: string
): Promise<void> {
  try {
    // Get the environment's public key
    const publicKey = await getEnvironmentPublicKey(
      client,
      owner,
      repo,
      environmentName
    );

    // Encrypt the secret value
    const encryptedValue = await encryptSecret(publicKey.key, secretValue);

    // Set the environment secret
    await client.request(
      'PUT /repos/{owner}/{repo}/environments/{environment_name}/secrets/{secret_name}',
      {
        owner,
        repo,
        environment_name: environmentName,
        secret_name: secretName,
        encrypted_value: encryptedValue,
        key_id: publicKey.keyId,
      }
    );
  } catch (error) {
    if (error instanceof Error && 'status' in error && error.status === 401) {
      throw new Error(
        'GitHub authentication failed. Ensure your token has the "repo" scope for environment secrets access.'
      );
    }
    throw error;
  }
}

/**
 * Sets (creates or updates) a repository secret
 * @param client - Octokit instance
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param secretName - Name of the secret (e.g., AWS_ACCESS_KEY_ID_DEV)
 * @param secretValue - Plain text secret value
 */
export async function setRepositorySecret(
  client: Octokit,
  owner: string,
  repo: string,
  secretName: string,
  secretValue: string
): Promise<void> {
  try {
    // Get the repository's public key
    const publicKey = await getRepositoryPublicKey(client, owner, repo);

    // Encrypt the secret value
    const encryptedValue = await encryptSecret(publicKey.key, secretValue);

    // Set the secret
    await client.actions.createOrUpdateRepoSecret({
      owner,
      repo,
      secret_name: secretName,
      encrypted_value: encryptedValue,
      key_id: publicKey.keyId,
    });
  } catch (error) {
    if (error instanceof Error && 'status' in error && error.status === 401) {
      throw new Error(
        'GitHub authentication failed. Ensure your token has the "repo" scope for repository secrets access.'
      );
    }
    throw error;
  }
}

/**
 * Sets AWS credentials as environment secrets for a specific GitHub environment
 *
 * Creates the GitHub environment if it doesn't exist, then sets AWS_ACCESS_KEY_ID
 * and AWS_SECRET_ACCESS_KEY as secrets within that environment.
 *
 * @param client - Octokit instance
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param environment - Environment name (e.g., dev, stage, prod)
 * @param accessKeyId - AWS Access Key ID
 * @param secretAccessKey - AWS Secret Access Key
 */
export async function setEnvironmentCredentials(
  client: Octokit,
  owner: string,
  repo: string,
  environment: string,
  accessKeyId: string,
  secretAccessKey: string
): Promise<void> {
  // Ensure the GitHub environment exists
  console.log(pc.dim(`  Creating/verifying "${environment}" environment...`));
  await ensureEnvironmentExists(client, owner, repo, environment);

  // Set AWS credentials as environment secrets (same names in each environment)
  console.log(pc.dim(`  Setting AWS_ACCESS_KEY_ID in "${environment}" environment...`));
  await setEnvironmentSecret(
    client,
    owner,
    repo,
    environment,
    'AWS_ACCESS_KEY_ID',
    accessKeyId
  );

  console.log(pc.dim(`  Setting AWS_SECRET_ACCESS_KEY in "${environment}" environment...`));
  await setEnvironmentSecret(
    client,
    owner,
    repo,
    environment,
    'AWS_SECRET_ACCESS_KEY',
    secretAccessKey
  );

  console.log(pc.green(`  Credentials set for "${environment}" environment`));
}

/**
 * Parsed GitHub repository URL
 */
export interface GitHubRepoInfo {
  owner: string;
  repo: string;
}

/**
 * Parses a GitHub repository URL to extract owner and repo
 * @param url - GitHub repository URL in various formats
 * @returns Parsed owner and repo
 * @throws Error if URL format is not recognized
 *
 * Supported formats:
 * - https://github.com/owner/repo
 * - https://github.com/owner/repo.git
 * - git@github.com:owner/repo.git
 * - git@github.com:owner/repo
 * - owner/repo
 */
export function parseGitHubUrl(url: string): GitHubRepoInfo {
  // Remove trailing slashes and .git suffix
  let cleanUrl = url.trim().replace(/\/$/, '').replace(/\.git$/, '');

  // Format: https://github.com/owner/repo
  const httpsMatch = cleanUrl.match(/^https?:\/\/github\.com\/([^/]+)\/([^/]+)$/);
  if (httpsMatch) {
    return {
      owner: httpsMatch[1],
      repo: httpsMatch[2],
    };
  }

  // Format: git@github.com:owner/repo
  const sshMatch = cleanUrl.match(/^git@github\.com:([^/]+)\/([^/]+)$/);
  if (sshMatch) {
    return {
      owner: sshMatch[1],
      repo: sshMatch[2],
    };
  }

  // Format: owner/repo
  const shortMatch = cleanUrl.match(/^([^/]+)\/([^/]+)$/);
  if (shortMatch) {
    return {
      owner: shortMatch[1],
      repo: shortMatch[2],
    };
  }

  throw new Error(
    `Unable to parse GitHub URL: ${url}. ` +
      'Expected formats: https://github.com/owner/repo, git@github.com:owner/repo, or owner/repo'
  );
}
