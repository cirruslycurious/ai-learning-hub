// Environment-specific configuration
// Never commit real account IDs or VPC IDs - use CDK lookups

export interface EnvironmentConfig {
  readonly stage: "dev" | "staging" | "prod";
  readonly region: string;
  readonly vpcConfig: {
    // Use CDK to create new VPC - never reference existing VPC IDs
    readonly createNew: boolean;
    readonly cidr?: string;
    readonly maxAzs?: number;
  };
  readonly resourcePrefix: string;
}

/**
 * Get environment config based on CDK context or env vars
 * Never hardcode account IDs or resource IDs here
 */
export function getEnvironmentConfig(
  stage: string = process.env.STAGE || "dev"
): EnvironmentConfig {
  // us-east-2 (new, isolated from us-east-1)
  // Create fresh VPC to avoid conflicts with existing us-east-1 resources
  const baseConfig: EnvironmentConfig = {
    stage: stage as "dev" | "staging" | "prod",
    region: "us-east-2",
    vpcConfig: {
      createNew: true,
      cidr: "10.1.0.0/16", // Different from any existing VPCs
      maxAzs: 2,
    },
    resourcePrefix: `ailh-${stage}`, // ailh = ai-learning-hub
  };

  return baseConfig;
}

/**
 * Build stack name with consistent naming convention
 * Example: ailh-dev-database, ailh-dev-api
 */
export function getStackName(
  stackType: string,
  config: EnvironmentConfig
): string {
  return `${config.resourcePrefix}-${stackType}`;
}
