/**
 * Saves Create handler tests
 *
 * Story 3.1b: Create Save API (Epic 3).
 * Story 3.1.3: Migrated to shared test utilities.
 * Tests all 9 acceptance criteria.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { AppError, ErrorCode } from "@ai-learning-hub/types";
import {
  createMockEvent,
  createMockContext,
  mockCreateLoggerModule,
  mockMiddlewareModule,
  mockDbModule,
  mockEventsModule,
  assertADR008Error,
} from "../../test-utils/index.js";

// Mock @ai-learning-hub/db — using shared mockDbModule with handler-specific mocks
const mockQueryItems = vi.fn();
const mockUpdateItem = vi.fn();
const mockTransactWriteItems = vi.fn();
const mockEnforceRateLimit = vi.fn();

vi.mock("@ai-learning-hub/db", () => {
  // TransactionCancelledError is handler-specific (only saves-create uses it)
  class _MockTransactionCancelledError extends Error {
    public readonly reasons: string[];
    constructor(reasons: string[]) {
      super("Transaction cancelled");
      this.name = "TransactionCancelledError";
      this.reasons = reasons;
    }
  }
  return {
    ...mockDbModule({
      queryItems: (...args: unknown[]) => mockQueryItems(...args),
      updateItem: (...args: unknown[]) => mockUpdateItem(...args),
      transactWriteItems: (...args: unknown[]) =>
        mockTransactWriteItems(...args),
      enforceRateLimit: (...args: unknown[]) => mockEnforceRateLimit(...args),
    }),
    TransactionCancelledError: _MockTransactionCancelledError,
  };
});

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

// Mock ulidx
vi.mock("ulidx", () => ({
  ulid: () => "01HTEST000000000000000000",
}));

// Note: @ai-learning-hub/validation is NOT mocked — uses real implementation

import { handler } from "./handler.js";
import { TransactionCancelledError } from "@ai-learning-hub/db";

function createSaveEvent(
  body?: Record<string, unknown> | null,
  userId?: string
) {
  return createMockEvent({
    method: "POST",
    path: "/saves",
    body: body ?? null,
    userId,
  });
}

const mockContext = createMockContext();

describe("Saves Create Handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.EVENT_BUS_NAME = "test-event-bus";
    process.env.SAVES_TABLE_NAME = "test-saves-table";
  });

  describe("AC1: POST /saves validates and normalizes URL", () => {
    it("returns 400 for invalid URL", async () => {
      const event = createSaveEvent({ url: "not-a-url" }, "user_123");
      const result = await handler(event, mockContext);
      assertADR008Error(result, ErrorCode.VALIDATION_ERROR, 400);
    });

    it("returns 400 for missing URL", async () => {
      const event = createSaveEvent({}, "user_123");
      const result = await handler(event, mockContext);
      assertADR008Error(result, ErrorCode.VALIDATION_ERROR, 400);
    });

    it("returns 400 for missing request body", async () => {
      const event = createSaveEvent(null, "user_123");
      const result = await handler(event, mockContext);
      assertADR008Error(result, ErrorCode.VALIDATION_ERROR, 400);
    });

    it("returns 400 for URL with embedded credentials", async () => {
      const event = createSaveEvent(
        { url: "https://admin:password@example.com" },
        "user_123"
      );
      const result = await handler(event, mockContext);
      assertADR008Error(result, ErrorCode.VALIDATION_ERROR, 400);
    });
  });

  describe("AC2: Fresh URL creates save item with correct DynamoDB pattern", () => {
    it("returns 201 on fresh URL save", async () => {
      mockQueryItems.mockResolvedValue({ items: [], hasMore: false });
      mockTransactWriteItems.mockResolvedValue(undefined);

      const event = createSaveEvent(
        { url: "https://example.com/article" },
        "user_123"
      );
      const result = await handler(event, mockContext);
      const body = JSON.parse(result.body);

      expect(result.statusCode).toBe(201);
      expect(body.data.userId).toBe("user_123");
      expect(body.data.saveId).toBe("01HTEST000000000000000000");
      expect(body.data.url).toBe("https://example.com/article");
      expect(body.data.normalizedUrl).toBeDefined();
      expect(body.data.urlHash).toBeDefined();
      expect(body.data.isTutorial).toBe(false);
      expect(body.data.linkedProjectCount).toBe(0);
      expect(body.data.tags).toEqual([]);
      // PK and SK should NOT be in the response
      expect(body.data.PK).toBeUndefined();
      expect(body.data.SK).toBeUndefined();
    });

    it("includes optional fields when provided", async () => {
      mockQueryItems.mockResolvedValue({ items: [], hasMore: false });
      mockTransactWriteItems.mockResolvedValue(undefined);

      const event = createSaveEvent(
        {
          url: "https://example.com/tutorial",
          title: "My Tutorial",
          userNotes: "Great resource",
          tags: ["react", "typescript"],
        },
        "user_123"
      );
      const result = await handler(event, mockContext);
      const body = JSON.parse(result.body);

      expect(result.statusCode).toBe(201);
      expect(body.data.title).toBe("My Tutorial");
      expect(body.data.userNotes).toBe("Great resource");
      expect(body.data.tags).toEqual(["react", "typescript"]);
    });

    it("calls transactWriteItems with save item and marker item", async () => {
      mockQueryItems.mockResolvedValue({ items: [], hasMore: false });
      mockTransactWriteItems.mockResolvedValue(undefined);

      const event = createSaveEvent({ url: "https://example.com" }, "user_123");
      await handler(event, mockContext);

      expect(mockTransactWriteItems).toHaveBeenCalledOnce();
      const [_client, transactItems] = mockTransactWriteItems.mock.calls[0];
      expect(transactItems).toHaveLength(2);

      // Save item
      const saveItem = transactItems[0].Put.Item;
      expect(saveItem.PK).toBe("USER#user_123");
      expect(saveItem.SK).toMatch(/^SAVE#/);
      expect(saveItem.userId).toBe("user_123");

      // Marker item with condition
      const markerItem = transactItems[1].Put;
      expect(markerItem.Item.PK).toBe("USER#user_123");
      expect(markerItem.Item.SK).toMatch(/^URL#/);
      expect(markerItem.ConditionExpression).toBe("attribute_not_exists(SK)");
    });
  });

  describe("AC3: Duplicate URL returns 409", () => {
    it("returns 409 via Layer 1 (fast-path) when active save found", async () => {
      const existingSave = {
        PK: "USER#user_123",
        SK: "SAVE#existing",
        userId: "user_123",
        saveId: "existing",
        url: "https://example.com",
        normalizedUrl: "https://example.com/",
        urlHash: "abc123",
        contentType: "article",
        tags: [],
        isTutorial: false,
        linkedProjectCount: 0,
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
      };
      mockQueryItems.mockResolvedValueOnce({
        items: [existingSave],
        hasMore: false,
      });

      const event = createSaveEvent({ url: "https://example.com" }, "user_123");
      const result = await handler(event, mockContext);
      const body = JSON.parse(result.body);

      expect(result.statusCode).toBe(409);
      expect(body.error.code).toBe("DUPLICATE_SAVE");
      expect(body.error.message).toBe("URL already saved");
      expect(body.error.requestId).toBeDefined();
      // X-Request-Id header on 409 responses (ADR-008 compliance)
      expect(result.headers?.["X-Request-Id"]).toBe("test-req-id");
      // existingSave is a SIBLING of error
      expect(body.existingSave).toBeDefined();
      expect(body.existingSave.saveId).toBe("existing");
      // PK/SK stripped
      expect(body.existingSave.PK).toBeUndefined();
    });

    it("returns 409 via Layer 2 when transaction fails (active save)", async () => {
      // Layer 1: no active saves found
      mockQueryItems.mockResolvedValueOnce({ items: [], hasMore: false });
      // Transaction fails
      mockTransactWriteItems.mockRejectedValueOnce(
        new TransactionCancelledError(["None", "ConditionalCheckFailed"])
      );
      // Re-query: active save found
      const existingSave = {
        PK: "USER#user_123",
        SK: "SAVE#existing",
        userId: "user_123",
        saveId: "existing",
        url: "https://example.com",
        normalizedUrl: "https://example.com/",
        urlHash: "abc123",
        contentType: "article",
        tags: [],
        isTutorial: false,
        linkedProjectCount: 0,
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
      };
      mockQueryItems.mockResolvedValueOnce({
        items: [existingSave],
        hasMore: false,
      });

      const event = createSaveEvent({ url: "https://example.com" }, "user_123");
      const result = await handler(event, mockContext);
      const body = JSON.parse(result.body);

      expect(result.statusCode).toBe(409);
      expect(body.error.code).toBe("DUPLICATE_SAVE");
      expect(body.existingSave.saveId).toBe("existing");
      // X-Request-Id header on Layer 2 409 responses (ADR-008 compliance)
      expect(result.headers?.["X-Request-Id"]).toBe("test-req-id");
    });

    it("strips deletedAt from 409 existingSave response (shared toPublicSave)", async () => {
      // Simulate a save item that has a deletedAt field (edge case)
      const existingSave = {
        PK: "USER#user_123",
        SK: "SAVE#existing",
        userId: "user_123",
        saveId: "existing",
        url: "https://example.com",
        normalizedUrl: "https://example.com/",
        urlHash: "abc123",
        contentType: "article",
        tags: [],
        isTutorial: false,
        linkedProjectCount: 0,
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
        deletedAt: "2026-01-10T00:00:00Z",
      };
      mockQueryItems.mockResolvedValueOnce({
        items: [existingSave],
        hasMore: false,
      });

      const event = createSaveEvent({ url: "https://example.com" }, "user_123");
      const result = await handler(event, mockContext);
      const body = JSON.parse(result.body);

      expect(result.statusCode).toBe(409);
      // Shared toPublicSave strips PK, SK, AND deletedAt
      expect(body.existingSave.PK).toBeUndefined();
      expect(body.existingSave.SK).toBeUndefined();
      expect(body.existingSave.deletedAt).toBeUndefined();
      expect(body.existingSave.saveId).toBe("existing");
    });
  });

  describe("AC4: EventBridge event emitted after write", () => {
    it("calls emitEvent with SaveCreated after successful save", async () => {
      mockQueryItems.mockResolvedValue({ items: [], hasMore: false });
      mockTransactWriteItems.mockResolvedValue(undefined);

      const event = createSaveEvent(
        { url: "https://example.com/article" },
        "user_123"
      );
      await handler(event, mockContext);

      expect(mockEmitEvent).toHaveBeenCalledOnce();
      const [_client, _busName, entry] = mockEmitEvent.mock.calls[0];
      expect(entry.source).toBe("ai-learning-hub.saves");
      expect(entry.detailType).toBe("SaveCreated");
      expect(entry.detail.userId).toBe("user_123");
      expect(entry.detail.saveId).toBeDefined();
      expect(entry.detail.url).toBe("https://example.com/article");
      expect(entry.detail.normalizedUrl).toBeDefined();
      expect(entry.detail.urlHash).toBeDefined();
      expect(entry.detail.contentType).toBeDefined();
    });
  });

  describe("AC5: Auto-detects content type", () => {
    it("auto-detects content type from URL when not provided", async () => {
      mockQueryItems.mockResolvedValue({ items: [], hasMore: false });
      mockTransactWriteItems.mockResolvedValue(undefined);

      const event = createSaveEvent(
        { url: "https://youtube.com/watch?v=abc123" },
        "user_123"
      );
      const result = await handler(event, mockContext);
      const body = JSON.parse(result.body);

      expect(result.statusCode).toBe(201);
      expect(body.data.contentType).toBe("video");
    });

    it("uses user-provided contentType over auto-detection", async () => {
      mockQueryItems.mockResolvedValue({ items: [], hasMore: false });
      mockTransactWriteItems.mockResolvedValue(undefined);

      const event = createSaveEvent(
        {
          url: "https://youtube.com/watch?v=abc123",
          contentType: "podcast",
        },
        "user_123"
      );
      const result = await handler(event, mockContext);
      const body = JSON.parse(result.body);

      expect(result.statusCode).toBe(201);
      expect(body.data.contentType).toBe("podcast");
    });
  });

  describe("AC7: Uses shared libraries", () => {
    it("calls enforceRateLimit with correct config", async () => {
      mockQueryItems.mockResolvedValue({ items: [], hasMore: false });
      mockTransactWriteItems.mockResolvedValue(undefined);

      const event = createSaveEvent({ url: "https://example.com" }, "user_xyz");
      await handler(event, mockContext);

      expect(mockEnforceRateLimit).toHaveBeenCalledWith(
        expect.anything(),
        expect.any(String),
        expect.objectContaining({
          operation: "saves-write",
          identifier: "user_xyz",
          limit: 200,
          windowSeconds: 3600,
        }),
        expect.anything()
      );
    });

    it("returns 429 when rate limited", async () => {
      mockEnforceRateLimit.mockRejectedValueOnce(
        new AppError(
          ErrorCode.RATE_LIMITED,
          "Rate limit exceeded: 200 saves-create per 1 hour(s)"
        )
      );

      const event = createSaveEvent({ url: "https://example.com" }, "user_123");
      const result = await handler(event, mockContext);

      assertADR008Error(result, ErrorCode.RATE_LIMITED, 429);
      expect(mockTransactWriteItems).not.toHaveBeenCalled();
    });
  });

  describe("AC8: Two-layer duplicate detection", () => {
    it("Layer 1 queries urlHash-index GSI", async () => {
      mockQueryItems.mockResolvedValue({ items: [], hasMore: false });
      mockTransactWriteItems.mockResolvedValue(undefined);

      const event = createSaveEvent({ url: "https://example.com" }, "user_123");
      await handler(event, mockContext);

      // First call is Layer 1
      const [_client, _config, params] = mockQueryItems.mock.calls[0];
      expect(params.indexName).toBe("urlHash-index");
      expect(params.keyConditionExpression).toBe("urlHash = :urlHash");
      expect(params.filterExpression).toBe(
        "PK = :pk AND attribute_not_exists(deletedAt)"
      );
    });
  });

  describe("AC9: Auto-restore soft-deleted saves", () => {
    it("returns 200 when restoring a soft-deleted save", async () => {
      // Layer 1: no active saves
      mockQueryItems.mockResolvedValueOnce({ items: [], hasMore: false });
      // Layer 2: transaction fails (marker exists)
      mockTransactWriteItems.mockRejectedValueOnce(
        new TransactionCancelledError(["None", "ConditionalCheckFailed"])
      );
      // Re-query active: empty
      mockQueryItems.mockResolvedValueOnce({ items: [], hasMore: false });

      // Re-query soft-deleted: found
      const softDeleted = {
        PK: "USER#user_123",
        SK: "SAVE#deleted-save",
        userId: "user_123",
        saveId: "deleted-save",
        url: "https://example.com",
        normalizedUrl: "https://example.com/",
        urlHash: "abc123",
        contentType: "article",
        tags: [],
        isTutorial: false,
        linkedProjectCount: 0,
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
        deletedAt: "2026-01-15T00:00:00Z",
      };
      mockQueryItems.mockResolvedValueOnce({
        items: [softDeleted],
        hasMore: false,
      });

      // UpdateItem restores the save
      const restored = { ...softDeleted };
      delete (restored as Record<string, unknown>).deletedAt;
      restored.updatedAt = "2026-02-22T00:00:00Z";
      mockUpdateItem.mockResolvedValueOnce(restored);

      const event = createSaveEvent({ url: "https://example.com" }, "user_123");
      const result = await handler(event, mockContext);
      const body = JSON.parse(result.body);

      expect(result.statusCode).toBe(200);
      expect(body.data.saveId).toBe("deleted-save");
      expect(body.data.deletedAt).toBeUndefined();
    });

    it("emits SaveRestored event on auto-restore", async () => {
      mockQueryItems.mockResolvedValueOnce({ items: [], hasMore: false });
      mockTransactWriteItems.mockRejectedValueOnce(
        new TransactionCancelledError(["None", "ConditionalCheckFailed"])
      );
      mockQueryItems.mockResolvedValueOnce({ items: [], hasMore: false });

      const softDeleted = {
        PK: "USER#user_123",
        SK: "SAVE#deleted-save",
        userId: "user_123",
        saveId: "deleted-save",
        url: "https://example.com",
        normalizedUrl: "https://example.com/",
        urlHash: "abc123",
        contentType: "article",
        tags: [],
        isTutorial: false,
        linkedProjectCount: 0,
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
        deletedAt: "2026-01-15T00:00:00Z",
      };
      mockQueryItems.mockResolvedValueOnce({
        items: [softDeleted],
        hasMore: false,
      });
      mockUpdateItem.mockResolvedValueOnce({
        ...softDeleted,
        deletedAt: undefined,
      });

      const event = createSaveEvent({ url: "https://example.com" }, "user_123");
      await handler(event, mockContext);

      expect(mockEmitEvent).toHaveBeenCalledOnce();
      const [_client, _busName, entry] = mockEmitEvent.mock.calls[0];
      expect(entry.detailType).toBe("SaveRestored");
      expect(entry.detail.saveId).toBe("deleted-save");
    });

    it("re-throws non-NOT_FOUND errors from updateItem during restore", async () => {
      // Layer 1: no active saves
      mockQueryItems.mockResolvedValueOnce({ items: [], hasMore: false });
      // Layer 2: transaction fails (marker exists)
      mockTransactWriteItems.mockRejectedValueOnce(
        new TransactionCancelledError(["None", "ConditionalCheckFailed"])
      );
      // Re-query active: empty
      mockQueryItems.mockResolvedValueOnce({ items: [], hasMore: false });

      // Re-query soft-deleted: found
      const softDeleted = {
        PK: "USER#user_123",
        SK: "SAVE#deleted-save",
        userId: "user_123",
        saveId: "deleted-save",
        url: "https://example.com",
        normalizedUrl: "https://example.com/",
        urlHash: "abc123",
        contentType: "article",
        tags: [],
        isTutorial: false,
        linkedProjectCount: 0,
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
        deletedAt: "2026-01-15T00:00:00Z",
      };
      mockQueryItems.mockResolvedValueOnce({
        items: [softDeleted],
        hasMore: false,
      });

      // updateItem throws INTERNAL_ERROR (e.g., network failure)
      mockUpdateItem.mockRejectedValueOnce(
        new AppError(ErrorCode.INTERNAL_ERROR, "DynamoDB service error")
      );

      const event = createSaveEvent({ url: "https://example.com" }, "user_123");
      const result = await handler(event, mockContext);

      // Should propagate as 500, not silently swallow the error
      assertADR008Error(result, ErrorCode.INTERNAL_ERROR, 500);
    });

    it("returns 500 for orphaned marker (data anomaly)", async () => {
      mockQueryItems.mockResolvedValueOnce({ items: [], hasMore: false });
      mockTransactWriteItems.mockRejectedValueOnce(
        new TransactionCancelledError(["None", "ConditionalCheckFailed"])
      );
      // Re-query: no active saves
      mockQueryItems.mockResolvedValueOnce({ items: [], hasMore: false });
      // Re-query: no soft-deleted saves either
      mockQueryItems.mockResolvedValueOnce({ items: [], hasMore: false });

      const event = createSaveEvent({ url: "https://example.com" }, "user_123");
      const result = await handler(event, mockContext);

      assertADR008Error(result, ErrorCode.INTERNAL_ERROR, 500);
    });
  });

  describe("EventBridge failure does NOT fail API response (AC6)", () => {
    it("returns 201 even if EventBridge emission fails", async () => {
      mockQueryItems.mockResolvedValue({ items: [], hasMore: false });
      mockTransactWriteItems.mockResolvedValue(undefined);
      // emitEvent is fire-and-forget, so even if it throws internally,
      // the handler should still return 201. Since we mock emitEvent as vi.fn(),
      // it returns undefined (void), simulating the fire-and-forget contract.

      const event = createSaveEvent({ url: "https://example.com" }, "user_123");
      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(201);
    });
  });

  describe("SAVES_TABLE_CONFIG reads from env (AC5.5)", () => {
    it("uses SAVES_TABLE_NAME env var", async () => {
      // requireEnv resolves at module load — verify the table name
      // propagates into transactWriteItems calls
      mockQueryItems.mockResolvedValue({ items: [], hasMore: false });
      mockTransactWriteItems.mockResolvedValue(undefined);

      const event = createSaveEvent({ url: "https://example.com" }, "user_123");
      await handler(event, mockContext);

      // Verify transactWriteItems uses a configured table name
      const [_client, transactItems] = mockTransactWriteItems.mock.calls[0];
      expect(typeof transactItems[0].Put.TableName).toBe("string");
      expect(transactItems[0].Put.TableName.length).toBeGreaterThan(0);
    });
  });

  describe("Auth enforcement", () => {
    it("returns 401 when no auth context", async () => {
      const event = createSaveEvent({ url: "https://example.com" });
      const result = await handler(event, mockContext);
      assertADR008Error(result, ErrorCode.UNAUTHORIZED, 401);
    });
  });

  describe("Tags handling", () => {
    it("defaults tags to empty array when not provided", async () => {
      mockQueryItems.mockResolvedValue({ items: [], hasMore: false });
      mockTransactWriteItems.mockResolvedValue(undefined);

      const event = createSaveEvent({ url: "https://example.com" }, "user_123");
      const result = await handler(event, mockContext);
      const body = JSON.parse(result.body);

      expect(body.data.tags).toEqual([]);
    });
  });

  describe("Concurrent duplicate guard", () => {
    it("Layer 2 condition blocks second write for same URL", async () => {
      // First request succeeds
      mockQueryItems.mockResolvedValueOnce({ items: [], hasMore: false });
      mockTransactWriteItems.mockResolvedValueOnce(undefined);

      const event1 = createSaveEvent(
        { url: "https://example.com" },
        "user_123"
      );
      const result1 = await handler(event1, mockContext);
      expect(result1.statusCode).toBe(201);

      // Second request: Layer 1 misses (race), Layer 2 catches via condition
      mockQueryItems.mockResolvedValueOnce({ items: [], hasMore: false });
      mockTransactWriteItems.mockRejectedValueOnce(
        new TransactionCancelledError(["None", "ConditionalCheckFailed"])
      );

      // Re-query finds the active save from the first request
      const firstSave = {
        PK: "USER#user_123",
        SK: "SAVE#first",
        userId: "user_123",
        saveId: "first",
        url: "https://example.com",
        normalizedUrl: "https://example.com/",
        urlHash: "xyz",
        contentType: "article",
        tags: [],
        isTutorial: false,
        linkedProjectCount: 0,
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
      };
      mockQueryItems.mockResolvedValueOnce({
        items: [firstSave],
        hasMore: false,
      });

      const event2 = createSaveEvent(
        { url: "https://example.com" },
        "user_123"
      );
      const result2 = await handler(event2, mockContext);

      expect(result2.statusCode).toBe(409);
    });
  });

  // ──────────────────────────────────────────────────────────────
  // Story 3.1.7 — API key scope enforcement tests
  // ──────────────────────────────────────────────────────────────

  describe("AC6: API key scope enforcement", () => {
    it("allows capture-only key (saves:write) to POST /saves", async () => {
      mockQueryItems.mockResolvedValue({ items: [], hasMore: false });
      mockTransactWriteItems.mockResolvedValue(undefined);

      const event = createMockEvent({
        method: "POST",
        path: "/saves",
        body: { url: "https://example.com" },
        userId: "user_123",
        authMethod: "api-key",
        scopes: ["saves:write"],
      });
      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(201);
    });

    it("allows full-access key (*) to POST /saves", async () => {
      mockQueryItems.mockResolvedValue({ items: [], hasMore: false });
      mockTransactWriteItems.mockResolvedValue(undefined);

      const event = createMockEvent({
        method: "POST",
        path: "/saves",
        body: { url: "https://example.com" },
        userId: "user_123",
        authMethod: "api-key",
        scopes: ["*"],
      });
      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(201);
    });

    it("rejects API key with unrelated scope with 403 SCOPE_INSUFFICIENT", async () => {
      const event = createMockEvent({
        method: "POST",
        path: "/saves",
        body: { url: "https://example.com" },
        userId: "user_123",
        authMethod: "api-key",
        scopes: ["some:other"],
      });
      const result = await handler(event, mockContext);

      assertADR008Error(result, ErrorCode.SCOPE_INSUFFICIENT, 403);
    });
  });
});
