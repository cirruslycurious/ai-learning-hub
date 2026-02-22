/**
 * transactWriteItems helper tests
 *
 * Story 3.1b, Task 1: TransactWriteItems helper for two-layer duplicate detection.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { TransactWriteCommand } from "@aws-sdk/lib-dynamodb";
import { TransactionCanceledException } from "@aws-sdk/client-dynamodb";

// Mock the logging module
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

import {
  transactWriteItems,
  TransactionCancelledError,
} from "../src/transact.js";
import { createLogger } from "@ai-learning-hub/logging";

function createMockClient() {
  return { send: vi.fn() };
}

describe("transactWriteItems", () => {
  let mockClient: ReturnType<typeof createMockClient>;
  const logger = createLogger();

  beforeEach(() => {
    vi.clearAllMocks();
    mockClient = createMockClient();
  });

  it("sends TransactWriteCommand with provided items", async () => {
    mockClient.send.mockResolvedValueOnce({});

    const transactItems = [
      {
        Put: {
          TableName: "test-table",
          Item: { PK: "USER#123", SK: "SAVE#abc" },
        },
      },
      {
        Put: {
          TableName: "test-table",
          Item: { PK: "USER#123", SK: "URL#hash" },
          ConditionExpression: "attribute_not_exists(SK)",
        },
      },
    ];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await transactWriteItems(mockClient as any, transactItems, logger);

    expect(mockClient.send).toHaveBeenCalledOnce();
    const sentCommand = mockClient.send.mock.calls[0][0];
    expect(sentCommand).toBeInstanceOf(TransactWriteCommand);
    expect(sentCommand.input.TransactItems).toEqual(transactItems);
  });

  it("resolves successfully when transaction succeeds", async () => {
    mockClient.send.mockResolvedValueOnce({});

    await expect(
      transactWriteItems(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        mockClient as any,
        [
          {
            Put: {
              TableName: "t",
              Item: { PK: "a", SK: "b" },
            },
          },
        ],
        logger
      )
    ).resolves.toBeUndefined();
  });

  it("throws TransactionCancelledError with reason codes on ConditionalCheckFailed", async () => {
    const cancelError = new TransactionCanceledException({
      message: "Transaction cancelled",
      $metadata: {},
      CancellationReasons: [
        { Code: "None" },
        { Code: "ConditionalCheckFailed", Message: "Condition not met" },
      ],
    });

    mockClient.send.mockRejectedValueOnce(cancelError);

    try {
      await transactWriteItems(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        mockClient as any,
        [
          {
            Put: {
              TableName: "t",
              Item: { PK: "a", SK: "SAVE#1" },
            },
          },
          {
            Put: {
              TableName: "t",
              Item: { PK: "a", SK: "URL#hash" },
              ConditionExpression: "attribute_not_exists(SK)",
            },
          },
        ],
        logger
      );
      expect.fail("Should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(TransactionCancelledError);
      const txError = error as TransactionCancelledError;
      expect(txError.reasons).toHaveLength(2);
      expect(txError.reasons[0]).toBe("None");
      expect(txError.reasons[1]).toBe("ConditionalCheckFailed");
    }
  });

  it("throws AppError INTERNAL_ERROR for non-transaction errors", async () => {
    mockClient.send.mockRejectedValueOnce(new Error("Network error"));

    await expect(
      transactWriteItems(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        mockClient as any,
        [
          {
            Put: {
              TableName: "t",
              Item: { PK: "a", SK: "b" },
            },
          },
        ],
        logger
      )
    ).rejects.toThrow("Database operation failed");
  });

  it("works without logger parameter", async () => {
    mockClient.send.mockResolvedValueOnce({});

    await expect(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      transactWriteItems(mockClient as any, [
        {
          Put: {
            TableName: "t",
            Item: { PK: "a", SK: "b" },
          },
        },
      ])
    ).resolves.toBeUndefined();
  });
});
