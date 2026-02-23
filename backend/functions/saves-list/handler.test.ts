/**
 * Saves List handler tests — GET /saves
 *
 * Story 3.2, Task 9.2: Tests all acceptance criteria.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ContentType } from "@ai-learning-hub/types";
import type { SaveItem } from "@ai-learning-hub/types";
import {
  createMockEvent,
  createMockContext,
  mockCreateLoggerModule,
  mockMiddlewareModule,
} from "../../test-utils/index.js";

// Mock @ai-learning-hub/db
const mockQueryAllItems = vi.fn();
const mockGetDefaultClient = vi.fn(() => ({}));

vi.mock("@ai-learning-hub/db", () => ({
  getDefaultClient: () => mockGetDefaultClient(),
  queryAllItems: (...args: unknown[]) => mockQueryAllItems(...args),
  SAVES_TABLE_CONFIG: {
    tableName: "ai-learning-hub-saves",
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

// Note: @ai-learning-hub/validation is NOT mocked — uses real implementation

import { handler } from "./handler.js";

const mockContext = createMockContext();

function createSaveItem(
  saveId: string,
  overrides: Partial<SaveItem> = {}
): SaveItem {
  return {
    PK: "USER#user123",
    SK: `SAVE#${saveId}`,
    userId: "user123",
    saveId,
    url: `https://example.com/${saveId}`,
    normalizedUrl: `https://example.com/${saveId}`,
    urlHash: `hash-${saveId}`,
    contentType: ContentType.ARTICLE,
    tags: [],
    isTutorial: false,
    linkedProjectCount: 0,
    createdAt: "2026-02-20T00:00:00Z",
    updatedAt: "2026-02-20T00:00:00Z",
    ...overrides,
  };
}

function createListEvent(
  queryParams?: Record<string, string>,
  userId = "user123"
) {
  return createMockEvent({
    method: "GET",
    path: "/saves",
    userId,
    queryStringParameters: queryParams ?? null,
  });
}

describe("Saves List Handler — GET /saves", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("AC1: Returns paginated list of active saves", () => {
    it("returns 200 with items and pagination shape", async () => {
      const items = [
        createSaveItem("01SAVE1111111111111111111A"),
        createSaveItem("01SAVE0000000000000000000B"),
      ];
      mockQueryAllItems.mockResolvedValueOnce({
        items,
        truncated: false,
      });

      const event = createListEvent();
      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.data.items).toHaveLength(2);
      expect(body.data.hasMore).toBe(false);
      expect(body.data.items[0]).not.toHaveProperty("PK");
      expect(body.data.items[0]).not.toHaveProperty("SK");
      expect(body.data.items[0]).not.toHaveProperty("deletedAt");
    });
  });

  describe("AC6: Empty list returns { items: [], hasMore: false }", () => {
    it("returns empty array when user has no saves", async () => {
      mockQueryAllItems.mockResolvedValueOnce({
        items: [],
        truncated: false,
      });

      const event = createListEvent();
      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.data.items).toEqual([]);
      expect(body.data.hasMore).toBe(false);
    });
  });

  describe("AC2: In-memory pagination with ULID cursor", () => {
    it("returns first page with nextToken when hasMore", async () => {
      // Create 30 items to exceed default limit of 25
      const items = Array.from({ length: 30 }, (_, i) =>
        createSaveItem(`01SAVE${String(i).padStart(19, "0")}A`)
      );
      mockQueryAllItems.mockResolvedValueOnce({
        items,
        truncated: false,
      });

      const event = createListEvent();
      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.data.items).toHaveLength(25);
      expect(body.data.hasMore).toBe(true);
      expect(body.data.nextToken).toBeDefined();
    });

    it("returns page 2 correctly using nextToken", async () => {
      const items = Array.from({ length: 30 }, (_, i) =>
        createSaveItem(`01SAVE${String(i).padStart(19, "0")}A`)
      );
      // The cursor points to the last item of page 1 (index 24)
      const cursorSaveId = items[24].saveId;
      const nextToken = Buffer.from(cursorSaveId).toString("base64url");

      mockQueryAllItems.mockResolvedValueOnce({
        items,
        truncated: false,
      });

      const event = createListEvent({ nextToken });
      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      // Items 25-29 = 5 remaining items
      expect(body.data.items).toHaveLength(5);
      expect(body.data.hasMore).toBe(false);
    });

    it("respects custom limit", async () => {
      const items = Array.from({ length: 10 }, (_, i) =>
        createSaveItem(`01SAVE${String(i).padStart(19, "0")}A`)
      );
      mockQueryAllItems.mockResolvedValueOnce({
        items,
        truncated: false,
      });

      const event = createListEvent({ limit: "5" });
      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.data.items).toHaveLength(5);
      expect(body.data.hasMore).toBe(true);
    });

    it("accepts limit=100 (max)", async () => {
      const items = Array.from({ length: 50 }, (_, i) =>
        createSaveItem(`01SAVE${String(i).padStart(19, "0")}A`)
      );
      mockQueryAllItems.mockResolvedValueOnce({
        items,
        truncated: false,
      });

      const event = createListEvent({ limit: "100" });
      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(200);
    });
  });

  describe("AC10: Stale nextToken returns 400", () => {
    it("returns 400 when cursor saveId is not in result set", async () => {
      const items = [createSaveItem("01SAVE1111111111111111111A")];
      const staleToken = Buffer.from("01STALE_DOES_NOT_EXIST_HERE").toString(
        "base64url"
      );

      mockQueryAllItems.mockResolvedValueOnce({
        items,
        truncated: false,
      });

      const event = createListEvent({ nextToken: staleToken });
      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error.code).toBe("VALIDATION_ERROR");
      expect(body.error.message).toContain("nextToken is invalid");
    });

    it("returns 400 for malformed nextToken", async () => {
      mockQueryAllItems.mockResolvedValueOnce({
        items: [],
        truncated: false,
      });

      // Invalid base64url
      const event = createListEvent({ nextToken: "!!!invalid!!!" });
      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(400);
    });
  });

  describe("Validation errors", () => {
    it("returns 400 when limit exceeds max (101)", async () => {
      const event = createListEvent({ limit: "101" });
      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(400);
    });

    it("returns 400 when limit is 0", async () => {
      const event = createListEvent({ limit: "0" });
      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(400);
    });
  });

  describe("AC8: ConsistentRead passed to DynamoDB", () => {
    it("passes consistentRead: true to queryAllItems", async () => {
      mockQueryAllItems.mockResolvedValueOnce({
        items: [],
        truncated: false,
      });

      const event = createListEvent();
      await handler(event, mockContext);

      expect(mockQueryAllItems).toHaveBeenCalledWith(
        expect.anything(), // client
        expect.anything(), // config
        expect.objectContaining({
          consistentRead: true,
        }),
        expect.anything() // logger
      );
    });
  });

  describe("FilterExpression verification", () => {
    it("passes filterExpression to exclude soft-deleted items", async () => {
      mockQueryAllItems.mockResolvedValueOnce({
        items: [],
        truncated: false,
      });

      const event = createListEvent();
      await handler(event, mockContext);

      expect(mockQueryAllItems).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.objectContaining({
          filterExpression: "attribute_not_exists(deletedAt)",
        }),
        expect.anything()
      );
    });
  });

  describe("toPublicSave strips internal fields", () => {
    it("strips PK, SK, deletedAt from each item in response", async () => {
      const item = createSaveItem("01SAVE1111111111111111111A");
      mockQueryAllItems.mockResolvedValueOnce({
        items: [item],
        truncated: false,
      });

      const event = createListEvent();
      const result = await handler(event, mockContext);

      const body = JSON.parse(result.body);
      const publicItem = body.data.items[0];
      expect(publicItem).not.toHaveProperty("PK");
      expect(publicItem).not.toHaveProperty("SK");
      expect(publicItem.saveId).toBe("01SAVE1111111111111111111A");
    });
  });

  describe("Authentication", () => {
    it("returns 401 when not authenticated", async () => {
      const event = createMockEvent({
        method: "GET",
        path: "/saves",
      });
      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(401);
    });
  });
});
