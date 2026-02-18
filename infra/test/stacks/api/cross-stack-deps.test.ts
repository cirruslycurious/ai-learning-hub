/**
 * T7: Cross-Stack Dependency Validation (Story 2.1-D1, AC17)
 *
 * Validates:
 * - No circular dependencies between stacks (via CDK synth)
 * - Correct dependency order matches documented ADR-006 order
 * - Cross-stack references use CfnOutput exports
 * - AuthRoutesStack depends on both ApiGatewayStack and AuthStack
 */
import { App, Stack } from "aws-cdk-lib";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as wafv2 from "aws-cdk-lib/aws-wafv2";
import { Template } from "aws-cdk-lib/assertions";
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { ApiGatewayStack } from "../../../lib/stacks/api/api-gateway.stack";
import { AuthRoutesStack } from "../../../lib/stacks/api/auth-routes.stack";
import { getAwsEnv } from "../../../config/aws-env";

describe("T7: Cross-Stack Dependency Validation", () => {
  const appSource = readFileSync(
    join(__dirname, "../../../bin/app.ts"),
    "utf-8"
  );

  describe("CDK synth validation (AC18)", () => {
    it("synthesizes ApiGatewayStack + AuthRoutesStack without circular dependencies", () => {
      const app = new App();
      const awsEnv = getAwsEnv();

      const depsStack = new Stack(app, "SynthTestDepsStack", { env: awsEnv });

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

      const apiGatewayStack = new ApiGatewayStack(
        app,
        "SynthTestApiGatewayStack",
        {
          env: awsEnv,
          jwtAuthorizerFunctionArn: makeArn("JwtAuthFn"),
          apiKeyAuthorizerFunctionArn: makeArn("ApiKeyAuthFn"),
          webAcl,
        }
      );

      const authRoutesStack = new AuthRoutesStack(
        app,
        "SynthTestAuthRoutesStack",
        {
          env: awsEnv,
          restApiId: apiGatewayStack.restApi.restApiId,
          rootResourceId: apiGatewayStack.restApi.restApiRootResourceId,
          jwtAuthorizer: apiGatewayStack.jwtAuthorizer,
          apiKeyAuthorizer: apiGatewayStack.apiKeyAuthorizer,
          validateInviteFunction: importFn(depsStack, "ValidateInviteFn"),
          usersMeFunction: importFn(depsStack, "UsersMeFn"),
          apiKeysFunction: importFn(depsStack, "ApiKeysFn"),
          generateInviteFunction: importFn(depsStack, "GenerateInviteFn"),
        }
      );

      // This will throw if there are circular dependencies
      const apiGwTemplate = Template.fromStack(apiGatewayStack);
      const routesTemplate = Template.fromStack(authRoutesStack);

      // Verify both templates have expected resources
      expect(
        Object.keys(apiGwTemplate.findResources("AWS::ApiGateway::RestApi"))
          .length
      ).toBe(1);
      expect(
        Object.keys(routesTemplate.findResources("AWS::ApiGateway::Resource"))
          .length
      ).toBeGreaterThanOrEqual(7);
    });

    it("ApiGatewayStack template exports RestApiId and RestApiUrl", () => {
      const app = new App();
      const awsEnv = getAwsEnv();
      const depsStack = new Stack(app, "OutputTestDeps", { env: awsEnv });

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

      const apiGatewayStack = new ApiGatewayStack(app, "OutputTestApiGateway", {
        env: awsEnv,
        jwtAuthorizerFunctionArn: makeArn("JwtAuthFn"),
        apiKeyAuthorizerFunctionArn: makeArn("ApiKeyAuthFn"),
        webAcl,
      });

      // Create routes stack so authorizers are consumed (required for synth)
      new AuthRoutesStack(app, "OutputTestAuthRoutes", {
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

      const template = Template.fromStack(apiGatewayStack);
      template.hasOutput("RestApiId", {
        Export: { Name: "AiLearningHub-RestApiId" },
      });
      template.hasOutput("RestApiUrl", {
        Export: { Name: "AiLearningHub-RestApiUrl" },
      });
    });
  });

  describe("Stack instantiation order (source-text supplementary)", () => {
    it("instantiates stacks in correct ADR-006 order: Core -> Auth -> API -> AuthRoutes", () => {
      const tablesPos = appSource.indexOf("new TablesStack");
      const bucketsPos = appSource.indexOf("new BucketsStack");
      const authPos = appSource.indexOf("new AuthStack");
      const rateLimitPos = appSource.indexOf("new RateLimitingStack");
      const apiGatewayPos = appSource.indexOf("new ApiGatewayStack");
      const authRoutesPos = appSource.indexOf("new AuthRoutesStack");
      const observabilityPos = appSource.indexOf("new ObservabilityStack");

      // All stacks must exist
      expect(tablesPos).toBeGreaterThan(-1);
      expect(bucketsPos).toBeGreaterThan(-1);
      expect(authPos).toBeGreaterThan(-1);
      expect(rateLimitPos).toBeGreaterThan(-1);
      expect(apiGatewayPos).toBeGreaterThan(-1);
      expect(authRoutesPos).toBeGreaterThan(-1);
      expect(observabilityPos).toBeGreaterThan(-1);

      // Core stacks before Auth
      expect(tablesPos).toBeLessThan(authPos);

      // Auth before API Gateway
      expect(authPos).toBeLessThan(apiGatewayPos);

      // API Gateway before Auth Routes
      expect(apiGatewayPos).toBeLessThan(authRoutesPos);
    });
  });

  describe("Explicit dependencies", () => {
    it("authStack depends on tablesStack", () => {
      expect(appSource).toContain("authStack.addDependency(tablesStack)");
    });

    it("apiGatewayStack does NOT depend on authStack (ARN strings break cycle)", () => {
      // ApiGatewayStack receives ARN strings, not IFunction constructs,
      // so no explicit dependency on authStack is needed (or desired).
      expect(appSource).not.toContain(
        "apiGatewayStack.addDependency(authStack)"
      );
    });

    it("apiGatewayStack depends on rateLimitingStack", () => {
      expect(appSource).toContain(
        "apiGatewayStack.addDependency(rateLimitingStack)"
      );
    });

    it("authRoutesStack depends on apiGatewayStack", () => {
      expect(appSource).toContain(
        "authRoutesStack.addDependency(apiGatewayStack)"
      );
    });

    it("authRoutesStack depends on authStack", () => {
      expect(appSource).toContain("authRoutesStack.addDependency(authStack)");
    });
  });

  describe("No circular dependencies", () => {
    it("does not have any reverse dependency declarations", () => {
      expect(appSource).not.toContain("tablesStack.addDependency(authStack)");
      expect(appSource).not.toContain(
        "authStack.addDependency(apiGatewayStack)"
      );
      expect(appSource).not.toContain(
        "rateLimitingStack.addDependency(apiGatewayStack)"
      );
      expect(appSource).not.toContain(
        "apiGatewayStack.addDependency(authRoutesStack)"
      );
    });
  });

  describe("Cross-stack references use proper patterns", () => {
    it("ApiGatewayStack receives authorizer Lambda ARNs via Fn.importValue (breaks CDK cross-stack cycle)", () => {
      expect(appSource).toContain(
        "jwtAuthorizerFunctionArn: cdk.Fn.importValue("
      );
      expect(appSource).toContain('"AiLearningHub-JwtAuthorizerFunctionArn"');
      expect(appSource).toContain(
        "apiKeyAuthorizerFunctionArn: cdk.Fn.importValue("
      );
      expect(appSource).toContain(
        '"AiLearningHub-ApiKeyAuthorizerFunctionArn"'
      );
    });

    it("ApiGatewayStack receives WAF WebACL from RateLimitingStack via props", () => {
      expect(appSource).toContain("webAcl: rateLimitingStack.webAcl");
    });

    it("AuthRoutesStack receives restApiId and rootResourceId from ApiGatewayStack via props", () => {
      expect(appSource).toContain(
        "restApiId: apiGatewayStack.restApi.restApiId"
      );
      expect(appSource).toContain(
        "rootResourceId: apiGatewayStack.restApi.restApiRootResourceId"
      );
    });

    it("AuthRoutesStack receives authorizers from ApiGatewayStack via props", () => {
      expect(appSource).toContain(
        "jwtAuthorizer: apiGatewayStack.jwtAuthorizer"
      );
      expect(appSource).toContain(
        "apiKeyAuthorizer: apiGatewayStack.apiKeyAuthorizer"
      );
    });

    it("AuthRoutesStack receives handler Lambdas from AuthStack via props", () => {
      expect(appSource).toContain(
        "validateInviteFunction: authStack.validateInviteFunction"
      );
      expect(appSource).toContain("usersMeFunction: authStack.usersMeFunction");
      expect(appSource).toContain("apiKeysFunction: authStack.apiKeysFunction");
      expect(appSource).toContain(
        "generateInviteFunction: authStack.generateInviteFunction"
      );
    });
  });

  describe("CfnOutput exports", () => {
    it("AuthStack exports function ARNs via CfnOutput", () => {
      const authStackSource = readFileSync(
        join(__dirname, "../../../lib/stacks/auth/auth.stack.ts"),
        "utf-8"
      );
      expect(authStackSource).toContain("CfnOutput");
      expect(authStackSource).toContain(
        "AiLearningHub-JwtAuthorizerFunctionArn"
      );
      expect(authStackSource).toContain(
        "AiLearningHub-ApiKeyAuthorizerFunctionArn"
      );
    });

    it("RateLimitingStack exports WebACL ARN via CfnOutput", () => {
      const rateLimitSource = readFileSync(
        join(__dirname, "../../../lib/stacks/api/rate-limiting.stack.ts"),
        "utf-8"
      );
      expect(rateLimitSource).toContain("CfnOutput");
      expect(rateLimitSource).toContain("AiLearningHub-RateLimitWebAclArn");
    });

    it("ApiGatewayStack exports REST API ID via CfnOutput", () => {
      const apiGatewaySource = readFileSync(
        join(__dirname, "../../../lib/stacks/api/api-gateway.stack.ts"),
        "utf-8"
      );
      expect(apiGatewaySource).toContain("CfnOutput");
      expect(apiGatewaySource).toContain("AiLearningHub-RestApiId");
      expect(apiGatewaySource).toContain("AiLearningHub-RestApiUrl");
    });
  });
});
