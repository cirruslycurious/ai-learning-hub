/**
 * Tests for SSM utility functions (getClerkSecretKey, resetClerkSecretKeyCache)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock @aws-sdk/client-ssm
const mockSend = vi.fn();
vi.mock("@aws-sdk/client-ssm", () => ({
  SSMClient: vi.fn(() => ({ send: mockSend })),
  GetParameterCommand: vi.fn((params: Record<string, unknown>) => params),
}));

import { getClerkSecretKey, resetClerkSecretKeyCache } from "../src/ssm.js";

describe("SSM utilities", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetClerkSecretKeyCache();
    process.env.CLERK_SECRET_KEY_PARAM = "/ai-learning-hub/clerk-secret-key";
  });

  describe("getClerkSecretKey", () => {
    it("fetches secret key from SSM Parameter Store", async () => {
      mockSend.mockResolvedValueOnce({
        Parameter: { Value: "sk_test_secret_123" },
      });

      const key = await getClerkSecretKey();

      expect(key).toBe("sk_test_secret_123");
      expect(mockSend).toHaveBeenCalledTimes(1);
    });

    it("caches the key on subsequent calls", async () => {
      mockSend.mockResolvedValueOnce({
        Parameter: { Value: "sk_test_cached" },
      });

      const key1 = await getClerkSecretKey();
      const key2 = await getClerkSecretKey();

      expect(key1).toBe("sk_test_cached");
      expect(key2).toBe("sk_test_cached");
      expect(mockSend).toHaveBeenCalledTimes(1);
    });

    it("throws when CLERK_SECRET_KEY_PARAM env var is not set", async () => {
      delete process.env.CLERK_SECRET_KEY_PARAM;

      await expect(getClerkSecretKey()).rejects.toThrow(
        "CLERK_SECRET_KEY_PARAM environment variable is not set"
      );
    });

    it("throws when SSM parameter value is empty", async () => {
      mockSend.mockResolvedValueOnce({
        Parameter: { Value: undefined },
      });

      await expect(getClerkSecretKey()).rejects.toThrow(
        "Clerk secret key not found in SSM"
      );
    });

    it("throws when SSM Parameter is null", async () => {
      mockSend.mockResolvedValueOnce({
        Parameter: null,
      });

      await expect(getClerkSecretKey()).rejects.toThrow(
        "Clerk secret key not found in SSM"
      );
    });
  });

  describe("resetClerkSecretKeyCache", () => {
    it("clears the cached key, forcing a new SSM fetch", async () => {
      mockSend.mockResolvedValueOnce({
        Parameter: { Value: "sk_test_first" },
      });
      mockSend.mockResolvedValueOnce({
        Parameter: { Value: "sk_test_second" },
      });

      const key1 = await getClerkSecretKey();
      expect(key1).toBe("sk_test_first");

      resetClerkSecretKeyCache();

      const key2 = await getClerkSecretKey();
      expect(key2).toBe("sk_test_second");
      expect(mockSend).toHaveBeenCalledTimes(2);
    });
  });
});
