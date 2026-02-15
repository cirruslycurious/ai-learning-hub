/**
 * Tests for user profile database operations
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getProfile,
  ensureProfile,
  getApiKeyByHash,
  updateApiKeyLastUsed,
  USERS_TABLE_CONFIG,
  type ApiKeyItem,
} from "../src/users.js";

// Mock the DynamoDB helpers
vi.mock("../src/helpers.js", () => ({
  getItem: vi.fn(),
  putItem: vi.fn(),
  queryItems: vi.fn(),
  updateItem: vi.fn(),
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

import { getItem, putItem, queryItems, updateItem } from "../src/helpers.js";

const mockGetItem = vi.mocked(getItem);
const mockPutItem = vi.mocked(putItem);
const mockQueryItems = vi.mocked(queryItems);
const mockUpdateItem = vi.mocked(updateItem);

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

describe("getApiKeyByHash", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns API key item when found via GSI query", async () => {
    const mockApiKey: ApiKeyItem = {
      PK: "USER#clerk_123",
      SK: "APIKEY#key_abc",
      userId: "clerk_123",
      keyId: "key_abc",
      keyHash: "abc123hash",
      name: "My Key",
      scopes: ["*"],
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
    };

    mockQueryItems.mockResolvedValueOnce({
      items: [mockApiKey],
      hasMore: false,
    });

    const result = await getApiKeyByHash(mockClient, "abc123hash");

    expect(result).toEqual(mockApiKey);
    expect(mockQueryItems).toHaveBeenCalledWith(
      mockClient,
      USERS_TABLE_CONFIG,
      expect.objectContaining({
        indexName: "apiKeyHash-index",
        keyConditionExpression: "keyHash = :keyHash",
        expressionAttributeValues: { ":keyHash": "abc123hash" },
        limit: 1,
      }),
      expect.any(Object)
    );
  });

  it("returns null when no API key found", async () => {
    mockQueryItems.mockResolvedValueOnce({
      items: [],
      hasMore: false,
    });

    const result = await getApiKeyByHash(mockClient, "nonexistent_hash");

    expect(result).toBeNull();
  });

  it("returns API key item with revokedAt when key is revoked", async () => {
    const revokedKey: ApiKeyItem = {
      PK: "USER#clerk_123",
      SK: "APIKEY#key_abc",
      userId: "clerk_123",
      keyId: "key_abc",
      keyHash: "abc123hash",
      name: "Revoked Key",
      scopes: ["*"],
      revokedAt: "2026-01-15T00:00:00Z",
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-15T00:00:00Z",
    };

    mockQueryItems.mockResolvedValueOnce({
      items: [revokedKey],
      hasMore: false,
    });

    const result = await getApiKeyByHash(mockClient, "abc123hash");

    expect(result).toEqual(revokedKey);
    expect(result?.revokedAt).toBe("2026-01-15T00:00:00Z");
  });

  it("propagates errors from queryItems", async () => {
    mockQueryItems.mockRejectedValueOnce(new Error("DynamoDB error"));

    await expect(getApiKeyByHash(mockClient, "abc123hash")).rejects.toThrow(
      "DynamoDB error"
    );
  });
});

describe("updateApiKeyLastUsed", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updates lastUsedAt timestamp for the API key", async () => {
    mockUpdateItem.mockResolvedValueOnce(null);

    await updateApiKeyLastUsed(mockClient, "clerk_123", "key_abc");

    expect(mockUpdateItem).toHaveBeenCalledWith(
      mockClient,
      USERS_TABLE_CONFIG,
      expect.objectContaining({
        key: { PK: "USER#clerk_123", SK: "APIKEY#key_abc" },
        updateExpression: "SET lastUsedAt = :now, updatedAt = :now",
        expressionAttributeValues: {
          ":now": expect.any(String),
        },
      }),
      expect.any(Object)
    );
  });

  it("uses ISO 8601 timestamp format", async () => {
    mockUpdateItem.mockResolvedValueOnce(null);

    await updateApiKeyLastUsed(mockClient, "clerk_123", "key_abc");

    const updateCall = mockUpdateItem.mock.calls[0];
    const values = updateCall[2].expressionAttributeValues as Record<
      string,
      unknown
    >;
    const timestamp = values[":now"] as string;
    // Verify it's a valid ISO 8601 timestamp
    expect(new Date(timestamp).toISOString()).toBe(timestamp);
  });

  it("propagates errors from updateItem", async () => {
    mockUpdateItem.mockRejectedValueOnce(new Error("DynamoDB error"));

    await expect(
      updateApiKeyLastUsed(mockClient, "clerk_123", "key_abc")
    ).rejects.toThrow("DynamoDB error");
  });
});
