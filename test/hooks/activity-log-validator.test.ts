import { describe, it, expect } from "vitest";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  parseActivityLog,
  validateTimestamps,
} = require("../../.claude/hooks/activity-log-validator.cjs");

// --- parseActivityLog ---

describe("parseActivityLog", () => {
  it("extracts activity log lines from state file content", () => {
    const content = `---
epic_id: Epic-2.1
---

# Epic 2.1 Auto-Run Progress

| Story | Status |
| ----- | ------ |

## Activity Log

- [00:24] Epic started
- [00:25] Story 2.1-D2: Implementation started
`;
    const result = parseActivityLog(content);
    expect(result).toHaveLength(2);
    expect(result[0].line).toBe("- [00:24] Epic started");
    expect(result[0].hasTimestamp).toBe(true);
    expect(result[0].timestamp).toBe("00:24");
  });

  it("ignores non-activity-log sections (YAML frontmatter, markdown table)", () => {
    const content = `---
epic_id: Epic-2.1
status: in-progress
started: 2026-02-17T00:24:04Z
---

# Epic 2.1 Auto-Run Progress

| Story  | Status      |
| ------ | ----------- |
| 2.1-D2 | Complete    |

## Activity Log

- [00:24] Epic started
`;
    const result = parseActivityLog(content);
    expect(result).toHaveLength(1);
    expect(result[0].line).toBe("- [00:24] Epic started");
  });

  it("returns empty array for files with no Activity Log section", () => {
    const content = `---
epic_id: Epic-2.1
---

# Epic 2.1 Auto-Run Progress

| Story | Status |
| ----- | ------ |
`;
    const result = parseActivityLog(content);
    expect(result).toEqual([]);
  });

  it("identifies lines with [HH:MM] timestamps", () => {
    const content = `## Activity Log

- [00:24] Epic started
- [12:59] Story done
`;
    const result = parseActivityLog(content);
    expect(result).toHaveLength(2);
    expect(result[0].hasTimestamp).toBe(true);
    expect(result[0].timestamp).toBe("00:24");
    expect(result[1].hasTimestamp).toBe(true);
    expect(result[1].timestamp).toBe("12:59");
  });

  it("identifies lines with ISO timestamp format", () => {
    const content = `## Activity Log

- [2026-02-17T00:24:04Z] Epic started
`;
    const result = parseActivityLog(content);
    expect(result).toHaveLength(1);
    expect(result[0].hasTimestamp).toBe(true);
    expect(result[0].timestamp).toBe("2026-02-17T00:24:04Z");
  });

  it("flags lines with [xx:xx] placeholder as no timestamp", () => {
    const content = `## Activity Log

- [xx:xx] Story started
`;
    const result = parseActivityLog(content);
    expect(result).toHaveLength(1);
    expect(result[0].hasTimestamp).toBe(false);
    expect(result[0].timestamp).toBeNull();
  });

  it("flags bare bullet lines without any timestamp", () => {
    const content = `## Activity Log

- Story 2.1-D1: Starting implementation
`;
    const result = parseActivityLog(content);
    expect(result).toHaveLength(1);
    expect(result[0].hasTimestamp).toBe(false);
    expect(result[0].timestamp).toBeNull();
  });

  it("handles mixed valid and invalid lines", () => {
    const content = `## Activity Log

- [00:24] Epic started
- Story 2.1-D1: Starting implementation
- [xx:xx] Story placeholder
- [02:00] Story 2.1-D3: Started
`;
    const result = parseActivityLog(content);
    expect(result).toHaveLength(4);
    expect(result[0].hasTimestamp).toBe(true);
    expect(result[1].hasTimestamp).toBe(false);
    expect(result[2].hasTimestamp).toBe(false);
    expect(result[3].hasTimestamp).toBe(true);
  });

  it("stops parsing at the next markdown heading after Activity Log", () => {
    const content = `## Activity Log

- [00:24] Epic started

## Blockers

- Something blocked
`;
    const result = parseActivityLog(content);
    expect(result).toHaveLength(1);
    expect(result[0].line).toBe("- [00:24] Epic started");
  });
});

// --- validateTimestamps ---

describe("validateTimestamps", () => {
  it("PASS when all activity log lines have [HH:MM] timestamps", () => {
    const content = `## Activity Log

- [00:24] Epic started
- [00:25] Story started
- [00:55] Story done
`;
    const result = validateTimestamps(content);
    expect(result.pass).toBe(true);
    expect(result.findings).toHaveLength(0);
  });

  it("FAIL when a line has [xx:xx] placeholder", () => {
    const content = `## Activity Log

- [00:24] Epic started
- [xx:xx] Story started
`;
    const result = validateTimestamps(content);
    expect(result.pass).toBe(false);
    expect(result.findings.length).toBeGreaterThan(0);
    expect(result.findings[0]).toContain("placeholder");
  });

  it("FAIL when a line is a bare bullet with no timestamp prefix", () => {
    const content = `## Activity Log

- [00:24] Epic started
- Story 2.1-D1: Starting implementation
`;
    const result = validateTimestamps(content);
    expect(result.pass).toBe(false);
    expect(result.findings.length).toBeGreaterThan(0);
    expect(result.findings[0]).toContain("missing timestamp");
  });

  it("PASS when lines use ISO format", () => {
    const content = `## Activity Log

- [2026-02-17T00:24:04Z] Epic started
- [2026-02-17T00:25:00Z] Story started
`;
    const result = validateTimestamps(content);
    expect(result.pass).toBe(true);
    expect(result.findings).toHaveLength(0);
  });

  it("PASS when activity log section is empty (no lines to validate)", () => {
    const content = `## Activity Log
`;
    const result = validateTimestamps(content);
    expect(result.pass).toBe(true);
    expect(result.findings).toHaveLength(0);
  });

  it("PASS when there is no Activity Log section", () => {
    const content = `---
epic_id: Epic-2.1
---

# Epic 2.1 Auto-Run Progress
`;
    const result = validateTimestamps(content);
    expect(result.pass).toBe(true);
    expect(result.findings).toHaveLength(0);
  });

  it("reports multiple failures with line details", () => {
    const content = `## Activity Log

- [00:24] Epic started
- Story D1: Started
- [xx:xx] Story D4: Started
- Story D1: Review round 1
`;
    const result = validateTimestamps(content);
    expect(result.pass).toBe(false);
    expect(result.findings).toHaveLength(3);
  });
});
