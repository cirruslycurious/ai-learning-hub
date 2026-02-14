import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts", "functions/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      // Backend workspace is a container - no source code at this level
      // Actual code coverage is in backend/shared/* packages
      // Set low threshold since only placeholder tests exist here
      thresholds: {
        lines: 0,
        functions: 0,
        branches: 0,
        statements: 0,
      },
      exclude: [
        "node_modules/**",
        "dist/**",
        "coverage/**",
        "shared/**", // Exclude shared packages - they have their own coverage
        "functions/**/*.test.ts", // Exclude test files from coverage
        "**/*.config.{js,ts}",
        "**/*.d.ts",
        "test/**",
      ],
    },
  },
});
