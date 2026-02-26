/**
 * Idempotency storage layer for DynamoDB (Story 3.2.1)
 *
 * Stores and retrieves idempotency records for command endpoint deduplication.
 * PK pattern: IDEMP#{userId}#{idempotencyKey}
 */
import { ConditionalCheckFailedException } from "@aws-sdk/client-dynamodb";
import { GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import type { IdempotencyRecord } from "@ai-learning-hub/types";
import { AppError, ErrorCode } from "@ai-learning-hub/types";
import { createLogger, type Logger } from "@ai-learning-hub/logging";
import { requireEnv, type TableConfig } from "./helpers.js";

/**
 * Idempotency table configuration
 */
export const IDEMPOTENCY_TABLE_CONFIG: TableConfig = {
  tableName: requireEnv(
    "IDEMPOTENCY_TABLE_NAME",
    "ai-learning-hub-idempotency"
  ),
  partitionKey: "pk",
};

/**
 * Build PK for idempotency records
 */
export function buildIdempotencyPK(
  userId: string,
  idempotencyKey: string
): string {
  return `IDEMP#${userId}#${idempotencyKey}`;
}

/**
 * Store an idempotency record with conditional write (attribute_not_exists).
 * Returns true if stored successfully, false if record already exists (race condition).
 * Throws on other DynamoDB errors.
 */
export async function storeIdempotencyRecord(
  client: DynamoDBDocumentClient,
  record: IdempotencyRecord,
  logger?: Logger
): Promise<boolean> {
  const log = logger ?? createLogger();
  const startTime = Date.now();

  try {
    await client.send(
      new PutCommand({
        TableName: IDEMPOTENCY_TABLE_CONFIG.tableName,
        Item: record,
        ConditionExpression: "attribute_not_exists(pk)",
      })
    );

    log.timed("DynamoDB PutItem (idempotency)", startTime, {
      table: IDEMPOTENCY_TABLE_CONFIG.tableName,
      pk: record.pk,
    });

    return true;
  } catch (error) {
    if (error instanceof ConditionalCheckFailedException) {
      // Record already exists — another request won the race
      log.timed("DynamoDB PutItem (idempotency) - already exists", startTime, {
        table: IDEMPOTENCY_TABLE_CONFIG.tableName,
        pk: record.pk,
      });
      return false;
    }

    log.error("DynamoDB PutItem (idempotency) failed", error as Error, {
      table: IDEMPOTENCY_TABLE_CONFIG.tableName,
    });
    throw new AppError(ErrorCode.INTERNAL_ERROR, "Database operation failed");
  }
}

/**
 * Get an idempotency record by userId and key.
 * Returns null if not found OR if record has expired (application-level expiry check).
 * The operationPath is passed for logging; mismatch detection is done by the middleware.
 */
export async function getIdempotencyRecord(
  client: DynamoDBDocumentClient,
  userId: string,
  idempotencyKey: string,
  operationPath: string,
  logger?: Logger
): Promise<IdempotencyRecord | null> {
  const log = logger ?? createLogger();
  const startTime = Date.now();
  const pk = buildIdempotencyPK(userId, idempotencyKey);

  try {
    const result = await client.send(
      new GetCommand({
        TableName: IDEMPOTENCY_TABLE_CONFIG.tableName,
        Key: { pk },
      })
    );

    log.timed("DynamoDB GetItem (idempotency)", startTime, {
      table: IDEMPOTENCY_TABLE_CONFIG.tableName,
      found: !!result.Item,
      operationPath,
    });

    if (!result.Item) return null;

    const record = result.Item as IdempotencyRecord;

    // Application-level expiry check (defense-in-depth against DynamoDB TTL lag)
    const nowSeconds = Math.floor(Date.now() / 1000);
    if (nowSeconds > record.expiresAt) {
      log.info("Idempotency record expired (application-level check)", {
        pk,
        expiresAt: record.expiresAt,
        nowSeconds,
      });
      return null;
    }

    return record;
  } catch (error) {
    log.error("DynamoDB GetItem (idempotency) failed", error as Error, {
      table: IDEMPOTENCY_TABLE_CONFIG.tableName,
    });
    throw new AppError(ErrorCode.INTERNAL_ERROR, "Database operation failed");
  }
}
