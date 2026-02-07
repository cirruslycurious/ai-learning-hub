/**
 * AWS environment configuration for CDK stacks
 * Never hardcodes account or region - uses environment variables
 */

export interface AwsEnvironment {
  readonly account: string | undefined;
  readonly region: string;
}

/**
 * Get AWS environment configuration from environment variables
 * @returns AWS account and region for CDK stack deployment
 */
export function getAwsEnv(): AwsEnvironment {
  return {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region:
      process.env.AWS_REGION || process.env.CDK_DEFAULT_REGION || "us-east-2",
  };
}
