import { describe, it, expect, vi, beforeEach } from "vitest";
import { createEventHistoryHandler } from "../src/event-history.js";
import type { HandlerContext } from "../src/wrapper.js";
import type { APIGatewayProxyEvent } from "aws-lambda";
import { AppError, ErrorCode, type EntityEvent } from "@ai-learning-hub/types";

// Mock queryEntityEvents
vi.mock("@ai-learning-hub/db", () => ({
  queryEntityEvents: vi.fn(),
}));

import { queryEntityEvents } from "@ai-learning-hub/db";

const mockQueryEntityEvents = vi.mocked(queryEntityEvents);

// Suppress console output during tests
vi.spyOn(console, "log").mockImplementation(() => {});
vi.spyOn(console, "warn").mockImplementation(() => {});
vi.spyOn(console, "error").mockImplementation(() => {});

const mockClient = {} as import("@aws-sdk/lib-dynamodb").DynamoDBDocumentClient;
const mockEntityExistsFn =
  vi.fn<(userId: string, entityId: string) => Promise<boolean>>();

function makeCtx(overrides: Partial<HandlerContext> = {}): HandlerContext {
  return {
    event: {
      pathParameters: { id: "entity-123" },
      queryStringParameters: null,
      httpMethod: "GET",
      path: "/saves/entity-123/events",
      body: null,
      isBase64Encoded: false,
      headers: {},
      multiValueHeaders: {},
      multiValueQueryStringParameters: null,
      requestContext: {} as APIGatewayProxyEvent["requestContext"],
      resource: "",
      stageVariables: null,
    } as HandlerContext["event"],
    context: {} as HandlerContext["context"],
    auth: { userId: "user_abc123", roles: [], isApiKey: false },
    agentId: null,
    actorType: "human",
    requestId: "req-test-123",
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      timed: vi.fn(),
      setRequestContext: vi.fn(),
    } as unknown as HandlerContext["logger"],
    startTime: Date.now(),
    ...overrides,
  };
}

describe("Event History Handler (Story 3.2.3)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEntityExistsFn.mockResolvedValue(true);
  });

  const handler = createEventHistoryHandler({
    entityType: "save",
    entityExistsFn: mockEntityExistsFn,
    client: mockClient,
  });

  describe("entity validation", () => {
    it("should throw VALIDATION_ERROR when entity ID is missing from path", async () => {
      const ctx = makeCtx({
        event: {
          ...makeCtx().event,
          pathParameters: null,
        } as HandlerContext["event"],
      });

      await expect(handler(ctx)).rejects.toMatchObject({
        code: ErrorCode.VALIDATION_ERROR,
        message: "Missing entity ID in path",
      });
    });

    it("should throw UNAUTHORIZED when auth is missing", async () => {
      const ctx = makeCtx({ auth: null });

      await expect(handler(ctx)).rejects.toMatchObject({
        code: ErrorCode.UNAUTHORIZED,
      });
    });

    it("should throw NOT_FOUND when entity does not exist for user", async () => {
      mockEntityExistsFn.mockResolvedValueOnce(false);

      await expect(handler(makeCtx())).rejects.toMatchObject({
        code: ErrorCode.NOT_FOUND,
        message: "Save not found",
      });
    });

    it("should pass correct userId and entityId to entityExistsFn", async () => {
      mockQueryEntityEvents.mockResolvedValueOnce({
        events: [],
        nextCursor: null,
      });

      await handler(makeCtx());

      expect(mockEntityExistsFn).toHaveBeenCalledWith(
        "user_abc123",
        "entity-123"
      );
    });

    it("should return events for soft-deleted entities when entityExistsFn returns true", async () => {
      // entityExistsFn returns true for soft-deleted entities per AC5
      mockEntityExistsFn.mockResolvedValueOnce(true);
      mockQueryEntityEvents.mockResolvedValueOnce({
        events: [
          {
            PK: "EVENTS#save#entity-123",
            SK: "EVENT#2026-02-25T12:00:00Z#01HX5A7B",
            eventId: "evt-softdel",
            entityType: "save",
            entityId: "entity-123",
            userId: "user_abc123",
            eventType: "SaveDeleted",
            actorType: "human",
            actorId: null,
            timestamp: "2026-02-25T12:00:00Z",
            changes: null,
            context: null,
            requestId: "req-123",
            ttl: 1740000000,
          },
        ],
        nextCursor: null,
      });

      const result = await handler(makeCtx());

      expect(result).toHaveProperty("statusCode", 200);
      const body = JSON.parse((result as { body: string }).body);
      expect(body.data).toHaveLength(1);
      expect(body.data[0].eventType).toBe("SaveDeleted");
    });
  });

  describe("query parameter parsing", () => {
    it("should pass since, limit, cursor from query string", async () => {
      mockQueryEntityEvents.mockResolvedValueOnce({
        events: [],
        nextCursor: null,
      });

      const ctx = makeCtx({
        event: {
          ...makeCtx().event,
          queryStringParameters: {
            since: "2026-02-25T12:00:00Z",
            limit: "25",
            cursor: "abc123cursor",
          },
        } as HandlerContext["event"],
      });

      await handler(ctx);

      expect(mockQueryEntityEvents).toHaveBeenCalledWith(
        mockClient,
        "save",
        "entity-123",
        { since: "2026-02-25T12:00:00Z", limit: 25, cursor: "abc123cursor" },
        expect.anything()
      );
    });

    it("should use default limit (25) when not provided", async () => {
      mockQueryEntityEvents.mockResolvedValueOnce({
        events: [],
        nextCursor: null,
      });

      await handler(makeCtx());

      expect(mockQueryEntityEvents).toHaveBeenCalledWith(
        mockClient,
        "save",
        "entity-123",
        { since: undefined, limit: 25, cursor: undefined },
        expect.anything()
      );
    });

    it("should throw VALIDATION_ERROR for non-numeric limit", async () => {
      const ctx = makeCtx({
        event: {
          ...makeCtx().event,
          queryStringParameters: { limit: "abc" },
        } as HandlerContext["event"],
      });

      await expect(handler(ctx)).rejects.toMatchObject({
        code: ErrorCode.VALIDATION_ERROR,
      });
    });

    it("should throw VALIDATION_ERROR for limit less than 1", async () => {
      const ctx = makeCtx({
        event: {
          ...makeCtx().event,
          queryStringParameters: { limit: "0" },
        } as HandlerContext["event"],
      });

      await expect(handler(ctx)).rejects.toMatchObject({
        code: ErrorCode.VALIDATION_ERROR,
      });
    });

    it("should propagate VALIDATION_ERROR for invalid since parameter", async () => {
      mockQueryEntityEvents.mockRejectedValueOnce(
        new AppError(ErrorCode.VALIDATION_ERROR, "Invalid query parameter", {
          fields: [
            {
              field: "since",
              message: "Must be ISO 8601 format",
              code: "invalid_string",
            },
          ],
        })
      );

      const ctx = makeCtx({
        event: {
          ...makeCtx().event,
          queryStringParameters: { since: "not-a-date" },
        } as HandlerContext["event"],
      });

      await expect(handler(ctx)).rejects.toMatchObject({
        code: ErrorCode.VALIDATION_ERROR,
        message: "Invalid query parameter",
      });
    });
  });

  describe("response envelope", () => {
    it("should return 200 with data array and meta containing cursor and total", async () => {
      const mockEvents: EntityEvent[] = [
        {
          PK: "EVENTS#save#entity-123",
          SK: "EVENT#2026-02-25T12:00:00Z#01HX5A7B",
          eventId: "evt1",
          entityType: "save",
          entityId: "entity-123",
          userId: "user_abc123",
          eventType: "SaveCreated",
          actorType: "human",
          actorId: null,
          timestamp: "2026-02-25T12:00:00Z",
          changes: null,
          context: null,
          requestId: "req-1",
          ttl: 1740000000,
        },
        {
          PK: "EVENTS#save#entity-123",
          SK: "EVENT#2026-02-25T13:00:00Z#01HX5B8C",
          eventId: "evt2",
          entityType: "save",
          entityId: "entity-123",
          userId: "user_abc123",
          eventType: "SaveUpdated",
          actorType: "human",
          actorId: null,
          timestamp: "2026-02-25T13:00:00Z",
          changes: null,
          context: null,
          requestId: "req-2",
          ttl: 1740000001,
        },
      ];
      mockQueryEntityEvents.mockResolvedValueOnce({
        events: mockEvents,
        nextCursor: "nextpage123",
      });

      const result = await handler(makeCtx());

      expect(result).toHaveProperty("statusCode", 200);
      const body = JSON.parse((result as { body: string }).body);
      expect(body.data).toHaveLength(2);
      expect(body.meta.cursor).toBe("nextpage123");
      expect(body.meta.total).toBe(2);
    });

    it("should strip PK, SK, and ttl from events in response", async () => {
      const mockEvents: EntityEvent[] = [
        {
          PK: "EVENTS#save#entity-123",
          SK: "EVENT#2026-02-25T12:00:00Z#01HX5A7B",
          eventId: "evt1",
          entityType: "save",
          entityId: "entity-123",
          userId: "user_abc123",
          eventType: "SaveCreated",
          actorType: "human",
          actorId: null,
          timestamp: "2026-02-25T12:00:00Z",
          changes: null,
          context: null,
          requestId: "req-1",
          ttl: 1740000000,
        },
      ];
      mockQueryEntityEvents.mockResolvedValueOnce({
        events: mockEvents,
        nextCursor: null,
      });

      const result = await handler(makeCtx());

      const body = JSON.parse((result as { body: string }).body);
      expect(body.data[0]).not.toHaveProperty("PK");
      expect(body.data[0]).not.toHaveProperty("SK");
      expect(body.data[0]).not.toHaveProperty("ttl");
      expect(body.data[0].eventId).toBe("evt1");
    });

    it("should return null cursor when no more pages", async () => {
      mockQueryEntityEvents.mockResolvedValueOnce({
        events: [
          {
            PK: "EVENTS#save#entity-123",
            SK: "EVENT#2026-02-25T12:00:00Z#01HX5A7B",
            eventId: "evt1",
            entityType: "save",
            entityId: "entity-123",
            userId: "user_abc123",
            eventType: "SaveCreated",
            actorType: "human",
            actorId: null,
            timestamp: "2026-02-25T12:00:00Z",
            changes: null,
            context: null,
            requestId: "req-1",
            ttl: 1740000000,
          },
        ],
        nextCursor: null,
      });

      const result = await handler(makeCtx());

      const body = JSON.parse((result as { body: string }).body);
      expect(body.meta.cursor).toBeNull();
    });

    it("should return empty data array for entity with no events", async () => {
      mockQueryEntityEvents.mockResolvedValueOnce({
        events: [],
        nextCursor: null,
      });

      const result = await handler(makeCtx());

      const body = JSON.parse((result as { body: string }).body);
      expect(body.data).toEqual([]);
      expect(body.meta.total).toBe(0);
      expect(body.meta.cursor).toBeNull();
    });

    it("should include X-Request-Id header in response", async () => {
      mockQueryEntityEvents.mockResolvedValueOnce({
        events: [],
        nextCursor: null,
      });

      const result = await handler(makeCtx());
      const headers = (result as { headers: Record<string, string> }).headers;

      expect(headers["X-Request-Id"]).toBe("req-test-123");
    });
  });

  describe("entity type capitalization in NOT_FOUND message", () => {
    it("should capitalize entity type in error message", async () => {
      mockEntityExistsFn.mockResolvedValueOnce(false);

      const apiKeyHandler = createEventHistoryHandler({
        entityType: "apiKey",
        entityExistsFn: mockEntityExistsFn,
        client: mockClient,
      });

      await expect(apiKeyHandler(makeCtx())).rejects.toMatchObject({
        message: "ApiKey not found",
      });
    });
  });
});
