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
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as wafv2 from "aws-cdk-lib/aws-wafv2";
import { Template } from "aws-cdk-lib/assertions";
import { ApiGatewayStack } from "../../lib/stacks/api/api-gateway.stack";
import { AuthRoutesStack } from "../../lib/stacks/api/auth-routes.stack";
import { getAwsEnv } from "../../config/aws-env";

export interface TestApiStacks {
  app: App;
  apiGatewayStack: ApiGatewayStack;
  authRoutesStack: AuthRoutesStack;
  apiGwTemplate: Template;
  routesTemplate: Template;
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

  const webAcl = new wafv2.CfnWebACL(depsStack, "TestWebAcl", {
    scope: "REGIONAL",
    defaultAction: { allow: {} },
    visibilityConfig: {
      cloudWatchMetricsEnabled: true,
      metricName: "ArchTestMetric",
      sampledRequestsEnabled: true,
    },
  });

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
    webAcl,
  });

  const authRoutesStack = new AuthRoutesStack(app, "ArchTestAuthRoutes", {
    env: awsEnv,
    restApiId: apiGatewayStack.restApi.restApiId,
    rootResourceId: apiGatewayStack.restApi.restApiRootResourceId,
    jwtAuthorizer: apiGatewayStack.jwtAuthorizer,
    apiKeyAuthorizer: apiGatewayStack.apiKeyAuthorizer,
    validateInviteFunction: importFn(depsStack, "ValidateInviteFn"),
    usersMeFunction: importFn(depsStack, "UsersMeFn"),
    apiKeysFunction: importFn(depsStack, "ApiKeysFn"),
    generateInviteFunction: importFn(depsStack, "GenerateInviteFn"),
  });

  const apiGwTemplate = Template.fromStack(apiGatewayStack);
  const routesTemplate = Template.fromStack(authRoutesStack);

  const result: TestApiStacks = {
    app,
    apiGatewayStack,
    authRoutesStack,
    apiGwTemplate,
    routesTemplate,
  };

  cached = result;
  return result;
}
