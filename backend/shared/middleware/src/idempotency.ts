/**
 * Idempotency middleware (Story 3.2.1)
 *
 * Extracts Idempotency-Key header, checks DynamoDB for cached responses,
 * stores results after handler execution. Opt-in via WrapperOptions.idempotent.
 */
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { AppError, ErrorCode } from "@ai-learning-hub/types";
import type { IdempotencyRecord } from "@ai-learning-hub/types";
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import {
  getIdempotencyRecord,
  storeIdempotencyRecord,
  buildIdempotencyPK,
  getDefaultClient,
} from "@ai-learning-hub/db";
import type { Logger } from "@ai-learning-hub/logging";

export const IDEMPOTENCY_KEY_PATTERN = /^[a-zA-Z0-9_\-.]+$/;
export const IDEMPOTENCY_KEY_MAX_LENGTH = 256;
export const RESPONSE_SIZE_LIMIT = 350 * 1024; // 350KB safety margin for DynamoDB 400KB limit
const TTL_SECONDS = 24 * 60 * 60; // 24 hours

/**
 * Mutable status object passed through idempotency functions so they can
 * signal when the idempotency system is unavailable (fail-open).
 * The wrapper creates this object and checks it after both check and store calls.
 */
export interface IdempotencyStatus {
  available: boolean;
}

/**
 * Extract and validate the Idempotency-Key header.
 * Throws VALIDATION_ERROR if missing or invalid format.
 */
export function extractIdempotencyKey(event: APIGatewayProxyEvent): string {
  // Headers in API Gateway are case-insensitive; normalize to lowercase lookup
  const headers = event.headers ?? {};
  const key =
    headers["idempotency-key"] ??
    headers["Idempotency-Key"] ??
    headers["IDEMPOTENCY-KEY"];

  if (!key) {
    throw new AppError(
      ErrorCode.VALIDATION_ERROR,
      "Idempotency-Key header is required"
    );
  }

  if (key.length === 0 || key.length > IDEMPOTENCY_KEY_MAX_LENGTH) {
    throw new AppError(
      ErrorCode.VALIDATION_ERROR,
      `Idempotency-Key must be 1-${IDEMPOTENCY_KEY_MAX_LENGTH} characters`
    );
  }

  if (!IDEMPOTENCY_KEY_PATTERN.test(key)) {
    throw new AppError(
      ErrorCode.VALIDATION_ERROR,
      "Idempotency-Key must match pattern [a-zA-Z0-9_\\-.]+"
    );
  }

  return key;
}

/**
 * Build the operation path string from the event (e.g., "POST /saves")
 */
function getOperationPath(event: APIGatewayProxyEvent): string {
  return `${event.httpMethod} ${event.path}`;
}

/**
 * Run the idempotency check before handler execution.
 * Returns a cached response if a replay is available, or null if the handler should execute.
 */
export async function checkIdempotency(
  event: APIGatewayProxyEvent,
  userId: string,
  idempotencyKey: string,
  logger: Logger,
  client?: DynamoDBDocumentClient,
  status?: IdempotencyStatus
): Promise<APIGatewayProxyResult | null> {
  const dbClient = client ?? getDefaultClient();
  const operationPath = getOperationPath(event);

  try {
    const record = await getIdempotencyRecord(
      dbClient,
      userId,
      idempotencyKey,
      operationPath,
      logger
    );

    if (!record) return null; // No cached result — handler should execute

    // AC5: Check operation path mismatch
    if (record.operationPath !== operationPath) {
      throw new AppError(
        ErrorCode.IDEMPOTENCY_KEY_CONFLICT,
        "Idempotency-Key already used for a different operation",
        { boundTo: record.operationPath }
      );
    }

    // AC8: If tombstone (oversized), let handler re-execute
    if (record.oversized) {
      logger.warn(
        "Idempotency record is oversized tombstone, re-executing handler"
      );
      return null;
    }

    // AC3: Replay cached response
    logger.info("Replaying idempotent response", {
      key: idempotencyKey,
      statusCode: record.statusCode,
    });

    return {
      statusCode: record.statusCode,
      headers: {
        ...record.responseHeaders,
        "X-Idempotent-Replayed": "true",
      },
      body: record.responseBody,
    };
  } catch (error) {
    if (AppError.isAppError(error)) throw error; // Re-throw known errors (IDEMPOTENCY_KEY_CONFLICT)

    // AC9: Fail-open on table errors
    logger.warn("Idempotency check failed, executing handler (fail-open)", {
      error: (error as Error).message,
    });
    if (status) status.available = false;
    return null;
  }
}

/**
 * Store the handler result as an idempotency record after successful execution.
 * Only caches 2xx responses. Error responses are not cached so agents can retry.
 */
export async function storeIdempotencyResult(
  event: APIGatewayProxyEvent,
  userId: string,
  idempotencyKey: string,
  result: APIGatewayProxyResult,
  logger: Logger,
  client?: DynamoDBDocumentClient,
  status?: IdempotencyStatus
): Promise<APIGatewayProxyResult> {
  // Only cache 2xx responses
  if (result.statusCode < 200 || result.statusCode >= 300) {
    return result;
  }

  const dbClient = client ?? getDefaultClient();
  const operationPath = getOperationPath(event);
  const nowSeconds = Math.floor(Date.now() / 1000);
  const pk = buildIdempotencyPK(userId, idempotencyKey);

  // AC8: Response size guard
  const bodySize = Buffer.byteLength(result.body ?? "", "utf-8");
  const oversized = bodySize > RESPONSE_SIZE_LIMIT;

  if (oversized) {
    logger.warn("Idempotency response too large to cache", {
      bodySize,
      limit: RESPONSE_SIZE_LIMIT,
    });
  }

  const record: IdempotencyRecord = {
    pk,
    userId,
    operationPath,
    statusCode: result.statusCode,
    responseBody: oversized ? "" : (result.body ?? ""),
    responseHeaders: (result.headers ?? {}) as Record<string, string>,
    createdAt: new Date().toISOString(),
    expiresAt: nowSeconds + TTL_SECONDS,
    ...(oversized && { oversized: true }),
  };

  try {
    const stored = await storeIdempotencyRecord(dbClient, record, logger);

    if (!stored) {
      // AC6: Race condition — another request stored first. Read and replay.
      logger.info(
        "Idempotency record already stored by concurrent request, reading back"
      );
      const existing = await getIdempotencyRecord(
        dbClient,
        userId,
        idempotencyKey,
        operationPath,
        logger
      );
      if (existing && !existing.oversized) {
        return {
          statusCode: existing.statusCode,
          headers: {
            ...existing.responseHeaders,
            "X-Idempotent-Replayed": "true",
          },
          body: existing.responseBody,
        };
      }
    }
  } catch (error) {
    // AC9: Fail-open on store errors — return the original result
    logger.warn("Idempotency store failed (fail-open)", {
      error: (error as Error).message,
    });
    if (status) status.available = false;
  }

  return result;
}
