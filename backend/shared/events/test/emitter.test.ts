import { describe, it, expect, beforeEach, vi } from "vitest";
import type { EventBridgeClient } from "@aws-sdk/client-eventbridge";
import type { Logger } from "@ai-learning-hub/logging";
import { emitEvent, type EventEntry } from "../src/emitter.js";

// Drains the microtask queue and any pending I/O callbacks.
// Required after calling emitEvent() to allow the detached IIFE to complete
// before asserting on logger.warn or PutEventsCommand call counts.
const flushPromises = (): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, 0));

const mockSend = vi.fn();

vi.mock("@aws-sdk/client-eventbridge", () => {
  const MockPutEventsCommand = vi.fn((input: unknown) => input);
  return {
    EventBridgeClient: vi.fn(),
    PutEventsCommand: MockPutEventsCommand,
  };
});

const mockClient = { send: mockSend } as unknown as EventBridgeClient;

const mockWarn = vi.fn();
const mockLogger = {
  warn: mockWarn,
  info: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
} as unknown as Logger;

const testEntry: EventEntry<"SaveCreated", { userId: string; saveId: string }> =
  {
    source: "ai-learning-hub.saves",
    detailType: "SaveCreated",
    detail: { userId: "user-1", saveId: "save-1" },
  };

describe("emitEvent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns void synchronously and does NOT return a Promise (AC1, AC6)", () => {
    mockSend.mockResolvedValueOnce({ FailedEntryCount: 0, Entries: [] });

    const result = emitEvent(mockClient, "test-bus", testEntry, mockLogger);

    expect(result).toBeUndefined();
  });

  it("calls PutEventsCommand with correct Source, DetailType, Detail, EventBusName (AC4)", async () => {
    mockSend.mockResolvedValueOnce({ FailedEntryCount: 0, Entries: [] });

    emitEvent(mockClient, "test-bus", testEntry, mockLogger);

    await flushPromises();

    expect(mockSend).toHaveBeenCalledOnce();
    const command = mockSend.mock.calls[0][0];
    expect(command).toEqual({
      Entries: [
        {
          Source: "ai-learning-hub.saves",
          DetailType: "SaveCreated",
          Detail: JSON.stringify({ userId: "user-1", saveId: "save-1" }),
          EventBusName: "test-bus",
        },
      ],
    });
  });

  it("does NOT call logger.warn on success with FailedEntryCount === 0 (AC1)", async () => {
    mockSend.mockResolvedValueOnce({ FailedEntryCount: 0, Entries: [] });

    emitEvent(mockClient, "test-bus", testEntry, mockLogger);

    await flushPromises();

    expect(mockWarn).not.toHaveBeenCalled();
  });

  it("does NOT throw at the call site when PutEvents throws (AC2)", async () => {
    mockSend.mockRejectedValueOnce(new Error("throttled"));

    // Should not throw
    emitEvent(mockClient, "test-bus", testEntry, mockLogger);

    await flushPromises();

    expect(mockWarn).toHaveBeenCalledWith(
      "EventBridge PutEvents failed (non-fatal)",
      expect.objectContaining({ detailType: "SaveCreated" })
    );
  });

  it("logs warn with error info when PutEvents throws (AC2)", async () => {
    mockSend.mockRejectedValueOnce(new Error("throttled"));

    emitEvent(mockClient, "test-bus", testEntry, mockLogger);

    await flushPromises();

    expect(mockWarn).toHaveBeenCalledWith(
      "EventBridge PutEvents failed (non-fatal)",
      {
        detailType: "SaveCreated",
        error: "throttled",
        errorName: "Error",
        errorStack: expect.stringContaining("throttled"),
      }
    );
  });

  it("logs warn with FailedEntryCount > 0 including errorCode and errorMessage (AC7)", async () => {
    mockSend.mockResolvedValueOnce({
      FailedEntryCount: 1,
      Entries: [
        {
          ErrorCode: "InternalFailure",
          ErrorMessage: "Something went wrong",
        },
      ],
    });

    emitEvent(mockClient, "test-bus", testEntry, mockLogger);

    await flushPromises();

    expect(mockWarn).toHaveBeenCalledWith(
      "EventBridge PutEvents partial failure (non-fatal)",
      {
        detailType: "SaveCreated",
        failedCount: 1,
        errorCode: "InternalFailure",
        errorMessage: "Something went wrong",
      }
    );
  });

  it("does not throw when logger.warn itself throws in catch block", async () => {
    mockSend.mockRejectedValueOnce(new Error("network error"));
    mockWarn.mockImplementationOnce(() => {
      throw new Error("logger broken");
    });

    // Should not throw or cause unhandled rejection
    emitEvent(mockClient, "test-bus", testEntry, mockLogger);

    await flushPromises();

    // The logger.warn was called but threw; the outer catch swallowed it
    expect(mockWarn).toHaveBeenCalled();
  });

  it("handles non-Error thrown values in catch block", async () => {
    mockSend.mockRejectedValueOnce("string error");

    emitEvent(mockClient, "test-bus", testEntry, mockLogger);

    await flushPromises();

    expect(mockWarn).toHaveBeenCalledWith(
      "EventBridge PutEvents failed (non-fatal)",
      {
        detailType: "SaveCreated",
        error: "string error",
        errorName: undefined,
        errorStack: undefined,
      }
    );
  });
});
