import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createErrorResponse,
  normalizeError,
  handleError,
  createSuccessResponse,
  createNoContentResponse,
} from "../src/error-handler.js";
import { AppError, ErrorCode } from "@ai-learning-hub/types";
import type { Logger } from "@ai-learning-hub/logging";

describe("Error Handler", () => {
  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  describe("createErrorResponse", () => {
    it("should create error response with correct structure", () => {
      const error = new AppError(ErrorCode.NOT_FOUND, "User not found");
      const response = createErrorResponse(error, "req-123");

      expect(response.statusCode).toBe(404);
      expect(response.headers?.["Content-Type"]).toBe("application/json");
      expect(response.headers?.["X-Request-Id"]).toBe("req-123");

      const body = JSON.parse(response.body);
      expect(body.error.code).toBe("NOT_FOUND");
      expect(body.error.message).toBe("User not found");
      expect(body.error.requestId).toBe("req-123");
    });

    it("should include error details when present", () => {
      const error = new AppError(ErrorCode.VALIDATION_ERROR, "Invalid input", {
        field: "email",
      });
      const response = createErrorResponse(error, "req-456");
      const body = JSON.parse(response.body);

      expect(body.error.details?.field).toBe("email");
    });

    it("should include Retry-After header for RATE_LIMITED errors with retryAfter detail", () => {
      const error = new AppError(
        ErrorCode.RATE_LIMITED,
        "Rate limit exceeded",
        { retryAfter: 1800, limit: 10, current: 11 }
      );
      const response = createErrorResponse(error, "req-rate");

      expect(response.statusCode).toBe(429);
      expect(response.headers?.["Retry-After"]).toBe("1800");
      expect(response.headers?.["Content-Type"]).toBe("application/json");
      expect(response.headers?.["X-Request-Id"]).toBe("req-rate");
    });

    it("should not include Retry-After header for RATE_LIMITED errors without retryAfter detail", () => {
      const error = new AppError(ErrorCode.RATE_LIMITED, "Rate limit exceeded");
      const response = createErrorResponse(error, "req-rate-no-retry");

      expect(response.statusCode).toBe(429);
      expect(response.headers?.["Retry-After"]).toBeUndefined();
    });

    it("should not include Retry-After header for non-rate-limit errors", () => {
      const error = new AppError(ErrorCode.NOT_FOUND, "Not found", {
        retryAfter: 60,
      });
      const response = createErrorResponse(error, "req-other");

      expect(response.statusCode).toBe(404);
      expect(response.headers?.["Retry-After"]).toBeUndefined();
    });

    it("should include responseHeaders in HTTP headers (e.g., Allow for 405)", () => {
      const error = new AppError(
        ErrorCode.METHOD_NOT_ALLOWED,
        "Method PUT not allowed",
        { responseHeaders: { Allow: "GET, POST" } }
      );
      const response = createErrorResponse(error, "req-405");

      expect(response.statusCode).toBe(405);
      expect(response.headers?.["Allow"]).toBe("GET, POST");
      // responseHeaders must NOT leak into the response body
      const body = JSON.parse(response.body);
      expect(body.error.details).toBeUndefined();
    });

    it("should not allow responseHeaders to override Content-Type or X-Request-Id", () => {
      const error = new AppError(
        ErrorCode.METHOD_NOT_ALLOWED,
        "Method PUT not allowed",
        {
          responseHeaders: {
            "Content-Type": "text/html",
            "X-Request-Id": "attacker-id",
            Allow: "GET, POST",
          },
        }
      );
      const response = createErrorResponse(error, "req-protected");

      // Protected headers must not be overridden
      expect(response.headers?.["Content-Type"]).toBe("application/json");
      expect(response.headers?.["X-Request-Id"]).toBe("req-protected");
      // Non-protected headers should still be set
      expect(response.headers?.["Allow"]).toBe("GET, POST");
    });

    it("should ignore non-string values in responseHeaders", () => {
      const error = new AppError(
        ErrorCode.METHOD_NOT_ALLOWED,
        "Method PUT not allowed",
        {
          responseHeaders: {
            Allow: "GET",
            "X-Bad-Number": 42,
            "X-Bad-Object": { nested: true },
          },
        }
      );
      const response = createErrorResponse(error, "req-types");

      expect(response.headers?.["Allow"]).toBe("GET");
      expect(response.headers?.["X-Bad-Number"]).toBeUndefined();
      expect(response.headers?.["X-Bad-Object"]).toBeUndefined();
    });

    it("should handle responseHeaders being an array (not a plain object) gracefully", () => {
      const error = new AppError(
        ErrorCode.METHOD_NOT_ALLOWED,
        "Method PUT not allowed",
        { responseHeaders: ["Allow: GET"] }
      );
      const response = createErrorResponse(error, "req-array");

      expect(response.statusCode).toBe(405);
      // Array should be ignored, not crash
      expect(response.headers?.["Allow"]).toBeUndefined();
    });
  });

  describe("normalizeError", () => {
    it("should return AppError unchanged", () => {
      const appError = new AppError(ErrorCode.FORBIDDEN, "Access denied");
      const result = normalizeError(appError);

      expect(result).toBe(appError);
    });

    it("should convert regular Error to AppError", () => {
      const regularError = new Error("Something went wrong");
      const result = normalizeError(regularError);

      expect(AppError.isAppError(result)).toBe(true);
      expect(result.code).toBe(ErrorCode.INTERNAL_ERROR);
    });

    it("should handle non-Error objects", () => {
      const result = normalizeError("string error");

      expect(AppError.isAppError(result)).toBe(true);
      expect(result.code).toBe(ErrorCode.INTERNAL_ERROR);
    });

    it("should handle null", () => {
      const result = normalizeError(null);

      expect(AppError.isAppError(result)).toBe(true);
      expect(result.code).toBe(ErrorCode.INTERNAL_ERROR);
    });
  });

  describe("handleError", () => {
    it("should return API Gateway response", () => {
      const error = new AppError(ErrorCode.UNAUTHORIZED, "Token expired");
      const response = handleError(error, "req-789");

      expect(response.statusCode).toBe(401);
      expect(response.headers?.["X-Request-Id"]).toBe("req-789");
    });

    it("should normalize regular errors", () => {
      const regularError = new Error("Database connection failed");
      const response = handleError(regularError, "req-abc");

      expect(response.statusCode).toBe(500);
    });

    it("should use provided logger", () => {
      const mockLogger = {
        error: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
      };

      const error = new AppError(ErrorCode.RATE_LIMITED, "Too many requests");
      handleError(error, "req-def", mockLogger as unknown as Logger);

      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe("createSuccessResponse", () => {
    it("should create success response with data", () => {
      const data = { id: "123", name: "Test" };
      const response = createSuccessResponse(data, "req-123");

      expect(response.statusCode).toBe(200);
      expect(response.headers?.["Content-Type"]).toBe("application/json");
      expect(response.headers?.["X-Request-Id"]).toBe("req-123");

      const body = JSON.parse(response.body);
      expect(body.data).toEqual(data);
    });

    it("should accept optional meta (pagination etc.)", () => {
      const data = { items: [] };
      const meta = { nextCursor: "abc", pageSize: 20 };
      const response = createSuccessResponse(data, "req-meta", 200, meta);

      const body = JSON.parse(response.body);
      expect(body.data).toEqual(data);
      expect(body.meta).toEqual(meta);
    });

    it("should accept custom status code", () => {
      const data = { id: "456" };
      const response = createSuccessResponse(data, "req-456", 201);

      expect(response.statusCode).toBe(201);
    });
  });

  describe("createNoContentResponse", () => {
    it("should create 204 response", () => {
      const response = createNoContentResponse("req-789");

      expect(response.statusCode).toBe(204);
      expect(response.body).toBe("");
      expect(response.headers?.["X-Request-Id"]).toBe("req-789");
    });
  });
});
