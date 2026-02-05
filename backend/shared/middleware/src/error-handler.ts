/**
 * Error handling middleware per ADR-008
 */
import type { APIGatewayProxyResult } from "aws-lambda";
import {
  AppError,
  ErrorCode,
  type ApiErrorResponse,
  type ApiResponseMeta,
} from "@ai-learning-hub/types";
import { createLogger, type Logger } from "@ai-learning-hub/logging";

/**
 * Create a standardized error response per ADR-008
 */
export function createErrorResponse(
  error: AppError,
  requestId: string
): APIGatewayProxyResult {
  const body: ApiErrorResponse = error.toApiError(requestId);

  return {
    statusCode: error.statusCode,
    headers: {
      "Content-Type": "application/json",
      "X-Request-Id": requestId,
    },
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
 * Create a success response (optionally with meta for pagination etc.)
 */
export function createSuccessResponse<T>(
  data: T,
  requestId: string,
  statusCode = 200,
  meta?: ApiResponseMeta
): APIGatewayProxyResult {
  const body: { data: T; meta?: ApiResponseMeta } = { data };
  if (meta !== undefined) body.meta = meta;
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
