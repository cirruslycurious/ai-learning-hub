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

    // Create a mock tables stack to provide the users table
    const tablesStack = new Stack(app, "TestTablesStack", { env: awsEnv });
    const usersTable = new dynamodb.Table(tablesStack, "UsersTable", {
      tableName: "ai-learning-hub-users",
      partitionKey: { name: "PK", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "SK", type: dynamodb.AttributeType.STRING },
    });

    const stack = new AuthStack(app, "TestAuthStack", {
      env: awsEnv,
      usersTable,
    });
    template = Template.fromStack(stack);
  });

  describe("JWT Authorizer Lambda", () => {
    it("creates both authorizer Lambda functions", () => {
      template.resourceCountIs("AWS::Lambda::Function", 2);
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
    it("creates exactly one Lambda with USERS_TABLE_NAME but without CLERK_SECRET_KEY_PARAM", () => {
      // Find all Lambda functions and identify the API key authorizer:
      // it has USERS_TABLE_NAME but NOT CLERK_SECRET_KEY_PARAM
      const lambdas = template.findResources("AWS::Lambda::Function");
      const apiKeyLambdas = Object.entries(lambdas).filter(([, resource]) => {
        const envVars = resource.Properties?.Environment?.Variables ?? {};
        return envVars.USERS_TABLE_NAME && !envVars.CLERK_SECRET_KEY_PARAM;
      });
      expect(apiKeyLambdas).toHaveLength(1);
    });

    it("creates exactly one Lambda with both USERS_TABLE_NAME and CLERK_SECRET_KEY_PARAM (JWT authorizer)", () => {
      // The JWT authorizer has both USERS_TABLE_NAME and CLERK_SECRET_KEY_PARAM
      const lambdas = template.findResources("AWS::Lambda::Function");
      const jwtLambdas = Object.entries(lambdas).filter(([, resource]) => {
        const envVars = resource.Properties?.Environment?.Variables ?? {};
        return envVars.USERS_TABLE_NAME && envVars.CLERK_SECRET_KEY_PARAM;
      });
      expect(jwtLambdas).toHaveLength(1);
    });

    it("API key authorizer Lambda has USERS_TABLE_NAME environment variable", () => {
      const lambdas = template.findResources("AWS::Lambda::Function");
      const apiKeyLambda = Object.values(lambdas).find((resource) => {
        const envVars = resource.Properties?.Environment?.Variables ?? {};
        return envVars.USERS_TABLE_NAME && !envVars.CLERK_SECRET_KEY_PARAM;
      });
      expect(apiKeyLambda).toBeDefined();
      expect(
        apiKeyLambda!.Properties.Environment.Variables.USERS_TABLE_NAME
      ).toBeDefined();
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
  });
});
