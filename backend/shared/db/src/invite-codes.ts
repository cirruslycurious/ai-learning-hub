/**
 * Invite code database operations for the invite-codes table.
 * Supports code lookup, redemption, and idempotent validation.
 */
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { AppError, ErrorCode } from "@ai-learning-hub/types";
import { createLogger } from "@ai-learning-hub/logging";
import { getItem, updateItem, type TableConfig } from "./helpers.js";

export const INVITE_CODES_TABLE_CONFIG: TableConfig = {
  tableName:
    process.env.INVITE_CODES_TABLE_NAME ?? "ai-learning-hub-invite-codes",
  partitionKey: "PK",
  sortKey: "SK",
};

/**
 * Invite code item stored in the invite-codes table.
 * PK: CODE#<code>, SK: META
 */
export interface InviteCodeItem extends Record<string, unknown> {
  PK: string;
  SK: string;
  code: string;
  generatedBy: string;
  generatedAt: string;
  redeemedBy?: string;
  redeemedAt?: string;
  expiresAt?: string;
  isRevoked?: boolean;
}

/**
 * Get an invite code by its value.
 * Returns null if the code does not exist.
 */
export async function getInviteCode(
  client: DynamoDBDocumentClient,
  code: string
): Promise<InviteCodeItem | null> {
  const logger = createLogger();

  return getItem<InviteCodeItem>(
    client,
    INVITE_CODES_TABLE_CONFIG,
    { PK: `CODE#${code}`, SK: "META" },
    logger
  );
}

/**
 * Redeem an invite code using conditional update.
 * Uses ConditionExpression to prevent double-redemption (atomic).
 *
 * @throws AppError NOT_FOUND if code doesn't exist or is already redeemed/revoked/expired
 */
export async function redeemInviteCode(
  client: DynamoDBDocumentClient,
  code: string,
  redeemedBy: string
): Promise<InviteCodeItem> {
  const logger = createLogger({ userId: redeemedBy });
  const now = new Date().toISOString();

  const result = await updateItem<InviteCodeItem>(
    client,
    INVITE_CODES_TABLE_CONFIG,
    {
      key: { PK: `CODE#${code}`, SK: "META" },
      updateExpression:
        "SET redeemedBy = :redeemedBy, redeemedAt = :redeemedAt",
      expressionAttributeValues: {
        ":redeemedBy": redeemedBy,
        ":redeemedAt": now,
        ":false": false,
      },
      conditionExpression:
        "attribute_exists(PK) AND attribute_not_exists(redeemedBy) AND (attribute_not_exists(isRevoked) OR isRevoked = :false)",
      returnValues: "ALL_NEW",
    },
    logger
  );

  if (!result) {
    throw new AppError(
      ErrorCode.INTERNAL_ERROR,
      "Failed to redeem invite code"
    );
  }

  logger.info("Invite code redeemed", { code: code.slice(0, 4) + "***" });
  return result;
}
