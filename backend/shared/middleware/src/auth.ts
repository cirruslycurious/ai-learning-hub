/**
 * Authentication middleware stubs
 * Full implementation will come in Epic 2 (Authentication)
 */
import type { APIGatewayProxyEvent } from "aws-lambda";
import {
  AppError,
  ErrorCode,
  type AuthContext,
  type ApiKeyScope,
} from "@ai-learning-hub/types";
import type { OperationScope } from "@ai-learning-hub/types";
import { checkScopeAccess, VALID_SCOPES } from "./scope-resolver.js";

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
    let scopes: ApiKeyScope[] | undefined;
    if (Array.isArray(rawScopes)) {
      // Runtime-validate: drop unrecognized scopes to prevent privilege escalation
      scopes = rawScopes.filter((s) => VALID_SCOPES.has(s)) as ApiKeyScope[];
    } else if (typeof rawScopes === "string") {
      try {
        const parsed = JSON.parse(rawScopes);
        scopes = Array.isArray(parsed)
          ? (parsed.filter((s: string) => VALID_SCOPES.has(s)) as ApiKeyScope[])
          : undefined;
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
 * Require specific API key scope (Story 3.2.6, AC3/AC5/AC6).
 * Uses hierarchical scope resolution via checkScopeAccess.
 */
export function requireScope(
  auth: AuthContext,
  requiredScope: OperationScope
): void {
  if (!auth.isApiKey) {
    // JWT auth has all scopes by default
    return;
  }

  const scopes = auth.scopes ?? [];
  if (!checkScopeAccess(scopes, requiredScope)) {
    throw new AppError(
      ErrorCode.SCOPE_INSUFFICIENT,
      `API key lacks required scope: ${requiredScope}`,
      {
        required_scope: requiredScope,
        granted_scopes: scopes,
        // AC22: use entity:verb format matching action catalog IDs.
        // keys:request-with-scope will be registered in Story 3.2.8 (auth domain).
        allowedActions: ["keys:request-with-scope"],
      }
    );
  }
}
