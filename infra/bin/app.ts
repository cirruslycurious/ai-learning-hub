import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { AwsSolutionsChecks } from "cdk-nag";
import { Aspects } from "aws-cdk-lib";
import { getAwsEnv } from "../config/aws-env";
import { TablesStack } from "../lib/stacks/core/tables.stack";
import { BucketsStack } from "../lib/stacks/core/buckets.stack";
import { ObservabilityStack } from "../lib/stacks/observability/observability.stack";
import { AuthStack } from "../lib/stacks/auth/auth.stack";
import { RateLimitingStack } from "../lib/stacks/api/rate-limiting.stack";

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

// Auth Stack - JWT Authorizer Lambda (ADR-006: Auth after Core)
const authStack = new AuthStack(app, "AiLearningHubAuth", {
  env: awsEnv,
  description:
    "Authentication stack for ai-learning-hub (JWT authorizer, API key authorizer, invite validation)",
  usersTable: tablesStack.usersTable,
  inviteCodesTable: tablesStack.inviteCodesTable,
});
authStack.addDependency(tablesStack);

// Observability Stack - X-Ray tracing, dashboards, alarms (ADR-006: after Core stacks)
const observabilityStack = new ObservabilityStack(
  app,
  "AiLearningHubObservability",
  {
    env: awsEnv,
    description:
      "Observability foundation for ai-learning-hub (X-Ray, dashboards, alarms)",
  }
);

// Rate Limiting Stack - WAF + API Gateway throttling config (Story 2.7, AC1)
const rateLimitingStack = new RateLimitingStack(
  app,
  "AiLearningHubRateLimiting",
  {
    env: awsEnv,
    description:
      "Rate limiting for ai-learning-hub (WAF rate-based rules, API Gateway throttling config)",
  }
);

// Export stack instances for future cross-stack references (avoids unused variable lint errors)
export {
  tablesStack,
  bucketsStack,
  authStack,
  observabilityStack,
  rateLimitingStack,
};

cdk.Tags.of(app).add("Project", "ai-learning-hub");
cdk.Tags.of(app).add("ManagedBy", "CDK");

// Apply CDK Nag security and best practices checks (AC6)
// AwsSolutionsChecks runs comprehensive security rules
// Findings at ERROR level will fail the synth/CI pipeline
Aspects.of(app).add(new AwsSolutionsChecks({ verbose: true }));
