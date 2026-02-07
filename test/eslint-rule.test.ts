import { describe, it, expect } from "vitest";
import { ESLint } from "eslint";

describe("ESLint Shared Import Rule", () => {
  it("should enforce shared library imports in Lambda handlers", async () => {
    const eslint = new ESLint({
      overrideConfigFile: "./eslint.config.js",
    });

    // Test that the rule is loaded for Lambda handler paths
    // Note: Using pattern-based path validation; actual handler files created per story
    const config = await eslint.calculateConfigForFile(
      "backend/functions/saves/handler.ts"
    );

    expect(config.rules).toHaveProperty("local-rules/enforce-shared-imports");
    // ESLint represents "error" as 2
    expect(config.rules["local-rules/enforce-shared-imports"]).toEqual([2]);
  });

  it("should have the custom rule configured for all Lambda paths", async () => {
    const eslint = new ESLint({
      overrideConfigFile: "./eslint.config.js",
    });

    // Test another Lambda path pattern to validate config applies to backend/functions/**
    const configs = await eslint.calculateConfigForFile(
      "backend/functions/content/create.ts"
    );

    // Verify the rule is enabled for Lambda files
    expect(configs.rules).toHaveProperty("local-rules/enforce-shared-imports");
  });
});
