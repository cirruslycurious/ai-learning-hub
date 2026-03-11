import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@ai-learning-hub/types": path.resolve(
        __dirname,
        "../backend/shared/types/src"
      ),
      "@": path.resolve(__dirname, "src"),
    },
  },
  define: {
    "import.meta.env.VITE_API_URL": JSON.stringify(
      "http://localhost:3000/test"
    ),
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./test/setup.ts"],
    include: ["test/**/*.test.{ts,tsx}"],
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
        "**/*.config.{js,ts}",
        "**/*.d.ts",
        "test/**",
        // App entry points - integration tested, not unit tested
        "src/main.tsx",
        // UI components & pages — tested via integration/e2e (Epic 4+)
        "src/components/**",
        "src/pages/**",
        "src/hooks/**",
        "src/lib/store.tsx",
        "src/lib/mock-data.ts",
        "src/lib/types.ts",
        // React Query hooks — need integration tests with mock API
        "src/api/saves.ts",
        "src/api/auth.ts",
        "src/api/index.ts",
      ],
    },
  },
});
