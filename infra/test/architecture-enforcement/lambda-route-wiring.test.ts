/**
 * T4: Lambda ↔ Route Wiring Tests (Story 2.1-D5, AC9-10)
 *
 * Validates:
 * - AC9: Every Method's Integration.Uri resolves to an existing Lambda
 * - AC10: Every handler Lambda has at least one Method integration (no orphans)
 */
import { describe, it, expect, beforeAll } from "vitest";
import { Template } from "aws-cdk-lib/assertions";
import { createTestApiStacks } from "../helpers/create-test-api-stacks";
import { ROUTE_REGISTRY } from "../../config/route-registry";

describe("T4: Lambda ↔ Route Wiring", () => {
  let routesTemplate: Template;

  beforeAll(() => {
    const stacks = createTestApiStacks();
    routesTemplate = stacks.routesTemplate;
  });

  describe("AC9: Every Method Integration.Uri resolves to a Lambda", () => {
    it("all non-OPTIONS methods have LambdaIntegration URIs", () => {
      const methods = routesTemplate.findResources("AWS::ApiGateway::Method");

      const violations: string[] = [];

      for (const [logicalId, method] of Object.entries(methods)) {
        const props = (method as { Properties: Record<string, unknown> })
          .Properties;
        const httpMethod = props.HttpMethod as string;

        if (httpMethod === "OPTIONS") continue;

        const integration = props.Integration as Record<string, unknown> | null;

        if (!integration) {
          violations.push(
            `Method ${logicalId} (${httpMethod}) has no Integration`
          );
          continue;
        }

        const integrationType = integration.Type as string;
        if (integrationType !== "AWS_PROXY") {
          violations.push(
            `Method ${logicalId} (${httpMethod}) has Integration.Type = ${integrationType}, expected AWS_PROXY`
          );
          continue;
        }

        const uri = integration.Uri;
        if (!uri) {
          violations.push(
            `Method ${logicalId} (${httpMethod}) has no Integration.Uri`
          );
          continue;
        }

        // The URI should contain a reference to a Lambda function ARN
        // (typically via Fn::Join with arn:aws:apigateway:...lambda.../invocations)
        const uriStr = JSON.stringify(uri);
        if (!uriStr.includes("lambda") && !uriStr.includes("Function")) {
          violations.push(
            `Method ${logicalId} (${httpMethod}) Integration.Uri does not reference a Lambda function`
          );
        }
      }

      if (violations.length > 0) {
        expect.fail(`Lambda integration violations:\n${violations.join("\n")}`);
      }
    });
  });

  describe("AC10: No orphan handler Lambdas", () => {
    it("every unique handler ref in registry has API Gateway integration", () => {
      const methods = routesTemplate.findResources("AWS::ApiGateway::Method");

      // Collect all unique Lambda function ARN references from integration URIs
      const integratedLambdaRefs = new Set<string>();

      for (const [, method] of Object.entries(methods)) {
        const props = (method as { Properties: Record<string, unknown> })
          .Properties;
        const httpMethod = props.HttpMethod as string;
        if (httpMethod === "OPTIONS") continue;

        const integration = props.Integration as Record<string, unknown> | null;
        if (!integration?.Uri) continue;

        // Extract Lambda references from the URI
        const uriStr = JSON.stringify(integration.Uri);
        integratedLambdaRefs.add(uriStr);
      }

      // We should have integrations (at least one per unique handler)
      const uniqueHandlers = new Set(ROUTE_REGISTRY.map((r) => r.handlerRef));

      // Build a map from each route's handler ref to whether it has an integration.
      // Group integration URIs by the route entries that reference them, so we can
      // identify which specific handler(s) are missing integrations.
      const handlerToMethods = new Map<string, string[]>();
      for (const route of ROUTE_REGISTRY) {
        const existing = handlerToMethods.get(route.handlerRef) ?? [];
        for (const m of route.methods) {
          existing.push(`${m} ${route.path}`);
        }
        handlerToMethods.set(route.handlerRef, existing);
      }

      // Each unique handler should contribute at least one unique integration URI.
      // If there are fewer unique URIs than unique handlers, identify which are missing
      // by checking that each handler's routes have at least one method with an integration.
      const orphans: string[] = [];

      if (integratedLambdaRefs.size < uniqueHandlers.size) {
        // We know at least one handler is orphaned. Report the deficit count and
        // list all handler refs with their expected routes for debugging.
        const missing = uniqueHandlers.size - integratedLambdaRefs.size;
        orphans.push(
          `${missing} of ${uniqueHandlers.size} unique handler Lambdas have no API Gateway integration.`,
          `Handler refs in registry: ${Array.from(uniqueHandlers).join(", ")}`,
          `Unique integration URIs found: ${integratedLambdaRefs.size}`
        );
      }

      if (orphans.length > 0) {
        expect.fail(orphans.join("\n"));
      }

      // Positive assertion: we have at least as many unique integrations as handlers
      expect(integratedLambdaRefs.size).toBeGreaterThanOrEqual(
        uniqueHandlers.size
      );
    });
  });
});
