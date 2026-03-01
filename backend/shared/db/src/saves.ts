/**
 * Saves table configuration and helpers.
 *
 * Story 3.2, Task 2: SAVES_TABLE_CONFIG and toPublicSave.
 * Pattern mirrors toPublicInviteCode in invite-codes.ts.
 */
import { requireEnv } from "./helpers.js";
import type { TableConfig } from "./helpers.js";
import type { SaveItem, PublicSave } from "@ai-learning-hub/types";
import type { RateLimitMiddlewareConfig } from "@ai-learning-hub/middleware";

export const SAVES_WRITE_RATE_LIMIT = {
  operation: "saves-write",
  limit: 200,
  windowSeconds: 3600,
} as const;

/**
 * Scope-based rate limit config for saves mutations (Story 3.2.7).
 * Capture-tier keys: 20/hour, full/*: 200/hour, other scoped: 100/hour.
 */
export const savesWriteRateLimit: RateLimitMiddlewareConfig = {
  operation: "saves-write",
  windowSeconds: 3600,
  limit: (auth) => {
    if (!auth?.isApiKey) return 200; // JWT users: default limit (AC15)
    const scopes = auth?.scopes ?? [];
    if (scopes.includes("capture")) return 20;
    if (scopes.includes("full") || scopes.includes("*")) return 200;
    return 100; // scoped API key default
  },
};

export const SAVES_TABLE_CONFIG: TableConfig = {
  tableName: requireEnv("SAVES_TABLE_NAME", "ai-learning-hub-saves"),
  partitionKey: "PK",
  sortKey: "SK",
};

/**
 * Strip internal DynamoDB keys and soft-delete marker before returning to API caller.
 */
export function toPublicSave(item: SaveItem): PublicSave {
  const { PK: _PK, SK: _SK, deletedAt: _deletedAt, ...rest } = item;
  return rest;
}
