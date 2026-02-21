/**
 * T1: API Gateway Contract Tests (Story 2.1-D5, AC1-4)
 *
 * Validates:
 * - AC1: Every non-OPTIONS method has AuthorizationType != NONE
 * - AC2: Gateway Responses exist for 4 types with ADR-008 templates
 * - AC3: Every resource has an OPTIONS method (CORS preflight)
 * - AC4: WAF CfnWebACLAssociation links WebACL to RestApi stage
 */
import { describe, it, expect, beforeAll } from "vitest";
import { Template } from "aws-cdk-lib/assertions";
import { createTestApiStacks } from "../helpers/create-test-api-stacks";

describe("T1: API Gateway Contract", () => {
  let apiGwTemplate: Template;
  let routesTemplate: Template;

  beforeAll(() => {
    const stacks = createTestApiStacks();
    apiGwTemplate = stacks.apiGwTemplate;
    routesTemplate = stacks.routesTemplate;
  });

  describe("AC1: Every non-OPTIONS method has AuthorizationType != NONE", () => {
    it("all methods in ApiGatewayStack have authorizers (except OPTIONS)", () => {
      const methods = apiGwTemplate.findResources("AWS::ApiGateway::Method");

      for (const [logicalId, resource] of Object.entries(methods)) {
        const props = (resource as { Properties: Record<string, unknown> })
          .Properties;
        const httpMethod = props.HttpMethod as string;

        if (httpMethod === "OPTIONS") continue;

        expect(
          props.AuthorizationType,
          `Method ${logicalId} (${httpMethod}) must have AuthorizationType != NONE`
        ).not.toBe("NONE");
      }
    });

    it("all methods in AuthRoutesStack have authorizers (except OPTIONS)", () => {
      const methods = routesTemplate.findResources("AWS::ApiGateway::Method");

      for (const [logicalId, resource] of Object.entries(methods)) {
        const props = (resource as { Properties: Record<string, unknown> })
          .Properties;
        const httpMethod = props.HttpMethod as string;

        if (httpMethod === "OPTIONS") continue;

        expect(
          props.AuthorizationType,
          `Method ${logicalId} (${httpMethod}) must have AuthorizationType != NONE`
        ).not.toBe("NONE");
      }
    });
  });

  describe("AC2: Gateway Responses with ADR-008 error templates", () => {
    const expectedResponses = [
      { type: "UNAUTHORIZED", code: "UNAUTHORIZED" },
      { type: "ACCESS_DENIED", code: "FORBIDDEN" },
      { type: "THROTTLED", code: "RATE_LIMITED" },
      { type: "DEFAULT_5XX", code: "INTERNAL_ERROR" },
    ];

    it("has Gateway Response resources for all 4 required types", () => {
      const gwResponses = apiGwTemplate.findResources(
        "AWS::ApiGateway::GatewayResponse"
      );
      const responseTypes = Object.values(gwResponses).map(
        (r) =>
          (r as { Properties: Record<string, unknown> }).Properties
            .ResponseType as string
      );

      for (const expected of expectedResponses) {
        expect(
          responseTypes,
          `Missing Gateway Response for ${expected.type}`
        ).toContain(expected.type);
      }
    });

    const expectedStatusCodes: Record<string, string> = {
      UNAUTHORIZED: "401",
      ACCESS_DENIED: "403",
      THROTTLED: "429",
      DEFAULT_5XX: "500",
    };

    for (const expected of expectedResponses) {
      it(`Gateway Response ${expected.type} has ADR-008 template with code "${expected.code}"`, () => {
        const gwResponses = apiGwTemplate.findResources(
          "AWS::ApiGateway::GatewayResponse"
        );
        const response = Object.values(gwResponses).find(
          (r) =>
            (r as { Properties: Record<string, unknown> }).Properties
              .ResponseType === expected.type
        );

        expect(
          response,
          `Gateway Response ${expected.type} not found`
        ).toBeDefined();

        const props = (response as { Properties: Record<string, unknown> })
          .Properties;
        const templates = props.ResponseTemplates as Record<string, string>;
        const jsonTemplate = templates["application/json"];

        expect(jsonTemplate).toBeDefined();
        const parsed = JSON.parse(jsonTemplate);
        expect(parsed).toHaveProperty("error");
        expect(parsed.error).toHaveProperty("code", expected.code);
        expect(parsed.error).toHaveProperty("message");
        expect(parsed.error).toHaveProperty("requestId");

        // D7-AC3: Verify StatusCode matches the expected HTTP status
        const statusCode = props.StatusCode as string;
        const expectedStatus = expectedStatusCodes[expected.type];
        expect(
          statusCode,
          `Gateway Response ${expected.type} should have StatusCode ${expectedStatus}`
        ).toBe(expectedStatus);
      });
    }
  });

  describe("AC3: Every resource has an OPTIONS method (CORS preflight)", () => {
    it("all resources in AuthRoutesStack have OPTIONS methods", () => {
      const resources = routesTemplate.findResources(
        "AWS::ApiGateway::Resource"
      );
      const methods = routesTemplate.findResources("AWS::ApiGateway::Method");

      // Build set of resource logical IDs that have an OPTIONS method
      const resourcesWithOptions = new Set<string>();
      for (const [, method] of Object.entries(methods)) {
        const props = (method as { Properties: Record<string, unknown> })
          .Properties;
        if (props.HttpMethod === "OPTIONS") {
          // ResourceId is a Ref to the resource logical ID
          const resourceRef = props.ResourceId as { Ref?: string };
          if (resourceRef?.Ref) {
            resourcesWithOptions.add(resourceRef.Ref);
          }
        }
      }

      // Every resource should have OPTIONS
      for (const [logicalId] of Object.entries(resources)) {
        expect(
          resourcesWithOptions.has(logicalId),
          `Resource ${logicalId} is missing OPTIONS method (CORS preflight)`
        ).toBe(true);
      }
    });
  });

  describe("AC4: WAF WebACL Association", () => {
    it("has a CfnWebACLAssociation linking WAF to the RestApi stage", () => {
      const associations = apiGwTemplate.findResources(
        "AWS::WAFv2::WebACLAssociation"
      );

      expect(
        Object.keys(associations).length,
        "Expected exactly 1 WebACLAssociation"
      ).toBe(1);
    });
  });
});
