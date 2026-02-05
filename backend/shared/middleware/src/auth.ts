/**
 * Authentication middleware stubs
 * Full implementation will come in Epic 2 (Authentication)
 */
import type { APIGatewayProxyEvent } from "aws-lambda";
import { AppError, ErrorCode, type AuthContext } from "@ai-learning-hub/types";

/**
 * Extract auth context from API Gateway event
 * This is a stub that will be fully implemented with Clerk in Epic 2
 */
export function extractAuthContext(
  event: APIGatewayProxyEvent
): AuthContext | null {
  // Check for Lambda authorizer context (set by JWT/API key authorizer)
  const authorizerContext = event.requestContext.authorizer;

  if (authorizerContext && "userId" in authorizerContext) {
    return {
      userId: authorizerContext.userId as string,
      roles: (authorizerContext.roles as string[] | undefined) ?? ["user"],
      isApiKey:
        authorizerContext.isApiKey === true ||
        authorizerContext.isApiKey === "true",
      apiKeyId: authorizerContext.apiKeyId as string | undefined,
      scopes: authorizerContext.scopes as string[] | undefined,
    };
  }

  // For development/testing: check for custom header
  const devUserId = event.headers["x-dev-user-id"];
  if (devUserId && process.env.NODE_ENV !== "production") {
    return {
      userId: devUserId,
      roles: ["user"],
      isApiKey: false,
    };
  }

  return null;
}

/**
 * Require authentication - throws if not authenticated
 */
export function requireAuth(event: APIGatewayProxyEvent): AuthContext {
  const auth = extractAuthContext(event);

  if (!auth) {
    throw new AppError(ErrorCode.UNAUTHORIZED, "Authentication required");
  }

  return auth;
}

/**
 * Require specific role(s)
 */
export function requireRole(auth: AuthContext, requiredRoles: string[]): void {
  const hasRequiredRole = requiredRoles.some((role) =>
    auth.roles.includes(role)
  );

  if (!hasRequiredRole) {
    throw new AppError(ErrorCode.FORBIDDEN, "Insufficient permissions", {
      requiredRoles,
      userRoles: auth.roles,
    });
  }
}

/**
 * Require specific API key scope
 */
export function requireScope(auth: AuthContext, requiredScope: string): void {
  if (!auth.isApiKey) {
    // JWT auth has all scopes by default
    return;
  }

  const scopes = auth.scopes ?? [];
  const hasWildcard = scopes.includes("*");
  const hasScope = scopes.includes(requiredScope);

  if (!hasWildcard && !hasScope) {
    throw new AppError(ErrorCode.FORBIDDEN, "API key lacks required scope", {
      requiredScope,
      keyScopes: scopes,
    });
  }
}
