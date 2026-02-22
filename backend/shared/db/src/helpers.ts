/**
 * DynamoDB query helpers
 */
import { ConditionalCheckFailedException } from "@aws-sdk/client-dynamodb";
import {
  GetCommand,
  PutCommand,
  DeleteCommand,
  QueryCommand,
  UpdateCommand,
  type GetCommandInput,
  type PutCommandInput,
  type DeleteCommandInput,
  type QueryCommandInput,
  type UpdateCommandInput,
} from "@aws-sdk/lib-dynamodb";
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import {
  AppError,
  ErrorCode,
  type PaginatedResponse,
} from "@ai-learning-hub/types";
import { createLogger, type Logger } from "@ai-learning-hub/logging";

/**
 * Require an environment variable, with optional test fallback.
 * Extracted from users.ts and invite-codes.ts to avoid duplication (D9, AC10).
 */
export function requireEnv(name: string, testFallback: string): string {
  const value = process.env[name];
  // Use !== undefined so empty string env vars are treated as "set" (correct Unix semantics).
  // An empty string is a valid (albeit unusual) env var value and should be returned as-is.
  if (value !== undefined) return value;
  if (process.env.NODE_ENV === "test") return testFallback;
  throw new Error(`${name} environment variable is required`);
}

/**
 * Table configuration
 */
export interface TableConfig {
  tableName: string;
  partitionKey: string;
  sortKey?: string;
}

/**
 * Get item from DynamoDB
 */
export async function getItem<T>(
  client: DynamoDBDocumentClient,
  config: TableConfig,
  key: Record<string, unknown>,
  logger?: Logger
): Promise<T | null> {
  const log = logger ?? createLogger();
  const startTime = Date.now();

  const input: GetCommandInput = {
    TableName: config.tableName,
    Key: key,
  };

  try {
    const result = await client.send(new GetCommand(input));
    log.timed("DynamoDB GetItem", startTime, {
      table: config.tableName,
      found: !!result.Item,
    });
    return (result.Item as T) ?? null;
  } catch (error) {
    log.error("DynamoDB GetItem failed", error as Error, {
      table: config.tableName,
    });
    throw new AppError(ErrorCode.INTERNAL_ERROR, "Database operation failed");
  }
}

/**
 * Put item to DynamoDB
 */
export async function putItem<T extends Record<string, unknown>>(
  client: DynamoDBDocumentClient,
  config: TableConfig,
  item: T,
  options: { conditionExpression?: string } = {},
  logger?: Logger
): Promise<void> {
  const log = logger ?? createLogger();
  const startTime = Date.now();

  const input: PutCommandInput = {
    TableName: config.tableName,
    Item: item,
    ...(options.conditionExpression && {
      ConditionExpression: options.conditionExpression,
    }),
  };

  try {
    await client.send(new PutCommand(input));
    log.timed("DynamoDB PutItem", startTime, {
      table: config.tableName,
    });
  } catch (error) {
    const err = error as Error;
    log.error("DynamoDB PutItem failed", err, {
      table: config.tableName,
    });

    if (error instanceof ConditionalCheckFailedException) {
      throw new AppError(ErrorCode.CONFLICT, "Item already exists");
    }

    throw new AppError(ErrorCode.INTERNAL_ERROR, "Database operation failed");
  }
}

/**
 * Delete item from DynamoDB
 */
export async function deleteItem(
  client: DynamoDBDocumentClient,
  config: TableConfig,
  key: Record<string, unknown>,
  logger?: Logger
): Promise<void> {
  const log = logger ?? createLogger();
  const startTime = Date.now();

  const input: DeleteCommandInput = {
    TableName: config.tableName,
    Key: key,
  };

  try {
    await client.send(new DeleteCommand(input));
    log.timed("DynamoDB DeleteItem", startTime, {
      table: config.tableName,
    });
  } catch (error) {
    log.error("DynamoDB DeleteItem failed", error as Error, {
      table: config.tableName,
    });
    throw new AppError(ErrorCode.INTERNAL_ERROR, "Database operation failed");
  }
}

/**
 * Query parameters for paginated queries
 */
export interface QueryParams {
  keyConditionExpression: string;
  expressionAttributeValues: Record<string, unknown>;
  expressionAttributeNames?: Record<string, string>;
  filterExpression?: string;
  limit?: number;
  cursor?: string;
  scanIndexForward?: boolean;
  indexName?: string;
}

/**
 * Decode cursor from base64
 */
function decodeCursor(cursor: string): Record<string, unknown> | undefined {
  try {
    const decoded = Buffer.from(cursor, "base64").toString("utf-8");
    return JSON.parse(decoded);
  } catch {
    return undefined;
  }
}

/**
 * Encode cursor to base64
 */
function encodeCursor(lastKey: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(lastKey)).toString("base64");
}

/**
 * Query items with pagination
 */
export async function queryItems<T>(
  client: DynamoDBDocumentClient,
  config: TableConfig,
  params: QueryParams,
  logger?: Logger
): Promise<PaginatedResponse<T>> {
  const log = logger ?? createLogger();
  const startTime = Date.now();

  const input: QueryCommandInput = {
    TableName: config.tableName,
    KeyConditionExpression: params.keyConditionExpression,
    ExpressionAttributeValues: params.expressionAttributeValues,
    ...(params.expressionAttributeNames && {
      ExpressionAttributeNames: params.expressionAttributeNames,
    }),
    ...(params.filterExpression && {
      FilterExpression: params.filterExpression,
    }),
    ...(params.limit && { Limit: params.limit }),
    ...(params.scanIndexForward !== undefined && {
      ScanIndexForward: params.scanIndexForward,
    }),
    ...(params.indexName && { IndexName: params.indexName }),
    ...(params.cursor && {
      ExclusiveStartKey: decodeCursor(params.cursor),
    }),
  };

  try {
    const result = await client.send(new QueryCommand(input));
    const items = (result.Items ?? []) as T[];
    const hasMore = !!result.LastEvaluatedKey;
    const nextCursor = result.LastEvaluatedKey
      ? encodeCursor(result.LastEvaluatedKey)
      : undefined;

    log.timed("DynamoDB Query", startTime, {
      table: config.tableName,
      index: params.indexName,
      count: items.length,
      hasMore,
    });

    return {
      items,
      nextCursor,
      hasMore,
    };
  } catch (error) {
    log.error("DynamoDB Query failed", error as Error, {
      table: config.tableName,
      index: params.indexName,
    });
    throw new AppError(ErrorCode.INTERNAL_ERROR, "Database operation failed");
  }
}

/**
 * Update item in DynamoDB
 */
export interface UpdateParams {
  key: Record<string, unknown>;
  updateExpression: string;
  expressionAttributeValues: Record<string, unknown>;
  expressionAttributeNames?: Record<string, string>;
  conditionExpression?: string;
  returnValues?: "NONE" | "ALL_OLD" | "UPDATED_OLD" | "ALL_NEW" | "UPDATED_NEW";
}

export async function updateItem<T>(
  client: DynamoDBDocumentClient,
  config: TableConfig,
  params: UpdateParams,
  logger?: Logger
): Promise<T | null> {
  const log = logger ?? createLogger();
  const startTime = Date.now();

  const input: UpdateCommandInput = {
    TableName: config.tableName,
    Key: params.key,
    UpdateExpression: params.updateExpression,
    ExpressionAttributeValues: params.expressionAttributeValues,
    ...(params.expressionAttributeNames && {
      ExpressionAttributeNames: params.expressionAttributeNames,
    }),
    ...(params.conditionExpression && {
      ConditionExpression: params.conditionExpression,
    }),
    ReturnValues: params.returnValues ?? "ALL_NEW",
  };

  try {
    const result = await client.send(new UpdateCommand(input));
    log.timed("DynamoDB UpdateItem", startTime, {
      table: config.tableName,
    });
    return (result.Attributes as T) ?? null;
  } catch (error) {
    const err = error as Error;
    log.error("DynamoDB UpdateItem failed", err, {
      table: config.tableName,
    });

    if (error instanceof ConditionalCheckFailedException) {
      throw new AppError(ErrorCode.NOT_FOUND, "Item not found");
    }

    throw new AppError(ErrorCode.INTERNAL_ERROR, "Database operation failed");
  }
}
