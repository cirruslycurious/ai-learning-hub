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

    it("should deserialize JSON-serialized scopes from API Gateway authorizer context", () => {
      // API Gateway only supports string values in authorizer context,
      // so the API key authorizer serializes scopes as JSON.stringify(scopes)
      const event = createMockEvent({
        requestContext: {
          ...createMockEvent().requestContext,
          authorizer: {
            userId: "user_456",
            roles: "user",
            isApiKey: "true",
            apiKeyId: "key_789",
            scopes: '["saves:write"]',
          },
        },
      });

      const auth = extractAuthContext(event);

      expect(auth?.isApiKey).toBe(true);
      expect(auth?.scopes).toEqual(["saves:write"]);
    });

    it("should deserialize wildcard scopes from API Gateway authorizer context", () => {
      const event = createMockEvent({
        requestContext: {
          ...createMockEvent().requestContext,
          authorizer: {
            userId: "user_456",
            isApiKey: "true",
            scopes: '["*"]',
          },
        },
      });

      const auth = extractAuthContext(event);

      expect(auth?.scopes).toEqual(["*"]);
    });

    it("should handle native array scopes (direct invocation / test context)", () => {
      // In test or direct invocation scenarios, scopes may already be an array
      const event = createMockEvent({
        requestContext: {
          ...createMockEvent().requestContext,
          authorizer: {
            userId: "user_456",
            isApiKey: true,
            scopes: ["saves:write"],
          },
        },
      });

      const auth = extractAuthContext(event);

      expect(auth?.scopes).toEqual(["saves:write"]);
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

    it("should extract dev user ID when ALLOW_DEV_AUTH_HEADER is set", () => {
      process.env.ALLOW_DEV_AUTH_HEADER = "true";
      const event = createMockEvent({
        headers: { "x-dev-user-id": "dev_user_123" },
      });

      const auth = extractAuthContext(event);
      expect(auth?.userId).toBe("dev_user_123");
    });

    it("should accept ALLOW_DEV_AUTH_HEADER=1", () => {
      process.env.ALLOW_DEV_AUTH_HEADER = "1";
      const event = createMockEvent({
        headers: { "x-dev-user-id": "dev_user_123" },
      });

      const auth = extractAuthContext(event);
      expect(auth?.userId).toBe("dev_user_123");
    });

    it("should ignore dev header when ALLOW_DEV_AUTH_HEADER is not set", () => {
      delete process.env.ALLOW_DEV_AUTH_HEADER;
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

    it("should throw SCOPE_INSUFFICIENT when API key lacks scope", () => {
      expect.assertions(2);
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
          expect(e.code).toBe(ErrorCode.SCOPE_INSUFFICIENT);
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

  describe("Scope enforcement integration (AC1-AC4)", () => {
    it("AC1: API key with saves:write scope can access POST /saves", () => {
      // Simulates real API Gateway context from API key authorizer
      const event = createMockEvent({
        requestContext: {
          ...createMockEvent().requestContext,
          authorizer: {
            userId: "user_123",
            role: "user",
            isApiKey: "true",
            apiKeyId: "key_abc",
            authMethod: "api-key",
            scopes: '["saves:write"]',
          },
        },
      });

      const auth = extractAuthContext(event)!;
      expect(() => requireScope(auth, "saves:write")).not.toThrow();
    });

    it("AC1: API key with wildcard scope can access any endpoint", () => {
      const event = createMockEvent({
        requestContext: {
          ...createMockEvent().requestContext,
          authorizer: {
            userId: "user_123",
            role: "user",
            isApiKey: "true",
            apiKeyId: "key_abc",
            authMethod: "api-key",
            scopes: '["*"]',
          },
        },
      });

      const auth = extractAuthContext(event)!;
      expect(() => requireScope(auth, "saves:write")).not.toThrow();
      expect(() => requireScope(auth, "projects:read")).not.toThrow();
    });

    it("AC2: Capture-only key denied on non-saves endpoints → SCOPE_INSUFFICIENT", () => {
      expect.assertions(2);
      const event = createMockEvent({
        requestContext: {
          ...createMockEvent().requestContext,
          authorizer: {
            userId: "user_123",
            role: "user",
            isApiKey: "true",
            apiKeyId: "key_abc",
            authMethod: "api-key",
            scopes: '["saves:write"]',
          },
        },
      });

      const auth = extractAuthContext(event)!;
      expect(() => requireScope(auth, "*")).toThrow(AppError);

      try {
        requireScope(auth, "*");
      } catch (e) {
        if (AppError.isAppError(e)) {
          expect(e.code).toBe(ErrorCode.SCOPE_INSUFFICIENT);
        }
      }
    });

    it("AC3: JWT auth bypasses scope check entirely", () => {
      const event = createMockEvent({
        requestContext: {
          ...createMockEvent().requestContext,
          authorizer: {
            userId: "user_123",
            role: "user",
            authMethod: "jwt",
          },
        },
      });

      const auth = extractAuthContext(event)!;
      // JWT users bypass all scope checks
      expect(() => requireScope(auth, "saves:write")).not.toThrow();
      expect(() => requireScope(auth, "*")).not.toThrow();
    });

    it("extracts role (singular string) from authorizer context into roles array", () => {
      // Both authorizers set "role" (singular) in context. Verify it maps to roles array.
      const event = createMockEvent({
        requestContext: {
          ...createMockEvent().requestContext,
          authorizer: {
            userId: "user_123",
            role: "analyst",
            authMethod: "jwt",
          },
        },
      });

      const auth = extractAuthContext(event)!;
      expect(auth.roles).toEqual(["analyst"]);
      expect(() => requireRole(auth, ["analyst"])).not.toThrow();
      expect(() => requireRole(auth, ["admin"])).toThrow(AppError);
    });

    it("admin role from authorizer context passes requireRole check", () => {
      const event = createMockEvent({
        requestContext: {
          ...createMockEvent().requestContext,
          authorizer: {
            userId: "user_123",
            role: "admin",
            isApiKey: "true",
            scopes: '["*"]',
          },
        },
      });

      const auth = extractAuthContext(event)!;
      expect(auth.roles).toEqual(["admin"]);
      expect(() => requireRole(auth, ["admin"])).not.toThrow();
    });
  });
});
