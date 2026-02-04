import "source-map-support/register";
import * as cdk from "aws-cdk-lib";

const app = new cdk.App();

// Stack placeholders per ADR-006 — implementations in later stories
// app.node.tryGetContext('stackName') or env for stage

cdk.Tags.of(app).add("Project", "ai-learning-hub");
