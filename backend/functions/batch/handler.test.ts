/**
 * Batch handler tests — POST /batch
 *
 * Story 3.2.9, Task 5: Tests AC6-AC13 (batch operations).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createMockEvent,
  createMockContext,
  mockCreateLoggerModule,
} from "../../test-utils/index.js";
import { ErrorCode } from "@ai-learning-hub/types";

// Mock @ai-learning-hub/logging
vi.mock("@ai-learning-hub/logging", () => mockCreateLoggerModule());

// Mock @ai-learning-hub/middleware
vi.mock("@ai-learning-hub/middleware", async () => {
  const { mockMiddlewareModule } =
    await import("../../test-utils/mock-wrapper.js");
  return mockMiddlewareModule();
});

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// Set env var — lazy init means this runs before first handler call
process.env.API_BASE_URL = "https://api.example.com/dev";

import { handler } from "./handler.js";

const mockContext = createMockContext();

function createBatchEvent(
  operations: unknown[],
  userId = "user123",
  headers?: Record<string, string>
) {
  return createMockEvent({
    method: "POST",
    path: "/batch",
    userId,
    body: { operations } as Record<string, unknown>,
    headers: {
      authorization: "Bearer test-jwt",
      "idempotency-key": "batch-key-1",
      ...headers,
    },
  });
}

function mockFetchResponse(statusCode: number, data: unknown) {
  return Promise.resolve({
    status: statusCode,
    json: () => Promise.resolve(statusCode < 400 ? { data } : { error: data }),
  } as Response);
}

describe("POST /batch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
  });

  it("accepts valid operation array and returns per-operation results (AC6, AC8)", async () => {
    mockFetch.mockImplementation(() =>
      mockFetchResponse(200, { id: "save-1" })
    );

    const event = createBatchEvent([
      {
        method: "POST",
        path: "/saves",
        body: { url: "https://example.com" },
        headers: { "Idempotency-Key": "op-key-1" },
      },
    ]);

    const result = await handler(event, mockContext);
    expect(result.statusCode).toBe(200);

    const body = JSON.parse(result.body);
    expect(body.data.results).toHaveLength(1);
    expect(body.data.results[0].operationIndex).toBe(0);
    expect(body.data.results[0].statusCode).toBe(200);
    expect(body.data.summary.total).toBe(1);
    expect(body.data.summary.succeeded).toBe(1);
    expect(body.data.summary.failed).toBe(0);
  });

  it("returns 400 when operations array exceeds 25 (AC6)", async () => {
    const operations = Array.from({ length: 26 }, (_, i) => ({
      method: "POST",
      path: "/saves",
      body: { url: `https://example.com/${i}` },
      headers: { "Idempotency-Key": `op-key-${i}` },
    }));

    const event = createBatchEvent(operations);
    const result = await handler(event, mockContext);

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.error.code).toBe(ErrorCode.VALIDATION_ERROR);
  });

  it("returns 400 when operations array is empty (AC6)", async () => {
    const event = createBatchEvent([]);
    const result = await handler(event, mockContext);

    expect(result.statusCode).toBe(400);
  });

  it("rejects operations targeting /batch (recursive prevention) (AC6)", async () => {
    const event = createBatchEvent([
      {
        method: "POST",
        path: "/batch",
        body: { operations: [] },
        headers: { "Idempotency-Key": "op-key-1" },
      },
    ]);

    const result = await handler(event, mockContext);
    expect(result.statusCode).toBe(400);
  });

  it("returns per-operation 400 for operations missing Idempotency-Key (AC7)", async () => {
    mockFetch.mockImplementation(() =>
      mockFetchResponse(200, { id: "save-1" })
    );

    const event = createBatchEvent([
      {
        method: "POST",
        path: "/saves",
        body: { url: "https://example.com" },
        // No headers / no Idempotency-Key
      },
    ]);

    const result = await handler(event, mockContext);
    expect(result.statusCode).toBe(200);

    const body = JSON.parse(result.body);
    expect(body.data.results[0].statusCode).toBe(400);
    expect(body.data.results[0].error.code).toBe("MISSING_IDEMPOTENCY_KEY");
  });

  it("rejects duplicate Idempotency-Key values across operations (AC7)", async () => {
    const event = createBatchEvent([
      {
        method: "POST",
        path: "/saves",
        body: { url: "https://example.com/1" },
        headers: { "Idempotency-Key": "same-key" },
      },
      {
        method: "POST",
        path: "/saves",
        body: { url: "https://example.com/2" },
        headers: { "Idempotency-Key": "same-key" },
      },
    ]);

    const result = await handler(event, mockContext);
    expect(result.statusCode).toBe(400);
  });

  it("handles partial failure — some succeed, some fail (AC9)", async () => {
    mockFetch
      .mockImplementationOnce(() => mockFetchResponse(200, { id: "save-1" }))
      .mockImplementationOnce(() =>
        mockFetchResponse(400, {
          code: "VALIDATION_ERROR",
          message: "Bad request",
        })
      );

    const event = createBatchEvent([
      {
        method: "POST",
        path: "/saves",
        body: { url: "https://example.com/1" },
        headers: { "Idempotency-Key": "op-key-1" },
      },
      {
        method: "POST",
        path: "/saves",
        body: { url: "invalid" },
        headers: { "Idempotency-Key": "op-key-2" },
      },
    ]);

    const result = await handler(event, mockContext);
    expect(result.statusCode).toBe(200);

    const body = JSON.parse(result.body);
    expect(body.data.summary.total).toBe(2);
    expect(body.data.summary.succeeded).toBe(1);
    expect(body.data.summary.failed).toBe(1);
    expect(body.data.results[0].statusCode).toBe(200);
    expect(body.data.results[1].statusCode).toBe(400);
  });

  it("forwards Authorization header to sub-operations (AC10)", async () => {
    mockFetch.mockImplementation(() =>
      mockFetchResponse(200, { id: "save-1" })
    );

    const event = createBatchEvent([
      {
        method: "POST",
        path: "/saves",
        body: { url: "https://example.com" },
        headers: { "Idempotency-Key": "op-key-1" },
      },
    ]);

    await handler(event, mockContext);

    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.example.com/dev/saves",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer test-jwt",
        }),
      })
    );
  });

  it("handles operation timeout with 504 (AC11)", async () => {
    const abortError = new Error("The operation was aborted");
    abortError.name = "AbortError";
    mockFetch.mockRejectedValueOnce(abortError);

    const event = createBatchEvent([
      {
        method: "POST",
        path: "/saves",
        body: { url: "https://example.com" },
        headers: { "Idempotency-Key": "op-key-1" },
      },
    ]);

    const result = await handler(event, mockContext);
    expect(result.statusCode).toBe(200);

    const body = JSON.parse(result.body);
    expect(body.data.results[0].statusCode).toBe(504);
    expect(body.data.results[0].error.code).toBe("OPERATION_TIMEOUT");
  });

  it("requires authentication (AC12)", async () => {
    const event = createMockEvent({
      method: "POST",
      path: "/batch",
      body: { operations: [] },
    });

    const result = await handler(event, mockContext);
    expect(result.statusCode).toBe(401);
  });

  it("results are ordered by operationIndex (AC8)", async () => {
    mockFetch
      .mockImplementationOnce(() => mockFetchResponse(201, { id: "save-1" }))
      .mockImplementationOnce(() => mockFetchResponse(200, { id: "save-2" }))
      .mockImplementationOnce(() => mockFetchResponse(204, null));

    const event = createBatchEvent([
      {
        method: "POST",
        path: "/saves",
        body: { url: "https://example.com/1" },
        headers: { "Idempotency-Key": "op-key-1" },
      },
      {
        method: "PATCH",
        path: "/saves/abc",
        body: { title: "Updated" },
        headers: { "Idempotency-Key": "op-key-2" },
      },
      {
        method: "DELETE",
        path: "/saves/xyz",
        headers: { "Idempotency-Key": "op-key-3" },
      },
    ]);

    const result = await handler(event, mockContext);
    const body = JSON.parse(result.body);

    expect(body.data.results[0].operationIndex).toBe(0);
    expect(body.data.results[1].operationIndex).toBe(1);
    expect(body.data.results[2].operationIndex).toBe(2);
  });

  it("includes links and meta in response (AC8)", async () => {
    mockFetch.mockImplementation(() =>
      mockFetchResponse(200, { id: "save-1" })
    );

    const event = createBatchEvent([
      {
        method: "POST",
        path: "/saves",
        body: { url: "https://example.com" },
        headers: { "Idempotency-Key": "op-key-1" },
      },
    ]);

    const result = await handler(event, mockContext);
    const body = JSON.parse(result.body);

    expect(body.links).toBeDefined();
    expect(body.links.self).toBe("/batch");
  });
});
