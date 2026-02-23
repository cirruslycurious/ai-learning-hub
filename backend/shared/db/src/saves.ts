/**
 * Saves table configuration and helpers.
 *
 * Story 3.2, Task 2: SAVES_TABLE_CONFIG and toPublicSave.
 * Pattern mirrors toPublicInviteCode in invite-codes.ts.
 */
import { requireEnv } from "./helpers.js";
import type { TableConfig } from "./helpers.js";
import type { SaveItem, PublicSave } from "@ai-learning-hub/types";

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
