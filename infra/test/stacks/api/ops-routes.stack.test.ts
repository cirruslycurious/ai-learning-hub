/**
 * OpsRoutesStack Tests (AC11)
 *
 * Validates health, readiness, and batch operations routes:
 * Lambda count, runtime, environment variables, and API Gateway route wiring.
 */
import * as cdk from "aws-cdk-lib";
import { App, Stack } from "aws-cdk-lib";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { Template, Match } from "aws-cdk-lib/assertions";
import { describe, it, expect, beforeAll } from "vitest";
import { OpsRoutesStack } from "../../../lib/stacks/api/ops-routes.stack";
import { getAwsEnv } from "../../../config/aws-env";

describe("OpsRoutesStack", () => {
  let template: Template;

  beforeAll(() => {
    const app = new App();
    const awsEnv = getAwsEnv();

    // Create a standalone RestApi (no ApiGatewayStack needed — avoids
    // cross-stack resolution issues with the unused JWT authorizer)
    const apiStack = new Stack(app, "TestApiStack", { env: awsEnv });
    const restApi = new apigateway.RestApi(apiStack, "TestRestApi", {
      deploy: false,
    });
    // Dummy method to satisfy CDK validation (routes are added cross-stack)
    restApi.root.addMethod("GET");

    // Create a mock RequestAuthorizer attached to this RestApi
    const authorizerFn = lambda.Function.fromFunctionArn(
      apiStack,
      "MockAuthFn",
      `arn:aws:lambda:${awsEnv.region ?? "us-east-2"}:${awsEnv.account ?? "123456789012"}:function:MockAuthFn`
    );
    const apiKeyAuthorizer = new apigateway.RequestAuthorizer(
      apiStack,
      "MockAuthorizer",
      {
        handler: authorizerFn,
        identitySources: [],
        resultsCacheTtl: cdk.Duration.seconds(0),
      }
    );

    // Create mock tables
    const tablesStack = new Stack(app, "TestTablesStack", { env: awsEnv });
    const usersTable = new dynamodb.Table(tablesStack, "UsersTable", {
      tableName: "ai-learning-hub-users",
      partitionKey: { name: "PK", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "SK", type: dynamodb.AttributeType.STRING },
    });
    const inviteCodesTable = new dynamodb.Table(
      tablesStack,
      "InviteCodesTable",
      {
        tableName: "ai-learning-hub-invite-codes",
        partitionKey: { name: "PK", type: dynamodb.AttributeType.STRING },
        sortKey: { name: "SK", type: dynamodb.AttributeType.STRING },
      }
    );
    const savesTable = new dynamodb.Table(tablesStack, "SavesTable", {
      tableName: "ai-learning-hub-saves",
      partitionKey: { name: "PK", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "SK", type: dynamodb.AttributeType.STRING },
    });
    const idempotencyTable = new dynamodb.Table(
      tablesStack,
      "IdempotencyTable",
      {
        tableName: "ai-learning-hub-idempotency",
        partitionKey: { name: "PK", type: dynamodb.AttributeType.STRING },
      }
    );
    const eventsTable = new dynamodb.Table(tablesStack, "EventsTable", {
      tableName: "ai-learning-hub-events",
      partitionKey: { name: "PK", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "SK", type: dynamodb.AttributeType.STRING },
    });

    const stack = new OpsRoutesStack(app, "TestOpsRoutesStack", {
      env: awsEnv,
      restApiId: restApi.restApiId,
      rootResourceId: restApi.restApiRootResourceId,
      apiKeyAuthorizer,
      usersTable,
      inviteCodesTable,
      savesTable,
      idempotencyTable,
      eventsTable,
      stageName: "dev",
    });

    template = Template.fromStack(stack);
  });

  describe("Lambda Functions", () => {
    it("creates 3 Lambda functions (health, readiness, batch)", () => {
      template.resourceCountIs("AWS::Lambda::Function", 3);
    });

    it("all functions use the latest Node.js runtime", () => {
      const functions = template.findResources("AWS::Lambda::Function");
      for (const [, fn] of Object.entries(functions)) {
        const props = (fn as { Properties: Record<string, unknown> })
          .Properties;
        expect(props.Runtime).toBe(lambda.Runtime.NODEJS_LATEST.name);
      }
    });

    it("all functions have X-Ray tracing enabled", () => {
      const functions = template.findResources("AWS::Lambda::Function");
      for (const [, fn] of Object.entries(functions)) {
        const props = (fn as { Properties: Record<string, unknown> })
          .Properties;
        expect(props.TracingConfig).toEqual({ Mode: "Active" });
      }
    });
  });

  describe("Environment Variables", () => {
    it("all functions have USERS_TABLE_NAME", () => {
      const functions = template.findResources("AWS::Lambda::Function");
      for (const [logicalId, fn] of Object.entries(functions)) {
        const envVars = (
          fn as {
            Properties: { Environment: { Variables: Record<string, unknown> } };
          }
        ).Properties?.Environment?.Variables;
        expect(
          envVars?.USERS_TABLE_NAME,
          `${logicalId} missing USERS_TABLE_NAME`
        ).toBeDefined();
      }
    });

    it("batch function has API_BASE_URL", () => {
      template.hasResourceProperties("AWS::Lambda::Function", {
        FunctionName: "ai-learning-hub-batch",
        Environment: {
          Variables: Match.objectLike({
            API_BASE_URL: Match.anyValue(),
          }),
        },
      });
    });

    it("batch function has higher memory (512 MB) and timeout (30s)", () => {
      template.hasResourceProperties("AWS::Lambda::Function", {
        FunctionName: "ai-learning-hub-batch",
        MemorySize: 512,
        Timeout: 30,
      });
    });
  });

  describe("Route Resources", () => {
    it("creates /health resource", () => {
      template.hasResourceProperties("AWS::ApiGateway::Resource", {
        PathPart: "health",
      });
    });

    it("creates /ready resource", () => {
      template.hasResourceProperties("AWS::ApiGateway::Resource", {
        PathPart: "ready",
      });
    });

    it("creates /batch resource", () => {
      template.hasResourceProperties("AWS::ApiGateway::Resource", {
        PathPart: "batch",
      });
    });
  });

  describe("Route Methods", () => {
    it("health and readiness routes use AuthorizationType.NONE", () => {
      const allMethods = template.findResources("AWS::ApiGateway::Method");
      const noneMethods = Object.entries(allMethods).filter(([, method]) => {
        const props = (method as { Properties: Record<string, unknown> })
          .Properties;
        return props.HttpMethod === "GET" && props.AuthorizationType === "NONE";
      });
      // /health GET and /ready GET
      expect(noneMethods).toHaveLength(2);
    });

    it("batch route uses CUSTOM auth type", () => {
      template.hasResourceProperties("AWS::ApiGateway::Method", {
        HttpMethod: "POST",
        AuthorizationType: "CUSTOM",
      });
    });

    it("creates OPTIONS preflight methods on route resources", () => {
      const allMethods = template.findResources("AWS::ApiGateway::Method");
      const optionsMethods = Object.entries(allMethods).filter(([, method]) => {
        const props = (method as { Properties: Record<string, unknown> })
          .Properties;
        return props.HttpMethod === "OPTIONS";
      });
      // /health, /ready, /batch = 3
      expect(optionsMethods.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe("IAM Permissions", () => {
    it("readiness function has read access to users table", () => {
      template.hasResourceProperties("AWS::IAM::Policy", {
        PolicyDocument: {
          Statement: Match.arrayWith([
            Match.objectLike({
              Action: Match.arrayWith(["dynamodb:GetItem"]),
              Effect: "Allow",
            }),
          ]),
        },
      });
    });

    it("batch function has read/write access to idempotency table", () => {
      template.hasResourceProperties("AWS::IAM::Policy", {
        PolicyDocument: {
          Statement: Match.arrayWith([
            Match.objectLike({
              Action: Match.arrayWith(["dynamodb:PutItem"]),
              Effect: "Allow",
            }),
          ]),
        },
      });
    });
  });
});
