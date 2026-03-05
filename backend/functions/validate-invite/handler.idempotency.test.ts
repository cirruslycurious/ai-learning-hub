/**
 * Validate Invite — Idempotency Replay Integration Test (AC11)
 *
 * Tests that the handler export has idempotency middleware properly wired
 * by calling it twice with the same Idempotency-Key and verifying
 * X-Idempotent-Replayed: true on the second response.
 *
 * Uses the REAL @ai-learning-hub/middleware (not mockMiddlewareModule)
 * so the wrapHandler idempotency path is exercised end-to-end.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { APIGatewayProxyEvent, Context } from "aws-lambda";
import type { IdempotencyRecord } from "@ai-learning-hub/types";

// ── Mock @ai-learning-hub/db ────────────────────────────────────────────────
// Must provide all runtime imports used by both the handler and the middleware.
const mockGetIdempotencyRecord = vi.fn();
const mockStoreIdempotencyRecord = vi.fn();
const mockGetInviteCode = vi.fn();
const mockRedeemInviteCode = vi.fn();
const mockRecordEvent = vi.fn();
const mockIncrementAndCheckRateLimit = vi.fn();

vi.mock("@ai-learning-hub/db", () => ({
  getDefaultClient: () => ({}),
  requireEnv: (name: string, fallback: string) => process.env[name] ?? fallback,
  // Idempotency DB functions (used by middleware's idempotency.ts)
  getIdempotencyRecord: (...args: unknown[]) =>
    mockGetIdempotencyRecord(...args),
  storeIdempotencyRecord: (...args: unknown[]) =>
    mockStoreIdempotencyRecord(...args),
  buildIdempotencyPK: (userId: string, key: string) => `IDEMP#${userId}#${key}`,
  // Rate limiting (used by middleware's wrapper.ts)
  incrementAndCheckRateLimit: (...args: unknown[]) =>
    mockIncrementAndCheckRateLimit(...args),
  // Handler-specific DB functions
  getInviteCode: (...args: unknown[]) => mockGetInviteCode(...args),
  redeemInviteCode: (...args: unknown[]) => mockRedeemInviteCode(...args),
  recordEvent: (...args: unknown[]) => mockRecordEvent(...args),
  inviteValidateRateLimit: {
    operation: "invite-validate",
    windowSeconds: 3600,
    limit: () => 5,
  },
}));

// ── Mock @ai-learning-hub/logging ───────────────────────────────────────────
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

// ── Mock @aws-sdk/client-ssm (used by middleware's ssm.ts) ─────────────────
vi.mock("@aws-sdk/client-ssm", () => ({
  SSMClient: class MockSSMClient {
    send() {
      return Promise.resolve({ Parameter: { Value: "sk_test_fake_key" } });
    }
  },
  GetParameterCommand: class MockGetParameterCommand {
    constructor(public input: unknown) {}
  },
}));

// ── Mock @clerk/backend ─────────────────────────────────────────────────────
const mockUpdateUserMetadata = vi.fn().mockResolvedValue({});
vi.mock("@clerk/backend", () => ({
  createClerkClient: () => ({
    users: {
      updateUserMetadata: (...args: unknown[]) =>
        mockUpdateUserMetadata(...args),
    },
  }),
}));

// ── Import handler AFTER all mocks are set up ───────────────────────────────
import { handler } from "./handler.js";
import { resetClerkSecretKeyCache } from "@ai-learning-hub/middleware";

// ── Helpers ─────────────────────────────────────────────────────────────────
function createEvent(
  idempotencyKey: string,
  userId = "user_test_123"
): APIGatewayProxyEvent {
  return {
    httpMethod: "POST",
    path: "/auth/validate-invite",
    body: JSON.stringify({ code: "ABCD1234" }),
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey,
    },
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
      authorizer: {
        userId,
        role: "user",
        authMethod: "jwt",
      },
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

describe("Validate Invite — Idempotency Replay (AC11)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetClerkSecretKeyCache();
    process.env.CLERK_SECRET_KEY_PARAM = "/ai-learning-hub/clerk-secret-key";
    process.env.USERS_TABLE_NAME = "test-users";
  });

  it("second request with same Idempotency-Key returns X-Idempotent-Replayed: true", async () => {
    // Track what gets stored so we can return it on the second call
    let storedRecord: IdempotencyRecord | null = null;

    mockGetIdempotencyRecord.mockImplementation(() =>
      Promise.resolve(storedRecord)
    );
    mockStoreIdempotencyRecord.mockImplementation(
      (_client: unknown, record: IdempotencyRecord) => {
        storedRecord = record;
        return Promise.resolve(true);
      }
    );

    // Rate limiting: allow all requests
    mockIncrementAndCheckRateLimit.mockResolvedValue({
      allowed: true,
      limit: 5,
      current: 1,
    });

    // Handler DB mocks: valid invite code, successful redemption
    mockGetInviteCode.mockResolvedValue({
      PK: "CODE#ABCD1234",
      SK: "META",
      code: "ABCD1234",
      generatedBy: "user_gen",
      generatedAt: "2026-01-01T00:00:00Z",
    });
    mockRedeemInviteCode.mockResolvedValue({
      PK: "CODE#ABCD1234",
      SK: "META",
      code: "ABCD1234",
      generatedBy: "user_gen",
      generatedAt: "2026-01-01T00:00:00Z",
      redeemedBy: "user_test_123",
      redeemedAt: "2026-02-15T00:00:00Z",
    });
    mockRecordEvent.mockResolvedValue(undefined);

    const key = "test-idempotency-key-1";

    // First request — should execute handler normally
    const first = await handler(createEvent(key), mockContext);
    expect(first.statusCode).toBe(200);
    expect(first.headers?.["X-Idempotent-Replayed"]).toBeUndefined();

    // Second request — same Idempotency-Key → should replay
    const second = await handler(createEvent(key), mockContext);
    expect(second.statusCode).toBe(200);
    expect(second.headers?.["X-Idempotent-Replayed"]).toBe("true");

    // Handler should only have executed once (invite code looked up once)
    expect(mockGetInviteCode).toHaveBeenCalledTimes(1);
  });
});
