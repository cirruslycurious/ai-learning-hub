/**
 * Invite code database operations tests
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { getInviteCode, redeemInviteCode } from "../src/invite-codes.js";

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

vi.mock("../src/helpers.js", () => ({
  getItem: (...args: unknown[]) => mockGetItem(...args),
  updateItem: (...args: unknown[]) => mockUpdateItem(...args),
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
});
