/**
 * User profile and API key database operations for the users table.
 * Supports create-on-first-auth, profile retrieval, and API key lookup.
 */
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { randomBytes, createHash } from "crypto";
import { ulid } from "ulidx";
import { AppError, ErrorCode } from "@ai-learning-hub/types";
import { createLogger, type Logger } from "@ai-learning-hub/logging";
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
  clerkId: string,
  logger?: Logger
): Promise<UserProfile | null> {
  const log = logger ?? createLogger({ userId: clerkId });

  return getItem<UserProfile>(
    client,
    USERS_TABLE_CONFIG,
    { PK: `USER#${clerkId}`, SK: "PROFILE" },
    log
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
  metadata: PublicMetadata,
  logger?: Logger
): Promise<void> {
  const log = logger ?? createLogger({ userId: clerkId });
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
      log
    );
    log.info("Profile created on first auth", { clerkId });
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
  keyHash: string,
  logger?: Logger
): Promise<ApiKeyItem | null> {
  const log = logger ?? createLogger();

  const result = await queryItems<ApiKeyItem>(
    client,
    USERS_TABLE_CONFIG,
    {
      indexName: "apiKeyHash-index",
      keyConditionExpression: "keyHash = :keyHash",
      expressionAttributeValues: { ":keyHash": keyHash },
      limit: 1,
    },
    log
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
  fields: UpdateProfileFields,
  logger?: Logger
): Promise<UserProfile> {
  const log = logger ?? createLogger({ userId: clerkId });
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
    log
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
  keyId: string,
  logger?: Logger
): Promise<void> {
  const log = logger ?? createLogger({ userId });
  const now = new Date().toISOString();

  await updateItem(
    client,
    USERS_TABLE_CONFIG,
    {
      key: { PK: `USER#${userId}`, SK: `APIKEY#${keyId}` },
      updateExpression: "SET lastUsedAt = :now, updatedAt = :now",
      expressionAttributeValues: { ":now": now },
    },
    log
  );
}

/**
 * Public response for a newly created API key.
 * The `key` field is only returned at creation time (AC1: shown only once).
 */
export interface CreateApiKeyResult {
  id: string;
  name: string;
  key: string;
  scopes: string[];
  createdAt: string;
}

/**
 * Public response for listing API keys (no key value or hash).
 */
export interface PublicApiKeyItem {
  id: string;
  name: string;
  scopes: string[];
  createdAt: string;
  lastUsedAt: string | null;
}

/**
 * Generate a ULID for API key IDs.
 * Uses the ulidx library for standard 26-character Crockford Base32 ULIDs,
 * consistent with the project's entity ID format (see database-schema.md).
 */
function generateKeyId(): string {
  return ulid();
}

/**
 * Create a new API key for a user (Story 2.6, AC1).
 *
 * Generates a 256-bit random key, stores SHA-256 hash in DynamoDB.
 * Returns the plaintext key — shown only once (NFR-S3).
 */
export async function createApiKey(
  client: DynamoDBDocumentClient,
  userId: string,
  name: string,
  scopes: string[],
  logger?: Logger
): Promise<CreateApiKeyResult> {
  const log = logger ?? createLogger({ userId });
  const now = new Date().toISOString();

  // Generate 256-bit random key (AC1)
  const rawKey = randomBytes(32).toString("base64url");
  const keyHash = createHash("sha256").update(rawKey).digest("hex");
  const keyId = generateKeyId();

  const item: ApiKeyItem = {
    PK: `USER#${userId}`,
    SK: `APIKEY#${keyId}`,
    userId,
    keyId,
    keyHash,
    name,
    scopes,
    createdAt: now,
    updatedAt: now,
  };

  await putItem(
    client,
    USERS_TABLE_CONFIG,
    item,
    { conditionExpression: "attribute_not_exists(PK)" },
    log
  );

  log.info("API key created", { userId, keyId });

  return {
    id: keyId,
    name,
    key: rawKey,
    scopes,
    createdAt: now,
  };
}

/**
 * List all active (non-revoked) API keys for a user (Story 2.6, AC2).
 *
 * Returns keys without the key value or hash (NFR-S3, NFR-S8).
 *
 * NOTE: DynamoDB applies `Limit` before `FilterExpression`. If many keys are
 * revoked, the returned page may contain fewer items than `limit`. The client
 * can use `hasMore`/`nextCursor` to fetch additional pages. At current scale
 * (max 10 active keys per user) this is acceptable behavior.
 */
export async function listApiKeys(
  client: DynamoDBDocumentClient,
  userId: string,
  limit: number = 20,
  cursor?: string,
  logger?: Logger
): Promise<{
  items: PublicApiKeyItem[];
  hasMore: boolean;
  nextCursor?: string;
}> {
  const log = logger ?? createLogger({ userId });

  const result = await queryItems<ApiKeyItem>(
    client,
    USERS_TABLE_CONFIG,
    {
      keyConditionExpression: "PK = :pk AND begins_with(SK, :skPrefix)",
      expressionAttributeValues: {
        ":pk": `USER#${userId}`,
        ":skPrefix": "APIKEY#",
      },
      filterExpression: "attribute_not_exists(revokedAt)",
      limit,
      cursor,
    },
    log
  );

  // Strip internal fields — never return key hash (NFR-S3, NFR-S8)
  const items: PublicApiKeyItem[] = result.items.map((item) => ({
    id: item.keyId,
    name: item.name,
    scopes: item.scopes,
    createdAt: item.createdAt,
    lastUsedAt: item.lastUsedAt ?? null,
  }));

  return {
    items,
    hasMore: result.hasMore,
    nextCursor: result.nextCursor,
  };
}

/**
 * Revoke an API key by setting revokedAt (soft delete) (Story 2.6, AC3).
 *
 * The key becomes immediately invalid — the API Key Authorizer checks
 * `revokedAt` before returning Allow (Story 2.2).
 */
export async function revokeApiKey(
  client: DynamoDBDocumentClient,
  userId: string,
  keyId: string,
  logger?: Logger
): Promise<void> {
  const log = logger ?? createLogger({ userId });
  const now = new Date().toISOString();

  await updateItem(
    client,
    USERS_TABLE_CONFIG,
    {
      key: { PK: `USER#${userId}`, SK: `APIKEY#${keyId}` },
      updateExpression: "SET revokedAt = :now, updatedAt = :now",
      expressionAttributeValues: { ":now": now },
      conditionExpression:
        "attribute_exists(PK) AND attribute_not_exists(revokedAt)",
    },
    log
  );
}
