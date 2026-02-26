/**
 * Optimistic concurrency middleware (Story 3.2.1)
 *
 * Extracts If-Match header and parses as numeric version.
 * The parsed version is attached to HandlerContext as expectedVersion.
 */
import type { APIGatewayProxyEvent } from "aws-lambda";
import { AppError, ErrorCode } from "@ai-learning-hub/types";

/**
 * Extract and validate the If-Match header as a numeric version.
 * Throws PRECONDITION_REQUIRED if missing, VALIDATION_ERROR if invalid.
 */
export function extractIfMatch(event: APIGatewayProxyEvent): number {
  const headers = event.headers ?? {};
  const value =
    headers["if-match"] ?? headers["If-Match"] ?? headers["IF-MATCH"];

  if (value === undefined || value === null) {
    throw new AppError(
      ErrorCode.PRECONDITION_REQUIRED,
      "If-Match header is required for this operation"
    );
  }

  const version = Number(value);

  if (!Number.isInteger(version) || version < 1) {
    throw new AppError(
      ErrorCode.VALIDATION_ERROR,
      "If-Match header must be a positive integer version number"
    );
  }

  return version;
}
