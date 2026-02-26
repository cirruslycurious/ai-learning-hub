/**
 * Integration tests: Idempotency + Concurrency with wrapHandler (Story 3.2.1, AC21)
 *
 * Tests that the middleware integrates correctly with the existing handler chain:
 * auth → idempotency check → handler execution → idempotency store → response
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { wrapHandler } from "../src/wrapper.js";
import type { HandlerContext } from "../src/wrapper.js";
import type {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  Context,
} from "aws-lambda";

// Mock the idempotency module's DynamoDB interactions
vi.mock("@ai-learning-hub/db", () => ({
  getIdempotencyRecord: vi.fn().mockResolvedValue(null),
  storeIdempotencyRecord: vi.fn().mockResolvedValue(true),
  buildIdempotencyPK: vi.fn(
    (userId: string, key: string) => `IDEMP#${userId}#${key}`
  ),
  getDefaultClient: vi.fn().mockReturnValue({}),
}));

const mockContext = {
  functionName: "test",
  memoryLimitInMB: "128",
  awsRequestId: "test-request-id",
} as unknown as Context;

function makeEvent(
  overrides: Partial<APIGatewayProxyEvent> = {}
): APIGatewayProxyEvent {
  return {
    httpMethod: "POST",
    path: "/saves",
    headers: {
      Authorization: "Bearer test-jwt-token",
      ...overrides.headers,
    },
    body: null,
    isBase64Encoded: false,
    multiValueHeaders: {},
    multiValueQueryStringParameters: null,
    pathParameters: null,
    queryStringParameters: null,
    requestContext: {
      requestId: "req-integration-test",
      authorizer: {
        principalId: "user_test123",
        userId: "user_test123",
        roles: "user",
        isApiKey: "false",
      },
      ...overrides.requestContext,
    } as APIGatewayProxyEvent["requestContext"],
    resource: "",
    stageVariables: null,
    ...overrides,
  };
}

describe("Integration: wrapHandler + idempotent (AC21)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("should execute handler normally when idempotent is true and key is provided", async () => {
    const handler = vi.fn(async (_ctx: HandlerContext) => ({
      saveId: "save-123",
    }));

    const wrapped = wrapHandler(handler, {
      requireAuth: true,
      idempotent: true,
    });

    const event = makeEvent({
      headers: {
        Authorization: "Bearer test",
        "idempotency-key": "test-key-1",
      },
    });

    const result = await wrapped(event, mockContext);

    expect(result.statusCode).toBe(200);
    expect(handler).toHaveBeenCalledOnce();
    const body = JSON.parse(result.body);
    expect(body.data.saveId).toBe("save-123");
  });

  it("should reject missing Idempotency-Key when idempotent is true", async () => {
    const handler = vi.fn(async () => ({ id: "1" }));

    const wrapped = wrapHandler(handler, {
      requireAuth: true,
      idempotent: true,
    });

    const event = makeEvent(); // No idempotency-key header

    const result = await wrapped(event, mockContext);

    expect(result.statusCode).toBe(400);
    expect(handler).not.toHaveBeenCalled();
    const body = JSON.parse(result.body);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.message).toContain("Idempotency-Key");
  });

  it("should not require Idempotency-Key when idempotent is false/unset", async () => {
    const handler = vi.fn(async () => ({ id: "1" }));

    const wrapped = wrapHandler(handler, {
      requireAuth: true,
      // idempotent not set — backward compatible
    });

    const event = makeEvent(); // No idempotency-key header

    const result = await wrapped(event, mockContext);

    expect(result.statusCode).toBe(200);
    expect(handler).toHaveBeenCalledOnce();
  });
});

describe("Integration: wrapHandler + requireVersion (AC21)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("should attach expectedVersion to context when requireVersion is true", async () => {
    let capturedVersion: number | undefined;
    const handler = vi.fn(async (ctx: HandlerContext) => {
      capturedVersion = ctx.expectedVersion;
      return { updated: true };
    });

    const wrapped = wrapHandler(handler, {
      requireAuth: true,
      requireVersion: true,
    });

    const event = makeEvent({
      headers: {
        Authorization: "Bearer test",
        "if-match": "5",
      },
    });

    const result = await wrapped(event, mockContext);

    expect(result.statusCode).toBe(200);
    expect(capturedVersion).toBe(5);
  });

  it("should reject missing If-Match when requireVersion is true", async () => {
    const handler = vi.fn(async () => ({ id: "1" }));

    const wrapped = wrapHandler(handler, {
      requireAuth: true,
      requireVersion: true,
    });

    const event = makeEvent(); // No if-match header

    const result = await wrapped(event, mockContext);

    expect(result.statusCode).toBe(428);
    expect(handler).not.toHaveBeenCalled();
    const body = JSON.parse(result.body);
    expect(body.error.code).toBe("PRECONDITION_REQUIRED");
  });

  it("should not require If-Match when requireVersion is false/unset", async () => {
    let capturedVersion: number | undefined;
    const handler = vi.fn(async (ctx: HandlerContext) => {
      capturedVersion = ctx.expectedVersion;
      return { id: "1" };
    });

    const wrapped = wrapHandler(handler, {
      requireAuth: true,
      // requireVersion not set — backward compatible
    });

    const event = makeEvent(); // No if-match header

    const result = await wrapped(event, mockContext);

    expect(result.statusCode).toBe(200);
    expect(capturedVersion).toBeUndefined();
  });
});

describe("Integration: combined idempotent + requireVersion (AC21)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("should support both idempotent and requireVersion on same handler", async () => {
    let capturedVersion: number | undefined;
    const handler = vi.fn(async (ctx: HandlerContext) => {
      capturedVersion = ctx.expectedVersion;
      return { updated: true };
    });

    const wrapped = wrapHandler(handler, {
      requireAuth: true,
      idempotent: true,
      requireVersion: true,
    });

    const event = makeEvent({
      headers: {
        Authorization: "Bearer test",
        "idempotency-key": "update-key-1",
        "if-match": "3",
      },
    });

    const result = await wrapped(event, mockContext);

    expect(result.statusCode).toBe(200);
    expect(handler).toHaveBeenCalledOnce();
    expect(capturedVersion).toBe(3);
  });
});

describe("Integration: backward compatibility (AC21)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("should work identically to before for handlers without new options", async () => {
    const handler = vi.fn(async (_ctx: HandlerContext) => ({
      message: "hello",
    }));

    const wrapped = wrapHandler(handler, { requireAuth: true });

    const event = makeEvent();
    const result = await wrapped(event, mockContext);

    expect(result.statusCode).toBe(200);
    expect(handler).toHaveBeenCalledOnce();
    const body = JSON.parse(result.body);
    expect(body.data.message).toBe("hello");
  });

  it("should still handle raw APIGatewayProxyResult returns", async () => {
    const handler = vi.fn(
      async (): Promise<APIGatewayProxyResult> => ({
        statusCode: 201,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: { id: "created" } }),
      })
    );

    const wrapped = wrapHandler(handler, { requireAuth: true });

    const event = makeEvent();
    const result = await wrapped(event, mockContext);

    expect(result.statusCode).toBe(201);
  });

  it("should still handle errors through the error pipeline", async () => {
    const handler = vi.fn(async () => {
      throw new Error("Something went wrong");
    });

    const wrapped = wrapHandler(handler, { requireAuth: true });

    const event = makeEvent();
    const result = await wrapped(event, mockContext);

    expect(result.statusCode).toBe(500);
    const body = JSON.parse(result.body);
    expect(body.error.code).toBe("INTERNAL_ERROR");
  });
});
