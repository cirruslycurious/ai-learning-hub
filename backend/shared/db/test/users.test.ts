/**
 * Tests for user profile database operations
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { getProfile, ensureProfile, USERS_TABLE_CONFIG } from "../src/users.js";

// Mock the DynamoDB helpers
vi.mock("../src/helpers.js", () => ({
  getItem: vi.fn(),
  putItem: vi.fn(),
}));

// Mock the logging module
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

import { getItem, putItem } from "../src/helpers.js";

const mockGetItem = vi.mocked(getItem);
const mockPutItem = vi.mocked(putItem);

// Mock DynamoDB client
const mockClient =
  {} as unknown as import("@aws-sdk/lib-dynamodb").DynamoDBDocumentClient;

describe("USERS_TABLE_CONFIG", () => {
  it("uses USERS_TABLE_NAME env var with fallback", () => {
    expect(USERS_TABLE_CONFIG.tableName).toBeDefined();
    expect(USERS_TABLE_CONFIG.partitionKey).toBe("PK");
    expect(USERS_TABLE_CONFIG.sortKey).toBe("SK");
  });
});

describe("getProfile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns profile when it exists", async () => {
    const mockProfile = {
      PK: "USER#clerk_123",
      SK: "PROFILE",
      userId: "clerk_123",
      email: "user@example.com",
      displayName: "Test User",
      role: "user",
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
    };

    mockGetItem.mockResolvedValueOnce(mockProfile);

    const result = await getProfile(mockClient, "clerk_123");

    expect(result).toEqual(mockProfile);
    expect(mockGetItem).toHaveBeenCalledWith(
      mockClient,
      USERS_TABLE_CONFIG,
      { PK: "USER#clerk_123", SK: "PROFILE" },
      expect.any(Object)
    );
  });

  it("returns null when profile does not exist", async () => {
    mockGetItem.mockResolvedValueOnce(null);

    const result = await getProfile(mockClient, "clerk_nonexistent");

    expect(result).toBeNull();
    expect(mockGetItem).toHaveBeenCalledWith(
      mockClient,
      USERS_TABLE_CONFIG,
      { PK: "USER#clerk_nonexistent", SK: "PROFILE" },
      expect.any(Object)
    );
  });

  it("propagates errors from getItem", async () => {
    mockGetItem.mockRejectedValueOnce(new Error("DynamoDB error"));

    await expect(getProfile(mockClient, "clerk_123")).rejects.toThrow(
      "DynamoDB error"
    );
  });
});

describe("ensureProfile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates profile on first auth (conditional PutItem succeeds)", async () => {
    mockPutItem.mockResolvedValueOnce(undefined);

    await ensureProfile(mockClient, "clerk_123", {
      email: "user@example.com",
      displayName: "Test User",
      role: "user",
    });

    expect(mockPutItem).toHaveBeenCalledWith(
      mockClient,
      USERS_TABLE_CONFIG,
      expect.objectContaining({
        PK: "USER#clerk_123",
        SK: "PROFILE",
        userId: "clerk_123",
        email: "user@example.com",
        displayName: "Test User",
        role: "user",
      }),
      { conditionExpression: "attribute_not_exists(PK)" },
      expect.any(Object)
    );

    // Verify timestamps are set
    const putCall = mockPutItem.mock.calls[0];
    const item = putCall[2] as Record<string, unknown>;
    expect(item.createdAt).toBeDefined();
    expect(item.updatedAt).toBeDefined();
  });

  it("silently succeeds when profile already exists (ConditionalCheckFailed)", async () => {
    // The putItem helper throws AppError with CONFLICT code on ConditionalCheckFailedException
    const { AppError, ErrorCode } = await import("@ai-learning-hub/types");
    mockPutItem.mockRejectedValueOnce(
      new AppError(ErrorCode.CONFLICT, "Item already exists")
    );

    // Should NOT throw — swallows the conflict error
    await expect(
      ensureProfile(mockClient, "clerk_123", {
        email: "user@example.com",
      })
    ).resolves.toBeUndefined();
  });

  it("propagates non-conflict errors", async () => {
    const { AppError, ErrorCode } = await import("@ai-learning-hub/types");
    mockPutItem.mockRejectedValueOnce(
      new AppError(ErrorCode.INTERNAL_ERROR, "Database operation failed")
    );

    await expect(
      ensureProfile(mockClient, "clerk_123", {
        email: "user@example.com",
      })
    ).rejects.toThrow("Database operation failed");
  });

  it("defaults role to 'user' when not provided", async () => {
    mockPutItem.mockResolvedValueOnce(undefined);

    await ensureProfile(mockClient, "clerk_456", {
      email: "other@example.com",
    });

    const putCall = mockPutItem.mock.calls[0];
    const item = putCall[2] as Record<string, unknown>;
    expect(item.role).toBe("user");
  });

  it("uses provided displayName and role", async () => {
    mockPutItem.mockResolvedValueOnce(undefined);

    await ensureProfile(mockClient, "clerk_789", {
      email: "admin@example.com",
      displayName: "Admin User",
      role: "admin",
    });

    const putCall = mockPutItem.mock.calls[0];
    const item = putCall[2] as Record<string, unknown>;
    expect(item.displayName).toBe("Admin User");
    expect(item.role).toBe("admin");
  });
});
