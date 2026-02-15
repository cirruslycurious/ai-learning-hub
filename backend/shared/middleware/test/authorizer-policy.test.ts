import { describe, it, expect } from "vitest";
import { generatePolicy, deny } from "../src/authorizer-policy.js";

describe("Authorizer Policy Helpers", () => {
  describe("generatePolicy", () => {
    it("generates an Allow policy document", () => {
      const policy = generatePolicy("Allow");

      expect(policy).toEqual({
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

    it("generates a Deny policy document", () => {
      const policy = generatePolicy("Deny");

      expect(policy).toEqual({
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

    it("uses wildcard Resource for authorizer caching compatibility", () => {
      const policy = generatePolicy("Allow");

      expect(policy.Statement[0].Resource).toBe("*");
    });
  });

  describe("deny", () => {
    it("returns a Deny authorizer result with error code in context", () => {
      const result = deny("user_123", "SUSPENDED_ACCOUNT");

      expect(result.principalId).toBe("user_123");
      expect(result.policyDocument.Statement[0].Effect).toBe("Deny");
      expect(result.context).toEqual({ errorCode: "SUSPENDED_ACCOUNT" });
    });

    it("returns correct structure for INVITE_REQUIRED error", () => {
      const result = deny("clerk_abc", "INVITE_REQUIRED");

      expect(result.principalId).toBe("clerk_abc");
      expect(result.context).toEqual({ errorCode: "INVITE_REQUIRED" });
    });

    it("includes a valid IAM policy document", () => {
      const result = deny("user_123", "SOME_ERROR");

      expect(result.policyDocument.Version).toBe("2012-10-17");
      expect(result.policyDocument.Statement).toHaveLength(1);
      expect(result.policyDocument.Statement[0].Action).toBe(
        "execute-api:Invoke"
      );
    });
  });
});
