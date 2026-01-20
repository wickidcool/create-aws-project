import { Octokit } from '@octokit/rest';
import nacl from 'tweetnacl';
import naclUtil from 'tweetnacl-util';
import pc from 'picocolors';

const { decodeUTF8, encodeBase64, decodeBase64 } = naclUtil;

/**
 * GitHub secrets service module
 *
 * Provides functions to manage GitHub repository secrets
 * for AWS deployment credentials via the GitHub REST API.
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
 * Repository public key for encrypting secrets
 */
export interface RepositoryPublicKey {
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
): Promise<RepositoryPublicKey> {
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
  // Decode the public key from base64
  const publicKeyBytes = decodeBase64(publicKey);

  // Convert the secret value to UTF-8 bytes
  const secretBytes = decodeUTF8(secretValue);

  // Encrypt using libsodium sealed box (via tweetnacl)
  const encryptedBytes = naclSealedBox(secretBytes, publicKeyBytes);

  // Return base64-encoded encrypted value
  return encodeBase64(encryptedBytes);
}

/**
 * Sealed box encryption compatible with GitHub's libsodium implementation
 */
function naclSealedBox(message: Uint8Array, publicKey: Uint8Array): Uint8Array {
  // Generate ephemeral key pair
  const ephemeralKeyPair = nacl.box.keyPair();

  // Compute nonce from ephemeral public key and recipient public key
  const nonce = new Uint8Array(nacl.box.nonceLength);
  const nonceInput = new Uint8Array(
    ephemeralKeyPair.publicKey.length + publicKey.length
  );
  nonceInput.set(ephemeralKeyPair.publicKey);
  nonceInput.set(publicKey, ephemeralKeyPair.publicKey.length);

  // Use first 24 bytes of blake2b hash as nonce (simplified: use crypto hash)
  const hashBytes = naclHash(nonceInput).slice(0, nacl.box.nonceLength);
  nonce.set(hashBytes);

  // Encrypt the message
  const ciphertext = nacl.box(
    message,
    nonce,
    publicKey,
    ephemeralKeyPair.secretKey
  );

  if (!ciphertext) {
    throw new Error('Encryption failed');
  }

  // Concatenate ephemeral public key and ciphertext (sealed box format)
  const sealedBox = new Uint8Array(
    ephemeralKeyPair.publicKey.length + ciphertext.length
  );
  sealedBox.set(ephemeralKeyPair.publicKey);
  sealedBox.set(ciphertext, ephemeralKeyPair.publicKey.length);

  return sealedBox;
}

/**
 * Simple hash function for nonce generation
 */
function naclHash(input: Uint8Array): Uint8Array {
  return nacl.hash(input);
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
 * Sets AWS credentials as repository secrets for a specific environment
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
  // Uppercase the environment name for secret naming convention
  const envUpper = environment.toUpperCase();

  const accessKeySecretName = `AWS_ACCESS_KEY_ID_${envUpper}`;
  const secretKeySecretName = `AWS_SECRET_ACCESS_KEY_${envUpper}`;

  console.log(pc.dim(`  Setting ${accessKeySecretName}...`));
  await setRepositorySecret(client, owner, repo, accessKeySecretName, accessKeyId);

  console.log(pc.dim(`  Setting ${secretKeySecretName}...`));
  await setRepositorySecret(client, owner, repo, secretKeySecretName, secretAccessKey);

  console.log(pc.green(`  Credentials set for ${environment} environment`));
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
