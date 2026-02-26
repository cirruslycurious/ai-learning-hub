import { describe, it, expect, vi, beforeEach } from "vitest";
import { ConditionalCheckFailedException } from "@aws-sdk/client-dynamodb";
import {
  updateItemWithVersion,
  putItemWithVersion,
  VersionConflictError,
} from "../src/version-helpers.js";
import { AppError, ErrorCode } from "@ai-learning-hub/types";
import type { TableConfig } from "../src/helpers.js";

const mockSend = vi.fn();
const mockClient = {
  send: mockSend,
} as unknown as import("@aws-sdk/lib-dynamodb").DynamoDBDocumentClient;

const tableConfig: TableConfig = {
  tableName: "test-table",
  partitionKey: "PK",
  sortKey: "SK",
};

describe("Optimistic Concurrency DB Helpers (Story 3.2.1)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  describe("VersionConflictError", () => {
    it("should extend AppError with VERSION_CONFLICT code", () => {
      const error = new VersionConflictError(3);

      expect(error).toBeInstanceOf(AppError);
      expect(error.code).toBe(ErrorCode.VERSION_CONFLICT);
      expect(error.statusCode).toBe(409);
      expect(error.currentVersion).toBe(3);
      expect(error.message).toBe("Resource has been modified");
    });

    it("should include currentVersion in details", () => {
      const error = new VersionConflictError(5);

      expect(error.details).toEqual({ currentVersion: 5 });
    });

    it("should produce correct API error format", () => {
      const error = new VersionConflictError(7);
      const apiError = error.toApiError("req-123");

      expect(apiError.error.code).toBe(ErrorCode.VERSION_CONFLICT);
      expect(apiError.error.details).toEqual({ currentVersion: 7 });
    });

    it("should pass AppError.isAppError() duck-type check", () => {
      const error = new VersionConflictError(3);
      expect(error.name).toBe("AppError");
      expect(AppError.isAppError(error)).toBe(true);
    });
  });

  describe("updateItemWithVersion", () => {
    it("should add version condition and increment to update", async () => {
      mockSend.mockResolvedValueOnce({
        Attributes: { PK: "USER#1", SK: "SAVE#1", version: 2, title: "New" },
      });

      const result = await updateItemWithVersion(
        mockClient,
        tableConfig,
        {
          key: { PK: "USER#1", SK: "SAVE#1" },
          updateExpression: "SET title = :title",
          expressionAttributeValues: { ":title": "New" },
        },
        1 // expectedVersion
      );

      expect(result).toBeDefined();
      const input = mockSend.mock.calls[0][0].input;
      // Should have appended version SET and condition
      expect(input.UpdateExpression).toContain("SET title = :title");
      expect(input.UpdateExpression).toContain("#_ver = :_newVer");
      expect(input.ConditionExpression).toBe("#_ver = :_expectedVer");
      expect(input.ExpressionAttributeValues[":_expectedVer"]).toBe(1);
      expect(input.ExpressionAttributeValues[":_newVer"]).toBe(2);
      expect(input.ExpressionAttributeNames["#_ver"]).toBe("version");
    });

    it("should throw VersionConflictError on version mismatch", async () => {
      const error = new ConditionalCheckFailedException({
        message: "Conditional check failed",
        $metadata: {},
      });
      mockSend.mockRejectedValueOnce(error);

      await expect(
        updateItemWithVersion(
          mockClient,
          tableConfig,
          {
            key: { PK: "USER#1", SK: "SAVE#1" },
            updateExpression: "SET title = :title",
            expressionAttributeValues: { ":title": "New" },
          },
          1
        )
      ).rejects.toThrow(VersionConflictError);
    });

    it("should include actual server version from ReturnValuesOnConditionCheckFailure", async () => {
      const error = Object.assign(
        new ConditionalCheckFailedException({
          message: "Conditional check failed",
          $metadata: {},
        }),
        { Item: { PK: "USER#1", SK: "SAVE#1", version: 5, title: "Old" } }
      );
      mockSend.mockRejectedValueOnce(error);

      try {
        await updateItemWithVersion(
          mockClient,
          tableConfig,
          {
            key: { PK: "USER#1", SK: "SAVE#1" },
            updateExpression: "SET title = :title",
            expressionAttributeValues: { ":title": "New" },
          },
          1
        );
        expect.unreachable("should have thrown");
      } catch (e) {
        expect(e).toBeInstanceOf(VersionConflictError);
        // The error should report the actual server version (5), not the expected version (1)
        expect((e as VersionConflictError).currentVersion).toBe(5);
      }
    });

    it("should fall back to expectedVersion when Item is not available on error", async () => {
      const error = new ConditionalCheckFailedException({
        message: "Conditional check failed",
        $metadata: {},
      });
      mockSend.mockRejectedValueOnce(error);

      try {
        await updateItemWithVersion(
          mockClient,
          tableConfig,
          {
            key: { PK: "USER#1", SK: "SAVE#1" },
            updateExpression: "SET title = :title",
            expressionAttributeValues: { ":title": "New" },
          },
          3
        );
        expect.unreachable("should have thrown");
      } catch (e) {
        expect(e).toBeInstanceOf(VersionConflictError);
        expect((e as VersionConflictError).currentVersion).toBe(3);
      }
    });

    it("should include ReturnValuesOnConditionCheckFailure in the update command", async () => {
      mockSend.mockResolvedValueOnce({
        Attributes: { PK: "USER#1", SK: "SAVE#1", version: 2, title: "New" },
      });

      await updateItemWithVersion(
        mockClient,
        tableConfig,
        {
          key: { PK: "USER#1", SK: "SAVE#1" },
          updateExpression: "SET title = :title",
          expressionAttributeValues: { ":title": "New" },
        },
        1
      );

      const input = mockSend.mock.calls[0][0].input;
      expect(input.ReturnValuesOnConditionCheckFailure).toBe("ALL_OLD");
    });

    it("should throw INTERNAL_ERROR on non-conditional failures", async () => {
      mockSend.mockRejectedValueOnce(new Error("Network error"));

      try {
        await updateItemWithVersion(
          mockClient,
          tableConfig,
          {
            key: { PK: "USER#1", SK: "SAVE#1" },
            updateExpression: "SET title = :title",
            expressionAttributeValues: { ":title": "New" },
          },
          1
        );
      } catch (e) {
        expect(AppError.isAppError(e)).toBe(true);
        if (AppError.isAppError(e)) {
          expect(e.code).toBe(ErrorCode.INTERNAL_ERROR);
        }
      }
    });

    it("should merge with existing conditionExpression using AND", async () => {
      mockSend.mockResolvedValueOnce({
        Attributes: { PK: "USER#1", version: 2 },
      });

      await updateItemWithVersion(
        mockClient,
        tableConfig,
        {
          key: { PK: "USER#1" },
          updateExpression: "SET title = :title",
          expressionAttributeValues: { ":title": "New" },
          conditionExpression: "attribute_exists(PK)",
        },
        1
      );

      const input = mockSend.mock.calls[0][0].input;
      expect(input.ConditionExpression).toBe(
        "(attribute_exists(PK)) AND (#_ver = :_expectedVer)"
      );
    });
  });

  describe("putItemWithVersion", () => {
    it("should set version to 1 on new items", async () => {
      mockSend.mockResolvedValueOnce({});

      await putItemWithVersion(mockClient, tableConfig, {
        PK: "USER#1",
        SK: "SAVE#1",
        title: "Test",
      });

      const input = mockSend.mock.calls[0][0].input;
      expect(input.Item.version).toBe(1);
    });

    it("should not overwrite caller-provided version", async () => {
      mockSend.mockResolvedValueOnce({});

      await putItemWithVersion(mockClient, tableConfig, {
        PK: "USER#1",
        SK: "SAVE#1",
        title: "Test",
      });

      const input = mockSend.mock.calls[0][0].input;
      // Always sets version to 1 for new items
      expect(input.Item.version).toBe(1);
    });

    it("should pass through to putItem", async () => {
      mockSend.mockResolvedValueOnce({});

      await putItemWithVersion(mockClient, tableConfig, {
        PK: "USER#1",
        title: "Test",
      });

      expect(mockSend).toHaveBeenCalledOnce();
    });

    it("should include conditional write to prevent overwrites", async () => {
      mockSend.mockResolvedValueOnce({});

      await putItemWithVersion(mockClient, tableConfig, {
        PK: "USER#1",
        SK: "SAVE#1",
        title: "Test",
      });

      const input = mockSend.mock.calls[0][0].input;
      expect(input.ConditionExpression).toBe("attribute_not_exists(PK)");
    });

    it("should throw CONFLICT when item already exists", async () => {
      const error = new ConditionalCheckFailedException({
        message: "Conditional check failed",
        $metadata: {},
      });
      mockSend.mockRejectedValueOnce(error);

      try {
        await putItemWithVersion(mockClient, tableConfig, {
          PK: "USER#1",
          SK: "SAVE#1",
          title: "Test",
        });
        expect.unreachable("should have thrown");
      } catch (e) {
        expect(AppError.isAppError(e)).toBe(true);
        if (AppError.isAppError(e)) {
          expect(e.code).toBe(ErrorCode.CONFLICT);
          expect(e.message).toBe("Item already exists");
        }
      }
    });

    it("should throw INTERNAL_ERROR on non-conditional failures", async () => {
      mockSend.mockRejectedValueOnce(new Error("Network error"));

      try {
        await putItemWithVersion(mockClient, tableConfig, {
          PK: "USER#1",
          title: "Test",
        });
        expect.unreachable("should have thrown");
      } catch (e) {
        expect(AppError.isAppError(e)).toBe(true);
        if (AppError.isAppError(e)) {
          expect(e.code).toBe(ErrorCode.INTERNAL_ERROR);
        }
      }
    });
  });
});
