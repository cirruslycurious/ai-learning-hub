import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { AwsSolutionsChecks } from "cdk-nag";
import { Aspects } from "aws-cdk-lib";

const app = new cdk.App();

// Stack placeholders per ADR-006 — implementations in later stories
// app.node.tryGetContext('stackName') or env for stage

cdk.Tags.of(app).add("Project", "ai-learning-hub");

// Apply CDK Nag security and best practices checks (AC5)
// AwsSolutionsChecks runs comprehensive security rules
// Findings at ERROR level will fail the synth/CI pipeline
Aspects.of(app).add(new AwsSolutionsChecks({ verbose: true }));
