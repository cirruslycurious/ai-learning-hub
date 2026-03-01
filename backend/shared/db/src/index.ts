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
  requireEnv,
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
  createInviteCode,
  listInviteCodesByUser,
  toPublicInviteCode,
  INVITE_CODES_TABLE_CONFIG,
  type InviteCodeItem,
  type PublicInviteCodeItem,
} from "./invite-codes.js";

// Save operations
export {
  SAVES_TABLE_CONFIG,
  SAVES_WRITE_RATE_LIMIT,
  savesWriteRateLimit,
  toPublicSave,
} from "./saves.js";

// Query all items (paginated accumulation)
export { queryAllItems, type QueryAllParams } from "./query-all.js";

// Rate limiting operations
export {
  incrementAndCheckRateLimit,
  enforceRateLimit,
  getWindowKey,
  getCounterTTL,
  type RateLimitConfig,
  type RateLimitResult,
} from "./rate-limiter.js";

// Transactional write operations
export { transactWriteItems, TransactionCancelledError } from "./transact.js";

// Idempotency storage (Story 3.2.1)
export {
  IDEMPOTENCY_TABLE_CONFIG,
  storeIdempotencyRecord,
  getIdempotencyRecord,
  buildIdempotencyPK,
} from "./idempotency.js";

// Optimistic concurrency helpers (Story 3.2.1)
export {
  VersionConflictError,
  updateItemWithVersion,
  putItemWithVersion,
} from "./version-helpers.js";

// Event history operations (Story 3.2.3)
export {
  EVENTS_TABLE_CONFIG,
  recordEvent,
  queryEntityEvents,
  buildEventPK,
  buildEventSK,
} from "./events.js";

// Pagination utilities (Story 3.2.5)
export {
  encodeCursor,
  decodeCursor,
  validateCursor,
  buildPaginatedResponse,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  type BuildPaginatedResponseOptions,
} from "./pagination.js";

// Re-export DynamoDB types for convenience
export type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
