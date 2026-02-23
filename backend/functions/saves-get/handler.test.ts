/**
 * Saves Get handler tests — GET /saves/:saveId
 *
 * Story 3.2, Task 9.3: Tests all acceptance criteria.
 * Story 3.1.2: Migrated to shared test utilities (proof-of-concept).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createMockEvent,
  createMockContext,
  mockCreateLoggerModule,
  mockMiddlewareModule,
  createTestSaveItem,
  VALID_SAVE_ID,
  mockDbModule,
} from "../../test-utils/index.js";

// Mock @ai-learning-hub/db — using shared mockDbModule with handler-specific mocks
const mockGetItem = vi.fn();
const mockUpdateItem = vi.fn();

vi.mock("@ai-learning-hub/db", () =>
  mockDbModule({
    getItem: (...args: unknown[]) => mockGetItem(...args),
    updateItem: (...args: unknown[]) => mockUpdateItem(...args),
  })
);

// Mock @ai-learning-hub/logging
vi.mock("@ai-learning-hub/logging", () => mockCreateLoggerModule());

// Mock @ai-learning-hub/middleware
vi.mock("@ai-learning-hub/middleware", () => mockMiddlewareModule());

// Note: @ai-learning-hub/validation is NOT mocked — uses real implementation

import { handler } from "./handler.js";

const mockContext = createMockContext();

// Fixed overrides to match original test assertions
const SAVE_OVERRIDES: Partial<import("@ai-learning-hub/types").SaveItem> = {
  url: "https://example.com/article",
  normalizedUrl: "https://example.com/article",
  urlHash: "hash123",
  tags: ["test"],
};

function createGetEvent(saveId: string = VALID_SAVE_ID, userId = "user123") {
  return createMockEvent({
    method: "GET",
    path: `/saves/${saveId}`,
    userId,
    pathParameters: { saveId },
  });
}

describe("Saves Get Handler — GET /saves/:saveId", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdateItem.mockResolvedValue(null);
  });

  describe("AC3: Returns single save with all public attributes", () => {
    it("returns 200 with save data", async () => {
      const item = createTestSaveItem(VALID_SAVE_ID, SAVE_OVERRIDES);
      mockGetItem.mockResolvedValueOnce(item);

      const event = createGetEvent();
      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.data.saveId).toBe(VALID_SAVE_ID);
      expect(body.data.url).toBe("https://example.com/article");
      expect(body.data).not.toHaveProperty("PK");
      expect(body.data).not.toHaveProperty("SK");
    });
  });

  describe("AC4: lastAccessedAt updated on GET", () => {
    it("calls updateItem to set lastAccessedAt", async () => {
      const item = createTestSaveItem(VALID_SAVE_ID, SAVE_OVERRIDES);
      mockGetItem.mockResolvedValueOnce(item);

      const event = createGetEvent();
      await handler(event, mockContext);

      expect(mockUpdateItem).toHaveBeenCalledWith(
        expect.anything(), // client
        expect.anything(), // config
        expect.objectContaining({
          key: { PK: "USER#user123", SK: `SAVE#${VALID_SAVE_ID}` },
          updateExpression: "SET lastAccessedAt = :now",
        }),
        expect.anything() // logger
      );
    });

    it("returns 200 even when lastAccessedAt update fails", async () => {
      const item = createTestSaveItem(VALID_SAVE_ID, SAVE_OVERRIDES);
      mockGetItem.mockResolvedValueOnce(item);
      mockUpdateItem.mockRejectedValueOnce(new Error("DynamoDB throttle"));

      const event = createGetEvent();
      const result = await handler(event, mockContext);

      // AC4: Response returned regardless of update failure
      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.data.saveId).toBe(VALID_SAVE_ID);
    });
  });

  describe("AC3/AC7: Not found returns 404", () => {
    it("returns 404 when save does not exist", async () => {
      mockGetItem.mockResolvedValueOnce(null);

      const event = createGetEvent();
      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(404);
      const body = JSON.parse(result.body);
      expect(body.error.code).toBe("NOT_FOUND");
      expect(body.error.message).toBe("Save not found");
    });
  });

  describe("AC5: Soft-deleted save returns 404", () => {
    it("returns 404 when save has deletedAt set", async () => {
      const item = createTestSaveItem(VALID_SAVE_ID, {
        ...SAVE_OVERRIDES,
        deletedAt: "2026-02-21T00:00:00Z",
      });
      mockGetItem.mockResolvedValueOnce(item);

      const event = createGetEvent();
      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(404);
      const body = JSON.parse(result.body);
      expect(body.error.code).toBe("NOT_FOUND");
    });
  });

  describe("AC8: ConsistentRead passed to DynamoDB", () => {
    it("passes consistentRead: true to getItem", async () => {
      mockGetItem.mockResolvedValueOnce(null);

      const event = createGetEvent();
      await handler(event, mockContext);

      expect(mockGetItem).toHaveBeenCalledWith(
        expect.anything(), // client
        expect.anything(), // config
        expect.objectContaining({
          PK: "USER#user123",
          SK: `SAVE#${VALID_SAVE_ID}`,
        }),
        { consistentRead: true }, // options
        expect.anything() // logger
      );
    });
  });

  describe("Validation: invalid saveId format", () => {
    it("returns 400 for saveId that is too short", async () => {
      const event = createGetEvent("abc123");
      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error.code).toBe("VALIDATION_ERROR");
    });

    it("returns 400 for saveId with lowercase characters", async () => {
      const event = createGetEvent("01hxyz12345678901234567a");
      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(400);
    });
  });

  describe("Authentication", () => {
    it("returns 401 when not authenticated", async () => {
      const event = createMockEvent({
        method: "GET",
        path: `/saves/${VALID_SAVE_ID}`,
        pathParameters: { saveId: VALID_SAVE_ID },
      });
      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(401);
    });
  });
});
