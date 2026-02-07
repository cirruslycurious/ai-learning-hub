import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
      exclude: [
        "node_modules/**",
        "dist/**",
        "cdk.out/**",
        "**/*.config.{js,ts}",
        "**/*.d.ts",
        "test/**",
        // CDK app entry point - integration tested via CDK synth, not unit tested
        "bin/app.ts",
      ],
    },
  },
});
