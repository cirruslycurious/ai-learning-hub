/**
 * SavesRoutesStack Tests (AC10)
 *
 * Validates saves CRUD routes: Lambda count, runtime, environment variables,
 * IAM permissions (narrowed per AC7-AC8), and API Gateway route wiring.
 */
import * as cdk from "aws-cdk-lib";
import { App, Stack } from "aws-cdk-lib";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as events from "aws-cdk-lib/aws-events";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { Template, Match } from "aws-cdk-lib/assertions";
import { describe, it, expect, beforeAll } from "vitest";
import { SavesRoutesStack } from "../../../lib/stacks/api/saves-routes.stack";
import { getAwsEnv } from "../../../config/aws-env";

describe("SavesRoutesStack", () => {
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
    const savesTable = new dynamodb.Table(tablesStack, "SavesTable", {
      tableName: "ai-learning-hub-saves",
      partitionKey: { name: "PK", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "SK", type: dynamodb.AttributeType.STRING },
    });
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
    const eventBus = new events.EventBus(tablesStack, "EventBus", {
      eventBusName: "ai-learning-hub-events",
    });

    const stack = new SavesRoutesStack(app, "TestSavesRoutesStack", {
      env: awsEnv,
      restApiId: restApi.restApiId,
      rootResourceId: restApi.restApiRootResourceId,
      apiKeyAuthorizer,
      savesTable,
      usersTable,
      inviteCodesTable,
      idempotencyTable,
      eventsTable,
      eventBus,
    });

    template = Template.fromStack(stack);
  });

  describe("Lambda Functions", () => {
    it("creates 7 Lambda functions (create, list, get, update, delete, restore, events)", () => {
      template.resourceCountIs("AWS::Lambda::Function", 7);
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
    it("all functions have SAVES_TABLE_NAME", () => {
      const functions = template.findResources("AWS::Lambda::Function");
      for (const [logicalId, fn] of Object.entries(functions)) {
        const envVars = (
          fn as {
            Properties: { Environment: { Variables: Record<string, unknown> } };
          }
        ).Properties?.Environment?.Variables;
        expect(
          envVars?.SAVES_TABLE_NAME,
          `${logicalId} missing SAVES_TABLE_NAME`
        ).toBeDefined();
      }
    });

    it("mutation functions have EVENT_BUS_NAME", () => {
      const functions = template.findResources("AWS::Lambda::Function");
      const mutationFns = Object.entries(functions).filter(([, fn]) => {
        const envVars = (
          fn as {
            Properties: { Environment: { Variables: Record<string, unknown> } };
          }
        ).Properties?.Environment?.Variables;
        return envVars?.EVENT_BUS_NAME;
      });
      // create, update, delete, restore = 4 mutation functions
      expect(mutationFns).toHaveLength(4);
    });

    it("all functions have USERS_TABLE_NAME and INVITE_CODES_TABLE_NAME", () => {
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
        expect(
          envVars?.INVITE_CODES_TABLE_NAME,
          `${logicalId} missing INVITE_CODES_TABLE_NAME`
        ).toBeDefined();
      }
    });
  });

  describe("IAM Permissions — Narrowed (AC7, AC8)", () => {
    it("mutation functions have explicit usersTable policy with UpdateItem only", () => {
      const policies = template.findResources("AWS::IAM::Policy");
      const mutationNames = [
        "SavesCreate",
        "SavesUpdate",
        "SavesDelete",
        "SavesRestore",
      ];
      for (const fnName of mutationNames) {
        const found = Object.values(policies).some((resource) => {
          const statements =
            (
              resource as {
                Properties: {
                  PolicyDocument: { Statement: Array<Record<string, unknown>> };
                  Roles: Array<Record<string, unknown>>;
                };
              }
            ).Properties?.PolicyDocument?.Statement ?? [];
          const hasUpdateOnly = statements.some((s) => {
            const actions = s.Action;
            return (
              typeof actions === "string" && actions === "dynamodb:UpdateItem"
            );
          });
          const roles =
            (
              resource as {
                Properties: { Roles: Array<Record<string, unknown>> };
              }
            ).Properties?.Roles ?? [];
          const attachedToFn = roles.some((r) => {
            const ref = (r as Record<string, unknown>).Ref ?? "";
            return typeof ref === "string" && ref.includes(fnName);
          });
          return hasUpdateOnly && attachedToFn;
        });
        expect(
          found,
          `${fnName} missing UpdateItem-only usersTable policy`
        ).toBe(true);
      }
    });

    it("mutation functions have explicit eventsTable policy with PutItem only", () => {
      const policies = template.findResources("AWS::IAM::Policy");
      const mutationNames = [
        "SavesCreate",
        "SavesUpdate",
        "SavesDelete",
        "SavesRestore",
      ];
      for (const fnName of mutationNames) {
        const found = Object.values(policies).some((resource) => {
          const statements =
            (
              resource as {
                Properties: {
                  PolicyDocument: { Statement: Array<Record<string, unknown>> };
                  Roles: Array<Record<string, unknown>>;
                };
              }
            ).Properties?.PolicyDocument?.Statement ?? [];
          const hasPutOnly = statements.some((s) => {
            const actions = s.Action;
            if (typeof actions === "string")
              return actions === "dynamodb:PutItem";
            if (Array.isArray(actions))
              return actions.length === 1 && actions[0] === "dynamodb:PutItem";
            return false;
          });
          const roles =
            (
              resource as {
                Properties: { Roles: Array<Record<string, unknown>> };
              }
            ).Properties?.Roles ?? [];
          const attachedToFn = roles.some((r) => {
            const ref = (r as Record<string, unknown>).Ref ?? "";
            return typeof ref === "string" && ref.includes(fnName);
          });
          return hasPutOnly && attachedToFn;
        });
        expect(found, `${fnName} missing PutItem-only eventsTable policy`).toBe(
          true
        );
      }
    });

    it("savesGetFunction has explicit GetItem + UpdateItem policy (not broad grantReadWriteData)", () => {
      const policies = template.findResources("AWS::IAM::Policy");
      const found = Object.values(policies).some((resource) => {
        const statements =
          (
            resource as {
              Properties: {
                PolicyDocument: { Statement: Array<Record<string, unknown>> };
                Roles: Array<Record<string, unknown>>;
              };
            }
          ).Properties?.PolicyDocument?.Statement ?? [];
        const hasGetUpdate = statements.some((s) => {
          const actions = s.Action;
          if (!Array.isArray(actions)) return false;
          return (
            actions.includes("dynamodb:GetItem") &&
            actions.includes("dynamodb:UpdateItem") &&
            !actions.includes("dynamodb:PutItem") &&
            actions.length === 2
          );
        });
        const roles =
          (
            resource as {
              Properties: { Roles: Array<Record<string, unknown>> };
            }
          ).Properties?.Roles ?? [];
        const attachedToGet = roles.some((r) => {
          const ref = (r as Record<string, unknown>).Ref ?? "";
          return typeof ref === "string" && ref.includes("SavesGet");
        });
        return hasGetUpdate && attachedToGet;
      });
      expect(found, "SavesGet missing GetItem+UpdateItem policy").toBe(true);
    });

    it("mutation functions have EventBridge PutEvents permission", () => {
      template.hasResourceProperties("AWS::IAM::Policy", {
        PolicyDocument: {
          Statement: Match.arrayWith([
            Match.objectLike({
              Action: "events:PutEvents",
              Effect: "Allow",
            }),
          ]),
        },
      });
    });
  });

  describe("Route Resources", () => {
    it("creates /saves resource", () => {
      template.hasResourceProperties("AWS::ApiGateway::Resource", {
        PathPart: "saves",
      });
    });

    it("creates /saves/{saveId} resource", () => {
      template.hasResourceProperties("AWS::ApiGateway::Resource", {
        PathPart: "{saveId}",
      });
    });

    it("creates /saves/{saveId}/restore resource", () => {
      template.hasResourceProperties("AWS::ApiGateway::Resource", {
        PathPart: "restore",
      });
    });

    it("creates /saves/{saveId}/update-metadata resource", () => {
      template.hasResourceProperties("AWS::ApiGateway::Resource", {
        PathPart: "update-metadata",
      });
    });

    it("creates /saves/{saveId}/events resource", () => {
      template.hasResourceProperties("AWS::ApiGateway::Resource", {
        PathPart: "events",
      });
    });
  });

  describe("Route Methods", () => {
    it("creates POST method on /saves", () => {
      template.hasResourceProperties("AWS::ApiGateway::Method", {
        HttpMethod: "POST",
        AuthorizationType: "CUSTOM",
      });
    });

    it("creates GET method on /saves", () => {
      template.hasResourceProperties("AWS::ApiGateway::Method", {
        HttpMethod: "GET",
        AuthorizationType: "CUSTOM",
      });
    });

    it("creates PATCH method on /saves/{saveId}", () => {
      template.hasResourceProperties("AWS::ApiGateway::Method", {
        HttpMethod: "PATCH",
        AuthorizationType: "CUSTOM",
      });
    });

    it("creates DELETE method on /saves/{saveId}", () => {
      template.hasResourceProperties("AWS::ApiGateway::Method", {
        HttpMethod: "DELETE",
        AuthorizationType: "CUSTOM",
      });
    });

    it("all non-OPTIONS methods use CUSTOM auth type", () => {
      const allMethods = template.findResources("AWS::ApiGateway::Method");
      for (const [, method] of Object.entries(allMethods)) {
        const props = (method as { Properties: Record<string, unknown> })
          .Properties;
        if (props.HttpMethod !== "OPTIONS") {
          expect(props.AuthorizationType).toBe("CUSTOM");
        }
      }
    });

    it("creates OPTIONS preflight methods on route resources", () => {
      const allMethods = template.findResources("AWS::ApiGateway::Method");
      const optionsMethods = Object.entries(allMethods).filter(([, method]) => {
        const props = (method as { Properties: Record<string, unknown> })
          .Properties;
        return props.HttpMethod === "OPTIONS";
      });
      // /saves, /saves/{saveId}, /restore, /update-metadata, /events = 5
      expect(optionsMethods.length).toBeGreaterThanOrEqual(5);
    });
  });
});
