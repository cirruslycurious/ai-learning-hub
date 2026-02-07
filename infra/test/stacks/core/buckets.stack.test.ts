import { App } from "aws-cdk-lib";
import { Template, Match } from "aws-cdk-lib/assertions";
import { describe, it, expect } from "vitest";
import { BucketsStack } from "../../../lib/stacks/core/buckets.stack";
import { getAwsEnv } from "../../../config/aws-env";

describe("BucketsStack", () => {
  const app = new App();
  const awsEnv = getAwsEnv();
  const stack = new BucketsStack(app, "TestBucketsStack", { env: awsEnv });
  const template = Template.fromStack(stack);

  describe("S3 Buckets", () => {
    it("should create at least one S3 bucket for project notes", () => {
      const buckets = template.findResources("AWS::S3::Bucket");
      expect(Object.keys(buckets).length).toBeGreaterThanOrEqual(1);
    });

    it("should create project notes bucket with correct configuration", () => {
      // Verify bucket exists and has versioning (unique to project notes bucket)
      template.hasResourceProperties("AWS::S3::Bucket", {
        VersioningConfiguration: {
          Status: "Enabled",
        },
        // Access logs bucket doesn't have versioning, so this specifically tests project notes bucket
      });
    });

    it("should enable encryption at rest with SSE-S3", () => {
      template.hasResourceProperties("AWS::S3::Bucket", {
        BucketEncryption: {
          ServerSideEncryptionConfiguration: [
            {
              ServerSideEncryptionByDefault: {
                SSEAlgorithm: "AES256",
              },
            },
          ],
        },
      });
    });

    it("should enable versioning for durability", () => {
      template.hasResourceProperties("AWS::S3::Bucket", {
        VersioningConfiguration: {
          Status: "Enabled",
        },
      });
    });

    it("should block all public access", () => {
      template.hasResourceProperties("AWS::S3::Bucket", {
        PublicAccessBlockConfiguration: {
          BlockPublicAcls: true,
          BlockPublicPolicy: true,
          IgnorePublicAcls: true,
          RestrictPublicBuckets: true,
        },
      });
    });

    it("should have lifecycle policy configured", () => {
      template.hasResourceProperties("AWS::S3::Bucket", {
        LifecycleConfiguration: Match.objectLike({
          Rules: Match.arrayWith([Match.objectLike({ Status: "Enabled" })]),
        }),
      });
    });
  });

  describe("Stack Outputs", () => {
    it("should export project notes bucket name", () => {
      const outputs = template.findOutputs("*");
      const outputKeys = Object.keys(outputs);
      expect(outputKeys).toContain("ProjectNotesBucketName");
    });
  });
});
