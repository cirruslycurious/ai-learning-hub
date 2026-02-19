import { describe, it, expect } from "vitest";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  parseStoryDurations,
  validateDurations,
} = require("../../.claude/hooks/duration-tracker-validator.cjs");

// --- parseStoryDurations ---

describe("parseStoryDurations", () => {
  it("parses stories with all timing fields present", () => {
    const content = `---
stories:
  "2.1-D2":
    {
      status: done,
      duration: "31m",
      startedAt: "2026-02-17T00:24:00Z",
      completedAt: "2026-02-17T00:55:00Z",
    }
---`;
    const result = parseStoryDurations(content);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("2.1-D2");
    expect(result[0].status).toBe("done");
    expect(result[0].duration).toBe("31m");
    expect(result[0].startedAt).toBe("2026-02-17T00:24:00Z");
    expect(result[0].completedAt).toBe("2026-02-17T00:55:00Z");
  });

  it("parses stories with some fields missing", () => {
    const content = `---
stories:
  "2.1-D4":
    {
      status: done,
      coverage: 99,
      review_rounds: 1,
    }
---`;
    const result = parseStoryDurations(content);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("2.1-D4");
    expect(result[0].status).toBe("done");
    expect(result[0].duration).toBeNull();
    expect(result[0].startedAt).toBeNull();
    expect(result[0].completedAt).toBeNull();
  });

  it("parses multiple stories", () => {
    const content = `---
stories:
  "2.1-D2":
    {
      status: done,
      duration: "31m",
    }
  "2.1-D3":
    {
      status: done,
      duration: "~45m",
    }
  "2.1-D4":
    {
      status: done,
    }
---`;
    const result = parseStoryDurations(content);
    expect(result).toHaveLength(3);
    expect(result[0].duration).toBe("31m");
    expect(result[1].duration).toBe("~45m");
    expect(result[2].duration).toBeNull();
  });

  it("handles pending and in-progress stories", () => {
    const content = `---
stories:
  "3.1":
    {
      status: pending,
    }
  "3.2":
    {
      status: in-progress,
      startedAt: "2026-02-19T10:00:00Z",
    }
---`;
    const result = parseStoryDurations(content);
    expect(result).toHaveLength(2);
    expect(result[0].status).toBe("pending");
    expect(result[1].status).toBe("in-progress");
    expect(result[1].startedAt).toBe("2026-02-19T10:00:00Z");
  });

  it("returns empty array when no stories section exists", () => {
    const content = `---
epic_id: Epic-2.1
status: in-progress
---`;
    const result = parseStoryDurations(content);
    expect(result).toEqual([]);
  });
});

// --- validateDurations ---

describe("validateDurations", () => {
  it("PASS when all done stories have duration, startedAt, and completedAt", () => {
    const content = `---
stories:
  "2.1-D2":
    {
      status: done,
      duration: "31m",
      startedAt: "2026-02-17T00:24:00Z",
      completedAt: "2026-02-17T00:55:00Z",
    }
  "2.1-D3":
    {
      status: done,
      duration: "45m",
      startedAt: "2026-02-17T02:00:00Z",
      completedAt: "2026-02-17T02:45:00Z",
    }
---`;
    const result = validateDurations(content);
    expect(result.pass).toBe(true);
    expect(result.findings).toHaveLength(0);
  });

  it("FAIL when a done story has no duration field", () => {
    const content = `---
stories:
  "2.1-D4":
    {
      status: done,
      startedAt: "2026-02-17T03:00:00Z",
      completedAt: "2026-02-17T03:30:00Z",
    }
---`;
    const result = validateDurations(content);
    expect(result.pass).toBe(false);
    expect(
      result.findings.some(
        (f: string) => f.includes("2.1-D4") && f.includes("duration")
      )
    ).toBe(true);
  });

  it("FAIL when a done story has no startedAt field", () => {
    const content = `---
stories:
  "2.1-D4":
    {
      status: done,
      duration: "30m",
      completedAt: "2026-02-17T03:30:00Z",
    }
---`;
    const result = validateDurations(content);
    expect(result.pass).toBe(false);
    expect(
      result.findings.some(
        (f: string) => f.includes("2.1-D4") && f.includes("startedAt")
      )
    ).toBe(true);
  });

  it("FAIL when a done story has no completedAt field", () => {
    const content = `---
stories:
  "2.1-D4":
    {
      status: done,
      duration: "30m",
      startedAt: "2026-02-17T03:00:00Z",
    }
---`;
    const result = validateDurations(content);
    expect(result.pass).toBe(false);
    expect(
      result.findings.some(
        (f: string) => f.includes("2.1-D4") && f.includes("completedAt")
      )
    ).toBe(true);
  });

  it("PASS for pending/in-progress stories without duration", () => {
    const content = `---
stories:
  "3.1":
    {
      status: pending,
    }
  "3.2":
    {
      status: in-progress,
      startedAt: "2026-02-19T10:00:00Z",
    }
---`;
    const result = validateDurations(content);
    expect(result.pass).toBe(true);
    expect(result.findings).toHaveLength(0);
  });

  it("informational warning for approximate durations (~)", () => {
    const content = `---
stories:
  "2.1-D3":
    {
      status: done,
      duration: "~45m",
      startedAt: "2026-02-17T02:00:00Z",
      completedAt: "2026-02-17T02:45:00Z",
    }
---`;
    const result = validateDurations(content);
    // Approximate durations are a warning, not a failure
    expect(result.pass).toBe(true);
    expect(result.warnings).toBeDefined();
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0]).toContain("approximate");
  });

  it("PASS when no stories section exists", () => {
    const content = `---
epic_id: Epic-2.1
---`;
    const result = validateDurations(content);
    expect(result.pass).toBe(true);
    expect(result.findings).toHaveLength(0);
  });

  it("reports multiple missing fields across stories", () => {
    const content = `---
stories:
  "2.1-D4":
    {
      status: done,
      review_rounds: 1,
    }
  "2.1-D1":
    {
      status: done,
      review_rounds: 2,
    }
---`;
    const result = validateDurations(content);
    expect(result.pass).toBe(false);
    // Each story missing 3 fields = 6 findings
    expect(result.findings).toHaveLength(6);
  });
});
