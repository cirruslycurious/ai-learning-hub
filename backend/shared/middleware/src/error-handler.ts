/**
 * Error handling middleware per ADR-008
 */
import type { APIGatewayProxyResult } from "aws-lambda";
import {
  AppError,
  ErrorCode,
  type EnvelopeMeta,
  type ResponseLinks,
} from "@ai-learning-hub/types";
import { createLogger, type Logger } from "@ai-learning-hub/logging";

/**
 * Create a standardized error response per ADR-008
 */
export function createErrorResponse(
  error: AppError,
  requestId: string
): APIGatewayProxyResult {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Request-Id": requestId,
  };

  // Extract transport-only headers from details (strip before body serialization)
  // Only plain objects with string values are accepted. Security-critical headers
  // (Content-Type, X-Request-Id) cannot be overridden to prevent header injection.
  const { responseHeaders, ...bodyDetails } = error.details ?? {};
  if (
    responseHeaders &&
    typeof responseHeaders === "object" &&
    !Array.isArray(responseHeaders)
  ) {
    const PROTECTED_HEADERS = new Set(["content-type", "x-request-id"]);
    for (const [key, value] of Object.entries(
      responseHeaders as Record<string, unknown>
    )) {
      if (
        typeof value === "string" &&
        !PROTECTED_HEADERS.has(key.toLowerCase())
      ) {
        headers[key] = value;
      }
    }
  }

  // Set Retry-After header for 429 rate-limited responses (AC5, RFC 6585)
  if (error.code === ErrorCode.RATE_LIMITED && bodyDetails.retryAfter != null) {
    headers["Retry-After"] = String(bodyDetails.retryAfter);
  }

  // Build body without responseHeaders (transport metadata stays out of response body)
  const body = error.toApiError(requestId);
  if (body.error.details) {
    const { responseHeaders: _, ...clean } = body.error.details;
    body.error.details = Object.keys(clean).length > 0 ? clean : undefined;
  }

  return {
    statusCode: error.statusCode,
    headers,
    body: JSON.stringify(body),
  };
}

/**
 * Convert unknown errors to AppError
 */
export function normalizeError(error: unknown): AppError {
  if (AppError.isAppError(error)) {
    return error;
  }

  if (error instanceof Error) {
    return new AppError(
      ErrorCode.INTERNAL_ERROR,
      "An unexpected error occurred",
      { originalError: error.message }
    );
  }

  return new AppError(ErrorCode.INTERNAL_ERROR, "An unexpected error occurred");
}

/**
 * Handle error and return API Gateway response
 */
export function handleError(
  error: unknown,
  requestId: string,
  logger?: Logger
): APIGatewayProxyResult {
  const log = logger ?? createLogger({ requestId });
  const appError = normalizeError(error);

  // Log the error
  log.error(appError.message, error instanceof Error ? error : undefined, {
    code: appError.code,
    statusCode: appError.statusCode,
    details: appError.details,
  });

  return createErrorResponse(appError, requestId);
}

/**
 * Options for createSuccessResponse (AC10)
 */
export interface SuccessResponseOptions {
  statusCode?: number;
  meta?: EnvelopeMeta;
  links?: ResponseLinks;
}

/**
 * Create a success response with envelope (AC10)
 * Uses options object pattern for extensibility.
 */
export function createSuccessResponse<T>(
  data: T,
  requestId: string,
  options?: SuccessResponseOptions
): APIGatewayProxyResult {
  const { statusCode = 200, meta, links } = options ?? {};
  const body: { data: T; meta?: EnvelopeMeta; links?: ResponseLinks } = {
    data,
  };
  if (meta !== undefined) body.meta = meta;
  if (links !== undefined) body.links = links;
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "X-Request-Id": requestId,
    },
    body: JSON.stringify(body),
  };
}

/**
 * Create a no-content response (204). Omits body per HTTP spec for 204 No Content.
 */
export function createNoContentResponse(
  requestId: string
): APIGatewayProxyResult {
  return {
    statusCode: 204,
    headers: {
      "X-Request-Id": requestId,
    },
    body: "", // APIGatewayProxyResult type requires body; empty string for 204
  };
}
