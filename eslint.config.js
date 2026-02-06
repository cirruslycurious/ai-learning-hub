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
      "cdk.out/",
      "build/",
      "coverage/",
      "_bmad/",
      "_bmad-output/",
      ".claude/",
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
