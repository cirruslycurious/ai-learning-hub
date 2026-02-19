import { describe, it, expect } from "vitest";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  checkCommittedChanges,
  checkUntrackedFiles,
  parseArgs,
} = require("../../.claude/hooks/commit-gate.cjs");

// --- checkCommittedChanges ---

describe("checkCommittedChanges", () => {
  it("PASS when git diff --stat shows changed files", () => {
    const output =
      " backend/functions/auth/handler.ts | 45 +++\n 2 files changed, 45 insertions(+)";
    const result = checkCommittedChanges(output);
    expect(result.pass).toBe(true);
  });

  it("FAIL when git diff --stat shows zero changes (empty string)", () => {
    const result = checkCommittedChanges("");
    expect(result.pass).toBe(false);
    expect(result.finding).toContain("No changes committed");
  });

  it("FAIL when git diff --stat shows only whitespace", () => {
    const result = checkCommittedChanges("  \n  \n");
    expect(result.pass).toBe(false);
    expect(result.finding).toContain("No changes committed");
  });

  it("PASS when diff shows only one file changed", () => {
    const output = " README.md | 1 +\n 1 file changed, 1 insertion(+)";
    const result = checkCommittedChanges(output);
    expect(result.pass).toBe(true);
  });
});

// --- checkUntrackedFiles ---

describe("checkUntrackedFiles", () => {
  it("PASS when no untracked files", () => {
    const result = checkUntrackedFiles("", ["backend/functions/auth"]);
    expect(result.pass).toBe(true);
    expect(result.findings).toEqual([]);
  });

  it("FAIL when untracked .ts file in story-relevant dir", () => {
    const result = checkUntrackedFiles(
      "?? backend/functions/auth/handler.ts\n",
      ["backend/functions/auth"]
    );
    expect(result.pass).toBe(false);
    expect(result.findings).toContain("backend/functions/auth/handler.ts");
  });

  it("FAIL when untracked .test.ts file in story-relevant dir", () => {
    const result = checkUntrackedFiles(
      "?? backend/functions/auth/handler.test.ts\n",
      ["backend/functions/auth"]
    );
    expect(result.pass).toBe(false);
    expect(result.findings).toContain("backend/functions/auth/handler.test.ts");
  });

  it("PASS when untracked files exist but NOT in story-relevant dirs", () => {
    const result = checkUntrackedFiles("?? docs/notes.md\n", [
      "backend/functions/auth",
    ]);
    expect(result.pass).toBe(true);
    expect(result.findings).toEqual([]);
  });

  it("PASS when untracked non-TS files in story-relevant dirs", () => {
    const result = checkUntrackedFiles(
      "?? backend/functions/auth/README.md\n",
      ["backend/functions/auth"]
    );
    expect(result.pass).toBe(true);
    expect(result.findings).toEqual([]);
  });

  it("FAIL when multiple untracked TS files across dirs", () => {
    const result = checkUntrackedFiles(
      "?? backend/functions/auth/a.ts\n?? infra/stacks/new.ts\n",
      ["backend/functions/auth", "infra/stacks"]
    );
    expect(result.pass).toBe(false);
    expect(result.findings).toHaveLength(2);
  });

  it("PASS when modified (M) files exist (not untracked)", () => {
    const result = checkUntrackedFiles(
      " M backend/functions/auth/handler.ts\n",
      ["backend/functions/auth"]
    );
    expect(result.pass).toBe(true);
    expect(result.findings).toEqual([]);
  });

  it("PASS when untracked .tsx file is outside story dirs", () => {
    const result = checkUntrackedFiles("?? frontend/components/New.tsx\n", [
      "backend/functions/auth",
    ]);
    expect(result.pass).toBe(true);
    expect(result.findings).toEqual([]);
  });

  it("FAIL when untracked .tsx file is in story-relevant dir", () => {
    const result = checkUntrackedFiles("?? frontend/components/Login.tsx\n", [
      "frontend/components",
    ]);
    expect(result.pass).toBe(false);
    expect(result.findings).toContain("frontend/components/Login.tsx");
  });

  it("PASS when storyDirs is empty (no filtering)", () => {
    const result = checkUntrackedFiles(
      "?? backend/functions/auth/handler.ts\n",
      []
    );
    expect(result.pass).toBe(true);
    expect(result.findings).toEqual([]);
  });
});

// --- parseArgs ---

describe("parseArgs", () => {
  it("parses --base-branch argument", () => {
    const result = parseArgs(["--base-branch", "develop"]);
    expect(result.baseBranch).toBe("develop");
  });

  it("parses --story-dirs argument (comma-separated)", () => {
    const result = parseArgs([
      "--story-dirs",
      "backend/functions/auth,infra/stacks",
    ]);
    expect(result.storyDirs).toEqual([
      "backend/functions/auth",
      "infra/stacks",
    ]);
  });

  it("uses default base branch 'main' when not specified", () => {
    const result = parseArgs([]);
    expect(result.baseBranch).toBe("main");
  });

  it("parses both flags together", () => {
    const result = parseArgs([
      "--base-branch",
      "develop",
      "--story-dirs",
      "backend/functions/auth",
    ]);
    expect(result.baseBranch).toBe("develop");
    expect(result.storyDirs).toEqual(["backend/functions/auth"]);
  });

  it("handles empty --story-dirs", () => {
    const result = parseArgs(["--story-dirs", ""]);
    expect(result.storyDirs).toEqual([]);
  });
});
