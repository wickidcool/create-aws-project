import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as opensearchserverless from 'aws-cdk-lib/aws-opensearchserverless';
import { Construct } from 'constructs';

export interface StaticStackProps extends cdk.StackProps {
  /**
   * Environment name (e.g., dev, staging, prod)
   */
  environmentName: string;
}

/**
 * Static Stack for {{PROJECT_NAME_TITLE}}
 *
 * Creates a CloudFront distribution with:
 * - S3 bucket for static web content (default route)
 * - API Gateway for Lambda API (routes starting with /api)
 */
export class StaticStack extends cdk.Stack {
  public readonly bucket: s3.Bucket;
  public readonly api: apigateway.RestApi;
  public readonly distribution: cloudfront.Distribution;
  public readonly openSearchCollection: opensearchserverless.CfnCollection;

  constructor(scope: Construct, id: string, props: StaticStackProps) {
    super(scope, id, props);

    const { environmentName } = props;

    // Create S3 bucket for static website content
    this.bucket = new s3.Bucket(this, 'WebContentBucket', {
      bucketName: `{{PROJECT_NAME}}-${environmentName}-web-${this.account}`,
      websiteIndexDocument: 'index.html',
      websiteErrorDocument: 'index.html', // For SPA routing
      publicReadAccess: false, // CloudFront will access via OAI
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.DESTROY, // For dev environments
      autoDeleteObjects: true, // For dev environments
      cors: [
        {
          allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.HEAD],
          allowedOrigins: ['*'],
          allowedHeaders: ['*'],
        },
      ],
    });

    // Create API Gateway for Lambda functions
    this.api = new apigateway.RestApi(this, 'ApiGateway', {
      restApiName: `{{PROJECT_NAME}}-${environmentName}-api`,
      description: `{{PROJECT_NAME_TITLE}} API - ${environmentName}`,
      deployOptions: {
        stageName: environmentName,
        throttlingRateLimit: 100,
        throttlingBurstLimit: 200,
        metricsEnabled: true,
        loggingLevel: apigateway.MethodLoggingLevel.INFO,
        dataTraceEnabled: true,
      },
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: [
          'Content-Type',
          'X-Amz-Date',
          'Authorization',
          'X-Api-Key',
          'X-Amz-Security-Token',
        ],
      },
      // Enable request validation
      cloudWatchRole: true,
    });

    // Create a simple health check endpoint at /api/health
    const api = this.api.root.addResource('api');
    const health = api.addResource('health');
    health.addMethod('GET', new apigateway.MockIntegration({
      integrationResponses: [
        {
          statusCode: '200',
          responseTemplates: {
            'application/json': JSON.stringify({
              status: 'healthy',
              timestamp: '$context.requestTime',
              environment: environmentName,
            }),
          },
        },
      ],
      requestTemplates: {
        'application/json': '{"statusCode": 200}',
      },
    }), {
      methodResponses: [{ statusCode: '200' }],
    });


    // Create custom cache policy for API routes
    const apiCachePolicy = new cloudfront.CachePolicy(this, 'ApiCachePolicy', {
      cachePolicyName: `{{PROJECT_NAME}}-${environmentName}-api-cache`,
      comment: 'Cache policy for API Gateway with query strings and headers',
      defaultTtl: cdk.Duration.seconds(0), // No caching for API by default
      minTtl: cdk.Duration.seconds(0),
      maxTtl: cdk.Duration.seconds(1),
      cookieBehavior: cloudfront.CacheCookieBehavior.none(),
      headerBehavior: cloudfront.CacheHeaderBehavior.allowList(
        'Authorization',
        'Content-Type',
        'Accept'
      ),
      queryStringBehavior: cloudfront.CacheQueryStringBehavior.all(),
      enableAcceptEncodingGzip: true,
      enableAcceptEncodingBrotli: true,
    });

    // Create custom origin request policy for API
    const apiOriginRequestPolicy = new cloudfront.OriginRequestPolicy(this, 'ApiOriginRequestPolicy', {
      originRequestPolicyName: `{{PROJECT_NAME}}-${environmentName}-api-origin`,
      comment: 'Origin request policy for API Gateway',
      cookieBehavior: cloudfront.OriginRequestCookieBehavior.none(),
      headerBehavior: cloudfront.OriginRequestHeaderBehavior.allowList(
        'Accept',
        'Accept-Language',
        'Content-Type',
        'Referer',
        'User-Agent'
      ),
      queryStringBehavior: cloudfront.OriginRequestQueryStringBehavior.all(),
    });

    // Create CloudFront function to rewrite /api to the environment stage
    const apiRewriteFunction = new cloudfront.Function(this, 'ApiRewriteFunction', {
      code: cloudfront.FunctionCode.fromInline(`
  function handler(event) {
      var request = event.request;
      var uri = request.uri;

      // Only rewrite if URI starts with /api
      if (uri.indexOf('/api') === 0) {
          request.uri = uri.replace('/api', '/${environmentName}');
      }

      return request;
  }
        `),
      functionName: `${environmentName}-api-rewrite-function`,
      comment: `Rewrites /api requests to /${environmentName} stage for API Gateway`
    });

    // Create CloudFront distribution
    this.distribution = new cloudfront.Distribution(this, 'Distribution', {
      comment: `{{PROJECT_NAME_TITLE}} - ${environmentName}`,
      defaultRootObject: 'index.html',
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100, // North America and Europe
      httpVersion: cloudfront.HttpVersion.HTTP2_AND_3,
      enableIpv6: true,

      // Default behavior: Serve static content from S3
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(this.bucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
        cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD_OPTIONS,
        compress: true,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
      },

      // Additional behavior: Route /api/* to API Gateway
      additionalBehaviors: {
        '/api/*': {
          origin: new origins.RestApiOrigin(this.api),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.HTTPS_ONLY,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
          cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD_OPTIONS,
          compress: true,
          cachePolicy: apiCachePolicy,
          originRequestPolicy: apiOriginRequestPolicy,
          // Add the function association for URL rewriting
          functionAssociations: [{
            function: apiRewriteFunction,
            eventType: cloudfront.FunctionEventType.VIEWER_REQUEST
          }]
        },
      },

      // Error responses for SPA routing
      errorResponses: [
        {
          httpStatus: 403,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
          ttl: cdk.Duration.seconds(300),
        },
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
          ttl: cdk.Duration.seconds(300),
        },
      ],
    });

    // OpenSearch Serverless Collection
    const collectionName = `{{PROJECT_NAME}}-${environmentName}`;

    // Encryption policy (required for all collections)
    const encryptionPolicy = new opensearchserverless.CfnSecurityPolicy(this, 'OpenSearchEncryptionPolicy', {
      name: `${collectionName}-encryption`,
      type: 'encryption',
      policy: JSON.stringify({
        Rules: [
          {
            ResourceType: 'collection',
            Resource: [`collection/${collectionName}`],
          },
        ],
        AWSOwnedKey: true,
      }),
    });

    // Network policy - allows public access (adjust for production)
    const networkPolicy = new opensearchserverless.CfnSecurityPolicy(this, 'OpenSearchNetworkPolicy', {
      name: `${collectionName}-network`,
      type: 'network',
      policy: JSON.stringify([
        {
          Rules: [
            {
              ResourceType: 'collection',
              Resource: [`collection/${collectionName}`],
            },
            {
              ResourceType: 'dashboard',
              Resource: [`collection/${collectionName}`],
            },
          ],
          AllowFromPublic: true,
        },
      ]),
    });

    // Data access policy - grants access to the collection
    const dataAccessPolicy = new opensearchserverless.CfnAccessPolicy(this, 'OpenSearchDataAccessPolicy', {
      name: `${collectionName}-access`,
      type: 'data',
      policy: JSON.stringify([
        {
          Rules: [
            {
              ResourceType: 'collection',
              Resource: [`collection/${collectionName}`],
              Permission: [
                'aoss:CreateCollectionItems',
                'aoss:DeleteCollectionItems',
                'aoss:UpdateCollectionItems',
                'aoss:DescribeCollectionItems',
              ],
            },
            {
              ResourceType: 'index',
              Resource: [`index/${collectionName}/*`],
              Permission: [
                'aoss:CreateIndex',
                'aoss:DeleteIndex',
                'aoss:UpdateIndex',
                'aoss:DescribeIndex',
                'aoss:ReadDocument',
                'aoss:WriteDocument',
              ],
            },
          ],
          Principal: [
            `arn:aws:iam::${this.account}:root`,
          ],
        },
      ]),
    });

    // Create the OpenSearch Serverless collection
    this.openSearchCollection = new opensearchserverless.CfnCollection(this, 'OpenSearchCollection', {
      name: collectionName,
      type: 'SEARCH', // SEARCH, TIMESERIES, or VECTORSEARCH
      description: `OpenSearch Serverless collection for {{PROJECT_NAME_TITLE}} - ${environmentName}`,
    });

    // Ensure policies are created before the collection
    this.openSearchCollection.addDependency(encryptionPolicy);
    this.openSearchCollection.addDependency(networkPolicy);
    this.openSearchCollection.addDependency(dataAccessPolicy);

    // Output important values
    new cdk.CfnOutput(this, 'BucketName', {
      value: this.bucket.bucketName,
      description: 'S3 bucket name for web content',
      exportName: `${environmentName}-web-bucket-name`,
    });

    new cdk.CfnOutput(this, 'BucketArn', {
      value: this.bucket.bucketArn,
      description: 'S3 bucket ARN',
      exportName: `${environmentName}-web-bucket-arn`,
    });

    new cdk.CfnOutput(this, 'ApiUrl', {
      value: this.api.url,
      description: 'API Gateway URL',
      exportName: `${environmentName}-api-url`,
    });

    new cdk.CfnOutput(this, 'ApiId', {
      value: this.api.restApiId,
      description: 'API Gateway ID',
      exportName: `${environmentName}-api-id`,
    });

    new cdk.CfnOutput(this, 'DistributionId', {
      value: this.distribution.distributionId,
      description: 'CloudFront distribution ID',
      exportName: `${environmentName}-distribution-id`,
    });

    new cdk.CfnOutput(this, 'DistributionDomainName', {
      value: this.distribution.distributionDomainName,
      description: 'CloudFront distribution domain name',
      exportName: `${environmentName}-distribution-domain`,
    });

    new cdk.CfnOutput(this, 'WebsiteUrl', {
      value: `https://${this.distribution.distributionDomainName}`,
      description: 'Website URL',
    });

    new cdk.CfnOutput(this, 'ApiUrlViaCdn', {
      value: `https://${this.distribution.distributionDomainName}/api`,
      description: 'API URL via CloudFront',
    });

    new cdk.CfnOutput(this, 'OpenSearchCollectionEndpoint', {
      value: this.openSearchCollection.attrCollectionEndpoint,
      description: 'OpenSearch Serverless collection endpoint',
      exportName: `${environmentName}-opensearch-endpoint`,
    });

    new cdk.CfnOutput(this, 'OpenSearchDashboardEndpoint', {
      value: this.openSearchCollection.attrDashboardEndpoint,
      description: 'OpenSearch Serverless dashboard endpoint',
      exportName: `${environmentName}-opensearch-dashboard`,
    });

    new cdk.CfnOutput(this, 'OpenSearchCollectionArn', {
      value: this.openSearchCollection.attrArn,
      description: 'OpenSearch Serverless collection ARN',
      exportName: `${environmentName}-opensearch-arn`,
    });
  }
}
