/**
 * @ai-learning-hub/db
 *
 * DynamoDB client and query helpers
 */

// Client
export {
  createDynamoDBClient,
  getDefaultClient,
  resetDefaultClient,
  type DynamoDBClientOptions,
} from "./client.js";

// Helpers
export {
  getItem,
  putItem,
  deleteItem,
  queryItems,
  updateItem,
  type TableConfig,
  type QueryParams,
  type UpdateParams,
} from "./helpers.js";

// User profile and API key operations
export {
  getProfile,
  ensureProfile,
  updateProfile,
  getApiKeyByHash,
  updateApiKeyLastUsed,
  createApiKey,
  listApiKeys,
  revokeApiKey,
  USERS_TABLE_CONFIG,
  type UserProfile,
  type PublicMetadata,
  type ApiKeyItem,
  type UpdateProfileFields,
  type CreateApiKeyResult,
  type PublicApiKeyItem,
} from "./users.js";

// Invite code operations
export {
  getInviteCode,
  redeemInviteCode,
  INVITE_CODES_TABLE_CONFIG,
  type InviteCodeItem,
} from "./invite-codes.js";

// Rate limiting operations
export {
  incrementAndCheckRateLimit,
  enforceRateLimit,
  getWindowKey,
  getCounterTTL,
  type RateLimitConfig,
  type RateLimitResult,
} from "./rate-limiter.js";

// Re-export DynamoDB types for convenience
export type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
