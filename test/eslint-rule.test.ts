import { describe, it, expect } from "vitest";
import { ESLint } from "eslint";

describe("ESLint Shared Import Rule", () => {
  it("should enforce shared library imports in Lambda handlers", async () => {
    const eslint = new ESLint({
      overrideConfigFile: "./eslint.config.js",
    });

    // Test that the rule is loaded
    const config = await eslint.calculateConfigForFile(
      "backend/functions/test/handler.ts"
    );

    expect(config.rules).toHaveProperty("local-rules/enforce-shared-imports");
    // ESLint represents "error" as 2
    expect(config.rules["local-rules/enforce-shared-imports"]).toEqual([2]);
  });

  it("should have the custom rule configured", async () => {
    const eslint = new ESLint({
      overrideConfigFile: "./eslint.config.js",
    });

    const configs = await eslint.calculateConfigForFile(
      "backend/functions/saves/create.ts"
    );

    // Verify the rule is enabled for Lambda files
    expect(configs.rules).toHaveProperty("local-rules/enforce-shared-imports");
  });
});
