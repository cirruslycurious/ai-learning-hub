import { describe, it, expect } from "vitest";
import { AppError, ErrorCode, ErrorCodeToStatus } from "../src/errors.js";

describe("ErrorCode", () => {
  it("should have all expected error codes", () => {
    expect(ErrorCode.VALIDATION_ERROR).toBe("VALIDATION_ERROR");
    expect(ErrorCode.UNAUTHORIZED).toBe("UNAUTHORIZED");
    expect(ErrorCode.FORBIDDEN).toBe("FORBIDDEN");
    expect(ErrorCode.NOT_FOUND).toBe("NOT_FOUND");
    expect(ErrorCode.CONFLICT).toBe("CONFLICT");
    expect(ErrorCode.RATE_LIMITED).toBe("RATE_LIMITED");
    expect(ErrorCode.INTERNAL_ERROR).toBe("INTERNAL_ERROR");
    expect(ErrorCode.SERVICE_UNAVAILABLE).toBe("SERVICE_UNAVAILABLE");
    expect(ErrorCode.EXTERNAL_SERVICE_ERROR).toBe("EXTERNAL_SERVICE_ERROR");

    // Auth-specific error codes (Story 2.8)
    expect(ErrorCode.EXPIRED_TOKEN).toBe("EXPIRED_TOKEN");
    expect(ErrorCode.INVALID_API_KEY).toBe("INVALID_API_KEY");
    expect(ErrorCode.REVOKED_API_KEY).toBe("REVOKED_API_KEY");
    expect(ErrorCode.SUSPENDED_ACCOUNT).toBe("SUSPENDED_ACCOUNT");
    expect(ErrorCode.SCOPE_INSUFFICIENT).toBe("SCOPE_INSUFFICIENT");
    expect(ErrorCode.INVITE_REQUIRED).toBe("INVITE_REQUIRED");
    expect(ErrorCode.INVALID_INVITE_CODE).toBe("INVALID_INVITE_CODE");
  });
});

describe("ErrorCodeToStatus", () => {
  it("should map error codes to HTTP status codes", () => {
    expect(ErrorCodeToStatus[ErrorCode.VALIDATION_ERROR]).toBe(400);
    expect(ErrorCodeToStatus[ErrorCode.UNAUTHORIZED]).toBe(401);
    expect(ErrorCodeToStatus[ErrorCode.FORBIDDEN]).toBe(403);
    expect(ErrorCodeToStatus[ErrorCode.NOT_FOUND]).toBe(404);
    expect(ErrorCodeToStatus[ErrorCode.CONFLICT]).toBe(409);
    expect(ErrorCodeToStatus[ErrorCode.RATE_LIMITED]).toBe(429);
    expect(ErrorCodeToStatus[ErrorCode.INTERNAL_ERROR]).toBe(500);
    expect(ErrorCodeToStatus[ErrorCode.SERVICE_UNAVAILABLE]).toBe(503);
    expect(ErrorCodeToStatus[ErrorCode.EXTERNAL_SERVICE_ERROR]).toBe(502);

    // Auth-specific error code mappings (Story 2.8)
    expect(ErrorCodeToStatus[ErrorCode.EXPIRED_TOKEN]).toBe(401);
    expect(ErrorCodeToStatus[ErrorCode.INVALID_API_KEY]).toBe(401);
    expect(ErrorCodeToStatus[ErrorCode.REVOKED_API_KEY]).toBe(401);
    expect(ErrorCodeToStatus[ErrorCode.SUSPENDED_ACCOUNT]).toBe(403);
    expect(ErrorCodeToStatus[ErrorCode.SCOPE_INSUFFICIENT]).toBe(403);
    expect(ErrorCodeToStatus[ErrorCode.INVITE_REQUIRED]).toBe(403);
    expect(ErrorCodeToStatus[ErrorCode.INVALID_INVITE_CODE]).toBe(400);
  });
});

describe("AppError", () => {
  it("should create error with correct properties", () => {
    const error = new AppError(ErrorCode.NOT_FOUND, "User not found");

    expect(error.code).toBe(ErrorCode.NOT_FOUND);
    expect(error.message).toBe("User not found");
    expect(error.statusCode).toBe(404);
    expect(error.name).toBe("AppError");
    expect(error.details).toBeUndefined();
  });

  it("should create error with details", () => {
    const details = { field: "email", reason: "invalid format" };
    const error = new AppError(
      ErrorCode.VALIDATION_ERROR,
      "Invalid input",
      details
    );

    expect(error.details).toEqual(details);
  });

  it("should convert to API error format", () => {
    const error = new AppError(ErrorCode.UNAUTHORIZED, "Token expired");
    const apiError = error.toApiError("req-123");

    expect(apiError.error.code).toBe(ErrorCode.UNAUTHORIZED);
    expect(apiError.error.message).toBe("Token expired");
    expect(apiError.error.requestId).toBe("req-123");
  });

  it("should include details in API error when present", () => {
    const details = { userId: "user-456" };
    const error = new AppError(ErrorCode.FORBIDDEN, "Access denied", details);
    const apiError = error.toApiError("req-789");

    expect(apiError.error.details).toEqual(details);
  });

  it("should identify AppError instances", () => {
    const appError = new AppError(ErrorCode.INTERNAL_ERROR, "Server error");
    const regularError = new Error("Regular error");

    expect(AppError.isAppError(appError)).toBe(true);
    expect(AppError.isAppError(regularError)).toBe(false);
    expect(AppError.isAppError(null)).toBe(false);
    expect(AppError.isAppError(undefined)).toBe(false);
    expect(AppError.isAppError("string")).toBe(false);
  });

  it("should have proper stack trace", () => {
    const error = new AppError(ErrorCode.INTERNAL_ERROR, "Test error");

    expect(error.stack).toBeDefined();
    expect(error.stack).toContain("AppError");
  });
});
