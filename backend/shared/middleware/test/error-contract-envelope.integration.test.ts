/**
 * Integration & contract tests for Story 3.2.2
 * Tests the full middleware chain produces correct envelope and error shapes.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { wrapHandler, type HandlerContext } from "../src/wrapper.js";
import { createSuccessResponse } from "../src/error-handler.js";
import { AppError, ErrorCode } from "@ai-learning-hub/types";
import type { APIGatewayProxyEvent, Context } from "aws-lambda";

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

describe("Integration: Error Contract & Response Envelope", () => {
  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  describe("wrapHandler auto-wraps in { data } envelope (AC20)", () => {
    it("wraps plain object return in { data }", async () => {
      const handler = wrapHandler(async () => ({
        saveId: "01HX",
        url: "https://example.com",
      }));

      const result = await handler(createMockEvent(), mockContext);
      const body = JSON.parse(result.body);

      expect(result.statusCode).toBe(200);
      expect(body.data).toEqual({
        saveId: "01HX",
        url: "https://example.com",
      });
      expect(body.meta).toBeUndefined();
      expect(body.links).toBeUndefined();
    });

    it("wraps array return in { data }", async () => {
      const handler = wrapHandler(async () => [{ id: "1" }, { id: "2" }]);

      const result = await handler(createMockEvent(), mockContext);
      const body = JSON.parse(result.body);

      expect(body.data).toHaveLength(2);
    });
  });

  describe("explicit createSuccessResponse with envelope (AC20)", () => {
    it("produces envelope with meta and links", async () => {
      const handler = wrapHandler(async (ctx: HandlerContext) =>
        createSuccessResponse([{ id: "1" }], ctx.requestId, {
          meta: { cursor: "abc", total: 42 },
          links: {
            self: "/saves?limit=25",
            next: "/saves?limit=25&cursor=abc",
          },
        })
      );

      const result = await handler(createMockEvent(), mockContext);
      const body = JSON.parse(result.body);

      expect(result.statusCode).toBe(200);
      expect(body.data).toEqual([{ id: "1" }]);
      expect(body.meta.cursor).toBe("abc");
      expect(body.meta.total).toBe(42);
      expect(body.links.self).toBe("/saves?limit=25");
      expect(body.links.next).toBe("/saves?limit=25&cursor=abc");
    });
  });

  describe("error response includes enhanced fields (AC20)", () => {
    it("thrown AppError with state context includes currentState and allowedActions", async () => {
      const handler = wrapHandler(async () => {
        throw AppError.build(
          ErrorCode.CONFLICT,
          "Cannot complete paused project"
        )
          .withState("paused", ["resume", "delete"])
          .create();
      });

      const result = await handler(createMockEvent(), mockContext);
      const body = JSON.parse(result.body);

      expect(result.statusCode).toBe(409);
      expect(body.error.code).toBe("CONFLICT");
      expect(body.error.currentState).toBe("paused");
      expect(body.error.allowedActions).toEqual(["resume", "delete"]);
      expect(body.error.details).toBeUndefined();
    });

    it("thrown AppError with requiredConditions includes them at top level", async () => {
      const handler = wrapHandler(async () => {
        throw AppError.build(ErrorCode.CONFLICT, "Precondition failed")
          .withConditions(["must resume first"])
          .create();
      });

      const result = await handler(createMockEvent(), mockContext);
      const body = JSON.parse(result.body);

      expect(body.error.requiredConditions).toEqual(["must resume first"]);
    });

    it("INVALID_STATE_TRANSITION error code returns 409", async () => {
      const handler = wrapHandler(async () => {
        throw AppError.build(
          ErrorCode.INVALID_STATE_TRANSITION,
          "Cannot complete a paused project"
        )
          .withState("paused", ["resume", "delete"])
          .withConditions(["Project must be in building state"])
          .create();
      });

      const result = await handler(createMockEvent(), mockContext);
      const body = JSON.parse(result.body);

      expect(result.statusCode).toBe(409);
      expect(body.error.code).toBe("INVALID_STATE_TRANSITION");
      expect(body.error.currentState).toBe("paused");
      expect(body.error.allowedActions).toEqual(["resume", "delete"]);
      expect(body.error.requiredConditions).toEqual([
        "Project must be in building state",
      ]);
    });
  });

  describe("4xx pass-through normalization preserves new fields (AC19)", () => {
    it("preserves currentState, allowedActions, requiredConditions", async () => {
      const errorBody = {
        error: {
          code: "INVALID_STATE_TRANSITION",
          message: "Cannot complete",
          requestId: "test-id",
          currentState: "paused",
          allowedActions: ["resume"],
          requiredConditions: ["must be active"],
        },
      };
      const handler = wrapHandler(async () => ({
        statusCode: 409,
        headers: {},
        body: JSON.stringify(errorBody),
      }));

      const result = await handler(createMockEvent(), mockContext);
      const body = JSON.parse(result.body);

      expect(body.error.currentState).toBe("paused");
      expect(body.error.allowedActions).toEqual(["resume"]);
      expect(body.error.requiredConditions).toEqual(["must be active"]);
    });
  });

  describe("validation error uses fields key (AC20)", () => {
    it("validation error includes fields array with constraints", async () => {
      const { validate, z } = await import("@ai-learning-hub/validation");
      const handler = wrapHandler(async () => {
        const schema = z.object({
          name: z.string().min(3),
          type: z.enum(["article", "video"]),
        });
        return validate(schema, { name: "ab", type: "unknown" });
      });

      const result = await handler(createMockEvent(), mockContext);
      const body = JSON.parse(result.body);

      expect(result.statusCode).toBe(400);
      expect(body.error.code).toBe("VALIDATION_ERROR");
      expect(body.error.details.fields).toBeDefined();
      expect(Array.isArray(body.error.details.fields)).toBe(true);

      const nameField = body.error.details.fields.find(
        (f: { field: string }) => f.field === "name"
      );
      expect(nameField).toBeDefined();
      expect(nameField.constraint).toBe("minimum 3");

      const typeField = body.error.details.fields.find(
        (f: { field: string }) => f.field === "type"
      );
      expect(typeField).toBeDefined();
      expect(typeField.allowed_values).toEqual(["article", "video"]);
    });
  });

  describe("backward compatibility (AC20)", () => {
    it("existing handler return patterns produce { data } envelope unchanged", async () => {
      const handler = wrapHandler(async () => ({
        id: "existing-pattern",
        name: "test",
      }));

      const result = await handler(createMockEvent(), mockContext);
      const body = JSON.parse(result.body);

      expect(result.statusCode).toBe(200);
      expect(body.data).toEqual({ id: "existing-pattern", name: "test" });
    });

    it("existing error without enhanced fields produces standard shape", async () => {
      const handler = wrapHandler(async () => {
        throw new AppError(ErrorCode.NOT_FOUND, "Resource not found");
      });

      const result = await handler(createMockEvent(), mockContext);
      const body = JSON.parse(result.body);

      expect(result.statusCode).toBe(404);
      expect(body.error.code).toBe("NOT_FOUND");
      expect(body.error.message).toBe("Resource not found");
      expect(body.error.currentState).toBeUndefined();
      expect(body.error.allowedActions).toBeUndefined();
      expect(body.error.requiredConditions).toBeUndefined();
    });

    it("createSuccessResponse with no options produces { data } only", async () => {
      const response = createSuccessResponse({ id: "test" }, "req-123");
      const body = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(body.data).toEqual({ id: "test" });
      expect(body.meta).toBeUndefined();
      expect(body.links).toBeUndefined();
    });
  });
});
