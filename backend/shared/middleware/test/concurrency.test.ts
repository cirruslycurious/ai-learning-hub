import { describe, it, expect, vi, beforeEach } from "vitest";
import { extractIfMatch } from "../src/concurrency.js";
import type { APIGatewayProxyEvent } from "aws-lambda";
import { AppError, ErrorCode } from "@ai-learning-hub/types";

function makeEvent(headers: Record<string, string> = {}): APIGatewayProxyEvent {
  return {
    headers,
    httpMethod: "PUT",
    path: "/saves/123",
    body: null,
    isBase64Encoded: false,
    multiValueHeaders: {},
    multiValueQueryStringParameters: null,
    pathParameters: null,
    queryStringParameters: null,
    requestContext: {} as APIGatewayProxyEvent["requestContext"],
    resource: "",
    stageVariables: null,
  };
}

describe("Concurrency Middleware (Story 3.2.1)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("extractIfMatch", () => {
    it("should extract numeric version from If-Match header", () => {
      const event = makeEvent({ "if-match": "3" });
      const version = extractIfMatch(event);
      expect(version).toBe(3);
    });

    it("should be case-insensitive for header name", () => {
      const event = makeEvent({ "If-Match": "5" });
      const version = extractIfMatch(event);
      expect(version).toBe(5);
    });

    it("should throw PRECONDITION_REQUIRED when header is missing", () => {
      const event = makeEvent({});
      expect(() => extractIfMatch(event)).toThrow(AppError);
      try {
        extractIfMatch(event);
      } catch (e) {
        expect((e as AppError).code).toBe(ErrorCode.PRECONDITION_REQUIRED);
        expect((e as AppError).message).toBe(
          "If-Match header is required for this operation"
        );
        expect((e as AppError).statusCode).toBe(428);
      }
    });

    it("should throw VALIDATION_ERROR when header is not a valid number", () => {
      const event = makeEvent({ "if-match": "not-a-number" });
      expect(() => extractIfMatch(event)).toThrow(AppError);
      try {
        extractIfMatch(event);
      } catch (e) {
        expect((e as AppError).code).toBe(ErrorCode.VALIDATION_ERROR);
      }
    });

    it("should throw VALIDATION_ERROR when header is zero", () => {
      const event = makeEvent({ "if-match": "0" });
      expect(() => extractIfMatch(event)).toThrow(AppError);
    });

    it("should throw VALIDATION_ERROR when header is negative", () => {
      const event = makeEvent({ "if-match": "-1" });
      expect(() => extractIfMatch(event)).toThrow(AppError);
    });

    it("should throw VALIDATION_ERROR when header is a float", () => {
      const event = makeEvent({ "if-match": "1.5" });
      expect(() => extractIfMatch(event)).toThrow(AppError);
    });

    it("should handle version 1", () => {
      const event = makeEvent({ "if-match": "1" });
      const version = extractIfMatch(event);
      expect(version).toBe(1);
    });

    it("should handle large version numbers", () => {
      const event = makeEvent({ "if-match": "9999" });
      const version = extractIfMatch(event);
      expect(version).toBe(9999);
    });
  });
});
