import js from "@eslint/js";
import tseslint from "typescript-eslint";
import security from "eslint-plugin-security";
import enforceSharedImports from "./scripts/eslint-rules/enforce-shared-imports.js";

export default tseslint.config(
  {
    ignores: [
      "node_modules/",
      "dist/",
      "**/dist/",
      "**/dist-node/",
      "**/cdk.out/",
      "build/",
      "coverage/",
      "_bmad/",
      "_bmad-output/",
      ".claude/",
      ".venv/",
      "test-venv/",
      "scripts/lib/",
      "scripts/tests/",
      // Ignore TypeScript build artifacts that may appear in src/ dirs
      "**/*.d.ts",
      "**/*.d.ts.map",
      "backend/shared/**/src/**/*.js",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  security.configs.recommended,
  {
    files: ["scripts/**/*.mjs"],
    languageOptions: {
      globals: { process: "readonly" },
    },
  },
  {
    files: ["**/*.ts", "**/*.tsx", "**/*.js", "**/*.cjs"],
    languageOptions: {
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        // Type-aware linting (parserOptions.projectService) deferred: requires
        // all config/test files to be in tsconfig or allowDefaultProject setup.
      },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      // Disable noisy security rules that produce only false positives in this project:
      // - detect-non-literal-fs-filename: flags test fixtures & build scripts reading files
      //   by variable path. No user-controlled paths exist in Lambda handlers.
      // - detect-object-injection: flags obj[key] which is idiomatic JS. All inputs are
      //   validated via Zod schemas before reaching these code paths.
      "security/detect-non-literal-fs-filename": "off",
      "security/detect-object-injection": "off",
    },
  },
  {
    // Enforce shared library usage in Lambda handlers
    files: ["backend/functions/**/*.ts", "backend/functions/**/*.js"],
    plugins: {
      "local-rules": {
        rules: {
          "enforce-shared-imports": enforceSharedImports,
        },
      },
    },
    rules: {
      "local-rules/enforce-shared-imports": "error",
    },
  }
);
