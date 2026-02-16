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
    it("creates all four Lambda functions (JWT, API Key, Users Me, Validate Invite)", () => {
      template.resourceCountIs("AWS::Lambda::Function", 4);
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
    it("creates a Lambda with USERS_TABLE_NAME but without CLERK_SECRET_KEY_PARAM (API Key authorizer)", () => {
      const lambdas = template.findResources("AWS::Lambda::Function");
      const nonJwtLambdas = Object.entries(lambdas).filter(([, resource]) => {
        const envVars = resource.Properties?.Environment?.Variables ?? {};
        return envVars.USERS_TABLE_NAME && !envVars.CLERK_SECRET_KEY_PARAM;
      });
      expect(nonJwtLambdas).toHaveLength(2);
    });

    it("creates Lambdas with both USERS_TABLE_NAME and CLERK_SECRET_KEY_PARAM (JWT authorizer + validate-invite)", () => {
      // Both JWT authorizer and validate-invite have USERS_TABLE_NAME and CLERK_SECRET_KEY_PARAM
      const lambdas = template.findResources("AWS::Lambda::Function");
      const clerkLambdas = Object.entries(lambdas).filter(([, resource]) => {
        const envVars = resource.Properties?.Environment?.Variables ?? {};
        return envVars.USERS_TABLE_NAME && envVars.CLERK_SECRET_KEY_PARAM;
      });
      expect(clerkLambdas).toHaveLength(2);
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
  });

  describe("Validate Invite Lambda", () => {
    it("creates a Lambda with INVITE_CODES_TABLE_NAME environment variable", () => {
      const lambdas = template.findResources("AWS::Lambda::Function");
      const validateLambda = Object.values(lambdas).find((resource) => {
        const envVars = resource.Properties?.Environment?.Variables ?? {};
        return envVars.INVITE_CODES_TABLE_NAME;
      });
      expect(validateLambda).toBeDefined();
    });
  });
});
