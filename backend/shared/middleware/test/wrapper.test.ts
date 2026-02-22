import { describe, it, expect, vi, beforeEach } from "vitest";
import { wrapHandler, type HandlerContext } from "../src/wrapper.js";
import { AppError, ErrorCode } from "@ai-learning-hub/types";
import type { AuthContext } from "@ai-learning-hub/types";
import type { APIGatewayProxyEvent, Context } from "aws-lambda";

// Helper to create mock API Gateway event
function createMockEvent(
  overrides: Partial<APIGatewayProxyEvent> = {}
): APIGatewayProxyEvent {
  return {
    body: null,
    headers: {},
    multiValueHeaders: {},
    httpMethod: "GET",
    isBase64Encoded: false,
    path: "/test",
    pathParameters: null,
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    stageVariables: null,
    requestContext: {
      accountId: "123456789",
      apiId: "api-id",
      authorizer: null,
      protocol: "HTTP/1.1",
      httpMethod: "GET",
      identity: {
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
        sourceIp: "127.0.0.1",
        user: null,
        userAgent: "test",
        userArn: null,
      },
      path: "/test",
      stage: "test",
      requestId: "test-request-id",
      requestTimeEpoch: Date.now(),
      resourceId: "resource-id",
      resourcePath: "/test",
    },
    resource: "/test",
    ...overrides,
  } as APIGatewayProxyEvent;
}

const mockContext = {
  callbackWaitsForEmptyEventLoop: false,
  functionName: "test-function",
  functionVersion: "1",
  invokedFunctionArn: "arn:aws:lambda:us-east-1:123456789:function:test",
  memoryLimitInMB: "128",
  awsRequestId: "test-request-id",
  logGroupName: "/aws/lambda/test",
  logStreamName: "test-stream",
  getRemainingTimeInMillis: () => 5000,
  done: vi.fn(),
  fail: vi.fn(),
  succeed: vi.fn(),
} as unknown as Context;

describe("Handler Wrapper", () => {
  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  describe("wrapHandler", () => {
    it("should wrap handler and return success response", async () => {
      const handler = wrapHandler(async (_ctx: HandlerContext) => {
        return { message: "Hello World" };
      });

      const event = createMockEvent();
      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.data.message).toBe("Hello World");
    });

    it("should pass through API Gateway response shape", async () => {
      const handler = wrapHandler(async (_ctx: HandlerContext) => {
        return {
          statusCode: 201,
          headers: { "X-Custom": "header" },
          body: JSON.stringify({ custom: true }),
        };
      });

      const event = createMockEvent();
      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(201);
      expect(result.headers?.["X-Custom"]).toBe("header");
    });

    it("should provide request context in handler", async () => {
      let capturedCtx: HandlerContext | null = null;

      const handler = wrapHandler(async (ctx: HandlerContext) => {
        capturedCtx = ctx;
        return { ok: true };
      });

      const event = createMockEvent();
      await handler(event, mockContext);

      expect(capturedCtx).not.toBeNull();
      expect(capturedCtx!.requestId).toBeDefined();
      expect(capturedCtx!.logger).toBeDefined();
      expect(capturedCtx!.startTime).toBeDefined();
    });

    it("should extract auth context when available", async () => {
      let capturedAuth: AuthContext | null = null;

      const handler = wrapHandler(async (ctx: HandlerContext) => {
        capturedAuth = ctx.auth;
        return { ok: true };
      });

      const event = createMockEvent({
        requestContext: {
          ...createMockEvent().requestContext,
          authorizer: {
            userId: "user_123",
            roles: ["user"],
          },
        },
      });

      await handler(event, mockContext);

      expect(capturedAuth).not.toBeNull();
      expect(capturedAuth!.userId).toBe("user_123");
    });

    it("should handle errors and return error response", async () => {
      const handler = wrapHandler(async () => {
        throw new AppError(ErrorCode.NOT_FOUND, "Resource not found");
      });

      const event = createMockEvent();
      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(404);
      const body = JSON.parse(result.body);
      expect(body.error.code).toBe("NOT_FOUND");
    });

    it("should handle unexpected errors", async () => {
      const handler = wrapHandler(async () => {
        throw new Error("Unexpected failure");
      });

      const event = createMockEvent();
      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(500);
      const body = JSON.parse(result.body);
      expect(body.error.code).toBe("INTERNAL_ERROR");
    });

    it("should require auth when option is set", async () => {
      const handler = wrapHandler(async () => ({ ok: true }), {
        requireAuth: true,
      });

      const event = createMockEvent();
      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(401);
    });

    it("should pass auth check when authorized", async () => {
      const handler = wrapHandler(async () => ({ ok: true }), {
        requireAuth: true,
      });

      const event = createMockEvent({
        requestContext: {
          ...createMockEvent().requestContext,
          authorizer: {
            userId: "user_123",
            roles: ["user"],
          },
        },
      });

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(200);
    });

    it("should check required roles", async () => {
      const handler = wrapHandler(async () => ({ ok: true }), {
        requireAuth: true,
        requiredRoles: ["admin"],
      });

      const event = createMockEvent({
        requestContext: {
          ...createMockEvent().requestContext,
          authorizer: {
            userId: "user_123",
            roles: ["user"],
          },
        },
      });

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(403);
    });

    it("should pass role check when user has role", async () => {
      const handler = wrapHandler(async () => ({ ok: true }), {
        requireAuth: true,
        requiredRoles: ["admin"],
      });

      const event = createMockEvent({
        requestContext: {
          ...createMockEvent().requestContext,
          authorizer: {
            userId: "user_123",
            roles: ["user", "admin"],
          },
        },
      });

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(200);
    });

    it("should check API key scopes and return SCOPE_INSUFFICIENT", async () => {
      const handler = wrapHandler(async () => ({ ok: true }), {
        requireAuth: true,
        requiredScope: "saves:write",
      });

      const event = createMockEvent({
        requestContext: {
          ...createMockEvent().requestContext,
          authorizer: {
            userId: "user_123",
            roles: ["user"],
            isApiKey: true,
            scopes: ["saves:read"],
          },
        },
      });

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(403);
      const body = JSON.parse(result.body);
      expect(body.error.code).toBe("SCOPE_INSUFFICIENT");
      expect(body.error.details).toEqual({
        requiredScope: "saves:write",
        keyScopes: ["saves:read"],
      });
    });

    it("should include request ID in response headers", async () => {
      const handler = wrapHandler(async () => ({ ok: true }));

      const event = createMockEvent();
      const result = await handler(event, mockContext);

      expect(result.headers?.["X-Request-Id"]).toBeDefined();
    });

    it("should use request ID from event", async () => {
      const handler = wrapHandler(async () => ({ ok: true }));

      const event = createMockEvent({
        headers: { "x-request-id": "custom-request-id" },
      });
      const result = await handler(event, mockContext);

      expect(result.headers?.["X-Request-Id"]).toBe("custom-request-id");
    });

    describe("ADR-008 pass-through normalization (D9, AC9)", () => {
      it("normalizes non-2xx pass-through with non-JSON body", async () => {
        const handler = wrapHandler(async () => ({
          statusCode: 400,
          headers: {},
          body: "bad request",
        }));

        const event = createMockEvent();
        const result = await handler(event, mockContext);

        expect(result.statusCode).toBe(400);
        const body = JSON.parse(result.body);
        expect(body.error.code).toBe("INTERNAL_ERROR");
        expect(body.error.message).toBe("Unknown error");
        expect(body.error.requestId).toBeDefined();
      });

      it("normalizes non-2xx pass-through with non-ADR-008 JSON body", async () => {
        const handler = wrapHandler(async () => ({
          statusCode: 422,
          headers: {},
          body: JSON.stringify({ message: "Validation failed" }),
        }));

        const event = createMockEvent();
        const result = await handler(event, mockContext);

        expect(result.statusCode).toBe(422);
        const body = JSON.parse(result.body);
        expect(body.error.code).toBe("INTERNAL_ERROR");
        expect(body.error.message).toBe("Validation failed");
        expect(body.error.requestId).toBeDefined();
      });

      it("passes through non-2xx response with valid ADR-008 body", async () => {
        const adr008Body = {
          error: {
            code: "NOT_FOUND",
            message: "Resource not found",
            requestId: "test-id",
          },
        };
        const handler = wrapHandler(async () => ({
          statusCode: 404,
          headers: {},
          body: JSON.stringify(adr008Body),
        }));

        const event = createMockEvent();
        const result = await handler(event, mockContext);

        expect(result.statusCode).toBe(404);
        const body = JSON.parse(result.body);
        expect(body.error.code).toBe("NOT_FOUND");
        expect(body.error.message).toBe("Resource not found");
      });

      it("does not normalize 2xx pass-through responses", async () => {
        const customBody = JSON.stringify({ custom: true });
        const handler = wrapHandler(async () => ({
          statusCode: 200,
          headers: { "X-Custom": "header" },
          body: customBody,
        }));

        const event = createMockEvent();
        const result = await handler(event, mockContext);

        expect(result.statusCode).toBe(200);
        expect(result.body).toBe(customBody);
      });
    });
  });
});
