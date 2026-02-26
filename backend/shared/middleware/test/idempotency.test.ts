import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  extractIdempotencyKey,
  checkIdempotency,
  storeIdempotencyResult,
  IDEMPOTENCY_KEY_PATTERN,
  IDEMPOTENCY_KEY_MAX_LENGTH,
  RESPONSE_SIZE_LIMIT,
  type IdempotencyStatus,
} from "../src/idempotency.js";
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { AppError, ErrorCode } from "@ai-learning-hub/types";
import type { IdempotencyRecord } from "@ai-learning-hub/types";
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

// Mock the @ai-learning-hub/db module
const mockGetIdempotencyRecord = vi.fn();
const mockStoreIdempotencyRecord = vi.fn();
const mockBuildIdempotencyPK = vi.fn(
  (userId: string, key: string) => `IDEMP#${userId}#${key}`
);
const mockGetDefaultClient = vi.fn().mockReturnValue({});

vi.mock("@ai-learning-hub/db", () => ({
  getIdempotencyRecord: (...args: unknown[]) =>
    mockGetIdempotencyRecord(...args),
  storeIdempotencyRecord: (...args: unknown[]) =>
    mockStoreIdempotencyRecord(...args),
  buildIdempotencyPK: (...args: unknown[]) => mockBuildIdempotencyPK(...args),
  getDefaultClient: () => mockGetDefaultClient(),
}));

const mockLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  timed: vi.fn(),
  setRequestContext: vi.fn(),
  child: vi.fn(),
} as unknown as import("@ai-learning-hub/logging").Logger;

function makeEvent(
  headers: Record<string, string> = {},
  overrides: Partial<APIGatewayProxyEvent> = {}
): APIGatewayProxyEvent {
  return {
    headers,
    httpMethod: "POST",
    path: "/saves",
    body: null,
    isBase64Encoded: false,
    multiValueHeaders: {},
    multiValueQueryStringParameters: null,
    pathParameters: null,
    queryStringParameters: null,
    requestContext: {} as APIGatewayProxyEvent["requestContext"],
    resource: "",
    stageVariables: null,
    ...overrides,
  };
}

function make200Response(
  body = '{"data":{"id":"123"}}'
): APIGatewayProxyResult {
  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body,
  };
}

const mockClient = {} as DynamoDBDocumentClient;

describe("Idempotency Middleware (Story 3.2.1)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("extractIdempotencyKey", () => {
    it("should extract valid idempotency key from header", () => {
      const event = makeEvent({ "idempotency-key": "my-key-123" });
      const key = extractIdempotencyKey(event);
      expect(key).toBe("my-key-123");
    });

    it("should be case-insensitive for header name", () => {
      const event = makeEvent({ "Idempotency-Key": "my-key-456" });
      const key = extractIdempotencyKey(event);
      expect(key).toBe("my-key-456");
    });

    it("should throw VALIDATION_ERROR when header is missing", () => {
      const event = makeEvent({});
      expect(() => extractIdempotencyKey(event)).toThrow(AppError);
      try {
        extractIdempotencyKey(event);
      } catch (e) {
        expect((e as AppError).code).toBe(ErrorCode.VALIDATION_ERROR);
        expect((e as AppError).message).toBe(
          "Idempotency-Key header is required"
        );
      }
    });

    it("should throw VALIDATION_ERROR when header is empty", () => {
      const event = makeEvent({ "idempotency-key": "" });
      expect(() => extractIdempotencyKey(event)).toThrow(AppError);
    });

    it("should throw VALIDATION_ERROR when key exceeds max length", () => {
      const longKey = "a".repeat(IDEMPOTENCY_KEY_MAX_LENGTH + 1);
      const event = makeEvent({ "idempotency-key": longKey });
      expect(() => extractIdempotencyKey(event)).toThrow(AppError);
    });

    it("should throw VALIDATION_ERROR when key contains invalid characters", () => {
      const event = makeEvent({ "idempotency-key": "key with spaces!" });
      expect(() => extractIdempotencyKey(event)).toThrow(AppError);
    });

    it("should accept keys with dots, hyphens, and underscores", () => {
      const event = makeEvent({
        "idempotency-key": "save_123.attempt-1",
      });
      const key = extractIdempotencyKey(event);
      expect(key).toBe("save_123.attempt-1");
    });

    it("should accept key at exactly max length", () => {
      const maxKey = "a".repeat(IDEMPOTENCY_KEY_MAX_LENGTH);
      const event = makeEvent({ "idempotency-key": maxKey });
      const key = extractIdempotencyKey(event);
      expect(key).toBe(maxKey);
    });
  });

  describe("constants", () => {
    it("should have correct key pattern", () => {
      expect(IDEMPOTENCY_KEY_PATTERN.test("valid-key_123.abc")).toBe(true);
      expect(IDEMPOTENCY_KEY_PATTERN.test("invalid key!")).toBe(false);
    });

    it("should have correct max length", () => {
      expect(IDEMPOTENCY_KEY_MAX_LENGTH).toBe(256);
    });

    it("should have correct response size limit", () => {
      expect(RESPONSE_SIZE_LIMIT).toBe(350 * 1024);
    });
  });

  describe("checkIdempotency", () => {
    it("should return null when no cached record exists (cache miss)", async () => {
      mockGetIdempotencyRecord.mockResolvedValueOnce(null);

      const event = makeEvent();
      const result = await checkIdempotency(
        event,
        "user_123",
        "key-1",
        mockLogger,
        mockClient
      );

      expect(result).toBeNull();
      expect(mockGetIdempotencyRecord).toHaveBeenCalledWith(
        mockClient,
        "user_123",
        "key-1",
        "POST /saves",
        mockLogger
      );
    });

    it("should replay cached response with X-Idempotent-Replayed header (AC3)", async () => {
      const cachedRecord: IdempotencyRecord = {
        pk: "IDEMP#user_123#key-1",
        userId: "user_123",
        operationPath: "POST /saves",
        statusCode: 201,
        responseBody: '{"data":{"id":"save-abc"}}',
        responseHeaders: { "Content-Type": "application/json" },
        createdAt: new Date().toISOString(),
        expiresAt: Math.floor(Date.now() / 1000) + 3600,
      };
      mockGetIdempotencyRecord.mockResolvedValueOnce(cachedRecord);

      const event = makeEvent();
      const result = await checkIdempotency(
        event,
        "user_123",
        "key-1",
        mockLogger,
        mockClient
      );

      expect(result).not.toBeNull();
      expect(result!.statusCode).toBe(201);
      expect(result!.body).toBe('{"data":{"id":"save-abc"}}');
      expect(result!.headers?.["X-Idempotent-Replayed"]).toBe("true");
      expect(result!.headers?.["Content-Type"]).toBe("application/json");
    });

    it("should throw IDEMPOTENCY_KEY_CONFLICT on operation path mismatch (AC5)", async () => {
      const cachedRecord: IdempotencyRecord = {
        pk: "IDEMP#user_123#key-1",
        userId: "user_123",
        operationPath: "POST /projects",
        statusCode: 200,
        responseBody: "{}",
        responseHeaders: {},
        createdAt: new Date().toISOString(),
        expiresAt: Math.floor(Date.now() / 1000) + 3600,
      };
      mockGetIdempotencyRecord.mockResolvedValueOnce(cachedRecord);

      const event = makeEvent(); // POST /saves

      await expect(
        checkIdempotency(event, "user_123", "key-1", mockLogger, mockClient)
      ).rejects.toThrow(AppError);

      try {
        mockGetIdempotencyRecord.mockResolvedValueOnce(cachedRecord);
        await checkIdempotency(
          event,
          "user_123",
          "key-1",
          mockLogger,
          mockClient
        );
      } catch (e) {
        expect((e as AppError).code).toBe(ErrorCode.IDEMPOTENCY_KEY_CONFLICT);
        expect((e as AppError).details?.boundTo).toBe("POST /projects");
      }
    });

    it("should return null for oversized tombstone records (AC8)", async () => {
      const tombstoneRecord: IdempotencyRecord = {
        pk: "IDEMP#user_123#key-1",
        userId: "user_123",
        operationPath: "POST /saves",
        statusCode: 200,
        responseBody: "",
        responseHeaders: {},
        createdAt: new Date().toISOString(),
        expiresAt: Math.floor(Date.now() / 1000) + 3600,
        oversized: true,
      };
      mockGetIdempotencyRecord.mockResolvedValueOnce(tombstoneRecord);

      const event = makeEvent();
      const result = await checkIdempotency(
        event,
        "user_123",
        "key-1",
        mockLogger,
        mockClient
      );

      expect(result).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        "Idempotency record is oversized tombstone, re-executing handler"
      );
    });

    it("should fail-open on DynamoDB errors and return null (AC9)", async () => {
      mockGetIdempotencyRecord.mockRejectedValueOnce(
        new Error("DynamoDB timeout")
      );

      const event = makeEvent();
      const result = await checkIdempotency(
        event,
        "user_123",
        "key-1",
        mockLogger,
        mockClient
      );

      expect(result).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        "Idempotency check failed, executing handler (fail-open)",
        expect.objectContaining({ error: "DynamoDB timeout" })
      );
    });

    it("should set status.available to false on fail-open (AC9)", async () => {
      mockGetIdempotencyRecord.mockRejectedValueOnce(
        new Error("DynamoDB timeout")
      );

      const event = makeEvent();
      const status: IdempotencyStatus = { available: true };
      await checkIdempotency(
        event,
        "user_123",
        "key-1",
        mockLogger,
        mockClient,
        status
      );

      expect(status.available).toBe(false);
    });

    it("should re-throw AppError instances (not fail-open)", async () => {
      const appError = new AppError(
        ErrorCode.IDEMPOTENCY_KEY_CONFLICT,
        "Conflict"
      );
      mockGetIdempotencyRecord.mockRejectedValueOnce(appError);

      const event = makeEvent();

      await expect(
        checkIdempotency(event, "user_123", "key-1", mockLogger, mockClient)
      ).rejects.toThrow(appError);
    });

    it("should not set status.available to false for AppError re-throws", async () => {
      const appError = new AppError(
        ErrorCode.IDEMPOTENCY_KEY_CONFLICT,
        "Conflict"
      );
      mockGetIdempotencyRecord.mockRejectedValueOnce(appError);

      const event = makeEvent();
      const status: IdempotencyStatus = { available: true };

      try {
        await checkIdempotency(
          event,
          "user_123",
          "key-1",
          mockLogger,
          mockClient,
          status
        );
      } catch {
        // expected
      }

      expect(status.available).toBe(true);
    });
  });

  describe("storeIdempotencyResult", () => {
    it("should store 2xx response and return original result", async () => {
      mockStoreIdempotencyRecord.mockResolvedValueOnce(true);

      const event = makeEvent();
      const response = make200Response();
      const result = await storeIdempotencyResult(
        event,
        "user_123",
        "key-1",
        response,
        mockLogger,
        mockClient
      );

      expect(result).toBe(response);
      expect(mockStoreIdempotencyRecord).toHaveBeenCalledOnce();
      const storedRecord = mockStoreIdempotencyRecord.mock.calls[0][1];
      expect(storedRecord.pk).toBe("IDEMP#user_123#key-1");
      expect(storedRecord.statusCode).toBe(200);
      expect(storedRecord.responseBody).toBe('{"data":{"id":"123"}}');
    });

    it("should NOT cache 4xx responses", async () => {
      const event = makeEvent();
      const errorResponse: APIGatewayProxyResult = {
        statusCode: 404,
        headers: {},
        body: '{"error":{"code":"NOT_FOUND","message":"Not found"}}',
      };

      const result = await storeIdempotencyResult(
        event,
        "user_123",
        "key-1",
        errorResponse,
        mockLogger,
        mockClient
      );

      expect(result).toBe(errorResponse);
      expect(mockStoreIdempotencyRecord).not.toHaveBeenCalled();
    });

    it("should NOT cache 5xx responses", async () => {
      const event = makeEvent();
      const errorResponse: APIGatewayProxyResult = {
        statusCode: 500,
        headers: {},
        body: '{"error":{"code":"INTERNAL_ERROR","message":"Server error"}}',
      };

      const result = await storeIdempotencyResult(
        event,
        "user_123",
        "key-1",
        errorResponse,
        mockLogger,
        mockClient
      );

      expect(result).toBe(errorResponse);
      expect(mockStoreIdempotencyRecord).not.toHaveBeenCalled();
    });

    it("should store tombstone for oversized responses (AC8)", async () => {
      mockStoreIdempotencyRecord.mockResolvedValueOnce(true);

      const event = makeEvent();
      const largeBody = "x".repeat(RESPONSE_SIZE_LIMIT + 1);
      const response: APIGatewayProxyResult = {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: largeBody,
      };

      const result = await storeIdempotencyResult(
        event,
        "user_123",
        "key-1",
        response,
        mockLogger,
        mockClient
      );

      expect(result).toBe(response);
      expect(mockStoreIdempotencyRecord).toHaveBeenCalledOnce();
      const storedRecord = mockStoreIdempotencyRecord.mock.calls[0][1];
      expect(storedRecord.oversized).toBe(true);
      expect(storedRecord.responseBody).toBe("");
      expect(mockLogger.warn).toHaveBeenCalledWith(
        "Idempotency response too large to cache",
        expect.objectContaining({ bodySize: expect.any(Number) })
      );
    });

    it("should handle race condition by reading back and replaying (AC6)", async () => {
      // storeIdempotencyRecord returns false = another request won the race
      mockStoreIdempotencyRecord.mockResolvedValueOnce(false);
      // getIdempotencyRecord returns the winning request's record
      const existingRecord: IdempotencyRecord = {
        pk: "IDEMP#user_123#key-1",
        userId: "user_123",
        operationPath: "POST /saves",
        statusCode: 201,
        responseBody: '{"data":{"id":"save-winner"}}',
        responseHeaders: { "Content-Type": "application/json" },
        createdAt: new Date().toISOString(),
        expiresAt: Math.floor(Date.now() / 1000) + 3600,
      };
      mockGetIdempotencyRecord.mockResolvedValueOnce(existingRecord);

      const event = makeEvent();
      const response = make200Response();
      const result = await storeIdempotencyResult(
        event,
        "user_123",
        "key-1",
        response,
        mockLogger,
        mockClient
      );

      expect(result.statusCode).toBe(201);
      expect(result.body).toBe('{"data":{"id":"save-winner"}}');
      expect(result.headers?.["X-Idempotent-Replayed"]).toBe("true");
    });

    it("should return original result when race-read returns oversized tombstone", async () => {
      mockStoreIdempotencyRecord.mockResolvedValueOnce(false);
      const existingRecord: IdempotencyRecord = {
        pk: "IDEMP#user_123#key-1",
        userId: "user_123",
        operationPath: "POST /saves",
        statusCode: 200,
        responseBody: "",
        responseHeaders: {},
        createdAt: new Date().toISOString(),
        expiresAt: Math.floor(Date.now() / 1000) + 3600,
        oversized: true,
      };
      mockGetIdempotencyRecord.mockResolvedValueOnce(existingRecord);

      const event = makeEvent();
      const response = make200Response();
      const result = await storeIdempotencyResult(
        event,
        "user_123",
        "key-1",
        response,
        mockLogger,
        mockClient
      );

      // Should return original result since the race-read record is oversized
      expect(result).toBe(response);
    });

    it("should return original result when race-read returns null", async () => {
      mockStoreIdempotencyRecord.mockResolvedValueOnce(false);
      mockGetIdempotencyRecord.mockResolvedValueOnce(null);

      const event = makeEvent();
      const response = make200Response();
      const result = await storeIdempotencyResult(
        event,
        "user_123",
        "key-1",
        response,
        mockLogger,
        mockClient
      );

      expect(result).toBe(response);
    });

    it("should fail-open on DynamoDB store errors and return original result (AC9)", async () => {
      mockStoreIdempotencyRecord.mockRejectedValueOnce(
        new Error("DynamoDB write error")
      );

      const event = makeEvent();
      const response = make200Response();
      const result = await storeIdempotencyResult(
        event,
        "user_123",
        "key-1",
        response,
        mockLogger,
        mockClient
      );

      expect(result).toBe(response);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        "Idempotency store failed (fail-open)",
        expect.objectContaining({ error: "DynamoDB write error" })
      );
    });

    it("should set status.available to false on store fail-open (AC9)", async () => {
      mockStoreIdempotencyRecord.mockRejectedValueOnce(
        new Error("DynamoDB error")
      );

      const event = makeEvent();
      const response = make200Response();
      const status: IdempotencyStatus = { available: true };

      await storeIdempotencyResult(
        event,
        "user_123",
        "key-1",
        response,
        mockLogger,
        mockClient,
        status
      );

      expect(status.available).toBe(false);
    });

    it("should not set status.available to false on successful store", async () => {
      mockStoreIdempotencyRecord.mockResolvedValueOnce(true);

      const event = makeEvent();
      const response = make200Response();
      const status: IdempotencyStatus = { available: true };

      await storeIdempotencyResult(
        event,
        "user_123",
        "key-1",
        response,
        mockLogger,
        mockClient,
        status
      );

      expect(status.available).toBe(true);
    });
  });
});
