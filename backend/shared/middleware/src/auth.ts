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
    // API Gateway authorizer context only supports string values, so arrays
    // (roles, scopes) may arrive as JSON-serialized strings. Parse them back.
    // Both authorizers set "role" (singular string) in context; tests may pass
    // "roles" (plural, as array or JSON string). Handle all variants.
    const rawRoles = authorizerContext.roles ?? authorizerContext.role;
    let roles: string[];
    if (Array.isArray(rawRoles)) {
      roles = rawRoles;
    } else if (typeof rawRoles === "string") {
      try {
        const parsed = JSON.parse(rawRoles);
        roles = Array.isArray(parsed) ? parsed : [rawRoles];
      } catch {
        roles = [rawRoles];
      }
    } else {
      roles = ["user"];
    }

    const rawScopes = authorizerContext.scopes;
    let scopes: string[] | undefined;
    if (Array.isArray(rawScopes)) {
      scopes = rawScopes;
    } else if (typeof rawScopes === "string") {
      try {
        const parsed = JSON.parse(rawScopes);
        scopes = Array.isArray(parsed) ? parsed : undefined;
      } catch {
        scopes = undefined;
      }
    }

    return {
      userId: authorizerContext.userId as string,
      roles,
      isApiKey:
        authorizerContext.isApiKey === true ||
        authorizerContext.isApiKey === "true",
      apiKeyId: authorizerContext.apiKeyId as string | undefined,
      scopes,
    };
  }

  // For development/testing: only when explicitly allowed.
  // Production must NOT set ALLOW_DEV_AUTH_HEADER (Lambda does not set NODE_ENV by default).
  const allowDevAuth =
    process.env.ALLOW_DEV_AUTH_HEADER === "true" ||
    process.env.ALLOW_DEV_AUTH_HEADER === "1";
  const devUserId = allowDevAuth ? event.headers["x-dev-user-id"] : undefined;
  if (devUserId) {
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
