/**
 * Integration tests for wrapHandler with agent identity + rate limit (Story 3.2.4, AC20)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { APIGatewayProxyEvent, Context } from "aws-lambda";
import { wrapHandler } from "../src/wrapper.js";
import type { HandlerContext, WrapperOptions } from "../src/wrapper.js";

// Mock dependencies
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

vi.mock("@ai-learning-hub/db", () => ({
  incrementAndCheckRateLimit: vi.fn(),
  getDefaultClient: vi.fn().mockReturnValue({}),
  requireEnv: vi.fn().mockReturnValue("ai-learning-hub-users"),
}));

vi.mock("../src/auth.js", () => ({
  extractAuthContext: vi.fn().mockReturnValue({
    userId: "user-123",
    roles: ["user"],
    isApiKey: false,
  }),
  requireAuth: vi.fn().mockReturnValue({
    userId: "user-123",
    roles: ["user"],
    isApiKey: false,
  }),
}));

vi.mock("../src/idempotency.js", () => ({
  extractIdempotencyKey: vi.fn(),
  checkIdempotency: vi.fn().mockResolvedValue(null),
  storeIdempotencyResult: vi.fn(),
}));

vi.mock("../src/concurrency.js", () => ({
  extractIfMatch: vi.fn(),
}));

const { incrementAndCheckRateLimit } = await import("@ai-learning-hub/db");

function makeEvent(headers: Record<string, string> = {}): APIGatewayProxyEvent {
  return {
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    httpMethod: "GET",
    path: "/test",
    body: null,
    isBase64Encoded: false,
    multiValueHeaders: {},
    pathParameters: null,
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    stageVariables: null,
    resource: "/test",
    requestContext: {
      accountId: "123",
      apiId: "api",
      authorizer: {
        userId: "user-123",
        role: "user",
        authMethod: "jwt",
      },
      protocol: "HTTP/1.1",
      httpMethod: "GET",
      identity: {
        sourceIp: "192.168.1.1",
        accessKey: null,
        accountId: null,
        apiKey: null,
        apiKeyId: null,
        caller: null,
        clientCert: null,
        cognitoAuthenticationProvider: null,
        cognitoAuthenticationType: null,
        cognitoIdentityId: null,
        cognitoIdentityPoolId: null,
        principalOrgId: null,
        user: null,
        userAgent: null,
        userArn: null,
      },
      path: "/test",
      stage: "dev",
      requestId: "req-123",
      requestTimeEpoch: Date.now(),
      resourceId: "res",
      resourcePath: "/test",
    },
  };
}

const mockContext = {} as Context;

describe("wrapHandler integration: agent identity", () => {
  it("passes agentId and actorType to handler when X-Agent-ID present", async () => {
    let capturedCtx: HandlerContext | null = null;
    const handler = wrapHandler(
      async (ctx: HandlerContext) => {
        capturedCtx = ctx;
        return { message: "ok" };
      },
      { requireAuth: true }
    );

    const event = makeEvent({ "x-agent-id": "claude-v1" });
    await handler(event, mockContext);

    expect(capturedCtx!.agentId).toBe("claude-v1");
    expect(capturedCtx!.actorType).toBe("agent");
  });

  it("sets actorType=human when no X-Agent-ID header", async () => {
    let capturedCtx: HandlerContext | null = null;
    const handler = wrapHandler(
      async (ctx: HandlerContext) => {
        capturedCtx = ctx;
        return { message: "ok" };
      },
      { requireAuth: true }
    );

    const event = makeEvent();
    await handler(event, mockContext);

    expect(capturedCtx!.agentId).toBeNull();
    expect(capturedCtx!.actorType).toBe("human");
  });

  it("echoes X-Agent-ID in success response", async () => {
    const handler = wrapHandler(async () => ({ message: "ok" }), {
      requireAuth: true,
    });

    const event = makeEvent({ "x-agent-id": "my-agent" });
    const response = await handler(event, mockContext);

    expect(response.headers?.["X-Agent-ID"]).toBe("my-agent");
  });

  it("does not echo X-Agent-ID when header absent", async () => {
    const handler = wrapHandler(async () => ({ message: "ok" }), {
      requireAuth: true,
    });

    const event = makeEvent();
    const response = await handler(event, mockContext);

    expect(response.headers?.["X-Agent-ID"]).toBeUndefined();
  });

  it("echoes X-Agent-ID in error response", async () => {
    const handler = wrapHandler(
      async () => {
        throw new Error("test error");
      },
      { requireAuth: true }
    );

    const event = makeEvent({ "x-agent-id": "error-agent" });
    const response = await handler(event, mockContext);

    expect(response.statusCode).toBe(500);
    expect(response.headers?.["X-Agent-ID"]).toBe("error-agent");
  });
});

describe("wrapHandler integration: rate limit", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-26T12:30:00Z"));
    vi.mocked(incrementAndCheckRateLimit).mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const rateLimitOptions: WrapperOptions = {
    requireAuth: true,
    rateLimit: {
      operation: "test-write",
      windowSeconds: 3600,
      limit: 200,
    },
  };

  it("adds rate limit headers to success response", async () => {
    vi.mocked(incrementAndCheckRateLimit).mockResolvedValue({
      allowed: true,
      current: 5,
      limit: 200,
    });

    const handler = wrapHandler(
      async () => ({ message: "ok" }),
      rateLimitOptions
    );
    const response = await handler(makeEvent(), mockContext);

    expect(response.statusCode).toBe(200);
    expect(response.headers?.["X-RateLimit-Limit"]).toBe("200");
    expect(response.headers?.["X-RateLimit-Remaining"]).toBe("195");
    expect(response.headers?.["X-RateLimit-Reset"]).toBeDefined();
  });

  it("returns 429 with rate limit headers when exceeded", async () => {
    vi.mocked(incrementAndCheckRateLimit).mockResolvedValue({
      allowed: false,
      current: 201,
      limit: 200,
      retryAfterSeconds: 1800,
    });

    const handler = wrapHandler(
      async () => ({ message: "ok" }),
      rateLimitOptions
    );
    const response = await handler(makeEvent(), mockContext);

    expect(response.statusCode).toBe(429);
    expect(response.headers?.["X-RateLimit-Limit"]).toBe("200");
    expect(response.headers?.["X-RateLimit-Remaining"]).toBe("0");
    expect(response.headers?.["Retry-After"]).toBe("1800");
  });

  it("stores rateLimitResult in handler context", async () => {
    vi.mocked(incrementAndCheckRateLimit).mockResolvedValue({
      allowed: true,
      current: 10,
      limit: 200,
    });

    let capturedCtx: HandlerContext | null = null;
    const handler = wrapHandler(async (ctx: HandlerContext) => {
      capturedCtx = ctx;
      return { message: "ok" };
    }, rateLimitOptions);

    await handler(makeEvent(), mockContext);

    expect(capturedCtx!.rateLimitResult).toEqual({
      allowed: true,
      current: 10,
      limit: 200,
    });
  });

  it("does not add rate limit headers when rateLimit not configured", async () => {
    const handler = wrapHandler(async () => ({ message: "ok" }), {
      requireAuth: true,
    });
    const response = await handler(makeEvent(), mockContext);

    expect(response.headers?.["X-RateLimit-Limit"]).toBeUndefined();
    expect(response.headers?.["X-RateLimit-Remaining"]).toBeUndefined();
  });

  it("accepts dynamic limit function", async () => {
    vi.mocked(incrementAndCheckRateLimit).mockResolvedValue({
      allowed: true,
      current: 1,
      limit: 500,
    });

    const handler = wrapHandler(async () => ({ message: "ok" }), {
      requireAuth: true,
      rateLimit: {
        operation: "test-dynamic",
        windowSeconds: 3600,
        limit: (auth) => (auth ? 500 : 100),
      },
    });
    const response = await handler(makeEvent(), mockContext);

    expect(response.headers?.["X-RateLimit-Limit"]).toBe("500");
    expect(vi.mocked(incrementAndCheckRateLimit)).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ limit: 500 }),
      expect.anything()
    );
  });

  it("fail-open when dynamic limit function throws", async () => {
    const handler = wrapHandler(async () => ({ message: "ok" }), {
      requireAuth: true,
      rateLimit: {
        operation: "test-throw",
        windowSeconds: 3600,
        limit: () => {
          throw new Error("scope lookup failed");
        },
      },
    });
    const response = await handler(makeEvent(), mockContext);

    // Should proceed without rate limit headers (fail-open)
    expect(response.statusCode).toBe(200);
    expect(response.headers?.["X-RateLimit-Limit"]).toBeUndefined();
  });

  it("fail-open when rate limit DB unreachable", async () => {
    vi.mocked(incrementAndCheckRateLimit).mockRejectedValue(
      new Error("DynamoDB unreachable")
    );

    const handler = wrapHandler(
      async () => ({ message: "ok" }),
      rateLimitOptions
    );
    const response = await handler(makeEvent(), mockContext);

    // Should proceed without rate limit headers (fail-open)
    expect(response.statusCode).toBe(200);
    expect(response.headers?.["X-RateLimit-Limit"]).toBeUndefined();
  });

  it("uses sourceIp when identifierSource is sourceIp", async () => {
    vi.mocked(incrementAndCheckRateLimit).mockResolvedValue({
      allowed: true,
      current: 1,
      limit: 100,
    });

    const handler = wrapHandler(async () => ({ message: "ok" }), {
      requireAuth: true,
      rateLimit: {
        operation: "test-ip",
        windowSeconds: 3600,
        limit: 100,
        identifierSource: "sourceIp",
      },
    });
    await handler(makeEvent(), mockContext);

    expect(vi.mocked(incrementAndCheckRateLimit)).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ identifier: "192.168.1.1" }),
      expect.anything()
    );
  });

  it("backward compatibility: handlers without new options unaffected", async () => {
    let capturedCtx: HandlerContext | null = null;
    const handler = wrapHandler(
      async (ctx: HandlerContext) => {
        capturedCtx = ctx;
        return { message: "ok" };
      },
      { requireAuth: true }
    );

    const response = await handler(makeEvent(), mockContext);

    expect(response.statusCode).toBe(200);
    expect(capturedCtx!.agentId).toBeNull();
    expect(capturedCtx!.actorType).toBe("human");
    expect(capturedCtx!.rateLimitResult).toBeUndefined();
    // No rate limit headers
    expect(response.headers?.["X-RateLimit-Limit"]).toBeUndefined();
  });
});
