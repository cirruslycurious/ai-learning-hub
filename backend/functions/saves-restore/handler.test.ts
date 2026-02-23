/**
 * Saves Restore handler tests — POST /saves/:saveId/restore
 *
 * Story 3.3, Task 4: Tests for restore (undo delete) endpoint.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { AppError, ErrorCode, ContentType } from "@ai-learning-hub/types";
import type { SaveItem } from "@ai-learning-hub/types";
import {
  createMockEvent,
  createMockContext,
  mockCreateLoggerModule,
  mockMiddlewareModule,
} from "../../test-utils/index.js";

// Mock @ai-learning-hub/db
const mockGetItem = vi.fn();
const mockUpdateItem = vi.fn();
const mockEnforceRateLimit = vi.fn();
const mockGetDefaultClient = vi.fn(() => ({}));

vi.mock("@ai-learning-hub/db", () => ({
  getDefaultClient: () => mockGetDefaultClient(),
  getItem: (...args: unknown[]) => mockGetItem(...args),
  updateItem: (...args: unknown[]) => mockUpdateItem(...args),
  enforceRateLimit: (...args: unknown[]) => mockEnforceRateLimit(...args),
  requireEnv: (name: string, fallback: string) => process.env[name] ?? fallback,
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
  toPublicSave: (item: SaveItem) => {
    const { PK: _PK, SK: _SK, deletedAt: _del, ...rest } = item;
    return rest;
  },
}));

// Mock @ai-learning-hub/logging
vi.mock("@ai-learning-hub/logging", () => mockCreateLoggerModule());

// Mock @ai-learning-hub/middleware
vi.mock("@ai-learning-hub/middleware", () => mockMiddlewareModule());

// Mock @ai-learning-hub/events
const mockEmitEvent = vi.fn();

vi.mock("@ai-learning-hub/events", () => ({
  emitEvent: (...args: unknown[]) => mockEmitEvent(...args),
  getDefaultClient: () => ({}),
  SAVES_EVENT_SOURCE: "ai-learning-hub.saves",
}));

import { handler } from "./handler.js";

const mockContext = createMockContext();
const VALID_SAVE_ID = "01HXYZ1234567890ABCDEFGHIJ";

function createRestoreEvent(
  saveId: string = VALID_SAVE_ID,
  userId = "user123"
) {
  return createMockEvent({
    method: "POST",
    path: `/saves/${saveId}/restore`,
    userId,
    pathParameters: { saveId },
  });
}

function createSaveItem(overrides: Partial<SaveItem> = {}): SaveItem {
  return {
    PK: "USER#user123",
    SK: `SAVE#${VALID_SAVE_ID}`,
    userId: "user123",
    saveId: VALID_SAVE_ID,
    url: "https://example.com/article",
    normalizedUrl: "https://example.com/article",
    urlHash: "hash123",
    contentType: ContentType.ARTICLE,
    tags: ["test"],
    isTutorial: false,
    linkedProjectCount: 0,
    createdAt: "2026-02-20T00:00:00Z",
    updatedAt: "2026-02-20T00:00:00Z",
    ...overrides,
  };
}

describe("Saves Restore Handler — POST /saves/:saveId/restore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEnforceRateLimit.mockResolvedValue(undefined);
  });

  describe("AC10: Restore soft-deleted save", () => {
    it("returns 200 with restored save when deletedAt is cleared", async () => {
      const restoredItem = createSaveItem({
        updatedAt: "2026-02-23T00:00:00Z",
      });
      mockUpdateItem.mockResolvedValueOnce(restoredItem);

      const event = createRestoreEvent();
      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.data.saveId).toBe(VALID_SAVE_ID);
      expect(body.data).not.toHaveProperty("PK");
      expect(body.data).not.toHaveProperty("SK");
      expect(body.data).not.toHaveProperty("deletedAt");
    });

    it("passes correct update expression to remove deletedAt", async () => {
      const restoredItem = createSaveItem();
      mockUpdateItem.mockResolvedValueOnce(restoredItem);

      const event = createRestoreEvent();
      await handler(event, mockContext);

      expect(mockUpdateItem).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.objectContaining({
          key: { PK: "USER#user123", SK: `SAVE#${VALID_SAVE_ID}` },
          conditionExpression:
            "attribute_exists(PK) AND attribute_exists(deletedAt)",
          returnValues: "ALL_NEW",
        }),
        expect.anything()
      );

      const callArgs = mockUpdateItem.mock.calls[0][2];
      expect(callArgs.updateExpression).toContain("REMOVE deletedAt");
      expect(callArgs.updateExpression).toContain("updatedAt");
    });
  });

  describe("AC11: Idempotent — already active returns 200", () => {
    it("returns 200 with current save when already active", async () => {
      // Conditional update fails (no deletedAt to remove)
      mockUpdateItem.mockRejectedValueOnce(
        new AppError(ErrorCode.NOT_FOUND, "Item not found")
      );
      // Disambiguation: getItem returns active item
      const activeItem = createSaveItem();
      mockGetItem.mockResolvedValueOnce(activeItem);

      const event = createRestoreEvent();
      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.data.saveId).toBe(VALID_SAVE_ID);
    });

    it("does NOT emit SaveRestored event when already active", async () => {
      mockUpdateItem.mockRejectedValueOnce(
        new AppError(ErrorCode.NOT_FOUND, "Item not found")
      );
      mockGetItem.mockResolvedValueOnce(createSaveItem());

      const event = createRestoreEvent();
      await handler(event, mockContext);

      expect(mockEmitEvent).not.toHaveBeenCalled();
    });
  });

  describe("AC12: 404 when save does not exist or wrong user", () => {
    it("returns 404 with 'Save not found' when item is missing", async () => {
      mockUpdateItem.mockRejectedValueOnce(
        new AppError(ErrorCode.NOT_FOUND, "Item not found")
      );
      mockGetItem.mockResolvedValueOnce(null);

      const event = createRestoreEvent();
      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(404);
      const body = JSON.parse(result.body);
      expect(body.error.code).toBe("NOT_FOUND");
      expect(body.error.message).toBe("Save not found");
    });
  });

  describe("AC13: Emits SaveRestored event on deleted → active", () => {
    it("emits SaveRestored with correct detail", async () => {
      const restoredItem = createSaveItem();
      mockUpdateItem.mockResolvedValueOnce(restoredItem);

      const event = createRestoreEvent();
      await handler(event, mockContext);

      expect(mockEmitEvent).toHaveBeenCalledWith(
        expect.anything(),
        expect.any(String),
        expect.objectContaining({
          source: "ai-learning-hub.saves",
          detailType: "SaveRestored",
          detail: expect.objectContaining({
            userId: "user123",
            saveId: VALID_SAVE_ID,
            url: "https://example.com/article",
            normalizedUrl: "https://example.com/article",
            urlHash: "hash123",
            contentType: "article",
          }),
        }),
        expect.anything()
      );
    });
  });

  describe("Validation: invalid saveId format", () => {
    it("returns 400 for invalid saveId", async () => {
      const event = createRestoreEvent("invalid-id");
      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error.code).toBe("VALIDATION_ERROR");
    });
  });

  describe("Rate limiting", () => {
    it("enforces write rate limit", async () => {
      const restoredItem = createSaveItem();
      mockUpdateItem.mockResolvedValueOnce(restoredItem);

      const event = createRestoreEvent();
      await handler(event, mockContext);

      expect(mockEnforceRateLimit).toHaveBeenCalledWith(
        expect.anything(),
        expect.any(String),
        expect.objectContaining({
          operation: "saves-write",
          identifier: "user123",
          limit: 200,
          windowSeconds: 3600,
        }),
        expect.anything()
      );
    });
  });

  describe("Authentication", () => {
    it("returns 401 when not authenticated", async () => {
      const event = createMockEvent({
        method: "POST",
        path: `/saves/${VALID_SAVE_ID}/restore`,
        pathParameters: { saveId: VALID_SAVE_ID },
      });
      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(401);
    });
  });
});
