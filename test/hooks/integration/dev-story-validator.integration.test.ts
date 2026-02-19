import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { execSync } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  checkNoDuplicateStoryParse,
  checkNoDoubleRead,
  checkNoGhostProjectContext,
  checkSprintStatusReadOnce,
  checkSingleDoDSource,
  checkNoDuplicateVariable,
  checkBraceConsistency,
} = require("../../../.claude/hooks/dev-story-validator.cjs");

// ─── File paths ─────────────────────────────────────────────────────────────

const ROOT = resolve(__dirname, "../../..");
const INSTRUCTIONS_PATH = resolve(
  ROOT,
  "_bmad/bmm/workflows/4-implementation/dev-story/instructions.xml"
);
const WORKFLOW_PATH = resolve(
  ROOT,
  "_bmad/bmm/workflows/4-implementation/dev-story/workflow.yaml"
);
const CHECKLIST_PATH = resolve(
  ROOT,
  "_bmad/bmm/workflows/4-implementation/dev-story/checklist.md"
);

const xml = readFileSync(INSTRUCTIONS_PATH, "utf-8");
const yaml = readFileSync(WORKFLOW_PATH, "utf-8");
const checklist = readFileSync(CHECKLIST_PATH, "utf-8");

// ─── 3.1: No duplicate story parse in Step 2 ───────────────────────────────

describe("3.1 — No duplicate story parse in Step 2", () => {
  it("instructions.xml Step 2 has no duplicate parse block", () => {
    const result = checkNoDuplicateStoryParse(xml);
    expect(result.pass).toBe(true);
    expect(
      result.findings.filter((f: string) => !f.includes("not found"))
    ).toEqual([]);
  });
});

// ─── 3.2: No double-read after task_check anchor ───────────────────────────

describe("3.2 — No double-read after task_check anchor", () => {
  it("instructions.xml has no Read COMPLETE story file after anchor", () => {
    const result = checkNoDoubleRead(xml);
    expect(result.pass).toBe(true);
    expect(
      result.findings.filter((f: string) => f.includes("double read"))
    ).toEqual([]);
  });
});

// ─── 3.3: No ghost project_context ─────────────────────────────────────────

describe("3.3 — No ghost project_context variable", () => {
  it("workflow.yaml has no project_context key", () => {
    const result = checkNoGhostProjectContext(yaml, xml);
    expect(
      result.findings.filter((f: string) => f.includes("workflow.yaml"))
    ).toEqual([]);
  });

  it("instructions.xml Step 2 has no {project_context} reference", () => {
    const result = checkNoGhostProjectContext(yaml, xml);
    expect(
      result.findings.filter((f: string) => f.includes("{project_context}"))
    ).toEqual([]);
  });

  it("checklist.md references CLAUDE.md not project-context.md", () => {
    expect(checklist).not.toContain("project-context.md");
    expect(checklist).toContain("CLAUDE.md");
  });
});

// ─── 3.4: Sprint-status loaded once ────────────────────────────────────────

describe("3.4 — Sprint-status loaded once", () => {
  it("Steps 4 and 9 do not re-load sprint-status.yaml fully", () => {
    const result = checkSprintStatusReadOnce(xml);
    expect(result.pass).toBe(true);
    expect(result.findings).toEqual([]);
  });
});

// ─── 3.5: Single DoD source ────────────────────────────────────────────────

describe("3.5 — Single DoD source", () => {
  it("Step 9 has no inline DoD validation list", () => {
    const result = checkSingleDoDSource(xml);
    expect(
      result.findings.filter((f: string) => f.includes("inline DoD"))
    ).toEqual([]);
  });

  it("Step 10 has no DoD re-execution", () => {
    const result = checkSingleDoDSource(xml);
    expect(
      result.findings.filter((f: string) => f.includes("Step 10"))
    ).toEqual([]);
  });
});

// ─── 3.6: No duplicate variable ────────────────────────────────────────────

describe("3.6 — No duplicate variable", () => {
  it("workflow.yaml has no story_dir key", () => {
    const result = checkNoDuplicateVariable(yaml);
    expect(result.pass).toBe(true);
  });

  it("instructions.xml has no {story_dir} references", () => {
    // Direct string check — story_dir should not appear as a variable reference
    expect(xml).not.toMatch(/\{story_dir\}/);
  });
});

// ─── 3.7: Brace consistency ────────────────────────────────────────────────

describe("3.7 — Brace consistency", () => {
  it("all sprint_status references use double-brace {{sprint_status}}", () => {
    const result = checkBraceConsistency(xml);
    expect(result.pass).toBe(true);
    expect(result.findings).toEqual([]);
  });
});

// ─── CLI execution ──────────────────────────────────────────────────────────

describe("CLI execution", () => {
  it("dev-story-validator.cjs exits 0 with all-pass JSON", () => {
    const scriptPath = resolve(ROOT, ".claude/hooks/dev-story-validator.cjs");
    const output = execSync(`node "${scriptPath}"`, {
      cwd: ROOT,
      encoding: "utf-8",
    });
    const result = JSON.parse(output);
    expect(result.pass).toBe(true);
    expect(result.findings).toEqual([]);
  });
});
