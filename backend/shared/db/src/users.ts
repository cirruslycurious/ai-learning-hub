/**
 * User profile and API key database operations for the users table.
 * Supports create-on-first-auth, profile retrieval, and API key lookup.
 */
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { AppError, ErrorCode } from "@ai-learning-hub/types";
import { createLogger } from "@ai-learning-hub/logging";
import {
  getItem,
  putItem,
  queryItems,
  updateItem,
  type TableConfig,
} from "./helpers.js";

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
  globalPreferences?: Record<string, unknown>;
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

/**
 * API key item stored in the users table (SK: APIKEY#<keyId>).
 * Looked up via the apiKeyHash-index GSI for authentication.
 *
 * Design note: API keys use revocation-only invalidation (via `revokedAt`).
 * There is intentionally no `expiresAt` field — keys remain valid until
 * explicitly revoked by the user (Story 2.6) or an admin. If time-based
 * expiration is added in a future story, the authorizer must be updated
 * to check the field before returning Allow.
 */
export interface ApiKeyItem extends Record<string, unknown> {
  PK: string;
  SK: string;
  userId: string;
  keyId: string;
  keyHash: string;
  name: string;
  scopes: string[];
  revokedAt?: string;
  lastUsedAt?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Look up an API key by its SHA-256 hash via the apiKeyHash-index GSI.
 * Returns the API key item or null if not found.
 */
export async function getApiKeyByHash(
  client: DynamoDBDocumentClient,
  keyHash: string
): Promise<ApiKeyItem | null> {
  const logger = createLogger();

  const result = await queryItems<ApiKeyItem>(
    client,
    USERS_TABLE_CONFIG,
    {
      indexName: "apiKeyHash-index",
      keyConditionExpression: "keyHash = :keyHash",
      expressionAttributeValues: { ":keyHash": keyHash },
      limit: 1,
    },
    logger
  );

  return result.items[0] ?? null;
}

/**
 * Fields that can be updated on a user profile via PATCH /users/me.
 */
export interface UpdateProfileFields {
  displayName?: string;
  globalPreferences?: Record<string, unknown>;
}

/**
 * Update a user profile with the provided fields.
 * Returns the updated profile or throws NOT_FOUND if the profile doesn't exist.
 */
export async function updateProfile(
  client: DynamoDBDocumentClient,
  clerkId: string,
  fields: UpdateProfileFields
): Promise<UserProfile> {
  const logger = createLogger({ userId: clerkId });
  const now = new Date().toISOString();

  // Build dynamic SET expression from provided fields
  const setExpressions: string[] = ["updatedAt = :now"];
  const expressionAttributeValues: Record<string, unknown> = { ":now": now };
  if (fields.displayName !== undefined) {
    setExpressions.push("displayName = :displayName");
    expressionAttributeValues[":displayName"] = fields.displayName;
  }

  if (fields.globalPreferences !== undefined) {
    setExpressions.push("globalPreferences = :globalPreferences");
    expressionAttributeValues[":globalPreferences"] = fields.globalPreferences;
  }

  const updated = await updateItem<UserProfile>(
    client,
    USERS_TABLE_CONFIG,
    {
      key: { PK: `USER#${clerkId}`, SK: "PROFILE" },
      updateExpression: `SET ${setExpressions.join(", ")}`,
      expressionAttributeValues,
      conditionExpression: "attribute_exists(PK)",
      returnValues: "ALL_NEW",
    },
    logger
  );

  // Defensive fallback: updateItem helper already throws NOT_FOUND on
  // ConditionalCheckFailedException, so this branch should not be reached
  // under normal conditions. Kept as a safety net in case the helper
  // behavior changes or DynamoDB returns empty Attributes unexpectedly.
  if (!updated) {
    throw new AppError(ErrorCode.NOT_FOUND, "User profile not found");
  }

  return updated;
}

/**
 * Update the lastUsedAt timestamp for an API key (fire-and-forget).
 * Called after successful API key authentication.
 */
export async function updateApiKeyLastUsed(
  client: DynamoDBDocumentClient,
  userId: string,
  keyId: string
): Promise<void> {
  const logger = createLogger({ userId });
  const now = new Date().toISOString();

  await updateItem(
    client,
    USERS_TABLE_CONFIG,
    {
      key: { PK: `USER#${userId}`, SK: `APIKEY#${keyId}` },
      updateExpression: "SET lastUsedAt = :now, updatedAt = :now",
      expressionAttributeValues: { ":now": now },
    },
    logger
  );
}
