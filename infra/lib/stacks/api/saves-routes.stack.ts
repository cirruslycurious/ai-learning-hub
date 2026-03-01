/**
 * Saves Routes Stack — Epic 3 save CRUD routes.
 *
 * Story 3.1b, Task 4: Wire saves-create Lambda in CDK (AC7).
 * Follows the AuthRoutesStack pattern for route wiring.
 *
 * ADR-006 deployment order: Tables -> Events -> Auth -> RateLimiting -> ApiGateway -> SavesRoutes
 */
import * as cdk from "aws-cdk-lib";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as events from "aws-cdk-lib/aws-events";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as nodejs from "aws-cdk-lib/aws-lambda-nodejs";
import { NagSuppressions } from "cdk-nag";
import { Construct } from "constructs";
import path from "node:path";

export interface SavesRoutesStackProps extends cdk.StackProps {
  /** REST API ID from ApiGatewayStack */
  restApiId: string;
  /** REST API root resource ID from ApiGatewayStack */
  rootResourceId: string;
  /** API Key authorizer for jwt-or-apikey routes (from ApiGatewayStack) */
  apiKeyAuthorizer: apigateway.IAuthorizer;
  /** Saves DynamoDB table */
  savesTable: dynamodb.Table;
  /** Users DynamoDB table (required for rate limiting) */
  usersTable: dynamodb.Table;
  /** Invite codes DynamoDB table (required by @ai-learning-hub/db barrel import) */
  inviteCodesTable: dynamodb.Table;
  /** Idempotency DynamoDB table (Story 3.2.7) */
  idempotencyTable: dynamodb.Table;
  /** Events DynamoDB table (Story 3.2.7) */
  eventsTable: dynamodb.Table;
  /** EventBridge event bus */
  eventBus: events.EventBus;
}

export class SavesRoutesStack extends cdk.Stack {
  public readonly savesCreateFunction: lambda.IFunction;
  public readonly savesListFunction: lambda.IFunction;
  public readonly savesGetFunction: lambda.IFunction;
  public readonly savesUpdateFunction: lambda.IFunction;
  public readonly savesDeleteFunction: lambda.IFunction;
  public readonly savesRestoreFunction: lambda.IFunction;
  public readonly savesEventsFunction: lambda.IFunction;

  constructor(scope: Construct, id: string, props: SavesRoutesStackProps) {
    super(scope, id, props);

    const {
      restApiId,
      rootResourceId,
      apiKeyAuthorizer,
      savesTable,
      usersTable,
      inviteCodesTable,
      idempotencyTable,
      eventsTable,
      eventBus,
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
        "Idempotency-Key", // Story 3.2.1
        "If-Match", // Story 3.2.1
        "X-Agent-ID", // Story 3.2.4
      ],
      exposeHeaders: [
        "X-Request-Id",
        "X-RateLimit-Limit", // Story 3.2.4
        "X-RateLimit-Remaining", // Story 3.2.4
        "X-RateLimit-Reset", // Story 3.2.4
        "X-Agent-ID", // Story 3.2.4
        "X-Idempotent-Replayed", // Story 3.2.1
        "X-Idempotency-Status", // Story 3.2.1
        "Retry-After", // Story 3.2.4
      ],
      maxAge: cdk.Duration.hours(1),
    };

    // Common environment for mutation Lambdas (Story 3.2.7)
    const mutationEnv = {
      SAVES_TABLE_NAME: savesTable.tableName,
      USERS_TABLE_NAME: usersTable.tableName,
      INVITE_CODES_TABLE_NAME: inviteCodesTable.tableName,
      IDEMPOTENCY_TABLE_NAME: idempotencyTable.tableName,
      EVENTS_TABLE_NAME: eventsTable.tableName,
      EVENT_BUS_NAME: eventBus.eventBusName,
      NODE_OPTIONS: "--enable-source-maps",
    };

    const mutationBundling = {
      minify: true,
      sourceMap: true,
      externalModules: [
        "@aws-sdk/client-dynamodb",
        "@aws-sdk/lib-dynamodb",
        "@aws-sdk/client-eventbridge",
        "@aws-sdk/client-ssm",
      ],
    };

    // Saves-create Lambda
    this.savesCreateFunction = new nodejs.NodejsFunction(
      this,
      "SavesCreateFunction",
      {
        functionName: "ai-learning-hub-saves-create",
        entry: path.join(
          process.cwd(),
          "..",
          "backend/functions/saves/handler.ts"
        ),
        handler: "handler",
        runtime: lambda.Runtime.NODEJS_LATEST,
        memorySize: 256,
        timeout: cdk.Duration.seconds(10),
        tracing: lambda.Tracing.ACTIVE,
        environment: mutationEnv,
        bundling: mutationBundling,
      }
    );

    // IAM permissions
    savesTable.grantReadWriteData(this.savesCreateFunction);
    usersTable.grantReadWriteData(this.savesCreateFunction);
    idempotencyTable.grantReadWriteData(this.savesCreateFunction);
    eventsTable.grantReadWriteData(this.savesCreateFunction);

    // EventBridge PutEvents permission
    this.savesCreateFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["events:PutEvents"],
        resources: [eventBus.eventBusArn],
      })
    );

    // Read-only environment (no idempotency/events tables needed)
    const readOnlyEnv = {
      SAVES_TABLE_NAME: savesTable.tableName,
      USERS_TABLE_NAME: usersTable.tableName,
      INVITE_CODES_TABLE_NAME: inviteCodesTable.tableName,
      NODE_OPTIONS: "--enable-source-maps",
    };

    const readOnlyBundling = {
      minify: true,
      sourceMap: true,
      externalModules: ["@aws-sdk/client-dynamodb", "@aws-sdk/lib-dynamodb"],
    };

    // saves-list — GET /saves (Story 3.2)
    const savesListFunction = new nodejs.NodejsFunction(
      this,
      "SavesListFunction",
      {
        functionName: "ai-learning-hub-saves-list",
        entry: path.join(
          process.cwd(),
          "..",
          "backend/functions/saves-list/handler.ts"
        ),
        handler: "handler",
        runtime: lambda.Runtime.NODEJS_LATEST,
        memorySize: 256,
        timeout: cdk.Duration.seconds(10),
        tracing: lambda.Tracing.ACTIVE,
        environment: readOnlyEnv,
        bundling: readOnlyBundling,
      }
    );
    savesTable.grantReadData(savesListFunction);
    this.savesListFunction = savesListFunction;

    // saves-get — GET /saves/:saveId (Story 3.2)
    const savesGetFunction = new nodejs.NodejsFunction(
      this,
      "SavesGetFunction",
      {
        functionName: "ai-learning-hub-saves-get",
        entry: path.join(
          process.cwd(),
          "..",
          "backend/functions/saves-get/handler.ts"
        ),
        handler: "handler",
        runtime: lambda.Runtime.NODEJS_LATEST,
        memorySize: 256,
        timeout: cdk.Duration.seconds(10),
        tracing: lambda.Tracing.ACTIVE,
        environment: readOnlyEnv,
        bundling: readOnlyBundling,
      }
    );
    // grantReadWriteData for updateItem (lastAccessedAt)
    savesTable.grantReadWriteData(savesGetFunction);
    this.savesGetFunction = savesGetFunction;

    // saves-update — PATCH + POST update-metadata /saves/:saveId (Story 3.3, 3.2.7)
    const savesUpdateFunction = new nodejs.NodejsFunction(
      this,
      "SavesUpdateFunction",
      {
        functionName: "ai-learning-hub-saves-update",
        entry: path.join(
          process.cwd(),
          "..",
          "backend/functions/saves-update/handler.ts"
        ),
        handler: "handler",
        runtime: lambda.Runtime.NODEJS_LATEST,
        memorySize: 256,
        timeout: cdk.Duration.seconds(10),
        tracing: lambda.Tracing.ACTIVE,
        environment: mutationEnv,
        bundling: mutationBundling,
      }
    );
    savesTable.grantReadWriteData(savesUpdateFunction);
    usersTable.grantReadWriteData(savesUpdateFunction);
    idempotencyTable.grantReadWriteData(savesUpdateFunction);
    eventsTable.grantReadWriteData(savesUpdateFunction);
    savesUpdateFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["events:PutEvents"],
        resources: [eventBus.eventBusArn],
      })
    );
    this.savesUpdateFunction = savesUpdateFunction;

    // saves-delete — DELETE /saves/:saveId (Story 3.3, 3.2.7)
    const savesDeleteFunction = new nodejs.NodejsFunction(
      this,
      "SavesDeleteFunction",
      {
        functionName: "ai-learning-hub-saves-delete",
        entry: path.join(
          process.cwd(),
          "..",
          "backend/functions/saves-delete/handler.ts"
        ),
        handler: "handler",
        runtime: lambda.Runtime.NODEJS_LATEST,
        memorySize: 256,
        timeout: cdk.Duration.seconds(10),
        tracing: lambda.Tracing.ACTIVE,
        environment: mutationEnv,
        bundling: mutationBundling,
      }
    );
    savesTable.grantReadWriteData(savesDeleteFunction);
    usersTable.grantReadWriteData(savesDeleteFunction);
    idempotencyTable.grantReadWriteData(savesDeleteFunction);
    eventsTable.grantReadWriteData(savesDeleteFunction);
    savesDeleteFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["events:PutEvents"],
        resources: [eventBus.eventBusArn],
      })
    );
    this.savesDeleteFunction = savesDeleteFunction;

    // saves-restore — POST /saves/:saveId/restore (Story 3.3, 3.2.7)
    const savesRestoreFunction = new nodejs.NodejsFunction(
      this,
      "SavesRestoreFunction",
      {
        functionName: "ai-learning-hub-saves-restore",
        entry: path.join(
          process.cwd(),
          "..",
          "backend/functions/saves-restore/handler.ts"
        ),
        handler: "handler",
        runtime: lambda.Runtime.NODEJS_LATEST,
        memorySize: 256,
        timeout: cdk.Duration.seconds(10),
        tracing: lambda.Tracing.ACTIVE,
        environment: mutationEnv,
        bundling: mutationBundling,
      }
    );
    savesTable.grantReadWriteData(savesRestoreFunction);
    usersTable.grantReadWriteData(savesRestoreFunction);
    idempotencyTable.grantReadWriteData(savesRestoreFunction);
    eventsTable.grantReadWriteData(savesRestoreFunction);
    savesRestoreFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["events:PutEvents"],
        resources: [eventBus.eventBusArn],
      })
    );
    this.savesRestoreFunction = savesRestoreFunction;

    // saves-events — GET /saves/:saveId/events (Story 3.2.7)
    const savesEventsFunction = new nodejs.NodejsFunction(
      this,
      "SavesEventsFunction",
      {
        functionName: "ai-learning-hub-saves-events",
        entry: path.join(
          process.cwd(),
          "..",
          "backend/functions/saves-events/handler.ts"
        ),
        handler: "handler",
        runtime: lambda.Runtime.NODEJS_LATEST,
        memorySize: 256,
        timeout: cdk.Duration.seconds(10),
        tracing: lambda.Tracing.ACTIVE,
        environment: {
          ...readOnlyEnv,
          EVENTS_TABLE_NAME: eventsTable.tableName,
        },
        bundling: readOnlyBundling,
      }
    );
    savesTable.grantReadData(savesEventsFunction);
    eventsTable.grantReadData(savesEventsFunction);
    this.savesEventsFunction = savesEventsFunction;

    // Wire /saves routes
    const savesResource = restApi.root.addResource("saves");
    savesResource.addCorsPreflight(corsOptions);
    savesResource.addMethod(
      "POST",
      new apigateway.LambdaIntegration(this.savesCreateFunction),
      {
        authorizer: apiKeyAuthorizer,
        authorizationType: apigateway.AuthorizationType.CUSTOM,
      }
    );
    savesResource.addMethod(
      "GET",
      new apigateway.LambdaIntegration(savesListFunction),
      {
        authorizer: apiKeyAuthorizer,
        authorizationType: apigateway.AuthorizationType.CUSTOM,
      }
    );

    // Wire /saves/{saveId} route
    const saveByIdResource = savesResource.addResource("{saveId}");
    saveByIdResource.addCorsPreflight(corsOptions);
    saveByIdResource.addMethod(
      "GET",
      new apigateway.LambdaIntegration(savesGetFunction),
      {
        authorizer: apiKeyAuthorizer,
        authorizationType: apigateway.AuthorizationType.CUSTOM,
      }
    );
    saveByIdResource.addMethod(
      "PATCH",
      new apigateway.LambdaIntegration(savesUpdateFunction),
      {
        authorizer: apiKeyAuthorizer,
        authorizationType: apigateway.AuthorizationType.CUSTOM,
      }
    );
    saveByIdResource.addMethod(
      "DELETE",
      new apigateway.LambdaIntegration(savesDeleteFunction),
      {
        authorizer: apiKeyAuthorizer,
        authorizationType: apigateway.AuthorizationType.CUSTOM,
      }
    );

    // Wire /saves/{saveId}/restore route (Story 3.3)
    const restoreResource = saveByIdResource.addResource("restore");
    restoreResource.addCorsPreflight(corsOptions);
    restoreResource.addMethod(
      "POST",
      new apigateway.LambdaIntegration(savesRestoreFunction),
      {
        authorizer: apiKeyAuthorizer,
        authorizationType: apigateway.AuthorizationType.CUSTOM,
      }
    );

    // Wire /saves/{saveId}/update-metadata route (Story 3.2.7 — CQRS command)
    const updateMetadataResource =
      saveByIdResource.addResource("update-metadata");
    updateMetadataResource.addCorsPreflight(corsOptions);
    updateMetadataResource.addMethod(
      "POST",
      new apigateway.LambdaIntegration(savesUpdateFunction),
      {
        authorizer: apiKeyAuthorizer,
        authorizationType: apigateway.AuthorizationType.CUSTOM,
      }
    );

    // Wire /saves/{saveId}/events route (Story 3.2.7 — event history query)
    const eventsResource = saveByIdResource.addResource("events");
    eventsResource.addCorsPreflight(corsOptions);
    eventsResource.addMethod(
      "GET",
      new apigateway.LambdaIntegration(savesEventsFunction),
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
          "DynamoDB table grants include index ARNs with wildcards, which is standard CDK behavior",
      },
      {
        id: "AwsSolutions-L1",
        reason:
          "Using NODEJS_LATEST which resolves to the latest stable Node.js runtime supported by CDK",
      },
    ];

    NagSuppressions.addResourceSuppressions(
      this.savesCreateFunction,
      nagSuppressions,
      true
    );
    NagSuppressions.addResourceSuppressions(
      savesListFunction,
      nagSuppressions,
      true
    );
    NagSuppressions.addResourceSuppressions(
      savesGetFunction,
      nagSuppressions,
      true
    );
    NagSuppressions.addResourceSuppressions(
      savesUpdateFunction,
      nagSuppressions,
      true
    );
    NagSuppressions.addResourceSuppressions(
      savesDeleteFunction,
      nagSuppressions,
      true
    );
    NagSuppressions.addResourceSuppressions(
      savesRestoreFunction,
      nagSuppressions,
      true
    );
    NagSuppressions.addResourceSuppressions(
      savesEventsFunction,
      nagSuppressions,
      true
    );
  }
}
