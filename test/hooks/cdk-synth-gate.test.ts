import { describe, it, expect } from "vitest";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  hasInfraChanges,
  parseSynthResult,
  parseArgs,
} = require("../../.claude/hooks/cdk-synth-gate.cjs");

// --- hasInfraChanges ---

describe("hasInfraChanges", () => {
  it("returns true when diff includes infra/ files", () => {
    const diff = "infra/stacks/auth.ts\nbackend/handler.ts";
    expect(hasInfraChanges(diff, "infra/")).toBe(true);
  });

  it("returns false when diff has no infra/ files", () => {
    const diff = "backend/handler.ts\nfrontend/App.tsx";
    expect(hasInfraChanges(diff, "infra/")).toBe(false);
  });

  it("returns false when diff is empty", () => {
    expect(hasInfraChanges("", "infra/")).toBe(false);
  });

  it("returns true when only infra files changed", () => {
    expect(hasInfraChanges("infra/bin/app.ts", "infra/")).toBe(true);
  });

  it("handles custom infra dir prefix", () => {
    expect(
      hasInfraChanges("custom-infra/stacks/main.ts", "custom-infra/")
    ).toBe(true);
  });

  it("does not false-positive on partial prefix match", () => {
    // "infrastructure/" should not match "infra/" prefix
    expect(hasInfraChanges("infrastructure/stacks/main.ts", "infra/")).toBe(
      false
    );
  });
});

// --- parseSynthResult ---

describe("parseSynthResult", () => {
  it("PASS when exit code 0", () => {
    const result = parseSynthResult(0, "");
    expect(result.pass).toBe(true);
  });

  it("FAIL when exit code non-zero with error message", () => {
    const result = parseSynthResult(
      1,
      "Error: Cannot find module '@ai-learning-hub/types'"
    );
    expect(result.pass).toBe(false);
    expect(result.error).toContain("Cannot find module");
  });

  it("FAIL when exit code non-zero, preserves full stderr", () => {
    const stderr =
      "Error: Circular dependency\n  Stack A -> Stack B -> Stack A";
    const result = parseSynthResult(1, stderr);
    expect(result.pass).toBe(false);
    expect(result.error).toContain("Circular dependency");
    expect(result.error).toContain("Stack A -> Stack B -> Stack A");
  });

  it("PASS when exit code 0 even with stderr warnings", () => {
    const result = parseSynthResult(0, "Warning: deprecated construct used");
    expect(result.pass).toBe(true);
  });
});

// --- parseArgs ---

describe("parseArgs", () => {
  it("parses --base-branch argument", () => {
    const result = parseArgs(["--base-branch", "develop"]);
    expect(result.baseBranch).toBe("develop");
  });

  it("parses --infra-dir argument", () => {
    const result = parseArgs(["--infra-dir", "custom-infra/"]);
    expect(result.infraDir).toBe("custom-infra/");
  });

  it("uses default base branch 'main' when not specified", () => {
    const result = parseArgs([]);
    expect(result.baseBranch).toBe("main");
  });

  it("uses default infra dir 'infra/' when not specified", () => {
    const result = parseArgs([]);
    expect(result.infraDir).toBe("infra/");
  });
});
