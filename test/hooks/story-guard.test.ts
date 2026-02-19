import { describe, it, expect } from "vitest";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  parseFrontmatter,
  countAcceptanceCriteria,
  hasDevNotes,
  checkStoryReadiness,
} = require("../../.claude/hooks/story-guard.cjs");

// --- parseFrontmatter ---

describe("parseFrontmatter", () => {
  it("parses standard YAML frontmatter with id, title, status", () => {
    const content = `---
id: "2.1"
title: "Add auth middleware"
status: ready-for-dev
---
# Story`;
    const result = parseFrontmatter(content);
    expect(result).toEqual({
      id: "2.1",
      title: "Add auth middleware",
      status: "ready-for-dev",
    });
  });

  it("returns null for content without frontmatter", () => {
    const content = "# Just a heading\nSome text";
    expect(parseFrontmatter(content)).toBeNull();
  });

  it("handles quoted string values", () => {
    const content = `---
id: "3.1"
title: 'Single quoted title'
---`;
    const result = parseFrontmatter(content);
    expect(result!.id).toBe("3.1");
    expect(result!.title).toBe("Single quoted title");
  });

  it("handles inline arrays [a, b, c]", () => {
    const content = `---
id: "1.1"
touches: [backend/functions, infra/stacks]
---`;
    const result = parseFrontmatter(content);
    expect(result!.touches).toEqual(["backend/functions", "infra/stacks"]);
  });

  it("returns null for empty frontmatter (--- followed by ---)", () => {
    const content = `---
---
# Content`;
    expect(parseFrontmatter(content)).toBeNull();
  });

  it("handles frontmatter with extra whitespace in values", () => {
    const content = `---
id:   2.1
title:   Some title
---`;
    const result = parseFrontmatter(content);
    expect(result!.id).toBe("2.1");
    expect(result!.title).toBe("Some title");
  });
});

// --- countAcceptanceCriteria ---

describe("countAcceptanceCriteria", () => {
  it("counts list items under ## Acceptance Criteria heading", () => {
    const content = `## Acceptance Criteria
- Returns 401 for invalid JWT tokens
- Returns 200 for valid requests with correct payload
- Logs authentication failures to CloudWatch

## Dev Notes`;
    expect(countAcceptanceCriteria(content)).toBe(3);
  });

  it("returns 0 when no AC heading exists", () => {
    const content = `## Dev Notes
- Task 1: implement handler`;
    expect(countAcceptanceCriteria(content)).toBe(0);
  });

  it("filters out vague placeholders ('it works', 'TBD')", () => {
    const content = `## Acceptance Criteria
- it works
- TBD
- Returns 401 for invalid JWT tokens
- todo`;
    expect(countAcceptanceCriteria(content)).toBe(1);
  });

  it("filters out items shorter than 5 chars", () => {
    const content = `## Acceptance Criteria
- OK
- Yes
- Returns 401 for invalid JWT tokens`;
    expect(countAcceptanceCriteria(content)).toBe(1);
  });

  it("counts numbered list items (1. / 2.)", () => {
    const content = `## Acceptance Criteria
1. Returns 401 for invalid JWT tokens
2. Returns 200 for valid requests with correct payload`;
    expect(countAcceptanceCriteria(content)).toBe(2);
  });

  it("stops counting at next heading of same or higher level", () => {
    const content = `## Acceptance Criteria
- Returns 401 for invalid JWT tokens
- Returns 200 for valid requests

## Dev Notes
- This is a task, not an AC`;
    expect(countAcceptanceCriteria(content)).toBe(2);
  });

  it("handles ### Acceptance Criteria heading level", () => {
    const content = `### Acceptance Criteria
- Returns 401 for invalid JWT tokens
- Logs failures to CloudWatch`;
    expect(countAcceptanceCriteria(content)).toBe(2);
  });
});

// --- hasDevNotes ---

describe("hasDevNotes", () => {
  it("returns true when Dev Notes section has list items", () => {
    const content = `## Dev Notes
- Implement handler using shared middleware
- Add DynamoDB query for user lookup`;
    expect(hasDevNotes(content)).toBe(true);
  });

  it("returns false when Dev Notes heading exists but is empty", () => {
    const content = `## Dev Notes

## Acceptance Criteria`;
    expect(hasDevNotes(content)).toBe(false);
  });

  it("returns true for ## Tasks heading with checkbox items", () => {
    const content = `## Tasks
- [x] Create handler file in backend/functions/auth
- [ ] Write unit tests for JWT validation`;
    expect(hasDevNotes(content)).toBe(true);
  });

  it("returns true for nested subheadings within Dev Notes", () => {
    const content = `## Dev Notes

### Architecture Requirements
- Must use shared middleware from @ai-learning-hub/middleware

### Task Breakdown
- Implement JWT validation function`;
    expect(hasDevNotes(content)).toBe(true);
  });

  it("returns false when no Dev Notes-like heading exists", () => {
    const content = `## Acceptance Criteria
- Returns 401 for invalid tokens

## Summary
Some summary text`;
    expect(hasDevNotes(content)).toBe(false);
  });

  it("returns true for Task Breakdown heading", () => {
    const content = `## Task Breakdown
- Create Lambda handler
- Write integration tests`;
    expect(hasDevNotes(content)).toBe(true);
  });
});

// --- checkStoryReadiness (integrated) ---

describe("checkStoryReadiness", () => {
  it("returns {} (allow) for non-dev-story Skill invocations", () => {
    const data = {
      tool_name: "Skill",
      tool_input: { skill: "bmad-bmm-create-story", args: "" },
    };
    expect(checkStoryReadiness(data)).toEqual({});
  });

  it("returns {} (allow) for Task invocations not referencing dev-story", () => {
    const data = {
      tool_name: "Task",
      tool_input: {
        prompt: "Search for all TypeScript files in the project",
        description: "Explore codebase",
      },
    };
    expect(checkStoryReadiness(data)).toEqual({});
  });

  it("returns deny for non-existent story file path", () => {
    const data = {
      tool_name: "Skill",
      tool_input: {
        skill: "bmad-bmm-dev-story",
        args: "/tmp/nonexistent-story-file-for-test.md",
      },
    };
    const result = checkStoryReadiness(data);
    expect(result.decision).toBe("deny");
    expect(result.reason).toContain("Story file not found");
  });

  it("returns {} (allow) for dev-story with no path (standalone mode)", () => {
    const data = {
      tool_name: "Skill",
      tool_input: { skill: "bmad-bmm-dev-story", args: "" },
    };
    expect(checkStoryReadiness(data)).toEqual({});
  });

  it("returns {} (allow) for non-Skill, non-dev-story Task invocations", () => {
    const data = {
      tool_name: "Bash",
      tool_input: { command: "npm test" },
    };
    expect(checkStoryReadiness(data)).toEqual({});
  });
});
