import { describe, it, expect } from "vitest";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
const {
  extractPromptBlock,
  validateReviewerPrompt,
  validateFixerPrompt,
  validateAgentDefinition,
  checkInlineACs,
  parseArgs,
} = require("../../.claude/hooks/prompt-template-validator.cjs");

// --- Helpers: synthetic markdown content ---

/** Minimal valid review-loop.md with both Step A and Step C prompt blocks */
function makeReviewLoop({
  reviewerFields = [
    "Review Story {story.id}: {story.title}",
    "Branch: {branchName}",
    "Base branch: {baseBranch}",
    "Story file: {storyFilePath}",
    "Round: {round}",
    "Output path: docs/progress/story-{story.id}-review-findings-round-{round}.md",
    "Expected files: {story.touches}",
  ],
  fixerFields = [
    "Fix code review findings for Story {story.id}: {story.title}",
    "Branch: {branchName}",
    "Base branch: {baseBranch}",
    "Story file: {storyFilePath}",
    "Findings: docs/progress/story-{story.id}-review-findings-round-{round}.md",
    "Round: {round}",
    "Expected files: {story.touches}",
    "Coverage baseline: {coverage}%",
  ],
  reviewerProse = "Review the code changes.",
  fixerProse = "Read the findings document. Address all issues.",
}: {
  reviewerFields?: string[];
  fixerFields?: string[];
  reviewerProse?: string;
  fixerProse?: string;
} = {}): string {
  const reviewerBlock = reviewerFields.join("\n    ");
  const fixerBlock = fixerFields.join("\n    ");
  return `# Multi-Agent Code Review Loop

## Step A: Spawn Reviewer Subagent

\`\`\`
Task tool invocation:
  subagent_type: "epic-reviewer"
  prompt: |
    ${reviewerBlock}

    ${reviewerProse}
\`\`\`

## Step B: Decision Point

Some prose about decisions.

## Step C: Spawn Fixer Subagent

\`\`\`
Task tool invocation:
  subagent_type: "epic-fixer"
  prompt: |
    ${fixerBlock}

    ${fixerProse}
\`\`\`

## Step D: Loop Back

Some prose about looping.
`;
}

/** Minimal valid agent definition with Context You Will Receive */
function makeAgentDef(fields: string[]): string {
  const list = fields.map((f) => `- **${f}**`).join("\n");
  return `---
name: test-agent
---

## Context You Will Receive

${list}

## Your Task

Do things.
`;
}

// --- extractPromptBlock ---

describe("extractPromptBlock", () => {
  it("extracts the Step A code block", () => {
    const md = makeReviewLoop();
    const block = extractPromptBlock(md, "Step A");
    expect(block).not.toBeNull();
    expect(block).toContain('subagent_type: "epic-reviewer"');
    expect(block).toContain("Branch: {branchName}");
  });

  it("extracts the Step C code block", () => {
    const md = makeReviewLoop();
    const block = extractPromptBlock(md, "Step C");
    expect(block).not.toBeNull();
    expect(block).toContain('subagent_type: "epic-fixer"');
    expect(block).toContain("Findings:");
  });

  it("returns null when heading not found", () => {
    const md = makeReviewLoop();
    const block = extractPromptBlock(md, "Step Z");
    expect(block).toBeNull();
  });

  it("returns null when no code block under heading", () => {
    const md = `# Test\n\n## Step A: Spawn Reviewer\n\nJust prose, no code block.\n\n## Step B\n`;
    const block = extractPromptBlock(md, "Step A");
    expect(block).toBeNull();
  });

  it("returns null for empty content", () => {
    const block = extractPromptBlock("", "Step A");
    expect(block).toBeNull();
  });

  it("handles heading with full title (Step A: Spawn Reviewer Subagent)", () => {
    const md = makeReviewLoop();
    // The heading is "## Step A: Spawn Reviewer Subagent"
    const block = extractPromptBlock(md, "Step A");
    expect(block).not.toBeNull();
  });
});

// --- validateReviewerPrompt ---

describe("validateReviewerPrompt", () => {
  it("PASS when all required fields present", () => {
    const md = makeReviewLoop();
    const result = validateReviewerPrompt(md);
    expect(result.pass).toBe(true);
    expect(result.findings).toEqual([]);
  });

  it("FAIL when Branch: missing", () => {
    const md = makeReviewLoop({
      reviewerFields: [
        "Review Story {story.id}: {story.title}",
        // no Branch:
        "Base branch: {baseBranch}",
        "Story file: {storyFilePath}",
        "Round: {round}",
        "Output path: docs/progress/story-{story.id}-review-findings-round-{round}.md",
        "Expected files: {story.touches}",
      ],
    });
    const result = validateReviewerPrompt(md);
    expect(result.pass).toBe(false);
    expect(result.findings).toEqual(
      expect.arrayContaining([expect.stringContaining("Branch:")])
    );
  });

  it("FAIL when Base branch: missing", () => {
    const md = makeReviewLoop({
      reviewerFields: [
        "Review Story {story.id}: {story.title}",
        "Branch: {branchName}",
        // no Base branch:
        "Story file: {storyFilePath}",
        "Round: {round}",
        "Output path: docs/progress/story-{story.id}-review-findings-round-{round}.md",
        "Expected files: {story.touches}",
      ],
    });
    const result = validateReviewerPrompt(md);
    expect(result.pass).toBe(false);
    expect(result.findings).toEqual(
      expect.arrayContaining([expect.stringContaining("Base branch:")])
    );
  });

  it("FAIL when Story file: missing", () => {
    const md = makeReviewLoop({
      reviewerFields: [
        "Review Story {story.id}: {story.title}",
        "Branch: {branchName}",
        "Base branch: {baseBranch}",
        // no Story file:
        "Round: {round}",
        "Output path: docs/progress/story-{story.id}-review-findings-round-{round}.md",
        "Expected files: {story.touches}",
      ],
    });
    const result = validateReviewerPrompt(md);
    expect(result.pass).toBe(false);
    expect(result.findings).toEqual(
      expect.arrayContaining([expect.stringContaining("Story file:")])
    );
  });

  it("FAIL when Round: missing", () => {
    const md = makeReviewLoop({
      reviewerFields: [
        "Review Story {story.id}: {story.title}",
        "Branch: {branchName}",
        "Base branch: {baseBranch}",
        "Story file: {storyFilePath}",
        // no Round:
        "Output path: docs/progress/story-{story.id}-review-findings-round-{round}.md",
        "Expected files: {story.touches}",
      ],
    });
    const result = validateReviewerPrompt(md);
    expect(result.pass).toBe(false);
    expect(result.findings).toEqual(
      expect.arrayContaining([expect.stringContaining("Round:")])
    );
  });

  it("FAIL when Output path: missing (item 2.4)", () => {
    const md = makeReviewLoop({
      reviewerFields: [
        "Review Story {story.id}: {story.title}",
        "Branch: {branchName}",
        "Base branch: {baseBranch}",
        "Story file: {storyFilePath}",
        "Round: {round}",
        // no Output path:
        "Expected files: {story.touches}",
      ],
    });
    const result = validateReviewerPrompt(md);
    expect(result.pass).toBe(false);
    expect(result.findings).toEqual(
      expect.arrayContaining([expect.stringContaining("Output path:")])
    );
  });

  it("FAIL when Expected files: missing (item 2.2)", () => {
    const md = makeReviewLoop({
      reviewerFields: [
        "Review Story {story.id}: {story.title}",
        "Branch: {branchName}",
        "Base branch: {baseBranch}",
        "Story file: {storyFilePath}",
        "Round: {round}",
        "Output path: docs/progress/story-{story.id}-review-findings-round-{round}.md",
        // no Expected files:
      ],
    });
    const result = validateReviewerPrompt(md);
    expect(result.pass).toBe(false);
    expect(result.findings).toEqual(
      expect.arrayContaining([expect.stringContaining("Expected files:")])
    );
  });

  it("FAIL when multiple fields missing (reports all)", () => {
    const md = makeReviewLoop({
      reviewerFields: [
        "Review Story {story.id}: {story.title}",
        "Branch: {branchName}",
        // missing: Base branch, Story file, Round, Output path, Expected files
      ],
    });
    const result = validateReviewerPrompt(md);
    expect(result.pass).toBe(false);
    expect(result.findings.length).toBeGreaterThanOrEqual(4);
  });

  it("PASS with extra fields beyond requirements", () => {
    const md = makeReviewLoop({
      reviewerFields: [
        "Review Story {story.id}: {story.title}",
        "Branch: {branchName}",
        "Base branch: {baseBranch}",
        "Story file: {storyFilePath}",
        "Round: {round}",
        "Output path: docs/progress/story-{story.id}-review-findings-round-{round}.md",
        "Expected files: {story.touches}",
        "Extra field: something",
      ],
    });
    const result = validateReviewerPrompt(md);
    expect(result.pass).toBe(true);
    expect(result.findings).toEqual([]);
  });

  it("returns error finding when Step A block not found", () => {
    const md = "# No steps here\n\nJust prose.";
    const result = validateReviewerPrompt(md);
    expect(result.pass).toBe(false);
    expect(result.findings).toEqual(
      expect.arrayContaining([expect.stringContaining("Step A")])
    );
  });
});

// --- validateFixerPrompt ---

describe("validateFixerPrompt", () => {
  it("PASS when all required fields present", () => {
    const md = makeReviewLoop();
    const result = validateFixerPrompt(md);
    expect(result.pass).toBe(true);
    expect(result.findings).toEqual([]);
  });

  it("FAIL when Branch: missing", () => {
    const md = makeReviewLoop({
      fixerFields: [
        "Fix code review findings for Story {story.id}: {story.title}",
        // no Branch:
        "Base branch: {baseBranch}",
        "Story file: {storyFilePath}",
        "Findings: docs/progress/story-{story.id}-review-findings-round-{round}.md",
        "Round: {round}",
        "Expected files: {story.touches}",
        "Coverage baseline: {coverage}%",
      ],
    });
    const result = validateFixerPrompt(md);
    expect(result.pass).toBe(false);
    expect(result.findings).toEqual(
      expect.arrayContaining([expect.stringContaining("Branch:")])
    );
  });

  it("FAIL when Base branch: missing (item 2.1)", () => {
    const md = makeReviewLoop({
      fixerFields: [
        "Fix code review findings for Story {story.id}: {story.title}",
        "Branch: {branchName}",
        // no Base branch:
        "Story file: {storyFilePath}",
        "Findings: docs/progress/story-{story.id}-review-findings-round-{round}.md",
        "Round: {round}",
        "Expected files: {story.touches}",
        "Coverage baseline: {coverage}%",
      ],
    });
    const result = validateFixerPrompt(md);
    expect(result.pass).toBe(false);
    expect(result.findings).toEqual(
      expect.arrayContaining([expect.stringContaining("Base branch:")])
    );
  });

  it("FAIL when Story file: missing", () => {
    const md = makeReviewLoop({
      fixerFields: [
        "Fix code review findings for Story {story.id}: {story.title}",
        "Branch: {branchName}",
        "Base branch: {baseBranch}",
        // no Story file:
        "Findings: docs/progress/story-{story.id}-review-findings-round-{round}.md",
        "Round: {round}",
        "Expected files: {story.touches}",
        "Coverage baseline: {coverage}%",
      ],
    });
    const result = validateFixerPrompt(md);
    expect(result.pass).toBe(false);
    expect(result.findings).toEqual(
      expect.arrayContaining([expect.stringContaining("Story file:")])
    );
  });

  it("FAIL when Findings: missing", () => {
    const md = makeReviewLoop({
      fixerFields: [
        "Fix code review findings for Story {story.id}: {story.title}",
        "Branch: {branchName}",
        "Base branch: {baseBranch}",
        "Story file: {storyFilePath}",
        // no Findings:
        "Round: {round}",
        "Expected files: {story.touches}",
        "Coverage baseline: {coverage}%",
      ],
    });
    const result = validateFixerPrompt(md);
    expect(result.pass).toBe(false);
    expect(result.findings).toEqual(
      expect.arrayContaining([expect.stringContaining("Findings:")])
    );
  });

  it("FAIL when Round: missing", () => {
    const md = makeReviewLoop({
      fixerFields: [
        "Fix code review findings for Story {story.id}: {story.title}",
        "Branch: {branchName}",
        "Base branch: {baseBranch}",
        "Story file: {storyFilePath}",
        "Findings: docs/progress/story-{story.id}-review-findings-round-{round}.md",
        // no Round:
        "Expected files: {story.touches}",
        "Coverage baseline: {coverage}%",
      ],
    });
    const result = validateFixerPrompt(md);
    expect(result.pass).toBe(false);
    expect(result.findings).toEqual(
      expect.arrayContaining([expect.stringContaining("Round:")])
    );
  });

  it("FAIL when Expected files: missing (item 2.2)", () => {
    const md = makeReviewLoop({
      fixerFields: [
        "Fix code review findings for Story {story.id}: {story.title}",
        "Branch: {branchName}",
        "Base branch: {baseBranch}",
        "Story file: {storyFilePath}",
        "Findings: docs/progress/story-{story.id}-review-findings-round-{round}.md",
        "Round: {round}",
        // no Expected files:
        "Coverage baseline: {coverage}%",
      ],
    });
    const result = validateFixerPrompt(md);
    expect(result.pass).toBe(false);
    expect(result.findings).toEqual(
      expect.arrayContaining([expect.stringContaining("Expected files:")])
    );
  });

  it("FAIL when Coverage baseline: missing (item 2.3)", () => {
    const md = makeReviewLoop({
      fixerFields: [
        "Fix code review findings for Story {story.id}: {story.title}",
        "Branch: {branchName}",
        "Base branch: {baseBranch}",
        "Story file: {storyFilePath}",
        "Findings: docs/progress/story-{story.id}-review-findings-round-{round}.md",
        "Round: {round}",
        "Expected files: {story.touches}",
        // no Coverage baseline:
      ],
    });
    const result = validateFixerPrompt(md);
    expect(result.pass).toBe(false);
    expect(result.findings).toEqual(
      expect.arrayContaining([expect.stringContaining("Coverage baseline:")])
    );
  });

  it("FAIL when multiple fields missing (reports all)", () => {
    const md = makeReviewLoop({
      fixerFields: [
        "Fix code review findings for Story {story.id}: {story.title}",
        "Branch: {branchName}",
        // missing: Base branch, Story file, Findings, Round, Expected files, Coverage baseline
      ],
    });
    const result = validateFixerPrompt(md);
    expect(result.pass).toBe(false);
    expect(result.findings.length).toBeGreaterThanOrEqual(5);
  });

  it("PASS with extra fields beyond requirements", () => {
    const md = makeReviewLoop({
      fixerFields: [
        "Fix code review findings for Story {story.id}: {story.title}",
        "Branch: {branchName}",
        "Base branch: {baseBranch}",
        "Story file: {storyFilePath}",
        "Findings: docs/progress/story-{story.id}-review-findings-round-{round}.md",
        "Round: {round}",
        "Expected files: {story.touches}",
        "Coverage baseline: {coverage}%",
        "Extra info: something",
      ],
    });
    const result = validateFixerPrompt(md);
    expect(result.pass).toBe(true);
    expect(result.findings).toEqual([]);
  });

  it("returns error finding when Step C block not found", () => {
    const md = "# No steps here\n\nJust prose.";
    const result = validateFixerPrompt(md);
    expect(result.pass).toBe(false);
    expect(result.findings).toEqual(
      expect.arrayContaining([expect.stringContaining("Step C")])
    );
  });
});

// --- validateAgentDefinition ---

describe("validateAgentDefinition", () => {
  it("PASS when all expected fields documented", () => {
    const md = makeAgentDef([
      "Story ID and title",
      "Branch name",
      "Base branch",
    ]);
    const result = validateAgentDefinition(md, [
      "Story ID and title",
      "Branch name",
      "Base branch",
    ]);
    expect(result.pass).toBe(true);
    expect(result.findings).toEqual([]);
  });

  it("FAIL when a field is missing", () => {
    const md = makeAgentDef(["Story ID and title", "Branch name"]);
    const result = validateAgentDefinition(md, [
      "Story ID and title",
      "Branch name",
      "Base branch",
    ]);
    expect(result.pass).toBe(false);
    expect(result.findings).toEqual(
      expect.arrayContaining([expect.stringContaining("Base branch")])
    );
  });

  it("PASS with extra documented fields beyond expected", () => {
    const md = makeAgentDef([
      "Story ID and title",
      "Branch name",
      "Base branch",
      "Extra context",
    ]);
    const result = validateAgentDefinition(md, [
      "Story ID and title",
      "Branch name",
    ]);
    expect(result.pass).toBe(true);
    expect(result.findings).toEqual([]);
  });

  it("handles bold formatting with description after dash", () => {
    const md = `---
name: test
---

## Context You Will Receive

- **Story ID and title** — which story was implemented
- **Branch name** — the feature branch to review
- **Base branch** — the branch to diff against
`;
    const result = validateAgentDefinition(md, [
      "Story ID and title",
      "Branch name",
      "Base branch",
    ]);
    expect(result.pass).toBe(true);
    expect(result.findings).toEqual([]);
  });

  it("FAIL when Context You Will Receive section not found", () => {
    const md = "---\nname: test\n---\n\n## Your Task\n\nDo things.\n";
    const result = validateAgentDefinition(md, ["Story ID and title"]);
    expect(result.pass).toBe(false);
    expect(result.findings).toEqual(
      expect.arrayContaining([
        expect.stringContaining("Context You Will Receive"),
      ])
    );
  });

  it("FAIL when multiple fields missing (reports all)", () => {
    const md = makeAgentDef(["Story ID and title"]);
    const result = validateAgentDefinition(md, [
      "Story ID and title",
      "Branch name",
      "Base branch",
      "Expected files",
    ]);
    expect(result.pass).toBe(false);
    expect(result.findings.length).toBe(3);
  });
});

// --- checkInlineACs ---

describe("checkInlineACs", () => {
  it("returns present: true when Acceptance Criteria: in reviewer prompt", () => {
    const md = makeReviewLoop({
      reviewerProse:
        "Acceptance Criteria:\n    1. AC one\n    2. AC two\n\n    Review the code.",
    });
    const result = checkInlineACs(md);
    expect(result.present).toBe(true);
  });

  it("returns present: false when no Acceptance Criteria: in reviewer prompt", () => {
    const md = makeReviewLoop();
    const result = checkInlineACs(md);
    expect(result.present).toBe(false);
  });

  it("returns present: false when Acceptance Criteria appears outside prompt block", () => {
    // AC text in Step B prose, not in the reviewer prompt block
    const md = `# Test

## Step A: Spawn Reviewer Subagent

\`\`\`
Task tool invocation:
  subagent_type: "epic-reviewer"
  prompt: |
    Branch: {branchName}
    Base branch: {baseBranch}
    Story file: {storyFilePath}
    Round: {round}
    Output path: docs/progress/findings.md
    Expected files: {story.touches}

    Review the code.
\`\`\`

## Step B: Decision Point

Acceptance Criteria: these are outside the prompt block.
`;
    const result = checkInlineACs(md);
    expect(result.present).toBe(false);
  });
});

// --- parseArgs ---

describe("parseArgs", () => {
  it("parses --review-loop argument", () => {
    const result = parseArgs(["--review-loop", "/path/to/review-loop.md"]);
    expect(result.reviewLoop).toBe("/path/to/review-loop.md");
  });

  it("parses --reviewer-agent argument", () => {
    const result = parseArgs(["--reviewer-agent", "/path/to/epic-reviewer.md"]);
    expect(result.reviewerAgent).toBe("/path/to/epic-reviewer.md");
  });

  it("parses --fixer-agent argument", () => {
    const result = parseArgs(["--fixer-agent", "/path/to/epic-fixer.md"]);
    expect(result.fixerAgent).toBe("/path/to/epic-fixer.md");
  });

  it("uses default paths when not specified", () => {
    const result = parseArgs([]);
    expect(result.reviewLoop).toContain("review-loop.md");
    expect(result.reviewerAgent).toContain("epic-reviewer.md");
    expect(result.fixerAgent).toContain("epic-fixer.md");
  });
});

// --- Integration tests (reading real files) ---

describe("integration: validate real files", () => {
  const projectRoot = resolve(new URL(import.meta.url).pathname, "../../..");
  const reviewLoopPath = resolve(
    projectRoot,
    ".claude/skills/epic-orchestrator/review-loop.md"
  );
  const reviewerAgentPath = resolve(
    projectRoot,
    ".claude/agents/epic-reviewer.md"
  );
  const fixerAgentPath = resolve(projectRoot, ".claude/agents/epic-fixer.md");

  it("PASS: review-loop.md reviewer prompt has all required fields", () => {
    const content = readFileSync(reviewLoopPath, "utf-8");
    const result = validateReviewerPrompt(content);
    expect(result.pass).toBe(true);
    expect(result.findings).toEqual([]);
  });

  it("PASS: review-loop.md fixer prompt has all required fields", () => {
    const content = readFileSync(reviewLoopPath, "utf-8");
    const result = validateFixerPrompt(content);
    expect(result.pass).toBe(true);
    expect(result.findings).toEqual([]);
  });

  it("PASS: epic-reviewer.md documents all expected context fields", () => {
    const content = readFileSync(reviewerAgentPath, "utf-8");
    const result = validateAgentDefinition(content, [
      "Story ID and title",
      "Branch name",
      "Base branch",
      "Story file path",
      "Round number",
      "Output path",
      "Expected files",
    ]);
    expect(result.pass).toBe(true);
    expect(result.findings).toEqual([]);
  });

  it("PASS: epic-fixer.md documents all expected context fields", () => {
    const content = readFileSync(fixerAgentPath, "utf-8");
    const result = validateAgentDefinition(content, [
      "Story ID and title",
      "Branch name",
      "Base branch",
      "Story file path",
      "Findings document path",
      "Round number",
      "Expected files",
      "Coverage baseline",
    ]);
    expect(result.pass).toBe(true);
    expect(result.findings).toEqual([]);
  });
});
