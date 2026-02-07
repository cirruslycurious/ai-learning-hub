import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { getAwsEnv } from "../../config/aws-env";

describe("AWS Environment Configuration", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset environment before each test
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe("getAwsEnv", () => {
    it("should use CDK_DEFAULT_ACCOUNT from environment", () => {
      process.env.CDK_DEFAULT_ACCOUNT = "123456789012";

      const awsEnv = getAwsEnv();

      expect(awsEnv.account).toBe("123456789012");
    });

    it("should prioritize AWS_REGION over CDK_DEFAULT_REGION", () => {
      process.env.AWS_REGION = "us-west-2";
      process.env.CDK_DEFAULT_REGION = "us-east-1";

      const awsEnv = getAwsEnv();

      expect(awsEnv.region).toBe("us-west-2");
    });

    it("should use CDK_DEFAULT_REGION when AWS_REGION not set", () => {
      delete process.env.AWS_REGION;
      process.env.CDK_DEFAULT_REGION = "us-east-1";

      const awsEnv = getAwsEnv();

      expect(awsEnv.region).toBe("us-east-1");
    });

    it("should default to us-east-2 when no region env vars set", () => {
      delete process.env.AWS_REGION;
      delete process.env.CDK_DEFAULT_REGION;

      const awsEnv = getAwsEnv();

      expect(awsEnv.region).toBe("us-east-2");
    });

    it("should return undefined account when not set", () => {
      delete process.env.CDK_DEFAULT_ACCOUNT;

      const awsEnv = getAwsEnv();

      // Account should be undefined when not set (CDK will lookup)
      expect(awsEnv.account).toBeUndefined();
    });

    it("should return consistent structure", () => {
      process.env.CDK_DEFAULT_ACCOUNT = "987654321098";
      process.env.AWS_REGION = "eu-west-1";

      const awsEnv = getAwsEnv();

      expect(awsEnv).toHaveProperty("account");
      expect(awsEnv).toHaveProperty("region");
      expect(awsEnv.account).toBe("987654321098");
      expect(awsEnv.region).toBe("eu-west-1");
    });
  });

  describe("Region isolation", () => {
    it("should default to us-east-2 to avoid us-east-1 conflicts", () => {
      delete process.env.AWS_REGION;
      delete process.env.CDK_DEFAULT_REGION;

      const awsEnv = getAwsEnv();

      // us-east-2 isolates from existing us-east-1 resources
      expect(awsEnv.region).toBe("us-east-2");
    });

    it("should allow region override via AWS_REGION", () => {
      process.env.AWS_REGION = "eu-west-1";

      const awsEnv = getAwsEnv();

      expect(awsEnv.region).toBe("eu-west-1");
    });

    it("should allow region override via CDK_DEFAULT_REGION", () => {
      delete process.env.AWS_REGION;
      process.env.CDK_DEFAULT_REGION = "ap-south-1";

      const awsEnv = getAwsEnv();

      expect(awsEnv.region).toBe("ap-south-1");
    });
  });

  describe("Environment variable precedence", () => {
    it("should follow AWS_REGION > CDK_DEFAULT_REGION > us-east-2", () => {
      // Test 1: AWS_REGION has highest priority
      process.env.AWS_REGION = "us-west-2";
      process.env.CDK_DEFAULT_REGION = "us-east-1";

      let awsEnv = getAwsEnv();
      expect(awsEnv.region).toBe("us-west-2");

      // Test 2: CDK_DEFAULT_REGION is fallback
      delete process.env.AWS_REGION;
      process.env.CDK_DEFAULT_REGION = "ap-south-1";

      awsEnv = getAwsEnv();
      expect(awsEnv.region).toBe("ap-south-1");

      // Test 3: Default to us-east-2
      delete process.env.AWS_REGION;
      delete process.env.CDK_DEFAULT_REGION;

      awsEnv = getAwsEnv();
      expect(awsEnv.region).toBe("us-east-2");
    });

    it("should handle empty string env vars", () => {
      process.env.AWS_REGION = "";
      process.env.CDK_DEFAULT_REGION = "us-west-1";

      const awsEnv = getAwsEnv();

      // Empty string is falsy, should fall through to CDK_DEFAULT_REGION
      expect(awsEnv.region).toBe("us-west-1");
    });

    it("should handle all env vars empty", () => {
      process.env.AWS_REGION = "";
      process.env.CDK_DEFAULT_REGION = "";

      const awsEnv = getAwsEnv();

      // Should fall through to default
      expect(awsEnv.region).toBe("us-east-2");
    });
  });

  describe("Account configuration", () => {
    it("should accept valid 12-digit account ID", () => {
      process.env.CDK_DEFAULT_ACCOUNT = "123456789012";

      const awsEnv = getAwsEnv();

      expect(awsEnv.account).toBe("123456789012");
    });

    it("should pass through account as-is (no validation)", () => {
      // Function doesn't validate - CDK will handle that
      process.env.CDK_DEFAULT_ACCOUNT = "invalid";

      const awsEnv = getAwsEnv();

      expect(awsEnv.account).toBe("invalid");
    });

    it("should handle missing account gracefully", () => {
      delete process.env.CDK_DEFAULT_ACCOUNT;

      const awsEnv = getAwsEnv();

      expect(awsEnv.account).toBeUndefined();
    });
  });

  describe("Integration scenarios", () => {
    it("should support local development scenario", () => {
      // Local dev: CDK reads from AWS credentials
      delete process.env.CDK_DEFAULT_ACCOUNT;
      delete process.env.AWS_REGION;
      delete process.env.CDK_DEFAULT_REGION;

      const awsEnv = getAwsEnv();

      expect(awsEnv.account).toBeUndefined(); // CDK will lookup
      expect(awsEnv.region).toBe("us-east-2"); // Default region
    });

    it("should support CI/CD scenario", () => {
      // CI/CD: env vars provided by pipeline
      process.env.CDK_DEFAULT_ACCOUNT = "111222333444";
      process.env.AWS_REGION = "us-east-2";

      const awsEnv = getAwsEnv();

      expect(awsEnv.account).toBe("111222333444");
      expect(awsEnv.region).toBe("us-east-2");
    });

    it("should support multi-region deployment", () => {
      // Deploy to different region
      process.env.AWS_REGION = "eu-central-1";

      const awsEnv = getAwsEnv();

      expect(awsEnv.region).toBe("eu-central-1");
    });
  });
});
