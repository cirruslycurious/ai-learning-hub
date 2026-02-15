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
  getApiKeyByHash,
  updateApiKeyLastUsed,
  USERS_TABLE_CONFIG,
  type UserProfile,
  type PublicMetadata,
  type ApiKeyItem,
} from "./users.js";

// Re-export DynamoDB types for convenience
export type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
