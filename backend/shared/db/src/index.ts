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

// User profile operations
export {
  getProfile,
  ensureProfile,
  USERS_TABLE_CONFIG,
  type UserProfile,
  type PublicMetadata,
} from "./users.js";

// Re-export DynamoDB types for convenience
export type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
