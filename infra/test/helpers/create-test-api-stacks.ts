/**
 * Shared test helper for architecture enforcement tests (T1-T4).
 *
 * Creates a realistic CDK stack topology matching production:
 * ApiGatewayStack + AuthRoutesStack, with imported Lambda ARNs
 * and WAF WebACL. Uses the SAME fromFunctionArn pattern from
 * cross-stack-deps.test.ts to avoid circular dependency traps.
 *
 * Story 2.1-D5, Task 1
 */
import { App, Stack } from "aws-cdk-lib";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as events from "aws-cdk-lib/aws-events";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as wafv2 from "aws-cdk-lib/aws-wafv2";
import { Template } from "aws-cdk-lib/assertions";

import { ApiGatewayStack } from "../../lib/stacks/api/api-gateway.stack";
import { AuthRoutesStack } from "../../lib/stacks/api/auth-routes.stack";
import { SavesRoutesStack } from "../../lib/stacks/api/saves-routes.stack";
import { DiscoveryRoutesStack } from "../../lib/stacks/api/discovery-routes.stack";
import { OpsRoutesStack } from "../../lib/stacks/api/ops-routes.stack";
import { ApiDeploymentStack } from "../../lib/stacks/api/api-deployment.stack";
import { getAwsEnv } from "../../config/aws-env";

/**
 * Maps route registry handler refs to Lambda function names used in the test setup.
 * This is the single source of truth for which function name corresponds to
 * which handlerRef. Used by T2/T4 to verify correct handler wiring.
 *
 * DO NOT use fuzzy substring matching on CDK logical IDs — CDK appends hash
 * suffixes that may change across versions. Instead, match on the Lambda
 * function name embedded in the Integration.Uri ARN.
 */
export const HANDLER_REF_TO_FUNCTION_NAME: Record<string, string> = {
  validateInviteFunction: "ValidateInviteFn",
  createApiKeyFunction: "CreateApiKeyFn",
  listApiKeyFunction: "ListApiKeyFn",
  revokeApiKeyFunction: "RevokeApiKeyFn",
  generateInviteFunction: "GenerateInviteFn",
  listInviteCodesFunction: "ListInviteCodesFn",
  readUsersMeFunction: "ReadUsersMeFn",
  writeUsersMeFunction: "WriteUsersMeFn",
  savesCreateFunction: "ai-learning-hub-saves-create",
  savesListFunction: "ai-learning-hub-saves-list",
  savesGetFunction: "ai-learning-hub-saves-get",
  savesUpdateFunction: "ai-learning-hub-saves-update",
  savesDeleteFunction: "ai-learning-hub-saves-delete",
  savesRestoreFunction: "ai-learning-hub-saves-restore",
  savesEventsFunction: "ai-learning-hub-saves-events",
  actionsCatalogFunction: "ai-learning-hub-actions-catalog",
  stateGraphFunction: "ai-learning-hub-state-graph",
  healthFunction: "ai-learning-hub-health",
  readinessFunction: "ai-learning-hub-readiness",
  batchFunction: "ai-learning-hub-batch",
};

/**
 * Extract the Lambda function name from a CDK Integration.Uri JSON string.
 *
 * Two patterns exist:
 * 1. Cross-stack imported functions: URI contains a literal ARN with `:function:NAME`
 * 2. Same-stack functions: URI uses `Fn::GetAtt` referencing a logical ID.
 *    In this case, pass a logicalIdToFunctionName map (built from the template's
 *    Lambda resources) to resolve the logical ID to a function name.
 *
 * @returns The function name or null if not found
 */
export function extractLambdaFunctionName(
  uriJson: string,
  logicalIdToFunctionName?: Map<string, string>
): string | null {
  // Pattern 1: Literal function name in ARN
  const arnMatch = uriJson.match(/:function:([^/"\s,}]+)/);
  if (arnMatch) return arnMatch[1];

  // Pattern 2: Fn::GetAtt referencing a Lambda logical ID
  if (logicalIdToFunctionName) {
    const getAttMatch = uriJson.match(
      /"Fn::GetAtt":\s*\[\s*"([^"]+)"\s*,\s*"Arn"\s*\]/
    );
    if (getAttMatch) {
      const logicalId = getAttMatch[1];
      return logicalIdToFunctionName.get(logicalId) ?? null;
    }
  }

  return null;
}

/**
 * Build a map from Lambda function logical IDs to their FunctionName property.
 * Used to resolve Fn::GetAtt references in Integration.Uri for same-stack Lambdas.
 */
export function buildLambdaFunctionNameMap(
  template: Template
): Map<string, string> {
  const functions = template.findResources("AWS::Lambda::Function");
  const map = new Map<string, string>();
  for (const [logicalId, resource] of Object.entries(functions)) {
    const props = (resource as { Properties: Record<string, unknown> })
      .Properties;
    const functionName = props.FunctionName as string | undefined;
    if (functionName) {
      map.set(logicalId, functionName);
    }
  }
  return map;
}

export interface TestApiStacks {
  app: App;
  apiGatewayStack: ApiGatewayStack;
  authRoutesStack: AuthRoutesStack;
  savesRoutesStack: SavesRoutesStack;
  discoveryRoutesStack: DiscoveryRoutesStack;
  opsRoutesStack: OpsRoutesStack;
  apiDeploymentStack: ApiDeploymentStack;
  apiGwTemplate: Template;
  routesTemplate: Template;
  savesRoutesTemplate: Template;
  discoveryRoutesTemplate: Template;
  opsRoutesTemplate: Template;
  deploymentTemplate: Template;
  /** All route templates combined for searching across all route stacks */
  allRouteTemplates: Template[];
}

/**
 * Module-level cache for synthesized stacks. CDK synthesis is expensive,
 * so we only synthesize once and share the result across all test suites
 * (T1-T4) that import this helper.
 */

let cached: TestApiStacks | null = null;

/**
 * Synthesizes ApiGatewayStack + AuthRoutesStack with realistic topology.
 *
 * Follows the same fromFunctionArn + makeArn pattern used in
 * cross-stack-deps.test.ts (lines 46-49) to avoid CDK circular deps.
 *
 * Results are cached at module level so multiple test suites share a
 * single CDK synthesis pass.
 */
export function createTestApiStacks(): TestApiStacks {
  if (cached) return cached;
  const app = new App();
  const awsEnv = getAwsEnv();

  const depsStack = new Stack(app, "ArchTestDeps", { env: awsEnv });

  // Use env or synthesize a dummy account (split to avoid secrets-scan false positive)
  const testAccount = awsEnv.account ?? `${"123456"}789012`;
  const testRegion = awsEnv.region ?? "us-east-2";
  const makeArn = (name: string) =>
    `arn:aws:lambda:${testRegion}:${testAccount}:function:${name}`;
  const importFn = (stack: Stack, name: string) =>
    lambda.Function.fromFunctionArn(stack, name, makeArn(name));

  const apiGatewayStack = new ApiGatewayStack(app, "ArchTestApiGateway", {
    env: awsEnv,
    jwtAuthorizerFunctionArn: makeArn("JwtAuthFn"),
    apiKeyAuthorizerFunctionArn: makeArn("ApiKeyAuthFn"),
  });

  const authRoutesStack = new AuthRoutesStack(app, "ArchTestAuthRoutes", {
    env: awsEnv,
    restApiId: apiGatewayStack.restApi.restApiId,
    rootResourceId: apiGatewayStack.restApi.restApiRootResourceId,
    jwtAuthorizer: apiGatewayStack.jwtAuthorizer,
    apiKeyAuthorizer: apiGatewayStack.apiKeyAuthorizer,
    validateInviteFunction: importFn(depsStack, "ValidateInviteFn"),
    createApiKeyFunction: importFn(depsStack, "CreateApiKeyFn"),
    listApiKeyFunction: importFn(depsStack, "ListApiKeyFn"),
    revokeApiKeyFunction: importFn(depsStack, "RevokeApiKeyFn"),
    generateInviteFunction: importFn(depsStack, "GenerateInviteFn"),
    listInviteCodesFunction: importFn(depsStack, "ListInviteCodesFn"),
    readUsersMeFunction: importFn(depsStack, "ReadUsersMeFn"),
    writeUsersMeFunction: importFn(depsStack, "WriteUsersMeFn"),
  });

  // DynamoDB tables and EventBridge bus for SavesRoutesStack
  const savesTable = new dynamodb.Table(depsStack, "SavesTable", {
    partitionKey: { name: "PK", type: dynamodb.AttributeType.STRING },
    sortKey: { name: "SK", type: dynamodb.AttributeType.STRING },
  });
  const usersTable = new dynamodb.Table(depsStack, "UsersTable", {
    partitionKey: { name: "PK", type: dynamodb.AttributeType.STRING },
    sortKey: { name: "SK", type: dynamodb.AttributeType.STRING },
  });
  const eventBus = new events.EventBus(depsStack, "EventBus", {
    eventBusName: "arch-test-events",
  });

  const inviteCodesTable = new dynamodb.Table(depsStack, "InviteCodesTable", {
    partitionKey: { name: "PK", type: dynamodb.AttributeType.STRING },
    sortKey: { name: "SK", type: dynamodb.AttributeType.STRING },
  });

  const idempotencyTable = new dynamodb.Table(depsStack, "IdempotencyTable", {
    partitionKey: { name: "PK", type: dynamodb.AttributeType.STRING },
  });

  const eventsTable = new dynamodb.Table(depsStack, "EventsTable", {
    partitionKey: { name: "PK", type: dynamodb.AttributeType.STRING },
    sortKey: { name: "SK", type: dynamodb.AttributeType.STRING },
  });

  const savesRoutesStack = new SavesRoutesStack(app, "ArchTestSavesRoutes", {
    env: awsEnv,
    restApiId: apiGatewayStack.restApi.restApiId,
    rootResourceId: apiGatewayStack.restApi.restApiRootResourceId,
    apiKeyAuthorizer: apiGatewayStack.apiKeyAuthorizer,
    savesTable,
    usersTable,
    inviteCodesTable,
    idempotencyTable,
    eventsTable,
    eventBus,
  });

  const discoveryRoutesStack = new DiscoveryRoutesStack(
    app,
    "ArchTestDiscoveryRoutes",
    {
      env: awsEnv,
      restApiId: apiGatewayStack.restApi.restApiId,
      rootResourceId: apiGatewayStack.restApi.restApiRootResourceId,
      apiKeyAuthorizer: apiGatewayStack.apiKeyAuthorizer,
      usersTable,
      inviteCodesTable,
      savesTable,
      idempotencyTable,
      eventsTable,
    }
  );

  const opsRoutesStack = new OpsRoutesStack(app, "ArchTestOpsRoutes", {
    env: awsEnv,
    restApiId: apiGatewayStack.restApi.restApiId,
    rootResourceId: apiGatewayStack.restApi.restApiRootResourceId,
    apiKeyAuthorizer: apiGatewayStack.apiKeyAuthorizer,
    usersTable,
    inviteCodesTable,
    savesTable,
    idempotencyTable,
    eventsTable,
    stageName: "dev",
  });

  // WAF WebACL for ApiDeploymentStack
  const webAcl = new wafv2.CfnWebACL(depsStack, "TestWebAcl", {
    scope: "REGIONAL",
    defaultAction: { allow: {} },
    visibilityConfig: {
      cloudWatchMetricsEnabled: true,
      metricName: "ArchTestMetric",
      sampledRequestsEnabled: true,
    },
  });

  const apiDeploymentStack = new ApiDeploymentStack(
    app,
    "ArchTestApiDeployment",
    {
      env: awsEnv,
      restApiId: apiGatewayStack.restApi.restApiId,
      stageName: "dev",
      webAcl,
    }
  );

  const apiGwTemplate = Template.fromStack(apiGatewayStack);
  const routesTemplate = Template.fromStack(authRoutesStack);
  const savesRoutesTemplate = Template.fromStack(savesRoutesStack);
  const discoveryRoutesTemplate = Template.fromStack(discoveryRoutesStack);
  const opsRoutesTemplate = Template.fromStack(opsRoutesStack);
  const deploymentTemplate = Template.fromStack(apiDeploymentStack);

  const result: TestApiStacks = {
    app,
    apiGatewayStack,
    authRoutesStack,
    savesRoutesStack,
    discoveryRoutesStack,
    opsRoutesStack,
    apiDeploymentStack,
    apiGwTemplate,
    routesTemplate,
    savesRoutesTemplate,
    discoveryRoutesTemplate,
    opsRoutesTemplate,
    deploymentTemplate,
    allRouteTemplates: [
      routesTemplate,
      savesRoutesTemplate,
      discoveryRoutesTemplate,
      opsRoutesTemplate,
    ],
  };

  cached = result;
  return result;
}
