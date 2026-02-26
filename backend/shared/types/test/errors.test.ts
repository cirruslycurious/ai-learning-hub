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

  it("should identify duck-typed AppError from separate module copy", () => {
    const duckTyped = Object.assign(new Error("Duck"), {
      name: "AppError",
      code: ErrorCode.NOT_FOUND,
      statusCode: 404,
    });
    expect(AppError.isAppError(duckTyped)).toBe(true);
  });

  it("should reject Error with AppError name but missing code/statusCode", () => {
    const partial = Object.assign(new Error("Partial"), { name: "AppError" });
    expect(AppError.isAppError(partial)).toBe(false);
  });

  it("should have proper stack trace", () => {
    const error = new AppError(ErrorCode.INTERNAL_ERROR, "Test error");

    expect(error.stack).toBeDefined();
    expect(error.stack).toContain("AppError");
  });

  describe("toApiError with promoted fields (AC1, AC5)", () => {
    it("should promote currentState from details to top-level error field", () => {
      const error = new AppError(
        ErrorCode.CONFLICT,
        "Cannot complete a paused project",
        { currentState: "paused", allowedActions: ["resume", "delete"] }
      );
      const apiError = error.toApiError("req-promote");

      expect(apiError.error.currentState).toBe("paused");
      expect(apiError.error.allowedActions).toEqual(["resume", "delete"]);
      // Promoted fields removed from details
      expect(apiError.error.details).toBeUndefined();
    });

    it("should promote requiredConditions from details to top-level", () => {
      const error = new AppError(ErrorCode.CONFLICT, "Precondition failed", {
        requiredConditions: ["must resume first"],
      });
      const apiError = error.toApiError("req-conditions");

      expect(apiError.error.requiredConditions).toEqual(["must resume first"]);
      expect(apiError.error.details).toBeUndefined();
    });

    it("should keep non-promoted fields in details after stripping promoted ones", () => {
      const error = new AppError(ErrorCode.CONFLICT, "Version conflict", {
        currentState: "modified",
        allowedActions: ["re-read"],
        currentVersion: 5,
      });
      const apiError = error.toApiError("req-mixed");

      expect(apiError.error.currentState).toBe("modified");
      expect(apiError.error.allowedActions).toEqual(["re-read"]);
      expect(apiError.error.details).toEqual({ currentVersion: 5 });
    });

    it("should not include promoted fields when not set in details", () => {
      const error = new AppError(ErrorCode.NOT_FOUND, "Not found");
      const apiError = error.toApiError("req-basic");

      expect(apiError.error.currentState).toBeUndefined();
      expect(apiError.error.allowedActions).toBeUndefined();
      expect(apiError.error.requiredConditions).toBeUndefined();
    });
  });

  describe("AppError.build() fluent builder (AC3)", () => {
    it("should create error with state context via builder", () => {
      const error = AppError.build(
        ErrorCode.CONFLICT,
        "Cannot complete a paused project"
      )
        .withState("paused", ["resume", "delete"])
        .create();

      expect(error.code).toBe(ErrorCode.CONFLICT);
      expect(error.message).toBe("Cannot complete a paused project");
      expect(error.details?.currentState).toBe("paused");
      expect(error.details?.allowedActions).toEqual(["resume", "delete"]);
    });

    it("should create error with required conditions", () => {
      const error = AppError.build(ErrorCode.CONFLICT, "Precondition failed")
        .withConditions(["must resume first"])
        .create();

      expect(error.details?.requiredConditions).toEqual(["must resume first"]);
    });

    it("should create error with custom details and state", () => {
      const error = AppError.build(ErrorCode.CONFLICT, "Version conflict")
        .withDetails({ currentVersion: 5 })
        .withState("modified", ["re-read", "retry"])
        .create();

      expect(error.details?.currentVersion).toBe(5);
      expect(error.details?.currentState).toBe("modified");
      expect(error.details?.allowedActions).toEqual(["re-read", "retry"]);
    });

    it("should create basic error without optional fields", () => {
      const error = AppError.build(
        ErrorCode.FORBIDDEN,
        "Access denied"
      ).create();

      expect(error.code).toBe(ErrorCode.FORBIDDEN);
      expect(error.message).toBe("Access denied");
      expect(error.details).toBeUndefined();
    });

    it("should chain all builder methods", () => {
      const error = AppError.build(ErrorCode.CONFLICT, "Full chain")
        .withState("paused", ["resume"])
        .withConditions(["must be active"])
        .withDetails({ entityId: "123" })
        .create();

      expect(error.details?.currentState).toBe("paused");
      expect(error.details?.allowedActions).toEqual(["resume"]);
      expect(error.details?.requiredConditions).toEqual(["must be active"]);
      expect(error.details?.entityId).toBe("123");
    });
  });
});

describe("INVALID_STATE_TRANSITION error code (AC4)", () => {
  it("should exist in ErrorCode enum", () => {
    expect(ErrorCode.INVALID_STATE_TRANSITION).toBe("INVALID_STATE_TRANSITION");
  });

  it("should map to HTTP 409", () => {
    expect(ErrorCodeToStatus[ErrorCode.INVALID_STATE_TRANSITION]).toBe(409);
  });

  it("should work with AppError", () => {
    const error = new AppError(
      ErrorCode.INVALID_STATE_TRANSITION,
      "Cannot complete a paused project"
    );
    expect(error.statusCode).toBe(409);
  });
});
