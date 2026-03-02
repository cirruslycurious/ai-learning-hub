/**
 * Health handler tests — GET /health
 *
 * Story 3.2.9, Task 3: Tests AC1 (response shape) and AC2 (no auth required).
 */
import { describe, it, expect, vi } from "vitest";
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

import { handler } from "./handler.js";

const mockContext = createMockContext();

describe("GET /health", () => {
  it("returns 200 with healthy status (AC1)", async () => {
    const event = createMockEvent({ method: "GET", path: "/health" });
    const result = await handler(event, mockContext);

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.data).toBeDefined();
    expect(body.data.status).toBe("healthy");
    expect(body.data.version).toBe("1.0.0");
    expect(body.data.timestamp).toBeDefined();
  });

  it("returns ISO 8601 timestamp (AC1)", async () => {
    const event = createMockEvent({ method: "GET", path: "/health" });
    const result = await handler(event, mockContext);

    const body = JSON.parse(result.body);
    const date = new Date(body.data.timestamp);
    expect(date.toISOString()).toBe(body.data.timestamp);
  });

  it("includes links.self (AC1)", async () => {
    const event = createMockEvent({ method: "GET", path: "/health" });
    const result = await handler(event, mockContext);

    const body = JSON.parse(result.body);
    expect(body.links).toBeDefined();
    expect(body.links.self).toBe("/health");
  });

  it("does not require authentication (AC2)", async () => {
    // No userId provided — unauthenticated request
    const event = createMockEvent({ method: "GET", path: "/health" });
    const result = await handler(event, mockContext);

    expect(result.statusCode).toBe(200);
  });

  it("wraps response in standard envelope { data, links } (AC1)", async () => {
    const event = createMockEvent({ method: "GET", path: "/health" });
    const result = await handler(event, mockContext);

    const body = JSON.parse(result.body);
    expect(body).toHaveProperty("data");
    expect(body).toHaveProperty("links");
    expect(body.data).toHaveProperty("status");
    expect(body.data).toHaveProperty("timestamp");
    expect(body.data).toHaveProperty("version");
  });
});
