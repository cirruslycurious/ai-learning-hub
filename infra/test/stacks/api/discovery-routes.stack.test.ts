/**
 * DiscoveryRoutesStack Tests (Story 3.5.3, AC9)
 *
 * Validates action discoverability routes:
 * Lambda count, X-Ray tracing, environment variables, and API Gateway route wiring.
 */
import * as cdk from "aws-cdk-lib";
import { App, Stack } from "aws-cdk-lib";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { Template } from "aws-cdk-lib/assertions";
import { describe, it, expect, beforeAll } from "vitest";
import { DiscoveryRoutesStack } from "../../../lib/stacks/api/discovery-routes.stack";
import { getAwsEnv } from "../../../config/aws-env";

describe("DiscoveryRoutesStack", () => {
  let template: Template;

  beforeAll(() => {
    const app = new App();
    const awsEnv = getAwsEnv();

    // Create a standalone RestApi (same pattern as ops-routes.stack.test.ts)
    const apiStack = new Stack(app, "TestApiStack", { env: awsEnv });
    const restApi = new apigateway.RestApi(apiStack, "TestRestApi", {
      deploy: false,
    });
    restApi.root.addMethod("GET");

    // Create a mock RequestAuthorizer
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

    const stack = new DiscoveryRoutesStack(app, "TestDiscoveryRoutesStack", {
      env: awsEnv,
      restApiId: restApi.restApiId,
      rootResourceId: restApi.restApiRootResourceId,
      apiKeyAuthorizer,
      usersTable,
      inviteCodesTable,
      savesTable,
      idempotencyTable,
      eventsTable,
    });

    template = Template.fromStack(stack);
  });

  describe("Lambda Functions", () => {
    it("creates 2 Lambda functions (actions-catalog, state-graph)", () => {
      template.resourceCountIs("AWS::Lambda::Function", 2);
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
    const requiredEnvVars = [
      "USERS_TABLE_NAME",
      "INVITE_CODES_TABLE_NAME",
      "SAVES_TABLE_NAME",
      "IDEMPOTENCY_TABLE_NAME",
      "EVENTS_TABLE_NAME",
    ];

    for (const envVar of requiredEnvVars) {
      it(`all functions have ${envVar}`, () => {
        const functions = template.findResources("AWS::Lambda::Function");
        for (const [logicalId, fn] of Object.entries(functions)) {
          const envVars = (
            fn as {
              Properties: {
                Environment: { Variables: Record<string, unknown> };
              };
            }
          ).Properties?.Environment?.Variables;
          expect(
            envVars?.[envVar],
            `${logicalId} missing ${envVar}`
          ).toBeDefined();
        }
      });
    }
  });

  describe("Route Resources", () => {
    it("creates /actions resource", () => {
      template.hasResourceProperties("AWS::ApiGateway::Resource", {
        PathPart: "actions",
      });
    });

    it("creates /states resource", () => {
      template.hasResourceProperties("AWS::ApiGateway::Resource", {
        PathPart: "states",
      });
    });

    it("creates /states/{entityType} resource", () => {
      template.hasResourceProperties("AWS::ApiGateway::Resource", {
        PathPart: "{entityType}",
      });
    });
  });

  describe("Route Methods", () => {
    it("GET /actions uses CUSTOM authorization", () => {
      const allMethods = template.findResources("AWS::ApiGateway::Method");
      const customGetMethods = Object.entries(allMethods).filter(
        ([, method]) => {
          const props = (method as { Properties: Record<string, unknown> })
            .Properties;
          return (
            props.HttpMethod === "GET" && props.AuthorizationType === "CUSTOM"
          );
        }
      );
      // GET /actions and GET /states/{entityType}
      expect(customGetMethods).toHaveLength(2);
    });

    it("creates OPTIONS preflight methods", () => {
      const allMethods = template.findResources("AWS::ApiGateway::Method");
      const optionsMethods = Object.entries(allMethods).filter(([, method]) => {
        const props = (method as { Properties: Record<string, unknown> })
          .Properties;
        return props.HttpMethod === "OPTIONS";
      });
      // /actions, /states, /states/{entityType}
      expect(optionsMethods.length).toBeGreaterThanOrEqual(3);
    });
  });
});
