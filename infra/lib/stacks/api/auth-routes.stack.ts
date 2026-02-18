/**
 * Auth Routes Stack (AC7-AC10, AC11 extensibility pattern, AC16)
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
 * Future epics create similar route stacks (e.g., SavesRoutesStack)
 * following this same pattern.
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
  /** Handler Lambdas from AuthStack */
  validateInviteFunction: lambda.IFunction;
  usersMeFunction: lambda.IFunction;
  apiKeysFunction: lambda.IFunction;
  generateInviteFunction: lambda.IFunction;
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
      usersMeFunction,
      apiKeysFunction,
      generateInviteFunction,
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
      ],
      maxAge: cdk.Duration.hours(1),
    };

    // /auth/validate-invite (AC7) -- JWT only
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

    // /users/me (AC8) -- JWT or API Key
    const usersMeResource = usersResource.addResource("me");
    usersMeResource.addCorsPreflight(corsOptions);
    for (const method of ["GET", "PATCH"]) {
      usersMeResource.addMethod(
        method,
        new apigateway.LambdaIntegration(usersMeFunction),
        {
          authorizer: apiKeyAuthorizer,
          authorizationType: apigateway.AuthorizationType.CUSTOM,
        }
      );
    }

    // /users/api-keys (AC9) -- JWT or API Key
    const apiKeysResource = usersResource.addResource("api-keys");
    apiKeysResource.addCorsPreflight(corsOptions);
    for (const method of ["POST", "GET"]) {
      apiKeysResource.addMethod(
        method,
        new apigateway.LambdaIntegration(apiKeysFunction),
        {
          authorizer: apiKeyAuthorizer,
          authorizationType: apigateway.AuthorizationType.CUSTOM,
        }
      );
    }

    // /users/api-keys/{id} (AC9) -- JWT or API Key
    const apiKeyByIdResource = apiKeysResource.addResource("{id}");
    apiKeyByIdResource.addCorsPreflight(corsOptions);
    apiKeyByIdResource.addMethod(
      "DELETE",
      new apigateway.LambdaIntegration(apiKeysFunction),
      {
        authorizer: apiKeyAuthorizer,
        authorizationType: apigateway.AuthorizationType.CUSTOM,
      }
    );

    // /users/invite-codes (AC10) -- JWT or API Key
    const inviteCodesResource = usersResource.addResource("invite-codes");
    inviteCodesResource.addCorsPreflight(corsOptions);
    for (const method of ["POST", "GET"]) {
      inviteCodesResource.addMethod(
        method,
        new apigateway.LambdaIntegration(generateInviteFunction),
        {
          authorizer: apiKeyAuthorizer,
          authorizationType: apigateway.AuthorizationType.CUSTOM,
        }
      );
    }

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
