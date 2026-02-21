/**
 * T2/T4 Miswiring Detection Test (Story 2.1-D7, Task 1.6)
 *
 * Validates that the hardened handler identity checks (AC1, AC2) actually
 * CATCH miswiring. Creates a test-only fixture with swapped handlers and
 * asserts the identity check fails with a descriptive message.
 *
 * This test does NOT modify production stacks — the miswiring is isolated
 * to a test-only CDK synthesis.
 */
import { describe, it, expect } from "vitest";
import { App, Stack } from "aws-cdk-lib";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as wafv2 from "aws-cdk-lib/aws-wafv2";
import { Template } from "aws-cdk-lib/assertions";
import { ApiGatewayStack } from "../../lib/stacks/api/api-gateway.stack";
import { AuthRoutesStack } from "../../lib/stacks/api/auth-routes.stack";
import { getAwsEnv } from "../../config/aws-env";
import {
  HANDLER_REF_TO_FUNCTION_NAME,
  extractLambdaFunctionName,
} from "../helpers/create-test-api-stacks";
import { ROUTE_REGISTRY } from "../../config/route-registry";

describe("Miswiring Detection", () => {
  it("detects when usersMeFunction and apiKeysFunction are swapped", () => {
    const app = new App();
    const awsEnv = getAwsEnv();
    const depsStack = new Stack(app, "MiswiringDeps", { env: awsEnv });

    const webAcl = new wafv2.CfnWebACL(depsStack, "TestWebAcl", {
      scope: "REGIONAL",
      defaultAction: { allow: {} },
      visibilityConfig: {
        cloudWatchMetricsEnabled: true,
        metricName: "MiswiringMetric",
        sampledRequestsEnabled: true,
      },
    });

    const testAccount = awsEnv.account ?? `${"123456"}789012`;
    const testRegion = awsEnv.region ?? "us-east-2";
    const makeArn = (name: string) =>
      `arn:aws:lambda:${testRegion}:${testAccount}:function:${name}`;
    const importFn = (stack: Stack, name: string) =>
      lambda.Function.fromFunctionArn(stack, name, makeArn(name));

    const apiGatewayStack = new ApiGatewayStack(app, "MiswiringApiGw", {
      env: awsEnv,
      jwtAuthorizerFunctionArn: makeArn("JwtAuthFn"),
      apiKeyAuthorizerFunctionArn: makeArn("ApiKeyAuthFn"),
      webAcl,
    });

    // INTENTIONAL MISWIRING: swap usersMeFunction and apiKeysFunction
    const authRoutesStack = new AuthRoutesStack(app, "MiswiringRoutes", {
      env: awsEnv,
      restApiId: apiGatewayStack.restApi.restApiId,
      rootResourceId: apiGatewayStack.restApi.restApiRootResourceId,
      jwtAuthorizer: apiGatewayStack.jwtAuthorizer,
      apiKeyAuthorizer: apiGatewayStack.apiKeyAuthorizer,
      validateInviteFunction: importFn(depsStack, "ValidateInviteFn"),
      usersMeFunction: importFn(depsStack, "ApiKeysFn"), // SWAPPED
      apiKeysFunction: importFn(depsStack, "UsersMeFn"), // SWAPPED
      generateInviteFunction: importFn(depsStack, "GenerateInviteFn"),
    });

    const routesTemplate = Template.fromStack(authRoutesStack);

    // Run the same handler identity check from T2-AC5
    const resources = routesTemplate.findResources("AWS::ApiGateway::Resource");
    const methods = routesTemplate.findResources("AWS::ApiGateway::Method");

    // Build path resolution
    const parentMap = new Map<string, string>();
    const partMap = new Map<string, string>();
    for (const [logicalId, resource] of Object.entries(resources)) {
      const props = (resource as { Properties: Record<string, unknown> })
        .Properties;
      partMap.set(logicalId, props.PathPart as string);
      const parentRef = props.ParentId as { Ref?: string } | undefined;
      if (parentRef?.Ref) parentMap.set(logicalId, parentRef.Ref);
    }

    function resolvePath(logicalId: string): string {
      const part = partMap.get(logicalId) ?? "";
      const parent = parentMap.get(logicalId);
      if (parent && partMap.has(parent))
        return resolvePath(parent) + "/" + part;
      return "/" + part;
    }

    const pathToLogicalIds = new Map<string, string[]>();
    for (const logicalId of partMap.keys()) {
      const path = resolvePath(logicalId);
      const existing = pathToLogicalIds.get(path) ?? [];
      existing.push(logicalId);
      pathToLogicalIds.set(path, existing);
    }

    // Build method → function name map
    const methodDetails = new Map<string, Map<string, string | null>>();
    for (const [, method] of Object.entries(methods)) {
      const props = (method as { Properties: Record<string, unknown> })
        .Properties;
      const httpMethod = props.HttpMethod as string;
      const resourceRef = props.ResourceId as { Ref?: string };
      const resourceId = resourceRef?.Ref;
      if (!resourceId || httpMethod === "OPTIONS") continue;

      const integration = props.Integration as Record<string, unknown>;
      const uriStr = integration?.Uri ? JSON.stringify(integration.Uri) : "";
      const functionName = extractLambdaFunctionName(uriStr);

      const existing = methodDetails.get(resourceId) ?? new Map();
      existing.set(httpMethod, functionName);
      methodDetails.set(resourceId, existing);
    }

    // Check for violations
    const violations: string[] = [];
    for (const route of ROUTE_REGISTRY) {
      const logicalIds = pathToLogicalIds.get(route.path);
      if (!logicalIds) continue;

      const expectedFunctionName =
        HANDLER_REF_TO_FUNCTION_NAME[route.handlerRef];

      for (const method of route.methods) {
        for (const id of logicalIds) {
          const mds = methodDetails.get(id);
          if (mds?.has(method)) {
            const actual = mds.get(method);
            if (actual !== expectedFunctionName) {
              violations.push(
                `${route.path} ${method} — expected ${expectedFunctionName}, got ${actual}`
              );
            }
          }
        }
      }
    }

    // The miswiring MUST be detected
    expect(
      violations.length,
      "Handler identity check should detect swapped usersMeFunction/apiKeysFunction"
    ).toBeGreaterThan(0);

    // Verify the violations specifically mention the swapped routes
    const usersViolation = violations.some((v) => v.includes("/users/me"));
    const apiKeysViolation = violations.some((v) =>
      v.includes("/users/api-keys")
    );
    expect(usersViolation, "Should detect /users/me miswiring").toBe(true);
    expect(apiKeysViolation, "Should detect /users/api-keys miswiring").toBe(
      true
    );
  });
});
