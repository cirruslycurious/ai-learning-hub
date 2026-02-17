import { describe, it, expect, afterAll } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

/**
 * T6: Shared Library Import Enforcement
 *
 * Validates that handler files in backend/functions/** follow architectural rules:
 * - No direct @aws-sdk/client-dynamodb or @aws-sdk/lib-dynamodb imports (use @ai-learning-hub/db)
 * - No console.log/error/warn/info/debug usage (use @ai-learning-hub/logging)
 * - No direct zod/joi/ajv imports (use @ai-learning-hub/validation)
 *
 * These rules enforce ADR-014 (shared library usage) and project conventions.
 */

const FUNCTIONS_DIR = path.resolve(__dirname, "../functions");

/** Recursively find all .ts files that are not test files */
function findHandlerFiles(dir: string): string[] {
  const files: string[] = [];

  if (!fs.existsSync(dir)) return files;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...findHandlerFiles(fullPath));
    } else if (
      entry.isFile() &&
      entry.name.endsWith(".ts") &&
      !entry.name.endsWith(".test.ts") &&
      !entry.name.endsWith(".d.ts")
    ) {
      files.push(fullPath);
    }
  }

  return files;
}

/** Get relative path from functions dir for readable error messages */
function relPath(filePath: string): string {
  return path.relative(FUNCTIONS_DIR, filePath);
}

interface Violation {
  file: string;
  line: number;
  content: string;
  rule: string;
}

function scanFileForViolations(filePath: string): Violation[] {
  const violations: Violation[] = [];
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n");
  const rel = relPath(filePath);

  let inBlockComment = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;
    const trimmed = line.trim();

    // Track block comment state
    if (inBlockComment) {
      if (trimmed.includes("*/")) {
        inBlockComment = false;
      }
      continue;
    }
    if (trimmed.startsWith("/*")) {
      if (!trimmed.includes("*/")) {
        inBlockComment = true;
      }
      continue;
    }

    // Skip single-line comments
    if (trimmed.startsWith("//") || trimmed.startsWith("*")) continue;

    // Rule 1: No direct DynamoDB SDK imports (ES module or CommonJS)
    if (
      /from\s+["']@aws-sdk\/client-dynamodb["']/.test(line) ||
      /from\s+["']@aws-sdk\/lib-dynamodb["']/.test(line) ||
      /require\s*\(\s*["']@aws-sdk\/client-dynamodb["']\s*\)/.test(line) ||
      /require\s*\(\s*["']@aws-sdk\/lib-dynamodb["']\s*\)/.test(line)
    ) {
      violations.push({
        file: rel,
        line: lineNum,
        content: trimmed,
        rule: "No direct DynamoDB SDK imports — use @ai-learning-hub/db",
      });
    }

    // Rule 2: No console.log/error/warn/info/debug
    if (/\bconsole\.(log|error|warn|info|debug)\b/.test(line)) {
      violations.push({
        file: rel,
        line: lineNum,
        content: trimmed,
        rule: "No console.* usage — use @ai-learning-hub/logging",
      });
    }

    // Rule 3: No direct validation library imports (ES module or CommonJS)
    if (
      /from\s+["']zod["']/.test(line) ||
      /from\s+["']joi["']/.test(line) ||
      /from\s+["']ajv["']/.test(line) ||
      /require\s*\(\s*["']zod["']\s*\)/.test(line) ||
      /require\s*\(\s*["']joi["']\s*\)/.test(line) ||
      /require\s*\(\s*["']ajv["']\s*\)/.test(line)
    ) {
      violations.push({
        file: rel,
        line: lineNum,
        content: trimmed,
        rule: "No direct validation library imports — use @ai-learning-hub/validation",
      });
    }
  }

  return violations;
}

describe("T6: Shared Library Import Enforcement", () => {
  const handlerFiles = findHandlerFiles(FUNCTIONS_DIR);

  it("should find handler files to scan", () => {
    expect(handlerFiles.length).toBeGreaterThan(0);
  });

  it("should not have direct @aws-sdk/client-dynamodb imports in handlers", () => {
    const violations: Violation[] = [];

    for (const file of handlerFiles) {
      const fileViolations = scanFileForViolations(file).filter((v) =>
        v.rule.includes("DynamoDB SDK")
      );
      violations.push(...fileViolations);
    }

    if (violations.length > 0) {
      const messages = violations.map(
        (v) => `  ${v.file}:${v.line} — ${v.content}`
      );
      expect.fail(
        `Direct DynamoDB SDK imports found in handler files:\n${messages.join("\n")}\n\nUse @ai-learning-hub/db instead.`
      );
    }
  });

  it("should not have console.log/error/warn usage in handlers", () => {
    const violations: Violation[] = [];

    for (const file of handlerFiles) {
      const fileViolations = scanFileForViolations(file).filter((v) =>
        v.rule.includes("console")
      );
      violations.push(...fileViolations);
    }

    if (violations.length > 0) {
      const messages = violations.map(
        (v) => `  ${v.file}:${v.line} — ${v.content}`
      );
      expect.fail(
        `console.* usage found in handler files:\n${messages.join("\n")}\n\nUse @ai-learning-hub/logging instead.`
      );
    }
  });

  it("should not have direct validation library imports in handlers", () => {
    const violations: Violation[] = [];

    for (const file of handlerFiles) {
      const fileViolations = scanFileForViolations(file).filter((v) =>
        v.rule.includes("validation library")
      );
      violations.push(...fileViolations);
    }

    if (violations.length > 0) {
      const messages = violations.map(
        (v) => `  ${v.file}:${v.line} — ${v.content}`
      );
      expect.fail(
        `Direct validation library imports found in handler files:\n${messages.join("\n")}\n\nUse @ai-learning-hub/validation instead.`
      );
    }
  });

  it("should pass when all handlers use @ai-learning-hub/* imports", () => {
    const allViolations: Violation[] = [];

    for (const file of handlerFiles) {
      allViolations.push(...scanFileForViolations(file));
    }

    expect(allViolations).toHaveLength(0);
  });
});

describe("T6: Scanner detection verification (negative tests)", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "t6-scanner-"));

  afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function writeTmpFile(name: string, content: string): string {
    const filePath = path.join(tmpDir, name);
    fs.writeFileSync(filePath, content, "utf-8");
    return filePath;
  }

  it("should detect ES module import of @aws-sdk/client-dynamodb", () => {
    const file = writeTmpFile(
      "dynamo-esm.ts",
      'import { DynamoDB } from "@aws-sdk/client-dynamodb";\n'
    );
    const violations = scanFileForViolations(file);
    expect(violations.length).toBe(1);
    expect(violations[0].rule).toContain("DynamoDB SDK");
  });

  it("should detect ES module import of @aws-sdk/lib-dynamodb", () => {
    const file = writeTmpFile(
      "dynamo-lib-esm.ts",
      'import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";\n'
    );
    const violations = scanFileForViolations(file);
    expect(violations.length).toBe(1);
    expect(violations[0].rule).toContain("DynamoDB SDK");
  });

  it("should detect require() of @aws-sdk/client-dynamodb", () => {
    const file = writeTmpFile(
      "dynamo-cjs.ts",
      'const { DynamoDB } = require("@aws-sdk/client-dynamodb");\n'
    );
    const violations = scanFileForViolations(file);
    expect(violations.length).toBe(1);
    expect(violations[0].rule).toContain("DynamoDB SDK");
  });

  it("should detect require() of @aws-sdk/lib-dynamodb", () => {
    const file = writeTmpFile(
      "dynamo-lib-cjs.ts",
      'const { DynamoDBDocumentClient } = require("@aws-sdk/lib-dynamodb");\n'
    );
    const violations = scanFileForViolations(file);
    expect(violations.length).toBe(1);
    expect(violations[0].rule).toContain("DynamoDB SDK");
  });

  it("should detect console.log usage", () => {
    const file = writeTmpFile("console-log.ts", 'console.log("debug info");\n');
    const violations = scanFileForViolations(file);
    expect(violations.length).toBe(1);
    expect(violations[0].rule).toContain("console");
  });

  it("should detect console.error usage", () => {
    const file = writeTmpFile(
      "console-error.ts",
      'console.error("something failed");\n'
    );
    const violations = scanFileForViolations(file);
    expect(violations.length).toBe(1);
    expect(violations[0].rule).toContain("console");
  });

  it("should detect ES module import of zod", () => {
    const file = writeTmpFile("zod-esm.ts", 'import { z } from "zod";\n');
    const violations = scanFileForViolations(file);
    expect(violations.length).toBe(1);
    expect(violations[0].rule).toContain("validation library");
  });

  it("should detect require() of zod", () => {
    const file = writeTmpFile("zod-cjs.ts", 'const { z } = require("zod");\n');
    const violations = scanFileForViolations(file);
    expect(violations.length).toBe(1);
    expect(violations[0].rule).toContain("validation library");
  });

  it("should detect require() of joi", () => {
    const file = writeTmpFile("joi-cjs.ts", 'const Joi = require("joi");\n');
    const violations = scanFileForViolations(file);
    expect(violations.length).toBe(1);
    expect(violations[0].rule).toContain("validation library");
  });

  it("should detect require() of ajv", () => {
    const file = writeTmpFile("ajv-cjs.ts", 'const Ajv = require("ajv");\n');
    const violations = scanFileForViolations(file);
    expect(violations.length).toBe(1);
    expect(violations[0].rule).toContain("validation library");
  });

  it("should detect multiple violations in a single file", () => {
    const file = writeTmpFile(
      "multi-violations.ts",
      [
        'import { DynamoDB } from "@aws-sdk/client-dynamodb";',
        'console.log("debug");',
        'import { z } from "zod";',
        "",
      ].join("\n")
    );
    const violations = scanFileForViolations(file);
    expect(violations.length).toBe(3);
    expect(violations.map((v) => v.rule)).toEqual(
      expect.arrayContaining([
        expect.stringContaining("DynamoDB SDK"),
        expect.stringContaining("console"),
        expect.stringContaining("validation library"),
      ])
    );
  });

  it("should NOT flag string literals containing SDK package names", () => {
    const file = writeTmpFile(
      "string-literal.ts",
      'const errorMsg = "Error with @aws-sdk/client-dynamodb configuration";\n'
    );
    const violations = scanFileForViolations(file);
    expect(violations.length).toBe(0);
  });

  it("should NOT flag single-line comments containing forbidden patterns", () => {
    const file = writeTmpFile(
      "comment-only.ts",
      [
        '// import { DynamoDB } from "@aws-sdk/client-dynamodb";',
        '// console.log("debug");',
        '// import { z } from "zod";',
        "",
      ].join("\n")
    );
    const violations = scanFileForViolations(file);
    expect(violations.length).toBe(0);
  });

  it("should NOT flag block comments containing forbidden patterns", () => {
    const file = writeTmpFile(
      "block-comment.ts",
      [
        "/*",
        '  This was migrated from "@aws-sdk/client-dynamodb"',
        '  Previously used console.log("debug")',
        '  Also had import { z } from "zod"',
        "*/",
        'import { db } from "@ai-learning-hub/db";',
        "",
      ].join("\n")
    );
    const violations = scanFileForViolations(file);
    expect(violations.length).toBe(0);
  });

  it("should NOT flag inline block comments containing forbidden patterns", () => {
    const file = writeTmpFile(
      "inline-block-comment.ts",
      [
        '/* import { DynamoDB } from "@aws-sdk/client-dynamodb"; */',
        'import { db } from "@ai-learning-hub/db";',
        "",
      ].join("\n")
    );
    const violations = scanFileForViolations(file);
    expect(violations.length).toBe(0);
  });

  it("should report correct line numbers for violations", () => {
    const file = writeTmpFile(
      "line-numbers.ts",
      [
        'import { logger } from "@ai-learning-hub/logging";',
        "",
        'console.warn("this should be caught");',
        "",
      ].join("\n")
    );
    const violations = scanFileForViolations(file);
    expect(violations.length).toBe(1);
    expect(violations[0].line).toBe(3);
  });

  it("should return zero violations for a clean file", () => {
    const file = writeTmpFile(
      "clean-handler.ts",
      [
        'import { db } from "@ai-learning-hub/db";',
        'import { logger } from "@ai-learning-hub/logging";',
        'import { validate } from "@ai-learning-hub/validation";',
        "",
        "export const handler = async () => {",
        '  logger.info("processing");',
        "  return { statusCode: 200 };",
        "};",
        "",
      ].join("\n")
    );
    const violations = scanFileForViolations(file);
    expect(violations.length).toBe(0);
  });
});
