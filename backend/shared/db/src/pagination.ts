/**
 * Cursor-based pagination utilities (Story 3.2.5)
 *
 * Opaque cursor encoding/decoding using base64url.
 * Cursors wrap DynamoDB ExclusiveStartKey objects (or in-memory pagination keys).
 * Consumers must NOT parse or construct cursors — they are opaque tokens.
 */
import {
  AppError,
  ErrorCode,
  type EnvelopeMeta,
  type ResponseLinks,
} from "@ai-learning-hub/types";

/** Default number of items per page */
export const DEFAULT_PAGE_SIZE = 25;

/** Maximum allowed items per page */
export const MAX_PAGE_SIZE = 100;

/**
 * Encode a DynamoDB ExclusiveStartKey (or any key object) into an opaque cursor string.
 * Uses base64url encoding (RFC 4648 Section 5) — URL-safe, no padding characters.
 */
export function encodeCursor(
  lastEvaluatedKey: Record<string, unknown>
): string {
  return Buffer.from(JSON.stringify(lastEvaluatedKey)).toString("base64url");
}

/** Throw a standardized cursor validation error */
function throwInvalidCursor(): never {
  throw new AppError(ErrorCode.VALIDATION_ERROR, "Invalid cursor token", {
    fields: [
      {
        field: "cursor",
        message: "Invalid cursor token",
        code: "invalid_string",
      },
    ],
  });
}

/**
 * Decode an opaque cursor string back into a key object.
 * Throws VALIDATION_ERROR if the cursor is malformed.
 */
export function decodeCursor(cursor: string): Record<string, unknown> {
  if (!cursor) {
    throwInvalidCursor();
  }

  let decoded: string;
  try {
    decoded = Buffer.from(cursor, "base64url").toString("utf-8");
  } catch {
    throwInvalidCursor();
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(decoded);
  } catch {
    throwInvalidCursor();
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throwInvalidCursor();
  }

  // Validate all values are primitives — reject nested objects and arrays
  for (const value of Object.values(parsed)) {
    if (value !== null && typeof value === "object") {
      throwInvalidCursor();
    }
  }

  return parsed as Record<string, unknown>;
}

/**
 * Validate and decode a cursor with optional field checks.
 * Returns the decoded ExclusiveStartKey or throws VALIDATION_ERROR.
 *
 * When expectedFields is provided, verifies the decoded object contains all
 * expected keys — prevents cross-endpoint cursor replay.
 */
export function validateCursor(
  cursor: string,
  expectedFields?: string[]
): Record<string, unknown> {
  const decoded = decodeCursor(cursor);

  if (expectedFields) {
    for (const field of expectedFields) {
      if (!(field in decoded)) {
        throw new AppError(
          ErrorCode.VALIDATION_ERROR,
          "Cursor is not valid for this endpoint",
          {
            fields: [
              {
                field: "cursor",
                message: "Cursor is not valid for this endpoint",
                code: "invalid_string",
              },
            ],
          }
        );
      }
    }
  }

  return decoded;
}

/**
 * Options for buildPaginatedResponse
 */
export interface BuildPaginatedResponseOptions {
  total?: number;
  requestPath?: string;
  queryParams?: Record<string, string>;
}

/**
 * Build a paginated response conforming to the 3.2.2 envelope format.
 *
 * CRITICAL: queryParams MUST be from Zod-validated/parsed params, NOT from
 * raw event.queryStringParameters. This ensures links contain only sanitized values.
 */
export function buildPaginatedResponse<T>(
  items: T[],
  nextCursor: string | null,
  options?: BuildPaginatedResponseOptions
): { data: T[]; meta: EnvelopeMeta; links?: ResponseLinks } {
  const meta: EnvelopeMeta = {
    cursor: nextCursor,
  };

  if (options?.total !== undefined) {
    meta.total = options.total;
  }

  const result: { data: T[]; meta: EnvelopeMeta; links?: ResponseLinks } = {
    data: items,
    meta,
  };

  if (options?.requestPath) {
    const selfParams = new URLSearchParams(options.queryParams ?? {});
    selfParams.delete("cursor");
    const selfQuery = selfParams.toString();
    const self = selfQuery
      ? `${options.requestPath}?${selfQuery}`
      : options.requestPath;

    let next: string | null = null;
    if (nextCursor) {
      const nextParams = new URLSearchParams(options.queryParams ?? {});
      nextParams.set("cursor", nextCursor);
      next = `${options.requestPath}?${nextParams.toString()}`;
    }

    result.links = { self, next };
  }

  return result;
}
