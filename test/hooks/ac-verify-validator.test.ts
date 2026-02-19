import { describe, it, expect } from "vitest";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  validateACVerification,
} = require("../../.claude/hooks/ac-verify-validator.cjs");

describe("validateACVerification", () => {
  it("PASS when all ACs have implFile, testFile, behaviorType='real'", () => {
    const result = validateACVerification([
      {
        criterion: "Returns 401 for invalid JWT",
        implFile: "backend/functions/auth/handler.ts",
        testFile: "backend/functions/auth/handler.test.ts",
        behaviorType: "real",
      },
    ]);
    expect(result.pass).toBe(true);
    expect(result.failures).toEqual([]);
  });

  it("FAIL when AC missing implFile", () => {
    const result = validateACVerification([
      {
        criterion: "Returns 401 for invalid JWT",
        testFile: "auth/handler.test.ts",
        behaviorType: "real",
      },
    ]);
    expect(result.pass).toBe(false);
    expect(result.failures).toEqual(
      expect.arrayContaining([
        expect.stringContaining("missing implementation file"),
      ])
    );
  });

  it("FAIL when AC missing testFile", () => {
    const result = validateACVerification([
      {
        criterion: "Returns 401 for invalid JWT",
        implFile: "auth/handler.ts",
        behaviorType: "real",
      },
    ]);
    expect(result.pass).toBe(false);
    expect(result.failures).toEqual(
      expect.arrayContaining([expect.stringContaining("missing test file")])
    );
  });

  it("FAIL when AC has behaviorType='mock-only'", () => {
    const result = validateACVerification([
      {
        criterion: "Returns 401 for invalid JWT",
        implFile: "auth/handler.ts",
        testFile: "auth/handler.test.ts",
        behaviorType: "mock-only",
      },
    ]);
    expect(result.pass).toBe(false);
    expect(result.failures).toEqual(
      expect.arrayContaining([
        expect.stringContaining("test exercises mock-only behavior"),
      ])
    );
  });

  it("FAIL when AC has behaviorType='not-verified'", () => {
    const result = validateACVerification([
      {
        criterion: "Logs auth failures",
        implFile: "auth/handler.ts",
        testFile: "auth/handler.test.ts",
        behaviorType: "not-verified",
      },
    ]);
    expect(result.pass).toBe(false);
    expect(result.failures).toEqual(
      expect.arrayContaining([expect.stringContaining("behavior not verified")])
    );
  });

  it("FAIL when acList is empty", () => {
    const result = validateACVerification([]);
    expect(result.pass).toBe(false);
    expect(result.failures).toEqual(
      expect.arrayContaining([
        expect.stringContaining("No acceptance criteria"),
      ])
    );
  });

  it("PASS with multiple ACs all valid", () => {
    const result = validateACVerification([
      {
        criterion: "AC1",
        implFile: "a.ts",
        testFile: "a.test.ts",
        behaviorType: "real",
      },
      {
        criterion: "AC2",
        implFile: "b.ts",
        testFile: "b.test.ts",
        behaviorType: "real",
      },
      {
        criterion: "AC3",
        implFile: "c.ts",
        testFile: "c.test.ts",
        behaviorType: "real",
      },
    ]);
    expect(result.pass).toBe(true);
    expect(result.failures).toEqual([]);
  });

  it("FAIL with mixed valid/invalid, reports all failures", () => {
    const result = validateACVerification([
      {
        criterion: "Valid AC",
        implFile: "a.ts",
        testFile: "a.test.ts",
        behaviorType: "real",
      },
      {
        criterion: "Missing impl",
        testFile: "b.test.ts",
        behaviorType: "real",
      },
      {
        criterion: "Mock only",
        implFile: "c.ts",
        testFile: "c.test.ts",
        behaviorType: "mock-only",
      },
    ]);
    expect(result.pass).toBe(false);
    expect(result.failures).toHaveLength(2);
  });

  it("handles criterion string with special characters", () => {
    const result = validateACVerification([
      {
        criterion: "Returns 200 OK with {items: [...]} shape",
        implFile: "handler.ts",
        testFile: "handler.test.ts",
        behaviorType: "real",
      },
    ]);
    expect(result.pass).toBe(true);
    expect(result.failures).toEqual([]);
  });
});
