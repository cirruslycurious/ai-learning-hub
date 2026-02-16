/**
 * Invite code database operations tests
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { AppError, ErrorCode } from "@ai-learning-hub/types";
import {
  getInviteCode,
  redeemInviteCode,
  createInviteCode,
  listInviteCodesByUser,
  toPublicInviteCode,
  type InviteCodeItem,
} from "../src/invite-codes.js";

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

// Mock the helpers module
const mockGetItem = vi.fn();
const mockUpdateItem = vi.fn();
const mockPutItem = vi.fn();
const mockQueryItems = vi.fn();

vi.mock("../src/helpers.js", () => ({
  getItem: (...args: unknown[]) => mockGetItem(...args),
  updateItem: (...args: unknown[]) => mockUpdateItem(...args),
  putItem: (...args: unknown[]) => mockPutItem(...args),
  queryItems: (...args: unknown[]) => mockQueryItems(...args),
}));

const mockClient = {} as DynamoDBDocumentClient;

describe("invite-codes DB operations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getInviteCode", () => {
    it("returns invite code item when found", async () => {
      const expected = {
        PK: "CODE#ABCD1234",
        SK: "META",
        code: "ABCD1234",
        generatedBy: "user_gen",
        generatedAt: "2026-01-01T00:00:00Z",
      };
      mockGetItem.mockResolvedValueOnce(expected);

      const result = await getInviteCode(mockClient, "ABCD1234");

      expect(result).toEqual(expected);
      expect(mockGetItem).toHaveBeenCalledWith(
        mockClient,
        expect.objectContaining({
          tableName: expect.any(String),
        }),
        { PK: "CODE#ABCD1234", SK: "META" },
        expect.anything()
      );
    });

    it("returns null when code not found", async () => {
      mockGetItem.mockResolvedValueOnce(null);

      const result = await getInviteCode(mockClient, "NOTFOUND1");

      expect(result).toBeNull();
    });
  });

  describe("redeemInviteCode", () => {
    it("updates code with redeemedBy and redeemedAt", async () => {
      const redeemed = {
        PK: "CODE#VALIDCODE",
        SK: "META",
        code: "VALIDCODE",
        generatedBy: "user_gen",
        generatedAt: "2026-01-01T00:00:00Z",
        redeemedBy: "user_new",
        redeemedAt: "2026-02-15T00:00:00Z",
      };
      mockUpdateItem.mockResolvedValueOnce(redeemed);

      const result = await redeemInviteCode(
        mockClient,
        "VALIDCODE",
        "user_new"
      );

      expect(result).toEqual(redeemed);
      expect(mockUpdateItem).toHaveBeenCalledWith(
        mockClient,
        expect.objectContaining({ tableName: expect.any(String) }),
        expect.objectContaining({
          key: { PK: "CODE#VALIDCODE", SK: "META" },
          updateExpression: expect.stringContaining("redeemedBy"),
          conditionExpression: expect.stringContaining("attribute_exists(PK)"),
        }),
        expect.anything()
      );
    });

    it("throws when updateItem returns null", async () => {
      mockUpdateItem.mockResolvedValueOnce(null);

      await expect(
        redeemInviteCode(mockClient, "BADCODE12", "user_new")
      ).rejects.toThrow("Failed to redeem invite code");
    });
  });

  describe("createInviteCode", () => {
    it("creates an invite code with correct PK format", async () => {
      mockPutItem.mockResolvedValueOnce(undefined);

      const result = await createInviteCode(mockClient, "user_123");

      expect(result.code).toMatch(/^[A-Za-z0-9]{16}$/);
      expect(result.generatedAt).toBeDefined();
      expect(result.expiresAt).toBeDefined();
      expect(mockPutItem).toHaveBeenCalledWith(
        mockClient,
        expect.objectContaining({ tableName: expect.any(String) }),
        expect.objectContaining({
          PK: expect.stringMatching(/^CODE#[A-Za-z0-9]{16}$/),
          SK: "META",
          generatedBy: "user_123",
        }),
        { conditionExpression: "attribute_not_exists(PK)" },
        expect.anything()
      );
    });

    it("generates strictly alphanumeric 16-char codes", async () => {
      mockPutItem.mockResolvedValue(undefined);

      // Generate a few codes and verify format
      for (let i = 0; i < 5; i++) {
        const result = await createInviteCode(mockClient, "user_123");
        expect(result.code).toMatch(/^[A-Za-z0-9]{16}$/);
        expect(result.code).toHaveLength(16);
      }
    });

    it("retries once on collision (ConditionalCheckFailedException)", async () => {
      expect.assertions(2);
      mockPutItem
        .mockRejectedValueOnce(
          new AppError(ErrorCode.CONFLICT, "Item already exists")
        )
        .mockResolvedValueOnce(undefined);

      const result = await createInviteCode(mockClient, "user_123");

      expect(result.code).toMatch(/^[A-Za-z0-9]{16}$/);
      expect(mockPutItem).toHaveBeenCalledTimes(2);
    });

    it("throws INTERNAL_ERROR after two collision failures", async () => {
      expect.assertions(2);
      mockPutItem
        .mockRejectedValueOnce(
          new AppError(ErrorCode.CONFLICT, "Item already exists")
        )
        .mockRejectedValueOnce(
          new AppError(ErrorCode.CONFLICT, "Item already exists")
        );

      await expect(createInviteCode(mockClient, "user_123")).rejects.toThrow(
        "Failed to generate invite code"
      );
      expect(mockPutItem).toHaveBeenCalledTimes(2);
    });

    it("re-throws non-CONFLICT errors without retry", async () => {
      expect.assertions(2);
      mockPutItem.mockRejectedValueOnce(
        new AppError(ErrorCode.INTERNAL_ERROR, "Database operation failed")
      );

      await expect(createInviteCode(mockClient, "user_123")).rejects.toThrow(
        "Database operation failed"
      );
      expect(mockPutItem).toHaveBeenCalledTimes(1);
    });

    it("sets expiresAt to 7 days from now", async () => {
      mockPutItem.mockResolvedValueOnce(undefined);

      const before = new Date();
      const result = await createInviteCode(mockClient, "user_123");
      const after = new Date();

      const expiresAt = new Date(result.expiresAt);
      const generatedAt = new Date(result.generatedAt);
      const diffMs = expiresAt.getTime() - generatedAt.getTime();
      const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

      expect(diffMs).toBe(sevenDaysMs);
      expect(generatedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(generatedAt.getTime()).toBeLessThanOrEqual(after.getTime());
    });
  });

  describe("listInviteCodesByUser", () => {
    it("queries generatedBy-index GSI with correct params", async () => {
      mockQueryItems.mockResolvedValueOnce({
        items: [],
        hasMore: false,
      });

      await listInviteCodesByUser(mockClient, "user_123");

      expect(mockQueryItems).toHaveBeenCalledWith(
        mockClient,
        expect.objectContaining({ tableName: expect.any(String) }),
        expect.objectContaining({
          keyConditionExpression: "generatedBy = :userId",
          expressionAttributeValues: { ":userId": "user_123" },
          indexName: "generatedBy-index",
        }),
        expect.anything()
      );
    });

    it("forwards pagination params (limit and cursor)", async () => {
      mockQueryItems.mockResolvedValueOnce({
        items: [],
        hasMore: false,
      });

      await listInviteCodesByUser(mockClient, "user_123", 5, "some-cursor");

      expect(mockQueryItems).toHaveBeenCalledWith(
        mockClient,
        expect.anything(),
        expect.objectContaining({
          limit: 5,
          cursor: "some-cursor",
        }),
        expect.anything()
      );
    });

    it("sorts items in-memory by generatedAt descending (newest first)", async () => {
      mockQueryItems.mockResolvedValueOnce({
        items: [
          {
            code: "OLD",
            generatedBy: "user_123",
            generatedAt: "2026-01-01T00:00:00Z",
            PK: "CODE#OLD",
            SK: "META",
          },
          {
            code: "NEW",
            generatedBy: "user_123",
            generatedAt: "2026-02-15T00:00:00Z",
            PK: "CODE#NEW",
            SK: "META",
          },
          {
            code: "MID",
            generatedBy: "user_123",
            generatedAt: "2026-01-15T00:00:00Z",
            PK: "CODE#MID",
            SK: "META",
          },
        ],
        hasMore: false,
      });

      const result = await listInviteCodesByUser(mockClient, "user_123");

      expect(result.items[0].code).toBe("NEW");
      expect(result.items[1].code).toBe("MID");
      expect(result.items[2].code).toBe("OLD");
    });

    it("returns hasMore and nextCursor from query", async () => {
      mockQueryItems.mockResolvedValueOnce({
        items: [
          {
            code: "A",
            generatedBy: "user_123",
            generatedAt: "2026-01-01T00:00:00Z",
            PK: "CODE#A",
            SK: "META",
          },
        ],
        hasMore: true,
        nextCursor: "next-cursor-token",
      });

      const result = await listInviteCodesByUser(mockClient, "user_123", 1);

      expect(result.hasMore).toBe(true);
      expect(result.nextCursor).toBe("next-cursor-token");
    });
  });

  describe("toPublicInviteCode", () => {
    const baseItem: InviteCodeItem = {
      PK: "CODE#AbCdEfGh12345678",
      SK: "META",
      code: "AbCdEfGh12345678",
      generatedBy: "user_123",
      generatedAt: "2026-02-10T00:00:00Z",
      expiresAt: "2026-02-17T00:00:00Z",
    };

    it("returns status 'active' for unredeemed, unexpired, unrevoked code", () => {
      const futureItem = { ...baseItem, expiresAt: "2099-12-31T00:00:00Z" };
      const result = toPublicInviteCode(futureItem);

      expect(result.status).toBe("active");
      expect(result.code).toBe("AbCdEfGh12345678");
    });

    it("returns status 'redeemed' and masks code when redeemedBy is set", () => {
      const redeemed = {
        ...baseItem,
        expiresAt: "2099-12-31T00:00:00Z",
        redeemedBy: "user_456",
        redeemedAt: "2026-02-11T00:00:00Z",
      };
      const result = toPublicInviteCode(redeemed);

      expect(result.status).toBe("redeemed");
      expect(result.code).toBe("AbCd****");
      expect(result.redeemedAt).toBe("2026-02-11T00:00:00Z");
    });

    it("returns status 'expired' when expiresAt is in the past", () => {
      const expired = { ...baseItem, expiresAt: "2020-01-01T00:00:00Z" };
      const result = toPublicInviteCode(expired);

      expect(result.status).toBe("expired");
      expect(result.code).toBe("AbCdEfGh12345678");
    });

    it("returns status 'revoked' when isRevoked is true", () => {
      const revoked = {
        ...baseItem,
        expiresAt: "2099-12-31T00:00:00Z",
        isRevoked: true,
      };
      const result = toPublicInviteCode(revoked);

      expect(result.status).toBe("revoked");
    });

    it("prioritizes 'revoked' over 'expired'", () => {
      const revokedAndExpired = {
        ...baseItem,
        expiresAt: "2020-01-01T00:00:00Z",
        isRevoked: true,
      };
      const result = toPublicInviteCode(revokedAndExpired);

      expect(result.status).toBe("revoked");
    });

    it("prioritizes 'revoked' over 'redeemed'", () => {
      const revokedAndRedeemed = {
        ...baseItem,
        expiresAt: "2099-12-31T00:00:00Z",
        redeemedBy: "user_456",
        isRevoked: true,
      };
      const result = toPublicInviteCode(revokedAndRedeemed);

      expect(result.status).toBe("revoked");
    });

    it("prioritizes 'redeemed' over 'expired'", () => {
      const redeemedAndExpired = {
        ...baseItem,
        expiresAt: "2020-01-01T00:00:00Z",
        redeemedBy: "user_456",
        redeemedAt: "2026-02-11T00:00:00Z",
      };
      const result = toPublicInviteCode(redeemedAndExpired);

      expect(result.status).toBe("redeemed");
    });

    it("includes generatedAt and expiresAt in output", () => {
      const item = { ...baseItem, expiresAt: "2099-12-31T00:00:00Z" };
      const result = toPublicInviteCode(item);

      expect(result.generatedAt).toBe("2026-02-10T00:00:00Z");
      expect(result.expiresAt).toBe("2099-12-31T00:00:00Z");
    });
  });
});
