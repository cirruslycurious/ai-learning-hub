/**
 * Unit tests for shared mock wrapper utilities.
 *
 * Verifies mock shape correctness per Story 2.1-D3 AC7.
 */
import { describe, it, expect, vi } from "vitest";
import {
  createMockLogger,
  mockCreateLoggerModule,
  createMockContext,
  createMockEvent,
  mockMiddlewareModule,
} from "./mock-wrapper.js";

describe("createMockLogger", () => {
  it("returns object with all Logger methods", () => {
    const logger = createMockLogger();

    expect(logger.info).toEqual(expect.any(Function));
    expect(logger.warn).toEqual(expect.any(Function));
    expect(logger.error).toEqual(expect.any(Function));
    expect(logger.debug).toEqual(expect.any(Function));
    expect(logger.timed).toEqual(expect.any(Function));
    expect(logger.child).toEqual(expect.any(Function));
    expect(logger.setRequestContext).toEqual(expect.any(Function));
  });

  it("child() returns the logger (for chaining)", () => {
    const logger = createMockLogger();
    expect(logger.child()).toBe(logger);
  });
});

describe("mockCreateLoggerModule", () => {
  it("returns module with createLogger factory", () => {
    const mod = mockCreateLoggerModule();
    expect(mod.createLogger).toEqual(expect.any(Function));

    const logger = mod.createLogger();
    expect(logger.info).toEqual(expect.any(Function));
  });
});

describe("createMockContext", () => {
  it("returns a Context-typed object", () => {
    const ctx = createMockContext();
    expect(ctx).toBeDefined();
  });
});

describe("createMockEvent", () => {
  it("creates event with defaults", () => {
    const event = createMockEvent();

    expect(event.httpMethod).toBe("GET");
    expect(event.path).toBe("/test");
    expect(event.body).toBeNull();
    expect(event.headers).toEqual({ "Content-Type": "application/json" });
    expect(event.requestContext.stage).toBe("dev");
    expect(event.requestContext.requestId).toBe("test-request-id");
    expect(event.requestContext.authorizer).toBeUndefined();
  });

  it("creates event with JWT auth context (AC3)", () => {
    const event = createMockEvent({
      userId: "user_123",
      role: "user",
      authMethod: "jwt",
    });

    expect(event.requestContext.authorizer).toEqual({
      userId: "user_123",
      role: "user",
      authMethod: "jwt",
    });
  });

  it("creates event with API key auth context and scopes (AC4)", () => {
    const event = createMockEvent({
      userId: "user_123",
      role: "user",
      authMethod: "api-key",
      scopes: ["saves:write"],
    });

    expect(event.requestContext.authorizer).toEqual({
      userId: "user_123",
      role: "user",
      authMethod: "api-key",
      scopes: ["saves:write"],
    });
  });

  it("creates event with custom method, path, and body (AC5)", () => {
    const event = createMockEvent({
      method: "POST",
      path: "/users/api-keys",
      body: { name: "Test Key", scopes: ["*"] },
    });

    expect(event.httpMethod).toBe("POST");
    expect(event.path).toBe("/users/api-keys");
    expect(event.resource).toBe("/users/api-keys");
    expect(event.requestContext.path).toBe("/users/api-keys");
    expect(event.requestContext.httpMethod).toBe("POST");
    expect(JSON.parse(event.body!)).toEqual({
      name: "Test Key",
      scopes: ["*"],
    });
  });

  it("creates event with path parameters", () => {
    const event = createMockEvent({
      method: "DELETE",
      path: "/users/api-keys",
      pathParameters: { id: "key_01" },
    });

    expect(event.pathParameters).toEqual({ id: "key_01" });
  });

  it("creates event with query string parameters", () => {
    const event = createMockEvent({
      queryStringParameters: { limit: "10", cursor: "abc" },
    });

    expect(event.queryStringParameters).toEqual({
      limit: "10",
      cursor: "abc",
    });
  });

  it("includes identity with sourceIp", () => {
    const event = createMockEvent();
    expect(event.requestContext.identity.sourceIp).toBe("127.0.0.1");
  });

  it("creates event without auth when userId is not provided", () => {
    const event = createMockEvent({ method: "POST", path: "/test" });
    expect(event.requestContext.authorizer).toBeUndefined();
  });
});

describe("mockMiddlewareModule", () => {
  it("returns module with wrapHandler and helper functions", () => {
    const mod = mockMiddlewareModule();

    expect(mod.wrapHandler).toEqual(expect.any(Function));
    expect(mod.extractAuthContext).toEqual(expect.any(Function));
    expect(mod.requireAuth).toEqual(expect.any(Function));
    expect(mod.createSuccessResponse).toEqual(expect.any(Function));
    expect(mod.createNoContentResponse).toEqual(expect.any(Function));
    expect(mod.handleError).toEqual(expect.any(Function));
  });

  it("createSuccessResponse returns correct shape", () => {
    const mod = mockMiddlewareModule();
    const response = mod.createSuccessResponse({ id: 1 }, "req-123");

    expect(response.statusCode).toBe(200);
    expect(response.headers["Content-Type"]).toBe("application/json");
    expect(response.headers["X-Request-Id"]).toBe("req-123");
    expect(JSON.parse(response.body)).toEqual({ data: { id: 1 } });
  });

  it("createSuccessResponse supports custom status code", () => {
    const mod = mockMiddlewareModule();
    const response = mod.createSuccessResponse({ id: 1 }, "req-123", 201);

    expect(response.statusCode).toBe(201);
  });

  it("createNoContentResponse returns 204 with empty body", () => {
    const mod = mockMiddlewareModule();
    const response = mod.createNoContentResponse("req-123");

    expect(response.statusCode).toBe(204);
    expect(response.headers["X-Request-Id"]).toBe("req-123");
    expect(response.body).toBe("");
  });

  it("includes extra exports when provided", () => {
    const mockFn = vi.fn().mockResolvedValue("test-value");
    const mod = mockMiddlewareModule({
      extraExports: { getClerkSecretKey: mockFn },
    });

    expect((mod as Record<string, unknown>).getClerkSecretKey).toBe(mockFn);
  });

  describe("wrapHandler mock behavior", () => {
    it("returns 401 when requireAuth and no authorizer", async () => {
      const mod = mockMiddlewareModule();
      const innerHandler = vi.fn();
      const wrapped = mod.wrapHandler(innerHandler, { requireAuth: true });

      const event = createMockEvent(); // no userId
      const ctx = createMockContext();
      const result = await wrapped(event, ctx);

      expect(result.statusCode).toBe(401);
      expect(JSON.parse(result.body).error.code).toBe("UNAUTHORIZED");
      expect(innerHandler).not.toHaveBeenCalled();
    });

    it("invokes handler with auth context when authenticated", async () => {
      const mod = mockMiddlewareModule();
      const innerHandler = vi.fn().mockResolvedValue({ id: "result" });
      const wrapped = mod.wrapHandler(innerHandler, { requireAuth: true });

      const event = createMockEvent({ userId: "user_123", role: "admin" });
      const ctx = createMockContext();
      const result = await wrapped(event, ctx);

      expect(result.statusCode).toBe(200);
      expect(innerHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          event,
          context: ctx,
          auth: {
            userId: "user_123",
            roles: ["admin"],
            isApiKey: false,
          },
          requestId: "test-req-id",
          logger: expect.objectContaining({ info: expect.any(Function) }),
        })
      );
    });

    it("passes through API Gateway response objects", async () => {
      const mod = mockMiddlewareModule();
      const apiResponse = { statusCode: 201, body: '{"data":"created"}' };
      const innerHandler = vi.fn().mockResolvedValue(apiResponse);
      const wrapped = mod.wrapHandler(innerHandler, { requireAuth: true });

      const event = createMockEvent({ userId: "user_123" });
      const result = await wrapped(event, createMockContext());

      expect(result.statusCode).toBe(201);
      expect(result.body).toBe('{"data":"created"}');
    });

    it("wraps non-response return values in data envelope", async () => {
      const mod = mockMiddlewareModule();
      const innerHandler = vi.fn().mockResolvedValue({ name: "test" });
      const wrapped = mod.wrapHandler(innerHandler, {});

      const event = createMockEvent({ userId: "user_123" });
      const result = await wrapped(event, createMockContext());

      expect(result.statusCode).toBe(200);
      expect(JSON.parse(result.body)).toEqual({ data: { name: "test" } });
    });

    it("catches handler errors and returns error response", async () => {
      const mod = mockMiddlewareModule();
      const innerHandler = vi.fn().mockRejectedValue(
        Object.assign(new Error("Not found"), {
          code: "NOT_FOUND",
          statusCode: 404,
        })
      );
      const wrapped = mod.wrapHandler(innerHandler, {});

      const event = createMockEvent({ userId: "user_123" });
      const result = await wrapped(event, createMockContext());

      expect(result.statusCode).toBe(404);
      const body = JSON.parse(result.body);
      expect(body.error.code).toBe("NOT_FOUND");
      expect(body.error.message).toBe("Not found");
      expect(body.error.requestId).toBe("test-req-id");
    });

    it("defaults to 500 INTERNAL_ERROR for unexpected errors", async () => {
      const mod = mockMiddlewareModule();
      const innerHandler = vi.fn().mockRejectedValue(new Error("unexpected"));
      const wrapped = mod.wrapHandler(innerHandler, {});

      const event = createMockEvent({ userId: "user_123" });
      const result = await wrapped(event, createMockContext());

      expect(result.statusCode).toBe(500);
      const body = JSON.parse(result.body);
      expect(body.error.code).toBe("INTERNAL_ERROR");
    });

    it("sets isApiKey true when authMethod is api-key", async () => {
      const mod = mockMiddlewareModule();
      const innerHandler = vi.fn().mockResolvedValue({ ok: true });
      const wrapped = mod.wrapHandler(innerHandler, { requireAuth: true });

      const event = createMockEvent({
        userId: "user_123",
        authMethod: "api-key",
      });
      const result = await wrapped(event, createMockContext());

      expect(result.statusCode).toBe(200);
      expect(innerHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          auth: expect.objectContaining({ isApiKey: true }),
        })
      );
    });

    it("passes scopes through to inner handler auth object", async () => {
      const mod = mockMiddlewareModule();
      const innerHandler = vi.fn().mockResolvedValue({ ok: true });
      const wrapped = mod.wrapHandler(innerHandler, { requireAuth: true });

      const event = createMockEvent({
        userId: "user_123",
        authMethod: "api-key",
        scopes: ["saves:write"],
      });
      const result = await wrapped(event, createMockContext());

      expect(result.statusCode).toBe(200);
      expect(innerHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          auth: expect.objectContaining({
            userId: "user_123",
            isApiKey: true,
            scopes: ["saves:write"],
          }),
        })
      );
    });

    it("parses JSON string scopes from authorizer", async () => {
      const mod = mockMiddlewareModule();
      const innerHandler = vi.fn().mockResolvedValue({ ok: true });
      const wrapped = mod.wrapHandler(innerHandler, {});

      // Simulate API Gateway passing scopes as a JSON string
      const event = createMockEvent({ userId: "user_123" });
      event.requestContext.authorizer = {
        userId: "user_123",
        role: "user",
        authMethod: "api-key",
        scopes: '["saves:write","saves:read"]',
      };
      const result = await wrapped(event, createMockContext());

      expect(result.statusCode).toBe(200);
      expect(innerHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          auth: expect.objectContaining({
            scopes: ["saves:write", "saves:read"],
          }),
        })
      );
    });
  });
});
