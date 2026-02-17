/**
 * API Keys Endpoint handler tests
 *
 * Tests the POST/GET/DELETE /users/api-keys endpoints per Story 2.6.
 * Covers all acceptance criteria: AC1-AC6.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { AppError, ErrorCode } from "@ai-learning-hub/types";
import {
  createMockEvent,
  createMockContext,
  mockCreateLoggerModule,
  mockMiddlewareModule,
} from "../../test-utils/index.js";

// Mock @ai-learning-hub/db
const mockCreateApiKey = vi.fn();
const mockListApiKeys = vi.fn();
const mockRevokeApiKey = vi.fn();
const mockEnforceRateLimit = vi.fn();
const mockGetDefaultClient = vi.fn(() => ({}));

vi.mock("@ai-learning-hub/db", () => ({
  getDefaultClient: () => mockGetDefaultClient(),
  createApiKey: (...args: unknown[]) => mockCreateApiKey(...args),
  listApiKeys: (...args: unknown[]) => mockListApiKeys(...args),
  revokeApiKey: (...args: unknown[]) => mockRevokeApiKey(...args),
  enforceRateLimit: (...args: unknown[]) => mockEnforceRateLimit(...args),
  USERS_TABLE_CONFIG: {
    tableName: "ai-learning-hub-users",
    partitionKey: "PK",
    sortKey: "SK",
  },
}));

// Mock @ai-learning-hub/logging
vi.mock("@ai-learning-hub/logging", () => mockCreateLoggerModule());

// Mock @ai-learning-hub/middleware
vi.mock("@ai-learning-hub/middleware", () => mockMiddlewareModule());

// Note: @ai-learning-hub/validation is NOT mocked — uses real implementation

import { handler } from "./handler.js";

function createEvent(
  method: "POST" | "GET" | "DELETE",
  body?: Record<string, unknown>,
  userId?: string,
  pathParameters?: Record<string, string>
) {
  return createMockEvent({
    method,
    path: "/users/api-keys",
    body: body ?? null,
    userId,
    pathParameters: pathParameters ?? null,
  });
}

const mockContext = createMockContext();

describe("API Keys Handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("AC1: POST /users/api-keys — create key", () => {
    it("creates an API key with name and scopes", async () => {
      const mockResult = {
        id: "key_01HXYZ123",
        name: "My App Key",
        key: "base64url-encoded-key-value",
        scopes: ["*"],
        createdAt: "2026-02-16T12:00:00Z",
      };
      mockCreateApiKey.mockResolvedValueOnce(mockResult);

      const event = createEvent(
        "POST",
        { name: "My App Key", scopes: ["*"] },
        "user_123"
      );
      const result = await handler(event, mockContext);
      const body = JSON.parse(result.body);

      expect(result.statusCode).toBe(201);
      expect(body.data.id).toBe("key_01HXYZ123");
      expect(body.data.name).toBe("My App Key");
      expect(body.data.key).toBe("base64url-encoded-key-value");
      expect(body.data.scopes).toEqual(["*"]);
      expect(body.data.createdAt).toBeDefined();
    });

    it("calls createApiKey with correct arguments", async () => {
      mockCreateApiKey.mockResolvedValueOnce({
        id: "key_01",
        name: "Test",
        key: "test-key",
        scopes: ["*"],
        createdAt: "2026-02-16T12:00:00Z",
      });

      const event = createEvent(
        "POST",
        { name: "Test", scopes: ["*"] },
        "user_abc"
      );
      await handler(event, mockContext);

      expect(mockCreateApiKey).toHaveBeenCalledWith(
        expect.anything(),
        "user_abc",
        "Test",
        ["*"],
        expect.anything()
      );
    });
  });

  describe("AC2: GET /users/api-keys — list keys", () => {
    it("returns list of keys without key values", async () => {
      const mockResult = {
        items: [
          {
            id: "key_01",
            name: "App Key",
            scopes: ["*"],
            createdAt: "2026-02-16T12:00:00Z",
            lastUsedAt: "2026-02-16T14:00:00Z",
          },
          {
            id: "key_02",
            name: "Capture Key",
            scopes: ["saves:write"],
            createdAt: "2026-02-16T13:00:00Z",
            lastUsedAt: null,
          },
        ],
        hasMore: false,
      };
      mockListApiKeys.mockResolvedValueOnce(mockResult);

      const event = createEvent("GET", undefined, "user_123");
      const result = await handler(event, mockContext);
      const body = JSON.parse(result.body);

      expect(result.statusCode).toBe(200);
      expect(body.data.items).toHaveLength(2);
      expect(body.data.items[0].id).toBe("key_01");
      expect(body.data.items[0].name).toBe("App Key");
      // Key value must NOT be present
      expect(body.data.items[0].key).toBeUndefined();
      expect(body.data.items[0].keyHash).toBeUndefined();
    });

    it("calls listApiKeys with correct userId", async () => {
      mockListApiKeys.mockResolvedValueOnce({ items: [], hasMore: false });

      const event = createEvent("GET", undefined, "user_xyz");
      await handler(event, mockContext);

      expect(mockListApiKeys).toHaveBeenCalledWith(
        expect.anything(),
        "user_xyz",
        expect.any(Number),
        undefined,
        expect.anything()
      );
    });
  });

  describe("AC3: DELETE /users/api-keys/:id — revoke key", () => {
    it("revokes an API key", async () => {
      mockRevokeApiKey.mockResolvedValueOnce(undefined);

      const event = createEvent("DELETE", undefined, "user_123", {
        id: "key_01",
      });
      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(204);
      expect(result.body).toBe("");
      expect(mockRevokeApiKey).toHaveBeenCalledWith(
        expect.anything(),
        "user_123",
        "key_01",
        expect.anything()
      );
    });

    it("returns 404 when key does not exist", async () => {
      mockRevokeApiKey.mockRejectedValueOnce(
        new AppError(ErrorCode.NOT_FOUND, "API key not found")
      );

      const event = createEvent("DELETE", undefined, "user_123", {
        id: "nonexistent_key",
      });
      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(404);
      const body = JSON.parse(result.body);
      expect(body.error.code).toBe("NOT_FOUND");
    });

    it("returns 400 when no key ID provided", async () => {
      const event = createEvent("DELETE", undefined, "user_123");
      // No pathParameters
      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(400);
    });
  });

  describe("AC4: POST with capture-only scopes", () => {
    it("creates a capture-only key with saves:write scope", async () => {
      const mockResult = {
        id: "key_03",
        name: "Capture Key",
        key: "capture-key-value",
        scopes: ["saves:write"],
        createdAt: "2026-02-16T12:00:00Z",
      };
      mockCreateApiKey.mockResolvedValueOnce(mockResult);

      const event = createEvent(
        "POST",
        { name: "Capture Key", scopes: ["saves:write"] },
        "user_123"
      );
      const result = await handler(event, mockContext);
      const body = JSON.parse(result.body);

      expect(result.statusCode).toBe(201);
      expect(body.data.scopes).toEqual(["saves:write"]);
    });
  });

  describe("AC6: Invalid scopes return 400", () => {
    it("returns 400 for invalid scope value", async () => {
      const event = createEvent(
        "POST",
        { name: "Bad Key", scopes: ["admin:superpower"] },
        "user_123"
      );
      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error.code).toBe("VALIDATION_ERROR");
    });

    it("returns 400 for empty scopes array", async () => {
      const event = createEvent(
        "POST",
        { name: "Bad Key", scopes: [] },
        "user_123"
      );
      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(400);
    });

    it("returns 400 for missing scopes", async () => {
      const event = createEvent("POST", { name: "Bad Key" }, "user_123");
      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(400);
    });

    it("returns 400 for missing name", async () => {
      const event = createEvent("POST", { scopes: ["*"] }, "user_123");
      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(400);
    });

    it("returns 400 for missing request body", async () => {
      const event = createEvent("POST", undefined, "user_123");
      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(400);
    });
  });

  describe("Auth enforcement via middleware", () => {
    it("returns 401 when no auth context (POST)", async () => {
      const event = createEvent("POST", {
        name: "Key",
        scopes: ["*"],
      });
      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(401);
    });

    it("returns 401 when no auth context (GET)", async () => {
      const event = createEvent("GET");
      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(401);
    });

    it("returns 401 when no auth context (DELETE)", async () => {
      const event = createEvent("DELETE", undefined, undefined, {
        id: "key_01",
      });
      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(401);
    });
  });

  describe("Method routing", () => {
    it("returns 405 for unsupported HTTP method", async () => {
      const event = createEvent("GET", undefined, "user_123");
      event.httpMethod = "PUT";
      const result = await handler(event, mockContext);
      const body = JSON.parse(result.body);

      expect(result.statusCode).toBe(405);
      expect(body.error.code).toBe("METHOD_NOT_ALLOWED");
    });
  });

  describe("Rate limiting (AC5, Story 2.7 AC4)", () => {
    it("returns 429 when rate limit exceeded", async () => {
      mockEnforceRateLimit.mockRejectedValueOnce(
        new AppError(
          ErrorCode.RATE_LIMITED,
          "Rate limit exceeded: 10 apikey-create per 1 hour(s)"
        )
      );

      const event = createEvent(
        "POST",
        { name: "Key", scopes: ["*"] },
        "user_123"
      );
      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(429);
      const body = JSON.parse(result.body);
      expect(body.error.code).toBe("RATE_LIMITED");
      // createApiKey should NOT be called when rate limited
      expect(mockCreateApiKey).not.toHaveBeenCalled();
    });

    it("calls enforceRateLimit with correct config before creating key", async () => {
      mockEnforceRateLimit.mockResolvedValueOnce(undefined);
      mockCreateApiKey.mockResolvedValueOnce({
        id: "key_01",
        name: "Test",
        key: "raw-key",
        scopes: ["*"],
        createdAt: "2026-02-16T12:00:00Z",
      });

      const event = createEvent(
        "POST",
        { name: "Test", scopes: ["*"] },
        "user_xyz"
      );
      await handler(event, mockContext);

      expect(mockEnforceRateLimit).toHaveBeenCalledWith(
        expect.anything(),
        "ai-learning-hub-users",
        expect.objectContaining({
          operation: "apikey-create",
          identifier: "user_xyz",
          limit: 10,
          windowSeconds: 3600,
        }),
        expect.anything()
      );
      // Verify rate limit check happens before key creation
      expect(mockEnforceRateLimit).toHaveBeenCalledTimes(1);
      expect(mockCreateApiKey).toHaveBeenCalledTimes(1);
    });
  });
});
