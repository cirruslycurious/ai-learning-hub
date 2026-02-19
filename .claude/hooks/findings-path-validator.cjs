/**
 * Findings Path Validator
 *
 * Validates that review findings are written to the canonical location
 * (docs/progress/) and detects mismatches between configuration and
 * actual file locations.
 */

"use strict";

const { readdirSync, existsSync } = require("node:fs");

const FINDINGS_FILE_PATTERN = /^story-.*-review-findings-round-\d+\.md$/;
const CANONICAL_DIR = "docs/progress/";

// Extract path from "Output path: ..." or "Findings: ..." lines
const OUTPUT_PATH_LINE = /(?:Output path|Findings):\s*(\S+)/;

/**
 * Extract the findings path pattern from a template/prompt string.
 * Looks for "Output path:" or "Findings:" lines.
 */
function extractFindingsPathFromTemplate(content) {
  const lines = content.split("\n");
  for (const line of lines) {
    const match = line.match(OUTPUT_PATH_LINE);
    if (match) return match[1];
  }
  return null;
}

/**
 * Find review findings files in both docs/progress/ and docs/temp/.
 * Returns { inProgress: string[], inTemp: string[] }.
 */
function findMismatchedFindings(progressDir, tempDir) {
  const inProgress = [];
  const inTemp = [];

  if (existsSync(progressDir)) {
    for (const file of readdirSync(progressDir)) {
      if (FINDINGS_FILE_PATTERN.test(file)) {
        inProgress.push(file);
      }
    }
  }

  if (existsSync(tempDir)) {
    for (const file of readdirSync(tempDir)) {
      if (FINDINGS_FILE_PATTERN.test(file)) {
        inTemp.push(file);
      }
    }
  }

  return { inProgress, inTemp };
}

/**
 * Validate that all findings path references are consistent.
 * Takes the content of review-loop.md, reviewer prompt section,
 * and fixer prompt section.
 * Returns { pass: boolean, findings: string[] }.
 */
function validateFindingsConfig(reviewLoopContent, reviewerContent, fixerContent) {
  const findings = [];

  const reviewLoopPath = extractFindingsPathFromTemplate(reviewLoopContent);
  const reviewerPath = extractFindingsPathFromTemplate(reviewerContent);
  const fixerPath = extractFindingsPathFromTemplate(fixerContent);

  // All extracted paths should start with the canonical dir
  if (reviewLoopPath && !reviewLoopPath.startsWith(CANONICAL_DIR)) {
    findings.push(
      `review-loop.md: findings path "${reviewLoopPath}" does not use canonical directory "${CANONICAL_DIR}"`
    );
  }

  if (reviewerPath && !reviewerPath.startsWith(CANONICAL_DIR)) {
    findings.push(
      `reviewer prompt: findings path "${reviewerPath}" does not use canonical directory "${CANONICAL_DIR}"`
    );
  }

  if (fixerPath && !fixerPath.startsWith(CANONICAL_DIR)) {
    findings.push(
      `fixer prompt: findings path "${fixerPath}" does not use canonical directory "${CANONICAL_DIR}"`
    );
  }

  // Check consistency between reviewer and fixer
  if (reviewerPath && fixerPath && reviewerPath !== fixerPath) {
    findings.push(
      `Path mismatch: reviewer uses "${reviewerPath}" but fixer uses "${fixerPath}"`
    );
  }

  return {
    pass: findings.length === 0,
    findings,
  };
}

module.exports = {
  extractFindingsPathFromTemplate,
  findMismatchedFindings,
  validateFindingsConfig,
};
