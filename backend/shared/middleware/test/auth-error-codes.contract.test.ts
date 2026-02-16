/**
 * Contract tests for auth error codes flowing through middleware (Story 2.8, AC1/AC2/AC4/AC5)
 *
 * Verifies that auth-specific error codes produce correct HTTP status and ADR-008 body shape
 * when thrown as AppError through createErrorResponse.
 */
import { describe, it, expect } from "vitest";
import { AppError, ErrorCode, ErrorCodeToStatus } from "@ai-learning-hub/types";
import { createErrorResponse } from "../src/error-handler.js";

describe("Auth Error Codes Contract Tests", () => {
  const REQUEST_ID = "contract-test-req-id";

  describe("SCOPE_INSUFFICIENT flows through middleware (AC4)", () => {
    it("returns 403 with SCOPE_INSUFFICIENT code and ADR-008 body", () => {
      expect.assertions(6);

      const error = new AppError(
        ErrorCode.SCOPE_INSUFFICIENT,
        "API key lacks required scope",
        { requiredScope: "saves:write", keyScopes: ["saves:read"] }
      );

      const response = createErrorResponse(error, REQUEST_ID);
      const body = JSON.parse(response.body);

      expect(response.statusCode).toBe(403);
      expect(body.error.code).toBe("SCOPE_INSUFFICIENT");
      expect(body.error.message).toBe("API key lacks required scope");
      expect(body.error.requestId).toBe(REQUEST_ID);
      expect(body.error.details).toEqual({
        requiredScope: "saves:write",
        keyScopes: ["saves:read"],
      });
      expect(response.headers?.["X-Request-Id"]).toBe(REQUEST_ID);
    });
  });

  describe("INVALID_INVITE_CODE flows through middleware (AC2)", () => {
    it("returns 400 with INVALID_INVITE_CODE code and ADR-008 body", () => {
      expect.assertions(5);

      const error = new AppError(
        ErrorCode.INVALID_INVITE_CODE,
        "Invite code has expired"
      );

      const response = createErrorResponse(error, REQUEST_ID);
      const body = JSON.parse(response.body);

      expect(response.statusCode).toBe(400);
      expect(body.error.code).toBe("INVALID_INVITE_CODE");
      expect(body.error.message).toBe("Invite code has expired");
      expect(body.error.requestId).toBe(REQUEST_ID);
      expect(response.headers?.["X-Request-Id"]).toBe(REQUEST_ID);
    });
  });

  describe("RATE_LIMITED includes Retry-After header (AC5)", () => {
    it("returns 429 with RATE_LIMITED code, ADR-008 body, and Retry-After header", () => {
      expect.assertions(6);

      const error = new AppError(
        ErrorCode.RATE_LIMITED,
        "Rate limit exceeded",
        { retryAfter: 1800, limit: 10 }
      );

      const response = createErrorResponse(error, REQUEST_ID);
      const body = JSON.parse(response.body);

      expect(response.statusCode).toBe(429);
      expect(body.error.code).toBe("RATE_LIMITED");
      expect(body.error.message).toBe("Rate limit exceeded");
      expect(body.error.requestId).toBe(REQUEST_ID);
      expect(response.headers?.["Retry-After"]).toBe("1800");
      expect(response.headers?.["X-Request-Id"]).toBe(REQUEST_ID);
    });
  });

  describe("requestId present in all error responses (AC1)", () => {
    it("includes X-Request-Id header in all auth error responses", () => {
      expect.assertions(3);

      const authErrorCodes = [
        ErrorCode.SCOPE_INSUFFICIENT,
        ErrorCode.INVALID_INVITE_CODE,
        ErrorCode.RATE_LIMITED,
      ] as const;

      for (const code of authErrorCodes) {
        const error = new AppError(code, `Error: ${code}`);
        const response = createErrorResponse(error, REQUEST_ID);
        expect(response.headers?.["X-Request-Id"]).toBe(REQUEST_ID);
      }
    });
  });

  describe("All auth error codes map to correct HTTP status (AC2)", () => {
    it("EXPIRED_TOKEN maps to 401", () => {
      expect.assertions(1);
      expect(ErrorCodeToStatus[ErrorCode.EXPIRED_TOKEN]).toBe(401);
    });

    it("INVALID_API_KEY maps to 401", () => {
      expect.assertions(1);
      expect(ErrorCodeToStatus[ErrorCode.INVALID_API_KEY]).toBe(401);
    });

    it("REVOKED_API_KEY maps to 401", () => {
      expect.assertions(1);
      expect(ErrorCodeToStatus[ErrorCode.REVOKED_API_KEY]).toBe(401);
    });

    it("SUSPENDED_ACCOUNT maps to 403", () => {
      expect.assertions(1);
      expect(ErrorCodeToStatus[ErrorCode.SUSPENDED_ACCOUNT]).toBe(403);
    });

    it("SCOPE_INSUFFICIENT maps to 403", () => {
      expect.assertions(1);
      expect(ErrorCodeToStatus[ErrorCode.SCOPE_INSUFFICIENT]).toBe(403);
    });

    it("INVITE_REQUIRED maps to 403", () => {
      expect.assertions(1);
      expect(ErrorCodeToStatus[ErrorCode.INVITE_REQUIRED]).toBe(403);
    });

    it("INVALID_INVITE_CODE maps to 400", () => {
      expect.assertions(1);
      expect(ErrorCodeToStatus[ErrorCode.INVALID_INVITE_CODE]).toBe(400);
    });

    it("RATE_LIMITED maps to 429", () => {
      expect.assertions(1);
      expect(ErrorCodeToStatus[ErrorCode.RATE_LIMITED]).toBe(429);
    });
  });
});
