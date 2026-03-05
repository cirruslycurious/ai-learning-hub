/**
 * Auth Routes Stack (Story 3.5.2: per-method Lambda wiring)
 *
 * Wires Epic 2 authentication and profile routes to the shared REST API.
 * This stack depends on both ApiGatewayStack (for restApi + authorizers)
 * and AuthStack (for handler Lambdas), breaking the circular dependency
 * that would occur if routes were embedded in ApiGatewayStack.
 *
 * Uses RestApi.fromRestApiAttributes() to import the REST API reference,
 * ensuring route resources are created in THIS stack's CloudFormation
 * template (CDK places API Gateway resources in the owning stack by default).
 *
 * ADR-006 deployment order: Tables -> Auth -> RateLimiting -> ApiGateway -> AuthRoutes -> Observability
 */
import * as cdk from "aws-cdk-lib";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { NagSuppressions } from "cdk-nag";
import { Construct } from "constructs";

export interface AuthRoutesStackProps extends cdk.StackProps {
  /** REST API ID from ApiGatewayStack */
  restApiId: string;
  /** REST API root resource ID from ApiGatewayStack */
  rootResourceId: string;
  /** JWT authorizer for JWT-only routes (from ApiGatewayStack) */
  jwtAuthorizer: apigateway.IAuthorizer;
  /** API Key authorizer for jwt-or-apikey routes (from ApiGatewayStack) */
  apiKeyAuthorizer: apigateway.IAuthorizer;
  /** Validate invite handler (from AuthStack) */
  validateInviteFunction: lambda.IFunction;
  /** Per-method API key handlers (from AuthStack, Story 3.5.2) */
  createApiKeyFunction: lambda.IFunction;
  listApiKeyFunction: lambda.IFunction;
  revokeApiKeyFunction: lambda.IFunction;
  /** Per-method invite code handlers (from AuthStack, Story 3.5.2) */
  generateInviteFunction: lambda.IFunction;
  listInviteCodesFunction: lambda.IFunction;
  /** Per-method users/me handlers (from AuthStack, Story 3.5.2) */
  readUsersMeFunction: lambda.IFunction;
  writeUsersMeFunction: lambda.IFunction;
}

export class AuthRoutesStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: AuthRoutesStackProps) {
    super(scope, id, props);

    const {
      restApiId,
      rootResourceId,
      jwtAuthorizer,
      apiKeyAuthorizer,
      validateInviteFunction,
      createApiKeyFunction,
      listApiKeyFunction,
      revokeApiKeyFunction,
      generateInviteFunction,
      listInviteCodesFunction,
      readUsersMeFunction,
      writeUsersMeFunction,
    } = props;

    // Import the REST API by ID so route resources are created in THIS stack,
    // not in ApiGatewayStack (CDK places resources in the owning stack otherwise).
    const restApi = apigateway.RestApi.fromRestApiAttributes(
      this,
      "ImportedRestApi",
      {
        restApiId,
        rootResourceId,
      }
    );

    // CORS preflight config — must be added explicitly to each resource because
    // imported APIs (via fromRestApiAttributes) do NOT inherit the original
    // RestApi's defaultCorsPreflightOptions. AC3 requires OPTIONS on all resources.
    const corsOptions: apigateway.CorsOptions = {
      allowOrigins: apigateway.Cors.ALL_ORIGINS,
      allowMethods: apigateway.Cors.ALL_METHODS,
      allowHeaders: [
        "Content-Type",
        "Authorization",
        "x-api-key",
        "X-Amz-Date",
        "X-Api-Key",
        "X-Amz-Security-Token",
        "Idempotency-Key", // Story 3.2.1
        "If-Match", // Story 3.2.1
        "X-Agent-ID", // Story 3.2.4
      ],
      exposeHeaders: [
        "X-Request-Id",
        "X-RateLimit-Limit", // Story 3.2.4
        "X-RateLimit-Remaining", // Story 3.2.4
        "X-RateLimit-Reset", // Story 3.2.4
        "X-Agent-ID", // Story 3.2.4
        "X-Idempotent-Replayed", // Story 3.2.1
        "X-Idempotency-Status", // Story 3.2.1
        "Retry-After", // Story 3.2.4
      ],
      maxAge: cdk.Duration.hours(1),
    };

    // /auth/validate-invite — JWT only
    const authResource = restApi.root.addResource("auth");
    authResource.addCorsPreflight(corsOptions);
    const validateInviteResource = authResource.addResource("validate-invite");
    validateInviteResource.addCorsPreflight(corsOptions);
    validateInviteResource.addMethod(
      "POST",
      new apigateway.LambdaIntegration(validateInviteFunction),
      {
        authorizer: jwtAuthorizer,
        authorizationType: apigateway.AuthorizationType.CUSTOM,
      }
    );

    // /users resource tree
    const usersResource = restApi.root.addResource("users");
    usersResource.addCorsPreflight(corsOptions);

    // /users/me — per-method Lambdas (Story 3.5.2, AC3/AC4)
    const usersMeResource = usersResource.addResource("me");
    usersMeResource.addCorsPreflight(corsOptions);
    usersMeResource.addMethod(
      "GET",
      new apigateway.LambdaIntegration(readUsersMeFunction),
      {
        authorizer: apiKeyAuthorizer,
        authorizationType: apigateway.AuthorizationType.CUSTOM,
      }
    );
    usersMeResource.addMethod(
      "PATCH",
      new apigateway.LambdaIntegration(writeUsersMeFunction),
      {
        authorizer: apiKeyAuthorizer,
        authorizationType: apigateway.AuthorizationType.CUSTOM,
      }
    );

    // POST /users/me/update — Command endpoint for profile updates (Story 3.2.8)
    const usersMeUpdateResource = usersMeResource.addResource("update");
    usersMeUpdateResource.addCorsPreflight(corsOptions);
    usersMeUpdateResource.addMethod(
      "POST",
      new apigateway.LambdaIntegration(writeUsersMeFunction),
      {
        authorizer: apiKeyAuthorizer,
        authorizationType: apigateway.AuthorizationType.CUSTOM,
      }
    );

    // /users/api-keys — per-method Lambdas (Story 3.5.2, AC1/AC4)
    const apiKeysResource = usersResource.addResource("api-keys");
    apiKeysResource.addCorsPreflight(corsOptions);
    apiKeysResource.addMethod(
      "POST",
      new apigateway.LambdaIntegration(createApiKeyFunction),
      {
        authorizer: apiKeyAuthorizer,
        authorizationType: apigateway.AuthorizationType.CUSTOM,
      }
    );
    apiKeysResource.addMethod(
      "GET",
      new apigateway.LambdaIntegration(listApiKeyFunction),
      {
        authorizer: apiKeyAuthorizer,
        authorizationType: apigateway.AuthorizationType.CUSTOM,
      }
    );

    // /users/api-keys/{id} — DELETE and /revoke both use revokeApiKeyFunction
    const apiKeyByIdResource = apiKeysResource.addResource("{id}");
    apiKeyByIdResource.addCorsPreflight(corsOptions);
    apiKeyByIdResource.addMethod(
      "DELETE",
      new apigateway.LambdaIntegration(revokeApiKeyFunction),
      {
        authorizer: apiKeyAuthorizer,
        authorizationType: apigateway.AuthorizationType.CUSTOM,
      }
    );

    // POST /users/api-keys/{id}/revoke — Command endpoint for key revocation (Story 3.2.8)
    const apiKeyRevokeResource = apiKeyByIdResource.addResource("revoke");
    apiKeyRevokeResource.addCorsPreflight(corsOptions);
    apiKeyRevokeResource.addMethod(
      "POST",
      new apigateway.LambdaIntegration(revokeApiKeyFunction),
      {
        authorizer: apiKeyAuthorizer,
        authorizationType: apigateway.AuthorizationType.CUSTOM,
      }
    );

    // /users/invite-codes — per-method Lambdas (Story 3.5.2, AC2/AC4)
    const inviteCodesResource = usersResource.addResource("invite-codes");
    inviteCodesResource.addCorsPreflight(corsOptions);
    inviteCodesResource.addMethod(
      "POST",
      new apigateway.LambdaIntegration(generateInviteFunction),
      {
        authorizer: apiKeyAuthorizer,
        authorizationType: apigateway.AuthorizationType.CUSTOM,
      }
    );
    inviteCodesResource.addMethod(
      "GET",
      new apigateway.LambdaIntegration(listInviteCodesFunction),
      {
        authorizer: apiKeyAuthorizer,
        authorizationType: apigateway.AuthorizationType.CUSTOM,
      }
    );

    // --- CDK Nag Suppressions ---
    // AwsSolutions-COG4: We use custom Lambda authorizers (JWT + API Key),
    // not Cognito user pool authorizers. This is by design per ADR-013.
    NagSuppressions.addStackSuppressions(this, [
      {
        id: "AwsSolutions-COG4",
        reason:
          "Custom Lambda authorizers (JWT + API Key per ADR-013) are used instead of Cognito user pool authorizers",
      },
    ]);
  }
}
