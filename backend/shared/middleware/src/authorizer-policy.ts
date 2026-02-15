/**
 * Shared IAM policy helpers for API Gateway Lambda authorizers.
 *
 * Used by both the JWT authorizer (Story 2.1) and the API Key authorizer
 * (Story 2.2) to generate consistent Allow/Deny policy documents.
 *
 * Resource "*" is intentional: authorizer responses are cached by API Gateway
 * across endpoints, so the policy must apply to all methods (Minor #1).
 */
import type { APIGatewayAuthorizerResult } from "aws-lambda";

export interface PolicyDocument {
  Version: string;
  Statement: Array<{
    Action: string;
    Effect: "Allow" | "Deny";
    Resource: string;
  }>;
}

/**
 * Generate an IAM policy document for API Gateway authorizer responses.
 *
 * Resource is set to "*" because API Gateway caches authorizer results
 * and reuses the same policy across all endpoints for the same principal.
 */
export function generatePolicy(effect: "Allow" | "Deny"): PolicyDocument {
  return {
    Version: "2012-10-17",
    Statement: [
      {
        Action: "execute-api:Invoke",
        Effect: effect,
        // Resource "*" is intentional for authorizer response caching across endpoints
        Resource: "*",
      },
    ],
  };
}

/**
 * Create a Deny authorizer result with an error code in the context.
 * API Gateway maps Deny results to 403 responses.
 */
export function deny(
  principalId: string,
  errorCode: string
): APIGatewayAuthorizerResult {
  return {
    principalId,
    policyDocument: generatePolicy("Deny"),
    context: { errorCode },
  };
}
