/**
 * Batch Operations Endpoint — POST /batch
 *
 * Accepts an array of operations and executes each via HTTP loopback
 * through API Gateway. Reuses the full middleware chain (auth, idempotency,
 * rate limiting, scopes) for each sub-operation.
 *
 * Story 3.2.9, AC6-AC13.
 */
import {
  wrapHandler,
  createSuccessResponse,
  type HandlerContext,
} from "@ai-learning-hub/middleware";
import { AppError, ErrorCode } from "@ai-learning-hub/types";
import type {
  BatchOperationResult,
  BatchResponse,
} from "@ai-learning-hub/types";
import { batchRequestSchema } from "./schemas.js";

/**
 * Get API_BASE_URL — fails fast on first invocation if not set.
 * Uses lazy init so tests can set env vars before first handler call.
 * In production, this validates on first cold-start request.
 */
let _apiBaseUrl: string | undefined;
function getApiBaseUrl(): string {
  if (!_apiBaseUrl) {
    _apiBaseUrl = process.env.API_BASE_URL;
    if (!_apiBaseUrl) {
      throw new Error(
        "API_BASE_URL environment variable is required for batch operations"
      );
    }
  }
  return _apiBaseUrl;
}

/** Per-operation timeout in milliseconds (AC11) */
const OPERATION_TIMEOUT_MS = 4000;

/**
 * Execute a single batch operation via HTTP loopback.
 */
async function executeOperation(
  index: number,
  operation: {
    method: string;
    path: string;
    body?: Record<string, unknown>;
    headers?: Record<string, string>;
  },
  authorizationHeader: string
): Promise<BatchOperationResult> {
  // Check for per-operation Idempotency-Key (AC7)
  if (!operation.headers?.["Idempotency-Key"]) {
    return {
      operationIndex: index,
      statusCode: 400,
      error: {
        code: "MISSING_IDEMPOTENCY_KEY",
        message:
          "Each batch operation must include an Idempotency-Key in headers",
      },
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), OPERATION_TIMEOUT_MS);

  try {
    const url = `${getApiBaseUrl()}${operation.path}`;
    const fetchHeaders: Record<string, string> = {
      "Content-Type": "application/json",
      ...operation.headers,
      Authorization: authorizationHeader, // must be last to prevent override
    };

    const fetchOptions: RequestInit = {
      method: operation.method,
      headers: fetchHeaders,
      signal: controller.signal,
    };

    if (operation.body && operation.method !== "GET") {
      fetchOptions.body = JSON.stringify(operation.body);
    }

    const response = await fetch(url, fetchOptions);

    // 204 No Content has no body — skip JSON parsing (e.g. DELETE responses)
    let responseBody: Record<string, unknown> = {};
    if (response.status !== 204) {
      try {
        responseBody = await response.json();
      } catch {
        // Non-JSON response body — treat as opaque success/error
      }
    }

    if (response.status >= 400) {
      return {
        operationIndex: index,
        statusCode: response.status,
        error: responseBody.error ?? responseBody,
      };
    }

    return {
      operationIndex: index,
      statusCode: response.status,
      data: responseBody.data ?? responseBody,
    };
  } catch (error: unknown) {
    if (
      error instanceof Error &&
      (error.name === "AbortError" || error.message.includes("aborted"))
    ) {
      return {
        operationIndex: index,
        statusCode: 504,
        error: {
          code: "OPERATION_TIMEOUT",
          message: `Operation timed out after ${OPERATION_TIMEOUT_MS}ms`,
        },
      };
    }

    return {
      operationIndex: index,
      statusCode: 502,
      error: {
        code: "OPERATION_FAILED",
        message:
          error instanceof Error ? error.message : "Unknown operation error",
      },
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function batchHandler(ctx: HandlerContext) {
  const { event, requestId } = ctx;

  // Parse and validate request body
  const body = event.body ? JSON.parse(event.body) : {};
  const parsed = batchRequestSchema.safeParse(body);

  if (!parsed.success) {
    throw new AppError(ErrorCode.VALIDATION_ERROR, "Invalid batch request", {
      fields: parsed.error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
        code: "invalid",
      })),
    });
  }

  const { operations } = parsed.data;

  // Extract Authorization header (API Gateway lowercases headers)
  const authorizationHeader =
    event.headers["authorization"] ?? event.headers["Authorization"] ?? "";

  // Execute all operations concurrently (AC9: non-transactional)
  const results = await Promise.allSettled(
    operations.map((op, index) =>
      executeOperation(index, op, authorizationHeader)
    )
  );

  // Map settled results to response shape
  const operationResults: BatchOperationResult[] = results.map(
    (result, index) => {
      if (result.status === "fulfilled") {
        return result.value;
      }
      return {
        operationIndex: index,
        statusCode: 500,
        error: {
          code: "INTERNAL_ERROR",
          message: "Unexpected error executing operation",
        },
      };
    }
  );

  // Build summary (AC8)
  const succeeded = operationResults.filter(
    (r) => r.statusCode >= 200 && r.statusCode < 400
  ).length;
  const failed = operationResults.length - succeeded;

  const data: BatchResponse = {
    results: operationResults,
    summary: {
      total: operationResults.length,
      succeeded,
      failed,
    },
  };

  return createSuccessResponse(data, requestId, {
    links: { self: "/batch" },
  });
}

export const handler = wrapHandler(batchHandler, {
  requireAuth: true,
  idempotent: true,
  requiredScope: "batch:execute",
  rateLimit: {
    operation: "batch-execute",
    windowSeconds: 3600,
    limit: 60,
  },
});
