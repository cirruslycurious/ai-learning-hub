/**
 * Saves List handler tests — GET /saves
 *
 * Story 3.2: Base pagination tests.
 * Story 3.4: Filter, search, sort, truncated, combined filter tests.
 * Story 3.1.3: Migrated to shared test utilities.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ContentType, ErrorCode } from "@ai-learning-hub/types";

import {
  createMockEvent,
  createMockContext,
  mockCreateLoggerModule,
  mockMiddlewareModule,
  assertADR008Error,
  createTestSaveItem,
  mockDbModule,
} from "../../test-utils/index.js";

// Mock @ai-learning-hub/db — using shared mockDbModule with handler-specific mocks
const mockQueryAllItems = vi.fn();

vi.mock("@ai-learning-hub/db", () =>
  mockDbModule({
    queryAllItems: (...args: unknown[]) => mockQueryAllItems(...args),
  })
);

// Mock @ai-learning-hub/logging
vi.mock("@ai-learning-hub/logging", () => mockCreateLoggerModule());

// Mock @ai-learning-hub/middleware
vi.mock("@ai-learning-hub/middleware", () => mockMiddlewareModule());

// Note: @ai-learning-hub/validation is NOT mocked — uses real implementation

import { handler } from "./handler.js";

const mockContext = createMockContext();

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

  // ──────────────────────────────────────────────────────────────
  // Story 3.2 — Base pagination tests (retained)
  // ──────────────────────────────────────────────────────────────

  describe("Base: Returns paginated list of active saves", () => {
    it("returns 200 with items and pagination shape", async () => {
      const items = [
        createTestSaveItem("01SAVE1111111111111111111A"),
        createTestSaveItem("01SAVE0000000000000000000B"),
      ];
      mockQueryAllItems.mockResolvedValueOnce({
        items,
        truncated: false,
      });

      const event = createListEvent();
      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.data).toHaveLength(2);
      expect(body.meta.cursor).toBeNull();
      expect(body.data[0]).not.toHaveProperty("PK");
      expect(body.data[0]).not.toHaveProperty("SK");
      expect(body.data[0]).not.toHaveProperty("deletedAt");
    });
  });

  describe("Base: Empty list returns empty data array", () => {
    it("returns empty array when user has no saves", async () => {
      mockQueryAllItems.mockResolvedValueOnce({
        items: [],
        truncated: false,
      });

      const event = createListEvent();
      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.data).toEqual([]);
      expect(body.meta.cursor).toBeNull();
    });
  });

  describe("Base: In-memory pagination with ULID cursor", () => {
    it("returns first page with cursor when more items exist", async () => {
      const items = Array.from({ length: 30 }, (_, i) =>
        createTestSaveItem(`01SAVE${String(i).padStart(19, "0")}A`)
      );
      mockQueryAllItems.mockResolvedValueOnce({
        items,
        truncated: false,
      });

      const event = createListEvent();
      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.data).toHaveLength(25);
      expect(body.meta.cursor).not.toBeNull();
    });

    it("returns page 2 correctly using cursor", async () => {
      const items = Array.from({ length: 30 }, (_, i) =>
        createTestSaveItem(`01SAVE${String(i).padStart(19, "0")}A`)
      );
      const cursorSaveId = items[24].saveId;
      const cursor = Buffer.from(
        JSON.stringify({ saveId: cursorSaveId })
      ).toString("base64url");

      mockQueryAllItems.mockResolvedValueOnce({
        items,
        truncated: false,
      });

      const event = createListEvent({ cursor });
      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.data).toHaveLength(5);
      expect(body.meta.cursor).toBeNull();
    });

    it("respects custom limit", async () => {
      const items = Array.from({ length: 10 }, (_, i) =>
        createTestSaveItem(`01SAVE${String(i).padStart(19, "0")}A`)
      );
      mockQueryAllItems.mockResolvedValueOnce({
        items,
        truncated: false,
      });

      const event = createListEvent({ limit: "5" });
      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.data).toHaveLength(5);
      expect(body.meta.cursor).not.toBeNull();
    });

    it("accepts limit=100 (max)", async () => {
      const items = Array.from({ length: 50 }, (_, i) =>
        createTestSaveItem(`01SAVE${String(i).padStart(19, "0")}A`)
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

  describe("Base: ConsistentRead passed to DynamoDB", () => {
    it("passes consistentRead: true to queryAllItems", async () => {
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
          consistentRead: true,
        }),
        expect.anything()
      );
    });
  });

  describe("Base: FilterExpression verification", () => {
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

  describe("Base: toPublicSave strips internal fields", () => {
    it("strips PK, SK, deletedAt from each item in response", async () => {
      const item = createTestSaveItem("01SAVE1111111111111111111A");
      mockQueryAllItems.mockResolvedValueOnce({
        items: [item],
        truncated: false,
      });

      const event = createListEvent();
      const result = await handler(event, mockContext);

      const body = JSON.parse(result.body);
      const publicItem = body.data[0];
      expect(publicItem).not.toHaveProperty("PK");
      expect(publicItem).not.toHaveProperty("SK");
      expect(publicItem.saveId).toBe("01SAVE1111111111111111111A");
    });
  });

  describe("Base: Authentication", () => {
    it("returns 401 when not authenticated", async () => {
      const event = createMockEvent({
        method: "GET",
        path: "/saves",
      });
      const result = await handler(event, mockContext);

      assertADR008Error(result, ErrorCode.UNAUTHORIZED, 401);
    });
  });

  // ──────────────────────────────────────────────────────────────
  // Story 3.4 — Filtering (AC1–AC4)
  // ──────────────────────────────────────────────────────────────

  describe("AC1: Filter by contentType", () => {
    it("returns only saves matching contentType=video", async () => {
      const items = [
        createTestSaveItem("01SAVE0000000000000000001A", {
          contentType: ContentType.VIDEO,
        }),
        createTestSaveItem("01SAVE0000000000000000002A", {
          contentType: ContentType.ARTICLE,
        }),
        createTestSaveItem("01SAVE0000000000000000003A", {
          contentType: ContentType.VIDEO,
        }),
      ];
      mockQueryAllItems.mockResolvedValueOnce({ items, truncated: false });

      const event = createListEvent({ contentType: "video" });
      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.data).toHaveLength(2);
      expect(
        body.data.every(
          (i: { contentType: string }) => i.contentType === "video"
        )
      ).toBe(true);
    });
  });

  describe("AC2: Filter by linkStatus=linked", () => {
    it("returns saves where linkedProjectCount > 0", async () => {
      const items = [
        createTestSaveItem("01SAVE0000000000000000001A", {
          linkedProjectCount: 2,
        }),
        createTestSaveItem("01SAVE0000000000000000002A", {
          linkedProjectCount: 0,
        }),
        createTestSaveItem("01SAVE0000000000000000003A", {
          linkedProjectCount: 1,
        }),
      ];
      mockQueryAllItems.mockResolvedValueOnce({ items, truncated: false });

      const event = createListEvent({ linkStatus: "linked" });
      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.data).toHaveLength(2);
    });
  });

  describe("AC3: Filter by linkStatus=unlinked", () => {
    it("returns saves where linkedProjectCount = 0", async () => {
      const items = [
        createTestSaveItem("01SAVE0000000000000000001A", {
          linkedProjectCount: 2,
        }),
        createTestSaveItem("01SAVE0000000000000000002A", {
          linkedProjectCount: 0,
        }),
      ];
      mockQueryAllItems.mockResolvedValueOnce({ items, truncated: false });

      const event = createListEvent({ linkStatus: "unlinked" });
      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.data).toHaveLength(1);
      expect(body.data[0].linkedProjectCount).toBe(0);
    });

    it("treats missing linkedProjectCount as 0 (unlinked)", async () => {
      const item = createTestSaveItem("01SAVE0000000000000000001A");
      // Simulate missing field by casting
      delete (item as unknown as Record<string, unknown>).linkedProjectCount;
      mockQueryAllItems.mockResolvedValueOnce({
        items: [item],
        truncated: false,
      });

      const event = createListEvent({ linkStatus: "unlinked" });
      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.data).toHaveLength(1);
    });
  });

  describe("AC4: Search by title/url substring", () => {
    it("returns saves where title contains search term (case-insensitive)", async () => {
      const items = [
        createTestSaveItem("01SAVE0000000000000000001A", {
          title: "Learning React Hooks",
        }),
        createTestSaveItem("01SAVE0000000000000000002A", {
          title: "Vue.js Guide",
        }),
        createTestSaveItem("01SAVE0000000000000000003A", {
          title: "Advanced React Patterns",
        }),
      ];
      mockQueryAllItems.mockResolvedValueOnce({ items, truncated: false });

      const event = createListEvent({ search: "react" });
      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.data).toHaveLength(2);
    });

    it("returns saves where url contains search term", async () => {
      const items = [
        createTestSaveItem("01SAVE0000000000000000001A", {
          url: "https://react.dev/docs",
          title: "Some Title",
        }),
        createTestSaveItem("01SAVE0000000000000000002A", {
          url: "https://vuejs.org/guide",
          title: "Vue Guide",
        }),
      ];
      mockQueryAllItems.mockResolvedValueOnce({ items, truncated: false });

      const event = createListEvent({ search: "react" });
      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.data).toHaveLength(1);
    });

    it("handles saves with missing title during search", async () => {
      const items = [
        createTestSaveItem("01SAVE0000000000000000001A", {
          title: undefined,
          url: "https://react.dev/docs",
        }),
        createTestSaveItem("01SAVE0000000000000000002A", {
          title: "React Guide",
          url: "https://example.com",
        }),
      ];
      mockQueryAllItems.mockResolvedValueOnce({ items, truncated: false });

      const event = createListEvent({ search: "react" });
      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      // Both match: first via url, second via title
      expect(body.data).toHaveLength(2);
    });
  });

  // ──────────────────────────────────────────────────────────────
  // Story 3.4 — Sorting (AC5–AC7)
  // ──────────────────────────────────────────────────────────────

  describe("AC5: Sort by createdAt ascending", () => {
    it("returns saves sorted by createdAt asc", async () => {
      const items = [
        createTestSaveItem("01SAVE0000000000000000003A", {
          createdAt: "2026-02-22T00:00:00Z",
        }),
        createTestSaveItem("01SAVE0000000000000000001A", {
          createdAt: "2026-02-20T00:00:00Z",
        }),
        createTestSaveItem("01SAVE0000000000000000002A", {
          createdAt: "2026-02-21T00:00:00Z",
        }),
      ];
      mockQueryAllItems.mockResolvedValueOnce({ items, truncated: false });

      const event = createListEvent({ sort: "createdAt", order: "asc" });
      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.data[0].createdAt).toBe("2026-02-20T00:00:00Z");
      expect(body.data[1].createdAt).toBe("2026-02-21T00:00:00Z");
      expect(body.data[2].createdAt).toBe("2026-02-22T00:00:00Z");
    });
  });

  describe("AC6: Sort by lastAccessedAt descending", () => {
    it("returns saves sorted by lastAccessedAt desc; null sorts to bottom", async () => {
      const items = [
        createTestSaveItem("01SAVE0000000000000000001A", {
          lastAccessedAt: "2026-02-20T00:00:00Z",
        }),
        createTestSaveItem("01SAVE0000000000000000002A", {
          lastAccessedAt: undefined,
        }),
        createTestSaveItem("01SAVE0000000000000000003A", {
          lastAccessedAt: "2026-02-22T00:00:00Z",
        }),
      ];
      mockQueryAllItems.mockResolvedValueOnce({ items, truncated: false });

      const event = createListEvent({
        sort: "lastAccessedAt",
        order: "desc",
      });
      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      // Most recent first, null at bottom
      expect(body.data[0].lastAccessedAt).toBe("2026-02-22T00:00:00Z");
      expect(body.data[1].lastAccessedAt).toBe("2026-02-20T00:00:00Z");
      expect(body.data[2].lastAccessedAt).toBeUndefined();
    });

    it("sorts lastAccessedAt ascending with null at bottom", async () => {
      const items = [
        createTestSaveItem("01SAVE0000000000000000001A", {
          lastAccessedAt: "2026-02-22T00:00:00Z",
        }),
        createTestSaveItem("01SAVE0000000000000000002A", {
          lastAccessedAt: undefined,
        }),
        createTestSaveItem("01SAVE0000000000000000003A", {
          lastAccessedAt: "2026-02-20T00:00:00Z",
        }),
      ];
      mockQueryAllItems.mockResolvedValueOnce({ items, truncated: false });
      const event = createListEvent({ sort: "lastAccessedAt", order: "asc" });
      const result = await handler(event, mockContext);
      const body = JSON.parse(result.body);
      expect(body.data[0].lastAccessedAt).toBe("2026-02-20T00:00:00Z");
      expect(body.data[1].lastAccessedAt).toBe("2026-02-22T00:00:00Z");
      expect(body.data[2].lastAccessedAt).toBeUndefined();
    });
  });

  describe("AC7: Sort by title ascending", () => {
    it("returns saves sorted alphabetically; empty title at bottom", async () => {
      const items = [
        createTestSaveItem("01SAVE0000000000000000001A", { title: "Zebra" }),
        createTestSaveItem("01SAVE0000000000000000002A", { title: undefined }),
        createTestSaveItem("01SAVE0000000000000000003A", { title: "Alpha" }),
      ];
      mockQueryAllItems.mockResolvedValueOnce({ items, truncated: false });

      const event = createListEvent({ sort: "title", order: "asc" });
      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.data[0].title).toBe("Alpha");
      expect(body.data[1].title).toBe("Zebra");
      expect(body.data[2].title).toBeUndefined();
    });

    it("sorts title descending with empty title at bottom", async () => {
      const items = [
        createTestSaveItem("01SAVE0000000000000000001A", { title: "Alpha" }),
        createTestSaveItem("01SAVE0000000000000000002A", { title: undefined }),
        createTestSaveItem("01SAVE0000000000000000003A", { title: "Zebra" }),
      ];
      mockQueryAllItems.mockResolvedValueOnce({ items, truncated: false });

      const event = createListEvent({ sort: "title", order: "desc" });
      const result = await handler(event, mockContext);

      const body = JSON.parse(result.body);
      expect(body.data[0].title).toBe("Zebra");
      expect(body.data[1].title).toBe("Alpha");
      expect(body.data[2].title).toBeUndefined();
    });
  });

  describe("Default order when only sort provided", () => {
    it("defaults to desc for sort=createdAt", async () => {
      const items = [
        createTestSaveItem("01SAVE0000000000000000001A", {
          createdAt: "2026-02-20T00:00:00Z",
        }),
        createTestSaveItem("01SAVE0000000000000000002A", {
          createdAt: "2026-02-22T00:00:00Z",
        }),
      ];
      mockQueryAllItems.mockResolvedValueOnce({ items, truncated: false });

      const event = createListEvent({ sort: "createdAt" });
      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      // desc: newest first
      expect(body.data[0].createdAt).toBe("2026-02-22T00:00:00Z");
      expect(body.data[1].createdAt).toBe("2026-02-20T00:00:00Z");
    });

    it("defaults to desc for sort=lastAccessedAt", async () => {
      const items = [
        createTestSaveItem("01SAVE0000000000000000001A", {
          lastAccessedAt: "2026-02-20T00:00:00Z",
        }),
        createTestSaveItem("01SAVE0000000000000000002A", {
          lastAccessedAt: "2026-02-22T00:00:00Z",
        }),
      ];
      mockQueryAllItems.mockResolvedValueOnce({ items, truncated: false });

      const event = createListEvent({ sort: "lastAccessedAt" });
      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.data[0].lastAccessedAt).toBe("2026-02-22T00:00:00Z");
      expect(body.data[1].lastAccessedAt).toBe("2026-02-20T00:00:00Z");
    });

    it("defaults to asc for sort=title", async () => {
      const items = [
        createTestSaveItem("01SAVE0000000000000000001A", { title: "Zebra" }),
        createTestSaveItem("01SAVE0000000000000000002A", { title: "Alpha" }),
      ];
      mockQueryAllItems.mockResolvedValueOnce({ items, truncated: false });

      const event = createListEvent({ sort: "title" });
      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.data[0].title).toBe("Alpha");
      expect(body.data[1].title).toBe("Zebra");
    });
  });

  // ──────────────────────────────────────────────────────────────
  // Story 3.4 — Combined filters + sort (AC8)
  // ──────────────────────────────────────────────────────────────

  describe("AC8: Combined filters AND sort", () => {
    it("applies contentType + linkStatus + search together", async () => {
      const items = [
        createTestSaveItem("01SAVE0000000000000000001A", {
          contentType: ContentType.VIDEO,
          title: "React",
          linkedProjectCount: 1,
        }),
        createTestSaveItem("01SAVE0000000000000000002A", {
          contentType: ContentType.VIDEO,
          title: "React Adv",
          linkedProjectCount: 0,
        }),
      ];
      mockQueryAllItems.mockResolvedValueOnce({ items, truncated: false });
      const event = createListEvent({
        contentType: "video",
        linkStatus: "linked",
        search: "react",
      });
      const result = await handler(event, mockContext);
      const body = JSON.parse(result.body);
      expect(body.data).toHaveLength(1);
    });

    it("applies contentType + search + sort together", async () => {
      const items = [
        createTestSaveItem("01SAVE0000000000000000001A", {
          contentType: ContentType.VIDEO,
          title: "React Hooks",
          createdAt: "2026-02-20T00:00:00Z",
        }),
        createTestSaveItem("01SAVE0000000000000000002A", {
          contentType: ContentType.VIDEO,
          title: "React Patterns",
          createdAt: "2026-02-22T00:00:00Z",
        }),
        createTestSaveItem("01SAVE0000000000000000003A", {
          contentType: ContentType.ARTICLE,
          title: "React Overview",
          createdAt: "2026-02-21T00:00:00Z",
        }),
        createTestSaveItem("01SAVE0000000000000000004A", {
          contentType: ContentType.VIDEO,
          title: "Vue Tutorial",
          createdAt: "2026-02-23T00:00:00Z",
        }),
      ];
      mockQueryAllItems.mockResolvedValueOnce({ items, truncated: false });

      const event = createListEvent({
        contentType: "video",
        search: "react",
        sort: "createdAt",
      });
      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      // Only video + react: items 1 and 2; sorted desc by default
      expect(body.data).toHaveLength(2);
      expect(body.data[0].createdAt).toBe("2026-02-22T00:00:00Z");
      expect(body.data[1].createdAt).toBe("2026-02-20T00:00:00Z");
    });
  });

  // ──────────────────────────────────────────────────────────────
  // Story 3.4 — Validation errors (AC9)
  // ──────────────────────────────────────────────────────────────

  describe("AC9: Invalid filter/sort values → 400", () => {
    it("returns 400 for invalid contentType with valid options in message", async () => {
      const event = createListEvent({ contentType: "invalid" });
      const result = await handler(event, mockContext);

      assertADR008Error(result, ErrorCode.VALIDATION_ERROR, 400);
      const body = JSON.parse(result.body);
      const msg = JSON.stringify(body.error);
      // Ensure valid options are listed somewhere in error output
      expect(msg).toMatch(/article|video|podcast/);
    });

    it("returns 400 for invalid linkStatus with valid options in message", async () => {
      const event = createListEvent({ linkStatus: "foo" });
      const result = await handler(event, mockContext);

      assertADR008Error(result, ErrorCode.VALIDATION_ERROR, 400);
      const body = JSON.parse(result.body);
      const msg = JSON.stringify(body.error);
      expect(msg).toMatch(/linked|unlinked/);
    });

    it("returns 400 for invalid sort value with valid options in message", async () => {
      const event = createListEvent({ sort: "invalid" });
      const result = await handler(event, mockContext);

      assertADR008Error(result, ErrorCode.VALIDATION_ERROR, 400);
      const body = JSON.parse(result.body);
      const msg = JSON.stringify(body.error);
      expect(msg).toMatch(/createdAt|lastAccessedAt|title/);
    });

    it("returns 400 for invalid order value", async () => {
      const event = createListEvent({ order: "random" });
      const result = await handler(event, mockContext);

      assertADR008Error(result, ErrorCode.VALIDATION_ERROR, 400);
    });

    it("returns 400 when limit exceeds max (101)", async () => {
      const event = createListEvent({ limit: "101" });
      const result = await handler(event, mockContext);

      assertADR008Error(result, ErrorCode.VALIDATION_ERROR, 400);
    });

    it("returns 400 when limit is 0", async () => {
      const event = createListEvent({ limit: "0" });
      const result = await handler(event, mockContext);

      assertADR008Error(result, ErrorCode.VALIDATION_ERROR, 400);
    });
  });

  // ──────────────────────────────────────────────────────────────
  // Story 3.4 — Empty filter result (AC10)
  // ──────────────────────────────────────────────────────────────

  describe("AC10: No saves match filters → empty result", () => {
    it("returns empty data array when no matches", async () => {
      const items = [
        createTestSaveItem("01SAVE0000000000000000001A", {
          contentType: ContentType.ARTICLE,
        }),
      ];
      mockQueryAllItems.mockResolvedValueOnce({ items, truncated: false });

      const event = createListEvent({ contentType: "podcast" });
      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.data).toEqual([]);
      expect(body.meta.cursor).toBeNull();
    });
  });

  // ──────────────────────────────────────────────────────────────
  // Story 3.4 — Truncated flag (AC11)
  // ──────────────────────────────────────────────────────────────

  describe("AC11: Truncated flag in response", () => {
    it("includes truncated: true when ceiling hit", async () => {
      mockQueryAllItems.mockResolvedValueOnce({
        items: [createTestSaveItem("01SAVE0000000000000000001A")],
        truncated: true,
      });

      const event = createListEvent();
      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.meta.truncated).toBe(true);
    });

    it("omits truncated when not truncated", async () => {
      mockQueryAllItems.mockResolvedValueOnce({
        items: [createTestSaveItem("01SAVE0000000000000000001A")],
        truncated: false,
      });

      const event = createListEvent();
      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.meta.truncated).toBeUndefined();
    });
  });

  // ──────────────────────────────────────────────────────────────
  // Story 3.4 / 3.2.5 — cursor behavior with filters
  // ──────────────────────────────────────────────────────────────

  describe("cursor with filter changes", () => {
    it("returns 400 for malformed cursor", async () => {
      mockQueryAllItems.mockResolvedValueOnce({
        items: [],
        truncated: false,
      });

      const event = createListEvent({ cursor: "!!!invalid!!!" });
      const result = await handler(event, mockContext);

      assertADR008Error(result, ErrorCode.VALIDATION_ERROR, 400);
    });

    it("returns first page with cursorReset when cursor saveId not in filtered list but exists in unfiltered", async () => {
      // Save exists in unfiltered set but is excluded by contentType filter
      const items = [
        createTestSaveItem("01SAVE0000000000000000001A", {
          contentType: ContentType.ARTICLE,
        }),
        createTestSaveItem("01SAVE0000000000000000002A", {
          contentType: ContentType.VIDEO,
        }),
        createTestSaveItem("01SAVE0000000000000000003A", {
          contentType: ContentType.VIDEO,
        }),
      ];
      // Cursor points to the article save (index 0)
      const cursor = Buffer.from(
        JSON.stringify({ saveId: items[0].saveId })
      ).toString("base64url");

      mockQueryAllItems.mockResolvedValueOnce({ items, truncated: false });

      // Now filter to only videos — cursor save is not in filtered list
      const event = createListEvent({
        contentType: "video",
        cursor,
      });
      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      // Should return first page of filtered results with cursorReset
      expect(body.data).toHaveLength(2);
      expect(body.meta.cursorReset).toBe(true);
      expect(result.headers?.["X-Cursor-Reset"]).toBe("true");
    });

    it("returns first page with cursorReset when cursor saveId not in unfiltered set (stale cursor)", async () => {
      const items = [createTestSaveItem("01SAVE0000000000000000001A")];
      // Cursor points to a save that doesn't exist at all
      const cursor = Buffer.from(
        JSON.stringify({ saveId: "01NOTEXIST000000000000000A" })
      ).toString("base64url");

      mockQueryAllItems.mockResolvedValueOnce({ items, truncated: false });

      const event = createListEvent({ cursor });
      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.data).toHaveLength(1);
      expect(body.meta.cursorReset).toBe(true);
      expect(result.headers?.["X-Cursor-Reset"]).toBe("true");
    });

    it("paginates filtered results across multiple pages", async () => {
      // 5 items: 3 videos + 2 articles. Limit=2 so videos span 2 pages.
      const items = [
        createTestSaveItem("01SAVE0000000000000000001A", {
          contentType: ContentType.VIDEO,
          createdAt: "2026-02-25T00:00:00Z",
        }),
        createTestSaveItem("01SAVE0000000000000000002A", {
          contentType: ContentType.ARTICLE,
          createdAt: "2026-02-24T00:00:00Z",
        }),
        createTestSaveItem("01SAVE0000000000000000003A", {
          contentType: ContentType.VIDEO,
          createdAt: "2026-02-23T00:00:00Z",
        }),
        createTestSaveItem("01SAVE0000000000000000004A", {
          contentType: ContentType.ARTICLE,
          createdAt: "2026-02-22T00:00:00Z",
        }),
        createTestSaveItem("01SAVE0000000000000000005A", {
          contentType: ContentType.VIDEO,
          createdAt: "2026-02-21T00:00:00Z",
        }),
      ];

      // Page 1: filter=video, limit=2
      mockQueryAllItems.mockResolvedValueOnce({ items, truncated: false });
      const page1Event = createListEvent({ contentType: "video", limit: "2" });
      const page1Result = await handler(page1Event, mockContext);
      const page1Body = JSON.parse(page1Result.body);

      expect(page1Body.data).toHaveLength(2);
      expect(page1Body.meta.cursor).not.toBeNull();

      // Page 2: same filter, use cursor from page 1
      mockQueryAllItems.mockResolvedValueOnce({ items, truncated: false });
      const page2Event = createListEvent({
        contentType: "video",
        limit: "2",
        cursor: page1Body.meta.cursor,
      });
      const page2Result = await handler(page2Event, mockContext);
      const page2Body = JSON.parse(page2Result.body);

      expect(page2Body.data).toHaveLength(1);
      expect(page2Body.meta.cursor).toBeNull();
    });
  });

  // ──────────────────────────────────────────────────────────────
  // Story 3.1.7 — API key scope enforcement tests
  // ──────────────────────────────────────────────────────────────

  describe("AC6: API key scope enforcement", () => {
    it("rejects capture-only key (saves:write) with 403 SCOPE_INSUFFICIENT", async () => {
      const event = createMockEvent({
        method: "GET",
        path: "/saves",
        userId: "user_123",
        authMethod: "api-key",
        scopes: ["saves:write"],
      });
      const result = await handler(event, mockContext);

      assertADR008Error(result, ErrorCode.SCOPE_INSUFFICIENT, 403);
    });

    it("rejects API key with empty scopes with 403 SCOPE_INSUFFICIENT", async () => {
      const event = createMockEvent({
        method: "GET",
        path: "/saves",
        userId: "user_123",
        authMethod: "api-key",
        scopes: [],
      });
      const result = await handler(event, mockContext);

      assertADR008Error(result, ErrorCode.SCOPE_INSUFFICIENT, 403);
    });

    it("allows full-access key (*) to GET /saves", async () => {
      mockQueryAllItems.mockResolvedValueOnce({ items: [] });

      const event = createMockEvent({
        method: "GET",
        path: "/saves",
        userId: "user_123",
        authMethod: "api-key",
        scopes: ["*"],
      });
      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(200);
    });
  });
});
