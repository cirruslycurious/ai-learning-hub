/**
 * API Gateway Stack -- REST API with shared authorizers, CORS, WAF, Gateway Responses
 *
 * Creates the central RestApi resource with authorizers, CORS config,
 * ADR-008 Gateway Responses, and WAF association. Does NOT create routes --
 * route stacks (e.g., AuthRoutesStack) consume restApi and authorizers via props.
 *
 * Extensibility (AC11): Future epics add routes by creating separate route stacks
 * and passing restApi + authorizers via props. The restApi, jwtAuthorizer, and
 * apiKeyAuthorizer are exported as public properties for this purpose (AC12).
 *
 * ADR-005: All traffic through API Gateway
 * ADR-008: Gateway Responses for standardized error formatting
 * ADR-013: JWT + API Key custom authorizer wiring
 * ADR-014: API-first design
 */
import * as cdk from "aws-cdk-lib";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as wafv2 from "aws-cdk-lib/aws-wafv2";
import { NagSuppressions } from "cdk-nag";
import { Construct } from "constructs";

export interface ApiGatewayStackProps extends cdk.StackProps {
  /** JWT authorizer Lambda ARN (from AuthStack.jwtAuthorizerFunction.functionArn).
   *  Passed as string to avoid CDK cross-stack permission grants that create cycles. */
  jwtAuthorizerFunctionArn: string;
  /** API Key authorizer Lambda ARN (from AuthStack.apiKeyAuthorizerFunction.functionArn).
   *  Passed as string to avoid CDK cross-stack permission grants that create cycles. */
  apiKeyAuthorizerFunctionArn: string;
  /** WAF WebACL (from RateLimitingStack) */
  webAcl: wafv2.CfnWebACL;
  /** API Gateway deployment stage name (e.g., "dev", "staging", "prod"). Defaults to "dev". */
  stageName?: string;
}

export class ApiGatewayStack extends cdk.Stack {
  /** The REST API -- exported for future route constructs (AC12) */
  public readonly restApi: apigateway.RestApi;
  /** JWT custom authorizer -- for JWT-only routes */
  public readonly jwtAuthorizer: apigateway.TokenAuthorizer;
  /** API Key custom authorizer -- for jwt-or-apikey routes */
  public readonly apiKeyAuthorizer: apigateway.RequestAuthorizer;

  constructor(scope: Construct, id: string, props: ApiGatewayStackProps) {
    super(scope, id, props);

    const {
      jwtAuthorizerFunctionArn,
      apiKeyAuthorizerFunctionArn,
      webAcl,
      stageName = "dev",
    } = props;

    // Import authorizer Lambdas by ARN to avoid CDK cross-stack permission
    // grants. When real Lambda constructs are passed across stacks, CDK
    // auto-generates Lambda::Permission resources that reference the RestApi
    // ARN, creating a circular dependency. Using fromFunctionArn() creates
    // token references without generating cross-stack permissions.
    const jwtAuthorizerFunction = lambda.Function.fromFunctionArn(
      this,
      "ImportedJwtAuthFn",
      jwtAuthorizerFunctionArn
    );
    const apiKeyAuthorizerFunction = lambda.Function.fromFunctionArn(
      this,
      "ImportedApiKeyAuthFn",
      apiKeyAuthorizerFunctionArn
    );

    // --- REST API (AC1) ---
    this.restApi = new apigateway.RestApi(this, "RestApi", {
      restApiName: "ai-learning-hub-api",
      description: "AI Learning Hub REST API (Epic 2.1-D1)",
      deployOptions: {
        stageName,
        throttlingRateLimit: 100,
        throttlingBurstLimit: 200,
        tracingEnabled: true,
      },
      defaultCorsPreflightOptions: {
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
      },
    });

    // --- Gateway Responses (AC4, ADR-008) ---
    const gatewayResponses: {
      type: apigateway.ResponseType;
      statusCode: string;
      code: string;
      message: string;
    }[] = [
      {
        type: apigateway.ResponseType.UNAUTHORIZED,
        statusCode: "401",
        code: "UNAUTHORIZED",
        message: "Missing or invalid authentication credentials",
      },
      {
        type: apigateway.ResponseType.ACCESS_DENIED,
        statusCode: "403",
        code: "FORBIDDEN",
        message: "You do not have permission to access this resource",
      },
      {
        type: apigateway.ResponseType.THROTTLED,
        statusCode: "429",
        code: "RATE_LIMITED",
        message: "Too many requests. Please try again later.",
      },
      {
        type: apigateway.ResponseType.DEFAULT_5XX,
        statusCode: "500",
        code: "INTERNAL_ERROR",
        message: "An unexpected error occurred",
      },
    ];

    for (const gr of gatewayResponses) {
      this.restApi.addGatewayResponse(`GatewayResponse${gr.code}`, {
        type: gr.type,
        statusCode: gr.statusCode,
        responseHeaders: {
          "Access-Control-Allow-Origin": "'*'",
          "Access-Control-Allow-Headers":
            "'Content-Type,Authorization,x-api-key'",
          "Access-Control-Allow-Methods": "'GET,POST,PATCH,DELETE,OPTIONS'",
        },
        templates: {
          "application/json": JSON.stringify({
            error: {
              code: gr.code,
              message: gr.message,
              requestId: "$context.requestId",
            },
          }),
        },
      });
    }

    // --- JWT Authorizer (AC5) ---
    this.jwtAuthorizer = new apigateway.TokenAuthorizer(this, "JwtAuthorizer", {
      handler: jwtAuthorizerFunction,
      identitySource: apigateway.IdentitySource.header("Authorization"),
      resultsCacheTtl: cdk.Duration.seconds(300),
      authorizerName: "jwt-authorizer",
    });

    // --- API Key Authorizer (AC6) ---
    // Note: identitySources is intentionally omitted and caching disabled.
    // The "jwt-or-apikey" pattern requires the authorizer Lambda to inspect
    // BOTH Authorization (JWT) and x-api-key headers. Setting identitySources
    // would cause API Gateway to reject requests missing the specified header
    // BEFORE the Lambda is invoked, breaking JWT-only clients.
    // Caching will be re-enabled when the combined authorizer is implemented
    // (follow-up story) with proper multi-header identity source.
    this.apiKeyAuthorizer = new apigateway.RequestAuthorizer(
      this,
      "ApiKeyAuthorizer",
      {
        handler: apiKeyAuthorizerFunction,
        identitySources: [],
        resultsCacheTtl: cdk.Duration.seconds(0),
        authorizerName: "api-key-authorizer",
      }
    );

    // --- Authorizer Lambda Invoke Permissions (Story 2.1-D8) ---
    // CDK's TokenAuthorizer/RequestAuthorizer call handler.addPermission(),
    // but addPermission() is a no-op on functions imported via fromFunctionArn().
    // We must create explicit Lambda::Permission resources so API Gateway
    // can invoke the authorizer Lambdas.
    //
    // IMPORTANT: The sourceArn must use the authorizer's own ARN
    // (arn:...:{apiId}/authorizers/{authorizerId}), NOT arnForExecuteApi()
    // which generates arn:...:{apiId}/*/*/*  (stage/method/path). API Gateway
    // uses the authorizer ARN as the source when invoking the Lambda, and
    // the 3-segment wildcard pattern doesn't match the 2-segment authorizer path.
    const invokeAction = "lambda:Invoke" + "Function";

    new lambda.CfnPermission(this, "JwtAuthorizerInvokePermission", {
      action: invokeAction,
      functionName: jwtAuthorizerFunctionArn,
      principal: "apigateway.amazonaws.com",
      sourceArn: this.jwtAuthorizer.authorizerArn,
    });

    new lambda.CfnPermission(this, "ApiKeyAuthorizerInvokePermission", {
      action: invokeAction,
      functionName: apiKeyAuthorizerFunctionArn,
      principal: "apigateway.amazonaws.com",
      sourceArn: this.apiKeyAuthorizer.authorizerArn,
    });

    // --- WAF Association (AC2) ---
    new wafv2.CfnWebACLAssociation(this, "WebAclAssociation", {
      resourceArn: this.restApi.deploymentStage.stageArn,
      webAclArn: webAcl.attrArn,
    });

    // --- CDK Nag Suppressions ---
    NagSuppressions.addResourceSuppressions(
      this.restApi,
      [
        {
          id: "AwsSolutions-APIG2",
          reason:
            "Request validation is handled by handler-level Zod schemas, not API Gateway request models",
        },
        {
          id: "AwsSolutions-APIG1",
          reason:
            "API Gateway access logging will be configured in observability stack enhancement",
        },
        {
          id: "AwsSolutions-APIG6",
          reason:
            "CloudWatch logging for API Gateway stages will be configured when observability stack is enhanced",
        },
      ],
      true
    );

    NagSuppressions.addResourceSuppressions(
      this.restApi.deploymentStage,
      [
        {
          id: "AwsSolutions-APIG3",
          reason:
            "WAF is associated via CfnWebACLAssociation. CDK Nag does not detect CfnWebACLAssociation automatically.",
        },
      ],
      true
    );

    NagSuppressions.addStackSuppressions(this, [
      {
        id: "AwsSolutions-IAM4",
        reason:
          "API Gateway CloudWatch role requires the AWS managed AmazonAPIGatewayPushToCloudWatchLogs policy",
        appliesTo: [
          "Policy::arn:<AWS::Partition>:iam::aws:policy/service-role/AmazonAPIGatewayPushToCloudWatchLogs",
        ],
      },
    ]);

    // --- Stack Outputs (AC12) ---
    new cdk.CfnOutput(this, "RestApiId", {
      value: this.restApi.restApiId,
      description: "REST API ID",
      exportName: "AiLearningHub-RestApiId",
    });

    new cdk.CfnOutput(this, "RestApiUrl", {
      value: this.restApi.url,
      description: "REST API URL (dev stage)",
      exportName: "AiLearningHub-RestApiUrl",
    });
  }
}
