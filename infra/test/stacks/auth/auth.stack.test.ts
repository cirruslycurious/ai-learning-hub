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
    it("creates a Lambda function", () => {
      template.resourceCountIs("AWS::Lambda::Function", 1);
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

    it("sets environment variables for Clerk and DynamoDB", () => {
      template.hasResourceProperties("AWS::Lambda::Function", {
        Environment: {
          Variables: Match.objectLike({
            CLERK_SECRET_KEY: Match.anyValue(),
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
  });
});
