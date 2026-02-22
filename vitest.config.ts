import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      // No thresholds at root level — root tests are meta-tests (hooks, CI,
      // eslint rules) with no traditional source files to cover.
      // Each workspace enforces its own 80% coverage thresholds.
      exclude: [
        "node_modules/**",
        "dist/**",
        "**/*.config.{js,ts}",
        "**/*.d.ts",
        "test/**",
        "scripts/**",
        "coverage/**",
        "frontend/**",
        "backend/**",
        "infra/**",
        ".claude/**",
        "test-venv/**",
      ],
    },
  },
});
