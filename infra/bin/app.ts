import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { AwsSolutionsChecks } from "cdk-nag";
import { Aspects } from "aws-cdk-lib";
import { getAwsEnv } from "../config/aws-env";
import { TablesStack } from "../lib/stacks/core/tables.stack";
import { BucketsStack } from "../lib/stacks/core/buckets.stack";

const app = new cdk.App();

// Environment configuration - never hardcode account/region
// Uses CDK default behavior: reads from AWS credentials
// For ci-cd-pipeline, use AWS_REGION and AWS_ACCOUNT_ID from environment
export const awsEnv = getAwsEnv();

// Core Infrastructure Stacks (ADR-006 deployment order: Core → Auth → API → Workflows → Observability)
const tablesStack = new TablesStack(app, "AiLearningHubTables", {
  env: awsEnv,
  description: "DynamoDB tables for ai-learning-hub (7 tables, 10 GSIs)",
});

const bucketsStack = new BucketsStack(app, "AiLearningHubBuckets", {
  env: awsEnv,
  description: "S3 buckets for ai-learning-hub (project notes storage)",
});

// Export stack instances for future cross-stack references (avoids unused variable lint errors)
export { tablesStack, bucketsStack };

cdk.Tags.of(app).add("Project", "ai-learning-hub");
cdk.Tags.of(app).add("ManagedBy", "CDK");

// Apply CDK Nag security and best practices checks (AC6)
// AwsSolutionsChecks runs comprehensive security rules
// Findings at ERROR level will fail the synth/CI pipeline
Aspects.of(app).add(new AwsSolutionsChecks({ verbose: true }));
