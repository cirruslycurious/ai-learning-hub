import { describe, it, expect } from "vitest";
import type {
  ApiSuccessResponse,
  PaginationParams,
  PaginatedResponse,
  AuthContext,
  RequestContext,
} from "../src/api.js";

describe("API Types", () => {
  describe("ApiSuccessResponse", () => {
    it("should accept valid response shape", () => {
      const response: ApiSuccessResponse<{ id: string }> = {
        data: { id: "test-123" },
      };

      expect(response.data.id).toBe("test-123");
    });

    it("should accept response with meta", () => {
      const response: ApiSuccessResponse<string[]> = {
        data: ["a", "b", "c"],
        meta: {
          total: 100,
          page: 1,
          pageSize: 10,
        },
      };

      expect(response.data.length).toBe(3);
      expect(response.meta?.total).toBe(100);
    });
  });

  describe("PaginationParams", () => {
    it("should accept valid pagination parameters", () => {
      const params: PaginationParams = {
        limit: 20,
        cursor: "abc123",
      };

      expect(params.limit).toBe(20);
      expect(params.cursor).toBe("abc123");
    });

    it("should allow optional parameters", () => {
      const params: PaginationParams = {};

      expect(params.limit).toBeUndefined();
      expect(params.cursor).toBeUndefined();
    });
  });

  describe("PaginatedResponse", () => {
    it("should accept valid paginated response", () => {
      const response: PaginatedResponse<{ name: string }> = {
        items: [{ name: "test" }],
        nextCursor: "cursor123",
        hasMore: true,
      };

      expect(response.items.length).toBe(1);
      expect(response.hasMore).toBe(true);
    });
  });

  describe("AuthContext", () => {
    it("should accept JWT auth context", () => {
      const auth: AuthContext = {
        userId: "user_123",
        roles: ["user", "admin"],
        isApiKey: false,
      };

      expect(auth.userId).toBe("user_123");
      expect(auth.isApiKey).toBe(false);
    });

    it("should accept API key auth context", () => {
      const auth: AuthContext = {
        userId: "user_456",
        roles: ["user"],
        isApiKey: true,
        apiKeyId: "key_789",
        scopes: ["saves:write"],
      };

      expect(auth.isApiKey).toBe(true);
      expect(auth.apiKeyId).toBe("key_789");
      expect(auth.scopes).toContain("saves:write");
    });
  });

  describe("RequestContext", () => {
    it("should accept valid request context", () => {
      const ctx: RequestContext = {
        requestId: "req-123",
        traceId: "1-abc-def",
        auth: {
          userId: "user_123",
          roles: ["user"],
          isApiKey: false,
        },
        startTime: Date.now(),
      };

      expect(ctx.requestId).toBe("req-123");
      expect(ctx.traceId).toBe("1-abc-def");
      expect(ctx.auth?.userId).toBe("user_123");
    });
  });
});
