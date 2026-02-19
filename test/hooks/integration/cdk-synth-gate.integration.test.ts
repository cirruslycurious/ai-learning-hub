import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createRequire } from "node:module";
import { execSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const require = createRequire(import.meta.url);
const {
  hasInfraChanges,
} = require("../../../.claude/hooks/cdk-synth-gate.cjs");

/**
 * Helper: create a bare "origin" repo and a working clone with infra/ directory.
 */
function createTestRepo() {
  const root = mkdtempSync(join(tmpdir(), "cdk-synth-gate-int-"));
  const bareDir = join(root, "origin.git");
  const workDir = join(root, "work");

  mkdirSync(bareDir, { recursive: true });
  execSync("git init --bare", { cwd: bareDir });
  execSync(`git clone "${bareDir}" work`, { cwd: root });

  // Initial commit with infra/ and backend/ dirs
  mkdirSync(join(workDir, "infra", "stacks"), { recursive: true });
  mkdirSync(join(workDir, "backend", "functions"), { recursive: true });
  writeFileSync(join(workDir, "infra", "stacks", "main.ts"), "// main stack");
  writeFileSync(
    join(workDir, "backend", "functions", "handler.ts"),
    "// handler"
  );
  writeFileSync(join(workDir, "README.md"), "# Test");
  execSync("git add .", { cwd: workDir });
  execSync('git commit -m "Initial commit"', { cwd: workDir });
  execSync("git push origin main", { cwd: workDir });

  execSync("git checkout -b feature-branch", { cwd: workDir });

  return { workDir, bareDir, root };
}

function getChangedFiles(workDir: string) {
  return execSync("git diff --name-only origin/main...HEAD", {
    cwd: workDir,
    encoding: "utf8",
  });
}

describe("cdk-synth-gate integration", () => {
  let testRepo: { workDir: string; bareDir: string; root: string };

  beforeEach(() => {
    testRepo = createTestRepo();
  });

  afterEach(() => {
    rmSync(testRepo.root, { recursive: true, force: true });
  });

  it("detects infra changes when infra/stacks file modified", () => {
    const { workDir } = testRepo;

    writeFileSync(join(workDir, "infra", "stacks", "auth.ts"), "// auth stack");
    execSync("git add .", { cwd: workDir });
    execSync('git commit -m "Add auth stack"', { cwd: workDir });

    const diffOutput = getChangedFiles(workDir);
    expect(hasInfraChanges(diffOutput, "infra/")).toBe(true);
  });

  it("does NOT detect infra changes when only backend files modified", () => {
    const { workDir } = testRepo;

    writeFileSync(
      join(workDir, "backend", "functions", "new-handler.ts"),
      "// new handler"
    );
    execSync("git add .", { cwd: workDir });
    execSync('git commit -m "Add new handler"', { cwd: workDir });

    const diffOutput = getChangedFiles(workDir);
    expect(hasInfraChanges(diffOutput, "infra/")).toBe(false);
  });

  it("detects infra changes when infra/bin file modified", () => {
    const { workDir } = testRepo;

    mkdirSync(join(workDir, "infra", "bin"), { recursive: true });
    writeFileSync(join(workDir, "infra", "bin", "app.ts"), "// app entry");
    execSync("git add .", { cwd: workDir });
    execSync('git commit -m "Add app entry"', { cwd: workDir });

    const diffOutput = getChangedFiles(workDir);
    expect(hasInfraChanges(diffOutput, "infra/")).toBe(true);
  });

  it("detects infra changes mixed with other changes", () => {
    const { workDir } = testRepo;

    writeFileSync(join(workDir, "infra", "stacks", "api.ts"), "// api stack");
    writeFileSync(
      join(workDir, "backend", "functions", "api-handler.ts"),
      "// api handler"
    );
    execSync("git add .", { cwd: workDir });
    execSync('git commit -m "Add API stack and handler"', { cwd: workDir });

    const diffOutput = getChangedFiles(workDir);
    expect(hasInfraChanges(diffOutput, "infra/")).toBe(true);
  });
});
