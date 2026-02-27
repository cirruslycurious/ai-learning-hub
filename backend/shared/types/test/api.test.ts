import { describe, it, expect } from "vitest";
import type {
  ApiSuccessResponse,
  EnvelopeMeta,
  RateLimitMeta,
  ResponseLinks,
  ResponseEnvelope,
  FieldValidationError,
  PaginationParams,
  PaginationOptions,
  PaginatedResponse,
  CursorPayload,
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

    it("should accept response with EnvelopeMeta", () => {
      const response: ApiSuccessResponse<string[]> = {
        data: ["a", "b", "c"],
        meta: {
          total: 100,
          cursor: "abc123",
        },
      };

      expect(response.data.length).toBe(3);
      expect(response.meta?.total).toBe(100);
      expect(response.meta?.cursor).toBe("abc123");
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

  describe("PaginatedResponse (Story 3.2.5)", () => {
    it("should accept response with cursor", () => {
      const response: PaginatedResponse<{ name: string }> = {
        items: [{ name: "test" }],
        cursor: "cursor123",
      };

      expect(response.items.length).toBe(1);
      expect(response.cursor).toBe("cursor123");
    });

    it("should accept response without cursor (last page)", () => {
      const response: PaginatedResponse<{ name: string }> = {
        items: [{ name: "test" }],
      };

      expect(response.items.length).toBe(1);
      expect(response.cursor).toBeUndefined();
    });
  });

  describe("CursorPayload (Story 3.2.5)", () => {
    it("should accept any record shape", () => {
      const payload: CursorPayload = { PK: "USER#123", SK: "SAVE#abc" };
      expect(payload.PK).toBe("USER#123");
    });
  });

  describe("PaginationOptions (Story 3.2.5)", () => {
    it("should accept limit and cursor", () => {
      const opts: PaginationOptions = { limit: 25, cursor: "abc" };
      expect(opts.limit).toBe(25);
    });

    it("PaginationParams is alias for PaginationOptions", () => {
      const params: PaginationParams = { limit: 10 };
      const opts: PaginationOptions = params;
      expect(opts.limit).toBe(10);
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

  describe("EnvelopeMeta (AC11)", () => {
    it("should accept cursor and total", () => {
      const meta: EnvelopeMeta = {
        cursor: "eyJ...",
        total: 42,
      };
      expect(meta.cursor).toBe("eyJ...");
      expect(meta.total).toBe(42);
    });

    it("should accept null cursor (last page)", () => {
      const meta: EnvelopeMeta = {
        cursor: null,
        total: 10,
      };
      expect(meta.cursor).toBeNull();
    });

    it("should accept rateLimit", () => {
      const meta: EnvelopeMeta = {
        rateLimit: {
          limit: 200,
          remaining: 198,
          reset: "2026-02-25T13:00:00Z",
        },
      };
      expect(meta.rateLimit?.limit).toBe(200);
      expect(meta.rateLimit?.remaining).toBe(198);
    });
  });

  describe("RateLimitMeta", () => {
    it("should require all fields", () => {
      const rl: RateLimitMeta = {
        limit: 100,
        remaining: 99,
        reset: "2026-02-25T13:00:00Z",
      };
      expect(rl.limit).toBe(100);
      expect(rl.reset).toBe("2026-02-25T13:00:00Z");
    });
  });

  describe("ResponseLinks (AC9)", () => {
    it("should accept self and next", () => {
      const links: ResponseLinks = {
        self: "/saves?limit=25",
        next: "/saves?limit=25&cursor=eyJ...",
      };
      expect(links.self).toBe("/saves?limit=25");
      expect(links.next).toContain("cursor=");
    });

    it("should accept null next (last page)", () => {
      const links: ResponseLinks = {
        self: "/saves?limit=25",
        next: null,
      };
      expect(links.next).toBeNull();
    });
  });

  describe("ResponseEnvelope (AC9)", () => {
    it("should accept data only", () => {
      const envelope: ResponseEnvelope<{ id: string }> = {
        data: { id: "123" },
      };
      expect(envelope.data.id).toBe("123");
      expect(envelope.meta).toBeUndefined();
      expect(envelope.links).toBeUndefined();
    });

    it("should accept full envelope with meta and links", () => {
      const envelope: ResponseEnvelope<{ id: string }[]> = {
        data: [{ id: "1" }, { id: "2" }],
        meta: {
          cursor: "abc",
          total: 42,
          rateLimit: {
            limit: 200,
            remaining: 198,
            reset: "2026-02-25T13:00:00Z",
          },
        },
        links: {
          self: "/saves?limit=25",
          next: "/saves?limit=25&cursor=abc",
        },
      };
      expect(envelope.data).toHaveLength(2);
      expect(envelope.meta?.total).toBe(42);
      expect(envelope.links?.self).toBe("/saves?limit=25");
    });
  });

  describe("FieldValidationError (AC14)", () => {
    it("should accept minimal field validation error", () => {
      const err: FieldValidationError = {
        field: "email",
        message: "Invalid email address",
        code: "invalid_string",
      };
      expect(err.field).toBe("email");
      expect(err.message).toBe("Invalid email address");
      expect(err.code).toBe("invalid_string");
      expect(err.constraint).toBeUndefined();
      expect(err.allowed_values).toBeUndefined();
    });

    it("should accept field validation error with constraint and allowed_values", () => {
      const err: FieldValidationError = {
        field: "contentType",
        message: "Invalid enum value",
        code: "invalid_enum_value",
        constraint: "must be one of the allowed values",
        allowed_values: ["article", "video", "podcast"],
      };
      expect(err.constraint).toBe("must be one of the allowed values");
      expect(err.allowed_values).toEqual(["article", "video", "podcast"]);
    });
  });
});
