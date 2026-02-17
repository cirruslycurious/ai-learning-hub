/**
 * Invite Codes Endpoint handler tests
 *
 * Tests the POST/GET /users/invite-codes endpoints per Story 2.9.
 * Covers all acceptance criteria: AC1-AC7.
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
const mockCreateInviteCode = vi.fn();
const mockListInviteCodesByUser = vi.fn();
const mockToPublicInviteCode = vi.fn();
const mockEnforceRateLimit = vi.fn();
const mockGetDefaultClient = vi.fn(() => ({}));

vi.mock("@ai-learning-hub/db", () => ({
  getDefaultClient: () => mockGetDefaultClient(),
  createInviteCode: (...args: unknown[]) => mockCreateInviteCode(...args),
  listInviteCodesByUser: (...args: unknown[]) =>
    mockListInviteCodesByUser(...args),
  toPublicInviteCode: (...args: unknown[]) => mockToPublicInviteCode(...args),
  enforceRateLimit: (...args: unknown[]) => mockEnforceRateLimit(...args),
  INVITE_CODES_TABLE_CONFIG: {
    tableName: "ai-learning-hub-invite-codes",
    partitionKey: "PK",
    sortKey: "SK",
  },
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
  method: "POST" | "GET",
  userId?: string,
  queryStringParameters?: Record<string, string> | null
) {
  return createMockEvent({
    method,
    path: "/users/invite-codes",
    userId,
    queryStringParameters: queryStringParameters ?? null,
  });
}

const mockContext = createMockContext();

describe("Invite Codes Handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("AC1/AC2: POST /users/invite-codes — generate code", () => {
    it("generates an invite code and returns 201", async () => {
      const mockResult = {
        code: "AbCdEfGh12345678",
        generatedAt: "2026-02-16T12:00:00Z",
        expiresAt: "2026-02-23T12:00:00Z",
      };
      mockCreateInviteCode.mockResolvedValueOnce(mockResult);

      const event = createEvent("POST", "user_123");
      const result = await handler(event, mockContext);
      const body = JSON.parse(result.body);

      expect(result.statusCode).toBe(201);
      expect(body.data.code).toBe("AbCdEfGh12345678");
      expect(body.data.generatedAt).toBe("2026-02-16T12:00:00Z");
      expect(body.data.expiresAt).toBe("2026-02-23T12:00:00Z");
      expect(result.headers?.["X-Request-Id"]).toBe("test-req-id");
    });

    it("calls createInviteCode with correct userId", async () => {
      mockCreateInviteCode.mockResolvedValueOnce({
        code: "TestCode12345678",
        generatedAt: "2026-02-16T12:00:00Z",
        expiresAt: "2026-02-23T12:00:00Z",
      });

      const event = createEvent("POST", "user_abc");
      await handler(event, mockContext);

      expect(mockCreateInviteCode).toHaveBeenCalledWith(
        expect.anything(),
        "user_abc",
        undefined,
        expect.anything()
      );
    });
  });

  describe("AC5: POST rate limiting", () => {
    it("returns 429 when rate limit exceeded", async () => {
      expect.assertions(3);
      mockEnforceRateLimit.mockRejectedValueOnce(
        new AppError(
          ErrorCode.RATE_LIMITED,
          "Rate limit exceeded: 5 invite-generate per 1 day(s)"
        )
      );

      const event = createEvent("POST", "user_123");
      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(429);
      const body = JSON.parse(result.body);
      expect(body.error.code).toBe("RATE_LIMITED");
      // createInviteCode should NOT be called when rate limited
      expect(mockCreateInviteCode).not.toHaveBeenCalled();
    });

    it("calls enforceRateLimit with correct config before generating code", async () => {
      expect.assertions(3);
      mockEnforceRateLimit.mockResolvedValueOnce(undefined);
      mockCreateInviteCode.mockResolvedValueOnce({
        code: "TestCode12345678",
        generatedAt: "2026-02-16T12:00:00Z",
        expiresAt: "2026-02-23T12:00:00Z",
      });

      const event = createEvent("POST", "user_xyz");
      await handler(event, mockContext);

      expect(mockEnforceRateLimit).toHaveBeenCalledWith(
        expect.anything(),
        "ai-learning-hub-users",
        expect.objectContaining({
          operation: "invite-generate",
          identifier: "user_xyz",
          limit: 5,
          windowSeconds: 86400,
        }),
        expect.anything()
      );
      expect(mockEnforceRateLimit).toHaveBeenCalledTimes(1);
      expect(mockCreateInviteCode).toHaveBeenCalledTimes(1);
    });
  });

  describe("AC3/AC7: GET /users/invite-codes — list codes", () => {
    it("returns list of public invite codes", async () => {
      mockListInviteCodesByUser.mockResolvedValueOnce({
        items: [
          {
            PK: "CODE#AbCd12345678XXXX",
            SK: "META",
            code: "AbCd12345678XXXX",
            generatedBy: "user_123",
            generatedAt: "2026-02-16T12:00:00Z",
            expiresAt: "2026-02-23T12:00:00Z",
            redeemedBy: "user_456",
            redeemedAt: "2026-02-17T10:00:00Z",
          },
          {
            PK: "CODE#EfGh87654321YYYY",
            SK: "META",
            code: "EfGh87654321YYYY",
            generatedBy: "user_123",
            generatedAt: "2026-02-15T12:00:00Z",
            expiresAt: "2026-02-22T12:00:00Z",
          },
        ],
        hasMore: false,
      });

      mockToPublicInviteCode
        .mockReturnValueOnce({
          code: "AbCd****",
          status: "redeemed",
          generatedAt: "2026-02-16T12:00:00Z",
          expiresAt: "2026-02-23T12:00:00Z",
          redeemedAt: "2026-02-17T10:00:00Z",
        })
        .mockReturnValueOnce({
          code: "EfGh87654321YYYY",
          status: "active",
          generatedAt: "2026-02-15T12:00:00Z",
          expiresAt: "2026-02-22T12:00:00Z",
        });

      const event = createEvent("GET", "user_123");
      const result = await handler(event, mockContext);
      const body = JSON.parse(result.body);

      expect(result.statusCode).toBe(200);
      expect(body.data.items).toHaveLength(2);
      expect(body.data.items[0].code).toBe("AbCd****");
      expect(body.data.items[0].status).toBe("redeemed");
      expect(body.data.items[1].code).toBe("EfGh87654321YYYY");
      expect(body.data.items[1].status).toBe("active");
    });

    it("forwards pagination params to listInviteCodesByUser", async () => {
      mockListInviteCodesByUser.mockResolvedValueOnce({
        items: [],
        hasMore: false,
      });

      const event = createEvent("GET", "user_123", {
        limit: "5",
        cursor: "some-cursor",
      });
      await handler(event, mockContext);

      expect(mockListInviteCodesByUser).toHaveBeenCalledWith(
        expect.anything(),
        "user_123",
        5,
        "some-cursor",
        expect.anything()
      );
    });
  });

  describe("AC6: Auth enforcement via middleware", () => {
    it("returns 401 when no auth context (POST)", async () => {
      const event = createEvent("POST");
      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(401);
    });

    it("returns 401 when no auth context (GET)", async () => {
      const event = createEvent("GET");
      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(401);
    });
  });

  describe("Method routing", () => {
    it("returns 405 for unsupported HTTP method (PUT)", async () => {
      const event = createEvent("GET", "user_123");
      event.httpMethod = "PUT";
      const result = await handler(event, mockContext);
      const body = JSON.parse(result.body);

      expect(result.statusCode).toBe(405);
      expect(body.error.code).toBe("METHOD_NOT_ALLOWED");
      expect(result.headers?.Allow).toBe("POST, GET");
    });
  });
});
