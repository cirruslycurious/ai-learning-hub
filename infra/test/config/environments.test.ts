import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getEnvironmentConfig, getStackName } from "../../config/environments";

describe("Environment Configuration", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset environment before each test
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe("getEnvironmentConfig", () => {
    it("should return dev config by default", () => {
      const config = getEnvironmentConfig();

      expect(config.stage).toBe("dev");
      expect(config.region).toBe("us-east-2");
      expect(config.resourcePrefix).toBe("ailh-dev");
    });

    it("should use STAGE env var when provided", () => {
      process.env.STAGE = "staging";

      const config = getEnvironmentConfig();

      expect(config.stage).toBe("staging");
      expect(config.resourcePrefix).toBe("ailh-staging");
    });

    it("should accept stage parameter", () => {
      const config = getEnvironmentConfig("prod");

      expect(config.stage).toBe("prod");
      expect(config.resourcePrefix).toBe("ailh-prod");
    });

    it("should create new VPC configuration", () => {
      const config = getEnvironmentConfig();

      expect(config.vpcConfig.createNew).toBe(true);
      expect(config.vpcConfig.cidr).toBe("10.1.0.0/16");
      expect(config.vpcConfig.maxAzs).toBe(2);
    });

    it("should use us-east-2 region for isolation", () => {
      const config = getEnvironmentConfig();

      // us-east-2 isolates from existing us-east-1 resources
      expect(config.region).toBe("us-east-2");
    });

    it("should generate consistent config for same stage", () => {
      const config1 = getEnvironmentConfig("dev");
      const config2 = getEnvironmentConfig("dev");

      expect(config1).toEqual(config2);
    });

    it("should generate different prefixes for different stages", () => {
      const devConfig = getEnvironmentConfig("dev");
      const stagingConfig = getEnvironmentConfig("staging");
      const prodConfig = getEnvironmentConfig("prod");

      expect(devConfig.resourcePrefix).toBe("ailh-dev");
      expect(stagingConfig.resourcePrefix).toBe("ailh-staging");
      expect(prodConfig.resourcePrefix).toBe("ailh-prod");
    });
  });

  describe("getStackName", () => {
    it("should build stack name with prefix and type", () => {
      const config = getEnvironmentConfig("dev");
      const stackName = getStackName("database", config);

      expect(stackName).toBe("ailh-dev-database");
    });

    it("should generate unique names for different stack types", () => {
      const config = getEnvironmentConfig("dev");

      expect(getStackName("database", config)).toBe("ailh-dev-database");
      expect(getStackName("api", config)).toBe("ailh-dev-api");
      expect(getStackName("frontend", config)).toBe("ailh-dev-frontend");
    });

    it("should include stage in stack name for resource isolation", () => {
      const devConfig = getEnvironmentConfig("dev");
      const prodConfig = getEnvironmentConfig("prod");

      const devStack = getStackName("api", devConfig);
      const prodStack = getStackName("api", prodConfig);

      expect(devStack).toBe("ailh-dev-api");
      expect(prodStack).toBe("ailh-prod-api");
      expect(devStack).not.toBe(prodStack);
    });

    it("should handle various stack type names", () => {
      const config = getEnvironmentConfig("staging");

      expect(getStackName("database", config)).toBe("ailh-staging-database");
      expect(getStackName("api-gateway", config)).toBe(
        "ailh-staging-api-gateway"
      );
      expect(getStackName("lambda-functions", config)).toBe(
        "ailh-staging-lambda-functions"
      );
    });

    it("should maintain consistent naming convention", () => {
      const config = getEnvironmentConfig("prod");
      const stackName = getStackName("monitoring", config);

      // Format: {prefix}-{stackType}
      expect(stackName).toMatch(/^ailh-prod-[a-z-]+$/);
    });
  });

  describe("VPC Configuration", () => {
    it("should use non-overlapping CIDR range", () => {
      const config = getEnvironmentConfig();

      // 10.1.0.0/16 avoids conflicts with common ranges
      // (10.0.0.0/16 often used in us-east-1)
      expect(config.vpcConfig.cidr).toBe("10.1.0.0/16");
    });

    it("should configure for multi-AZ deployment", () => {
      const config = getEnvironmentConfig();

      expect(config.vpcConfig.maxAzs).toBeGreaterThanOrEqual(2);
    });

    it("should always create new VPC to avoid conflicts", () => {
      const devConfig = getEnvironmentConfig("dev");
      const stagingConfig = getEnvironmentConfig("staging");
      const prodConfig = getEnvironmentConfig("prod");

      expect(devConfig.vpcConfig.createNew).toBe(true);
      expect(stagingConfig.vpcConfig.createNew).toBe(true);
      expect(prodConfig.vpcConfig.createNew).toBe(true);
    });
  });

  describe("Resource Naming", () => {
    it("should use ailh prefix for all resources", () => {
      const devConfig = getEnvironmentConfig("dev");
      const stagingConfig = getEnvironmentConfig("staging");
      const prodConfig = getEnvironmentConfig("prod");

      expect(devConfig.resourcePrefix).toMatch(/^ailh-/);
      expect(stagingConfig.resourcePrefix).toMatch(/^ailh-/);
      expect(prodConfig.resourcePrefix).toMatch(/^ailh-/);
    });

    it("should generate CloudFormation-safe names", () => {
      const config = getEnvironmentConfig("dev");
      const stackName = getStackName("my-stack", config);

      // CloudFormation allows alphanumeric and hyphens
      expect(stackName).toMatch(/^[a-zA-Z0-9-]+$/);
    });
  });
});
