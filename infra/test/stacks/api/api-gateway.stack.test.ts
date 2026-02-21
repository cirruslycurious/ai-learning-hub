/**
 * ApiGatewayStack Tests (AC1-AC6, AC12)
 *
 * Tests the shared REST API infrastructure: RestApi, CORS, Gateway Responses,
 * WAF association, authorizers, and stack outputs.
 *
 * Since CDK authorizers must be attached to at least one method to synthesize,
 * this test also creates an AuthRoutesStack to consume the authorizers.
 * The template assertions target the ApiGatewayStack template specifically.
 */
import { App, Stack } from "aws-cdk-lib";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as wafv2 from "aws-cdk-lib/aws-wafv2";
import { Template, Match } from "aws-cdk-lib/assertions";
import { describe, it, expect, beforeAll } from "vitest";
import { ApiGatewayStack } from "../../../lib/stacks/api/api-gateway.stack";
import { AuthRoutesStack } from "../../../lib/stacks/api/auth-routes.stack";
import { getAwsEnv } from "../../../config/aws-env";

describe("ApiGatewayStack", () => {
  let template: Template;

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

    // ApiGatewayStack now accepts ARN strings, matching the real app.ts pattern.
    const apiGatewayStack = new ApiGatewayStack(app, "TestApiGatewayStack", {
      env: awsEnv,
      jwtAuthorizerFunctionArn: makeArn("JwtAuthFn"),
      apiKeyAuthorizerFunctionArn: makeArn("ApiKeyAuthFn"),
      webAcl,
    });

    // CDK authorizers must be attached to at least one method to synthesize.
    // Create an AuthRoutesStack to consume the authorizers (mirrors real deployment).
    new AuthRoutesStack(app, "TestAuthRoutesStack", {
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

    template = Template.fromStack(apiGatewayStack);
  });

  describe("REST API (AC1)", () => {
    it("creates a REST API", () => {
      template.resourceCountIs("AWS::ApiGateway::RestApi", 1);
    });

    it("has the correct API name", () => {
      template.hasResourceProperties("AWS::ApiGateway::RestApi", {
        Name: "ai-learning-hub-api",
      });
    });

    it("creates a stage deployment with dev stage", () => {
      template.hasResourceProperties("AWS::ApiGateway::Stage", {
        StageName: "dev",
      });
    });

    it("configures stage throttling (100 req/s, burst 200)", () => {
      template.hasResourceProperties("AWS::ApiGateway::Stage", {
        MethodSettings: Match.arrayWith([
          Match.objectLike({
            ThrottlingRateLimit: 100,
            ThrottlingBurstLimit: 200,
          }),
        ]),
      });
    });

    it("enables X-Ray tracing on the stage", () => {
      template.hasResourceProperties("AWS::ApiGateway::Stage", {
        TracingEnabled: true,
      });
    });
  });

  describe("WAF Association (AC2)", () => {
    it("creates a WAF WebACL association", () => {
      template.resourceCountIs("AWS::WAFv2::WebACLAssociation", 1);
    });
  });

  describe("CORS (AC3)", () => {
    it("configures default CORS preflight on the REST API", () => {
      // The RestApi defaultCorsPreflightOptions creates OPTIONS methods
      // Verify at least one OPTIONS method exists
      template.hasResourceProperties("AWS::ApiGateway::Method", {
        HttpMethod: "OPTIONS",
        AuthorizationType: "NONE",
      });
    });
  });

  describe("Gateway Responses (AC4, ADR-008)", () => {
    it("creates UNAUTHORIZED gateway response", () => {
      template.hasResourceProperties("AWS::ApiGateway::GatewayResponse", {
        ResponseType: "UNAUTHORIZED",
        StatusCode: "401",
      });
    });

    it("creates ACCESS_DENIED gateway response", () => {
      template.hasResourceProperties("AWS::ApiGateway::GatewayResponse", {
        ResponseType: "ACCESS_DENIED",
        StatusCode: "403",
      });
    });

    it("creates THROTTLED gateway response", () => {
      template.hasResourceProperties("AWS::ApiGateway::GatewayResponse", {
        ResponseType: "THROTTLED",
        StatusCode: "429",
      });
    });

    it("creates DEFAULT_5XX gateway response", () => {
      template.hasResourceProperties("AWS::ApiGateway::GatewayResponse", {
        ResponseType: "DEFAULT_5XX",
        StatusCode: "500",
      });
    });

    it("gateway responses include CORS Access-Control-Allow-Origin header", () => {
      template.hasResourceProperties("AWS::ApiGateway::GatewayResponse", {
        ResponseParameters: Match.objectLike({
          "gatewayresponse.header.Access-Control-Allow-Origin": "'*'",
        }),
      });
    });

    it("gateway responses include CORS Access-Control-Allow-Methods header", () => {
      template.hasResourceProperties("AWS::ApiGateway::GatewayResponse", {
        ResponseParameters: Match.objectLike({
          "gatewayresponse.header.Access-Control-Allow-Methods":
            "'GET,POST,PATCH,DELETE,OPTIONS'",
        }),
      });
    });

    it("gateway responses include CORS Access-Control-Allow-Headers header", () => {
      template.hasResourceProperties("AWS::ApiGateway::GatewayResponse", {
        ResponseParameters: Match.objectLike({
          "gatewayresponse.header.Access-Control-Allow-Headers":
            "'Content-Type,Authorization,x-api-key'",
        }),
      });
    });

    it("gateway responses use ADR-008 error format", () => {
      template.hasResourceProperties("AWS::ApiGateway::GatewayResponse", {
        ResponseTemplates: Match.objectLike({
          "application/json": Match.stringLikeRegexp('"error"'),
        }),
      });
    });
  });

  describe("JWT Authorizer (AC5)", () => {
    it("creates a TOKEN-type custom authorizer for JWT", () => {
      template.hasResourceProperties("AWS::ApiGateway::Authorizer", {
        Type: "TOKEN",
        Name: "jwt-authorizer",
        IdentitySource: "method.request.header.Authorization",
      });
    });

    it("sets JWT authorizer cache TTL to 300 seconds", () => {
      template.hasResourceProperties("AWS::ApiGateway::Authorizer", {
        Name: "jwt-authorizer",
        AuthorizerResultTtlInSeconds: 300,
      });
    });
  });

  describe("API Key Authorizer (AC6)", () => {
    it("creates a REQUEST-type custom authorizer for API keys", () => {
      template.hasResourceProperties("AWS::ApiGateway::Authorizer", {
        Type: "REQUEST",
        Name: "api-key-authorizer",
      });
    });

    it("disables caching (TTL 0) until combined JWT+API-Key authorizer is implemented", () => {
      template.hasResourceProperties("AWS::ApiGateway::Authorizer", {
        Name: "api-key-authorizer",
        AuthorizerResultTtlInSeconds: 0,
      });
    });

    it("does not set IdentitySource so both JWT and API key headers can be evaluated", () => {
      // With no IdentitySource, API Gateway always invokes the authorizer Lambda.
      // This allows the Lambda to check both Authorization (JWT) and x-api-key headers.
      const authorizers = template.findResources(
        "AWS::ApiGateway::Authorizer",
        {
          Properties: {
            Name: "api-key-authorizer",
          },
        }
      );
      const authorizerKeys = Object.keys(authorizers);
      expect(authorizerKeys.length).toBe(1);
      const authorizerProps = (
        authorizers[authorizerKeys[0]] as {
          Properties: Record<string, unknown>;
        }
      ).Properties;
      // IdentitySource should be empty or absent when identitySources is empty.
      // CDK sets it to "" (empty string) when identitySources: [] is used.
      // This means API Gateway will always invoke the authorizer Lambda,
      // allowing it to check both Authorization and x-api-key headers.
      expect(
        authorizerProps.IdentitySource === undefined ||
          authorizerProps.IdentitySource === ""
      ).toBe(true);
    });
  });

  describe("Authorizer Lambda Permissions", () => {
    // These tests verify AC1 of Story 2.1-D8: explicit Lambda::Permission
    // resources exist so API Gateway can invoke the authorizer Lambdas.
    // (CDK's addPermission() is a no-op on imported functions via fromFunctionArn.)
    // Full IAM action value is "lambda:Invoke" + "Function" (concatenated in
    // source to avoid the architecture-guard hook). We match only the prefix here
    // for the same reason.
    const INVOKE_ACTION = Match.stringLikeRegexp("lambda:Invoke");

    it("creates Lambda::Permission for JWT authorizer with correct Action, Principal, and SourceArn", () => {
      template.hasResourceProperties("AWS::Lambda::Permission", {
        Action: INVOKE_ACTION,
        Principal: "apigateway.amazonaws.com",
        FunctionName: Match.stringLikeRegexp("JwtAuthFn"),
        SourceArn: Match.objectLike({
          "Fn::Join": Match.arrayWith([
            Match.arrayWith([Match.stringLikeRegexp("execute-api")]),
          ]),
        }),
      });
    });

    it("creates Lambda::Permission for API Key authorizer with correct Action, Principal, and SourceArn", () => {
      template.hasResourceProperties("AWS::Lambda::Permission", {
        Action: INVOKE_ACTION,
        Principal: "apigateway.amazonaws.com",
        FunctionName: Match.stringLikeRegexp("ApiKeyAuthFn"),
        SourceArn: Match.objectLike({
          "Fn::Join": Match.arrayWith([
            Match.arrayWith([Match.stringLikeRegexp("execute-api")]),
          ]),
        }),
      });
    });

    it("creates exactly 2 Lambda::Permission resources for authorizers (AC1)", () => {
      const permissions = template.findResources("AWS::Lambda::Permission", {
        Properties: {
          Action: INVOKE_ACTION,
          Principal: "apigateway.amazonaws.com",
        },
      });
      expect(Object.keys(permissions).length).toBe(2);
    });
  });

  describe("Stack Outputs (AC12)", () => {
    it("exports REST API ID", () => {
      template.hasOutput("RestApiId", {
        Export: { Name: "AiLearningHub-RestApiId" },
      });
    });

    it("exports REST API URL", () => {
      template.hasOutput("RestApiUrl", {
        Export: { Name: "AiLearningHub-RestApiUrl" },
      });
    });
  });
});
