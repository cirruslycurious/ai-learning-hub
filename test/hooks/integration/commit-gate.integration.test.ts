import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const GATE_SCRIPT = join(
  import.meta.dirname,
  "..",
  "..",
  "..",
  ".claude",
  "hooks",
  "commit-gate.cjs"
);

/**
 * Helper: create a bare "origin" repo and a working clone with a feature branch.
 * Returns { workDir, bareDir } paths.
 */
function createTestRepo() {
  const root = mkdtempSync(join(tmpdir(), "commit-gate-int-"));
  const bareDir = join(root, "origin.git");
  const workDir = join(root, "work");

  // Create bare origin with explicit default branch name
  mkdirSync(bareDir, { recursive: true });
  execSync("git init --bare --initial-branch=main", { cwd: bareDir });

  // Clone it
  execSync(`git clone "${bareDir}" work`, { cwd: root });

  // Configure git identity for CI environments
  execSync('git config user.email "test@example.com"', { cwd: workDir });
  execSync('git config user.name "Test User"', { cwd: workDir });

  // Initial commit on main
  writeFileSync(join(workDir, "README.md"), "# Test");
  execSync("git add README.md", { cwd: workDir });
  execSync('git commit -m "Initial commit"', { cwd: workDir });
  execSync("git push origin main", { cwd: workDir });

  // Create feature branch
  execSync("git checkout -b feature-branch", { cwd: workDir });

  return { workDir, bareDir, root };
}

function runGate(workDir: string, args: string = "") {
  const result = execSync(`node "${GATE_SCRIPT}" --base-branch main ${args}`, {
    cwd: workDir,
    encoding: "utf8",
  });
  return JSON.parse(result);
}

describe("commit-gate integration", () => {
  let testRepo: { workDir: string; bareDir: string; root: string };

  beforeEach(() => {
    testRepo = createTestRepo();
  });

  afterEach(() => {
    rmSync(testRepo.root, { recursive: true, force: true });
  });

  it("PASS: all changes committed", () => {
    const { workDir } = testRepo;

    // Create and commit a file on feature branch
    mkdirSync(join(workDir, "backend", "functions", "auth"), {
      recursive: true,
    });
    writeFileSync(
      join(workDir, "backend", "functions", "auth", "handler.ts"),
      "export const handler = () => {};"
    );
    execSync("git add .", { cwd: workDir });
    execSync('git commit -m "Add handler"', { cwd: workDir });

    const result = runGate(workDir);
    expect(result.pass).toBe(true);
  });

  it("FAIL: empty branch (no changes vs base)", () => {
    const { workDir } = testRepo;
    // Feature branch with no changes
    const result = runGate(workDir);
    expect(result.pass).toBe(false);
    expect(result.findings[0]).toContain("No changes committed");
  });

  it("FAIL: untracked .ts file in story dir", () => {
    const { workDir } = testRepo;

    // Commit one file
    mkdirSync(join(workDir, "backend", "functions", "auth"), {
      recursive: true,
    });
    writeFileSync(
      join(workDir, "backend", "functions", "auth", "handler.ts"),
      "export const handler = () => {};"
    );
    execSync("git add .", { cwd: workDir });
    execSync('git commit -m "Add handler"', { cwd: workDir });

    // Leave another .ts file untracked
    writeFileSync(
      join(workDir, "backend", "functions", "auth", "utils.ts"),
      "export const util = () => {};"
    );

    const result = runGate(workDir, "--story-dirs backend/functions/auth");
    expect(result.pass).toBe(false);
    expect(result.findings).toContain("backend/functions/auth/utils.ts");
  });

  it("PASS: untracked files in non-story dirs", () => {
    const { workDir } = testRepo;

    // Commit story file
    mkdirSync(join(workDir, "backend", "functions", "auth"), {
      recursive: true,
    });
    writeFileSync(
      join(workDir, "backend", "functions", "auth", "handler.ts"),
      "export const handler = () => {};"
    );
    execSync("git add .", { cwd: workDir });
    execSync('git commit -m "Add handler"', { cwd: workDir });

    // Leave .ts file untracked in different dir
    mkdirSync(join(workDir, "frontend", "components"), { recursive: true });
    writeFileSync(
      join(workDir, "frontend", "components", "New.tsx"),
      "export default () => null;"
    );

    const result = runGate(workDir, "--story-dirs backend/functions/auth");
    expect(result.pass).toBe(true);
  });

  it("FAIL: nothing committed (file created but not committed)", () => {
    const { workDir } = testRepo;

    // Create file but don't commit
    mkdirSync(join(workDir, "backend"), { recursive: true });
    writeFileSync(
      join(workDir, "backend", "handler.ts"),
      "export const handler = () => {};"
    );

    const result = runGate(workDir);
    expect(result.pass).toBe(false);
    expect(result.findings[0]).toContain("No changes committed");
  });
});
