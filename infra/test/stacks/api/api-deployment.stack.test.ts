/**
 * ApiDeploymentStack Tests
 *
 * Tests the dedicated Deployment + Stage + WAF stack that solves the CDK
 * cross-stack deployment problem. Validates that Stage, Deployment, throttling,
 * tracing, WAF association, and outputs are correctly configured.
 */
import { App, Stack } from "aws-cdk-lib";
import * as wafv2 from "aws-cdk-lib/aws-wafv2";
import { Template, Match } from "aws-cdk-lib/assertions";
import { describe, it, beforeAll } from "vitest";
import { ApiDeploymentStack } from "../../../lib/stacks/api/api-deployment.stack";
import { getAwsEnv } from "../../../config/aws-env";

describe("ApiDeploymentStack", () => {
  let template: Template;

  beforeAll(() => {
    const app = new App();
    const awsEnv = getAwsEnv();

    const depsStack = new Stack(app, "DeployTestDeps", { env: awsEnv });

    const webAcl = new wafv2.CfnWebACL(depsStack, "TestWebAcl", {
      scope: "REGIONAL",
      defaultAction: { allow: {} },
      visibilityConfig: {
        cloudWatchMetricsEnabled: true,
        metricName: "TestMetric",
        sampledRequestsEnabled: true,
      },
    });

    const deploymentStack = new ApiDeploymentStack(
      app,
      "TestApiDeploymentStack",
      {
        env: awsEnv,
        restApiId: "test-api-id",
        stageName: "dev",
        webAcl,
      }
    );

    template = Template.fromStack(deploymentStack);
  });

  describe("Deployment", () => {
    it("creates an API Gateway Deployment", () => {
      template.resourceCountIs("AWS::ApiGateway::Deployment", 1);
    });

    it("Deployment references the correct REST API", () => {
      template.hasResourceProperties("AWS::ApiGateway::Deployment", {
        RestApiId: "test-api-id",
      });
    });

    it("Deployment has a timestamp in Description to force new deployments", () => {
      template.hasResourceProperties("AWS::ApiGateway::Deployment", {
        Description: Match.stringLikeRegexp("Managed by ApiDeploymentStack"),
      });
    });
  });

  describe("Stage", () => {
    it("creates an API Gateway Stage", () => {
      template.resourceCountIs("AWS::ApiGateway::Stage", 1);
    });

    it("Stage has correct name", () => {
      template.hasResourceProperties("AWS::ApiGateway::Stage", {
        StageName: "dev",
      });
    });

    it("configures stage throttling (100 req/s, burst 200)", () => {
      template.hasResourceProperties("AWS::ApiGateway::Stage", {
        MethodSettings: Match.arrayWith([
          Match.objectLike({
            ThrottlingRateLimit: 100,
            ThrottlingBurstLimit: 200,
          }),
        ]),
      });
    });

    it("enables X-Ray tracing on the stage", () => {
      template.hasResourceProperties("AWS::ApiGateway::Stage", {
        TracingEnabled: true,
      });
    });
  });

  describe("WAF Association", () => {
    it("creates a WAF WebACL association", () => {
      template.resourceCountIs("AWS::WAFv2::WebACLAssociation", 1);
    });
  });

  describe("Stack Outputs", () => {
    it("exports REST API URL", () => {
      template.hasOutput("RestApiUrl", {
        Export: { Name: "AiLearningHub-RestApiUrl" },
      });
    });

    it("outputs the stage name", () => {
      template.hasOutput("StageName", {});
    });
  });
});
