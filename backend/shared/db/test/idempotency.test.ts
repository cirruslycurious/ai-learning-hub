import { describe, it, expect, vi, beforeEach } from "vitest";
import { ConditionalCheckFailedException } from "@aws-sdk/client-dynamodb";
import {
  IDEMPOTENCY_TABLE_CONFIG,
  storeIdempotencyRecord,
  getIdempotencyRecord,
} from "../src/idempotency.js";
import type { IdempotencyRecord } from "@ai-learning-hub/types";

const mockSend = vi.fn();
const mockClient = {
  send: mockSend,
} as unknown as import("@aws-sdk/lib-dynamodb").DynamoDBDocumentClient;

describe("Idempotency Storage (Story 3.2.1)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  describe("IDEMPOTENCY_TABLE_CONFIG", () => {
    it("should have correct table config", () => {
      expect(IDEMPOTENCY_TABLE_CONFIG.partitionKey).toBe("pk");
      expect(IDEMPOTENCY_TABLE_CONFIG.sortKey).toBeUndefined();
    });
  });

  describe("storeIdempotencyRecord", () => {
    it("should store a new record with conditional write", async () => {
      mockSend.mockResolvedValueOnce({});

      await storeIdempotencyRecord(mockClient, {
        pk: "IDEMP#user1#key1",
        userId: "user1",
        operationPath: "POST /saves",
        statusCode: 201,
        responseBody: '{"data":{}}',
        responseHeaders: { "content-type": "application/json" },
        createdAt: "2026-02-25T12:00:00.000Z",
        expiresAt: 1740499200,
      });

      expect(mockSend).toHaveBeenCalledOnce();
      const input = mockSend.mock.calls[0][0].input;
      expect(input.ConditionExpression).toBe("attribute_not_exists(pk)");
    });

    it("should return false when record already exists (race condition)", async () => {
      const error = new ConditionalCheckFailedException({
        message: "Conditional check failed",
        $metadata: {},
      });
      mockSend.mockRejectedValueOnce(error);

      const result = await storeIdempotencyRecord(mockClient, {
        pk: "IDEMP#user1#key1",
        userId: "user1",
        operationPath: "POST /saves",
        statusCode: 201,
        responseBody: '{"data":{}}',
        responseHeaders: {},
        createdAt: "2026-02-25T12:00:00.000Z",
        expiresAt: 1740499200,
      });

      expect(result).toBe(false);
    });

    it("should return true on successful store", async () => {
      mockSend.mockResolvedValueOnce({});

      const result = await storeIdempotencyRecord(mockClient, {
        pk: "IDEMP#user1#key1",
        userId: "user1",
        operationPath: "POST /saves",
        statusCode: 201,
        responseBody: '{"data":{}}',
        responseHeaders: {},
        createdAt: "2026-02-25T12:00:00.000Z",
        expiresAt: 1740499200,
      });

      expect(result).toBe(true);
    });

    it("should throw on non-conditional DynamoDB errors", async () => {
      mockSend.mockRejectedValueOnce(new Error("Network error"));

      await expect(
        storeIdempotencyRecord(mockClient, {
          pk: "IDEMP#user1#key1",
          userId: "user1",
          operationPath: "POST /saves",
          statusCode: 201,
          responseBody: "{}",
          responseHeaders: {},
          createdAt: "2026-02-25T12:00:00.000Z",
          expiresAt: 1740499200,
        })
      ).rejects.toThrow();
    });
  });

  describe("getIdempotencyRecord", () => {
    it("should return record when found and not expired", async () => {
      const record: IdempotencyRecord = {
        pk: "IDEMP#user1#key1",
        userId: "user1",
        operationPath: "POST /saves",
        statusCode: 201,
        responseBody: '{"data":{}}',
        responseHeaders: { "content-type": "application/json" },
        createdAt: "2026-02-25T12:00:00.000Z",
        expiresAt: Math.floor(Date.now() / 1000) + 86400, // 24h from now
      };
      mockSend.mockResolvedValueOnce({ Item: record });

      const result = await getIdempotencyRecord(
        mockClient,
        "user1",
        "key1",
        "POST /saves"
      );

      expect(result).toEqual(record);
    });

    it("should return null when record not found", async () => {
      mockSend.mockResolvedValueOnce({ Item: undefined });

      const result = await getIdempotencyRecord(
        mockClient,
        "user1",
        "key1",
        "POST /saves"
      );

      expect(result).toBeNull();
    });

    it("should return null when record is expired (application-level check)", async () => {
      const record: IdempotencyRecord = {
        pk: "IDEMP#user1#key1",
        userId: "user1",
        operationPath: "POST /saves",
        statusCode: 201,
        responseBody: '{"data":{}}',
        responseHeaders: {},
        createdAt: "2026-02-24T12:00:00.000Z",
        expiresAt: Math.floor(Date.now() / 1000) - 3600, // Expired 1 hour ago
      };
      mockSend.mockResolvedValueOnce({ Item: record });

      const result = await getIdempotencyRecord(
        mockClient,
        "user1",
        "key1",
        "POST /saves"
      );

      expect(result).toBeNull();
    });

    it("should return record even when operationPath differs (checked by middleware)", async () => {
      const record: IdempotencyRecord = {
        pk: "IDEMP#user1#key1",
        userId: "user1",
        operationPath: "POST /saves",
        statusCode: 201,
        responseBody: '{"data":{}}',
        responseHeaders: {},
        createdAt: "2026-02-25T12:00:00.000Z",
        expiresAt: Math.floor(Date.now() / 1000) + 86400,
      };
      mockSend.mockResolvedValueOnce({ Item: record });

      // Different operationPath — middleware layer checks mismatch
      const result = await getIdempotencyRecord(
        mockClient,
        "user1",
        "key1",
        "POST /projects"
      );

      expect(result).toEqual(record);
    });

    it("should construct correct PK from userId and key", async () => {
      mockSend.mockResolvedValueOnce({ Item: undefined });

      await getIdempotencyRecord(
        mockClient,
        "user123",
        "my-key",
        "POST /saves"
      );

      const input = mockSend.mock.calls[0][0].input;
      expect(input.Key.pk).toBe("IDEMP#user123#my-key");
    });
  });
});
