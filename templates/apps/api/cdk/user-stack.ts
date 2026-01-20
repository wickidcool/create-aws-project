import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambdaNodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

/**
 * Lambda configuration from YAML
 */
export interface LambdaConfig {
  name: string;
  source: string;
  handler: string;
  method: string;
  path: string;
  description?: string;
  memorySize?: number;
  timeout?: number;
  environment?: Record<string, string>;
}

/**
 * YAML configuration structure
 */
interface LambdasYaml {
  lambdas: {
    'user-lambdas'?: LambdaConfig[];
    [key: string]: LambdaConfig[] | undefined;
  };
}

export interface UserStackProps extends cdk.StackProps {
  /**
   * Environment name (e.g., dev, staging, prod)
   */
  environmentName: string;

  /**
   * API Gateway to add Lambda integrations to
   */
  api: apigateway.RestApi;

  /**
   * Path to the lambdas.yml configuration file
   * Defaults to './lambdas.yml' relative to the project root
   */
  configPath?: string;
}

/**
 * User Stack for {{PROJECT_NAME_TITLE}}
 *
 * Creates Lambda functions and API Gateway integrations based on
 * configuration defined in lambdas.yml
 */
export class UserStack extends cdk.Stack {
  public readonly functions: Map<string, lambda.Function>;
  private readonly api: apigateway.RestApi;
  private readonly environmentName: string;

  constructor(scope: Construct, id: string, props: UserStackProps) {
    super(scope, id, props);

    this.api = props.api;
    this.environmentName = props.environmentName;
    this.functions = new Map();

    // Read Lambda configurations from YAML file
    const configPath = props.configPath || path.join(__dirname, '../lambdas.yml');
    const lambdaConfigs = this.loadLambdaConfigs(configPath);

    // Create Lambda functions and API Gateway integrations
    lambdaConfigs.forEach(config => {
      this.createLambdaFunction(config);
    });

    // Output Lambda function ARNs
    this.functions.forEach((func, name) => {
      new cdk.CfnOutput(this, `${name}Arn`, {
        value: func.functionArn,
        description: `ARN for ${name} Lambda function`,
        exportName: `${this.environmentName}-${name}-arn`,
      });
    });
  }

  /**
   * Load Lambda configurations from YAML file
   */
  private loadLambdaConfigs(configPath: string): LambdaConfig[] {
    try {
      const fileContents = fs.readFileSync(configPath, 'utf8');
      const config = yaml.load(fileContents) as LambdasYaml;

      if (!config || !config.lambdas) {
        throw new Error('Invalid YAML structure: expected "lambdas" object');
      }

      // Load user-lambdas specifically for this stack
      const userLambdas = config.lambdas['user-lambdas'];

      if (!userLambdas || !Array.isArray(userLambdas)) {
        throw new Error('Invalid YAML structure: expected "lambdas.user-lambdas" array');
      }

      console.log(`Loaded ${userLambdas.length} user Lambda configurations from ${configPath}`);
      return userLambdas;
    } catch (error) {
      throw new Error(`Failed to load Lambda configurations from ${configPath}: ${error}`);
    }
  }

  /**
   * Create a Lambda function and API Gateway integration from configuration
   */
  private createLambdaFunction(config: LambdaConfig): void {
    const { name, source, handler, method, path: apiPath, description, memorySize, timeout, environment } = config;

    // Validate configuration
    if (!name || !source || !handler || !method || !apiPath) {
      throw new Error(`Invalid Lambda configuration: missing required fields for ${name}`);
    }

    // Resolve the source file path relative to the API app directory
    // __dirname is apps/api/cdk, so ../ gets us to apps/api
    const sourcePath = path.join(__dirname, '../', source);

    // Verify source file exists
    if (!fs.existsSync(sourcePath)) {
      throw new Error(`Source file not found: ${sourcePath} for Lambda ${name}`);
    }

    // Create Lambda execution role with CloudWatch Logs permissions
    const role = new iam.Role(this, `${name}Role`, {
      roleName: `${this.environmentName}-${name}-role`,
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
      ],
    });

    // Create Lambda function using NodejsFunction for automatic TypeScript bundling
    const lambdaFunction = new lambdaNodejs.NodejsFunction(this, `${name}Function`, {
      functionName: `${this.environmentName}-${name}`,
      entry: sourcePath,
      handler: handler,
      runtime: lambda.Runtime.NODEJS_20_X,
      role,
      memorySize: memorySize || 256,
      timeout: cdk.Duration.seconds(timeout || 30),
      environment: {
        NODE_ENV: this.environmentName,
        ...environment,
      },
      description: description || `${name} Lambda function`,
      tracing: lambda.Tracing.ACTIVE, // Enable X-Ray tracing
      bundling: {
        minify: true,
        sourceMap: true,
        target: 'es2020',
        externalModules: [],
        format: lambdaNodejs.OutputFormat.CJS,
        tsconfig: path.join(__dirname, '../tsconfig.app.json'),
      },
    });

    // Store function reference
    this.functions.set(name, lambdaFunction);

    // Create API Gateway integration
    this.createApiIntegration(lambdaFunction, method, apiPath, name);

    console.log(`Created Lambda function: ${name} from ${source} (${method} ${apiPath})`);
  }

  /**
   * Create API Gateway integration for a Lambda function
   */
  private createApiIntegration(
    lambdaFunction: lambda.Function,
    method: string,
    apiPath: string,
    name: string
  ): void {
    // Parse the API path to create/get resources
    const pathParts = apiPath.split('/').filter(part => part.length > 0);
    let currentResource: apigateway.IResource = this.api.root;

    // Create nested resources as needed
    for (const part of pathParts) {
      const existingResource = currentResource.getResource(part);
      if (existingResource) {
        currentResource = existingResource;
      } else {
        currentResource = currentResource.addResource(part);
      }
    }

    // Create Lambda integration
    const integration = new apigateway.LambdaIntegration(lambdaFunction, {
      proxy: true,
      allowTestInvoke: true,
      integrationResponses: [
        {
          statusCode: '200',
        },
      ],
    });

    // Add method to resource
    // Note: CORS OPTIONS methods are automatically added by the API Gateway's
    // defaultCorsPreflightOptions configuration in StaticStack
    const apiMethod = currentResource.addMethod(method.toUpperCase(), integration, {
      methodResponses: [
        {
          statusCode: '200',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': true,
            'method.response.header.Access-Control-Allow-Headers': true,
            'method.response.header.Access-Control-Allow-Methods': true,
          },
        },
        {
          statusCode: '400',
        },
        {
          statusCode: '404',
        },
        {
          statusCode: '500',
        },
      ],
    });

    console.log(`Created API integration: ${method} ${apiPath} -> ${name}`);
  }

  /**
   * Get a Lambda function by name
   */
  public getFunction(name: string): lambda.Function | undefined {
    return this.functions.get(name);
  }

  /**
   * Get all Lambda functions
   */
  public getAllFunctions(): lambda.Function[] {
    return Array.from(this.functions.values());
  }
}
