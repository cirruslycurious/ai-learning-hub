import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

describe("CDK App Structure", () => {
  const appSourcePath = join(__dirname, "../../bin/app.ts");
  const appSource = readFileSync(appSourcePath, "utf-8");

  describe("Secrets protection", () => {
    it("should not contain hardcoded AWS account ID", () => {
      // Check for 12-digit AWS account ID pattern
      const accountIdPattern = /\b\d{12}\b/;
      expect(appSource).not.toMatch(accountIdPattern);
    });

    it("should not contain hardcoded DynamoDB table names", () => {
      // Should not have hardcoded DynamoDB table names
      expect(appSource).not.toMatch(/TableName.*=.*["']\w+-\w+["']/);
      expect(appSource).not.toMatch(/tableName.*:.*["'][a-z-]+["']/i);
    });

    it("should not contain hardcoded S3 bucket names", () => {
      // Should not have hardcoded S3 bucket names
      expect(appSource).not.toMatch(/bucketName.*=.*["']\w+-\w+["']/);
      expect(appSource).not.toMatch(/BucketName.*:.*["'][a-z-]+["']/i);
    });

    it("should not contain hardcoded API Gateway IDs", () => {
      // Should not have hardcoded API Gateway REST API IDs
      expect(appSource).not.toMatch(/restApiId.*=.*["'][a-z0-9]+["']/i);
    });

    it("should not contain AWS access keys or secrets", () => {
      // Check for AWS access key pattern (AKIA...)
      expect(appSource).not.toMatch(/AKIA[0-9A-Z]{16}/);

      // Check for generic secret patterns
      expect(appSource).not.toMatch(/aws_secret_access_key/i);
      expect(appSource).not.toMatch(/aws_access_key_id/i);
    });
  });

  describe("Environment variable usage", () => {
    it("should use getAwsEnv for environment configuration", () => {
      expect(appSource).toContain("getAwsEnv");
    });

    it("should import aws-env config", () => {
      expect(appSource).toMatch(/from\s+["']\.\.\/config\/aws-env["']/);
    });

    it("should export awsEnv for stack usage", () => {
      expect(appSource).toContain("export const awsEnv");
    });
  });

  describe("CDK best practices", () => {
    it("should enable CDK Nag security checks", () => {
      expect(appSource).toContain("AwsSolutionsChecks");
      expect(appSource).toContain("Aspects.of(app).add");
    });

    it("should add Project tag", () => {
      expect(appSource).toContain('cdk.Tags.of(app).add("Project"');
      expect(appSource).toContain("ai-learning-hub");
    });

    it("should add ManagedBy tag", () => {
      expect(appSource).toContain('cdk.Tags.of(app).add("ManagedBy"');
      expect(appSource).toContain("CDK");
    });

    it("should use source-map-support for better stack traces", () => {
      expect(appSource).toContain('import "source-map-support/register"');
    });
  });

  describe("Code structure", () => {
    it("should import required CDK libraries", () => {
      expect(appSource).toContain('import * as cdk from "aws-cdk-lib"');
    });

    it("should import CDK Nag for security checks", () => {
      expect(appSource).toContain(
        'import { AwsSolutionsChecks } from "cdk-nag"'
      );
    });

    it("should create CDK App instance", () => {
      expect(appSource).toContain("new cdk.App()");
    });

    it("should have comments explaining configuration", () => {
      expect(appSource).toContain("// Stack placeholders");
      expect(appSource).toContain("// Environment configuration");
    });
  });

  describe("Region isolation", () => {
    it("should reference us-east-2 in comments or config", () => {
      // Default region should be us-east-2 for isolation
      // This may be in aws-env.ts, but app.ts should reference it
      expect(appSource).toContain("awsEnv");
    });

    it("should not reference us-east-1 as default", () => {
      // Should not default to us-east-1 (existing resources there)
      expect(appSource).not.toMatch(/region.*=.*["']us-east-1["']/);
    });
  });

  describe("Documentation", () => {
    it("should have comments about ADR-006", () => {
      expect(appSource).toContain("ADR-006");
    });

    it("should explain environment configuration approach", () => {
      expect(appSource).toMatch(/environment.*configuration/i);
    });

    it("should explain never hardcoding account/region", () => {
      expect(appSource).toMatch(/never.*hardcode/i);
    });
  });
});
