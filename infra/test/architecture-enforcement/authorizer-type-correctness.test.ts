/**
 * T3: Authorizer Type Correctness Tests (Story 2.1-D5, AC7-8)
 *
 * Validates:
 * - AC7: Each route's authorizer matches the registry's declared auth type
 * - AC8: Clear error message for routes with missing authorizers
 */
import { describe, it, expect, beforeAll } from "vitest";
import { Template } from "aws-cdk-lib/assertions";
import {
  createTestApiStacks,
  type TestApiStacks,
} from "../helpers/create-test-api-stacks";
import { ROUTE_REGISTRY, type AuthType } from "../../config/route-registry";

describe("T3: Authorizer Type Correctness", () => {
  let stacks: TestApiStacks;
  let apiGwTemplate: Template;
  let routesTemplate: Template;

  beforeAll(() => {
    stacks = createTestApiStacks();
    apiGwTemplate = stacks.apiGwTemplate;
    routesTemplate = stacks.routesTemplate;
  });

  /**
   * Identifies the two authorizer logical IDs from the ApiGatewayStack template
   * and maps them to auth types based on the authorizer name property.
   */
  function getAuthorizerMap(
    template: Template
  ): Map<string, "jwt" | "jwt-or-apikey"> {
    const authorizers = template.findResources("AWS::ApiGateway::Authorizer");
    const map = new Map<string, "jwt" | "jwt-or-apikey">();

    for (const [logicalId, resource] of Object.entries(authorizers)) {
      const props = (resource as { Properties: Record<string, unknown> })
        .Properties;
      const name = props.Name as string;

      if (name === "jwt-authorizer") {
        map.set(logicalId, "jwt");
      } else if (name === "api-key-authorizer") {
        map.set(logicalId, "jwt-or-apikey");
      }
    }

    return map;
  }

  /**
   * Resolves which auth type a method uses by checking its AuthorizerId
   * against the known authorizer logical IDs.
   */
  function resolveMethodAuthType(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    authorizerId: any,
    authorizerMap: Map<string, "jwt" | "jwt-or-apikey">
  ): "jwt" | "jwt-or-apikey" | "unknown" {
    if (!authorizerId) return "unknown";

    // AuthorizerId can be a Ref, Fn::ImportValue, or Fn::GetAtt
    const idStr = JSON.stringify(authorizerId);

    for (const [logicalId, authType] of authorizerMap) {
      if (idStr.includes(logicalId)) {
        return authType;
      }
    }

    return "unknown";
  }

  describe("AC7: Route authorizer matches registry auth type", () => {
    it("each registry route uses the correct authorizer type", () => {
      const authorizerMap = getAuthorizerMap(apiGwTemplate);

      // Build resource path map from routes template
      const resources = routesTemplate.findResources(
        "AWS::ApiGateway::Resource"
      );
      const partMap = new Map<string, string>();
      const parentMap = new Map<string, string>();

      for (const [logicalId, resource] of Object.entries(resources)) {
        const props = (resource as { Properties: Record<string, unknown> })
          .Properties;
        partMap.set(logicalId, props.PathPart as string);
        const parentRef = props.ParentId as { Ref?: string };
        if (parentRef?.Ref) {
          parentMap.set(logicalId, parentRef.Ref);
        }
      }

      function resolvePath(logicalId: string): string {
        const part = partMap.get(logicalId) ?? "";
        const parent = parentMap.get(logicalId);
        if (parent && partMap.has(parent)) {
          return resolvePath(parent) + "/" + part;
        }
        return "/" + part;
      }

      // Build logical ID → path map
      const logicalIdToPath = new Map<string, string>();
      for (const logicalId of partMap.keys()) {
        logicalIdToPath.set(logicalId, resolvePath(logicalId));
      }

      // Check each method
      const methods = routesTemplate.findResources("AWS::ApiGateway::Method");
      const mismatches: string[] = [];

      for (const [_logicalId, method] of Object.entries(methods)) {
        const props = (method as { Properties: Record<string, unknown> })
          .Properties;
        const httpMethod = props.HttpMethod as string;

        if (httpMethod === "OPTIONS") continue;

        const resourceRef = props.ResourceId as { Ref?: string };
        const resourceLogicalId = resourceRef?.Ref;
        if (!resourceLogicalId) continue;

        const path = logicalIdToPath.get(resourceLogicalId);
        if (!path) continue;

        // Find matching registry entry
        const registryEntry = ROUTE_REGISTRY.find(
          (r) => r.path === path && r.methods.includes(httpMethod)
        );
        if (!registryEntry) continue;

        const actualAuthType = resolveMethodAuthType(
          props.AuthorizerId,
          authorizerMap
        );

        // Explicit mapping from registry auth types to expected authorizer types.
        // "iam" routes use AWS_IAM (no custom authorizer), "admin" and "analyst"
        // use JWT authorizer with role checks in the handler.
        const authTypeToAuthorizer: Record<
          AuthType,
          "jwt" | "jwt-or-apikey" | "iam"
        > = {
          jwt: "jwt",
          "jwt-or-apikey": "jwt-or-apikey",
          iam: "iam", // Future: AWS_IAM auth type, no custom authorizer
          admin: "jwt", // JWT authorizer + admin role check in handler
          analyst: "jwt", // JWT authorizer + analyst role check in handler
        };
        const expectedAuthorizerType =
          authTypeToAuthorizer[registryEntry.authType];
        if (!expectedAuthorizerType) {
          mismatches.push(
            `Route ${path} ${httpMethod}: unknown auth type "${registryEntry.authType}" in registry`
          );
          continue;
        }

        if (actualAuthType !== expectedAuthorizerType) {
          mismatches.push(
            `Route ${path} ${httpMethod}: expected ${expectedAuthorizerType} authorizer but got ${actualAuthType}`
          );
        }
      }

      if (mismatches.length > 0) {
        expect.fail(`Authorizer type mismatches:\n${mismatches.join("\n")}`);
      }
    });
  });

  describe("AC8: Clear error for missing authorizer", () => {
    it("non-OPTIONS methods have AuthorizationType CUSTOM (not NONE)", () => {
      const methods = routesTemplate.findResources("AWS::ApiGateway::Method");

      const violations: string[] = [];

      // Build path map for error messages
      const resources = routesTemplate.findResources(
        "AWS::ApiGateway::Resource"
      );
      const partMap = new Map<string, string>();
      const parentMap = new Map<string, string>();

      for (const [logicalId, resource] of Object.entries(resources)) {
        const props = (resource as { Properties: Record<string, unknown> })
          .Properties;
        partMap.set(logicalId, props.PathPart as string);
        const parentRef = props.ParentId as { Ref?: string };
        if (parentRef?.Ref) {
          parentMap.set(logicalId, parentRef.Ref);
        }
      }

      function resolvePath(logicalId: string): string {
        const part = partMap.get(logicalId) ?? "";
        const parent = parentMap.get(logicalId);
        if (parent && partMap.has(parent)) {
          return resolvePath(parent) + "/" + part;
        }
        return "/" + part;
      }

      for (const [, method] of Object.entries(methods)) {
        const props = (method as { Properties: Record<string, unknown> })
          .Properties;
        const httpMethod = props.HttpMethod as string;

        if (httpMethod === "OPTIONS") continue;

        const authType = props.AuthorizationType as string;
        if (authType === "NONE") {
          const resourceRef = props.ResourceId as { Ref?: string };
          const resourceLogicalId = resourceRef?.Ref ?? "unknown";
          const path = partMap.has(resourceLogicalId)
            ? resolvePath(resourceLogicalId)
            : resourceLogicalId;

          // Find expected auth type from registry
          const registryEntry = ROUTE_REGISTRY.find(
            (r) => r.path === path && r.methods.includes(httpMethod)
          );
          const expectedAuth = registryEntry?.authType ?? "unknown";

          violations.push(
            `Route ${path} ${httpMethod} has no authorizer but registry requires ${expectedAuth}`
          );
        }
      }

      if (violations.length > 0) {
        expect.fail(violations.join("\n"));
      }
    });
  });
});
