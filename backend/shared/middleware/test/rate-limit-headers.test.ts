/**
 * Unit tests for rate limit transparency headers (Story 3.2.4, AC7-AC12, AC18)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { RateLimitResult } from "@ai-learning-hub/db";
import {
  calculateRateLimitReset,
  buildRateLimitHeaders,
  addRateLimitHeaders,
  buildRateLimitMeta,
} from "../src/rate-limit-headers.js";

describe("calculateRateLimitReset", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns Unix epoch seconds for window end", () => {
    // Set time to 2026-02-26T12:30:00Z
    vi.setSystemTime(new Date("2026-02-26T12:30:00Z"));
    const reset = calculateRateLimitReset(3600); // 1-hour window
    // Window boundary: 2026-02-26T13:00:00Z = 1772110800
    expect(reset).toBe(1772110800);
  });

  it("advances to next window at exact boundary", () => {
    // Exact boundary: 2026-02-26T13:00:00Z = 1772110800
    // Reset should point to NEXT window: 14:00:00Z = 1772114400
    vi.setSystemTime(new Date("2026-02-26T13:00:00Z"));
    const reset = calculateRateLimitReset(3600);
    expect(reset).toBe(1772114400);
  });

  it("returns number as integer (not float)", () => {
    vi.setSystemTime(new Date("2026-02-26T12:15:30.500Z"));
    const reset = calculateRateLimitReset(3600);
    expect(Number.isInteger(reset)).toBe(true);
  });
});

describe("buildRateLimitHeaders", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-26T12:30:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns correct headers for allowed request", () => {
    const result: RateLimitResult = {
      allowed: true,
      current: 5,
      limit: 200,
    };
    const headers = buildRateLimitHeaders(result, 3600);
    expect(headers["X-RateLimit-Limit"]).toBe("200");
    expect(headers["X-RateLimit-Remaining"]).toBe("195");
    expect(headers["X-RateLimit-Reset"]).toBe("1772110800");
    expect(headers["Retry-After"]).toBeUndefined();
  });

  it("clamps remaining to 0 when current exceeds limit", () => {
    const result: RateLimitResult = {
      allowed: false,
      current: 210,
      limit: 200,
      retryAfterSeconds: 1800,
    };
    const headers = buildRateLimitHeaders(result, 3600);
    expect(headers["X-RateLimit-Remaining"]).toBe("0");
  });

  it("includes Retry-After when retryAfterSeconds is set", () => {
    const result: RateLimitResult = {
      allowed: false,
      current: 200,
      limit: 200,
      retryAfterSeconds: 1847,
    };
    const headers = buildRateLimitHeaders(result, 3600);
    expect(headers["Retry-After"]).toBe("1847");
  });

  it("omits Retry-After when retryAfterSeconds is undefined", () => {
    const result: RateLimitResult = {
      allowed: true,
      current: 1,
      limit: 100,
    };
    const headers = buildRateLimitHeaders(result, 3600);
    expect(headers).not.toHaveProperty("Retry-After");
  });

  it("remaining is exactly 0 when current equals limit", () => {
    const result: RateLimitResult = {
      allowed: true,
      current: 200,
      limit: 200,
    };
    const headers = buildRateLimitHeaders(result, 3600);
    expect(headers["X-RateLimit-Remaining"]).toBe("0");
  });
});

describe("addRateLimitHeaders", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-26T12:30:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("merges rate limit headers with existing response headers", () => {
    const response = {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "X-Request-Id": "req-123",
      },
      body: '{"data":{}}',
    };
    const result: RateLimitResult = {
      allowed: true,
      current: 3,
      limit: 100,
    };
    const decorated = addRateLimitHeaders(response, result, 3600);
    expect(decorated.headers?.["Content-Type"]).toBe("application/json");
    expect(decorated.headers?.["X-Request-Id"]).toBe("req-123");
    expect(decorated.headers?.["X-RateLimit-Limit"]).toBe("100");
    expect(decorated.headers?.["X-RateLimit-Remaining"]).toBe("97");
  });

  it("does not mutate the original response", () => {
    const response = {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: "{}",
    };
    const result: RateLimitResult = {
      allowed: true,
      current: 1,
      limit: 50,
    };
    const decorated = addRateLimitHeaders(response, result, 3600);
    expect(decorated).not.toBe(response);
    expect(response.headers).not.toHaveProperty("X-RateLimit-Limit");
  });

  it("handles response with no existing headers", () => {
    const response = {
      statusCode: 200,
      body: "{}",
    };
    const result: RateLimitResult = {
      allowed: true,
      current: 1,
      limit: 50,
    };
    const decorated = addRateLimitHeaders(response, result, 3600);
    expect(decorated.headers?.["X-RateLimit-Limit"]).toBe("50");
  });
});

describe("buildRateLimitMeta", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-26T12:30:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns rate limit meta with ISO 8601 reset", () => {
    const result: RateLimitResult = {
      allowed: true,
      current: 10,
      limit: 200,
    };
    const meta = buildRateLimitMeta(result, 3600);
    expect(meta.limit).toBe(200);
    expect(meta.remaining).toBe(190);
    // ISO 8601 format
    expect(meta.reset).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    // Parse back and verify it's a valid date
    expect(new Date(meta.reset).getTime()).toBeGreaterThan(0);
  });

  it("clamps remaining to 0", () => {
    const result: RateLimitResult = {
      allowed: false,
      current: 250,
      limit: 200,
      retryAfterSeconds: 300,
    };
    const meta = buildRateLimitMeta(result, 3600);
    expect(meta.remaining).toBe(0);
  });
});
