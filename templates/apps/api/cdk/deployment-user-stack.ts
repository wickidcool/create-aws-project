import { Stack, StackProps, CfnOutput, SecretValue } from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';

export interface DeploymentUserStackProps extends StackProps {
  environmentName: string;
}

/**
 * Stack that creates IAM users for GitHub Actions deployments.
 *
 * This stack should be deployed to each target account (dev, stage, prod)
 * to create the necessary IAM user with permissions for CDK deployments.
 *
 * The access keys are stored in AWS Secrets Manager for secure retrieval.
 *
 * This uses least-privilege permissions based on what CDK actually needs.
 */
export class DeploymentUserStack extends Stack {
  constructor(scope: Construct, id: string, props: DeploymentUserStackProps) {
    super(scope, id, props);

    const { environmentName } = props;
    const accountId = this.account;
    const region = this.region;

    // Create IAM user for GitHub Actions deployments
    const deployUser = new iam.User(this, 'GitHubDeployUser', {
      userName: `github-deploy-${environmentName}`,
    });

    // Policy for CDK deployments - least privilege permissions
    const cdkDeployPolicy = new iam.ManagedPolicy(this, 'CdkDeployPolicy', {
      managedPolicyName: `github-deploy-policy-${environmentName}`,
      description: `Policy for GitHub Actions CDK deployments in ${environmentName}`,
      statements: [
        // CloudFormation - specific actions only
        new iam.PolicyStatement({
          sid: 'CloudFormationPermissions',
          effect: iam.Effect.ALLOW,
          actions: [
            'cloudformation:CreateChangeSet',
            'cloudformation:DeleteChangeSet',
            'cloudformation:DescribeChangeSet',
            'cloudformation:DescribeStacks',
            'cloudformation:ExecuteChangeSet',
            'cloudformation:CreateStack',
            'cloudformation:UpdateStack',
            'cloudformation:RollbackStack',
            'cloudformation:ContinueUpdateRollback',
            'cloudformation:DescribeStackEvents',
            'cloudformation:GetTemplate',
            'cloudformation:DeleteStack',
            'cloudformation:UpdateTerminationProtection',
            'cloudformation:GetTemplateSummary',
            'cloudformation:CreateStackRefactor',
            'cloudformation:DescribeStackRefactor',
            'cloudformation:ExecuteStackRefactor',
            'cloudformation:ListStackRefactorActions',
            'cloudformation:ListStackRefactors',
            'cloudformation:ListStacks',
          ],
          resources: ['*'],
        }),
        // CloudFront - limited to listing and invalidation
        new iam.PolicyStatement({
          sid: 'CloudFrontPermissions',
          effect: iam.Effect.ALLOW,
          actions: [
            'cloudfront:ListDistributions',
            'cloudfront:CreateInvalidation',
          ],
          resources: ['*'],
        }),
        // SSM - read CDK bootstrap version parameter
        new iam.PolicyStatement({
          sid: 'ReadVersion',
          effect: iam.Effect.ALLOW,
          actions: [
            'ssm:GetParameter',
            'ssm:GetParameters',
          ],
          resources: [
            `arn:aws:ssm:${region}:${accountId}:parameter/cdk-bootstrap/*`,
          ],
        }),
        // S3 - CDK assets and web deployment (scoped to account)
        new iam.PolicyStatement({
          sid: 'S3Permissions',
          effect: iam.Effect.ALLOW,
          actions: [
            's3:GetObject*',
            's3:GetBucket*',
            's3:List*',
            's3:Abort*',
            's3:DeleteObject*',
            's3:PutObject*',
            's3:ListAllMyBuckets',
          ],
          resources: ['*'],
          conditions: {
            StringEquals: {
              's3:ResourceAccount': accountId,
            },
          },
        }),
        // KMS - for S3 encryption
        new iam.PolicyStatement({
          sid: 'KMSPermissions',
          effect: iam.Effect.ALLOW,
          actions: [
            'kms:Decrypt',
            'kms:DescribeKey',
            'kms:Encrypt',
            'kms:ReEncrypt*',
            'kms:GenerateDataKey*',
          ],
          resources: ['*'],
          conditions: {
            StringEquals: {
              'kms:ViaService': `s3.${region}.amazonaws.com`,
            },
          },
        }),
        // IAM PassRole - for CloudFormation execution role
        new iam.PolicyStatement({
          sid: 'IAMPassRole',
          effect: iam.Effect.ALLOW,
          actions: ['iam:PassRole'],
          resources: [
            `arn:aws:iam::${accountId}:role/cdk-*-cfn-exec-role-${accountId}-${region}`,
          ],
        }),
        // STS - for CDK operations
        new iam.PolicyStatement({
          sid: 'STSPermissions',
          effect: iam.Effect.ALLOW,
          actions: ['sts:GetCallerIdentity'],
          resources: ['*'],
        }),
      ],
    });

    deployUser.addManagedPolicy(cdkDeployPolicy);

    // Create access key for the user
    const accessKey = new iam.AccessKey(this, 'GitHubDeployAccessKey', {
      user: deployUser,
    });

    // Store access keys in Secrets Manager
    const accessKeySecret = new secretsmanager.Secret(this, 'GitHubDeployCredentials', {
      secretName: `github-deploy-credentials-${environmentName}`,
      description: `GitHub Actions deployment credentials for ${environmentName}`,
      secretObjectValue: {
        accessKeyId: SecretValue.unsafePlainText(accessKey.accessKeyId),
        secretAccessKey: accessKey.secretAccessKey,
      },
    });

    // Outputs
    new CfnOutput(this, 'DeployUserName', {
      value: deployUser.userName,
      description: `GitHub deploy user name for ${environmentName}`,
      exportName: `GitHubDeployUserName-${environmentName}`,
    });

    new CfnOutput(this, 'DeployUserArn', {
      value: deployUser.userArn,
      description: `GitHub deploy user ARN for ${environmentName}`,
      exportName: `GitHubDeployUserArn-${environmentName}`,
    });

    new CfnOutput(this, 'CredentialsSecretArn', {
      value: accessKeySecret.secretArn,
      description: `Secret ARN containing deploy credentials for ${environmentName}`,
      exportName: `GitHubDeployCredentialsArn-${environmentName}`,
    });

    new CfnOutput(this, 'AccessKeyId', {
      value: accessKey.accessKeyId,
      description: `Access Key ID for ${environmentName} (use Secrets Manager for secret key)`,
      exportName: `GitHubDeployAccessKeyId-${environmentName}`,
    });
  }
}
