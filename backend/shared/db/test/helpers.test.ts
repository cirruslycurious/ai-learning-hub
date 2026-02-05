import { describe, it, expect, vi, beforeEach } from "vitest";
import { ConditionalCheckFailedException } from "@aws-sdk/client-dynamodb";
import {
  getItem,
  putItem,
  deleteItem,
  queryItems,
  updateItem,
  type TableConfig,
} from "../src/helpers.js";
import { AppError, ErrorCode } from "@ai-learning-hub/types";

// Mock DynamoDB client
const mockSend = vi.fn();
const mockClient = {
  send: mockSend,
} as unknown as import("@aws-sdk/lib-dynamodb").DynamoDBDocumentClient;

const tableConfig: TableConfig = {
  tableName: "test-table",
  partitionKey: "PK",
  sortKey: "SK",
};

describe("DynamoDB Helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  describe("getItem", () => {
    it("should return item when found", async () => {
      const item = { PK: "USER#123", SK: "PROFILE", name: "John" };
      mockSend.mockResolvedValueOnce({ Item: item });

      const result = await getItem(mockClient, tableConfig, {
        PK: "USER#123",
        SK: "PROFILE",
      });

      expect(result).toEqual(item);
      expect(mockSend).toHaveBeenCalled();
    });

    it("should return null when item not found", async () => {
      mockSend.mockResolvedValueOnce({ Item: undefined });

      const result = await getItem(mockClient, tableConfig, {
        PK: "USER#999",
        SK: "PROFILE",
      });

      expect(result).toBeNull();
    });

    it("should throw AppError on failure", async () => {
      mockSend.mockRejectedValueOnce(new Error("Network error"));

      await expect(
        getItem(mockClient, tableConfig, { PK: "test" })
      ).rejects.toThrow(AppError);
    });
  });

  describe("putItem", () => {
    it("should put item successfully", async () => {
      mockSend.mockResolvedValueOnce({});

      await expect(
        putItem(mockClient, tableConfig, { PK: "USER#123", name: "John" })
      ).resolves.not.toThrow();
    });

    it("should throw CONFLICT on conditional check failure", async () => {
      const error = new ConditionalCheckFailedException({
        message: "Conditional check failed",
      });
      mockSend.mockRejectedValueOnce(error);

      try {
        await putItem(
          mockClient,
          tableConfig,
          { PK: "test" },
          { conditionExpression: "attribute_not_exists(PK)" }
        );
      } catch (e) {
        expect(AppError.isAppError(e)).toBe(true);
        if (AppError.isAppError(e)) {
          expect(e.code).toBe(ErrorCode.CONFLICT);
        }
      }
    });

    it("should throw INTERNAL_ERROR on other failures", async () => {
      mockSend.mockRejectedValueOnce(new Error("Unknown error"));

      try {
        await putItem(mockClient, tableConfig, { PK: "test" });
      } catch (e) {
        expect(AppError.isAppError(e)).toBe(true);
        if (AppError.isAppError(e)) {
          expect(e.code).toBe(ErrorCode.INTERNAL_ERROR);
        }
      }
    });
  });

  describe("deleteItem", () => {
    it("should delete item successfully", async () => {
      mockSend.mockResolvedValueOnce({});

      await expect(
        deleteItem(mockClient, tableConfig, { PK: "USER#123" })
      ).resolves.not.toThrow();
    });

    it("should throw AppError on failure", async () => {
      mockSend.mockRejectedValueOnce(new Error("Delete failed"));

      await expect(
        deleteItem(mockClient, tableConfig, { PK: "test" })
      ).rejects.toThrow(AppError);
    });
  });

  describe("queryItems", () => {
    it("should return paginated results", async () => {
      const items = [
        { PK: "USER#123", name: "John" },
        { PK: "USER#123", name: "Jane" },
      ];
      mockSend.mockResolvedValueOnce({
        Items: items,
        LastEvaluatedKey: { PK: "USER#123", SK: "ITEM#2" },
      });

      const result = await queryItems(mockClient, tableConfig, {
        keyConditionExpression: "PK = :pk",
        expressionAttributeValues: { ":pk": "USER#123" },
        limit: 10,
      });

      expect(result.items).toEqual(items);
      expect(result.hasMore).toBe(true);
      expect(result.nextCursor).toBeDefined();
    });

    it("should return no more when no LastEvaluatedKey", async () => {
      mockSend.mockResolvedValueOnce({
        Items: [{ PK: "USER#123" }],
      });

      const result = await queryItems(mockClient, tableConfig, {
        keyConditionExpression: "PK = :pk",
        expressionAttributeValues: { ":pk": "USER#123" },
      });

      expect(result.hasMore).toBe(false);
      expect(result.nextCursor).toBeUndefined();
    });

    it("should handle cursor-based pagination", async () => {
      mockSend.mockResolvedValueOnce({
        Items: [{ PK: "USER#123" }],
      });

      // Create a valid cursor
      const cursor = Buffer.from(
        JSON.stringify({ PK: "USER#123", SK: "ITEM#1" })
      ).toString("base64");

      await queryItems(mockClient, tableConfig, {
        keyConditionExpression: "PK = :pk",
        expressionAttributeValues: { ":pk": "USER#123" },
        cursor,
      });

      expect(mockSend).toHaveBeenCalled();
    });

    it("should handle invalid cursor gracefully", async () => {
      mockSend.mockResolvedValueOnce({
        Items: [{ PK: "USER#123" }],
      });

      await queryItems(mockClient, tableConfig, {
        keyConditionExpression: "PK = :pk",
        expressionAttributeValues: { ":pk": "USER#123" },
        cursor: "invalid-cursor",
      });

      expect(mockSend).toHaveBeenCalled();
    });

    it("should throw AppError on failure", async () => {
      mockSend.mockRejectedValueOnce(new Error("Query failed"));

      await expect(
        queryItems(mockClient, tableConfig, {
          keyConditionExpression: "PK = :pk",
          expressionAttributeValues: { ":pk": "USER#123" },
        })
      ).rejects.toThrow(AppError);
    });
  });

  describe("updateItem", () => {
    it("should update item and return new values", async () => {
      const updatedItem = { PK: "USER#123", name: "Updated" };
      mockSend.mockResolvedValueOnce({ Attributes: updatedItem });

      const result = await updateItem(mockClient, tableConfig, {
        key: { PK: "USER#123" },
        updateExpression: "SET #name = :name",
        expressionAttributeValues: { ":name": "Updated" },
        expressionAttributeNames: { "#name": "name" },
      });

      expect(result).toEqual(updatedItem);
    });

    it("should throw NOT_FOUND on conditional check failure", async () => {
      const error = new ConditionalCheckFailedException({
        message: "Conditional check failed",
      });
      mockSend.mockRejectedValueOnce(error);

      try {
        await updateItem(mockClient, tableConfig, {
          key: { PK: "USER#999" },
          updateExpression: "SET #name = :name",
          expressionAttributeValues: { ":name": "Test" },
          conditionExpression: "attribute_exists(PK)",
        });
      } catch (e) {
        expect(AppError.isAppError(e)).toBe(true);
        if (AppError.isAppError(e)) {
          expect(e.code).toBe(ErrorCode.NOT_FOUND);
        }
      }
    });

    it("should throw INTERNAL_ERROR on other failures", async () => {
      mockSend.mockRejectedValueOnce(new Error("Unknown error"));

      try {
        await updateItem(mockClient, tableConfig, {
          key: { PK: "test" },
          updateExpression: "SET #name = :name",
          expressionAttributeValues: { ":name": "Test" },
        });
      } catch (e) {
        expect(AppError.isAppError(e)).toBe(true);
        if (AppError.isAppError(e)) {
          expect(e.code).toBe(ErrorCode.INTERNAL_ERROR);
        }
      }
    });
  });
});
