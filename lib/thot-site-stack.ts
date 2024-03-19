import { CfnOutput, RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib';
import {
  Certificate,
  CertificateValidation,
} from 'aws-cdk-lib/aws-certificatemanager';
import {
  CloudFrontAllowedMethods,
  CloudFrontWebDistribution,
  OriginAccessIdentity,
  SecurityPolicyProtocol,
  SSLMethod,
  ViewerCertificate,
} from 'aws-cdk-lib/aws-cloudfront';
import { CanonicalUserPrincipal, PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { BucketDeployment, Source } from 'aws-cdk-lib/aws-s3-deployment';
import { Construct } from 'constructs';
import {
  Code,
  Function,
  FunctionUrlAuthType,
  Runtime,
} from 'aws-cdk-lib/aws-lambda';
import path = require('path');

/**
 * Setup stolen from: https://dev.to/twilsoft/deploying-a-static-website-to-aws-with-an-external-domain-using-the-cdk-188d
 */
export class ThotSiteStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const domainName = 'thot-site.com';
    const bucket = new Bucket(this, 'ThotAssetsBucket', {
      bucketName: domainName,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      websiteIndexDocument: 'index.html',
      publicReadAccess: true,
      blockPublicAccess: {
        blockPublicAcls: false,
        blockPublicPolicy: false,
        ignorePublicAcls: false,
        restrictPublicBuckets: false,
      },
    });

    const certificate = new Certificate(this, 'Certificate', {
      domainName,
      validation: CertificateValidation.fromDns(),
    });

    const originAccessIdentity = new OriginAccessIdentity(
      this,
      'OriginAccessIdentity',
      {
        comment: `Cloudfront OAI for ${domainName}`,
      },
    );

    bucket.addToResourcePolicy(
      new PolicyStatement({
        actions: ['s3:GetObject'],
        resources: [bucket.arnForObjects('*')],
        principals: [
          new CanonicalUserPrincipal(
            originAccessIdentity.cloudFrontOriginAccessIdentityS3CanonicalUserId,
          ),
        ],
      }),
    );

    const viewerCertificate = ViewerCertificate.fromAcmCertificate(
      certificate,
      {
        sslMethod: SSLMethod.SNI,
        securityPolicy: SecurityPolicyProtocol.TLS_V1_1_2016,
        aliases: [domainName],
      },
    );

    // Follow https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/routing-to-cloudfront-distribution.html
    // after deploying to route domain traffic to the cloudfront distro
    const distribution = new CloudFrontWebDistribution(
      this,
      'SiteDistribution',
      {
        viewerCertificate,
        originConfigs: [
          {
            s3OriginSource: {
              s3BucketSource: bucket,
              originAccessIdentity,
            },
            behaviors: [
              {
                isDefaultBehavior: true,
                compress: true,
                allowedMethods: CloudFrontAllowedMethods.GET_HEAD_OPTIONS,
              },
            ],
          },
        ],
      },
    );

    new BucketDeployment(this, 'Website Deployment', {
      sources: [Source.asset('./public/')],
      destinationBucket: bucket,
      distribution,
      distributionPaths: ['/*'],
    });

    const handler = new Function(this, 'MyFunction', {
      code: Code.fromAsset(
        path.join(
          __dirname,
          '..',
          'lambda/leader-lambda/target/lambda/leader-lambda',
        ),
      ),
      runtime: Runtime.PROVIDED_AL2,
      handler: 'does_not_matter',
      functionName: 'rust-based-aws-lambda-example',
    });

    const fnUrl = handler.addFunctionUrl({
      authType: FunctionUrlAuthType.NONE,
    });

    new CfnOutput(this, 'TheUrl', {
      // The .url attributes will return the unique Function URL
      value: fnUrl.url,
    });
  }
}
