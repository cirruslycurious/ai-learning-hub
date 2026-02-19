import { describe, it, expect } from "vitest";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  parseCompletionReport,
  parseStateFileStories,
  validateCompletionReport,
  generateStoryRow,
} = require("../../.claude/hooks/completion-report-validator.cjs");

// --- parseCompletionReport ---

describe("parseCompletionReport", () => {
  it("extracts story rows from markdown table", () => {
    const content = `# Epic 2.1 Completion Report

**Status:** Complete
**Stories Completed:** 2/2

## Story Summary

| Story  | Title   | Status      | PR   | Coverage | Review Rounds | Findings Fixed | Duration |
| ------ | ------- | ----------- | ---- | -------- | ------------- | -------------- | -------- |
| 2.1-D2 | Title A | ✅ Complete | #147 | 99%      | 2             | 7              | 31m      |
| 2.1-D3 | Title B | ✅ Complete | #149 | 99%      | 2             | 4              | 45m      |
`;
    const result = parseCompletionReport(content);
    expect(result.status).toBe("Complete");
    expect(result.storiesCompleted).toBe("2/2");
    expect(result.storyRows).toHaveLength(2);
    expect(result.storyRows[0].id).toBe("2.1-D2");
    expect(result.storyRows[0].status).toBe("✅ Complete");
    expect(result.storyRows[0].pr).toBe("#147");
  });

  it("handles Partial status", () => {
    const content = `# Epic 2.1 Completion Report (Partial — D2 Only)

**Status:** Partial
**Stories Completed:** 1/5

## Story Summary

| Story  | Title   | Status      | PR   | Coverage | Review Rounds | Findings Fixed | Duration |
| ------ | ------- | ----------- | ---- | -------- | ------------- | -------------- | -------- |
| 2.1-D2 | Title A | ✅ Complete | #147 | 99%      | 2             | 7              | 31m      |
| 2.1-D3 | Title B | ⏳ Pending  | -    | -        | -             | -              | -        |
`;
    const result = parseCompletionReport(content);
    expect(result.status).toBe("Partial");
    expect(result.storiesCompleted).toBe("1/5");
    expect(result.storyRows).toHaveLength(2);
    expect(result.storyRows[1].status).toBe("⏳ Pending");
  });

  it("returns empty storyRows for content with no table", () => {
    const content = `# Epic 2.1 Completion Report

**Status:** Complete
**Stories Completed:** 0/0
`;
    const result = parseCompletionReport(content);
    expect(result.storyRows).toEqual([]);
  });
});

// --- parseStateFileStories ---

describe("parseStateFileStories", () => {
  it("extracts story statuses from YAML frontmatter", () => {
    const content = `---
stories:
  "2.1-D2":
    {
      status: done,
      pr: 147,
    }
  "2.1-D3":
    {
      status: done,
      pr: 149,
    }
---`;
    const result = parseStateFileStories(content);
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe("2.1-D2");
    expect(result[0].status).toBe("done");
    expect(result[0].pr).toBe("147");
  });
});

// --- validateCompletionReport ---

describe("validateCompletionReport", () => {
  const makeReport = (rows: string) => `# Epic 2.1 Completion Report

**Status:** Complete
**Stories Completed:** 4/4

## Story Summary

| Story  | Title   | Status      | PR   | Coverage | Review Rounds | Findings Fixed | Duration |
| ------ | ------- | ----------- | ---- | -------- | ------------- | -------------- | -------- |
${rows}
`;

  const makeState = (stories: string) => `---
stories:
${stories}
---`;

  it("PASS when report has rows for all done stories in state file", () => {
    const report = makeReport(
      `| 2.1-D2 | Title A | ✅ Complete | #147 | 99% | 2 | 7 | 31m |
| 2.1-D3 | Title B | ✅ Complete | #149 | 99% | 2 | 4 | 45m |`
    );
    const state = makeState(
      `  "2.1-D2":
    {
      status: done,
      pr: 147,
    }
  "2.1-D3":
    {
      status: done,
      pr: 149,
    }`
    );
    const result = validateCompletionReport(report, state);
    expect(result.pass).toBe(true);
    expect(result.findings).toHaveLength(0);
  });

  it("FAIL when state file has 4 done stories but report only has 1 row", () => {
    const report = makeReport(
      `| 2.1-D2 | Title A | ✅ Complete | #147 | 99% | 2 | 7 | 31m |`
    );
    const state = makeState(
      `  "2.1-D2":
    {
      status: done,
      pr: 147,
    }
  "2.1-D3":
    {
      status: done,
      pr: 149,
    }
  "2.1-D4":
    {
      status: done,
      pr: 151,
    }
  "2.1-D1":
    {
      status: done,
      pr: 153,
    }`
    );
    const result = validateCompletionReport(report, state);
    expect(result.pass).toBe(false);
    expect(result.findings.length).toBeGreaterThanOrEqual(3);
    expect(result.findings.some((f: string) => f.includes("2.1-D3"))).toBe(
      true
    );
  });

  it("FAIL when report shows story as pending but state file shows done", () => {
    const report = makeReport(
      `| 2.1-D2 | Title A | ✅ Complete | #147 | 99% | 2 | 7 | 31m |
| 2.1-D3 | Title B | ⏳ Pending  | -    | -   | - | - | -   |`
    );
    const state = makeState(
      `  "2.1-D2":
    {
      status: done,
      pr: 147,
    }
  "2.1-D3":
    {
      status: done,
      pr: 149,
    }`
    );
    const result = validateCompletionReport(report, state);
    expect(result.pass).toBe(false);
    expect(
      result.findings.some(
        (f: string) => f.includes("2.1-D3") && f.includes("stale")
      )
    ).toBe(true);
  });

  it("PASS when state file and report both show all stories as done with matching data", () => {
    const report = makeReport(
      `| 2.1-D2 | Title A | ✅ Complete | #147 | 99%  | 2 | 7 | 31m |
| 2.1-D3 | Title B | ✅ Complete | #149 | 99%  | 2 | 4 | 45m |
| 2.1-D4 | Title C | ✅ Complete | #151 | 99%  | 1 | 2 | 30m |
| 2.1-D1 | Title D | ✅ Complete | #153 | 100% | 2 | 5 | 40m |`
    );
    const state = makeState(
      `  "2.1-D2":
    {
      status: done,
      pr: 147,
    }
  "2.1-D3":
    {
      status: done,
      pr: 149,
    }
  "2.1-D4":
    {
      status: done,
      pr: 151,
    }
  "2.1-D1":
    {
      status: done,
      pr: 153,
    }`
    );
    const result = validateCompletionReport(report, state);
    expect(result.pass).toBe(true);
    expect(result.findings).toHaveLength(0);
  });

  it("ignores pending stories in state file (no report row required)", () => {
    const report = makeReport(
      `| 2.1-D2 | Title A | ✅ Complete | #147 | 99% | 2 | 7 | 31m |`
    );
    const state = makeState(
      `  "2.1-D2":
    {
      status: done,
      pr: 147,
    }
  "2.1-D3":
    {
      status: pending,
    }`
    );
    const result = validateCompletionReport(report, state);
    expect(result.pass).toBe(true);
  });
});

// --- generateStoryRow ---

describe("generateStoryRow", () => {
  it("produces valid markdown table row with all columns", () => {
    const row = generateStoryRow("2.1-D2", {
      title: "Backend Coverage",
      status: "done",
      pr: "147",
      coverage: "99",
      review_rounds: "2",
      findings_fixed: "7",
      duration: "31m",
    });
    expect(row).toBe(
      "| 2.1-D2 | Backend Coverage | ✅ Complete | #147 | 99% | 2 | 7 | 31m |"
    );
  });

  it("uses '-' for missing optional fields", () => {
    const row = generateStoryRow("2.1-D4", {
      title: "Logger",
      status: "done",
      pr: "151",
      coverage: "99",
      review_rounds: "1",
    });
    expect(row).toBe(
      "| 2.1-D4 | Logger | ✅ Complete | #151 | 99% | 1 | - | - |"
    );
  });

  it("shows pending status for non-done stories", () => {
    const row = generateStoryRow("2.1-D5", {
      title: "Enforcement Tests",
      status: "pending",
    });
    expect(row).toBe(
      "| 2.1-D5 | Enforcement Tests | ⏳ Pending | - | - | - | - | - |"
    );
  });
});
