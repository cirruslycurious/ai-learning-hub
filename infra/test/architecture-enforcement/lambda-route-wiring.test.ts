/**
 * T4: Lambda ↔ Route Wiring Tests (Story 2.1-D5, AC9-10)
 * Hardened handler identity: Story 2.1-D7, Task 1
 *
 * Validates:
 * - AC9: Every Method's Integration.Uri resolves to a real Lambda function ARN
 *         (not just any string containing "lambda")
 * - AC10: Every handler Lambda has at least one Method integration (no orphans)
 *         (deterministic check via function name extraction, not cardinality)
 */
import { describe, it, expect, beforeAll } from "vitest";
import { Template } from "aws-cdk-lib/assertions";
import {
  createTestApiStacks,
  HANDLER_REF_TO_FUNCTION_NAME,
  extractLambdaFunctionName,
} from "../helpers/create-test-api-stacks";
import { ROUTE_REGISTRY } from "../../config/route-registry";

describe("T4: Lambda ↔ Route Wiring", () => {
  let routesTemplate: Template;

  beforeAll(() => {
    const stacks = createTestApiStacks();
    routesTemplate = stacks.routesTemplate;
  });

  describe("AC9: Every Method Integration.Uri resolves to a Lambda", () => {
    it("all non-OPTIONS methods have valid Lambda function ARN in Integration.Uri", () => {
      const methods = routesTemplate.findResources("AWS::ApiGateway::Method");
      const knownFunctionNames = new Set(
        Object.values(HANDLER_REF_TO_FUNCTION_NAME)
      );

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

        // Extract the Lambda function name from the URI and verify it's a known handler
        const uriStr = JSON.stringify(uri);
        const functionName = extractLambdaFunctionName(uriStr);

        if (!functionName) {
          violations.push(
            `Method ${logicalId} (${httpMethod}) Integration.Uri does not contain a Lambda function ARN`
          );
        } else if (!knownFunctionNames.has(functionName)) {
          violations.push(
            `Method ${logicalId} (${httpMethod}) references unknown Lambda function: ${functionName}`
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

      // Collect all Lambda function names referenced in integration URIs
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
      const uniqueHandlers = new Set(ROUTE_REGISTRY.map((r) => r.handlerRef));
      const orphans: string[] = [];

      for (const handlerRef of uniqueHandlers) {
        const expectedFunctionName = HANDLER_REF_TO_FUNCTION_NAME[handlerRef];
        if (!expectedFunctionName) {
          orphans.push(
            `${handlerRef} — no entry in HANDLER_REF_TO_FUNCTION_NAME map`
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

      // Positive assertion: every handler ref has an integration
      expect(integratedFunctionNames.size).toBeGreaterThanOrEqual(
        uniqueHandlers.size
      );
    });
  });
});
