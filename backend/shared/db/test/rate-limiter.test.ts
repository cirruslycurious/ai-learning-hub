/**
 * Tests for rate limiting DynamoDB operations (Story 2.7)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getWindowKey,
  getCounterTTL,
  incrementAndCheckRateLimit,
  enforceRateLimit,
  type RateLimitConfig,
} from "../src/rate-limiter.js";

// Mock the DynamoDB DocumentClient
const mockSend = vi.fn();
const mockClient = {
  send: mockSend,
} as unknown as import("@aws-sdk/lib-dynamodb").DynamoDBDocumentClient;

// Mock logging
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

const TABLE_NAME = "ai-learning-hub-users";

describe("getWindowKey", () => {
  it("returns a string representing the window start epoch", () => {
    // 2026-02-16 14:30:00 UTC = epoch 1771339800
    const now = new Date("2026-02-16T14:30:00Z");
    const key = getWindowKey(3600, now);
    // Window start should be aligned to hour: 14:00:00 UTC = 1771338000
    expect(key).toBe(
      String(
        Math.floor(now.getTime() / 1000) -
          (Math.floor(now.getTime() / 1000) % 3600)
      )
    );
  });

  it("produces same key for times within the same window", () => {
    const now1 = new Date("2026-02-16T14:00:01Z");
    const now2 = new Date("2026-02-16T14:59:59Z");
    expect(getWindowKey(3600, now1)).toBe(getWindowKey(3600, now2));
  });

  it("produces different keys for times in different windows", () => {
    const now1 = new Date("2026-02-16T13:59:59Z");
    const now2 = new Date("2026-02-16T14:00:01Z");
    expect(getWindowKey(3600, now1)).not.toBe(getWindowKey(3600, now2));
  });
});

describe("getCounterTTL", () => {
  it("returns TTL set to 2x the window after window start", () => {
    const now = new Date("2026-02-16T14:30:00Z");
    const ttl = getCounterTTL(3600, now);
    const epochSeconds = Math.floor(now.getTime() / 1000);
    const windowStart = epochSeconds - (epochSeconds % 3600);
    // TTL should be windowStart + 2 * 3600
    expect(ttl).toBe(windowStart + 7200);
  });
});

describe("incrementAndCheckRateLimit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const config: RateLimitConfig = {
    operation: "apikey-create",
    identifier: "user_123",
    limit: 10,
    windowSeconds: 3600,
  };

  it("returns allowed=true when under the limit", async () => {
    mockSend.mockResolvedValueOnce({
      Attributes: { count: 5 },
    });

    const result = await incrementAndCheckRateLimit(
      mockClient,
      TABLE_NAME,
      config
    );

    expect(result.allowed).toBe(true);
    expect(result.current).toBe(5);
    expect(result.limit).toBe(10);
    expect(result.retryAfterSeconds).toBeUndefined();
  });

  it("returns allowed=true when exactly at the limit", async () => {
    mockSend.mockResolvedValueOnce({
      Attributes: { count: 10 },
    });

    const result = await incrementAndCheckRateLimit(
      mockClient,
      TABLE_NAME,
      config
    );

    expect(result.allowed).toBe(true);
    expect(result.current).toBe(10);
  });

  it("returns allowed=false when over the limit", async () => {
    mockSend.mockResolvedValueOnce({
      Attributes: { count: 11 },
    });

    const result = await incrementAndCheckRateLimit(
      mockClient,
      TABLE_NAME,
      config
    );

    expect(result.allowed).toBe(false);
    expect(result.current).toBe(11);
    expect(result.limit).toBe(10);
    expect(result.retryAfterSeconds).toBeDefined();
    expect(result.retryAfterSeconds).toBeGreaterThan(0);
    expect(result.retryAfterSeconds).toBeLessThanOrEqual(3600);
  });

  it("sends correct DynamoDB UpdateCommand", async () => {
    mockSend.mockResolvedValueOnce({
      Attributes: { count: 1 },
    });

    await incrementAndCheckRateLimit(mockClient, TABLE_NAME, config);

    expect(mockSend).toHaveBeenCalledOnce();
    const command = mockSend.mock.calls[0][0];
    expect(command.input.TableName).toBe(TABLE_NAME);
    expect(command.input.Key.PK).toBe("RATELIMIT#apikey-create#user_123");
    expect(command.input.Key.SK).toBeDefined();
    expect(command.input.UpdateExpression).toContain("ADD #count :inc");
    expect(command.input.ExpressionAttributeValues[":inc"]).toBe(1);
    expect(command.input.ExpressionAttributeValues[":ttl"]).toBeDefined();
    expect(command.input.ReturnValues).toBe("ALL_NEW");
  });

  it("fails open on DynamoDB errors (does not block requests)", async () => {
    mockSend.mockRejectedValueOnce(new Error("DynamoDB throttled"));

    const result = await incrementAndCheckRateLimit(
      mockClient,
      TABLE_NAME,
      config
    );

    expect(result.allowed).toBe(true);
    expect(result.current).toBe(0);
  });

  it("uses correct PK format for IP-based rate limiting", async () => {
    mockSend.mockResolvedValueOnce({
      Attributes: { count: 1 },
    });

    const ipConfig: RateLimitConfig = {
      operation: "invite-validate",
      identifier: "192.168.1.1",
      limit: 5,
      windowSeconds: 3600,
    };

    await incrementAndCheckRateLimit(mockClient, TABLE_NAME, ipConfig);

    const command = mockSend.mock.calls[0][0];
    expect(command.input.Key.PK).toBe("RATELIMIT#invite-validate#192.168.1.1");
  });
});

describe("enforceRateLimit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const config: RateLimitConfig = {
    operation: "apikey-create",
    identifier: "user_123",
    limit: 10,
    windowSeconds: 3600,
  };

  it("does not throw when under the limit", async () => {
    mockSend.mockResolvedValueOnce({
      Attributes: { count: 5 },
    });

    await expect(
      enforceRateLimit(mockClient, TABLE_NAME, config)
    ).resolves.toBeUndefined();
  });

  it("throws RATE_LIMITED when over the limit (AC3)", async () => {
    expect.assertions(5);

    mockSend.mockResolvedValueOnce({
      Attributes: { count: 11 },
    });

    await expect(
      enforceRateLimit(mockClient, TABLE_NAME, config)
    ).rejects.toThrow("Rate limit exceeded");

    try {
      mockSend.mockResolvedValueOnce({ Attributes: { count: 12 } });
      await enforceRateLimit(mockClient, TABLE_NAME, config);
    } catch (error) {
      const { AppError, ErrorCode } = await import("@ai-learning-hub/types");
      expect(error).toBeInstanceOf(AppError);
      expect((error as InstanceType<typeof AppError>).code).toBe(
        ErrorCode.RATE_LIMITED
      );
      expect((error as InstanceType<typeof AppError>).statusCode).toBe(429);
      expect((error as InstanceType<typeof AppError>).details).toHaveProperty(
        "retryAfter"
      );
    }
  });

  it("includes retryAfter in error details (AC3)", async () => {
    expect.assertions(4);

    mockSend.mockResolvedValueOnce({
      Attributes: { count: 11 },
    });

    try {
      await enforceRateLimit(mockClient, TABLE_NAME, config);
    } catch (error) {
      const err = error as { details?: Record<string, unknown> };
      expect(err.details?.retryAfter).toBeDefined();
      expect(typeof err.details?.retryAfter).toBe("number");
      expect(err.details?.limit).toBe(10);
      expect(err.details?.current).toBe(11);
    }
  });
});
