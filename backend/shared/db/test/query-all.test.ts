/**
 * Tests for query-all.ts — queryAllItems helper.
 * Story 3.2, Task 9.1
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock @aws-sdk/lib-dynamodb
const mockSend = vi.fn();
vi.mock("@aws-sdk/lib-dynamodb", () => {
  return {
    QueryCommand: vi.fn().mockImplementation((input) => input),
    DynamoDBDocumentClient: {},
  };
});

// Mock @ai-learning-hub/logging
vi.mock("@ai-learning-hub/logging", () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    timed: vi.fn(),
    child: vi.fn().mockReturnThis(),
    setRequestContext: vi.fn(),
  }),
}));

import { queryAllItems, type QueryAllParams } from "../src/query-all.js";
import type { TableConfig } from "../src/helpers.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockClient = { send: mockSend } as any;

const testConfig: TableConfig = {
  tableName: "test-table",
  partitionKey: "PK",
  sortKey: "SK",
};

const baseParams: QueryAllParams = {
  keyConditionExpression: "PK = :pk",
  expressionAttributeValues: { ":pk": "USER#test" },
};

describe("queryAllItems", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns items from a single-page result", async () => {
    mockSend.mockResolvedValueOnce({
      Items: [{ id: "1" }, { id: "2" }],
      LastEvaluatedKey: undefined,
    });

    const result = await queryAllItems(mockClient, testConfig, baseParams);

    expect(result.items).toEqual([{ id: "1" }, { id: "2" }]);
    expect(result.truncated).toBe(false);
    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  it("accumulates items across two pages", async () => {
    mockSend
      .mockResolvedValueOnce({
        Items: [{ id: "1" }],
        LastEvaluatedKey: { PK: "USER#test", SK: "1" },
      })
      .mockResolvedValueOnce({
        Items: [{ id: "2" }],
        LastEvaluatedKey: undefined,
      });

    const result = await queryAllItems(mockClient, testConfig, baseParams);

    expect(result.items).toEqual([{ id: "1" }, { id: "2" }]);
    expect(result.truncated).toBe(false);
    expect(mockSend).toHaveBeenCalledTimes(2);
  });

  it("truncates at ceiling and marks truncated: true", async () => {
    const items = Array.from({ length: 3 }, (_, i) => ({ id: String(i) }));

    mockSend.mockResolvedValueOnce({
      Items: items,
      LastEvaluatedKey: { PK: "USER#test", SK: "3" },
    });

    const result = await queryAllItems(mockClient, testConfig, {
      ...baseParams,
      ceiling: 2,
    });

    expect(result.items).toHaveLength(2);
    expect(result.truncated).toBe(true);
  });

  it("returns empty array for empty table", async () => {
    mockSend.mockResolvedValueOnce({
      Items: [],
      LastEvaluatedKey: undefined,
    });

    const result = await queryAllItems(mockClient, testConfig, baseParams);

    expect(result.items).toEqual([]);
    expect(result.truncated).toBe(false);
  });

  it("passes ConsistentRead: true to DynamoDB", async () => {
    mockSend.mockResolvedValueOnce({
      Items: [],
      LastEvaluatedKey: undefined,
    });

    await queryAllItems(mockClient, testConfig, {
      ...baseParams,
      consistentRead: true,
    });

    const input = mockSend.mock.calls[0][0];
    expect(input.ConsistentRead).toBe(true);
  });

  it("disables Limit optimization when filterExpression is present", async () => {
    mockSend.mockResolvedValueOnce({
      Items: [{ id: "1" }],
      LastEvaluatedKey: undefined,
    });

    await queryAllItems(mockClient, testConfig, {
      ...baseParams,
      filterExpression: "attribute_not_exists(deletedAt)",
      ceiling: 1000,
    });

    const input = mockSend.mock.calls[0][0];
    // With filterExpression, should use fixed page size of 500 (not ceiling-remainder)
    expect(input.Limit).toBe(500);
    expect(input.FilterExpression).toBe("attribute_not_exists(deletedAt)");
  });

  it("uses ceiling-remainder as Limit when no filterExpression", async () => {
    mockSend.mockResolvedValueOnce({
      Items: [],
      LastEvaluatedKey: undefined,
    });

    await queryAllItems(mockClient, testConfig, {
      ...baseParams,
      ceiling: 100,
    });

    const input = mockSend.mock.calls[0][0];
    expect(input.Limit).toBe(100);
  });

  it("logs page counter and totalItems", async () => {
    const mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      timed: vi.fn(),
      child: vi.fn().mockReturnThis(),
      setRequestContext: vi.fn(),
    };

    mockSend
      .mockResolvedValueOnce({
        Items: [{ id: "1" }],
        LastEvaluatedKey: { PK: "test", SK: "1" },
      })
      .mockResolvedValueOnce({
        Items: [{ id: "2" }],
        LastEvaluatedKey: undefined,
      });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await queryAllItems(mockClient, testConfig, baseParams, mockLogger as any);

    expect(mockLogger.timed).toHaveBeenCalledWith(
      "DynamoDB QueryAll",
      expect.any(Number),
      expect.objectContaining({
        table: "test-table",
        totalItems: 2,
        pages: 2,
        truncated: false,
      })
    );
  });
});
