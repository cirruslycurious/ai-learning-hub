/**
 * User profile database operations for the users table.
 * Supports create-on-first-auth and profile retrieval.
 */
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { AppError, ErrorCode } from "@ai-learning-hub/types";
import { createLogger } from "@ai-learning-hub/logging";
import { getItem, putItem, type TableConfig } from "./helpers.js";

export const USERS_TABLE_CONFIG: TableConfig = {
  tableName: process.env.USERS_TABLE_NAME ?? "ai-learning-hub-users",
  partitionKey: "PK",
  sortKey: "SK",
};

export interface UserProfile extends Record<string, unknown> {
  PK: string;
  SK: string;
  userId: string;
  email?: string;
  displayName?: string;
  role: string;
  suspendedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PublicMetadata {
  email?: string;
  displayName?: string;
  role?: string;
  inviteValidated?: boolean;
}

/**
 * Get a user profile by Clerk ID.
 * Returns null if the profile does not exist.
 */
export async function getProfile(
  client: DynamoDBDocumentClient,
  clerkId: string
): Promise<UserProfile | null> {
  const logger = createLogger({ userId: clerkId });

  return getItem<UserProfile>(
    client,
    USERS_TABLE_CONFIG,
    { PK: `USER#${clerkId}`, SK: "PROFILE" },
    logger
  );
}

/**
 * Ensure a user profile exists (create-on-first-auth).
 * Uses conditional PutItem with attribute_not_exists(PK) so it's
 * safe to call on every request — only writes on first auth.
 *
 * Silently succeeds if the profile already exists (ConditionalCheckFailed → no-op).
 */
export async function ensureProfile(
  client: DynamoDBDocumentClient,
  clerkId: string,
  metadata: PublicMetadata
): Promise<void> {
  const logger = createLogger({ userId: clerkId });
  const now = new Date().toISOString();

  const item: UserProfile = {
    PK: `USER#${clerkId}`,
    SK: "PROFILE",
    userId: clerkId,
    email: metadata.email,
    displayName: metadata.displayName,
    role: metadata.role ?? "user",
    createdAt: now,
    updatedAt: now,
  };

  try {
    await putItem(
      client,
      USERS_TABLE_CONFIG,
      item,
      {
        conditionExpression: "attribute_not_exists(PK)",
      },
      logger
    );
    logger.info("Profile created on first auth", { clerkId });
  } catch (error) {
    // ConditionalCheckFailed means profile already exists — expected on subsequent requests
    if (AppError.isAppError(error) && error.code === ErrorCode.CONFLICT) {
      return;
    }
    throw error;
  }
}
