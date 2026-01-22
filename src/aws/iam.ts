import {
  IAMClient,
  CreateUserCommand,
  GetUserCommand,
  CreatePolicyCommand,
  GetPolicyCommand,
  AttachUserPolicyCommand,
  CreateAccessKeyCommand,
  NoSuchEntityException,
} from '@aws-sdk/client-iam';
import { fromTemporaryCredentials } from '@aws-sdk/credential-providers';
import pc from 'picocolors';

/**
 * AWS IAM service module
 *
 * Provides functions to create IAM deployment users with least-privilege
 * policies for CDK deployment to specific environment accounts.
 */

/**
 * Creates a configured IAMClient
 * @param region - AWS region (defaults to us-east-1)
 * @returns Configured IAMClient instance
 */
export function createIAMClient(region: string = 'us-east-1'): IAMClient {
  return new IAMClient({ region });
}

/**
 * Creates an IAMClient configured to access a target account via cross-account role assumption
 * @param region - AWS region
 * @param targetAccountId - Target AWS account ID to access
 * @returns IAMClient configured with cross-account credentials
 */
export function createCrossAccountIAMClient(
  region: string,
  targetAccountId: string
): IAMClient {
  const roleArn = `arn:aws:iam::${targetAccountId}:role/OrganizationAccountAccessRole`;
  return new IAMClient({
    region,
    credentials: fromTemporaryCredentials({
      params: {
        RoleArn: roleArn,
        RoleSessionName: `create-aws-project-${Date.now()}`,
        DurationSeconds: 900,
      },
    }),
  });
}

/**
 * Checks if an IAM user exists
 * @param client - IAMClient instance
 * @param userName - User name to check
 * @returns true if user exists, false otherwise
 */
async function userExists(client: IAMClient, userName: string): Promise<boolean> {
  try {
    const command = new GetUserCommand({ UserName: userName });
    await client.send(command);
    return true;
  } catch (error) {
    if (error instanceof NoSuchEntityException) {
      return false;
    }
    throw error;
  }
}

/**
 * Checks if an IAM policy exists
 * @param client - IAMClient instance
 * @param policyArn - Policy ARN to check
 * @returns true if policy exists, false otherwise
 */
async function policyExists(client: IAMClient, policyArn: string): Promise<boolean> {
  try {
    const command = new GetPolicyCommand({ PolicyArn: policyArn });
    await client.send(command);
    return true;
  } catch (error) {
    if (error instanceof NoSuchEntityException) {
      return false;
    }
    throw error;
  }
}

/**
 * Creates an IAM deployment user with path /deployment/
 * @param client - IAMClient instance
 * @param userName - User name (format: {project}-{environment}-deploy)
 * @throws Error if user already exists or creation fails
 */
export async function createDeploymentUser(
  client: IAMClient,
  userName: string
): Promise<void> {
  // Check if user already exists
  if (await userExists(client, userName)) {
    throw new Error(
      `IAM user "${userName}" already exists. Delete manually before retrying.`
    );
  }

  const command = new CreateUserCommand({
    UserName: userName,
    Path: '/deployment/',
    Tags: [
      { Key: 'Purpose', Value: 'CDK Deployment' },
      { Key: 'ManagedBy', Value: 'create-aws-starter-kit' },
    ],
  });

  await client.send(command);
  console.log(pc.green(`  Created IAM user: ${userName}`));
}

/**
 * CDK deployment policy document with minimal permissions
 * @param accountId - AWS account ID for resource ARNs
 * @returns Policy document JSON string
 */
function getCDKDeploymentPolicyDocument(accountId: string): string {
  const policy = {
    Version: '2012-10-17',
    Statement: [
      {
        Sid: 'CloudFormationFullAccess',
        Effect: 'Allow',
        Action: 'cloudformation:*',
        Resource: '*',
      },
      {
        Sid: 'CDKBootstrapBucket',
        Effect: 'Allow',
        Action: 's3:*',
        Resource: [
          `arn:aws:s3:::cdk-*-assets-${accountId}-*`,
          `arn:aws:s3:::cdk-*-assets-${accountId}-*/*`,
        ],
      },
      {
        Sid: 'CDKRoleAssumption',
        Effect: 'Allow',
        Action: [
          'iam:PassRole',
          'sts:AssumeRole',
        ],
        Resource: [
          `arn:aws:iam::${accountId}:role/cdk-*`,
        ],
      },
      {
        Sid: 'SSMContextLookup',
        Effect: 'Allow',
        Action: 'ssm:GetParameter',
        Resource: `arn:aws:ssm:*:${accountId}:parameter/cdk-bootstrap/*`,
      },
      {
        Sid: 'LambdaDeployment',
        Effect: 'Allow',
        Action: 'lambda:*',
        Resource: '*',
      },
      {
        Sid: 'APIGatewayDeployment',
        Effect: 'Allow',
        Action: 'apigateway:*',
        Resource: '*',
      },
      {
        Sid: 'DynamoDBDeployment',
        Effect: 'Allow',
        Action: 'dynamodb:*',
        Resource: '*',
      },
      {
        Sid: 'CloudFrontDeployment',
        Effect: 'Allow',
        Action: 'cloudfront:*',
        Resource: '*',
      },
      {
        Sid: 'CognitoDeployment',
        Effect: 'Allow',
        Action: 'cognito-idp:*',
        Resource: '*',
      },
      {
        Sid: 'ECRAccess',
        Effect: 'Allow',
        Action: [
          'ecr:GetAuthorizationToken',
          'ecr:BatchCheckLayerAvailability',
          'ecr:GetDownloadUrlForLayer',
          'ecr:BatchGetImage',
        ],
        Resource: '*',
      },
    ],
  };

  return JSON.stringify(policy);
}

/**
 * Creates a customer managed policy with minimal CDK deployment permissions
 * @param client - IAMClient instance
 * @param policyName - Policy name (format: {project}-{environment}-cdk-deploy)
 * @param accountId - AWS account ID for resource ARNs
 * @returns Policy ARN
 * @throws Error if policy creation fails (unless policy already exists)
 */
export async function createCDKDeploymentPolicy(
  client: IAMClient,
  policyName: string,
  accountId: string
): Promise<string> {
  // Construct the expected policy ARN
  const expectedPolicyArn = `arn:aws:iam::${accountId}:policy/${policyName}`;

  // Check if policy already exists
  if (await policyExists(client, expectedPolicyArn)) {
    console.log(pc.yellow(`  Policy ${policyName} already exists, reusing`));
    return expectedPolicyArn;
  }

  const command = new CreatePolicyCommand({
    PolicyName: policyName,
    PolicyDocument: getCDKDeploymentPolicyDocument(accountId),
    Description: `CDK deployment policy for ${policyName.replace('-cdk-deploy', '')}`,
    Tags: [
      { Key: 'Purpose', Value: 'CDK Deployment' },
      { Key: 'ManagedBy', Value: 'create-aws-starter-kit' },
    ],
  });

  const response = await client.send(command);

  if (!response.Policy?.Arn) {
    throw new Error('Policy created but no ARN returned');
  }

  console.log(pc.green(`  Created policy: ${policyName}`));
  return response.Policy.Arn;
}

/**
 * Attaches an IAM policy to a user
 * @param client - IAMClient instance
 * @param userName - IAM user name
 * @param policyArn - Policy ARN to attach
 */
export async function attachPolicyToUser(
  client: IAMClient,
  userName: string,
  policyArn: string
): Promise<void> {
  const command = new AttachUserPolicyCommand({
    UserName: userName,
    PolicyArn: policyArn,
  });

  await client.send(command);
  console.log(pc.green(`  Attached policy to user ${userName}`));
}

/**
 * Access key credentials for a deployment user
 */
export interface AccessKeyCredentials {
  accessKeyId: string;
  secretAccessKey: string;
}

/**
 * Creates access key credentials for an IAM user
 * @param client - IAMClient instance
 * @param userName - IAM user name
 * @returns Access key ID and secret access key
 * @note The secret access key is ONLY available at creation time
 */
export async function createAccessKey(
  client: IAMClient,
  userName: string
): Promise<AccessKeyCredentials> {
  const command = new CreateAccessKeyCommand({
    UserName: userName,
  });

  const response = await client.send(command);

  if (!response.AccessKey?.AccessKeyId || !response.AccessKey?.SecretAccessKey) {
    throw new Error('Access key created but credentials not returned');
  }

  console.log(pc.green(`  Created access key for ${userName}`));

  return {
    accessKeyId: response.AccessKey.AccessKeyId,
    secretAccessKey: response.AccessKey.SecretAccessKey,
  };
}

/**
 * Complete deployment user credentials
 */
export interface DeploymentUserCredentials {
  userName: string;
  accessKeyId: string;
  secretAccessKey: string;
}

/**
 * Creates a deployment user with all required resources and returns credentials
 *
 * Orchestrates the full workflow:
 * 1. Create IAM user with path /deployment/
 * 2. Create CDK deployment policy with least-privilege permissions
 * 3. Attach policy to user
 * 4. Create and return access key credentials
 *
 * @param client - IAMClient instance
 * @param projectName - Project name for resource naming
 * @param environment - Environment name (dev, stage, prod)
 * @param accountId - AWS account ID for policy resource ARNs
 * @returns User name and access credentials for GitHub secrets
 */
export async function createDeploymentUserWithCredentials(
  client: IAMClient,
  projectName: string,
  environment: string,
  accountId: string
): Promise<DeploymentUserCredentials> {
  const userName = `${projectName}-${environment}-deploy`;
  const policyName = `${projectName}-${environment}-cdk-deploy`;

  console.log(pc.cyan(`\nCreating deployment user for ${environment}...`));

  // Step 1: Create the deployment user
  await createDeploymentUser(client, userName);

  // Step 2: Create the CDK deployment policy
  const policyArn = await createCDKDeploymentPolicy(client, policyName, accountId);

  // Step 3: Attach policy to user
  await attachPolicyToUser(client, userName, policyArn);

  // Step 4: Create and return access credentials
  const credentials = await createAccessKey(client, userName);

  console.log(pc.green(`\nDeployment user ${userName} ready with credentials`));

  return {
    userName,
    accessKeyId: credentials.accessKeyId,
    secretAccessKey: credentials.secretAccessKey,
  };
}
