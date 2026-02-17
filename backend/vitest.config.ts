import { defineConfig } from "vitest/config";

// Applies to backend/functions/** handler code (shared packages have their own configs)
export default defineConfig({
  test: {
    include: [
      "test/**/*.test.ts",
      "functions/**/*.test.ts",
      "test-utils/**/*.test.ts",
    ],
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
        "coverage/**",
        "shared/**", // Exclude shared packages - they have their own coverage
        "functions/**/*.test.ts", // Exclude test files from coverage
        "**/*.config.{js,ts}",
        "**/*.d.ts",
        "test/**",
        "test-utils/**",
      ],
    },
  },
});
