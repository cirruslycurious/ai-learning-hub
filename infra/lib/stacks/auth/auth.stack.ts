/**
 * Auth Stack — JWT and API Key Authorizer Lambdas
 *
 * Creates Lambda authorizers for Clerk JWT validation and API key
 * authentication (ADR-013). Requires the users table from TablesStack.
 */
import * as cdk from "aws-cdk-lib";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as lambdaNode from "aws-cdk-lib/aws-lambda-nodejs";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";

import { NagSuppressions } from "cdk-nag";
import { Construct } from "constructs";
import * as path from "path";

const CLERK_SECRET_KEY_PARAM = "/ai-learning-hub/clerk-secret-key";

export interface AuthStackProps extends cdk.StackProps {
  usersTable: dynamodb.ITable;
  inviteCodesTable: dynamodb.ITable;
}

export class AuthStack extends cdk.Stack {
  public readonly jwtAuthorizerFunction: lambdaNode.NodejsFunction;
  public readonly apiKeyAuthorizerFunction: lambdaNode.NodejsFunction;
  public readonly validateInviteFunction: lambdaNode.NodejsFunction;

  constructor(scope: Construct, id: string, props: AuthStackProps) {
    super(scope, id, props);

    const { usersTable, inviteCodesTable } = props;

    // JWT Authorizer Lambda (ADR-013)
    this.jwtAuthorizerFunction = new lambdaNode.NodejsFunction(
      this,
      "JwtAuthorizerFunction",
      {
        runtime: lambda.Runtime.NODEJS_LATEST,
        handler: "handler",
        entry: path.join(
          process.cwd(),
          "..",
          "backend",
          "functions",
          "jwt-authorizer",
          "handler.ts"
        ),
        memorySize: 256,
        timeout: cdk.Duration.seconds(10),
        environment: {
          CLERK_SECRET_KEY_PARAM: CLERK_SECRET_KEY_PARAM,
          USERS_TABLE_NAME: usersTable.tableName,
        },
        bundling: {
          minify: true,
          sourceMap: true,
          externalModules: ["@aws-sdk/*"],
        },
        tracing: lambda.Tracing.ACTIVE,
      }
    );

    // Grant read/write to users table (PutItem for ensureProfile, GetItem for getProfile)
    usersTable.grantReadWriteData(this.jwtAuthorizerFunction);

    // Grant read access to Clerk secret key in SSM Parameter Store
    this.jwtAuthorizerFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["ssm:GetParameter"],
        resources: [
          cdk.Arn.format(
            {
              service: "ssm",
              resource: "parameter",
              resourceName: CLERK_SECRET_KEY_PARAM.replace(/^\//, ""),
            },
            this
          ),
        ],
      })
    );

    // CDK Nag Suppressions
    NagSuppressions.addResourceSuppressions(
      this.jwtAuthorizerFunction,
      [
        {
          id: "AwsSolutions-IAM4",
          reason:
            "Lambda basic execution role (CloudWatch Logs, X-Ray) is managed by CDK construct",
        },
        {
          id: "AwsSolutions-L1",
          reason:
            "Using NODEJS_LATEST which resolves to the latest stable Node.js runtime supported by CDK",
        },
      ],
      true
    );

    NagSuppressions.addResourceSuppressions(
      this.jwtAuthorizerFunction.role!,
      [
        {
          id: "AwsSolutions-IAM5",
          reason:
            "Wildcard permissions for DynamoDB table read/write and X-Ray are scoped to specific table ARN by CDK grantReadWriteData",
        },
      ],
      true
    );

    // Stack Outputs
    new cdk.CfnOutput(this, "JwtAuthorizerFunctionArn", {
      value: this.jwtAuthorizerFunction.functionArn,
      description: "JWT Authorizer Lambda function ARN",
      exportName: "AiLearningHub-JwtAuthorizerFunctionArn",
    });

    new cdk.CfnOutput(this, "JwtAuthorizerFunctionName", {
      value: this.jwtAuthorizerFunction.functionName,
      description: "JWT Authorizer Lambda function name",
      exportName: "AiLearningHub-JwtAuthorizerFunctionName",
    });

    // API Key Authorizer Lambda (ADR-013, Story 2.2)
    this.apiKeyAuthorizerFunction = new lambdaNode.NodejsFunction(
      this,
      "ApiKeyAuthorizerFunction",
      {
        runtime: lambda.Runtime.NODEJS_LATEST,
        handler: "handler",
        entry: path.join(
          process.cwd(),
          "..",
          "backend",
          "functions",
          "api-key-authorizer",
          "handler.ts"
        ),
        memorySize: 256,
        timeout: cdk.Duration.seconds(10),
        environment: {
          USERS_TABLE_NAME: usersTable.tableName,
        },
        bundling: {
          minify: true,
          sourceMap: true,
          externalModules: ["@aws-sdk/*"],
        },
        tracing: lambda.Tracing.ACTIVE,
      }
    );

    // Grant read/write to users table (Query GSI for key lookup, GetItem for profile, UpdateItem for lastUsedAt)
    usersTable.grantReadWriteData(this.apiKeyAuthorizerFunction);

    // CDK Nag Suppressions for API Key Authorizer
    NagSuppressions.addResourceSuppressions(
      this.apiKeyAuthorizerFunction,
      [
        {
          id: "AwsSolutions-IAM4",
          reason:
            "Lambda basic execution role (CloudWatch Logs, X-Ray) is managed by CDK construct",
        },
        {
          id: "AwsSolutions-L1",
          reason:
            "Using NODEJS_LATEST which resolves to the latest stable Node.js runtime supported by CDK",
        },
      ],
      true
    );

    NagSuppressions.addResourceSuppressions(
      this.apiKeyAuthorizerFunction.role!,
      [
        {
          id: "AwsSolutions-IAM5",
          reason:
            "Wildcard permissions for DynamoDB table read/write and X-Ray are scoped to specific table ARN by CDK grantReadWriteData",
        },
      ],
      true
    );

    // API Key Authorizer Stack Outputs
    new cdk.CfnOutput(this, "ApiKeyAuthorizerFunctionArn", {
      value: this.apiKeyAuthorizerFunction.functionArn,
      description: "API Key Authorizer Lambda function ARN",
      exportName: "AiLearningHub-ApiKeyAuthorizerFunctionArn",
    });

    new cdk.CfnOutput(this, "ApiKeyAuthorizerFunctionName", {
      value: this.apiKeyAuthorizerFunction.functionName,
      description: "API Key Authorizer Lambda function name",
      exportName: "AiLearningHub-ApiKeyAuthorizerFunctionName",
    });

    // Validate Invite Lambda (Story 2.4)
    this.validateInviteFunction = new lambdaNode.NodejsFunction(
      this,
      "ValidateInviteFunction",
      {
        runtime: lambda.Runtime.NODEJS_LATEST,
        handler: "handler",
        entry: path.join(
          process.cwd(),
          "..",
          "backend",
          "functions",
          "validate-invite",
          "handler.ts"
        ),
        memorySize: 256,
        timeout: cdk.Duration.seconds(10),
        environment: {
          CLERK_SECRET_KEY_PARAM: CLERK_SECRET_KEY_PARAM,
          INVITE_CODES_TABLE_NAME: inviteCodesTable.tableName,
          USERS_TABLE_NAME: usersTable.tableName,
        },
        bundling: {
          minify: true,
          sourceMap: true,
          externalModules: ["@aws-sdk/*"],
        },
        tracing: lambda.Tracing.ACTIVE,
      }
    );

    // Grant read/write to invite-codes table (GetItem for lookup, UpdateItem for redemption)
    inviteCodesTable.grantReadWriteData(this.validateInviteFunction);

    // Grant read to users table (for profile checks)
    usersTable.grantReadData(this.validateInviteFunction);

    // Grant read access to Clerk secret key in SSM Parameter Store
    this.validateInviteFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["ssm:GetParameter"],
        resources: [
          cdk.Arn.format(
            {
              service: "ssm",
              resource: "parameter",
              resourceName: CLERK_SECRET_KEY_PARAM.replace(/^\//, ""),
            },
            this
          ),
        ],
      })
    );

    // CDK Nag Suppressions for Validate Invite
    NagSuppressions.addResourceSuppressions(
      this.validateInviteFunction,
      [
        {
          id: "AwsSolutions-IAM4",
          reason:
            "Lambda basic execution role (CloudWatch Logs, X-Ray) is managed by CDK construct",
        },
        {
          id: "AwsSolutions-L1",
          reason:
            "Using NODEJS_LATEST which resolves to the latest stable Node.js runtime supported by CDK",
        },
      ],
      true
    );

    NagSuppressions.addResourceSuppressions(
      this.validateInviteFunction.role!,
      [
        {
          id: "AwsSolutions-IAM5",
          reason:
            "Wildcard permissions for DynamoDB table read/write and X-Ray are scoped to specific table ARN by CDK grantReadWriteData",
        },
      ],
      true
    );

    // Validate Invite Stack Outputs
    new cdk.CfnOutput(this, "ValidateInviteFunctionArn", {
      value: this.validateInviteFunction.functionArn,
      description: "Validate Invite Lambda function ARN",
      exportName: "AiLearningHub-ValidateInviteFunctionArn",
    });

    new cdk.CfnOutput(this, "ValidateInviteFunctionName", {
      value: this.validateInviteFunction.functionName,
      description: "Validate Invite Lambda function name",
      exportName: "AiLearningHub-ValidateInviteFunctionName",
    });
  }
}
