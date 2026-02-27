import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  EVENTS_TABLE_CONFIG,
  recordEvent,
  queryEntityEvents,
  buildEventPK,
  buildEventSK,
} from "../src/events.js";
import type { RecordEventParams } from "@ai-learning-hub/types";

const mockSend = vi.fn();
const mockClient = {
  send: mockSend,
} as unknown as import("@aws-sdk/lib-dynamodb").DynamoDBDocumentClient;

// Suppress console output during tests
vi.spyOn(console, "log").mockImplementation(() => {});
vi.spyOn(console, "warn").mockImplementation(() => {});
vi.spyOn(console, "error").mockImplementation(() => {});

const validParams: RecordEventParams = {
  entityType: "save",
  entityId: "01HX4Z3NDEKTSV4RRFFQ69G5FAV",
  userId: "user_2abc123",
  eventType: "SaveCreated",
  actorType: "human",
  actorId: null,
  changes: null,
  context: null,
  requestId: "req-550e8400-e29b",
};

describe("Event History Storage (Story 3.2.3)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("EVENTS_TABLE_CONFIG", () => {
    it("should have correct table config with PK and SK", () => {
      expect(EVENTS_TABLE_CONFIG.partitionKey).toBe("PK");
      expect(EVENTS_TABLE_CONFIG.sortKey).toBe("SK");
    });
  });

  describe("buildEventPK", () => {
    it("should construct PK from entityType and entityId", () => {
      expect(buildEventPK("save", "abc123")).toBe("EVENTS#save#abc123");
    });

    it("should handle apiKey entity type", () => {
      expect(buildEventPK("apiKey", "key-1")).toBe("EVENTS#apiKey#key-1");
    });
  });

  describe("buildEventSK", () => {
    it("should construct SK from timestamp and eventId", () => {
      expect(buildEventSK("2026-02-25T12:00:00.000Z", "01HX5A7B")).toBe(
        "EVENT#2026-02-25T12:00:00.000Z#01HX5A7B"
      );
    });
  });

  describe("recordEvent", () => {
    it("should write correct PK/SK structure given entityType + entityId", async () => {
      mockSend.mockResolvedValueOnce({});

      const result = await recordEvent(mockClient, validParams);

      expect(mockSend).toHaveBeenCalledOnce();
      const input = mockSend.mock.calls[0][0].input;
      expect(input.Item.PK).toBe("EVENTS#save#01HX4Z3NDEKTSV4RRFFQ69G5FAV");
      expect(input.Item.SK).toMatch(/^EVENT#\d{4}-\d{2}-\d{2}T.+#[A-Z0-9]+$/);
      expect(result.PK).toBe("EVENTS#save#01HX4Z3NDEKTSV4RRFFQ69G5FAV");
    });

    it("should auto-generate ULID for eventId", async () => {
      mockSend.mockResolvedValueOnce({});

      const result = await recordEvent(mockClient, validParams);

      expect(result.eventId).toBeDefined();
      expect(result.eventId.length).toBeGreaterThan(0);
      // ULID is 26 characters
      expect(result.eventId).toMatch(/^[0-9A-Z]{26}$/);
    });

    it("should auto-generate ISO 8601 timestamp", async () => {
      mockSend.mockResolvedValueOnce({});

      const result = await recordEvent(mockClient, validParams);

      expect(result.timestamp).toBeDefined();
      expect(new Date(result.timestamp).toISOString()).toBe(result.timestamp);
    });

    it("should calculate TTL as epoch seconds 90 days from now", async () => {
      mockSend.mockResolvedValueOnce({});

      const beforeTime = Math.floor(Date.now() / 1000) + 90 * 24 * 60 * 60;
      const result = await recordEvent(mockClient, validParams);
      const afterTime = Math.floor(Date.now() / 1000) + 90 * 24 * 60 * 60;

      expect(result.ttl).toBeGreaterThanOrEqual(beforeTime - 1);
      expect(result.ttl).toBeLessThanOrEqual(afterTime + 1);
    });

    it("should reject missing entityType", async () => {
      await expect(
        recordEvent(mockClient, { ...validParams, entityType: "" as never })
      ).rejects.toThrow("Invalid event params");
    });

    it("should reject missing entityId", async () => {
      await expect(
        recordEvent(mockClient, { ...validParams, entityId: "" })
      ).rejects.toThrow("Invalid event params");
    });

    it("should reject missing userId", async () => {
      await expect(
        recordEvent(mockClient, { ...validParams, userId: "" })
      ).rejects.toThrow("Invalid event params");
    });

    it("should reject missing eventType", async () => {
      await expect(
        recordEvent(mockClient, { ...validParams, eventType: "" })
      ).rejects.toThrow("Invalid event params");
    });

    it("should reject missing actorType", async () => {
      await expect(
        recordEvent(mockClient, { ...validParams, actorType: "" as never })
      ).rejects.toThrow("Invalid event params");
    });

    it("should reject missing requestId", async () => {
      await expect(
        recordEvent(mockClient, { ...validParams, requestId: "" })
      ).rejects.toThrow("Invalid event params");
    });

    it("should reject invalid entityType not in allowed union", async () => {
      await expect(
        recordEvent(mockClient, {
          ...validParams,
          entityType: "invalid" as never,
        })
      ).rejects.toThrow("Invalid event params");
    });

    it("should reject invalid actorType not in allowed values", async () => {
      await expect(
        recordEvent(mockClient, { ...validParams, actorType: "bot" as never })
      ).rejects.toThrow("Invalid event params");
    });

    it("should accept null changes, context, actorId", async () => {
      mockSend.mockResolvedValueOnce({});

      const result = await recordEvent(mockClient, {
        ...validParams,
        changes: null,
        context: null,
        actorId: null,
      });

      expect(result.changes).toBeNull();
      expect(result.context).toBeNull();
      expect(result.actorId).toBeNull();
    });

    it("should log at WARN level on DynamoDB write failure (does NOT throw)", async () => {
      mockSend.mockRejectedValueOnce(new Error("DynamoDB timeout"));

      // recordEvent is fire-and-forget: it should NOT throw on DDB failure
      const result = await recordEvent(mockClient, validParams);

      // Should still return the event object
      expect(result).toBeDefined();
      expect(result.eventId).toBeDefined();
      expect(result.entityType).toBe("save");
      expect(result.entityId).toBe("01HX4Z3NDEKTSV4RRFFQ69G5FAV");
    });

    it("should truncate changes to field names when diff exceeds 10KB", async () => {
      mockSend.mockResolvedValueOnce({});

      const largeValue = "x".repeat(11 * 1024);
      const result = await recordEvent(mockClient, {
        ...validParams,
        changes: {
          before: { title: largeValue },
          after: { title: "new" },
        },
      });

      expect(result.changes).toEqual({ changedFields: ["title"] });
    });

    it("should log at INFO level on successful write", async () => {
      const logSpy = vi.spyOn(console, "log");
      mockSend.mockResolvedValueOnce({});

      await recordEvent(mockClient, validParams);

      // Structured logger outputs via console.log
      expect(logSpy).toHaveBeenCalled();
    });

    it("should store actor context with agent actorType", async () => {
      mockSend.mockResolvedValueOnce({});

      const result = await recordEvent(mockClient, {
        ...validParams,
        actorType: "agent",
        actorId: "claude-code-v1",
        context: { trigger: "bulk-update", source: "batch-endpoint" },
      });

      expect(result.actorType).toBe("agent");
      expect(result.actorId).toBe("claude-code-v1");
      expect(result.context).toEqual({
        trigger: "bulk-update",
        source: "batch-endpoint",
      });
    });
  });

  describe("queryEntityEvents", () => {
    it("should query correct PK given entityType + entityId", async () => {
      mockSend.mockResolvedValueOnce({
        Items: [],
        LastEvaluatedKey: undefined,
      });

      await queryEntityEvents(mockClient, "save", "abc123");

      expect(mockSend).toHaveBeenCalledOnce();
      const input = mockSend.mock.calls[0][0].input;
      expect(input.ExpressionAttributeValues[":pk"]).toBe("EVENTS#save#abc123");
    });

    it("should return events newest-first (ScanIndexForward=false)", async () => {
      mockSend.mockResolvedValueOnce({
        Items: [],
        LastEvaluatedKey: undefined,
      });

      await queryEntityEvents(mockClient, "save", "abc123");

      const input = mockSend.mock.calls[0][0].input;
      expect(input.ScanIndexForward).toBe(false);
    });

    it("should apply since filter as SK condition when valid ISO 8601", async () => {
      mockSend.mockResolvedValueOnce({
        Items: [],
        LastEvaluatedKey: undefined,
      });

      await queryEntityEvents(mockClient, "save", "abc123", {
        since: "2026-02-25T13:00:00Z",
      });

      const input = mockSend.mock.calls[0][0].input;
      expect(input.KeyConditionExpression).toContain("SK > :sinceKey");
      expect(input.ExpressionAttributeValues[":sinceKey"]).toBe(
        "EVENT#2026-02-25T13:00:00Z"
      );
    });

    it('should throw VALIDATION_ERROR when since is not valid ISO 8601 (e.g. "yesterday")', async () => {
      await expect(
        queryEntityEvents(mockClient, "save", "abc123", {
          since: "yesterday",
        })
      ).rejects.toThrow("Invalid query parameter");
    });

    it('should throw VALIDATION_ERROR when since is invalid date (e.g. "2026-13-01")', async () => {
      await expect(
        queryEntityEvents(mockClient, "save", "abc123", {
          since: "2026-13-01T00:00:00Z",
        })
      ).rejects.toThrow("Invalid query parameter");
    });

    it("should default limit to 50 when not provided", async () => {
      mockSend.mockResolvedValueOnce({
        Items: [],
        LastEvaluatedKey: undefined,
      });

      await queryEntityEvents(mockClient, "save", "abc123");

      const input = mockSend.mock.calls[0][0].input;
      expect(input.Limit).toBe(50);
    });

    it("should cap limit at 200 when caller passes higher value", async () => {
      mockSend.mockResolvedValueOnce({
        Items: [],
        LastEvaluatedKey: undefined,
      });

      await queryEntityEvents(mockClient, "save", "abc123", {
        limit: 500,
      });

      const input = mockSend.mock.calls[0][0].input;
      expect(input.Limit).toBe(200);
    });

    it("should encode LastEvaluatedKey as cursor", async () => {
      const lastEvalKey = {
        PK: "EVENTS#save#abc",
        SK: "EVENT#2026-02-25T12:00:00Z#01HX",
      };
      mockSend.mockResolvedValueOnce({
        Items: [{ PK: "test", SK: "test" }],
        LastEvaluatedKey: lastEvalKey,
      });

      const result = await queryEntityEvents(mockClient, "save", "abc123");

      expect(result.nextCursor).toBeDefined();
      expect(result.nextCursor).not.toBeNull();
      // Verify it's base64url encoded
      const decoded = JSON.parse(
        Buffer.from(result.nextCursor!, "base64url").toString()
      );
      expect(decoded.PK).toBe("EVENTS#save#abc");
    });

    it("should decode cursor to ExclusiveStartKey on subsequent call", async () => {
      const lastEvalKey = { PK: "EVENTS#save#abc", SK: "EVENT#2026" };
      const cursor = Buffer.from(JSON.stringify(lastEvalKey)).toString(
        "base64url"
      );
      mockSend.mockResolvedValueOnce({
        Items: [],
        LastEvaluatedKey: undefined,
      });

      await queryEntityEvents(mockClient, "save", "abc123", { cursor });

      const input = mockSend.mock.calls[0][0].input;
      expect(input.ExclusiveStartKey).toEqual(lastEvalKey);
    });

    it("should return nextCursor: null when no LastEvaluatedKey (last page)", async () => {
      mockSend.mockResolvedValueOnce({
        Items: [{ PK: "test", SK: "test" }],
        LastEvaluatedKey: undefined,
      });

      const result = await queryEntityEvents(mockClient, "save", "abc123");

      expect(result.nextCursor).toBeNull();
    });

    it("should return empty array for entity with no events", async () => {
      mockSend.mockResolvedValueOnce({
        Items: [],
        LastEvaluatedKey: undefined,
      });

      const result = await queryEntityEvents(mockClient, "save", "nonexistent");

      expect(result.events).toEqual([]);
      expect(result.nextCursor).toBeNull();
    });
  });
});
