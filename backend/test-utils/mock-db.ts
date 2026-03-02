/**
 * Composable mock factory for @ai-learning-hub/db.
 *
 * Story 3.1.2, Task 3: Extract duplicated DB mock blocks
 * found in 6+ handler test files.
 *
 * Provides shared static config (table configs, toPublicSave, requireEnv,
 * rate limit constant). Callers MUST pass handler-specific operation mocks
 * (e.g., getItem, updateItem, queryItems) via mockFns — these vary per
 * handler and are not included in defaults.
 *
 * Pattern matches mockMiddlewareModule() — returns a plain object.
 */
import type { SaveItem } from "@ai-learning-hub/types";
// Import real pagination utilities — pure functions with no DynamoDB dependencies.
// Using the source path avoids interception by vi.mock("@ai-learning-hub/db").
import {
  encodeCursor,
  decodeCursor,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
} from "../shared/db/src/pagination.js";

/**
 * Creates a vi.mock factory for @ai-learning-hub/db.
 *
 * Usage:
 * ```ts
 * const mockGetItem = vi.fn();
 * const mockUpdateItem = vi.fn();
 * vi.mock("@ai-learning-hub/db", () =>
 *   mockDbModule({
 *     getItem: (...args: unknown[]) => mockGetItem(...args),
 *     updateItem: (...args: unknown[]) => mockUpdateItem(...args),
 *   })
 * );
 * ```
 */
export function mockDbModule(
  mockFns: Record<string, (...args: unknown[]) => unknown> = {}
): Record<string, unknown> {
  return {
    getDefaultClient: () => ({}),
    SAVES_TABLE_CONFIG: {
      tableName: "ai-learning-hub-saves",
      partitionKey: "PK",
      sortKey: "SK",
    },
    USERS_TABLE_CONFIG: {
      tableName: "ai-learning-hub-users",
      partitionKey: "PK",
      sortKey: "SK",
    },
    INVITE_CODES_TABLE_CONFIG: {
      tableName: "ai-learning-hub-invite-codes",
      partitionKey: "PK",
      sortKey: "SK",
    },
    toPublicSave: (item: SaveItem) => {
      const { PK: _PK, SK: _SK, deletedAt: _del, ...rest } = item;
      return rest;
    },
    requireEnv: (name: string, fallback: string) =>
      process.env[name] ?? fallback,
    SAVES_WRITE_RATE_LIMIT: {
      operation: "saves-write",
      limit: 200,
      windowSeconds: 3600,
    },
    // Story 3.2.7: Scope-based rate limit config (replaces inline enforceRateLimit calls)
    savesWriteRateLimit: {
      operation: "saves-write",
      windowSeconds: 3600,
      limit: () => 200,
    },
    // Story 3.2.8: Auth domain rate limit configs
    apiKeyCreateRateLimit: {
      operation: "apikey-create",
      windowSeconds: 3600,
      limit: () => 10,
    },
    inviteGenerateRateLimit: {
      operation: "invite-generate",
      windowSeconds: 86400,
      limit: () => 5,
    },
    inviteValidateRateLimit: {
      operation: "invite-validate",
      windowSeconds: 3600,
      limit: () => 5,
    },
    profileUpdateRateLimit: {
      operation: "profile-update",
      windowSeconds: 3600,
      limit: 30,
    },
    // Story 3.2.8: updateProfileWithEvents for users-me handler
    updateProfileWithEvents: () =>
      Promise.resolve({
        profile: {},
        changedFields: [],
        before: {},
        after: {},
      }),
    // Story 3.2.7: Event history recording (fire-and-forget, no-op by default)
    recordEvent: () => Promise.resolve(),
    // Pagination utilities (Story 3.2.5) — real implementations, no side effects
    encodeCursor,
    decodeCursor,
    DEFAULT_PAGE_SIZE,
    MAX_PAGE_SIZE,
    ...mockFns,
  };
}
