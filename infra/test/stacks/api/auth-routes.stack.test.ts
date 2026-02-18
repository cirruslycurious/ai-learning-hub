/**
 * AuthRoutesStack Tests (AC7-AC10, AC16)
 *
 * Validates Epic 2 routes are correctly wired with proper authorizers.
 * Uses the same pattern as real deployment: ApiGatewayStack creates the
 * RestApi + authorizers, AuthRoutesStack imports by ID and adds routes.
 */
import { App, Stack } from "aws-cdk-lib";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as wafv2 from "aws-cdk-lib/aws-wafv2";
import { Template } from "aws-cdk-lib/assertions";
import { describe, it, expect, beforeAll } from "vitest";
import { ApiGatewayStack } from "../../../lib/stacks/api/api-gateway.stack";
import { AuthRoutesStack } from "../../../lib/stacks/api/auth-routes.stack";
import { getAwsEnv } from "../../../config/aws-env";

describe("AuthRoutesStack", () => {
  let routesTemplate: Template;
  let apiGwTemplate: Template;
  let jwtAuthorizerLogicalId: string;
  let apiKeyAuthorizerLogicalId: string;

  beforeAll(() => {
    const app = new App();
    const awsEnv = getAwsEnv();

    const depsStack = new Stack(app, "TestDepsStack", { env: awsEnv });

    const webAcl = new wafv2.CfnWebACL(depsStack, "TestWebAcl", {
      scope: "REGIONAL",
      defaultAction: { allow: {} },
      visibilityConfig: {
        cloudWatchMetricsEnabled: true,
        metricName: "TestMetric",
        sampledRequestsEnabled: true,
      },
    });

    const testAccount = awsEnv.account ?? "123456789012";
    const testRegion = awsEnv.region ?? "us-east-2";
    const makeArn = (name: string) =>
      `arn:aws:lambda:${testRegion}:${testAccount}:function:${name}`;
    const importFn = (stack: Stack, name: string) =>
      lambda.Function.fromFunctionArn(stack, name, makeArn(name));

    const apiGatewayStack = new ApiGatewayStack(app, "TestApiGatewayStack", {
      env: awsEnv,
      jwtAuthorizerFunctionArn: makeArn("JwtAuthFn"),
      apiKeyAuthorizerFunctionArn: makeArn("ApiKeyAuthFn"),
      webAcl,
    });

    const authRoutesStack = new AuthRoutesStack(app, "TestAuthRoutesStack", {
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

    routesTemplate = Template.fromStack(authRoutesStack);
    apiGwTemplate = Template.fromStack(apiGatewayStack);

    // Extract authorizer logical IDs from ApiGatewayStack template
    const authorizers = apiGwTemplate.findResources(
      "AWS::ApiGateway::Authorizer"
    );
    for (const [logicalId, resource] of Object.entries(authorizers)) {
      const props = (resource as { Properties: Record<string, unknown> })
        .Properties;
      if (props.Name === "jwt-authorizer") {
        jwtAuthorizerLogicalId = logicalId;
      }
      if (props.Name === "api-key-authorizer") {
        apiKeyAuthorizerLogicalId = logicalId;
      }
    }
  });

  describe("Route Resources (AC7-AC10)", () => {
    it("creates API Gateway resources for auth and users paths", () => {
      const resources = routesTemplate.findResources(
        "AWS::ApiGateway::Resource"
      );
      // auth, validate-invite, users, me, api-keys, {id}, invite-codes = 7
      expect(Object.keys(resources).length).toBeGreaterThanOrEqual(7);
    });

    it("creates POST method for /auth/validate-invite (AC7)", () => {
      routesTemplate.hasResourceProperties("AWS::ApiGateway::Method", {
        HttpMethod: "POST",
        AuthorizationType: "CUSTOM",
      });
    });

    it("creates GET and PATCH methods for /users/me (AC8)", () => {
      routesTemplate.hasResourceProperties("AWS::ApiGateway::Method", {
        HttpMethod: "GET",
        AuthorizationType: "CUSTOM",
      });
      routesTemplate.hasResourceProperties("AWS::ApiGateway::Method", {
        HttpMethod: "PATCH",
        AuthorizationType: "CUSTOM",
      });
    });

    it("creates DELETE method for /users/api-keys/{id} (AC9)", () => {
      routesTemplate.hasResourceProperties("AWS::ApiGateway::Method", {
        HttpMethod: "DELETE",
        AuthorizationType: "CUSTOM",
      });
    });

    it("all non-OPTIONS methods use CUSTOM auth type", () => {
      const allMethods = routesTemplate.findResources(
        "AWS::ApiGateway::Method"
      );
      for (const [, method] of Object.entries(allMethods)) {
        const props = (method as { Properties: Record<string, unknown> })
          .Properties;
        if (props.HttpMethod !== "OPTIONS") {
          expect(props.AuthorizationType).toBe("CUSTOM");
        }
      }
    });

    it("creates OPTIONS preflight methods on route resources (AC3)", () => {
      // Imported APIs don't inherit defaultCorsPreflightOptions,
      // so addCorsPreflight() must be called on each resource.
      const allMethods = routesTemplate.findResources(
        "AWS::ApiGateway::Method"
      );
      const optionsMethods = Object.entries(allMethods).filter(([, method]) => {
        const props = (method as { Properties: Record<string, unknown> })
          .Properties;
        return props.HttpMethod === "OPTIONS";
      });
      // 7 resources need OPTIONS: auth, validate-invite, users, me, api-keys, {id}, invite-codes
      expect(optionsMethods.length).toBeGreaterThanOrEqual(7);
    });
  });

  describe("Authorizer-per-route verification (Finding #7)", () => {
    it("resolves authorizer logical IDs from ApiGatewayStack", () => {
      expect(jwtAuthorizerLogicalId).toBeTruthy();
      expect(apiKeyAuthorizerLogicalId).toBeTruthy();
      expect(jwtAuthorizerLogicalId).not.toBe(apiKeyAuthorizerLogicalId);
    });

    it("/auth/validate-invite POST uses the JWT authorizer", () => {
      // Find the validate-invite resource
      const resources = routesTemplate.findResources(
        "AWS::ApiGateway::Resource"
      );
      let validateInviteResourceId: string | undefined;
      for (const [logicalId, resource] of Object.entries(resources)) {
        const props = (resource as { Properties: Record<string, unknown> })
          .Properties;
        if (props.PathPart === "validate-invite") {
          validateInviteResourceId = logicalId;
        }
      }
      expect(validateInviteResourceId).toBeTruthy();

      // Find the POST method on validate-invite and verify its authorizer
      const methods = routesTemplate.findResources("AWS::ApiGateway::Method");
      let foundJwtAuthorizedRoute = false;
      for (const [, method] of Object.entries(methods)) {
        const props = (method as { Properties: Record<string, unknown> })
          .Properties;
        if (props.HttpMethod !== "POST") continue;

        const resourceRef = props.ResourceId as Record<string, unknown>;
        if (!resourceRef || !resourceRef.Ref) continue;
        if (resourceRef.Ref !== validateInviteResourceId) continue;

        // This is the POST method on /auth/validate-invite
        const authorizerId = props.AuthorizerId as Record<string, unknown>;
        if (authorizerId) {
          // Cross-stack reference: {"Fn::ImportValue": "...JwtAuthorizer..."}
          const importValue = authorizerId["Fn::ImportValue"] as string;
          if (importValue && importValue.includes(jwtAuthorizerLogicalId)) {
            foundJwtAuthorizedRoute = true;
          }
        }
      }
      expect(foundJwtAuthorizedRoute).toBe(true);
    });

    it("/users/* GET/PATCH methods use the API Key authorizer", () => {
      const methods = routesTemplate.findResources("AWS::ApiGateway::Method");

      // Find at least one GET method using the API Key authorizer
      let foundApiKeyRoute = false;
      for (const [, method] of Object.entries(methods)) {
        const props = (method as { Properties: Record<string, unknown> })
          .Properties;
        if (props.HttpMethod === "OPTIONS") continue;
        if (props.AuthorizationType !== "CUSTOM") continue;

        const authorizerId = props.AuthorizerId as Record<string, unknown>;
        if (!authorizerId) continue;

        const importValue = authorizerId["Fn::ImportValue"] as string;
        if (
          importValue &&
          importValue.includes(apiKeyAuthorizerLogicalId) &&
          props.HttpMethod === "GET"
        ) {
          foundApiKeyRoute = true;
        }
      }
      expect(foundApiKeyRoute).toBe(true);
    });

    it("JWT and API Key authorizers are different authorizer IDs", () => {
      // Collect all unique authorizer references from methods
      const methods = routesTemplate.findResources("AWS::ApiGateway::Method");
      const authorizerRefs = new Set<string>();

      for (const [, method] of Object.entries(methods)) {
        const props = (method as { Properties: Record<string, unknown> })
          .Properties;
        if (props.HttpMethod === "OPTIONS") continue;

        const authorizerId = props.AuthorizerId as Record<string, unknown>;
        if (authorizerId) {
          const importValue = authorizerId["Fn::ImportValue"] as string;
          if (importValue) {
            authorizerRefs.add(importValue);
          }
        }
      }
      // Should have exactly 2 different authorizer references (JWT and API Key)
      expect(authorizerRefs.size).toBe(2);
    });
  });
});
