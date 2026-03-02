/**
 * Readiness handler tests — GET /ready
 *
 * Story 3.2.9, Task 4: Tests AC3 (healthy), AC4 (degraded), AC5 (no auth).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createMockEvent,
  createMockContext,
  mockCreateLoggerModule,
} from "../../test-utils/index.js";

// Mock @ai-learning-hub/logging
vi.mock("@ai-learning-hub/logging", () => mockCreateLoggerModule());

// Mock @ai-learning-hub/middleware
vi.mock("@ai-learning-hub/middleware", async () => {
  const { mockMiddlewareModule } =
    await import("../../test-utils/mock-wrapper.js");
  return mockMiddlewareModule();
});

// Mock @ai-learning-hub/db
const mockGetItem = vi.fn();
vi.mock("@ai-learning-hub/db", () => ({
  getDefaultClient: () => ({}),
  getItem: (...args: unknown[]) => mockGetItem(...args),
}));

// Set env var before importing handler
process.env.USERS_TABLE_NAME = "test-users-table";

// Import handler AFTER mocks
import { handler, _resetCacheForTesting } from "./handler.js";

const mockContext = createMockContext();

describe("GET /ready", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _resetCacheForTesting();
  });

  it("returns 200 with ready=true when DynamoDB is healthy (AC3)", async () => {
    mockGetItem.mockResolvedValueOnce(null); // GetItem returns successfully

    const event = createMockEvent({ method: "GET", path: "/ready" });
    const result = await handler(event, mockContext);

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.data.ready).toBe(true);
    expect(body.data.dependencies.dynamodb).toBe("ok");
    expect(body.data.timestamp).toBeDefined();
  });

  it("returns 503 with ready=false when DynamoDB fails (AC4)", async () => {
    mockGetItem.mockRejectedValueOnce(new Error("Connection refused"));

    const event = createMockEvent({ method: "GET", path: "/ready" });
    const result = await handler(event, mockContext);

    expect(result.statusCode).toBe(503);
    const body = JSON.parse(result.body);
    expect(body.data.ready).toBe(false);
    expect(body.data.dependencies.dynamodb).toBe("unhealthy");
  });

  it("returns 503 when DynamoDB times out (AC4)", async () => {
    // Simulate abort signal error
    const abortError = new Error("The operation was aborted");
    abortError.name = "AbortError";
    mockGetItem.mockRejectedValueOnce(abortError);

    const event = createMockEvent({ method: "GET", path: "/ready" });
    const result = await handler(event, mockContext);

    expect(result.statusCode).toBe(503);
    const body = JSON.parse(result.body);
    expect(body.data.ready).toBe(false);
    expect(body.data.dependencies.dynamodb).toBe("unhealthy");
  });

  it("caches healthy result for 10 seconds (AC3)", async () => {
    mockGetItem.mockResolvedValue(null); // All calls succeed (item not found = healthy)

    const event = createMockEvent({ method: "GET", path: "/ready" });

    await handler(event, mockContext);
    await handler(event, mockContext);

    // Should only call DynamoDB once (second is cached)
    expect(mockGetItem).toHaveBeenCalledTimes(1);
  });

  it("caches unhealthy result for 10 seconds (AC4)", async () => {
    mockGetItem.mockRejectedValue(new Error("Down"));

    const event = createMockEvent({ method: "GET", path: "/ready" });

    await handler(event, mockContext);
    await handler(event, mockContext);

    // Should only call DynamoDB once (second is cached)
    expect(mockGetItem).toHaveBeenCalledTimes(1);
  });

  it("does not require authentication (AC5)", async () => {
    mockGetItem.mockResolvedValueOnce(null);

    const event = createMockEvent({ method: "GET", path: "/ready" });
    const result = await handler(event, mockContext);

    expect(result.statusCode).toBe(200);
  });

  it("includes links.self in response (AC3)", async () => {
    mockGetItem.mockResolvedValueOnce(null);

    const event = createMockEvent({ method: "GET", path: "/ready" });
    const result = await handler(event, mockContext);

    const body = JSON.parse(result.body);
    expect(body.links).toBeDefined();
    expect(body.links.self).toBe("/ready");
  });

  it("returns ISO 8601 timestamp (AC3)", async () => {
    mockGetItem.mockResolvedValueOnce(null);

    const event = createMockEvent({ method: "GET", path: "/ready" });
    const result = await handler(event, mockContext);

    const body = JSON.parse(result.body);
    const date = new Date(body.data.timestamp);
    expect(date.toISOString()).toBe(body.data.timestamp);
  });
});
