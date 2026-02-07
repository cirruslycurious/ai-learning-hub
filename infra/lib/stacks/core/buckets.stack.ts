import * as cdk from "aws-cdk-lib";
import * as s3 from "aws-cdk-lib/aws-s3";
import { Construct } from "constructs";

export class BucketsStack extends cdk.Stack {
  public readonly projectNotesBucket: s3.Bucket;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Access logs bucket (required by CDK Nag AwsSolutions-S1)
    const accessLogsBucket = new s3.Bucket(this, "AccessLogsBucket", {
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      autoDeleteObjects: false,
      lifecycleRules: [
        {
          // Delete access logs after 90 days to reduce costs
          expiration: cdk.Duration.days(90),
          enabled: true,
        },
      ],
      enforceSSL: true, // Require SSL/TLS for all requests
    });

    // Project Notes Bucket (for large Markdown content per ADR-010)
    this.projectNotesBucket = new s3.Bucket(this, "ProjectNotesBucket", {
      // NEVER hardcode bucket name - must be globally unique across all AWS accounts
      // CDK auto-generates unique name with stack prefix and random suffix
      bucketName: undefined,
      encryption: s3.BucketEncryption.S3_MANAGED, // SSE-S3 per NFR-S1
      versioned: true, // Versioning for durability per NFR-R3
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL, // Security best practice
      removalPolicy: cdk.RemovalPolicy.RETAIN, // Never delete data
      autoDeleteObjects: false, // Prevent accidental deletion
      serverAccessLogsBucket: accessLogsBucket, // Enable access logging (AwsSolutions-S1)
      serverAccessLogsPrefix: "project-notes-access-logs/",
      enforceSSL: true, // Require SSL/TLS (AwsSolutions-S10)
      lifecycleRules: [
        {
          // Archive old versions to reduce costs
          noncurrentVersionTransitions: [
            {
              storageClass: s3.StorageClass.INFREQUENT_ACCESS,
              transitionAfter: cdk.Duration.days(30),
            },
            {
              storageClass: s3.StorageClass.GLACIER,
              transitionAfter: cdk.Duration.days(90),
            },
          ],
          // Delete very old versions (beyond 1 year)
          noncurrentVersionExpiration: cdk.Duration.days(365),
          enabled: true,
        },
      ],
    });

    // CloudFormation Output
    new cdk.CfnOutput(this, "ProjectNotesBucketName", {
      value: this.projectNotesBucket.bucketName,
      description: "S3 bucket for project notes (Markdown content)",
      exportName: "AiLearningHub-ProjectNotesBucketName",
    });

    new cdk.CfnOutput(this, "ProjectNotesBucketArn", {
      value: this.projectNotesBucket.bucketArn,
      description: "S3 bucket ARN for project notes",
      exportName: "AiLearningHub-ProjectNotesBucketArn",
    });
  }
}
