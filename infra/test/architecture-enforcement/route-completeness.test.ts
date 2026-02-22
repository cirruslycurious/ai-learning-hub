/**
 * T2: Route Completeness Tests (Story 2.1-D5, AC5-6)
 * Hardened handler identity: Story 2.1-D7, Task 1
 *
 * Validates:
 * - AC5: Every route registry entry has matching Resource + Method in templates,
 *         AND each Method's Integration.Uri references the CORRECT Lambda for
 *         the route's handlerRef (not just any Lambda)
 * - AC6: No orphan handler Lambdas — every handler has API Gateway integration
 *         (deterministic check via function name extraction, not cardinality)
 */
import { describe, it, expect, beforeAll } from "vitest";
import { Template } from "aws-cdk-lib/assertions";
import {
  createTestApiStacks,
  type TestApiStacks,
  HANDLER_REF_TO_FUNCTION_NAME,
  extractLambdaFunctionName,
} from "../helpers/create-test-api-stacks";
import { ROUTE_REGISTRY } from "../../config/route-registry";

describe("T2: Route Completeness", () => {
  let stacks: TestApiStacks;
  let routesTemplate: Template;

  beforeAll(() => {
    stacks = createTestApiStacks();
    routesTemplate = stacks.routesTemplate;
  });

  /**
   * Extract all resource paths from the routes template by resolving
   * the Resource tree (ParentId -> path segment chain).
   * Shared by AC5 and AC6b tests.
   */
  function getResourcePaths(template: Template): Map<string, string> {
    const resources = template.findResources("AWS::ApiGateway::Resource");
    const logicalIdToPath = new Map<string, string>();

    // Build parent-child map
    const parentMap = new Map<string, string>();
    const partMap = new Map<string, string>();

    for (const [logicalId, resource] of Object.entries(resources)) {
      const props = (resource as { Properties: Record<string, unknown> })
        .Properties;
      const pathPart = props.PathPart as string;
      partMap.set(logicalId, pathPart);

      const parentRef = props.ParentId as { Ref?: string } | undefined;
      if (parentRef?.Ref) {
        parentMap.set(logicalId, parentRef.Ref);
      }
    }

    // Resolve full paths
    function resolvePath(logicalId: string): string {
      const part = partMap.get(logicalId) ?? "";
      const parent = parentMap.get(logicalId);
      if (parent && partMap.has(parent)) {
        return resolvePath(parent) + "/" + part;
      }
      return "/" + part;
    }

    for (const logicalId of partMap.keys()) {
      logicalIdToPath.set(logicalId, resolvePath(logicalId));
    }

    return logicalIdToPath;
  }

  describe("AC5: Every registry route has matching Resource + Method", () => {
    /**
     * Get method->resource mapping with Lambda function name from the routes template.
     * Returns Map<resourceLogicalId, Map<httpMethod, functionName>>
     */
    function getMethodDetails(
      template: Template
    ): Map<string, Map<string, string | null>> {
      const methods = template.findResources("AWS::ApiGateway::Method");
      const result = new Map<string, Map<string, string | null>>();

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

        const existing = result.get(resourceId) ?? new Map();
        existing.set(httpMethod, functionName);
        result.set(resourceId, existing);
      }

      return result;
    }

    it("each registry route has a matching resource path, method, AND correct handler Lambda", () => {
      const resourcePaths = getResourcePaths(routesTemplate);
      const methodDetails = getMethodDetails(routesTemplate);

      // Invert: path -> logical IDs
      const pathToLogicalIds = new Map<string, string[]>();
      for (const [logicalId, path] of resourcePaths) {
        const existing = pathToLogicalIds.get(path) ?? [];
        existing.push(logicalId);
        pathToLogicalIds.set(path, existing);
      }

      const violations: string[] = [];

      for (const route of ROUTE_REGISTRY) {
        const logicalIds = pathToLogicalIds.get(route.path);
        if (!logicalIds || logicalIds.length === 0) {
          violations.push(`${route.path} — resource not found`);
          continue;
        }

        const expectedFunctionName =
          HANDLER_REF_TO_FUNCTION_NAME[route.handlerRef];

        for (const method of route.methods) {
          let found = false;
          let actualFunctionName: string | null = null;

          for (const id of logicalIds) {
            const methods = methodDetails.get(id);
            if (methods?.has(method)) {
              found = true;
              actualFunctionName = methods.get(method) ?? null;
              break;
            }
          }

          if (!found) {
            violations.push(
              `${route.path} ${method} — method not found on resource`
            );
          } else if (actualFunctionName !== expectedFunctionName) {
            violations.push(
              `${route.path} ${method} — wrong handler: expected ${expectedFunctionName}, got ${actualFunctionName}`
            );
          }
        }
      }

      if (violations.length > 0) {
        expect.fail(`Route registry violations:\n${violations.join("\n")}`);
      }
    });
  });

  describe("AC6b: No unregistered routes in CDK (reverse-direction)", () => {
    it("every non-OPTIONS CDK method has a matching ROUTE_REGISTRY entry", () => {
      const methods = routesTemplate.findResources("AWS::ApiGateway::Method");
      const resourcePaths = getResourcePaths(routesTemplate);
      const unregistered: string[] = [];

      for (const [, method] of Object.entries(methods)) {
        const props = (method as { Properties: Record<string, unknown> })
          .Properties;
        const httpMethod = props.HttpMethod as string;
        if (httpMethod === "OPTIONS") continue;

        const resourceRef = props.ResourceId as { Ref?: string };
        const resourceId = resourceRef?.Ref;
        if (!resourceId) continue;

        const path = resourcePaths.get(resourceId);
        if (!path) continue;

        const registryMatch = ROUTE_REGISTRY.find(
          (r) => r.path === path && r.methods.includes(httpMethod)
        );
        if (!registryMatch) {
          unregistered.push(`${httpMethod} ${path}`);
        }
      }

      if (unregistered.length > 0) {
        expect.fail(
          `Routes exist in CDK but not in ROUTE_REGISTRY:\n${unregistered.map((r) => `  - ${r}`).join("\n")}`
        );
      }
    });
  });

  describe("AC6: No orphan handler Lambdas", () => {
    it("every handler ref in registry has at least one API Gateway method integration", () => {
      const methods = routesTemplate.findResources("AWS::ApiGateway::Method");

      // Collect all Lambda function names referenced in integrations
      const integratedFunctionNames = new Set<string>();

      for (const [, method] of Object.entries(methods)) {
        const props = (method as { Properties: Record<string, unknown> })
          .Properties;
        const httpMethod = props.HttpMethod as string;
        if (httpMethod === "OPTIONS") continue;

        const integration = props.Integration as Record<string, unknown> | null;
        if (!integration?.Uri) continue;

        const uriStr = JSON.stringify(integration.Uri);
        const functionName = extractLambdaFunctionName(uriStr);
        if (functionName) {
          integratedFunctionNames.add(functionName);
        }
      }

      // Verify every handler ref in the registry has a corresponding integration
      const orphans: string[] = [];
      const uniqueHandlerRefs = new Set(
        ROUTE_REGISTRY.map((r) => r.handlerRef)
      );

      for (const handlerRef of uniqueHandlerRefs) {
        const expectedFunctionName = HANDLER_REF_TO_FUNCTION_NAME[handlerRef];
        if (!expectedFunctionName) {
          orphans.push(
            `${handlerRef} — no entry in HANDLER_REF_TO_FUNCTION_NAME`
          );
          continue;
        }
        if (!integratedFunctionNames.has(expectedFunctionName)) {
          orphans.push(
            `${handlerRef} (${expectedFunctionName}) — no API Gateway integration found`
          );
        }
      }

      if (orphans.length > 0) {
        expect.fail(`Orphan handler Lambdas:\n${orphans.join("\n")}`);
      }

      // Positive assertion
      expect(integratedFunctionNames.size).toBeGreaterThanOrEqual(
        uniqueHandlerRefs.size
      );
    });
  });
});
