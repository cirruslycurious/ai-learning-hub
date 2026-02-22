/**
 * DynamoDB TransactWriteItems helper
 *
 * Story 3.1b, Task 1: Provides typed transactional writes with
 * ConditionalCheckFailed reason mapping for callers.
 */
import { TransactionCanceledException } from "@aws-sdk/client-dynamodb";
import {
  TransactWriteCommand,
  type TransactWriteCommandInput,
} from "@aws-sdk/lib-dynamodb";
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { AppError, ErrorCode } from "@ai-learning-hub/types";
import { createLogger, type Logger } from "@ai-learning-hub/logging";

/**
 * Typed error for transaction cancellations.
 * `reasons` maps 1:1 with the TransactItems array — callers can check
 * `reasons[index]` to determine which item caused the failure.
 */
export class TransactionCancelledError extends Error {
  public readonly reasons: string[];

  constructor(reasons: string[]) {
    super("Transaction cancelled");
    this.name = "TransactionCancelledError";
    this.reasons = reasons;
  }
}

/**
 * Execute a DynamoDB TransactWriteItems operation.
 *
 * On success: resolves void.
 * On TransactionCanceledException: throws TransactionCancelledError with
 *   per-item reason codes (e.g., "ConditionalCheckFailed", "None").
 * On other errors: throws AppError(INTERNAL_ERROR).
 */
export async function transactWriteItems(
  client: DynamoDBDocumentClient,
  transactItems: TransactWriteCommandInput["TransactItems"],
  logger?: Logger
): Promise<void> {
  const log = logger ?? createLogger();
  const startTime = Date.now();

  try {
    await client.send(
      new TransactWriteCommand({ TransactItems: transactItems })
    );
    log.timed("DynamoDB TransactWriteItems", startTime, {
      itemCount: transactItems?.length ?? 0,
    });
  } catch (error) {
    if (error instanceof TransactionCanceledException) {
      const reasons = (error.CancellationReasons ?? []).map(
        (r) => r.Code ?? "Unknown"
      );
      log.warn("DynamoDB TransactWriteItems cancelled", {
        reasons,
      });
      throw new TransactionCancelledError(reasons);
    }

    log.error("DynamoDB TransactWriteItems failed", error as Error);
    throw new AppError(ErrorCode.INTERNAL_ERROR, "Database operation failed");
  }
}
