/**
 * Quality Gate Self-Test (Story 2.1-D5, AC18)
 *
 * Meta-test that scans all vitest config files and asserts coverage
 * thresholds are >= 80% for lines, functions, branches, statements.
 * Prevents thresholds from being silently lowered.
 */
import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const PROJECT_ROOT = path.resolve(__dirname, "../..");

/** Known vitest config paths to scan */
const VITEST_CONFIG_PATHS = [
  "backend/vitest.config.ts",
  "backend/shared/db/vitest.config.ts",
  "backend/shared/logging/vitest.config.ts",
  "backend/shared/middleware/vitest.config.ts",
  "backend/shared/validation/vitest.config.ts",
  "backend/shared/types/vitest.config.ts",
  "infra/vitest.config.ts",
];

const REQUIRED_METRICS = ["lines", "functions", "branches", "statements"];
const MIN_THRESHOLD = 80;

interface ThresholdViolation {
  configPath: string;
  metric: string;
  actual: number | undefined;
  required: number;
}

/**
 * Parses vitest config file to extract coverage threshold values.
 * Uses regex parsing since vitest configs can't be dynamically imported
 * reliably in a test context.
 *
 * Scopes matching to the `thresholds` block to avoid false positives from
 * commented-out values or metrics appearing in non-coverage sections.
 */
function parseThresholds(
  configContent: string
): Record<string, number | undefined> {
  const result: Record<string, number | undefined> = {};

  // Extract the thresholds block to avoid matching commented-out or
  // out-of-context values. Looks for "thresholds" followed by { ... }.
  const thresholdsMatch = configContent.match(/thresholds\s*:\s*\{([^}]*)\}/s);
  const thresholdsBlock = thresholdsMatch ? thresholdsMatch[1] : "";

  for (const metric of REQUIRED_METRICS) {
    // Strip single-line comments from the thresholds block before matching
    const uncommented = thresholdsBlock.replace(/\/\/.*$/gm, "");
    // Match patterns like: lines: 80 or "lines": 80
    const regex = new RegExp(`["']?${metric}["']?\\s*:\\s*(\\d+)`, "i");
    const match = uncommented.match(regex);
    result[metric] = match ? parseInt(match[1], 10) : undefined;
  }

  return result;
}

describe("Quality Gate Self-Test (AC18)", () => {
  it("all expected vitest config files exist", () => {
    const missing: string[] = [];

    for (const configPath of VITEST_CONFIG_PATHS) {
      const fullPath = path.join(PROJECT_ROOT, configPath);
      if (!fs.existsSync(fullPath)) {
        missing.push(configPath);
      }
    }

    if (missing.length > 0) {
      expect.fail(
        `Missing vitest config files:\n${missing.map((p) => `  ${p}`).join("\n")}`
      );
    }
  });

  for (const configPath of VITEST_CONFIG_PATHS) {
    describe(`${configPath}`, () => {
      it(`has coverage thresholds >= ${MIN_THRESHOLD}% for all metrics`, () => {
        const fullPath = path.join(PROJECT_ROOT, configPath);

        if (!fs.existsSync(fullPath)) {
          expect.fail(`Config file not found: ${configPath}`);
          return;
        }

        const content = fs.readFileSync(fullPath, "utf-8");
        const thresholds = parseThresholds(content);
        const violations: ThresholdViolation[] = [];

        for (const metric of REQUIRED_METRICS) {
          const value = thresholds[metric];

          if (value === undefined) {
            violations.push({
              configPath,
              metric,
              actual: undefined,
              required: MIN_THRESHOLD,
            });
          } else if (value < MIN_THRESHOLD) {
            violations.push({
              configPath,
              metric,
              actual: value,
              required: MIN_THRESHOLD,
            });
          }
        }

        if (violations.length > 0) {
          const messages = violations.map((v) =>
            v.actual === undefined
              ? `  ${v.metric}: MISSING (need >= ${v.required}%)`
              : `  ${v.metric}: ${v.actual}% (need >= ${v.required}%)`
          );
          expect.fail(
            `Coverage thresholds below ${MIN_THRESHOLD}% in ${configPath}:\n${messages.join("\n")}`
          );
        }
      });
    });
  }
});
