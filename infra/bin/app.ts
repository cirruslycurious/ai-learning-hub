import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { AwsSolutionsChecks } from "cdk-nag";
import { Aspects } from "aws-cdk-lib";
import { getAwsEnv } from "../config/aws-env";

const app = new cdk.App();

// Stack placeholders per ADR-006 — implementations in later stories
// Stacks will use awsEnv for consistent account/region configuration

// Environment configuration - never hardcode account/region
// Uses CDK default behavior: reads from AWS credentials
// For ci-cd-pipeline, use AWS_REGION and AWS_ACCOUNT_ID from environment
export const awsEnv = getAwsEnv();

cdk.Tags.of(app).add("Project", "ai-learning-hub");
cdk.Tags.of(app).add("ManagedBy", "CDK");

// Apply CDK Nag security and best practices checks (AC5)
// AwsSolutionsChecks runs comprehensive security rules
// Findings at ERROR level will fail the synth/CI pipeline
Aspects.of(app).add(new AwsSolutionsChecks({ verbose: true }));
