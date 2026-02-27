/**
 * Lambda handler wrapper with middleware chain
 */
import type {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  Context,
} from "aws-lambda";
import {
  AppError,
  ErrorCode,
  type AuthContext,
  type ActorType,
} from "@ai-learning-hub/types";
import { createLogger, type Logger } from "@ai-learning-hub/logging";
import {
  incrementAndCheckRateLimit,
  getDefaultClient,
  requireEnv,
  type RateLimitConfig,
  type RateLimitResult,
} from "@ai-learning-hub/db";
import { handleError, createSuccessResponse } from "./error-handler.js";
import { extractAuthContext, requireAuth } from "./auth.js";
import {
  extractIdempotencyKey,
  checkIdempotency,
  storeIdempotencyResult,
  type IdempotencyStatus,
} from "./idempotency.js";
import { extractIfMatch } from "./concurrency.js";
import { extractAgentIdentity } from "./agent-identity.js";
import {
  addRateLimitHeaders,
  type RateLimitMiddlewareConfig,
} from "./rate-limit-headers.js";
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
  expectedVersion?: number;
  /** Agent ID from X-Agent-ID header, null for human callers (Story 3.2.4) */
  agentId: string | null;
  /** Whether caller is human or agent (Story 3.2.4) */
  actorType: ActorType;
  /** Rate limit result when rateLimit middleware is active (Story 3.2.4) */
  rateLimitResult?: RateLimitResult;
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
  idempotent?: boolean;
  requireVersion?: boolean;
  /** Rate limit configuration — opt-in per handler (Story 3.2.4) */
  rateLimit?: RateLimitMiddlewareConfig;
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
 * Add X-Agent-ID echo header to a response (Story 3.2.4).
 * Returns new response object without mutating the original.
 */
function echoAgentId(
  response: APIGatewayProxyResult,
  agentId: string | null
): APIGatewayProxyResult {
  if (!agentId) return response;
  return {
    ...response,
    headers: {
      ...(response.headers ?? {}),
      "X-Agent-ID": agentId,
    },
  };
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

    // Log incoming request for observability (D7-AC7)
    logger.info("Request received", {
      method: event.httpMethod,
      path: event.path,
      queryParams: Object.keys(event.queryStringParameters ?? {}),
    });

    // Track idempotency system availability across try/catch (AC9)
    const idempotencyStatus: IdempotencyStatus = { available: true };

    // Hoist agent identity and rate limit result for catch-block access (Story 3.2.4)

    let agentIdentity: { agentId: string | null; actorType: ActorType } = {
      agentId: null,
      actorType: "human",
    };
    let rateLimitResult: RateLimitResult | undefined;

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
            throw new AppError(
              ErrorCode.SCOPE_INSUFFICIENT,
              "API key lacks required scope",
              {
                requiredScope: options.requiredScope,
                keyScopes: scopes,
              }
            );
          }
        }
      } else {
        auth = extractAuthContext(event);
        if (auth) {
          logger.setRequestContext({ userId: auth.userId });
        }
      }

      // Extract agent identity (Story 3.2.4: always-on, zero-cost)
      agentIdentity = extractAgentIdentity(event);

      // Rate limit middleware (Story 3.2.4: opt-in via options.rateLimit)
      if (options.rateLimit) {
        // Resolve dynamic limit (fail-open if function throws)
        let limit: number;
        let skipRateLimit = false;
        try {
          limit =
            typeof options.rateLimit.limit === "function"
              ? options.rateLimit.limit(auth)
              : options.rateLimit.limit;
        } catch (err) {
          logger.warn(
            "Rate limit function threw (fail-open, skipping rate limit)",
            { error: err }
          );
          skipRateLimit = true;
          limit = 0; // unused — skip path below
        }

        if (!skipRateLimit) {
          // Resolve identifier
          const identifier =
            options.rateLimit.identifierSource === "sourceIp"
              ? (event.requestContext?.identity?.sourceIp ?? "unknown-ip")
              : (auth?.userId ?? "anonymous");

          const rateLimitConfig: RateLimitConfig = {
            operation: options.rateLimit.operation,
            identifier,
            limit,
            windowSeconds: options.rateLimit.windowSeconds,
          };

          try {
            const rlClient = getDefaultClient();
            const tableName = requireEnv(
              "USERS_TABLE_NAME",
              "ai-learning-hub-users"
            );
            const result = await incrementAndCheckRateLimit(
              rlClient,
              tableName,
              rateLimitConfig,
              logger
            );

            if (!result.allowed) {
              const error = new AppError(
                ErrorCode.RATE_LIMITED,
                "Rate limit exceeded",
                {
                  limit: result.limit,
                  current: result.current,
                }
              );
              let errorResponse = handleError(error, requestId, logger);
              errorResponse = addRateLimitHeaders(
                errorResponse,
                result,
                options.rateLimit.windowSeconds
              );
              return echoAgentId(errorResponse, agentIdentity.agentId);
            }

            rateLimitResult = result;
          } catch (err) {
            // Fail-open: rate limiting is best-effort
            logger.warn("Rate limit check failed (fail-open)", { error: err });
          }
        }
      }

      // Idempotency check (AC7: before handler execution)
      let idempotencyKey: string | undefined;
      if (options.idempotent) {
        idempotencyKey = extractIdempotencyKey(event);
        if (auth?.userId) {
          const cachedResponse = await checkIdempotency(
            event,
            auth.userId,
            idempotencyKey,
            logger,
            undefined,
            idempotencyStatus
          );
          if (cachedResponse) {
            logger.timed("Request completed (idempotent replay)", startTime);
            return cachedResponse;
          }
        }
      }

      // Extract If-Match version (AC11: before handler execution)
      let expectedVersion: number | undefined;
      if (options.requireVersion) {
        expectedVersion = extractIfMatch(event);
      }

      // Create handler context
      const ctx: HandlerContext = {
        event: event as WrappedEvent,
        context,
        auth,
        requestId,
        logger,
        startTime,
        agentId: agentIdentity.agentId,
        actorType: agentIdentity.actorType,
        ...(expectedVersion !== undefined && { expectedVersion }),
        ...(rateLimitResult !== undefined && { rateLimitResult }),
      };

      // Execute handler
      const result = await handler(ctx);

      // Log completion
      logger.timed("Request completed", startTime, {
        statusCode: isApiGatewayResult(result) ? result.statusCode : 200,
      });

      // Build the final response
      let finalResult: APIGatewayProxyResult;
      if (isApiGatewayResult(result)) {
        // ADR-008 pass-through normalization (D9, AC9):
        // For 4xx/5xx responses, ensure the body conforms to ADR-008 format.
        if (result.statusCode >= 400) {
          try {
            const parsed = JSON.parse(result.body);
            if (!parsed?.error?.code || !parsed?.error?.message) {
              logger.warn("Non-ADR-008 error response detected, normalizing", {
                statusCode: result.statusCode,
              });
              finalResult = {
                ...result,
                body: JSON.stringify({
                  error: {
                    code: "INTERNAL_ERROR",
                    message: parsed?.message || "Unknown error",
                    requestId,
                  },
                }),
              };
            } else {
              finalResult = result;
            }
          } catch {
            logger.warn("Non-JSON error response detected, normalizing");
            finalResult = {
              ...result,
              body: JSON.stringify({
                error: {
                  code: "INTERNAL_ERROR",
                  message: "Unknown error",
                  requestId,
                },
              }),
            };
          }
        } else {
          finalResult = result;
        }
      } else {
        finalResult = createSuccessResponse(result, requestId);
      }

      // Idempotency store (AC3: after handler execution, cache 2xx only)
      if (options.idempotent && idempotencyKey && auth?.userId) {
        finalResult = await storeIdempotencyResult(
          event,
          auth.userId,
          idempotencyKey,
          finalResult,
          logger,
          undefined,
          idempotencyStatus
        );
      }

      // AC9: Add unavailable header when idempotency system had issues (fail-open)
      if (options.idempotent && !idempotencyStatus.available) {
        finalResult = {
          ...finalResult,
          headers: {
            ...(finalResult.headers ?? {}),
            "X-Idempotency-Status": "unavailable",
          },
        };
      }

      // Story 3.2.4: Add rate limit headers to response (success or error)
      if (rateLimitResult && options.rateLimit) {
        finalResult = addRateLimitHeaders(
          finalResult,
          rateLimitResult,
          options.rateLimit.windowSeconds
        );
      }

      // Story 3.2.4: Echo X-Agent-ID in response when present
      return echoAgentId(finalResult, agentIdentity.agentId);
    } catch (error) {
      const errorResponse = handleError(error, requestId, logger);

      // AC9: Add unavailable header only when the idempotency system itself
      // had issues (fail-open), not for all errors from idempotent handlers.
      if (options.idempotent && !idempotencyStatus.available) {
        (errorResponse.headers as Record<string, string>)[
          "X-Idempotency-Status"
        ] = "unavailable";
      }

      // Story 3.2.4: Add rate limit headers to error response
      if (rateLimitResult && options.rateLimit) {
        const decorated = addRateLimitHeaders(
          errorResponse,
          rateLimitResult,
          options.rateLimit.windowSeconds
        );
        errorResponse.headers = decorated.headers;
      }

      // Story 3.2.4: Echo X-Agent-ID in error response when present
      return echoAgentId(errorResponse, agentIdentity.agentId);
    }
  };
}
