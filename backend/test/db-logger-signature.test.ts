/**
 * DB Logger Signature Test (Story 2.1-D5, AC19)
 *
 * Validates that every handler-facing exported function in @ai-learning-hub/db
 * accepts an optional Logger parameter. Prevents new DB functions from
 * skipping logger support added in Story 2.1-D4.
 */
import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const DB_SRC_DIR = path.resolve(__dirname, "../shared/db/src");

/**
 * Functions that are NOT handler-facing (utility/type exports, client setup).
 * These don't need logger parameters.
 */
const EXEMPT_FUNCTIONS = new Set([
  "createDynamoDBClient",
  "getDefaultClient",
  "resetDefaultClient",
  "toPublicInviteCode",
  "getWindowKey",
  "getCounterTTL",
]);

/**
 * Source files that contain handler-facing DB functions.
 * Excludes client.ts (client setup) and index.ts (barrel).
 */
const DB_SOURCE_FILES = [
  "helpers.ts",
  "users.ts",
  "invite-codes.ts",
  "rate-limiter.ts",
];

interface Violation {
  file: string;
  functionName: string;
  reason: string;
}

/**
 * Extracts exported function declarations from a TypeScript source file
 * and checks if they accept a Logger parameter.
 */
function checkFileForLoggerParam(filePath: string): Violation[] {
  const violations: Violation[] = [];
  const content = fs.readFileSync(filePath, "utf-8");
  const fileName = path.basename(filePath);

  // Match exported async/sync function declarations
  // Pattern: export [async] function name(...params...)
  const funcRegex =
    /export\s+(?:async\s+)?function\s+(\w+)\s*(?:<[^>]*>)?\s*\(([^)]*)\)/g;

  let match: RegExpExecArray | null;
  while ((match = funcRegex.exec(content)) !== null) {
    const funcName = match[1];
    const params = match[2];

    if (EXEMPT_FUNCTIONS.has(funcName)) continue;

    // Check if any parameter has Logger type
    const hasLogger = /\blogger\s*[?:]/.test(params) || /Logger/.test(params);

    if (!hasLogger) {
      violations.push({
        file: fileName,
        functionName: funcName,
        reason: `Missing optional Logger parameter`,
      });
    }
  }

  return violations;
}

describe("DB Logger Signature Enforcement (AC19)", () => {
  it("all expected DB source files exist", () => {
    for (const file of DB_SOURCE_FILES) {
      const fullPath = path.join(DB_SRC_DIR, file);
      expect(fs.existsSync(fullPath), `DB source file not found: ${file}`).toBe(
        true
      );
    }
  });

  it("every handler-facing exported function accepts an optional Logger parameter", () => {
    const allViolations: Violation[] = [];

    for (const file of DB_SOURCE_FILES) {
      const fullPath = path.join(DB_SRC_DIR, file);
      if (!fs.existsSync(fullPath)) continue;
      allViolations.push(...checkFileForLoggerParam(fullPath));
    }

    if (allViolations.length > 0) {
      const messages = allViolations.map(
        (v) => `  ${v.file}: ${v.functionName}() — ${v.reason}`
      );
      expect.fail(
        `DB functions missing Logger parameter (Story 2.1-D4 compliance):\n${messages.join("\n")}\n\nEvery handler-facing DB function must accept an optional Logger parameter.`
      );
    }
  });

  it("exempt functions are actually exported from the DB barrel", () => {
    const indexPath = path.join(DB_SRC_DIR, "index.ts");
    const content = fs.readFileSync(indexPath, "utf-8");

    // Verify at least some exempt functions exist in the barrel
    const exemptInBarrel = [...EXEMPT_FUNCTIONS].filter((fn) =>
      content.includes(fn)
    );

    expect(
      exemptInBarrel.length,
      "Expected some exempt functions to be in the DB barrel export"
    ).toBeGreaterThan(0);
  });
});
