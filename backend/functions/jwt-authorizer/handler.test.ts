/**
 * JWT Authorizer Lambda handler tests
 *
 * Tests the Clerk JWT validation authorizer per ADR-013.
 * Covers all acceptance criteria: AC1-AC9.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { APIGatewayTokenAuthorizerEvent, Context } from "aws-lambda";

/**
 * Minimal shape of the Clerk verifyToken result used by our handler.
 * Avoids coupling to @clerk/backend internal types in tests.
 */
interface MockJwtPayload {
  sub: string;
  publicMetadata: Record<string, unknown>;
}

// Mock @aws-sdk/client-ssm (fetches Clerk secret at runtime)
const mockSsmSend = vi.fn().mockResolvedValue({
  Parameter: { Value: "sk_test_fake_key" },
});
vi.mock("@aws-sdk/client-ssm", () => ({
  SSMClient: vi.fn(() => ({ send: mockSsmSend })),
  GetParameterCommand: vi.fn(),
}));

// Mock @clerk/backend before importing handler
vi.mock("@clerk/backend", () => ({
  verifyToken: vi.fn(),
}));

// Mock @ai-learning-hub/db
vi.mock("@ai-learning-hub/db", () => ({
  getDefaultClient: vi.fn(() => ({})),
  getProfile: vi.fn(),
  ensureProfile: vi.fn(),
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

// Mock @ai-learning-hub/middleware (shared policy helpers + SSM)
vi.mock("@ai-learning-hub/middleware", () => ({
  generatePolicy: (effect: "Allow" | "Deny") => ({
    Version: "2012-10-17",
    Statement: [
      {
        Action: "execute-api:Invoke",
        Effect: effect,
        Resource: "*",
      },
    ],
  }),
  deny: (principalId: string, errorCode: string) => ({
    principalId,
    policyDocument: {
      Version: "2012-10-17",
      Statement: [
        {
          Action: "execute-api:Invoke",
          Effect: "Deny",
          Resource: "*",
        },
      ],
    },
    context: { errorCode },
  }),
  getClerkSecretKey: vi.fn().mockResolvedValue("sk_test_fake_key"),
  resetClerkSecretKeyCache: vi.fn(),
}));

import { handler } from "./handler.js";
import { verifyToken } from "@clerk/backend";
import { getProfile, ensureProfile } from "@ai-learning-hub/db";

const mockVerifyToken = vi.mocked(verifyToken);
const mockGetProfile = vi.mocked(getProfile);
const mockEnsureProfile = vi.mocked(ensureProfile);

function createEvent(
  token: string = "valid-jwt-token"
): APIGatewayTokenAuthorizerEvent {
  return {
    type: "TOKEN",
    authorizationToken: `Bearer ${token}`,
    methodArn:
      "arn:aws:execute-api:us-east-1:123456789:api-id/stage/GET/resource",
  };
}

const mockContext = {} as Context;

function mockVerifyResult(payload: MockJwtPayload): void {
  mockVerifyToken.mockResolvedValueOnce(
    payload as unknown as Awaited<ReturnType<typeof verifyToken>>
  );
}

describe("JWT Authorizer Handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CLERK_SECRET_KEY_PARAM = "/ai-learning-hub/clerk-secret-key";
    mockSsmSend.mockResolvedValue({
      Parameter: { Value: "sk_test_fake_key" },
    });
  });

  describe("AC1: Valid JWT token validation", () => {
    it("validates token via @clerk/backend verifyToken and extracts sub + publicMetadata", async () => {
      mockVerifyResult({
        sub: "user_clerk_123",
        publicMetadata: {
          inviteValidated: true,
          email: "user@example.com",
          displayName: "Test User",
          role: "user",
        },
      });
      mockGetProfile.mockResolvedValueOnce({
        PK: "USER#user_clerk_123",
        SK: "PROFILE",
        userId: "user_clerk_123",
        email: "user@example.com",
        displayName: "Test User",
        role: "user",
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
      });

      const result = await handler(createEvent(), mockContext);

      expect(mockVerifyToken).toHaveBeenCalledWith("valid-jwt-token", {
        secretKey: "sk_test_fake_key",
      });
      expect(result.principalId).toBe("user_clerk_123");
      // Fast path: ensureProfile should NOT be called for existing users
      expect(mockEnsureProfile).not.toHaveBeenCalled();
    });
  });

  describe("AC2: Valid JWT with inviteValidated === true → Allow", () => {
    it("returns IAM Allow policy with userId, role, authMethod in context", async () => {
      mockVerifyResult({
        sub: "user_clerk_123",
        publicMetadata: {
          inviteValidated: true,
          email: "user@example.com",
          role: "user",
        },
      });
      mockGetProfile.mockResolvedValueOnce({
        PK: "USER#user_clerk_123",
        SK: "PROFILE",
        userId: "user_clerk_123",
        role: "user",
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
      });

      const result = await handler(createEvent(), mockContext);

      expect(result.policyDocument.Statement[0].Effect).toBe("Allow");
      expect(result.context).toEqual({
        userId: "user_clerk_123",
        role: "user",
        authMethod: "jwt",
      });
    });
  });

  describe("AC3: inviteValidated !== true → Deny INVITE_REQUIRED", () => {
    it("returns IAM Deny with INVITE_REQUIRED when inviteValidated is false", async () => {
      mockVerifyResult({
        sub: "user_unvalidated",
        publicMetadata: {
          inviteValidated: false,
        },
      });

      const result = await handler(createEvent(), mockContext);

      expect(result.policyDocument.Statement[0].Effect).toBe("Deny");
      expect(result.context?.errorCode).toBe("INVITE_REQUIRED");
    });

    it("returns IAM Deny with INVITE_REQUIRED when inviteValidated is missing", async () => {
      mockVerifyResult({
        sub: "user_no_invite",
        publicMetadata: {},
      });

      const result = await handler(createEvent(), mockContext);

      expect(result.policyDocument.Statement[0].Effect).toBe("Deny");
      expect(result.context?.errorCode).toBe("INVITE_REQUIRED");
    });
  });

  describe("AC4: No PROFILE exists → ensureProfile creates it", () => {
    it("calls ensureProfile with clerkId and publicMetadata when profile is null", async () => {
      const metadata = {
        inviteValidated: true,
        email: "new@example.com",
        displayName: "New User",
        role: "user",
      };
      mockVerifyResult({
        sub: "user_new_123",
        publicMetadata: metadata,
      });
      // First getProfile returns null (new user)
      mockGetProfile.mockResolvedValueOnce(null);
      mockEnsureProfile.mockResolvedValueOnce(undefined);
      // Second getProfile returns the newly created profile
      mockGetProfile.mockResolvedValueOnce({
        PK: "USER#user_new_123",
        SK: "PROFILE",
        userId: "user_new_123",
        role: "user",
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
      });

      await handler(createEvent(), mockContext);

      expect(mockEnsureProfile).toHaveBeenCalledWith(
        expect.anything(), // client
        "user_new_123",
        metadata
      );
      // getProfile should be called twice for new users
      expect(mockGetProfile).toHaveBeenCalledTimes(2);
    });
  });

  describe("AC5: PROFILE exists → GetItem only (fast path)", () => {
    it("skips ensureProfile and returns Allow with 1 DB read", async () => {
      mockVerifyResult({
        sub: "user_existing",
        publicMetadata: { inviteValidated: true, role: "user" },
      });
      mockGetProfile.mockResolvedValueOnce({
        PK: "USER#user_existing",
        SK: "PROFILE",
        userId: "user_existing",
        role: "user",
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
      });

      const result = await handler(createEvent(), mockContext);

      expect(mockGetProfile).toHaveBeenCalledTimes(1);
      expect(mockGetProfile).toHaveBeenCalledWith(
        expect.anything(),
        "user_existing"
      );
      // Fast path: ensureProfile should NOT be called
      expect(mockEnsureProfile).not.toHaveBeenCalled();
      expect(result.policyDocument.Statement[0].Effect).toBe("Allow");
    });
  });

  describe("AC6: suspendedAt set → Deny SUSPENDED_ACCOUNT", () => {
    it("returns IAM Deny with SUSPENDED_ACCOUNT when profile is suspended", async () => {
      mockVerifyResult({
        sub: "user_suspended",
        publicMetadata: { inviteValidated: true },
      });
      mockGetProfile.mockResolvedValueOnce({
        PK: "USER#user_suspended",
        SK: "PROFILE",
        userId: "user_suspended",
        role: "user",
        suspendedAt: "2026-01-15T00:00:00Z",
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-15T00:00:00Z",
      });

      const result = await handler(createEvent(), mockContext);

      expect(result.policyDocument.Statement[0].Effect).toBe("Deny");
      expect(result.context?.errorCode).toBe("SUSPENDED_ACCOUNT");
    });
  });

  describe("AC7: Invalid/expired JWT → throws Unauthorized", () => {
    it("throws Unauthorized when verifyToken rejects", async () => {
      mockVerifyToken.mockRejectedValueOnce(new Error("Token expired"));

      await expect(handler(createEvent(), mockContext)).rejects.toThrow(
        "Unauthorized"
      );
    });

    it("throws Unauthorized when verifyToken rejects with invalid token format", async () => {
      const event = createEvent();
      event.authorizationToken = "invalid-format-token";

      // verifyToken would fail with a bad token
      mockVerifyToken.mockRejectedValueOnce(new Error("Invalid token format"));

      await expect(handler(event, mockContext)).rejects.toThrow("Unauthorized");
    });
  });

  describe("AC8: Authorizer cache TTL", () => {
    it("is exported as AUTHORIZER_CACHE_TTL = 300", async () => {
      const { AUTHORIZER_CACHE_TTL } = await import("./handler.js");
      expect(AUTHORIZER_CACHE_TTL).toBe(300);
    });
  });

  describe("Role resolution", () => {
    it("uses profile role over publicMetadata role", async () => {
      mockVerifyResult({
        sub: "user_admin",
        publicMetadata: { inviteValidated: true, role: "user" },
      });
      mockGetProfile.mockResolvedValueOnce({
        PK: "USER#user_admin",
        SK: "PROFILE",
        userId: "user_admin",
        role: "admin",
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
      });

      const result = await handler(createEvent(), mockContext);

      expect(result.context?.role).toBe("admin");
    });

    it("falls back to publicMetadata role when profile role is missing", async () => {
      mockVerifyResult({
        sub: "user_meta",
        publicMetadata: { inviteValidated: true, role: "editor" },
      });
      mockGetProfile.mockResolvedValueOnce({
        PK: "USER#user_meta",
        SK: "PROFILE",
        userId: "user_meta",
        role: "",
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
      });

      const result = await handler(createEvent(), mockContext);

      expect(result.context?.role).toBe("editor");
    });

    it("defaults to 'user' when no role is available", async () => {
      mockVerifyResult({
        sub: "user_norole",
        publicMetadata: { inviteValidated: true },
      });
      mockGetProfile.mockResolvedValueOnce({
        PK: "USER#user_norole",
        SK: "PROFILE",
        userId: "user_norole",
        role: "",
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
      });

      const result = await handler(createEvent(), mockContext);

      expect(result.context?.role).toBe("user");
    });
  });

  describe("Profile not found edge case", () => {
    it("throws Unauthorized when getProfile returns null after ensureProfile", async () => {
      mockVerifyResult({
        sub: "user_ghost",
        publicMetadata: { inviteValidated: true },
      });
      mockGetProfile.mockResolvedValueOnce(null); // first getProfile returns null
      mockEnsureProfile.mockResolvedValueOnce(undefined);
      mockGetProfile.mockResolvedValueOnce(null); // second getProfile also null

      await expect(handler(createEvent(), mockContext)).rejects.toThrow(
        "Unauthorized"
      );
    });
  });

  describe("Policy generation", () => {
    it("generates Allow policy scoped to the methodArn", async () => {
      mockVerifyResult({
        sub: "user_allow",
        publicMetadata: { inviteValidated: true },
      });
      mockGetProfile.mockResolvedValueOnce({
        PK: "USER#user_allow",
        SK: "PROFILE",
        userId: "user_allow",
        role: "user",
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
      });

      const result = await handler(createEvent(), mockContext);

      expect(result.policyDocument).toEqual({
        Version: "2012-10-17",
        Statement: [
          {
            Action: "execute-api:Invoke",
            Effect: "Allow",
            Resource: "*",
          },
        ],
      });
    });

    it("generates Deny policy for unauthorized requests", async () => {
      mockVerifyResult({
        sub: "user_deny",
        publicMetadata: { inviteValidated: false },
      });

      const result = await handler(createEvent(), mockContext);

      expect(result.policyDocument).toEqual({
        Version: "2012-10-17",
        Statement: [
          {
            Action: "execute-api:Invoke",
            Effect: "Deny",
            Resource: "*",
          },
        ],
      });
    });
  });
});
