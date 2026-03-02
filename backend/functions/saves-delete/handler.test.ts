/**
 * Saves Delete handler tests — DELETE /saves/:saveId
 *
 * Story 3.3, Task 3: Tests for soft-delete save endpoint.
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

function createDeleteEvent(saveId: string = VALID_SAVE_ID, userId = "user123") {
  return createMockEvent({
    method: "DELETE",
    path: `/saves/${saveId}`,
    userId,
    pathParameters: { saveId },
  });
}

describe("Saves Delete Handler — DELETE /saves/:saveId", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("AC3: Soft delete sets deletedAt and returns 204", () => {
    it("returns 204 on successful soft delete", async () => {
      mockUpdateItem.mockResolvedValueOnce(
        createTestSaveItem(VALID_SAVE_ID, SAVE_OVERRIDES)
      );

      const event = createDeleteEvent();
      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(204);
      expect(result.body).toBe("");
    });

    it("passes correct update expression with deletedAt, updatedAt, and version increment", async () => {
      mockUpdateItem.mockResolvedValueOnce(
        createTestSaveItem(VALID_SAVE_ID, SAVE_OVERRIDES)
      );

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
      expect(callArgs.updateExpression).toContain("version = version + :one");
    });
  });

  describe("AC4: Emits SaveDeleted event on active → deleted", () => {
    it("emits SaveDeleted with correct detail", async () => {
      mockUpdateItem.mockResolvedValueOnce(
        createTestSaveItem(VALID_SAVE_ID, SAVE_OVERRIDES)
      );

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
      mockUpdateItem.mockRejectedValueOnce(
        new AppError(ErrorCode.NOT_FOUND, "Item not found")
      );
      mockGetItem.mockResolvedValueOnce(null);

      const event = createDeleteEvent();
      const result = await handler(event, mockContext);

      assertADR008Error(result, ErrorCode.NOT_FOUND, 404);
      const body = JSON.parse(result.body);
      expect(body.error.message).toBe("Save not found");
    });
  });

  describe("AC8: Idempotent — already deleted returns 204", () => {
    it("returns 204 when save is already soft-deleted", async () => {
      mockUpdateItem.mockRejectedValueOnce(
        new AppError(ErrorCode.NOT_FOUND, "Item not found")
      );
      mockGetItem.mockResolvedValueOnce(
        createTestSaveItem(VALID_SAVE_ID, {
          ...SAVE_OVERRIDES,
          deletedAt: "2026-02-21T00:00:00Z",
        })
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
        createTestSaveItem(VALID_SAVE_ID, {
          ...SAVE_OVERRIDES,
          deletedAt: "2026-02-21T00:00:00Z",
        })
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

      assertADR008Error(result, ErrorCode.VALIDATION_ERROR, 400);
    });
  });

  describe("Event history recording (Story 3.2.7)", () => {
    it("records SaveDeleted event on successful delete", async () => {
      mockUpdateItem.mockResolvedValueOnce(
        createTestSaveItem(VALID_SAVE_ID, SAVE_OVERRIDES)
      );

      const event = createDeleteEvent();
      await handler(event, mockContext);

      expect(mockRecordEvent).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          entityType: "save",
          entityId: VALID_SAVE_ID,
          eventType: "SaveDeleted",
          userId: "user123",
        }),
        expect.anything()
      );
    });

    it("does NOT record event on idempotent delete", async () => {
      mockUpdateItem.mockRejectedValueOnce(
        new AppError(ErrorCode.NOT_FOUND, "Item not found")
      );
      mockGetItem.mockResolvedValueOnce(
        createTestSaveItem(VALID_SAVE_ID, {
          ...SAVE_OVERRIDES,
          deletedAt: "2026-02-21T00:00:00Z",
        })
      );

      const event = createDeleteEvent();
      await handler(event, mockContext);

      expect(mockRecordEvent).not.toHaveBeenCalled();
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

      assertADR008Error(result, ErrorCode.UNAUTHORIZED, 401);
    });
  });

  describe("AC6: API key scope enforcement", () => {
    it("rejects capture-only key with 403 SCOPE_INSUFFICIENT", async () => {
      const event = createMockEvent({
        method: "DELETE",
        path: `/saves/${VALID_SAVE_ID}`,
        pathParameters: { saveId: VALID_SAVE_ID },
        userId: "user_123",
        authMethod: "api-key",
        scopes: ["capture"],
      });
      const result = await handler(event, mockContext);

      assertADR008Error(result, ErrorCode.SCOPE_INSUFFICIENT, 403);
    });

    it("allows full-access key (*) to DELETE /saves/:saveId", async () => {
      const existing = createTestSaveItem(VALID_SAVE_ID, SAVE_OVERRIDES);
      mockUpdateItem.mockResolvedValueOnce(existing);

      const event = createMockEvent({
        method: "DELETE",
        path: `/saves/${VALID_SAVE_ID}`,
        pathParameters: { saveId: VALID_SAVE_ID },
        userId: "user_123",
        authMethod: "api-key",
        scopes: ["*"],
      });
      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(204);
    });
  });
});
