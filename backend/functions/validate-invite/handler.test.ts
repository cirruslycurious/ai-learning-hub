/**
 * Validate Invite Endpoint handler tests
 *
 * Tests the POST /auth/validate-invite endpoint per Story 2.4.
 * Covers all acceptance criteria: AC1-AC7.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { APIGatewayProxyEvent, Context } from "aws-lambda";
import { AppError, ErrorCode } from "@ai-learning-hub/types";

// Mock @ai-learning-hub/db
const mockGetInviteCode = vi.fn();
const mockRedeemInviteCode = vi.fn();
const mockGetProfile = vi.fn();
const mockEnforceRateLimit = vi.fn();
const mockGetDefaultClient = vi.fn(() => ({}));

vi.mock("@ai-learning-hub/db", () => ({
  getDefaultClient: () => mockGetDefaultClient(),
  getInviteCode: (...args: unknown[]) => mockGetInviteCode(...args),
  redeemInviteCode: (...args: unknown[]) => mockRedeemInviteCode(...args),
  getProfile: (...args: unknown[]) => mockGetProfile(...args),
  enforceRateLimit: (...args: unknown[]) => mockEnforceRateLimit(...args),
  USERS_TABLE_CONFIG: {
    tableName: "ai-learning-hub-users",
    partitionKey: "PK",
    sortKey: "SK",
  },
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

// Mock @clerk/backend
const mockUpdateUserMetadata = vi.fn();
vi.mock("@clerk/backend", () => ({
  createClerkClient: () => ({
    users: {
      updateUserMetadata: mockUpdateUserMetadata,
    },
  }),
}));

// Mock @ai-learning-hub/middleware
const mockGetClerkSecretKey = vi.fn().mockResolvedValue("sk_test_fake_key");
vi.mock("@ai-learning-hub/middleware", () => ({
  getClerkSecretKey: (...args: unknown[]) => mockGetClerkSecretKey(...args),
  resetClerkSecretKeyCache: vi.fn(),
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
            roles: ["user"],
            isApiKey: false,
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
  body?: Record<string, unknown>,
  userId?: string
): APIGatewayProxyEvent {
  return {
    httpMethod: "POST",
    path: "/auth/validate-invite",
    body: body ? JSON.stringify(body) : null,
    headers: { "Content-Type": "application/json" },
    multiValueHeaders: {},
    isBase64Encoded: false,
    pathParameters: null,
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    stageVariables: null,
    resource: "/auth/validate-invite",
    requestContext: {
      accountId: "123456789",
      apiId: "api-id",
      authorizer: userId
        ? { userId, role: "user", authMethod: "jwt" }
        : undefined,
      protocol: "HTTP/1.1",
      httpMethod: "POST",
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
      path: "/auth/validate-invite",
      stage: "dev",
      requestId: "test-request-id",
      requestTimeEpoch: Date.now(),
      resourceId: "resource-id",
      resourcePath: "/auth/validate-invite",
    },
  };
}

const mockContext = {} as Context;

describe("Validate Invite Handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CLERK_SECRET_KEY_PARAM = "/ai-learning-hub/clerk-secret-key";
    process.env.INVITE_CODES_TABLE_NAME = "ai-learning-hub-invite-codes";
    mockGetClerkSecretKey.mockResolvedValue("sk_test_fake_key");
  });

  describe("AC1: POST /auth/validate-invite with valid JWT and body { code }", () => {
    it("validates JWT and looks up code in invite-codes table", async () => {
      const inviteCode = {
        PK: "CODE#ABCD1234",
        SK: "META",
        code: "ABCD1234",
        generatedBy: "user_gen",
        generatedAt: "2026-01-01T00:00:00Z",
      };
      mockGetInviteCode.mockResolvedValueOnce(inviteCode);
      mockRedeemInviteCode.mockResolvedValueOnce({
        ...inviteCode,
        redeemedBy: "user_123",
        redeemedAt: "2026-02-15T00:00:00Z",
      });
      mockUpdateUserMetadata.mockResolvedValueOnce({});

      const event = createEvent({ code: "ABCD1234" }, "user_123");
      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(200);
      expect(mockGetInviteCode).toHaveBeenCalledWith(
        expect.anything(),
        "ABCD1234"
      );
    });
  });

  describe("AC2: Valid code → redeem and set inviteValidated = true", () => {
    it("marks code redeemed in DynamoDB and updates Clerk metadata", async () => {
      const inviteCode = {
        PK: "CODE#VALIDCODE1",
        SK: "META",
        code: "VALIDCODE1",
        generatedBy: "user_gen",
        generatedAt: "2026-01-01T00:00:00Z",
      };
      mockGetInviteCode.mockResolvedValueOnce(inviteCode);
      mockRedeemInviteCode.mockResolvedValueOnce({
        ...inviteCode,
        redeemedBy: "user_new",
        redeemedAt: "2026-02-15T00:00:00Z",
      });
      mockUpdateUserMetadata.mockResolvedValueOnce({});

      const event = createEvent({ code: "VALIDCODE1" }, "user_new");
      const result = await handler(event, mockContext);
      const body = JSON.parse(result.body);

      expect(result.statusCode).toBe(200);
      expect(body.data.success).toBe(true);

      // Verify DynamoDB redemption
      expect(mockRedeemInviteCode).toHaveBeenCalledWith(
        expect.anything(),
        "VALIDCODE1",
        "user_new"
      );

      // Verify Clerk metadata update
      expect(mockUpdateUserMetadata).toHaveBeenCalledWith("user_new", {
        publicMetadata: { inviteValidated: true },
      });
    });
  });

  describe("AC3: Invalid/expired/redeemed code → 400", () => {
    it("returns 400 for non-existent code", async () => {
      mockGetInviteCode.mockResolvedValueOnce(null);

      const event = createEvent({ code: "BADCODE12" }, "user_123");
      const result = await handler(event, mockContext);
      const body = JSON.parse(result.body);

      expect(result.statusCode).toBe(400);
      expect(body.error.code).toBe("VALIDATION_ERROR");
    });

    it("returns 400 for already redeemed code", async () => {
      mockGetInviteCode.mockResolvedValueOnce({
        PK: "CODE#REDEEMED1",
        SK: "META",
        code: "REDEEMED1",
        generatedBy: "user_gen",
        generatedAt: "2026-01-01T00:00:00Z",
        redeemedBy: "user_other",
        redeemedAt: "2026-02-01T00:00:00Z",
      });

      const event = createEvent({ code: "REDEEMED1" }, "user_123");
      const result = await handler(event, mockContext);
      const body = JSON.parse(result.body);

      expect(result.statusCode).toBe(400);
      expect(body.error.code).toBe("VALIDATION_ERROR");
    });

    it("returns 400 for expired code", async () => {
      mockGetInviteCode.mockResolvedValueOnce({
        PK: "CODE#EXPIRED01",
        SK: "META",
        code: "EXPIRED01",
        generatedBy: "user_gen",
        generatedAt: "2026-01-01T00:00:00Z",
        expiresAt: "2026-01-02T00:00:00Z", // Expired
      });

      const event = createEvent({ code: "EXPIRED01" }, "user_123");
      const result = await handler(event, mockContext);
      const body = JSON.parse(result.body);

      expect(result.statusCode).toBe(400);
      expect(body.error.code).toBe("VALIDATION_ERROR");
    });

    it("returns 400 for revoked code", async () => {
      mockGetInviteCode.mockResolvedValueOnce({
        PK: "CODE#REVOKED01",
        SK: "META",
        code: "REVOKED01",
        generatedBy: "user_gen",
        generatedAt: "2026-01-01T00:00:00Z",
        isRevoked: true,
      });

      const event = createEvent({ code: "REVOKED01" }, "user_123");
      const result = await handler(event, mockContext);
      const body = JSON.parse(result.body);

      expect(result.statusCode).toBe(400);
      expect(body.error.code).toBe("VALIDATION_ERROR");
    });

    it("returns 400 when race condition causes ConditionalCheckFailedException (NOT_FOUND)", async () => {
      // Code appears valid at lookup time but another request redeems it first
      mockGetInviteCode.mockResolvedValueOnce({
        PK: "CODE#RACECODE1",
        SK: "META",
        code: "RACECODE1",
        generatedBy: "user_gen",
        generatedAt: "2026-01-01T00:00:00Z",
      });
      // redeemInviteCode throws NOT_FOUND from ConditionalCheckFailedException
      mockRedeemInviteCode.mockRejectedValueOnce(
        new AppError(ErrorCode.NOT_FOUND, "Item not found")
      );

      const event = createEvent({ code: "RACECODE1" }, "user_123");
      const result = await handler(event, mockContext);
      const body = JSON.parse(result.body);

      expect(result.statusCode).toBe(400);
      expect(body.error.code).toBe("VALIDATION_ERROR");
      expect(body.error.message).toBe("Invite code has already been used");
    });
  });

  describe("AC4: No/invalid JWT → 401", () => {
    it("returns 401 when no auth context is present", async () => {
      const event = createEvent({ code: "ABCD1234" }); // No userId
      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(401);
    });
  });

  describe("AC5: Validation body", () => {
    it("returns 400 for missing request body", async () => {
      const event = createEvent(undefined, "user_123");
      event.body = null;
      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(400);
    });

    it("returns 400 for code shorter than 8 chars", async () => {
      const event = createEvent({ code: "SHORT" }, "user_123");
      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(400);
    });

    it("returns 400 for code with non-alphanumeric chars", async () => {
      const event = createEvent({ code: "ABCD-1234!" }, "user_123");
      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(400);
    });

    it("returns 400 for code exceeding 16 characters", async () => {
      const event = createEvent(
        { code: "ABCDEFGHIJKLMNOPQ" }, // 17 characters
        "user_123"
      );
      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(400);
    });
  });

  describe("AC6: Clerk API fails after DynamoDB redemption", () => {
    it("returns 500 when Clerk update fails", async () => {
      const inviteCode = {
        PK: "CODE#CLERKFAIL",
        SK: "META",
        code: "CLERKFAIL",
        generatedBy: "user_gen",
        generatedAt: "2026-01-01T00:00:00Z",
      };
      mockGetInviteCode.mockResolvedValueOnce(inviteCode);
      mockRedeemInviteCode.mockResolvedValueOnce({
        ...inviteCode,
        redeemedBy: "user_123",
        redeemedAt: "2026-02-15T00:00:00Z",
      });
      mockUpdateUserMetadata.mockRejectedValueOnce(
        new Error("Clerk API error")
      );

      const event = createEvent({ code: "CLERKFAIL" }, "user_123");
      const result = await handler(event, mockContext);

      // Should return 500 for Clerk failure
      expect(result.statusCode).toBe(500);
    });
  });

  describe("Rate limiting (Story 2.7, AC4)", () => {
    it("returns 429 when rate limit exceeded", async () => {
      mockEnforceRateLimit.mockRejectedValueOnce(
        new AppError(
          ErrorCode.RATE_LIMITED,
          "Rate limit exceeded: 5 invite-validate per 1 hour(s)"
        )
      );

      const event = createEvent({ code: "ABCD1234" }, "user_123");
      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(429);
      const body = JSON.parse(result.body);
      expect(body.error.code).toBe("RATE_LIMITED");
    });

    it("calls enforceRateLimit with source IP and correct config", async () => {
      mockEnforceRateLimit.mockResolvedValueOnce(undefined);
      const inviteCode = {
        PK: "CODE#ABCD1234",
        SK: "META",
        code: "ABCD1234",
        generatedBy: "user_gen",
        generatedAt: "2026-01-01T00:00:00Z",
      };
      mockGetInviteCode.mockResolvedValueOnce(inviteCode);
      mockRedeemInviteCode.mockResolvedValueOnce({
        ...inviteCode,
        redeemedBy: "user_123",
      });
      mockUpdateUserMetadata.mockResolvedValueOnce({});

      const event = createEvent({ code: "ABCD1234" }, "user_123");
      await handler(event, mockContext);

      expect(mockEnforceRateLimit).toHaveBeenCalledWith(
        expect.anything(),
        "ai-learning-hub-users",
        expect.objectContaining({
          operation: "invite-validate",
          identifier: "127.0.0.1",
          limit: 5,
          windowSeconds: 3600,
        }),
        expect.anything()
      );
    });
  });

  describe("AC7: Idempotent — already validated user returns 200", () => {
    it("returns 200 when user already has inviteValidated and re-attempts Clerk update", async () => {
      // Profile shows user already validated
      mockGetProfile.mockResolvedValueOnce({
        PK: "USER#user_validated",
        SK: "PROFILE",
        userId: "user_validated",
        role: "user",
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
      });

      // The code was already redeemed by this same user
      const inviteCode = {
        PK: "CODE#ANYCODE12",
        SK: "META",
        code: "ANYCODE12",
        generatedBy: "user_gen",
        generatedAt: "2026-01-01T00:00:00Z",
        redeemedBy: "user_validated",
        redeemedAt: "2026-02-01T00:00:00Z",
      };
      mockGetInviteCode.mockResolvedValueOnce(inviteCode);
      // Clerk update should still be attempted on idempotent path
      mockUpdateUserMetadata.mockResolvedValueOnce({});

      const event = createEvent({ code: "ANYCODE12" }, "user_validated");
      const result = await handler(event, mockContext);
      const body = JSON.parse(result.body);

      expect(result.statusCode).toBe(200);
      expect(body.data.success).toBe(true);

      // Should NOT call redeemInviteCode (already redeemed by same user)
      expect(mockRedeemInviteCode).not.toHaveBeenCalled();

      // Should still call Clerk to ensure metadata is set (recovery from partial failure)
      expect(mockUpdateUserMetadata).toHaveBeenCalledWith("user_validated", {
        publicMetadata: { inviteValidated: true },
      });
    });
  });
});
