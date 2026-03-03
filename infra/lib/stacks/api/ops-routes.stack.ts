/**
 * Ops Routes Stack — Health, Readiness & Batch Operations endpoints.
 *
 * Story 3.2.9: Wire GET /health, GET /ready (AuthorizationType.NONE),
 * and POST /batch (CUSTOM authorizer) routes.
 *
 * ADR-006 deployment order: ... -> ApiGateway -> OpsRoutes -> ApiDeployment
 */
import * as cdk from "aws-cdk-lib";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as nodejs from "aws-cdk-lib/aws-lambda-nodejs";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import { NagSuppressions } from "cdk-nag";
import { Construct } from "constructs";
import path from "node:path";

export interface OpsRoutesStackProps extends cdk.StackProps {
  /** REST API ID from ApiGatewayStack */
  restApiId: string;
  /** REST API root resource ID from ApiGatewayStack */
  rootResourceId: string;
  /** API Key authorizer for jwt-or-apikey routes (from ApiGatewayStack) */
  apiKeyAuthorizer: apigateway.IAuthorizer;
  /** Users table for readiness check + rate limiting */
  usersTable: dynamodb.ITable;
  /** Invite codes table (required by @ai-learning-hub/db barrel import) */
  inviteCodesTable: dynamodb.ITable;
  /** Saves table (required by @ai-learning-hub/db barrel import) */
  savesTable: dynamodb.ITable;
  /** Idempotency table for batch operations */
  idempotencyTable: dynamodb.ITable;
  /** Events table (required by @ai-learning-hub/db barrel import) */
  eventsTable: dynamodb.ITable;
  /** Stage name for constructing API_BASE_URL */
  stageName: string;
}

export class OpsRoutesStack extends cdk.Stack {
  public readonly healthFunction: lambda.IFunction;
  public readonly readinessFunction: lambda.IFunction;
  public readonly batchFunction: lambda.IFunction;

  constructor(scope: Construct, id: string, props: OpsRoutesStackProps) {
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
      stageName,
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
      // ALL_ORIGINS: agent callers may originate from arbitrary origins;
      // frontend origin enforcement is at the CloudFront level.
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

    // Shared bundling config
    const bundlingConfig = {
      minify: true,
      sourceMap: true,
      externalModules: ["@aws-sdk/client-dynamodb", "@aws-sdk/lib-dynamodb"],
    };

    // ── Health Lambda — GET /health (AC1, AC2) ────────────────────────
    this.healthFunction = new nodejs.NodejsFunction(this, "HealthFunction", {
      functionName: "ai-learning-hub-health",
      entry: path.join(
        process.cwd(),
        "..",
        "backend/functions/health/handler.ts"
      ),
      handler: "handler",
      runtime: lambda.Runtime.NODEJS_LATEST,
      memorySize: 256,
      timeout: cdk.Duration.seconds(10),
      tracing: lambda.Tracing.ACTIVE,
      environment: {
        NODE_OPTIONS: "--enable-source-maps",
        USERS_TABLE_NAME: usersTable.tableName,
        INVITE_CODES_TABLE_NAME: inviteCodesTable.tableName,
        SAVES_TABLE_NAME: savesTable.tableName,
        IDEMPOTENCY_TABLE_NAME: idempotencyTable.tableName,
        EVENTS_TABLE_NAME: eventsTable.tableName,
      },
      bundling: bundlingConfig,
    });

    // ── Readiness Lambda — GET /ready (AC3, AC4, AC5) ─────────────────
    this.readinessFunction = new nodejs.NodejsFunction(
      this,
      "ReadinessFunction",
      {
        functionName: "ai-learning-hub-readiness",
        entry: path.join(
          process.cwd(),
          "..",
          "backend/functions/readiness/handler.ts"
        ),
        handler: "handler",
        runtime: lambda.Runtime.NODEJS_LATEST,
        memorySize: 256,
        timeout: cdk.Duration.seconds(10),
        tracing: lambda.Tracing.ACTIVE,
        environment: {
          NODE_OPTIONS: "--enable-source-maps",
          USERS_TABLE_NAME: usersTable.tableName,
          INVITE_CODES_TABLE_NAME: inviteCodesTable.tableName,
          SAVES_TABLE_NAME: savesTable.tableName,
          IDEMPOTENCY_TABLE_NAME: idempotencyTable.tableName,
          EVENTS_TABLE_NAME: eventsTable.tableName,
        },
        bundling: bundlingConfig,
      }
    );
    usersTable.grantReadData(this.readinessFunction);

    // ── Batch Lambda — POST /batch (AC6-AC13) ─────────────────────────
    // API_BASE_URL constructed from the REST API — restApiId + region + stage
    const apiBaseUrl = `https://${restApiId}.execute-api.${this.region}.amazonaws.com/${stageName}`;

    this.batchFunction = new nodejs.NodejsFunction(this, "BatchFunction", {
      functionName: "ai-learning-hub-batch",
      entry: path.join(
        process.cwd(),
        "..",
        "backend/functions/batch/handler.ts"
      ),
      handler: "handler",
      runtime: lambda.Runtime.NODEJS_LATEST,
      memorySize: 512,
      timeout: cdk.Duration.seconds(30),
      tracing: lambda.Tracing.ACTIVE,
      environment: {
        NODE_OPTIONS: "--enable-source-maps",
        API_BASE_URL: apiBaseUrl,
        USERS_TABLE_NAME: usersTable.tableName,
        INVITE_CODES_TABLE_NAME: inviteCodesTable.tableName,
        SAVES_TABLE_NAME: savesTable.tableName,
        IDEMPOTENCY_TABLE_NAME: idempotencyTable.tableName,
        EVENTS_TABLE_NAME: eventsTable.tableName,
      },
      bundling: bundlingConfig,
    });
    idempotencyTable.grantReadWriteData(this.batchFunction);
    usersTable.grantReadData(this.batchFunction);

    // ── Wire /health route (AuthorizationType.NONE) ───────────────────
    const healthResource = restApi.root.addResource("health");
    healthResource.addCorsPreflight(corsOptions);
    healthResource.addMethod(
      "GET",
      new apigateway.LambdaIntegration(this.healthFunction),
      {
        authorizationType: apigateway.AuthorizationType.NONE,
        methodResponses: [],
      }
    );

    // ── Wire /ready route (AuthorizationType.NONE) ────────────────────
    const readyResource = restApi.root.addResource("ready");
    readyResource.addCorsPreflight(corsOptions);
    readyResource.addMethod(
      "GET",
      new apigateway.LambdaIntegration(this.readinessFunction),
      {
        authorizationType: apigateway.AuthorizationType.NONE,
        methodResponses: [],
      }
    );

    // ── Wire /batch route (CUSTOM authorizer) ─────────────────────────
    const batchResource = restApi.root.addResource("batch");
    batchResource.addCorsPreflight(corsOptions);
    batchResource.addMethod(
      "POST",
      new apigateway.LambdaIntegration(this.batchFunction),
      {
        authorizer: apiKeyAuthorizer,
        authorizationType: apigateway.AuthorizationType.CUSTOM,
      }
    );

    // ── CDK Nag suppressions ──────────────────────────────────────────
    NagSuppressions.addStackSuppressions(this, [
      {
        id: "AwsSolutions-COG4",
        reason:
          "Health/readiness use AuthorizationType.NONE (public probes). Batch uses custom Lambda authorizer (JWT + API Key per ADR-013).",
      },
      {
        id: "AwsSolutions-APIG4",
        reason:
          "Health and readiness endpoints are intentionally unauthenticated (AC2, AC5) with method-level throttling (100 burst / 50 sustained) configured in ApiDeploymentStack CfnStage methodSettings for abuse prevention.",
      },
    ]);

    const lambdaNagSuppressions = [
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
      this.healthFunction,
      lambdaNagSuppressions,
      true
    );
    NagSuppressions.addResourceSuppressions(
      this.readinessFunction,
      lambdaNagSuppressions,
      true
    );
    NagSuppressions.addResourceSuppressions(
      this.batchFunction,
      lambdaNagSuppressions,
      true
    );
  }
}
