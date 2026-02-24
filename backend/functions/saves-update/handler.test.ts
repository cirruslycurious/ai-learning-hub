/**
 * Saves Update handler tests — PATCH /saves/:saveId
 *
 * Story 3.3, Task 2: Tests for update save metadata endpoint.
 * Story 3.1.3: Migrated to shared test utilities.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { AppError, ErrorCode, ContentType } from "@ai-learning-hub/types";
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
const mockUpdateItem = vi.fn();
const mockEnforceRateLimit = vi.fn();

vi.mock("@ai-learning-hub/db", () =>
  mockDbModule({
    updateItem: (...args: unknown[]) => mockUpdateItem(...args),
    enforceRateLimit: (...args: unknown[]) => mockEnforceRateLimit(...args),
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

// Note: @ai-learning-hub/validation is NOT mocked — uses real implementation

import { handler } from "./handler.js";

const mockContext = createMockContext();

/** Fixed overrides to match original test assertions. */
const SAVE_OVERRIDES: Partial<SaveItem> = {
  url: "https://example.com/article",
  normalizedUrl: "https://example.com/article",
  urlHash: "hash123",
  tags: ["test"],
  updatedAt: "2026-02-23T00:00:00Z",
  title: "Updated Title",
};

function createUpdateEvent(
  body?: Record<string, unknown> | null,
  saveId: string = VALID_SAVE_ID,
  userId = "user123"
) {
  return createMockEvent({
    method: "PATCH",
    path: `/saves/${saveId}`,
    userId,
    body: body !== undefined ? body : { title: "Updated Title" },
    pathParameters: { saveId },
  });
}

describe("Saves Update Handler — PATCH /saves/:saveId", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEnforceRateLimit.mockResolvedValue(undefined);
  });

  describe("AC1: Updates specified fields, omitted fields unchanged", () => {
    it("returns 200 with updated save when title is changed", async () => {
      const updatedItem = createTestSaveItem(VALID_SAVE_ID, {
        ...SAVE_OVERRIDES,
        title: "New Title",
      });
      mockUpdateItem.mockResolvedValueOnce(updatedItem);

      const event = createUpdateEvent({ title: "New Title" });
      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.data.title).toBe("New Title");
      expect(body.data).not.toHaveProperty("PK");
      expect(body.data).not.toHaveProperty("SK");
      expect(body.data).not.toHaveProperty("deletedAt");
      // ADR-008: X-Request-Id header must be present on all responses
      expect(result.headers?.["X-Request-Id"]).toBe("test-req-id");
    });

    it("only updates provided fields in DynamoDB expression", async () => {
      const updatedItem = createTestSaveItem(VALID_SAVE_ID, {
        ...SAVE_OVERRIDES,
        userNotes: "My notes",
      });
      mockUpdateItem.mockResolvedValueOnce(updatedItem);

      const event = createUpdateEvent({ userNotes: "My notes" });
      await handler(event, mockContext);

      expect(mockUpdateItem).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.objectContaining({
          key: { PK: "USER#user123", SK: `SAVE#${VALID_SAVE_ID}` },
        }),
        expect.anything()
      );

      // Verify the update expression includes userNotes and updatedAt
      const callArgs = mockUpdateItem.mock.calls[0][2];
      expect(callArgs.updateExpression).toContain("userNotes");
      expect(callArgs.updateExpression).toContain("updatedAt");
    });

    it("updates multiple fields at once", async () => {
      const updatedItem = createTestSaveItem(VALID_SAVE_ID, {
        ...SAVE_OVERRIDES,
        title: "New Title",
        userNotes: "New notes",
        tags: ["tag1", "tag2"],
      });
      mockUpdateItem.mockResolvedValueOnce(updatedItem);

      const event = createUpdateEvent({
        title: "New Title",
        userNotes: "New notes",
        tags: ["tag1", "tag2"],
      });
      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.data.title).toBe("New Title");
      expect(body.data.userNotes).toBe("New notes");
      expect(body.data.tags).toEqual(["tag1", "tag2"]);
    });
  });

  describe("AC2: Emits SaveUpdated event with correct detail", () => {
    it("emits SaveUpdated with updatedFields list", async () => {
      const updatedItem = createTestSaveItem(VALID_SAVE_ID, {
        ...SAVE_OVERRIDES,
        title: "New Title",
      });
      mockUpdateItem.mockResolvedValueOnce(updatedItem);

      const event = createUpdateEvent({ title: "New Title" });
      await handler(event, mockContext);

      expect(mockEmitEvent).toHaveBeenCalledWith(
        expect.anything(),
        expect.any(String),
        expect.objectContaining({
          source: "ai-learning-hub.saves",
          detailType: "SaveUpdated",
          detail: expect.objectContaining({
            userId: "user123",
            saveId: VALID_SAVE_ID,
            normalizedUrl: "https://example.com/article",
            urlHash: "hash123",
            updatedFields: ["title"],
          }),
        }),
        expect.anything()
      );
    });

    it("lists all updated fields in the event detail", async () => {
      const updatedItem = createTestSaveItem(VALID_SAVE_ID, {
        ...SAVE_OVERRIDES,
        title: "New Title",
        contentType: ContentType.VIDEO,
      });
      mockUpdateItem.mockResolvedValueOnce(updatedItem);

      const event = createUpdateEvent({
        title: "New Title",
        contentType: "video",
      });
      await handler(event, mockContext);

      const emitCall = mockEmitEvent.mock.calls[0][2];
      expect(emitCall.detail.updatedFields).toEqual(
        expect.arrayContaining(["title", "contentType"])
      );
    });
  });

  describe("AC5: 404 when save does not exist or wrong user", () => {
    it("returns 404 with 'Save not found' when save does not exist", async () => {
      mockUpdateItem.mockRejectedValueOnce(
        new AppError(ErrorCode.NOT_FOUND, "Item not found")
      );

      const event = createUpdateEvent({ title: "Test" });
      const result = await handler(event, mockContext);

      assertADR008Error(result, ErrorCode.NOT_FOUND, 404);
      const body = JSON.parse(result.body);
      expect(body.error.message).toBe("Save not found");
    });
  });

  describe("AC7: 404 when save is soft-deleted", () => {
    it("returns 404 for soft-deleted save (condition fails)", async () => {
      // ConditionExpression includes attribute_not_exists(deletedAt)
      mockUpdateItem.mockRejectedValueOnce(
        new AppError(ErrorCode.NOT_FOUND, "Item not found")
      );

      const event = createUpdateEvent({ title: "Test" });
      const result = await handler(event, mockContext);

      assertADR008Error(result, ErrorCode.NOT_FOUND, 404);
      const body = JSON.parse(result.body);
      expect(body.error.message).toBe("Save not found");
    });
  });

  describe("AC9: Validation errors", () => {
    it("returns 400 for empty body", async () => {
      const event = createUpdateEvent({});
      const result = await handler(event, mockContext);

      assertADR008Error(result, ErrorCode.VALIDATION_ERROR, 400);
    });

    it("returns 400 for title too long", async () => {
      const event = createUpdateEvent({ title: "x".repeat(501) });
      const result = await handler(event, mockContext);

      assertADR008Error(result, ErrorCode.VALIDATION_ERROR, 400);
    });

    it("returns 400 for too many tags", async () => {
      const tags = Array.from({ length: 21 }, (_, i) => `tag-${i}`);
      const event = createUpdateEvent({ tags });
      const result = await handler(event, mockContext);

      assertADR008Error(result, ErrorCode.VALIDATION_ERROR, 400);
    });

    it("returns 400 for invalid saveId format", async () => {
      const event = createUpdateEvent({ title: "Test" }, "invalid-id");
      const result = await handler(event, mockContext);

      assertADR008Error(result, ErrorCode.VALIDATION_ERROR, 400);
    });

    it("returns 400 for empty title string", async () => {
      const event = createUpdateEvent({ title: "" });
      const result = await handler(event, mockContext);

      assertADR008Error(result, ErrorCode.VALIDATION_ERROR, 400);
    });
  });

  describe("Rate limiting", () => {
    it("enforces rate limit before processing", async () => {
      const updatedItem = createTestSaveItem(VALID_SAVE_ID, SAVE_OVERRIDES);
      mockUpdateItem.mockResolvedValueOnce(updatedItem);

      const event = createUpdateEvent({ title: "Test" });
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
        method: "PATCH",
        path: `/saves/${VALID_SAVE_ID}`,
        body: { title: "Test" },
        pathParameters: { saveId: VALID_SAVE_ID },
      });
      const result = await handler(event, mockContext);

      assertADR008Error(result, ErrorCode.UNAUTHORIZED, 401);
    });
  });

  describe("Conditional write includes attribute_not_exists(deletedAt)", () => {
    it("passes correct condition expression to updateItem", async () => {
      const updatedItem = createTestSaveItem(VALID_SAVE_ID, SAVE_OVERRIDES);
      mockUpdateItem.mockResolvedValueOnce(updatedItem);

      const event = createUpdateEvent({ title: "Test" });
      await handler(event, mockContext);

      const callArgs = mockUpdateItem.mock.calls[0][2];
      expect(callArgs.conditionExpression).toBe(
        "attribute_exists(PK) AND attribute_not_exists(deletedAt)"
      );
    });
  });

  // ──────────────────────────────────────────────────────────────
  // Story 3.1.7 — API key scope enforcement tests
  // ──────────────────────────────────────────────────────────────

  describe("AC6: API key scope enforcement", () => {
    it("rejects capture-only key (saves:write) with 403 SCOPE_INSUFFICIENT", async () => {
      const event = createMockEvent({
        method: "PATCH",
        path: `/saves/${VALID_SAVE_ID}`,
        pathParameters: { saveId: VALID_SAVE_ID },
        body: { title: "Updated" },
        userId: "user_123",
        authMethod: "api-key",
        scopes: ["saves:write"],
      });
      const result = await handler(event, mockContext);

      assertADR008Error(result, ErrorCode.SCOPE_INSUFFICIENT, 403);
    });

    it("allows full-access key (*) to PATCH /saves/:saveId", async () => {
      const updated = createTestSaveItem(VALID_SAVE_ID, SAVE_OVERRIDES);
      mockUpdateItem.mockResolvedValueOnce(updated);

      const event = createMockEvent({
        method: "PATCH",
        path: `/saves/${VALID_SAVE_ID}`,
        pathParameters: { saveId: VALID_SAVE_ID },
        body: { title: "Updated" },
        userId: "user_123",
        authMethod: "api-key",
        scopes: ["*"],
      });
      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(200);
    });
  });
});
