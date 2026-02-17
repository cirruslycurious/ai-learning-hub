/**
 * API Key Authorizer Lambda handler tests
 *
 * Tests the API key authentication authorizer per ADR-013 Story 2.2.
 * Covers all acceptance criteria: AC1-AC6.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { APIGatewayRequestAuthorizerEvent, Context } from "aws-lambda";

// Mock @ai-learning-hub/db
vi.mock("@ai-learning-hub/db", () => ({
  getDefaultClient: vi.fn(() => ({})),
  getApiKeyByHash: vi.fn(),
  getProfile: vi.fn(),
  updateApiKeyLastUsed: vi.fn(),
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

// Mock @ai-learning-hub/middleware (shared policy helpers)
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
}));

import { handler } from "./handler.js";
import {
  getApiKeyByHash,
  getProfile,
  updateApiKeyLastUsed,
} from "@ai-learning-hub/db";

const mockGetApiKeyByHash = vi.mocked(getApiKeyByHash);
const mockGetProfile = vi.mocked(getProfile);
const mockUpdateApiKeyLastUsed = vi.mocked(updateApiKeyLastUsed);

function createEvent(
  apiKey?: string,
  headerName = "x-api-key"
): APIGatewayRequestAuthorizerEvent {
  return {
    type: "REQUEST",
    methodArn:
      "arn:aws:execute-api:us-east-1:123456789:api-id/stage/GET/resource",
    headers: apiKey ? { [headerName]: apiKey } : {},
    multiValueHeaders: {},
    pathParameters: null,
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    stageVariables: null,
    path: "/resource",
    requestContext: {
      accountId: "123456789",
      apiId: "api-id",
      authorizer: undefined,
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
      path: "/resource",
      protocol: "HTTP/1.1",
      requestId: "req-123",
      requestTimeEpoch: Date.now(),
      resourceId: "resource-id",
      resourcePath: "/resource",
      stage: "dev",
    },
    resource: "/resource",
    httpMethod: "GET",
  };
}

const mockContext = {} as Context;

describe("API Key Authorizer Handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("AC1: Valid API key → hash with SHA-256, query apiKeyHash-index GSI", () => {
    it("hashes the API key with SHA-256 and queries the GSI", async () => {
      const apiKey = "test-api-key-value";

      mockGetApiKeyByHash.mockResolvedValueOnce({
        PK: "USER#clerk_123",
        SK: "APIKEY#key_abc",
        userId: "clerk_123",
        keyId: "key_abc",
        keyHash: "expected_hash",
        name: "My Key",
        scopes: ["*"],
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
      });
      mockGetProfile.mockResolvedValueOnce({
        PK: "USER#clerk_123",
        SK: "PROFILE",
        userId: "clerk_123",
        role: "user",
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
      });
      mockUpdateApiKeyLastUsed.mockResolvedValueOnce(undefined);

      await handler(createEvent(apiKey), mockContext);

      // Verify getApiKeyByHash was called with the SHA-256 hash of the key
      expect(mockGetApiKeyByHash).toHaveBeenCalledTimes(1);
      const hashArg = mockGetApiKeyByHash.mock.calls[0][1];
      // Hash should be a hex string (64 chars for SHA-256)
      expect(hashArg).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe("AC2: APIKEY found + not revoked → fetch PROFILE, check suspension", () => {
    it("fetches profile after finding valid API key", async () => {
      mockGetApiKeyByHash.mockResolvedValueOnce({
        PK: "USER#clerk_123",
        SK: "APIKEY#key_abc",
        userId: "clerk_123",
        keyId: "key_abc",
        keyHash: "hash",
        name: "My Key",
        scopes: ["*"],
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
      });
      mockGetProfile.mockResolvedValueOnce({
        PK: "USER#clerk_123",
        SK: "PROFILE",
        userId: "clerk_123",
        role: "user",
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
      });
      mockUpdateApiKeyLastUsed.mockResolvedValueOnce(undefined);

      await handler(createEvent("valid-key"), mockContext);

      expect(mockGetProfile).toHaveBeenCalledWith(
        expect.anything(),
        "clerk_123",
        expect.anything()
      );
    });
  });

  describe("AC3: Profile not suspended → IAM Allow with context", () => {
    it("returns Allow with userId, role, scopes, authMethod in context", async () => {
      mockGetApiKeyByHash.mockResolvedValueOnce({
        PK: "USER#clerk_123",
        SK: "APIKEY#key_abc",
        userId: "clerk_123",
        keyId: "key_abc",
        keyHash: "hash",
        name: "My Key",
        scopes: ["saves:write"],
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
      });
      mockGetProfile.mockResolvedValueOnce({
        PK: "USER#clerk_123",
        SK: "PROFILE",
        userId: "clerk_123",
        role: "analyst",
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
      });
      mockUpdateApiKeyLastUsed.mockResolvedValueOnce(undefined);

      const result = await handler(createEvent("valid-key"), mockContext);

      expect(result.policyDocument.Statement[0].Effect).toBe("Allow");
      expect(result.context).toEqual({
        userId: "clerk_123",
        role: "analyst",
        authMethod: "api-key",
        isApiKey: "true",
        apiKeyId: "key_abc",
        scopes: '["saves:write"]',
      });
    });

    it("returns Allow with wildcard scopes", async () => {
      mockGetApiKeyByHash.mockResolvedValueOnce({
        PK: "USER#clerk_123",
        SK: "APIKEY#key_abc",
        userId: "clerk_123",
        keyId: "key_abc",
        keyHash: "hash",
        name: "Full Access Key",
        scopes: ["*"],
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
      });
      mockGetProfile.mockResolvedValueOnce({
        PK: "USER#clerk_123",
        SK: "PROFILE",
        userId: "clerk_123",
        role: "user",
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
      });
      mockUpdateApiKeyLastUsed.mockResolvedValueOnce(undefined);

      const result = await handler(createEvent("valid-key"), mockContext);

      expect(result.policyDocument.Statement[0].Effect).toBe("Allow");
      expect(result.context?.scopes).toBe('["*"]');
    });
  });

  describe("AC4: Profile suspended → IAM Deny SUSPENDED_ACCOUNT", () => {
    it("returns Deny with SUSPENDED_ACCOUNT when profile is suspended", async () => {
      mockGetApiKeyByHash.mockResolvedValueOnce({
        PK: "USER#clerk_123",
        SK: "APIKEY#key_abc",
        userId: "clerk_123",
        keyId: "key_abc",
        keyHash: "hash",
        name: "My Key",
        scopes: ["*"],
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
      });
      mockGetProfile.mockResolvedValueOnce({
        PK: "USER#clerk_123",
        SK: "PROFILE",
        userId: "clerk_123",
        role: "user",
        suspendedAt: "2026-01-15T00:00:00Z",
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-15T00:00:00Z",
      });

      const result = await handler(createEvent("valid-key"), mockContext);

      expect(result.policyDocument.Statement[0].Effect).toBe("Deny");
      expect(result.context?.errorCode).toBe("SUSPENDED_ACCOUNT");
    });
  });

  describe("AC5: Key not found or revoked → throw Unauthorized (401)", () => {
    it("throws Unauthorized when API key is not found", async () => {
      mockGetApiKeyByHash.mockResolvedValueOnce(null);

      await expect(
        handler(createEvent("nonexistent-key"), mockContext)
      ).rejects.toThrow("Unauthorized");
    });

    it("throws Unauthorized when API key is revoked", async () => {
      mockGetApiKeyByHash.mockResolvedValueOnce({
        PK: "USER#clerk_123",
        SK: "APIKEY#key_abc",
        userId: "clerk_123",
        keyId: "key_abc",
        keyHash: "hash",
        name: "Revoked Key",
        scopes: ["*"],
        revokedAt: "2026-01-15T00:00:00Z",
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-15T00:00:00Z",
      });

      await expect(
        handler(createEvent("revoked-key"), mockContext)
      ).rejects.toThrow("Unauthorized");
    });

    it("throws Unauthorized when no x-api-key header is present", async () => {
      await expect(handler(createEvent(), mockContext)).rejects.toThrow(
        "Unauthorized"
      );
    });

    it("throws Unauthorized when x-api-key header is empty", async () => {
      await expect(handler(createEvent(""), mockContext)).rejects.toThrow(
        "Unauthorized"
      );
    });
  });

  describe("Header case insensitivity (RFC 7230)", () => {
    const validApiKeyItem = {
      PK: "USER#clerk_123",
      SK: "APIKEY#key_abc",
      userId: "clerk_123",
      keyId: "key_abc",
      keyHash: "hash",
      name: "My Key",
      scopes: ["*"] as string[],
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
    };
    const validProfile = {
      PK: "USER#clerk_123",
      SK: "PROFILE",
      userId: "clerk_123",
      role: "user",
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
    };

    it.each([
      ["x-api-key"],
      ["X-Api-Key"],
      ["X-API-Key"],
      ["X-API-KEY"],
      ["x-Api-Key"],
    ])("accepts API key from header with casing: %s", async (headerName) => {
      mockGetApiKeyByHash.mockResolvedValueOnce(validApiKeyItem);
      mockGetProfile.mockResolvedValueOnce(validProfile);
      mockUpdateApiKeyLastUsed.mockResolvedValueOnce(undefined);

      const result = await handler(
        createEvent("valid-key", headerName),
        mockContext
      );

      expect(result.policyDocument.Statement[0].Effect).toBe("Allow");
    });
  });

  describe("AC6: Fire-and-forget updateApiKeyLastUsed", () => {
    it("calls updateApiKeyLastUsed after successful auth", async () => {
      mockGetApiKeyByHash.mockResolvedValueOnce({
        PK: "USER#clerk_123",
        SK: "APIKEY#key_abc",
        userId: "clerk_123",
        keyId: "key_abc",
        keyHash: "hash",
        name: "My Key",
        scopes: ["*"],
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
      });
      mockGetProfile.mockResolvedValueOnce({
        PK: "USER#clerk_123",
        SK: "PROFILE",
        userId: "clerk_123",
        role: "user",
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
      });
      mockUpdateApiKeyLastUsed.mockResolvedValueOnce(undefined);

      await handler(createEvent("valid-key"), mockContext);

      expect(mockUpdateApiKeyLastUsed).toHaveBeenCalledWith(
        expect.anything(),
        "clerk_123",
        "key_abc",
        expect.anything()
      );
    });

    it("does not block auth if updateApiKeyLastUsed fails", async () => {
      mockGetApiKeyByHash.mockResolvedValueOnce({
        PK: "USER#clerk_123",
        SK: "APIKEY#key_abc",
        userId: "clerk_123",
        keyId: "key_abc",
        keyHash: "hash",
        name: "My Key",
        scopes: ["*"],
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
      });
      mockGetProfile.mockResolvedValueOnce({
        PK: "USER#clerk_123",
        SK: "PROFILE",
        userId: "clerk_123",
        role: "user",
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
      });
      // Simulate failure in updateApiKeyLastUsed
      mockUpdateApiKeyLastUsed.mockRejectedValueOnce(
        new Error("DynamoDB error")
      );

      // Auth should still succeed despite updateApiKeyLastUsed failure
      const result = await handler(createEvent("valid-key"), mockContext);

      expect(result.policyDocument.Statement[0].Effect).toBe("Allow");
    });

    it("does not call updateApiKeyLastUsed for failed auth", async () => {
      mockGetApiKeyByHash.mockResolvedValueOnce(null);

      await expect(
        handler(createEvent("nonexistent-key"), mockContext)
      ).rejects.toThrow("Unauthorized");

      expect(mockUpdateApiKeyLastUsed).not.toHaveBeenCalled();
    });
  });

  describe("Profile not found edge case", () => {
    it("throws Unauthorized when profile is not found for valid API key", async () => {
      mockGetApiKeyByHash.mockResolvedValueOnce({
        PK: "USER#clerk_123",
        SK: "APIKEY#key_abc",
        userId: "clerk_123",
        keyId: "key_abc",
        keyHash: "hash",
        name: "My Key",
        scopes: ["*"],
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
      });
      mockGetProfile.mockResolvedValueOnce(null);

      await expect(
        handler(createEvent("valid-key"), mockContext)
      ).rejects.toThrow("Unauthorized");
    });
  });

  describe("Policy generation", () => {
    it("generates correct Allow policy document", async () => {
      mockGetApiKeyByHash.mockResolvedValueOnce({
        PK: "USER#clerk_123",
        SK: "APIKEY#key_abc",
        userId: "clerk_123",
        keyId: "key_abc",
        keyHash: "hash",
        name: "My Key",
        scopes: ["*"],
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
      });
      mockGetProfile.mockResolvedValueOnce({
        PK: "USER#clerk_123",
        SK: "PROFILE",
        userId: "clerk_123",
        role: "user",
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
      });
      mockUpdateApiKeyLastUsed.mockResolvedValueOnce(undefined);

      const result = await handler(createEvent("valid-key"), mockContext);

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

    it("generates correct Deny policy document", async () => {
      mockGetApiKeyByHash.mockResolvedValueOnce({
        PK: "USER#clerk_123",
        SK: "APIKEY#key_abc",
        userId: "clerk_123",
        keyId: "key_abc",
        keyHash: "hash",
        name: "My Key",
        scopes: ["*"],
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
      });
      mockGetProfile.mockResolvedValueOnce({
        PK: "USER#clerk_123",
        SK: "PROFILE",
        userId: "clerk_123",
        role: "user",
        suspendedAt: "2026-01-15T00:00:00Z",
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-15T00:00:00Z",
      });

      const result = await handler(createEvent("valid-key"), mockContext);

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

  describe("Authorizer cache TTL", () => {
    it("exports AUTHORIZER_CACHE_TTL = 300", async () => {
      const { AUTHORIZER_CACHE_TTL } = await import("./handler.js");
      expect(AUTHORIZER_CACHE_TTL).toBe(300);
    });
  });

  describe("SHA-256 hashing consistency", () => {
    it("produces consistent hash for the same API key", async () => {
      const apiKey = "consistent-test-key";

      // Call twice with same key — use mockResolvedValueOnce to avoid leaking state
      mockGetApiKeyByHash.mockResolvedValueOnce(null);
      mockGetApiKeyByHash.mockResolvedValueOnce(null);

      await expect(handler(createEvent(apiKey), mockContext)).rejects.toThrow();
      await expect(handler(createEvent(apiKey), mockContext)).rejects.toThrow();

      const hash1 = mockGetApiKeyByHash.mock.calls[0][1];
      const hash2 = mockGetApiKeyByHash.mock.calls[1][1];
      expect(hash1).toBe(hash2);
    });
  });
});
