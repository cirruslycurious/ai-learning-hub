import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createRequire } from "node:module";
import {
  mkdtempSync,
  writeFileSync,
  existsSync,
  rmSync,
  mkdirSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const require = createRequire(import.meta.url);
const {
  getTempDir,
  getStandardPaths,
  findStrayFiles,
  cleanupStrayFiles,
} = require("../../.claude/hooks/temp-cleanup.cjs");

// --- getTempDir ---

describe("getTempDir", () => {
  it("returns .claude/temp/ under project dir", () => {
    expect(getTempDir("/home/user/project")).toBe(
      "/home/user/project/.claude/temp"
    );
  });

  it("handles trailing slash in project dir", () => {
    expect(getTempDir("/home/user/project/")).toBe(
      "/home/user/project/.claude/temp"
    );
  });
});

// --- getStandardPaths ---

describe("getStandardPaths", () => {
  it("returns canonical paths for secrets-scan and test-output", () => {
    const tempDir = "/home/user/project/.claude/temp";
    const paths = getStandardPaths(tempDir);
    expect(paths.secretsScan).toBe(
      "/home/user/project/.claude/temp/secrets-scan.json"
    );
    expect(paths.testOutput).toBe(
      "/home/user/project/.claude/temp/test-output.txt"
    );
    expect(paths.acVerification).toBe(
      "/home/user/project/.claude/temp/ac-verification.json"
    );
  });
});

// --- findStrayFiles ---

describe("findStrayFiles", () => {
  let testDir: string;

  beforeEach(() => {
    testDir = mkdtempSync(join(tmpdir(), "temp-cleanup-test-"));
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it("identifies quality-gate-*.json files at project root", () => {
    writeFileSync(join(testDir, "quality-gate-secrets.json"), "{}");
    const result = findStrayFiles(testDir);
    expect(result).toContain("quality-gate-secrets.json");
  });

  it("identifies secrets-*.json files at project root", () => {
    writeFileSync(join(testDir, "secrets-report.json"), "{}");
    const result = findStrayFiles(testDir);
    expect(result).toContain("secrets-report.json");
  });

  it("returns empty when no stray files exist", () => {
    const result = findStrayFiles(testDir);
    expect(result).toEqual([]);
  });

  it("identifies test-output*.txt and test-results*.txt", () => {
    writeFileSync(join(testDir, "test-output.txt"), "");
    writeFileSync(join(testDir, "test-results.txt"), "");
    const result = findStrayFiles(testDir);
    expect(result).toContain("test-output.txt");
    expect(result).toContain("test-results.txt");
  });

  it("does NOT flag files inside .claude/temp/", () => {
    const tempSubdir = join(testDir, ".claude", "temp");
    mkdirSync(tempSubdir, { recursive: true });
    writeFileSync(join(tempSubdir, "secrets-scan.json"), "{}");
    const result = findStrayFiles(testDir);
    expect(result).toEqual([]);
  });

  it("identifies gitleaks-*.json files", () => {
    writeFileSync(join(testDir, "gitleaks-scan-gate.json"), "{}");
    const result = findStrayFiles(testDir);
    expect(result).toContain("gitleaks-scan-gate.json");
  });

  it("identifies quality-gate-*.log files at project root", () => {
    writeFileSync(join(testDir, "quality-gate-build.log"), "");
    writeFileSync(join(testDir, "quality-gate-lint.log"), "");
    const result = findStrayFiles(testDir);
    expect(result).toContain("quality-gate-build.log");
    expect(result).toContain("quality-gate-lint.log");
  });

  it("identifies build-*.log and test-*.log files at project root", () => {
    writeFileSync(join(testDir, "build-quality-gate-final-check.log"), "");
    writeFileSync(join(testDir, "test-run-output.log"), "");
    const result = findStrayFiles(testDir);
    expect(result).toContain("build-quality-gate-final-check.log");
    expect(result).toContain("test-run-output.log");
  });

  it("does NOT flag legitimate root files like CHANGELOG.md", () => {
    writeFileSync(join(testDir, "CHANGELOG.md"), "# Changes");
    writeFileSync(join(testDir, "package.json"), "{}");
    writeFileSync(join(testDir, "quality-gate-build.log"), "");
    const result = findStrayFiles(testDir);
    expect(result).not.toContain("CHANGELOG.md");
    expect(result).not.toContain("package.json");
    expect(result).toContain("quality-gate-build.log");
  });
});

// --- cleanupStrayFiles ---

describe("cleanupStrayFiles", () => {
  let testDir: string;

  beforeEach(() => {
    testDir = mkdtempSync(join(tmpdir(), "temp-cleanup-test-"));
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it("removes identified stray files and returns count", () => {
    writeFileSync(join(testDir, "quality-gate-secrets.json"), "{}");
    writeFileSync(join(testDir, "test-output.txt"), "");
    const count = cleanupStrayFiles(testDir);
    expect(count).toBe(2);
    expect(existsSync(join(testDir, "quality-gate-secrets.json"))).toBe(false);
    expect(existsSync(join(testDir, "test-output.txt"))).toBe(false);
  });

  it("returns 0 when no stray files exist", () => {
    const count = cleanupStrayFiles(testDir);
    expect(count).toBe(0);
  });

  it("does not remove files that don't match stray patterns", () => {
    writeFileSync(join(testDir, "package.json"), "{}");
    writeFileSync(join(testDir, "quality-gate-secrets.json"), "{}");
    const count = cleanupStrayFiles(testDir);
    expect(count).toBe(1);
    expect(existsSync(join(testDir, "package.json"))).toBe(true);
  });
});
