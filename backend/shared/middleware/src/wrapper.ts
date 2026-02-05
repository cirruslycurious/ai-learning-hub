/**
 * Lambda handler wrapper with middleware chain
 */
import type {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  Context,
} from "aws-lambda";
import { type AuthContext } from "@ai-learning-hub/types";
import { createLogger, type Logger } from "@ai-learning-hub/logging";
import { handleError, createSuccessResponse } from "./error-handler.js";
import { extractAuthContext, requireAuth } from "./auth.js";
import { randomUUID } from "crypto";

/**
 * Extended event with parsed request context
 */
export interface WrappedEvent extends APIGatewayProxyEvent {
  requestContext: APIGatewayProxyEvent["requestContext"] & {
    parsedAuth?: AuthContext;
  };
}

/**
 * Handler context passed to wrapped handlers
 */
export interface HandlerContext {
  event: WrappedEvent;
  context: Context;
  auth: AuthContext | null;
  requestId: string;
  logger: Logger;
  startTime: number;
}

/**
 * Wrapped handler function type
 */
export type WrappedHandler<T = unknown> = (
  ctx: HandlerContext
) => Promise<T | APIGatewayProxyResult>;

/**
 * Handler wrapper options
 */
export interface WrapperOptions {
  requireAuth?: boolean;
  requiredRoles?: string[];
  requiredScope?: string;
}

/**
 * Generate or extract request ID
 */
function getRequestId(event: APIGatewayProxyEvent): string {
  return (
    event.headers?.["x-request-id"] ??
    event.requestContext?.requestId ??
    randomUUID()
  );
}

/**
 * Get X-Ray trace ID from environment
 */
function getTraceId(): string | undefined {
  const traceHeader = process.env._X_AMZN_TRACE_ID;
  if (!traceHeader) return undefined;
  const match = /Root=([^;]+)/.exec(traceHeader);
  return match?.[1];
}

/**
 * Check if result is already an API Gateway response
 */
function isApiGatewayResult(result: unknown): result is APIGatewayProxyResult {
  return (
    typeof result === "object" &&
    result !== null &&
    "statusCode" in result &&
    typeof (result as APIGatewayProxyResult).statusCode === "number"
  );
}

/**
 * Wrap a Lambda handler with middleware
 */
export function wrapHandler<T = unknown>(
  handler: WrappedHandler<T>,
  options: WrapperOptions = {}
): (
  event: APIGatewayProxyEvent,
  context: Context
) => Promise<APIGatewayProxyResult> {
  return async (
    event: APIGatewayProxyEvent,
    context: Context
  ): Promise<APIGatewayProxyResult> => {
    const startTime = Date.now();
    const requestId = getRequestId(event);
    const traceId = getTraceId();

    // Create logger with request context
    const logger = createLogger({
      requestId,
      traceId,
    });

    try {
      // Extract auth context
      let auth: AuthContext | null = null;

      if (options.requireAuth) {
        auth = requireAuth(event);
        logger.setRequestContext({ userId: auth.userId });

        // Check required roles
        if (options.requiredRoles && options.requiredRoles.length > 0) {
          const hasRequiredRole = options.requiredRoles.some((role) =>
            auth!.roles.includes(role)
          );
          if (!hasRequiredRole) {
            const { AppError, ErrorCode } =
              await import("@ai-learning-hub/types");
            throw new AppError(ErrorCode.FORBIDDEN, "Insufficient permissions");
          }
        }

        // Check required scope for API keys
        if (options.requiredScope && auth.isApiKey) {
          const scopes = auth.scopes ?? [];
          if (
            !scopes.includes("*") &&
            !scopes.includes(options.requiredScope)
          ) {
            const { AppError, ErrorCode } =
              await import("@ai-learning-hub/types");
            throw new AppError(
              ErrorCode.FORBIDDEN,
              "API key lacks required scope"
            );
          }
        }
      } else {
        auth = extractAuthContext(event);
        if (auth) {
          logger.setRequestContext({ userId: auth.userId });
        }
      }

      // Create handler context
      const ctx: HandlerContext = {
        event: event as WrappedEvent,
        context,
        auth,
        requestId,
        logger,
        startTime,
      };

      // Execute handler
      const result = await handler(ctx);

      // Log completion
      logger.timed("Request completed", startTime, {
        statusCode: isApiGatewayResult(result) ? result.statusCode : 200,
      });

      // Return result (auto-wrap if needed)
      if (isApiGatewayResult(result)) {
        return result;
      }

      return createSuccessResponse(result, requestId);
    } catch (error) {
      return handleError(error, requestId, logger);
    }
  };
}
