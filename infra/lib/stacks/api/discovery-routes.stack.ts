/**
 * Discovery Routes Stack — Proactive action discoverability endpoints.
 *
 * Story 3.2.10: Wire GET /actions and GET /states/{entityType} routes.
 * These are read-only endpoints serving from in-memory action registry data.
 *
 * ADR-006 deployment order: ... -> ApiGateway -> DiscoveryRoutes -> ApiDeployment
 */
import * as cdk from "aws-cdk-lib";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as nodejs from "aws-cdk-lib/aws-lambda-nodejs";
import { NagSuppressions } from "cdk-nag";
import { Construct } from "constructs";
import path from "node:path";

export interface DiscoveryRoutesStackProps extends cdk.StackProps {
  /** REST API ID from ApiGatewayStack */
  restApiId: string;
  /** REST API root resource ID from ApiGatewayStack */
  rootResourceId: string;
  /** API Key authorizer for jwt-or-apikey routes (from ApiGatewayStack) */
  apiKeyAuthorizer: apigateway.IAuthorizer;
  /** Users table (required by @ai-learning-hub/db barrel import) */
  usersTable: dynamodb.ITable;
  /** Invite codes table (required by @ai-learning-hub/db barrel import) */
  inviteCodesTable: dynamodb.ITable;
  /** Saves table (required by @ai-learning-hub/db barrel import) */
  savesTable: dynamodb.ITable;
  /** Idempotency table (required by @ai-learning-hub/db barrel import) */
  idempotencyTable: dynamodb.ITable;
  /** Events table (required by @ai-learning-hub/db barrel import) */
  eventsTable: dynamodb.ITable;
}

export class DiscoveryRoutesStack extends cdk.Stack {
  public readonly actionsCatalogFunction: lambda.IFunction;
  public readonly stateGraphFunction: lambda.IFunction;

  constructor(scope: Construct, id: string, props: DiscoveryRoutesStackProps) {
    super(scope, id, props);

    const {
      restApiId,
      rootResourceId,
      apiKeyAuthorizer,
      usersTable,
      inviteCodesTable,
      savesTable,
      idempotencyTable,
      eventsTable,
    } = props;

    // Import REST API
    const restApi = apigateway.RestApi.fromRestApiAttributes(
      this,
      "ImportedRestApi",
      { restApiId, rootResourceId }
    );

    // CORS preflight config — must match api-gateway.stack.ts since imported
    // APIs do NOT inherit defaultCorsPreflightOptions
    const corsOptions: apigateway.CorsOptions = {
      allowOrigins: apigateway.Cors.ALL_ORIGINS,
      allowMethods: apigateway.Cors.ALL_METHODS,
      allowHeaders: [
        "Content-Type",
        "Authorization",
        "x-api-key",
        "X-Amz-Date",
        "X-Api-Key",
        "X-Amz-Security-Token",
        "Idempotency-Key",
        "If-Match",
        "X-Agent-ID",
      ],
      exposeHeaders: [
        "X-Request-Id",
        "X-RateLimit-Limit",
        "X-RateLimit-Remaining",
        "X-RateLimit-Reset",
        "X-Agent-ID",
        "X-Idempotent-Replayed",
        "X-Idempotency-Status",
        "Retry-After",
      ],
      maxAge: cdk.Duration.hours(1),
    };

    // Shared bundling config — no DynamoDB/EventBridge dependencies
    const bundlingConfig = {
      minify: true,
      sourceMap: true,
      externalModules: ["@aws-sdk/client-dynamodb", "@aws-sdk/lib-dynamodb"],
    };

    // Common environment — these Lambdas import from @ai-learning-hub/middleware
    // which transitively imports @ai-learning-hub/db barrel (module-level requireEnv)
    const commonEnv = {
      NODE_OPTIONS: "--enable-source-maps",
      USERS_TABLE_NAME: usersTable.tableName,
      INVITE_CODES_TABLE_NAME: inviteCodesTable.tableName,
      SAVES_TABLE_NAME: savesTable.tableName,
      IDEMPOTENCY_TABLE_NAME: idempotencyTable.tableName,
      EVENTS_TABLE_NAME: eventsTable.tableName,
    };

    // Actions Catalog Lambda — GET /actions (AC1, AC7)
    this.actionsCatalogFunction = new nodejs.NodejsFunction(
      this,
      "ActionsCatalogFunction",
      {
        functionName: "ai-learning-hub-actions-catalog",
        entry: path.join(
          process.cwd(),
          "..",
          "backend/functions/actions-catalog/handler.ts"
        ),
        handler: "handler",
        runtime: lambda.Runtime.NODEJS_LATEST,
        memorySize: 256,
        timeout: cdk.Duration.seconds(10),
        tracing: lambda.Tracing.ACTIVE,
        environment: commonEnv,
        bundling: bundlingConfig,
      }
    );

    // State Graph Lambda — GET /states/{entityType} (AC14, AC18)
    this.stateGraphFunction = new nodejs.NodejsFunction(
      this,
      "StateGraphFunction",
      {
        functionName: "ai-learning-hub-state-graph",
        entry: path.join(
          process.cwd(),
          "..",
          "backend/functions/state-graph/handler.ts"
        ),
        handler: "handler",
        runtime: lambda.Runtime.NODEJS_LATEST,
        memorySize: 256,
        timeout: cdk.Duration.seconds(10),
        tracing: lambda.Tracing.ACTIVE,
        environment: commonEnv,
        bundling: bundlingConfig,
      }
    );

    // Wire /actions route
    const actionsResource = restApi.root.addResource("actions");
    actionsResource.addCorsPreflight(corsOptions);
    actionsResource.addMethod(
      "GET",
      new apigateway.LambdaIntegration(this.actionsCatalogFunction),
      {
        authorizer: apiKeyAuthorizer,
        authorizationType: apigateway.AuthorizationType.CUSTOM,
      }
    );

    // Wire /states/{entityType} route
    const statesResource = restApi.root.addResource("states");
    const statesByTypeResource = statesResource.addResource("{entityType}");
    statesResource.addCorsPreflight(corsOptions);
    statesByTypeResource.addCorsPreflight(corsOptions);
    statesByTypeResource.addMethod(
      "GET",
      new apigateway.LambdaIntegration(this.stateGraphFunction),
      {
        authorizer: apiKeyAuthorizer,
        authorizationType: apigateway.AuthorizationType.CUSTOM,
      }
    );

    // CDK Nag suppressions
    NagSuppressions.addStackSuppressions(this, [
      {
        id: "AwsSolutions-COG4",
        reason:
          "Custom Lambda authorizers (JWT + API Key per ADR-013) used instead of Cognito",
      },
    ]);

    const nagSuppressions = [
      {
        id: "AwsSolutions-IAM4",
        reason:
          "Lambda basic execution role (CloudWatch Logs, X-Ray) is managed by CDK construct",
      },
      {
        id: "AwsSolutions-IAM5",
        reason:
          "X-Ray tracing (Tracing.ACTIVE) generates wildcard Resource::* policy managed by CDK construct",
      },
      {
        id: "AwsSolutions-L1",
        reason:
          "Using NODEJS_LATEST which resolves to the latest stable Node.js runtime supported by CDK",
      },
    ];

    NagSuppressions.addResourceSuppressions(
      this.actionsCatalogFunction,
      nagSuppressions,
      true
    );
    NagSuppressions.addResourceSuppressions(
      this.stateGraphFunction,
      nagSuppressions,
      true
    );
  }
}
