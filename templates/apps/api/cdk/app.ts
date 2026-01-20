#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { StaticStack } from './static-stack';
import { UserStack } from './user-stack';
import { DeploymentUserStack } from './deployment-user-stack';
// {{#if AUTH_COGNITO}}
import { CognitoStack } from './auth/cognito-stack';
// {{/if AUTH_COGNITO}}

const appName = '{{PROJECT_NAME_PASCAL}}';

// {{#if ORG_ENABLED}}
// Multi-account configuration from AWS Organizations
const accountIds: Record<string, string> = {
  dev: '{{DEV_ACCOUNT_ID}}',
  stage: '{{STAGE_ACCOUNT_ID}}',
  prod: '{{PROD_ACCOUNT_ID}}',
};
// {{/if ORG_ENABLED}}

/**
 * AWS CDK App for {{PROJECT_NAME_TITLE}}
 *
 * This app creates the infrastructure for the project including:
 * - S3 bucket for static web content
 * - API Gateway for Lambda functions
 * - CloudFront distribution with both S3 and API Gateway origins
 * - Lambda functions with API Gateway integrations (from lambdas.yml)
 * - GitHub deployment IAM users (optional, via --context deployUser=true)
 *
 * Deploy commands:
 *   npx cdk deploy --all                              # Deploy all stacks
 *   npx cdk deploy {{PROJECT_NAME_PASCAL}}-DeployUser-dev      # Deploy just the deploy user
 */
const app = new cdk.App();

// Get environment from context or default to 'dev'
const environmentName = app.node.tryGetContext('environment') || 'dev';

// Get AWS account and region from environment or use defaults
const env = {
  // {{#if ORG_ENABLED}}
  account: accountIds[environmentName] || process.env.CDK_DEFAULT_ACCOUNT,
  // {{/if ORG_ENABLED}}
  // {{#unless ORG_ENABLED}}
  account: process.env.CDK_DEFAULT_ACCOUNT || process.env.AWS_ACCOUNT_ID,
  // {{/unless ORG_ENABLED}}
  region: process.env.CDK_DEFAULT_REGION || process.env.AWS_REGION || '{{AWS_REGION}}',
};

// Common tags for all resources
const tags = {
  Project: '{{PROJECT_NAME_TITLE}}',
  Environment: environmentName,
  ManagedBy: 'CDK',
};

// Create the static stack (CloudFront, S3, API Gateway)
const staticStack = new StaticStack(app, `${appName}-Static-${environmentName}`, {
  env,
  environmentName,
  description: `{{PROJECT_NAME_TITLE}} static infrastructure for ${environmentName} environment`,
  tags,
});

// Create the user stack (Lambda functions from lambdas.yml)
// Note: UserStack automatically depends on StaticStack because it uses staticStack.api
new UserStack(app, `${appName}-Users-${environmentName}`, {
  env,
  environmentName,
  api: staticStack.api,
  description: `{{PROJECT_NAME_TITLE}} user Lambda functions for ${environmentName} environment`,
  tags,
});

// Create the deployment user stack (GitHub Actions IAM user)
new DeploymentUserStack(app, `${appName}-DeployUser-${environmentName}`, {
  env,
  environmentName,
  description: `GitHub Actions deployment user for ${environmentName} environment`,
  tags,
});

// {{#if AUTH_COGNITO}}
// Create the Cognito authentication stack
new CognitoStack(app, `${appName}-Cognito-${environmentName}`, {
  stage: environmentName,
  env,
  description: `{{PROJECT_NAME_TITLE}} Cognito authentication for ${environmentName} environment`,
  tags,
});
// {{/if AUTH_COGNITO}}
