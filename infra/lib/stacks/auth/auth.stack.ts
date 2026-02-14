/**
 * Auth Stack — JWT Authorizer Lambda
 *
 * Creates the Lambda authorizer for Clerk JWT validation (ADR-013).
 * Requires the users table from TablesStack for profile lookups.
 */
import * as cdk from "aws-cdk-lib";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as lambdaNode from "aws-cdk-lib/aws-lambda-nodejs";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";

import { NagSuppressions } from "cdk-nag";
import { Construct } from "constructs";
import * as path from "path";

export interface AuthStackProps extends cdk.StackProps {
  usersTable: dynamodb.ITable;
}

export class AuthStack extends cdk.Stack {
  public readonly jwtAuthorizerFunction: lambdaNode.NodejsFunction;

  constructor(scope: Construct, id: string, props: AuthStackProps) {
    super(scope, id, props);

    const { usersTable } = props;

    // JWT Authorizer Lambda (ADR-013)
    this.jwtAuthorizerFunction = new lambdaNode.NodejsFunction(
      this,
      "JwtAuthorizerFunction",
      {
        runtime: lambda.Runtime.NODEJS_20_X,
        handler: "handler",
        entry: path.join(
          __dirname,
          "../../../../backend/functions/jwt-authorizer/handler.ts"
        ),
        memorySize: 256,
        timeout: cdk.Duration.seconds(10),
        environment: {
          CLERK_SECRET_KEY: `{{resolve:ssm-secure:/ai-learning-hub/clerk-secret-key}}`,
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

    // CDK Nag Suppressions
    NagSuppressions.addResourceSuppressions(
      this.jwtAuthorizerFunction,
      [
        {
          id: "AwsSolutions-IAM4",
          reason:
            "Lambda basic execution role (CloudWatch Logs, X-Ray) is managed by CDK construct",
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
  }
}
