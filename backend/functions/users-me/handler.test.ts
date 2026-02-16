/**
 * User Profile Endpoint handler tests
 *
 * Tests the GET/PATCH /users/me endpoints per Story 2.5.
 * Covers all acceptance criteria: AC1-AC3.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { APIGatewayProxyEvent, Context } from "aws-lambda";
import { AppError, ErrorCode } from "@ai-learning-hub/types";

// Mock @ai-learning-hub/db
const mockGetProfile = vi.fn();
const mockUpdateProfile = vi.fn();
const mockGetDefaultClient = vi.fn(() => ({}));

vi.mock("@ai-learning-hub/db", () => ({
  getDefaultClient: () => mockGetDefaultClient(),
  getProfile: (...args: unknown[]) => mockGetProfile(...args),
  updateProfile: (...args: unknown[]) => mockUpdateProfile(...args),
}));

// Mock @ai-learning-hub/logging
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

// Mock @ai-learning-hub/middleware
vi.mock("@ai-learning-hub/middleware", () => ({
  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
  wrapHandler: (handler: Function, options: Record<string, unknown>) => {
    return async (event: APIGatewayProxyEvent, context: Context) => {
      // Simulate auth requirement
      if (options.requireAuth) {
        const authorizer = event.requestContext?.authorizer;
        if (!authorizer?.userId) {
          return {
            statusCode: 401,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              error: {
                code: "UNAUTHORIZED",
                message: "Authentication required",
                requestId: "test-req-id",
              },
            }),
          };
        }
      }

      const auth = event.requestContext?.authorizer
        ? {
            userId: event.requestContext.authorizer.userId as string,
            roles: [(event.requestContext.authorizer.role as string) || "user"],
            isApiKey: event.requestContext.authorizer.authMethod === "api-key",
          }
        : null;

      try {
        const result = await handler({
          event,
          context,
          auth,
          requestId: "test-req-id",
          logger: {
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
            debug: vi.fn(),
            timed: vi.fn(),
            child: vi.fn().mockReturnThis(),
            setRequestContext: vi.fn(),
          },
          startTime: Date.now(),
        });

        // If result is already an API Gateway response, return as-is
        if (
          typeof result === "object" &&
          result !== null &&
          "statusCode" in result
        ) {
          return result;
        }

        // Auto-wrap success
        return {
          statusCode: 200,
          headers: {
            "Content-Type": "application/json",
            "X-Request-Id": "test-req-id",
          },
          body: JSON.stringify({ data: result }),
        };
      } catch (error: unknown) {
        const err = error as {
          code?: string;
          statusCode?: number;
          message?: string;
        };
        const code = err.code ?? "INTERNAL_ERROR";
        const statusCode = err.statusCode ?? 500;
        const message = err.message ?? "An unexpected error occurred";
        return {
          statusCode,
          headers: {
            "Content-Type": "application/json",
            "X-Request-Id": "test-req-id",
          },
          body: JSON.stringify({
            error: { code, message, requestId: "test-req-id" },
          }),
        };
      }
    };
  },
  extractAuthContext: vi.fn(),
  requireAuth: vi.fn(),
  createSuccessResponse: (data: unknown, requestId: string) => ({
    statusCode: 200,
    headers: {
      "Content-Type": "application/json",
      "X-Request-Id": requestId,
    },
    body: JSON.stringify({ data }),
  }),
  handleError: vi.fn(),
}));

// Note: @ai-learning-hub/validation is NOT mocked — uses real implementation
// (validates request bodies with Zod schemas and throws AppError on failure)

import { handler } from "./handler.js";

function createEvent(
  method: "GET" | "PATCH",
  body?: Record<string, unknown>,
  userId?: string
): APIGatewayProxyEvent {
  return {
    httpMethod: method,
    path: "/users/me",
    body: body ? JSON.stringify(body) : null,
    headers: { "Content-Type": "application/json" },
    multiValueHeaders: {},
    isBase64Encoded: false,
    pathParameters: null,
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    stageVariables: null,
    resource: "/users/me",
    requestContext: {
      accountId: "123456789",
      apiId: "api-id",
      authorizer: userId
        ? { userId, role: "user", authMethod: "jwt" }
        : undefined,
      protocol: "HTTP/1.1",
      httpMethod: method,
      identity: {
        sourceIp: "127.0.0.1",
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
      path: "/users/me",
      stage: "dev",
      requestId: "test-request-id",
      requestTimeEpoch: Date.now(),
      resourceId: "resource-id",
      resourcePath: "/users/me",
    },
  };
}

const mockContext = {} as Context;

const sampleProfile = {
  PK: "USER#user_123",
  SK: "PROFILE",
  userId: "user_123",
  email: "test@example.com",
  displayName: "Test User",
  role: "user",
  globalPreferences: { theme: "dark" },
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};

describe("Users Me Handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("AC1: GET /users/me — returns profile", () => {
    it("returns profile for authenticated user", async () => {
      mockGetProfile.mockResolvedValueOnce(sampleProfile);

      const event = createEvent("GET", undefined, "user_123");
      const result = await handler(event, mockContext);
      const body = JSON.parse(result.body);

      expect(result.statusCode).toBe(200);
      expect(body.data.userId).toBe("user_123");
      expect(body.data.email).toBe("test@example.com");
      expect(body.data.displayName).toBe("Test User");
      expect(body.data.role).toBe("user");
      expect(body.data.globalPreferences).toEqual({ theme: "dark" });
      expect(body.data.createdAt).toBe("2026-01-01T00:00:00Z");
      expect(body.data.updatedAt).toBe("2026-01-01T00:00:00Z");
    });

    it("does not expose PK/SK in response", async () => {
      mockGetProfile.mockResolvedValueOnce(sampleProfile);

      const event = createEvent("GET", undefined, "user_123");
      const result = await handler(event, mockContext);
      const body = JSON.parse(result.body);

      expect(body.data.PK).toBeUndefined();
      expect(body.data.SK).toBeUndefined();
    });

    it("returns empty globalPreferences if not set", async () => {
      mockGetProfile.mockResolvedValueOnce({
        ...sampleProfile,
        globalPreferences: undefined,
      });

      const event = createEvent("GET", undefined, "user_123");
      const result = await handler(event, mockContext);
      const body = JSON.parse(result.body);

      expect(result.statusCode).toBe(200);
      expect(body.data.globalPreferences).toEqual({});
    });

    it("returns 404 when profile does not exist", async () => {
      mockGetProfile.mockResolvedValueOnce(null);

      const event = createEvent("GET", undefined, "user_123");
      const result = await handler(event, mockContext);
      const body = JSON.parse(result.body);

      expect(result.statusCode).toBe(404);
      expect(body.error.code).toBe("NOT_FOUND");
    });

    it("calls getProfile with correct userId", async () => {
      mockGetProfile.mockResolvedValueOnce(sampleProfile);

      const event = createEvent("GET", undefined, "user_abc");
      await handler(event, mockContext);

      expect(mockGetProfile).toHaveBeenCalledWith(
        expect.anything(),
        "user_abc"
      );
    });
  });

  describe("AC2: PATCH /users/me — updates profile", () => {
    it("updates displayName", async () => {
      const updated = {
        ...sampleProfile,
        displayName: "New Name",
        updatedAt: "2026-02-15T00:00:00Z",
      };
      mockUpdateProfile.mockResolvedValueOnce(updated);

      const event = createEvent(
        "PATCH",
        { displayName: "New Name" },
        "user_123"
      );
      const result = await handler(event, mockContext);
      const body = JSON.parse(result.body);

      expect(result.statusCode).toBe(200);
      expect(body.data.displayName).toBe("New Name");
      expect(mockUpdateProfile).toHaveBeenCalledWith(
        expect.anything(),
        "user_123",
        { displayName: "New Name" }
      );
    });

    it("updates globalPreferences", async () => {
      const updated = {
        ...sampleProfile,
        globalPreferences: { theme: "light", lang: "en" },
        updatedAt: "2026-02-15T00:00:00Z",
      };
      mockUpdateProfile.mockResolvedValueOnce(updated);

      const event = createEvent(
        "PATCH",
        { globalPreferences: { theme: "light", lang: "en" } },
        "user_123"
      );
      const result = await handler(event, mockContext);
      const body = JSON.parse(result.body);

      expect(result.statusCode).toBe(200);
      expect(body.data.globalPreferences).toEqual({
        theme: "light",
        lang: "en",
      });
    });

    it("updates both displayName and globalPreferences", async () => {
      const updated = {
        ...sampleProfile,
        displayName: "Both Updated",
        globalPreferences: { newPref: true },
        updatedAt: "2026-02-15T00:00:00Z",
      };
      mockUpdateProfile.mockResolvedValueOnce(updated);

      const event = createEvent(
        "PATCH",
        { displayName: "Both Updated", globalPreferences: { newPref: true } },
        "user_123"
      );
      const result = await handler(event, mockContext);
      const body = JSON.parse(result.body);

      expect(result.statusCode).toBe(200);
      expect(body.data.displayName).toBe("Both Updated");
      expect(body.data.globalPreferences).toEqual({ newPref: true });
    });

    it("returns 400 for missing request body", async () => {
      const event = createEvent("PATCH", undefined, "user_123");
      event.body = null;
      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(400);
    });

    it("returns 400 for empty object (no fields)", async () => {
      const event = createEvent("PATCH", {}, "user_123");
      const result = await handler(event, mockContext);
      const body = JSON.parse(result.body);

      expect(result.statusCode).toBe(400);
      expect(body.error.code).toBe("VALIDATION_ERROR");
    });

    it("returns 400 for empty displayName", async () => {
      const event = createEvent("PATCH", { displayName: "" }, "user_123");
      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(400);
    });

    it("returns 400 for displayName exceeding 255 characters", async () => {
      const event = createEvent(
        "PATCH",
        { displayName: "x".repeat(256) },
        "user_123"
      );
      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(400);
    });

    it("returns 404 when profile does not exist (PATCH)", async () => {
      mockUpdateProfile.mockRejectedValueOnce(
        new AppError(ErrorCode.NOT_FOUND, "User profile not found")
      );
      const event = createEvent(
        "PATCH",
        { displayName: "Test" },
        "nonexistent_user"
      );
      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(404);
      const body = JSON.parse(result.body);
      expect(body.error.code).toBe("NOT_FOUND");
    });
  });

  describe("AC3: Auth enforcement via middleware", () => {
    it("returns 401 when no auth context (GET)", async () => {
      const event = createEvent("GET");
      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(401);
    });

    it("returns 401 when no auth context (PATCH)", async () => {
      const event = createEvent("PATCH", { displayName: "test" });
      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(401);
    });
  });

  describe("Method routing", () => {
    it("returns 405 for unsupported HTTP method", async () => {
      const event = createEvent("GET", undefined, "user_123");
      event.httpMethod = "DELETE";
      const result = await handler(event, mockContext);
      const body = JSON.parse(result.body);

      expect(result.statusCode).toBe(405);
      expect(body.error.code).toBe("METHOD_NOT_ALLOWED");
    });
  });
});
