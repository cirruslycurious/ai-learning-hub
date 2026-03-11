import * as cdk from "aws-cdk-lib";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as s3deploy from "aws-cdk-lib/aws-s3-deployment";
import { Construct } from "constructs";
import { NagSuppressions } from "cdk-nag";
import * as path from "path";

interface FrontendHostingStackProps extends cdk.StackProps {
  /** API Gateway URL for the backend (injected at build time) */
  apiUrl: string;
}

export class FrontendHostingStack extends cdk.Stack {
  public readonly distribution: cloudfront.Distribution;
  public readonly siteBucket: s3.Bucket;

  constructor(scope: Construct, id: string, props: FrontendHostingStackProps) {
    super(scope, id, props);

    // Access logs bucket for the site bucket
    const accessLogsBucket = new s3.Bucket(this, "SiteAccessLogsBucket", {
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      lifecycleRules: [{ expiration: cdk.Duration.days(30), enabled: true }],
      enforceSSL: true,
    });

    // S3 bucket for static site assets
    this.siteBucket = new s3.Bucket(this, "SiteBucket", {
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      serverAccessLogsBucket: accessLogsBucket,
      serverAccessLogsPrefix: "site-access-logs/",
      enforceSSL: true,
    });

    // Origin Access Control for CloudFront -> S3 (AwsSolutions-CFR7)
    const oac = new cloudfront.S3OriginAccessControl(this, "OAC", {
      signing: cloudfront.Signing.SIGV4_ALWAYS,
    });

    // CloudFront distribution using S3BucketOrigin with OAC
    this.distribution = new cloudfront.Distribution(this, "Distribution", {
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(
          this.siteBucket,
          {
            originAccessControl: oac,
          }
        ),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
      },
      defaultRootObject: "index.html",
      // SPA: route all 404s to index.html for client-side routing
      errorResponses: [
        {
          httpStatus: 403,
          responseHttpStatus: 200,
          responsePagePath: "/index.html",
          ttl: cdk.Duration.minutes(5),
        },
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: "/index.html",
          ttl: cdk.Duration.minutes(5),
        },
      ],
    });

    // Deploy built frontend assets to S3
    new s3deploy.BucketDeployment(this, "DeploySite", {
      sources: [
        s3deploy.Source.asset(
          path.resolve(__dirname, "../../../../../frontend/dist")
        ),
      ],
      destinationBucket: this.siteBucket,
      distribution: this.distribution,
      distributionPaths: ["/*"],
    });

    // CDK Nag suppressions
    NagSuppressions.addResourceSuppressions(
      this.distribution,
      [
        {
          id: "AwsSolutions-CFR1",
          reason: "Geo restrictions not needed for dev environment",
        },
        {
          id: "AwsSolutions-CFR2",
          reason: "WAF not needed for static frontend in dev",
        },
        {
          id: "AwsSolutions-CFR4",
          reason:
            "Using default CloudFront certificate; custom domain + TLS planned for production",
        },
        {
          id: "AwsSolutions-CFR3",
          reason: "CloudFront access logging deferred to production setup",
        },
      ],
      true
    );

    NagSuppressions.addResourceSuppressions(
      accessLogsBucket,
      [
        {
          id: "AwsSolutions-S1",
          reason: "This IS the access log bucket; no recursive logging needed",
        },
      ],
      true
    );

    // Suppress nag for the BucketDeployment custom resource Lambda
    NagSuppressions.addStackSuppressions(this, [
      {
        id: "AwsSolutions-IAM4",
        reason:
          "BucketDeployment custom resource uses CDK-managed IAM policies",
      },
      {
        id: "AwsSolutions-IAM5",
        reason:
          "BucketDeployment custom resource needs wildcard for S3 objects",
      },
      {
        id: "AwsSolutions-L1",
        reason: "BucketDeployment Lambda runtime managed by CDK construct",
      },
    ]);

    // Outputs
    new cdk.CfnOutput(this, "DistributionUrl", {
      value: `https://${this.distribution.distributionDomainName}`,
      description: "CloudFront URL for the frontend",
      exportName: "AiLearningHub-FrontendUrl",
    });

    new cdk.CfnOutput(this, "DistributionId", {
      value: this.distribution.distributionId,
      description: "CloudFront distribution ID",
      exportName: "AiLearningHub-FrontendDistributionId",
    });

    new cdk.CfnOutput(this, "SiteBucketName", {
      value: this.siteBucket.bucketName,
      description: "S3 bucket for frontend assets",
      exportName: "AiLearningHub-FrontendBucketName",
    });
  }
}
