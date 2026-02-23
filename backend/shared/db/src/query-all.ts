/**
 * DynamoDB paginated query helper that accumulates all items up to a ceiling.
 *
 * Story 3.2, Task 3: queryAllItems with FilterExpression-aware Limit logic.
 */
import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { createLogger, type Logger } from "@ai-learning-hub/logging";
import type { TableConfig } from "./helpers.js";

/**
 * Page size used when filterExpression is present.
 * Cannot use ceiling-remainder optimization because DynamoDB's Limit
 * applies before FilterExpression — it would starve accumulation on
 * tables with many soft-deleted items.
 */
const FILTER_PAGE_SIZE = 500;

export interface QueryAllParams {
  keyConditionExpression: string;
  expressionAttributeValues: Record<string, unknown>;
  expressionAttributeNames?: Record<string, string>;
  filterExpression?: string;
  scanIndexForward?: boolean;
  consistentRead?: boolean;
  ceiling?: number;
}

export async function queryAllItems<T>(
  client: DynamoDBDocumentClient,
  config: TableConfig,
  params: QueryAllParams,
  logger?: Logger
): Promise<{ items: T[]; truncated: boolean }> {
  const log = logger ?? createLogger();
  const ceiling = params.ceiling ?? 1000;
  const allItems: T[] = [];
  let lastKey: Record<string, unknown> | undefined;
  let truncated = false;
  let pages = 0;
  const startTime = Date.now();

  do {
    const limitValue = params.filterExpression
      ? FILTER_PAGE_SIZE
      : ceiling - allItems.length;

    const input = {
      TableName: config.tableName,
      KeyConditionExpression: params.keyConditionExpression,
      ExpressionAttributeValues: params.expressionAttributeValues,
      ...(params.expressionAttributeNames && {
        ExpressionAttributeNames: params.expressionAttributeNames,
      }),
      ...(params.filterExpression && {
        FilterExpression: params.filterExpression,
      }),
      ...(params.scanIndexForward !== undefined && {
        ScanIndexForward: params.scanIndexForward,
      }),
      ...(params.consistentRead && { ConsistentRead: true }),
      ...(lastKey && { ExclusiveStartKey: lastKey }),
      Limit: limitValue,
    };

    const result = await client.send(new QueryCommand(input));
    pages++;
    const page = (result.Items ?? []) as T[];
    allItems.push(...page);
    lastKey = result.LastEvaluatedKey as Record<string, unknown> | undefined;

    if (allItems.length >= ceiling && lastKey) {
      truncated = true;
      allItems.splice(ceiling);
      break;
    }
  } while (lastKey);

  log.timed("DynamoDB QueryAll", startTime, {
    table: config.tableName,
    totalItems: allItems.length,
    pages,
    truncated,
  });

  return { items: allItems, truncated };
}
