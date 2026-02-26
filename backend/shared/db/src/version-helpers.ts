/**
 * Optimistic concurrency DB helpers (Story 3.2.1)
 *
 * Provides version-aware update and put operations for DynamoDB items.
 * Uses conditional writes to detect version conflicts.
 */
import { ConditionalCheckFailedException } from "@aws-sdk/client-dynamodb";
import { PutCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import {
  AppError,
  ErrorCode,
  INITIAL_VERSION,
  nextVersion,
} from "@ai-learning-hub/types";
import { createLogger, type Logger } from "@ai-learning-hub/logging";
import type { TableConfig, UpdateParams } from "./helpers.js";

/**
 * Error thrown when a version conflict is detected during an optimistic concurrency update.
 * Includes currentVersion so the caller (or agent) can retry with the correct version.
 */
export class VersionConflictError extends AppError {
  readonly currentVersion: number;

  constructor(currentVersion: number) {
    super(ErrorCode.VERSION_CONFLICT, "Resource has been modified", {
      currentVersion,
    });
    this.currentVersion = currentVersion;
    // Note: Do NOT override this.name — AppError sets it to "AppError",
    // which is required for AppError.isAppError() duck-type detection
    // across module boundaries.
  }
}

/**
 * Update an item with optimistic concurrency version check.
 *
 * Automatically appends `SET version = :newVersion` to the update expression
 * and adds `ConditionExpression: version = :expectedVersion`.
 *
 * Throws VersionConflictError if the version doesn't match.
 */
export async function updateItemWithVersion<T>(
  client: DynamoDBDocumentClient,
  config: TableConfig,
  params: UpdateParams,
  expectedVersion: number,
  logger?: Logger
): Promise<T | null> {
  const log = logger ?? createLogger();
  const startTime = Date.now();
  const newVer = nextVersion(expectedVersion);

  // Append version SET clause
  const updateExpression = `${params.updateExpression}, #_ver = :_newVer`;
  const expressionAttributeValues = {
    ...params.expressionAttributeValues,
    ":_expectedVer": expectedVersion,
    ":_newVer": newVer,
  };
  const expressionAttributeNames = {
    ...params.expressionAttributeNames,
    "#_ver": "version",
  };

  // Merge version condition with any existing condition
  const versionCondition = "#_ver = :_expectedVer";
  const conditionExpression = params.conditionExpression
    ? `(${params.conditionExpression}) AND (${versionCondition})`
    : versionCondition;

  try {
    const result = await client.send(
      new UpdateCommand({
        TableName: config.tableName,
        Key: params.key,
        UpdateExpression: updateExpression,
        ExpressionAttributeValues: expressionAttributeValues,
        ExpressionAttributeNames: expressionAttributeNames,
        ConditionExpression: conditionExpression,
        ReturnValues: params.returnValues ?? "ALL_NEW",
        ReturnValuesOnConditionCheckFailure: "ALL_OLD",
      })
    );

    log.timed("DynamoDB UpdateItem (versioned)", startTime, {
      table: config.tableName,
      expectedVersion,
      newVersion: newVer,
    });

    return (result.Attributes as T) ?? null;
  } catch (error) {
    if (error instanceof ConditionalCheckFailedException) {
      // Extract the actual server version from the returned old item attributes,
      // falling back to expectedVersion if not available.
      const actualVersion =
        (error as unknown as { Item?: Record<string, unknown> }).Item
          ?.version ?? expectedVersion;
      log.warn("Version conflict detected", {
        table: config.tableName,
        expectedVersion,
        actualVersion,
      });
      throw new VersionConflictError(actualVersion as number);
    }

    log.error("DynamoDB UpdateItem (versioned) failed", error as Error, {
      table: config.tableName,
    });
    throw new AppError(ErrorCode.INTERNAL_ERROR, "Database operation failed");
  }
}

/**
 * Put a new item with initial version (version = 1).
 */
export async function putItemWithVersion<T extends Record<string, unknown>>(
  client: DynamoDBDocumentClient,
  config: TableConfig,
  item: T,
  logger?: Logger
): Promise<void> {
  const log = logger ?? createLogger();
  const startTime = Date.now();

  const versionedItem = { ...item, version: INITIAL_VERSION };

  try {
    await client.send(
      new PutCommand({
        TableName: config.tableName,
        Item: versionedItem,
        ConditionExpression: `attribute_not_exists(${config.partitionKey})`,
      })
    );

    log.timed("DynamoDB PutItem (versioned)", startTime, {
      table: config.tableName,
      version: INITIAL_VERSION,
    });
  } catch (error) {
    if (error instanceof ConditionalCheckFailedException) {
      log.warn("Item already exists (putItemWithVersion)", {
        table: config.tableName,
      });
      throw new AppError(ErrorCode.CONFLICT, "Item already exists");
    }

    log.error("DynamoDB PutItem (versioned) failed", error as Error, {
      table: config.tableName,
    });
    throw new AppError(ErrorCode.INTERNAL_ERROR, "Database operation failed");
  }
}
