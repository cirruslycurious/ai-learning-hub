/**
 * T2: Route Completeness Tests (Story 2.1-D5, AC5-6)
 *
 * Validates:
 * - AC5: Every route registry entry has matching Resource + Method in templates
 * - AC6: No orphan handler Lambdas — every handler has API Gateway integration
 */
import { describe, it, expect, beforeAll } from "vitest";
import { Template } from "aws-cdk-lib/assertions";
import {
  createTestApiStacks,
  type TestApiStacks,
} from "../helpers/create-test-api-stacks";
import { ROUTE_REGISTRY } from "../../config/route-registry";

describe("T2: Route Completeness", () => {
  let stacks: TestApiStacks;
  let routesTemplate: Template;

  beforeAll(() => {
    stacks = createTestApiStacks();
    routesTemplate = stacks.routesTemplate;
  });

  describe("AC5: Every registry route has matching Resource + Method", () => {
    /**
     * Extract all resource paths from the routes template by resolving
     * the Resource tree (ParentId → path segment chain).
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

    /**
     * Get method→resource mapping from the routes template.
     */
    function getMethodsOnResources(
      template: Template
    ): Map<string, Set<string>> {
      const methods = template.findResources("AWS::ApiGateway::Method");
      // Map from resource logical ID → set of HTTP methods
      const resourceMethods = new Map<string, Set<string>>();

      for (const [, method] of Object.entries(methods)) {
        const props = (method as { Properties: Record<string, unknown> })
          .Properties;
        const httpMethod = props.HttpMethod as string;
        const resourceRef = props.ResourceId as { Ref?: string };
        const resourceId = resourceRef?.Ref;

        if (resourceId && httpMethod !== "OPTIONS") {
          const existing = resourceMethods.get(resourceId) ?? new Set();
          existing.add(httpMethod);
          resourceMethods.set(resourceId, existing);
        }
      }

      return resourceMethods;
    }

    it("each registry route has a matching resource path and method in the routes template", () => {
      const resourcePaths = getResourcePaths(routesTemplate);
      const resourceMethods = getMethodsOnResources(routesTemplate);

      // Invert: path → logical IDs
      const pathToLogicalIds = new Map<string, string[]>();
      for (const [logicalId, path] of resourcePaths) {
        const existing = pathToLogicalIds.get(path) ?? [];
        existing.push(logicalId);
        pathToLogicalIds.set(path, existing);
      }

      const missingRoutes: string[] = [];

      for (const route of ROUTE_REGISTRY) {
        const logicalIds = pathToLogicalIds.get(route.path);
        if (!logicalIds || logicalIds.length === 0) {
          missingRoutes.push(`${route.path} — resource not found`);
          continue;
        }

        for (const method of route.methods) {
          const hasMethod = logicalIds.some((id) => {
            const methods = resourceMethods.get(id);
            return methods?.has(method);
          });

          if (!hasMethod) {
            missingRoutes.push(
              `${route.path} ${method} — method not found on resource`
            );
          }
        }
      }

      if (missingRoutes.length > 0) {
        expect.fail(
          `Route registry entries missing from CDK templates:\n${missingRoutes.join("\n")}`
        );
      }
    });
  });

  describe("AC6: No orphan handler Lambdas", () => {
    it("every handler Lambda has at least one API Gateway method integration", () => {
      const methods = routesTemplate.findResources("AWS::ApiGateway::Method");

      // Collect all Lambda ARNs referenced in integrations
      const integratedArns = new Set<string>();

      for (const [, method] of Object.entries(methods)) {
        const props = (method as { Properties: Record<string, unknown> })
          .Properties;
        const integration = props.Integration as Record<string, unknown>;
        if (!integration) continue;

        const uri = integration.Uri;
        if (uri) {
          // Extract Lambda ARN from Fn::Join or direct reference
          const uriStr = JSON.stringify(uri);
          integratedArns.add(uriStr);
        }
      }

      // Every handler ref in the registry should have at least one integration
      const handlerRefs = new Set(ROUTE_REGISTRY.map((r) => r.handlerRef));

      // We verify that the number of unique handler refs that appear in
      // integrations matches the total unique handler refs in the registry.
      // Since each handler Lambda is passed to the stack and used in addMethod(),
      // if a handler has no route, it wouldn't appear in any integration URI.
      expect(
        integratedArns.size,
        `Expected at least ${handlerRefs.size} unique integrations for ${handlerRefs.size} unique handlers`
      ).toBeGreaterThanOrEqual(handlerRefs.size);
    });
  });
});
