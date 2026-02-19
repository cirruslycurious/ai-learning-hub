import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createRequire } from "node:module";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const require = createRequire(import.meta.url);
const {
  extractFindingsPathFromTemplate,
  findMismatchedFindings,
  validateFindingsConfig,
} = require("../../.claude/hooks/findings-path-validator.cjs");

// --- extractFindingsPathFromTemplate ---

describe("extractFindingsPathFromTemplate", () => {
  it("extracts path from 'Output path:' line", () => {
    const template = `Review Story {story.id}: {story.title}
Branch: {branchName}
Output path: docs/progress/story-{story.id}-review-findings-round-{round}.md

Review the code changes.`;
    const result = extractFindingsPathFromTemplate(template);
    expect(result).toBe(
      "docs/progress/story-{story.id}-review-findings-round-{round}.md"
    );
  });

  it("returns null when no Output path line found", () => {
    const template = `Review Story {story.id}
Branch: {branchName}`;
    const result = extractFindingsPathFromTemplate(template);
    expect(result).toBeNull();
  });

  it("extracts path from 'Findings:' line in fixer prompt", () => {
    const template = `Fix code review findings for Story {story.id}
Findings: docs/progress/story-{story.id}-review-findings-round-{round}.md
Round: {round}`;
    const result = extractFindingsPathFromTemplate(template);
    expect(result).toBe(
      "docs/progress/story-{story.id}-review-findings-round-{round}.md"
    );
  });
});

// --- validateFindingsConfig ---

describe("validateFindingsConfig", () => {
  it("PASS when all path references point to docs/progress/", () => {
    const reviewLoop = `Output path: docs/progress/story-{story.id}-review-findings-round-{round}.md
The reviewer writes findings to docs/progress/story-{story.id}-review-findings-round-{round}.md`;
    const reviewer = `Output path: docs/progress/story-{story.id}-review-findings-round-{round}.md`;
    const fixer = `Findings: docs/progress/story-{story.id}-review-findings-round-{round}.md`;
    const result = validateFindingsConfig(reviewLoop, reviewer, fixer);
    expect(result.pass).toBe(true);
    expect(result.findings).toHaveLength(0);
  });

  it("FAIL when reviewer prompt uses docs/temp/", () => {
    const reviewLoop = `Output path: docs/progress/story-{story.id}-review-findings-round-{round}.md`;
    const reviewer = `Output path: docs/temp/story-{story.id}-review-findings-round-{round}.md`;
    const fixer = `Findings: docs/progress/story-{story.id}-review-findings-round-{round}.md`;
    const result = validateFindingsConfig(reviewLoop, reviewer, fixer);
    expect(result.pass).toBe(false);
    expect(result.findings.length).toBeGreaterThan(0);
  });

  it("FAIL when fixer prompt path doesn't match reviewer prompt path", () => {
    const reviewLoop = `Output path: docs/progress/story-{story.id}-review-findings-round-{round}.md`;
    const reviewer = `Output path: docs/progress/story-{story.id}-review-findings-round-{round}.md`;
    const fixer = `Findings: docs/temp/story-{story.id}-review-findings-round-{round}.md`;
    const result = validateFindingsConfig(reviewLoop, reviewer, fixer);
    expect(result.pass).toBe(false);
    expect(result.findings.some((f: string) => f.includes("fixer"))).toBe(true);
  });
});

// --- findMismatchedFindings (filesystem) ---

describe("findMismatchedFindings", () => {
  let testDir: string;

  beforeEach(() => {
    testDir = mkdtempSync(join(tmpdir(), "findings-path-test-"));
    mkdirSync(join(testDir, "docs", "progress"), { recursive: true });
    mkdirSync(join(testDir, "docs", "temp"), { recursive: true });
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it("returns findings files found in docs/temp/", () => {
    writeFileSync(
      join(testDir, "docs", "temp", "story-2.1-D2-review-findings-round-1.md"),
      "# findings"
    );
    const result = findMismatchedFindings(
      join(testDir, "docs", "progress"),
      join(testDir, "docs", "temp")
    );
    expect(result.inTemp).toContain("story-2.1-D2-review-findings-round-1.md");
    expect(result.inTemp).toHaveLength(1);
  });

  it("returns empty arrays when all findings are in docs/progress/", () => {
    writeFileSync(
      join(
        testDir,
        "docs",
        "progress",
        "story-2.1-D2-review-findings-round-1.md"
      ),
      "# findings"
    );
    const result = findMismatchedFindings(
      join(testDir, "docs", "progress"),
      join(testDir, "docs", "temp")
    );
    expect(result.inTemp).toHaveLength(0);
    expect(result.inProgress).toHaveLength(1);
  });

  it("returns files from both locations", () => {
    writeFileSync(
      join(
        testDir,
        "docs",
        "progress",
        "story-1.13-review-findings-round-1.md"
      ),
      "# old"
    );
    writeFileSync(
      join(testDir, "docs", "temp", "story-2.2-review-findings-round-1.md"),
      "# new"
    );
    const result = findMismatchedFindings(
      join(testDir, "docs", "progress"),
      join(testDir, "docs", "temp")
    );
    expect(result.inProgress).toHaveLength(1);
    expect(result.inTemp).toHaveLength(1);
  });

  it("ignores non-findings files in docs/temp/", () => {
    writeFileSync(
      join(testDir, "docs", "temp", "sprint-change-proposal.md"),
      "# not findings"
    );
    const result = findMismatchedFindings(
      join(testDir, "docs", "progress"),
      join(testDir, "docs", "temp")
    );
    expect(result.inTemp).toHaveLength(0);
  });
});
