/**
 * Saves Update handler tests — PATCH /saves/:saveId
 *
 * Story 3.3, Task 2: Tests for update save metadata endpoint.
 * Story 3.1.3: Migrated to shared test utilities.
 * Story 3.2.7: Retrofitted with optimistic concurrency (If-Match),
 *              event history recording, version increment.
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
  version: 1,
};

function createUpdateEvent(
  body?: Record<string, unknown> | null,
  saveId: string = VALID_SAVE_ID,
  userId = "user123",
  version = 1
) {
  return createMockEvent({
    method: "PATCH",
    path: `/saves/${saveId}`,
    userId,
    body: body !== undefined ? body : { title: "Updated Title" },
    pathParameters: { saveId },
    headers: { "If-Match": String(version) },
  });
}

describe("Saves Update Handler — PATCH /saves/:saveId", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: pre-read returns existing item
    mockGetItem.mockResolvedValue(
      createTestSaveItem(VALID_SAVE_ID, SAVE_OVERRIDES)
    );
  });

  describe("AC1: Updates specified fields, omitted fields unchanged", () => {
    it("returns 200 with updated save when title is changed", async () => {
      const updatedItem = createTestSaveItem(VALID_SAVE_ID, {
        ...SAVE_OVERRIDES,
        title: "New Title",
        version: 2,
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

    it("pre-reads item for existence check and before snapshot", async () => {
      const updatedItem = createTestSaveItem(VALID_SAVE_ID, {
        ...SAVE_OVERRIDES,
        userNotes: "My notes",
        version: 2,
      });
      mockUpdateItem.mockResolvedValueOnce(updatedItem);

      const event = createUpdateEvent({ userNotes: "My notes" });
      await handler(event, mockContext);

      // getItem called with consistent read
      expect(mockGetItem).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        { PK: "USER#user123", SK: `SAVE#${VALID_SAVE_ID}` },
        { consistentRead: true },
        expect.anything()
      );
    });

    it("updates multiple fields at once", async () => {
      const updatedItem = createTestSaveItem(VALID_SAVE_ID, {
        ...SAVE_OVERRIDES,
        title: "New Title",
        userNotes: "New notes",
        tags: ["tag1", "tag2"],
        version: 2,
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
        version: 2,
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
        version: 2,
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
    it("returns 404 with 'Save not found' when pre-read finds nothing", async () => {
      mockGetItem.mockResolvedValueOnce(null);

      const event = createUpdateEvent({ title: "Test" });
      const result = await handler(event, mockContext);

      assertADR008Error(result, ErrorCode.NOT_FOUND, 404);
      const body = JSON.parse(result.body);
      expect(body.error.message).toBe("Save not found");
    });
  });

  describe("AC7: 404 when save is soft-deleted", () => {
    it("returns 404 for soft-deleted save (pre-read has deletedAt)", async () => {
      mockGetItem.mockResolvedValueOnce(
        createTestSaveItem(VALID_SAVE_ID, {
          ...SAVE_OVERRIDES,
          deletedAt: "2026-02-21T00:00:00Z",
        })
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

  describe("Optimistic concurrency (Story 3.2.7)", () => {
    it("returns 428 when If-Match header is missing", async () => {
      const event = createMockEvent({
        method: "PATCH",
        path: `/saves/${VALID_SAVE_ID}`,
        userId: "user123",
        body: { title: "Test" },
        pathParameters: { saveId: VALID_SAVE_ID },
      });
      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(428);
      const body = JSON.parse(result.body);
      expect(body.error.code).toBe("PRECONDITION_REQUIRED");
    });

    it("passes version condition expression to updateItem", async () => {
      const updatedItem = createTestSaveItem(VALID_SAVE_ID, {
        ...SAVE_OVERRIDES,
        version: 2,
      });
      mockUpdateItem.mockResolvedValueOnce(updatedItem);

      const event = createUpdateEvent({ title: "Test" });
      await handler(event, mockContext);

      const callArgs = mockUpdateItem.mock.calls[0][2];
      expect(callArgs.conditionExpression).toBe(
        "attribute_exists(PK) AND attribute_not_exists(deletedAt) AND version = :expectedVersion"
      );
    });

    it("returns 409 VERSION_CONFLICT when condition check fails", async () => {
      mockUpdateItem.mockRejectedValueOnce(
        new AppError(ErrorCode.NOT_FOUND, "Item not found")
      );

      const event = createUpdateEvent({ title: "Test" });
      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(409);
      const body = JSON.parse(result.body);
      expect(body.error.code).toBe("VERSION_CONFLICT");
    });
  });

  describe("Event history recording (Story 3.2.7)", () => {
    it("records SaveMetadataUpdated event with field-level changes", async () => {
      const updatedItem = createTestSaveItem(VALID_SAVE_ID, {
        ...SAVE_OVERRIDES,
        title: "New Title",
        version: 2,
      });
      mockUpdateItem.mockResolvedValueOnce(updatedItem);

      const event = createUpdateEvent({ title: "New Title" });
      await handler(event, mockContext);

      expect(mockRecordEvent).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          entityType: "save",
          entityId: VALID_SAVE_ID,
          eventType: "SaveMetadataUpdated",
          changes: expect.objectContaining({
            changedFields: ["title"],
            before: expect.objectContaining({ title: "Updated Title" }),
            after: expect.objectContaining({ title: "New Title" }),
          }),
        }),
        expect.anything()
      );
    });

    // Note: recordEvent() is internally fire-and-forget for I/O errors.
    // No handler-level try/catch needed — validation errors propagate (by design).
  });

  describe("Authentication", () => {
    it("returns 401 when not authenticated", async () => {
      const event = createMockEvent({
        method: "PATCH",
        path: `/saves/${VALID_SAVE_ID}`,
        body: { title: "Test" },
        pathParameters: { saveId: VALID_SAVE_ID },
        headers: { "If-Match": "1" },
      });
      const result = await handler(event, mockContext);

      assertADR008Error(result, ErrorCode.UNAUTHORIZED, 401);
    });
  });

  // ──────────────────────────────────────────────────────────────
  // Story 3.1.7 — API key scope enforcement tests
  // ──────────────────────────────────────────────────────────────

  describe("AC6: API key scope enforcement", () => {
    it("rejects capture-only key with 403 SCOPE_INSUFFICIENT", async () => {
      const event = createMockEvent({
        method: "PATCH",
        path: `/saves/${VALID_SAVE_ID}`,
        pathParameters: { saveId: VALID_SAVE_ID },
        body: { title: "Updated" },
        userId: "user_123",
        authMethod: "api-key",
        scopes: ["capture"],
        headers: { "If-Match": "1" },
      });
      const result = await handler(event, mockContext);

      assertADR008Error(result, ErrorCode.SCOPE_INSUFFICIENT, 403);
    });

    it("allows full-access key (*) to PATCH /saves/:saveId", async () => {
      const updated = createTestSaveItem(VALID_SAVE_ID, {
        ...SAVE_OVERRIDES,
        version: 2,
      });
      mockUpdateItem.mockResolvedValueOnce(updated);

      const event = createMockEvent({
        method: "PATCH",
        path: `/saves/${VALID_SAVE_ID}`,
        pathParameters: { saveId: VALID_SAVE_ID },
        body: { title: "Updated" },
        userId: "user_123",
        authMethod: "api-key",
        scopes: ["*"],
        headers: { "If-Match": "1" },
      });
      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(200);
    });
  });
});
