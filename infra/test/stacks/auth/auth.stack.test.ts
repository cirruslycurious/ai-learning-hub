import { App, Stack } from "aws-cdk-lib";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import { Template, Match } from "aws-cdk-lib/assertions";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { describe, it, expect, beforeAll } from "vitest";
import { AuthStack } from "../../../lib/stacks/auth/auth.stack";
import { getAwsEnv } from "../../../config/aws-env";

describe("AuthStack", () => {
  let template: Template;

  beforeAll(() => {
    const app = new App();
    const awsEnv = getAwsEnv();

    // Create a mock tables stack to provide the users and invite-codes tables
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

    const stack = new AuthStack(app, "TestAuthStack", {
      env: awsEnv,
      usersTable,
      inviteCodesTable,
    });
    template = Template.fromStack(stack);
  });

  describe("JWT Authorizer Lambda", () => {
    it("creates all six Lambda functions (JWT, API Key, Users Me, Validate Invite, API Keys, Generate Invite)", () => {
      template.resourceCountIs("AWS::Lambda::Function", 6);
    });

    it("uses the latest Node.js runtime", () => {
      template.hasResourceProperties("AWS::Lambda::Function", {
        Runtime: lambda.Runtime.NODEJS_LATEST.name,
      });
    });

    it("sets correct handler entry point", () => {
      template.hasResourceProperties("AWS::Lambda::Function", {
        Handler: "index.handler",
      });
    });

    it("sets environment variables for Clerk SSM param and DynamoDB", () => {
      template.hasResourceProperties("AWS::Lambda::Function", {
        Environment: {
          Variables: Match.objectLike({
            CLERK_SECRET_KEY_PARAM: "/ai-learning-hub/clerk-secret-key",
            USERS_TABLE_NAME: Match.anyValue(),
          }),
        },
      });
    });

    it("has X-Ray tracing enabled", () => {
      template.hasResourceProperties("AWS::Lambda::Function", {
        TracingConfig: { Mode: "Active" },
      });
    });

    it("has reasonable memory and timeout", () => {
      template.hasResourceProperties("AWS::Lambda::Function", {
        MemorySize: 256,
        Timeout: 10,
      });
    });
  });

  describe("IAM Permissions", () => {
    it("grants the Lambda read/write access to users table", () => {
      // CDK grantReadWriteData creates a policy with DynamoDB actions
      // The actions may be in one or multiple statements depending on CDK version
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

    it("grants the Lambda ssm:GetParameter for the Clerk secret key", () => {
      template.hasResourceProperties("AWS::IAM::Policy", {
        PolicyDocument: {
          Statement: Match.arrayWith([
            Match.objectLike({
              Action: "ssm:GetParameter",
              Effect: "Allow",
            }),
          ]),
        },
      });
    });
  });

  describe("API Key Authorizer Lambda", () => {
    it("creates Lambdas with USERS_TABLE_NAME but without CLERK_SECRET_KEY_PARAM (Users Me, API Keys, Generate Invite)", () => {
      const lambdas = template.findResources("AWS::Lambda::Function");
      const nonClerkLambdas = Object.entries(lambdas).filter(([, resource]) => {
        const envVars = resource.Properties?.Environment?.Variables ?? {};
        return envVars.USERS_TABLE_NAME && !envVars.CLERK_SECRET_KEY_PARAM;
      });
      // 3 Lambdas: Users Me, API Keys, Generate Invite
      expect(nonClerkLambdas).toHaveLength(3);
    });

    it("creates Lambdas with both USERS_TABLE_NAME and CLERK_SECRET_KEY_PARAM (JWT authorizer + validate-invite + API Key authorizer)", () => {
      // JWT authorizer, validate-invite, and API Key authorizer (JWT fallback) have both
      const lambdas = template.findResources("AWS::Lambda::Function");
      const clerkLambdas = Object.entries(lambdas).filter(([, resource]) => {
        const envVars = resource.Properties?.Environment?.Variables ?? {};
        return envVars.USERS_TABLE_NAME && envVars.CLERK_SECRET_KEY_PARAM;
      });
      expect(clerkLambdas).toHaveLength(3);
    });

    it("API Key authorizer has ssm:GetParameter permission for Clerk secret (AC9)", () => {
      // Find the api-key-authorizer Lambda by its code entry path
      const lambdas = template.findResources("AWS::Lambda::Function");
      const apiKeyAuthEntry = Object.entries(lambdas).find(([, resource]) => {
        const envVars = resource.Properties?.Environment?.Variables ?? {};
        // Step 1: Confirm at least one Lambda has CLERK_SECRET_KEY_PARAM
        // Step 2 (below): Find IAM policies attached specifically to ApiKeyAuthorizer role
        return envVars.CLERK_SECRET_KEY_PARAM && envVars.USERS_TABLE_NAME;
      });
      expect(apiKeyAuthEntry).toBeDefined();

      // Find IAM policies that grant ssm:GetParameter and are attached to a role
      // that references the api-key-authorizer Lambda
      const policies = template.findResources("AWS::IAM::Policy");
      const ssmPoliciesForApiKeyAuth = Object.values(policies).filter(
        (resource) => {
          const statements =
            resource.Properties?.PolicyDocument?.Statement ?? [];
          const hasSsm = statements.some(
            (s: Record<string, unknown>) => s.Action === "ssm:GetParameter"
          );
          // Check if the policy is attached to a role that references the api-key-authorizer
          const roles = resource.Properties?.Roles ?? [];
          const attachedToApiKeyAuth = roles.some(
            (r: Record<string, unknown>) => {
              const ref = r.Ref ?? "";
              return (
                typeof ref === "string" && ref.includes("ApiKeyAuthorizer")
              );
            }
          );
          return hasSsm && attachedToApiKeyAuth;
        }
      );
      expect(ssmPoliciesForApiKeyAuth.length).toBeGreaterThanOrEqual(1);
    });

    it("API Key authorizer has dynamodb:PutItem permission for ensureProfile (AC7)", () => {
      // Find IAM policies granting PutItem that are attached to the api-key-authorizer's role
      const policies = template.findResources("AWS::IAM::Policy");
      const putItemPoliciesForApiKeyAuth = Object.values(policies).filter(
        (resource) => {
          const statements =
            resource.Properties?.PolicyDocument?.Statement ?? [];
          const hasPutItem = statements.some((s: Record<string, unknown>) => {
            const actions = s.Action;
            if (Array.isArray(actions)) {
              return actions.includes("dynamodb:PutItem");
            }
            return actions === "dynamodb:PutItem";
          });
          const roles = resource.Properties?.Roles ?? [];
          const attachedToApiKeyAuth = roles.some(
            (r: Record<string, unknown>) => {
              const ref = r.Ref ?? "";
              return (
                typeof ref === "string" && ref.includes("ApiKeyAuthorizer")
              );
            }
          );
          return hasPutItem && attachedToApiKeyAuth;
        }
      );
      expect(putItemPoliciesForApiKeyAuth.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("Stack Outputs", () => {
    it("exports the JWT authorizer function ARN", () => {
      const outputs = template.findOutputs("*");
      expect(outputs.JwtAuthorizerFunctionArn).toBeDefined();
    });

    it("exports the JWT authorizer function name", () => {
      const outputs = template.findOutputs("*");
      expect(outputs.JwtAuthorizerFunctionName).toBeDefined();
    });

    it("exports the API key authorizer function ARN", () => {
      const outputs = template.findOutputs("*");
      expect(outputs.ApiKeyAuthorizerFunctionArn).toBeDefined();
    });

    it("exports the API key authorizer function name", () => {
      const outputs = template.findOutputs("*");
      expect(outputs.ApiKeyAuthorizerFunctionName).toBeDefined();
    });

    it("exports the Users Me function ARN", () => {
      const outputs = template.findOutputs("*");
      expect(outputs.UsersMeFunctionArn).toBeDefined();
    });

    it("exports the Users Me function name", () => {
      const outputs = template.findOutputs("*");
      expect(outputs.UsersMeFunctionName).toBeDefined();
    });

    it("exports the validate invite function ARN", () => {
      const outputs = template.findOutputs("*");
      expect(outputs.ValidateInviteFunctionArn).toBeDefined();
    });

    it("exports the validate invite function name", () => {
      const outputs = template.findOutputs("*");
      expect(outputs.ValidateInviteFunctionName).toBeDefined();
    });

    it("exports the API keys function ARN", () => {
      const outputs = template.findOutputs("*");
      expect(outputs.ApiKeysFunctionArn).toBeDefined();
    });

    it("exports the API keys function name", () => {
      const outputs = template.findOutputs("*");
      expect(outputs.ApiKeysFunctionName).toBeDefined();
    });

    it("exports the generate invite function ARN", () => {
      const outputs = template.findOutputs("*");
      expect(outputs.GenerateInviteFunctionArn).toBeDefined();
    });

    it("exports the generate invite function name", () => {
      const outputs = template.findOutputs("*");
      expect(outputs.GenerateInviteFunctionName).toBeDefined();
    });
  });

  describe("Validate Invite Lambda", () => {
    it("creates all Lambdas with INVITE_CODES_TABLE_NAME environment variable", () => {
      // All 6 Lambdas need INVITE_CODES_TABLE_NAME because they bundle code
      // that imports the invite-codes DB module, which requires the env var
      // at module initialization time (D7 fail-fast pattern).
      const lambdas = template.findResources("AWS::Lambda::Function");
      const inviteCodeLambdas = Object.values(lambdas).filter((resource) => {
        const envVars = resource.Properties?.Environment?.Variables ?? {};
        return envVars.INVITE_CODES_TABLE_NAME;
      });
      expect(inviteCodeLambdas).toHaveLength(6);
    });
  });
});
