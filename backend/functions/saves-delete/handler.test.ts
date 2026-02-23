/**
 * Saves Delete handler tests — DELETE /saves/:saveId
 *
 * Story 3.3, Task 3: Tests for soft-delete save endpoint.
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
  SAVES_WRITE_RATE_LIMIT: {
    operation: "saves-write",
    limit: 200,
    windowSeconds: 3600,
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
  requireEventBus: () => ({ busName: "test-event-bus", ebClient: {} }),
  SAVES_EVENT_SOURCE: "ai-learning-hub.saves",
}));

import { handler } from "./handler.js";

const mockContext = createMockContext();
const VALID_SAVE_ID = "01HXYZ1234567890ABCDEFGHIJ";

function createDeleteEvent(saveId: string = VALID_SAVE_ID, userId = "user123") {
  return createMockEvent({
    method: "DELETE",
    path: `/saves/${saveId}`,
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

describe("Saves Delete Handler — DELETE /saves/:saveId", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEnforceRateLimit.mockResolvedValue(undefined);
  });

  describe("AC3: Soft delete sets deletedAt and returns 204", () => {
    it("returns 204 on successful soft delete", async () => {
      // Conditional update succeeds — returns ALL_OLD (pre-update item)
      mockUpdateItem.mockResolvedValueOnce(createSaveItem());

      const event = createDeleteEvent();
      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(204);
      expect(result.body).toBe("");
    });

    it("passes correct update expression with deletedAt and updatedAt", async () => {
      mockUpdateItem.mockResolvedValueOnce(createSaveItem());

      const event = createDeleteEvent();
      await handler(event, mockContext);

      expect(mockUpdateItem).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.objectContaining({
          key: { PK: "USER#user123", SK: `SAVE#${VALID_SAVE_ID}` },
          conditionExpression:
            "attribute_exists(PK) AND attribute_not_exists(deletedAt)",
          returnValues: "ALL_OLD",
        }),
        expect.anything()
      );

      const callArgs = mockUpdateItem.mock.calls[0][2];
      expect(callArgs.updateExpression).toContain("deletedAt");
      expect(callArgs.updateExpression).toContain("updatedAt");
    });
  });

  describe("AC4: Emits SaveDeleted event on active → deleted", () => {
    it("emits SaveDeleted with correct detail including normalizedUrl and urlHash", async () => {
      // ALL_OLD returns pre-update item with normalizedUrl/urlHash
      mockUpdateItem.mockResolvedValueOnce(createSaveItem());

      const event = createDeleteEvent();
      await handler(event, mockContext);

      expect(mockEmitEvent).toHaveBeenCalledWith(
        expect.anything(),
        expect.any(String),
        expect.objectContaining({
          source: "ai-learning-hub.saves",
          detailType: "SaveDeleted",
          detail: expect.objectContaining({
            userId: "user123",
            saveId: VALID_SAVE_ID,
            normalizedUrl: "https://example.com/article",
            urlHash: "hash123",
          }),
        }),
        expect.anything()
      );
    });
  });

  describe("AC6: 404 when save does not exist or wrong user", () => {
    it("returns 404 with 'Save not found' when item is missing", async () => {
      // Conditional update fails (item does not exist)
      mockUpdateItem.mockRejectedValueOnce(
        new AppError(ErrorCode.NOT_FOUND, "Item not found")
      );
      // Disambiguation: getItem returns null (truly missing)
      mockGetItem.mockResolvedValueOnce(null);

      const event = createDeleteEvent();
      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(404);
      const body = JSON.parse(result.body);
      expect(body.error.code).toBe("NOT_FOUND");
      expect(body.error.message).toBe("Save not found");
    });
  });

  describe("AC8: Idempotent — already deleted returns 204", () => {
    it("returns 204 when save is already soft-deleted", async () => {
      // Conditional update fails (deletedAt exists)
      mockUpdateItem.mockRejectedValueOnce(
        new AppError(ErrorCode.NOT_FOUND, "Item not found")
      );
      // Disambiguation: getItem returns item with deletedAt set
      mockGetItem.mockResolvedValueOnce(
        createSaveItem({ deletedAt: "2026-02-21T00:00:00Z" })
      );

      const event = createDeleteEvent();
      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(204);
      expect(result.body).toBe("");
    });

    it("does NOT emit SaveDeleted event on idempotent delete", async () => {
      mockUpdateItem.mockRejectedValueOnce(
        new AppError(ErrorCode.NOT_FOUND, "Item not found")
      );
      mockGetItem.mockResolvedValueOnce(
        createSaveItem({ deletedAt: "2026-02-21T00:00:00Z" })
      );

      const event = createDeleteEvent();
      await handler(event, mockContext);

      expect(mockEmitEvent).not.toHaveBeenCalled();
    });
  });

  describe("Validation: invalid saveId format", () => {
    it("returns 400 for invalid saveId", async () => {
      const event = createDeleteEvent("invalid-id");
      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error.code).toBe("VALIDATION_ERROR");
    });
  });

  describe("Rate limiting", () => {
    it("enforces write rate limit", async () => {
      mockUpdateItem.mockResolvedValueOnce(createSaveItem());

      const event = createDeleteEvent();
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
        method: "DELETE",
        path: `/saves/${VALID_SAVE_ID}`,
        pathParameters: { saveId: VALID_SAVE_ID },
      });
      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(401);
    });
  });
});
