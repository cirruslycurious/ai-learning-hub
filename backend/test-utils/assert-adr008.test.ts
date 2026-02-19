/**
 * Unit tests for assertADR008Error utility (Story 2.1-D5, Task 6.4)
 */
import { describe, it, expect } from "vitest";
import { assertADR008Error } from "./assert-adr008";
import { ErrorCode, ErrorCodeToStatus } from "@ai-learning-hub/types";

function makeErrorResponse(
  code: string,
  message: string,
  statusCode: number,
  requestId = "test-req-id",
  details?: Record<string, unknown>
) {
  return {
    statusCode,
    body: JSON.stringify({
      error: {
        code,
        message,
        requestId,
        ...(details ? { details } : {}),
      },
    }),
    headers: { "Content-Type": "application/json" },
  };
}

describe("assertADR008Error", () => {
  it("passes for a valid UNAUTHORIZED error response", () => {
    const response = makeErrorResponse(
      "UNAUTHORIZED",
      "Authentication required",
      401
    );
    expect(() => assertADR008Error(response)).not.toThrow();
  });

  it("passes for a valid VALIDATION_ERROR response", () => {
    const response = makeErrorResponse(
      "VALIDATION_ERROR",
      "Invalid input",
      400
    );
    expect(() => assertADR008Error(response)).not.toThrow();
  });

  it("passes for a valid RATE_LIMITED response", () => {
    const response = makeErrorResponse(
      "RATE_LIMITED",
      "Too many requests",
      429
    );
    expect(() => assertADR008Error(response)).not.toThrow();
  });

  it("passes for a valid response with details", () => {
    const response = makeErrorResponse(
      "VALIDATION_ERROR",
      "Invalid input",
      400,
      "req-123",
      { field: "email", issue: "required" }
    );
    expect(() => assertADR008Error(response)).not.toThrow();
  });

  it("passes when expectedCode matches", () => {
    const response = makeErrorResponse("NOT_FOUND", "Resource not found", 404);
    expect(() =>
      assertADR008Error(response, ErrorCode.NOT_FOUND)
    ).not.toThrow();
  });

  it("passes when expectedStatus matches", () => {
    const response = makeErrorResponse("FORBIDDEN", "Access denied", 403);
    expect(() =>
      assertADR008Error(response, ErrorCode.FORBIDDEN, 403)
    ).not.toThrow();
  });

  it("fails for non-JSON body", () => {
    const response = {
      statusCode: 500,
      body: "not json",
    };
    expect(() => assertADR008Error(response)).toThrow();
  });

  it("fails when error.code is not a valid ErrorCode", () => {
    const response = {
      statusCode: 400,
      body: JSON.stringify({
        error: {
          code: "BOGUS_CODE",
          message: "bad",
          requestId: "req-1",
        },
      }),
    };
    expect(() => assertADR008Error(response)).toThrow();
  });

  it("fails when error object is missing", () => {
    const response = {
      statusCode: 400,
      body: JSON.stringify({ message: "no error wrapper" }),
    };
    expect(() => assertADR008Error(response)).toThrow();
  });

  it("fails when requestId is missing", () => {
    const response = {
      statusCode: 401,
      body: JSON.stringify({
        error: {
          code: "UNAUTHORIZED",
          message: "auth required",
        },
      }),
    };
    expect(() => assertADR008Error(response)).toThrow();
  });

  it("fails when status code does not match ErrorCodeToStatus mapping", () => {
    const response = makeErrorResponse(
      "UNAUTHORIZED",
      "auth required",
      500 // wrong — should be 401
    );
    expect(() => assertADR008Error(response)).toThrow();
  });

  it("fails when expectedCode does not match actual code", () => {
    const response = makeErrorResponse("FORBIDDEN", "access denied", 403);
    expect(() => assertADR008Error(response, ErrorCode.UNAUTHORIZED)).toThrow();
  });

  it("validates all ErrorCode enum values are accepted", () => {
    for (const code of Object.values(ErrorCode)) {
      const status = ErrorCodeToStatus[code as ErrorCode];
      const response = makeErrorResponse(code, "test message", status);
      expect(() => assertADR008Error(response)).not.toThrow();
    }
  });
});
