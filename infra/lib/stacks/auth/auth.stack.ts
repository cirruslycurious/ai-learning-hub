/**
 * Auth Stack — JWT and API Key Authorizer Lambdas + Auth Domain Handlers
 *
 * Creates Lambda authorizers for Clerk JWT validation and API key
 * authentication (ADR-013), plus per-method handler functions for
 * api-keys, invite-codes, users-me, and validate-invite domains.
 *
 * Story 3.5.2: Split combined handlers into per-method Lambda functions
 * so that wrapHandler middleware (idempotency, rate limiting, scope
 * enforcement) is active in production on every route.
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
  savesTable: dynamodb.ITable;
  idempotencyTable: dynamodb.ITable;
  eventsTable: dynamodb.ITable;
}

export class AuthStack extends cdk.Stack {
  public readonly jwtAuthorizerFunction: lambdaNode.NodejsFunction;
  public readonly apiKeyAuthorizerFunction: lambdaNode.NodejsFunction;
  public readonly validateInviteFunction: lambdaNode.NodejsFunction;
  public readonly createApiKeyFunction: lambdaNode.NodejsFunction;
  public readonly listApiKeyFunction: lambdaNode.NodejsFunction;
  public readonly revokeApiKeyFunction: lambdaNode.NodejsFunction;
  public readonly generateInviteFunction: lambdaNode.NodejsFunction;
  public readonly listInviteCodesFunction: lambdaNode.NodejsFunction;
  public readonly readUsersMeFunction: lambdaNode.NodejsFunction;
  public readonly writeUsersMeFunction: lambdaNode.NodejsFunction;

  constructor(scope: Construct, id: string, props: AuthStackProps) {
    super(scope, id, props);

    const {
      usersTable,
      inviteCodesTable,
      savesTable,
      idempotencyTable,
      eventsTable,
    } = props;

    // Shared Lambda config for auth domain handlers
    const sharedLambdaProps = {
      runtime: lambda.Runtime.NODEJS_LATEST,
      memorySize: 256,
      timeout: cdk.Duration.seconds(10),
      bundling: {
        minify: true,
        sourceMap: true,
        externalModules: ["@aws-sdk/*"],
      },
      tracing: lambda.Tracing.ACTIVE,
    };

    // ─── JWT Authorizer Lambda (ADR-013) ───────────────────────────────

    this.jwtAuthorizerFunction = new lambdaNode.NodejsFunction(
      this,
      "JwtAuthorizerFunction",
      {
        ...sharedLambdaProps,
        handler: "handler",
        entry: path.join(
          process.cwd(),
          "..",
          "backend",
          "functions",
          "jwt-authorizer",
          "handler.ts"
        ),
        environment: {
          CLERK_SECRET_KEY_PARAM: CLERK_SECRET_KEY_PARAM,
          USERS_TABLE_NAME: usersTable.tableName,
          INVITE_CODES_TABLE_NAME: inviteCodesTable.tableName,
          SAVES_TABLE_NAME: savesTable.tableName,
          IDEMPOTENCY_TABLE_NAME: idempotencyTable.tableName,
          EVENTS_TABLE_NAME: eventsTable.tableName,
        },
      }
    );

    // GetItem: profile lookup, PutItem: ensureProfile, UpdateItem: profile updates, Query: GSI lookups
    this.jwtAuthorizerFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:Query",
        ],
        resources: [usersTable.tableArn, `${usersTable.tableArn}/index/*`],
      })
    );

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
            "Wildcard sub-resource permissions for DynamoDB GSI index/* and X-Ray tracing are scoped to specific table ARN",
        },
      ],
      true
    );

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

    // ─── API Key Authorizer Lambda (ADR-013, Story 2.2) ───────────────

    this.apiKeyAuthorizerFunction = new lambdaNode.NodejsFunction(
      this,
      "ApiKeyAuthorizerFunction",
      {
        ...sharedLambdaProps,
        handler: "handler",
        entry: path.join(
          process.cwd(),
          "..",
          "backend",
          "functions",
          "api-key-authorizer",
          "handler.ts"
        ),
        environment: {
          CLERK_SECRET_KEY_PARAM: CLERK_SECRET_KEY_PARAM,
          USERS_TABLE_NAME: usersTable.tableName,
          INVITE_CODES_TABLE_NAME: inviteCodesTable.tableName,
          SAVES_TABLE_NAME: savesTable.tableName,
          IDEMPOTENCY_TABLE_NAME: idempotencyTable.tableName,
          EVENTS_TABLE_NAME: eventsTable.tableName,
        },
      }
    );

    // Query: GSI lookup (apiKeyHash-index), GetItem: profile, UpdateItem: lastUsedAt,
    // PutItem: ensureProfile for JWT fallback create-on-first-auth (Story 2.1-D10)
    this.apiKeyAuthorizerFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:Query",
          "dynamodb:UpdateItem",
        ],
        resources: [usersTable.tableArn, `${usersTable.tableArn}/index/*`],
      })
    );

    this.apiKeyAuthorizerFunction.addToRolePolicy(
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
            "Wildcard sub-resource permissions for DynamoDB GSI index/* and X-Ray tracing are scoped to specific table ARN",
        },
      ],
      true
    );

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

    // ─── Users Me — Read (GET /users/me) ───────────────────────────────

    this.readUsersMeFunction = new lambdaNode.NodejsFunction(
      this,
      "ReadUsersMeFunction",
      {
        ...sharedLambdaProps,
        handler: "readHandler",
        entry: path.join(
          process.cwd(),
          "..",
          "backend",
          "functions",
          "users-me",
          "handler.ts"
        ),
        environment: {
          USERS_TABLE_NAME: usersTable.tableName,
          INVITE_CODES_TABLE_NAME: inviteCodesTable.tableName,
          SAVES_TABLE_NAME: savesTable.tableName,
          IDEMPOTENCY_TABLE_NAME: idempotencyTable.tableName,
          EVENTS_TABLE_NAME: eventsTable.tableName,
        },
      }
    );

    // getProfile → GetItem on usersTable (read-only, no mutations)
    this.readUsersMeFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["dynamodb:GetItem"],
        resources: [usersTable.tableArn],
      })
    );

    NagSuppressions.addResourceSuppressions(
      this.readUsersMeFunction,
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
      this.readUsersMeFunction.role!,
      [
        {
          id: "AwsSolutions-IAM5",
          reason:
            "Wildcard sub-resource permissions for X-Ray tracing are managed by CDK Lambda construct",
        },
      ],
      true
    );

    new cdk.CfnOutput(this, "ReadUsersMeFunctionArn", {
      value: this.readUsersMeFunction.functionArn,
      description: "Read Users Me Lambda function ARN",
      exportName: "AiLearningHub-ReadUsersMeFunctionArn",
    });

    new cdk.CfnOutput(this, "ReadUsersMeFunctionName", {
      value: this.readUsersMeFunction.functionName,
      description: "Read Users Me Lambda function name",
      exportName: "AiLearningHub-ReadUsersMeFunctionName",
    });

    // ─── Users Me — Write (PATCH /users/me, POST /users/me/update) ─────

    this.writeUsersMeFunction = new lambdaNode.NodejsFunction(
      this,
      "WriteUsersMeFunction",
      {
        ...sharedLambdaProps,
        handler: "writeHandler",
        entry: path.join(
          process.cwd(),
          "..",
          "backend",
          "functions",
          "users-me",
          "handler.ts"
        ),
        environment: {
          USERS_TABLE_NAME: usersTable.tableName,
          INVITE_CODES_TABLE_NAME: inviteCodesTable.tableName,
          SAVES_TABLE_NAME: savesTable.tableName,
          IDEMPOTENCY_TABLE_NAME: idempotencyTable.tableName,
          EVENTS_TABLE_NAME: eventsTable.tableName,
        },
      }
    );

    // updateProfileWithEvents → GetItem (pre-read) + UpdateItem on usersTable
    // Rate limit counter → UpdateItem on usersTable (already covered)
    this.writeUsersMeFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["dynamodb:GetItem", "dynamodb:UpdateItem"],
        resources: [usersTable.tableArn],
      })
    );

    // recordEvent → PutItem on eventsTable (AC7)
    this.writeUsersMeFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["dynamodb:PutItem"],
        resources: [eventsTable.tableArn],
      })
    );

    // Idempotency middleware → GetItem + PutItem on idempotencyTable (AC9)
    this.writeUsersMeFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["dynamodb:GetItem", "dynamodb:PutItem"],
        resources: [idempotencyTable.tableArn],
      })
    );

    NagSuppressions.addResourceSuppressions(
      this.writeUsersMeFunction,
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
      this.writeUsersMeFunction.role!,
      [
        {
          id: "AwsSolutions-IAM5",
          reason:
            "Wildcard sub-resource permissions for X-Ray tracing are managed by CDK Lambda construct",
        },
      ],
      true
    );

    new cdk.CfnOutput(this, "WriteUsersMeFunctionArn", {
      value: this.writeUsersMeFunction.functionArn,
      description: "Write Users Me Lambda function ARN",
      exportName: "AiLearningHub-WriteUsersMeFunctionArn",
    });

    new cdk.CfnOutput(this, "WriteUsersMeFunctionName", {
      value: this.writeUsersMeFunction.functionName,
      description: "Write Users Me Lambda function name",
      exportName: "AiLearningHub-WriteUsersMeFunctionName",
    });

    // ─── Validate Invite Lambda (Story 2.4) ────────────────────────────

    this.validateInviteFunction = new lambdaNode.NodejsFunction(
      this,
      "ValidateInviteFunction",
      {
        ...sharedLambdaProps,
        handler: "handler",
        entry: path.join(
          process.cwd(),
          "..",
          "backend",
          "functions",
          "validate-invite",
          "handler.ts"
        ),
        environment: {
          CLERK_SECRET_KEY_PARAM: CLERK_SECRET_KEY_PARAM,
          INVITE_CODES_TABLE_NAME: inviteCodesTable.tableName,
          USERS_TABLE_NAME: usersTable.tableName,
          SAVES_TABLE_NAME: savesTable.tableName,
          IDEMPOTENCY_TABLE_NAME: idempotencyTable.tableName,
          EVENTS_TABLE_NAME: eventsTable.tableName,
        },
      }
    );

    // GetItem for invite lookup, UpdateItem for redemption
    this.validateInviteFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["dynamodb:GetItem", "dynamodb:UpdateItem"],
        resources: [
          inviteCodesTable.tableArn,
          `${inviteCodesTable.tableArn}/index/*`,
        ],
      })
    );

    // UpdateItem for rate limit counter increments (Story 2.7)
    this.validateInviteFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["dynamodb:UpdateItem"],
        resources: [usersTable.tableArn],
      })
    );

    // recordEvent → PutItem on eventsTable (AC7, Story 3.5.2)
    this.validateInviteFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["dynamodb:PutItem"],
        resources: [eventsTable.tableArn],
      })
    );

    // Idempotency middleware → GetItem + PutItem on idempotencyTable (AC8, Story 3.5.2)
    this.validateInviteFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["dynamodb:GetItem", "dynamodb:PutItem"],
        resources: [idempotencyTable.tableArn],
      })
    );

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
            "Index ARN wildcards are standard CDK behavior for GSI access; X-Ray tracing is managed by CDK Lambda construct",
        },
      ],
      true
    );

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

    // ─── API Keys — Create (POST /users/api-keys) ─────────────────────

    this.createApiKeyFunction = new lambdaNode.NodejsFunction(
      this,
      "CreateApiKeyFunction",
      {
        ...sharedLambdaProps,
        handler: "createHandler",
        entry: path.join(
          process.cwd(),
          "..",
          "backend",
          "functions",
          "api-keys",
          "handler.ts"
        ),
        environment: {
          USERS_TABLE_NAME: usersTable.tableName,
          INVITE_CODES_TABLE_NAME: inviteCodesTable.tableName,
          SAVES_TABLE_NAME: savesTable.tableName,
          IDEMPOTENCY_TABLE_NAME: idempotencyTable.tableName,
          EVENTS_TABLE_NAME: eventsTable.tableName,
        },
      }
    );

    // createApiKey → PutItem on usersTable; rate limit → UpdateItem on usersTable
    this.createApiKeyFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["dynamodb:PutItem", "dynamodb:UpdateItem"],
        resources: [usersTable.tableArn],
      })
    );

    // recordEvent → PutItem on eventsTable (AC7)
    this.createApiKeyFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["dynamodb:PutItem"],
        resources: [eventsTable.tableArn],
      })
    );

    // Idempotency middleware → GetItem + PutItem on idempotencyTable (AC9)
    this.createApiKeyFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["dynamodb:GetItem", "dynamodb:PutItem"],
        resources: [idempotencyTable.tableArn],
      })
    );

    NagSuppressions.addResourceSuppressions(
      this.createApiKeyFunction,
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
      this.createApiKeyFunction.role!,
      [
        {
          id: "AwsSolutions-IAM5",
          reason:
            "Wildcard sub-resource permissions for X-Ray tracing are managed by CDK Lambda construct",
        },
      ],
      true
    );

    new cdk.CfnOutput(this, "CreateApiKeyFunctionArn", {
      value: this.createApiKeyFunction.functionArn,
      description: "Create API Key Lambda function ARN",
      exportName: "AiLearningHub-CreateApiKeyFunctionArn",
    });

    new cdk.CfnOutput(this, "CreateApiKeyFunctionName", {
      value: this.createApiKeyFunction.functionName,
      description: "Create API Key Lambda function name",
      exportName: "AiLearningHub-CreateApiKeyFunctionName",
    });

    // ─── API Keys — List (GET /users/api-keys) ────────────────────────

    this.listApiKeyFunction = new lambdaNode.NodejsFunction(
      this,
      "ListApiKeyFunction",
      {
        ...sharedLambdaProps,
        handler: "listHandler",
        entry: path.join(
          process.cwd(),
          "..",
          "backend",
          "functions",
          "api-keys",
          "handler.ts"
        ),
        environment: {
          USERS_TABLE_NAME: usersTable.tableName,
          INVITE_CODES_TABLE_NAME: inviteCodesTable.tableName,
          SAVES_TABLE_NAME: savesTable.tableName,
          IDEMPOTENCY_TABLE_NAME: idempotencyTable.tableName,
          EVENTS_TABLE_NAME: eventsTable.tableName,
        },
      }
    );

    // listApiKeys → Query on usersTable (base table query by PK + SK prefix)
    this.listApiKeyFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["dynamodb:Query"],
        resources: [usersTable.tableArn, `${usersTable.tableArn}/index/*`],
      })
    );

    NagSuppressions.addResourceSuppressions(
      this.listApiKeyFunction,
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
      this.listApiKeyFunction.role!,
      [
        {
          id: "AwsSolutions-IAM5",
          reason:
            "Wildcard sub-resource permissions for DynamoDB GSI index/* and X-Ray tracing are scoped to specific table ARN",
        },
      ],
      true
    );

    new cdk.CfnOutput(this, "ListApiKeyFunctionArn", {
      value: this.listApiKeyFunction.functionArn,
      description: "List API Key Lambda function ARN",
      exportName: "AiLearningHub-ListApiKeyFunctionArn",
    });

    new cdk.CfnOutput(this, "ListApiKeyFunctionName", {
      value: this.listApiKeyFunction.functionName,
      description: "List API Key Lambda function name",
      exportName: "AiLearningHub-ListApiKeyFunctionName",
    });

    // ─── API Keys — Revoke (DELETE /users/api-keys/{id}, POST /users/api-keys/{id}/revoke) ──

    this.revokeApiKeyFunction = new lambdaNode.NodejsFunction(
      this,
      "RevokeApiKeyFunction",
      {
        ...sharedLambdaProps,
        handler: "revokeHandler",
        entry: path.join(
          process.cwd(),
          "..",
          "backend",
          "functions",
          "api-keys",
          "handler.ts"
        ),
        environment: {
          USERS_TABLE_NAME: usersTable.tableName,
          INVITE_CODES_TABLE_NAME: inviteCodesTable.tableName,
          SAVES_TABLE_NAME: savesTable.tableName,
          IDEMPOTENCY_TABLE_NAME: idempotencyTable.tableName,
          EVENTS_TABLE_NAME: eventsTable.tableName,
        },
      }
    );

    // revokeApiKey → UpdateItem on usersTable; rate limit → UpdateItem (covered)
    this.revokeApiKeyFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["dynamodb:UpdateItem"],
        resources: [usersTable.tableArn],
      })
    );

    // recordEvent → PutItem on eventsTable (AC7)
    this.revokeApiKeyFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["dynamodb:PutItem"],
        resources: [eventsTable.tableArn],
      })
    );

    // Idempotency middleware → GetItem + PutItem on idempotencyTable (AC9)
    this.revokeApiKeyFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["dynamodb:GetItem", "dynamodb:PutItem"],
        resources: [idempotencyTable.tableArn],
      })
    );

    NagSuppressions.addResourceSuppressions(
      this.revokeApiKeyFunction,
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
      this.revokeApiKeyFunction.role!,
      [
        {
          id: "AwsSolutions-IAM5",
          reason:
            "Wildcard sub-resource permissions for X-Ray tracing are managed by CDK Lambda construct",
        },
      ],
      true
    );

    new cdk.CfnOutput(this, "RevokeApiKeyFunctionArn", {
      value: this.revokeApiKeyFunction.functionArn,
      description: "Revoke API Key Lambda function ARN",
      exportName: "AiLearningHub-RevokeApiKeyFunctionArn",
    });

    new cdk.CfnOutput(this, "RevokeApiKeyFunctionName", {
      value: this.revokeApiKeyFunction.functionName,
      description: "Revoke API Key Lambda function name",
      exportName: "AiLearningHub-RevokeApiKeyFunctionName",
    });

    // ─── Generate Invite (POST /users/invite-codes) ────────────────────

    this.generateInviteFunction = new lambdaNode.NodejsFunction(
      this,
      "GenerateInviteFunction",
      {
        ...sharedLambdaProps,
        handler: "generateHandler",
        entry: path.join(
          process.cwd(),
          "..",
          "backend",
          "functions",
          "invite-codes",
          "handler.ts"
        ),
        environment: {
          INVITE_CODES_TABLE_NAME: inviteCodesTable.tableName,
          USERS_TABLE_NAME: usersTable.tableName,
          SAVES_TABLE_NAME: savesTable.tableName,
          IDEMPOTENCY_TABLE_NAME: idempotencyTable.tableName,
          EVENTS_TABLE_NAME: eventsTable.tableName,
        },
      }
    );

    // createInviteCode → PutItem + Query on inviteCodesTable (via GSI)
    this.generateInviteFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["dynamodb:PutItem", "dynamodb:Query"],
        resources: [
          inviteCodesTable.tableArn,
          `${inviteCodesTable.tableArn}/index/*`,
        ],
      })
    );

    // Rate limit counter → UpdateItem on usersTable
    this.generateInviteFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["dynamodb:UpdateItem"],
        resources: [usersTable.tableArn],
      })
    );

    // recordEvent → PutItem on eventsTable (AC7, Story 3.5.2)
    this.generateInviteFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["dynamodb:PutItem"],
        resources: [eventsTable.tableArn],
      })
    );

    // Idempotency middleware → GetItem + PutItem on idempotencyTable (AC9, Story 3.5.2)
    this.generateInviteFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["dynamodb:GetItem", "dynamodb:PutItem"],
        resources: [idempotencyTable.tableArn],
      })
    );

    NagSuppressions.addResourceSuppressions(
      this.generateInviteFunction,
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
      this.generateInviteFunction.role!,
      [
        {
          id: "AwsSolutions-IAM5",
          reason:
            "Index ARN wildcards are standard CDK behavior for GSI access; X-Ray tracing is managed by CDK Lambda construct",
        },
      ],
      true
    );

    new cdk.CfnOutput(this, "GenerateInviteFunctionArn", {
      value: this.generateInviteFunction.functionArn,
      description: "Generate Invite Lambda function ARN",
      exportName: "AiLearningHub-GenerateInviteFunctionArn",
    });

    new cdk.CfnOutput(this, "GenerateInviteFunctionName", {
      value: this.generateInviteFunction.functionName,
      description: "Generate Invite Lambda function name",
      exportName: "AiLearningHub-GenerateInviteFunctionName",
    });

    // ─── List Invite Codes (GET /users/invite-codes) ───────────────────

    this.listInviteCodesFunction = new lambdaNode.NodejsFunction(
      this,
      "ListInviteCodesFunction",
      {
        ...sharedLambdaProps,
        handler: "listHandler",
        entry: path.join(
          process.cwd(),
          "..",
          "backend",
          "functions",
          "invite-codes",
          "handler.ts"
        ),
        environment: {
          INVITE_CODES_TABLE_NAME: inviteCodesTable.tableName,
          USERS_TABLE_NAME: usersTable.tableName,
          SAVES_TABLE_NAME: savesTable.tableName,
          IDEMPOTENCY_TABLE_NAME: idempotencyTable.tableName,
          EVENTS_TABLE_NAME: eventsTable.tableName,
        },
      }
    );

    // listInviteCodesByUser → Query on inviteCodesTable (via GSI)
    this.listInviteCodesFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["dynamodb:Query"],
        resources: [
          inviteCodesTable.tableArn,
          `${inviteCodesTable.tableArn}/index/*`,
        ],
      })
    );

    NagSuppressions.addResourceSuppressions(
      this.listInviteCodesFunction,
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
      this.listInviteCodesFunction.role!,
      [
        {
          id: "AwsSolutions-IAM5",
          reason:
            "Index ARN wildcards are standard CDK behavior for GSI access; X-Ray tracing is managed by CDK Lambda construct",
        },
      ],
      true
    );

    new cdk.CfnOutput(this, "ListInviteCodesFunctionArn", {
      value: this.listInviteCodesFunction.functionArn,
      description: "List Invite Codes Lambda function ARN",
      exportName: "AiLearningHub-ListInviteCodesFunctionArn",
    });

    new cdk.CfnOutput(this, "ListInviteCodesFunctionName", {
      value: this.listInviteCodesFunction.functionName,
      description: "List Invite Codes Lambda function name",
      exportName: "AiLearningHub-ListInviteCodesFunctionName",
    });
  }
}
