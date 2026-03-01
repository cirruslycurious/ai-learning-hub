/**
 * Saves Restore handler tests — POST /saves/:saveId/restore
 *
 * Story 3.3, Task 4: Tests for restore (undo delete) endpoint.
 * Story 3.1.3: Migrated to shared test utilities.
 * Story 3.2.7: Retrofitted with version increment, event recording.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { AppError, ErrorCode } from "@ai-learning-hub/types";
import type { SaveItem } from "@ai-learning-hub/types";
import {
  createMockEvent,
  createMockContext,
  mockCreateLoggerModule,
  mockMiddlewareModule,
  mockDbModule,
  mockEventsModule,
  createTestSaveItem,
  VALID_SAVE_ID,
  assertADR008Error,
} from "../../test-utils/index.js";

// Mock @ai-learning-hub/db — using shared mockDbModule with handler-specific mocks
const mockGetItem = vi.fn();
const mockUpdateItem = vi.fn();
const mockRecordEvent = vi.fn().mockResolvedValue(undefined);

vi.mock("@ai-learning-hub/db", () =>
  mockDbModule({
    getItem: (...args: unknown[]) => mockGetItem(...args),
    updateItem: (...args: unknown[]) => mockUpdateItem(...args),
    recordEvent: (...args: unknown[]) => mockRecordEvent(...args),
  })
);

// Mock @ai-learning-hub/logging
vi.mock("@ai-learning-hub/logging", () => mockCreateLoggerModule());

// Mock @ai-learning-hub/middleware
vi.mock("@ai-learning-hub/middleware", () => mockMiddlewareModule());

// Mock @ai-learning-hub/events — using shared mockEventsModule
const mockEmitEvent = vi.fn();

vi.mock("@ai-learning-hub/events", () =>
  mockEventsModule({
    emitEvent: (...args: unknown[]) => mockEmitEvent(...args),
  })
);

import { handler } from "./handler.js";

const mockContext = createMockContext();

/** Fixed overrides to match original test assertions. */
const SAVE_OVERRIDES: Partial<SaveItem> = {
  url: "https://example.com/article",
  normalizedUrl: "https://example.com/article",
  urlHash: "hash123",
  tags: ["test"],
};

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

describe("Saves Restore Handler — POST /saves/:saveId/restore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("AC10: Restore soft-deleted save", () => {
    it("returns 200 with restored save when deletedAt is cleared", async () => {
      const restoredItem = createTestSaveItem(VALID_SAVE_ID, {
        ...SAVE_OVERRIDES,
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

    it("passes correct update expression to remove deletedAt and increment version", async () => {
      const restoredItem = createTestSaveItem(VALID_SAVE_ID, SAVE_OVERRIDES);
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
      expect(callArgs.updateExpression).toContain("version = version + :one");
    });
  });

  describe("AC11: Idempotent — already active returns 200", () => {
    it("returns 200 with current save when already active", async () => {
      mockUpdateItem.mockRejectedValueOnce(
        new AppError(ErrorCode.NOT_FOUND, "Item not found")
      );
      const activeItem = createTestSaveItem(VALID_SAVE_ID, SAVE_OVERRIDES);
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
      mockGetItem.mockResolvedValueOnce(
        createTestSaveItem(VALID_SAVE_ID, SAVE_OVERRIDES)
      );

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

      assertADR008Error(result, ErrorCode.NOT_FOUND, 404);
      const body = JSON.parse(result.body);
      expect(body.error.message).toBe("Save not found");
    });
  });

  describe("AC13: Emits SaveRestored event on deleted → active", () => {
    it("emits SaveRestored with correct detail", async () => {
      const restoredItem = createTestSaveItem(VALID_SAVE_ID, SAVE_OVERRIDES);
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

      assertADR008Error(result, ErrorCode.VALIDATION_ERROR, 400);
    });
  });

  describe("Event history recording (Story 3.2.7)", () => {
    it("records SaveRestored event on successful restore", async () => {
      const restoredItem = createTestSaveItem(VALID_SAVE_ID, SAVE_OVERRIDES);
      mockUpdateItem.mockResolvedValueOnce(restoredItem);

      const event = createRestoreEvent();
      await handler(event, mockContext);

      expect(mockRecordEvent).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          entityType: "save",
          entityId: VALID_SAVE_ID,
          eventType: "SaveRestored",
          userId: "user123",
        }),
        expect.anything()
      );
    });

    it("does NOT record event when already active (idempotent)", async () => {
      mockUpdateItem.mockRejectedValueOnce(
        new AppError(ErrorCode.NOT_FOUND, "Item not found")
      );
      mockGetItem.mockResolvedValueOnce(
        createTestSaveItem(VALID_SAVE_ID, SAVE_OVERRIDES)
      );

      const event = createRestoreEvent();
      await handler(event, mockContext);

      expect(mockRecordEvent).not.toHaveBeenCalled();
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

      assertADR008Error(result, ErrorCode.UNAUTHORIZED, 401);
    });
  });

  describe("AC6: API key scope enforcement", () => {
    it("rejects capture-only key with 403 SCOPE_INSUFFICIENT", async () => {
      const event = createMockEvent({
        method: "POST",
        path: `/saves/${VALID_SAVE_ID}/restore`,
        pathParameters: { saveId: VALID_SAVE_ID },
        userId: "user_123",
        authMethod: "api-key",
        scopes: ["capture"],
      });
      const result = await handler(event, mockContext);

      assertADR008Error(result, ErrorCode.SCOPE_INSUFFICIENT, 403);
    });

    it("allows saves:write key to POST /saves/:saveId/restore", async () => {
      const restoredItem = createTestSaveItem(VALID_SAVE_ID, SAVE_OVERRIDES);
      mockUpdateItem.mockResolvedValueOnce(restoredItem);

      const event = createMockEvent({
        method: "POST",
        path: `/saves/${VALID_SAVE_ID}/restore`,
        pathParameters: { saveId: VALID_SAVE_ID },
        userId: "user_123",
        authMethod: "api-key",
        scopes: ["saves:write"],
      });
      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(200);
    });

    it("allows full-access key (*) to POST /saves/:saveId/restore", async () => {
      const restoredItem = createTestSaveItem(VALID_SAVE_ID, SAVE_OVERRIDES);
      mockUpdateItem.mockResolvedValueOnce(restoredItem);

      const event = createMockEvent({
        method: "POST",
        path: `/saves/${VALID_SAVE_ID}/restore`,
        pathParameters: { saveId: VALID_SAVE_ID },
        userId: "user_123",
        authMethod: "api-key",
        scopes: ["*"],
      });
      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(200);
    });
  });
});
