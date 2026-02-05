import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  extractAuthContext,
  requireAuth,
  requireRole,
  requireScope,
} from "../src/auth.js";
import { AppError, ErrorCode } from "@ai-learning-hub/types";
import type { APIGatewayProxyEvent } from "aws-lambda";

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

describe("Auth Middleware", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("extractAuthContext", () => {
    it("should extract auth from Lambda authorizer context", () => {
      const event = createMockEvent({
        requestContext: {
          ...createMockEvent().requestContext,
          authorizer: {
            userId: "user_123",
            roles: ["user", "admin"],
            isApiKey: false,
          },
        },
      });

      const auth = extractAuthContext(event);

      expect(auth?.userId).toBe("user_123");
      expect(auth?.roles).toContain("admin");
      expect(auth?.isApiKey).toBe(false);
    });

    it("should extract API key auth context", () => {
      const event = createMockEvent({
        requestContext: {
          ...createMockEvent().requestContext,
          authorizer: {
            userId: "user_456",
            roles: ["user"],
            isApiKey: true,
            apiKeyId: "key_789",
            scopes: ["saves:write"],
          },
        },
      });

      const auth = extractAuthContext(event);

      expect(auth?.isApiKey).toBe(true);
      expect(auth?.apiKeyId).toBe("key_789");
      expect(auth?.scopes).toContain("saves:write");
    });

    it("should handle string isApiKey value", () => {
      const event = createMockEvent({
        requestContext: {
          ...createMockEvent().requestContext,
          authorizer: {
            userId: "user_123",
            isApiKey: "true",
          },
        },
      });

      const auth = extractAuthContext(event);
      expect(auth?.isApiKey).toBe(true);
    });

    it("should return null when no authorizer context", () => {
      const event = createMockEvent();
      const auth = extractAuthContext(event);
      expect(auth).toBeNull();
    });

    it("should extract dev user ID in non-production", () => {
      process.env.NODE_ENV = "development";
      const event = createMockEvent({
        headers: { "x-dev-user-id": "dev_user_123" },
      });

      const auth = extractAuthContext(event);
      expect(auth?.userId).toBe("dev_user_123");
    });

    it("should ignore dev header in production", () => {
      process.env.NODE_ENV = "production";
      const event = createMockEvent({
        headers: { "x-dev-user-id": "dev_user_123" },
      });

      const auth = extractAuthContext(event);
      expect(auth).toBeNull();
    });
  });

  describe("requireAuth", () => {
    it("should return auth context when present", () => {
      const event = createMockEvent({
        requestContext: {
          ...createMockEvent().requestContext,
          authorizer: {
            userId: "user_123",
            roles: ["user"],
          },
        },
      });

      const auth = requireAuth(event);
      expect(auth.userId).toBe("user_123");
    });

    it("should throw UNAUTHORIZED when no auth", () => {
      const event = createMockEvent();

      expect(() => requireAuth(event)).toThrow(AppError);
      try {
        requireAuth(event);
      } catch (e) {
        if (AppError.isAppError(e)) {
          expect(e.code).toBe(ErrorCode.UNAUTHORIZED);
        }
      }
    });
  });

  describe("requireRole", () => {
    it("should pass when user has required role", () => {
      const auth = {
        userId: "user_123",
        roles: ["user", "admin"],
        isApiKey: false,
      };

      expect(() => requireRole(auth, ["admin"])).not.toThrow();
    });

    it("should pass when user has any required role", () => {
      const auth = {
        userId: "user_123",
        roles: ["user"],
        isApiKey: false,
      };

      expect(() => requireRole(auth, ["admin", "user"])).not.toThrow();
    });

    it("should throw FORBIDDEN when lacking role", () => {
      const auth = {
        userId: "user_123",
        roles: ["user"],
        isApiKey: false,
      };

      expect(() => requireRole(auth, ["admin"])).toThrow(AppError);
      try {
        requireRole(auth, ["admin"]);
      } catch (e) {
        if (AppError.isAppError(e)) {
          expect(e.code).toBe(ErrorCode.FORBIDDEN);
        }
      }
    });
  });

  describe("requireScope", () => {
    it("should pass for JWT auth (all scopes)", () => {
      const auth = {
        userId: "user_123",
        roles: ["user"],
        isApiKey: false,
      };

      expect(() => requireScope(auth, "saves:write")).not.toThrow();
    });

    it("should pass when API key has wildcard scope", () => {
      const auth = {
        userId: "user_123",
        roles: ["user"],
        isApiKey: true,
        scopes: ["*"],
      };

      expect(() => requireScope(auth, "saves:write")).not.toThrow();
    });

    it("should pass when API key has specific scope", () => {
      const auth = {
        userId: "user_123",
        roles: ["user"],
        isApiKey: true,
        scopes: ["saves:write"],
      };

      expect(() => requireScope(auth, "saves:write")).not.toThrow();
    });

    it("should throw FORBIDDEN when API key lacks scope", () => {
      const auth = {
        userId: "user_123",
        roles: ["user"],
        isApiKey: true,
        scopes: ["saves:read"],
      };

      expect(() => requireScope(auth, "saves:write")).toThrow(AppError);
      try {
        requireScope(auth, "saves:write");
      } catch (e) {
        if (AppError.isAppError(e)) {
          expect(e.code).toBe(ErrorCode.FORBIDDEN);
        }
      }
    });

    it("should handle missing scopes array", () => {
      const auth = {
        userId: "user_123",
        roles: ["user"],
        isApiKey: true,
      };

      expect(() => requireScope(auth, "saves:write")).toThrow(AppError);
    });
  });
});
