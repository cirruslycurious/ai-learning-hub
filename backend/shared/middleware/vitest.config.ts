import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@ai-learning-hub/types": path.join(
        __dirname,
        "..",
        "types",
        "src",
        "index.ts"
      ),
      "@ai-learning-hub/logging": path.join(
        __dirname,
        "..",
        "logging",
        "src",
        "index.ts"
      ),
      "@ai-learning-hub/validation": path.join(
        __dirname,
        "..",
        "validation",
        "src",
        "index.ts"
      ),
    },
  },
  test: {
    globals: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.ts", "src/**/*.d.ts"],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
  },
});
