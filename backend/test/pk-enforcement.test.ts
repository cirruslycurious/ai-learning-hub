/**
 * PK Construction Enforcement Test (Story 3.5.3, AC1 + AC2)
 *
 * Scans all handler files under backend/functions/ for USER# PK construction.
 * Asserts that the USER# prefix is always constructed from auth-derived values
 * (e.g., auth.userId, auth!.userId) and NEVER from user-controlled input
 * (request body, path params, query params).
 *
 * Prevents IDOR regressions where an attacker could forge the PK to
 * read/write another user's data.
 */
import { describe, it, expect, afterAll } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

const FUNCTIONS_DIR = path.resolve(__dirname, "../functions");

/** Recursively find all .ts handler files (not tests, not .d.ts) */
function findHandlerFiles(dir: string): string[] {
  const files: string[] = [];
  if (!fs.existsSync(dir)) return files;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...findHandlerFiles(fullPath));
    } else if (
      entry.isFile() &&
      entry.name.endsWith(".ts") &&
      !entry.name.endsWith(".test.ts") &&
      !entry.name.endsWith(".d.ts")
    ) {
      files.push(fullPath);
    }
  }
  return files;
}

interface PKViolation {
  file: string;
  line: number;
  content: string;
  reason: string;
}

/**
 * Patterns that indicate USER# is constructed from user-controlled input.
 * These are IDOR-vulnerable because an attacker controls the value.
 */
const UNSAFE_INTERPOLATION_PATTERNS = [
  /USER#\$\{body\./,
  /USER#\$\{event\.body/,
  /USER#\$\{pathParameters\./,
  /USER#\$\{event\.pathParameters/,
  /USER#\$\{queryStringParameters\./,
  /USER#\$\{event\.queryStringParameters/,
  /USER#\$\{req\.body/,
  /USER#\$\{request\.body/,
  /USER#\$\{params\./,
  /USER#\$\{JSON\.parse/,
];

/**
 * Patterns that indicate safe auth-derived userId assignment.
 * The variable `userId` is safe if assigned from these sources.
 * Also includes function parameters named `userId` — these are
 * callback signatures where the middleware/caller provides the
 * auth-derived userId (e.g., entityExistsFn(userId, entityId)).
 */
const AUTH_ASSIGNMENT_PATTERNS = [
  /const\s+userId\s*=\s*auth[!?]?\.userId/,
  /const\s+\{[^}]*?userId[^}]*?\}\s*=\s*(?:ctx\.)?auth/,
  /(?:auth|ctx\.auth)[!?]?\.userId/,
  // Function parameter: function foo(userId: string, ...) or (userId: string, ...)
  /function\s+\w+\s*\(\s*userId\s*:\s*string/,
  /\(\s*userId\s*:\s*string/,
];

/**
 * Scan a single file for USER# PK construction violations.
 * Returns violations where USER# is constructed from user-controlled input.
 */
function scanFileForPKViolations(filePath: string): PKViolation[] {
  const violations: PKViolation[] = [];
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n");
  const rel = path.relative(FUNCTIONS_DIR, filePath);

  // Check if file has any auth-derived userId assignment
  const hasAuthUserId = AUTH_ASSIGNMENT_PATTERNS.some((p) => p.test(content));

  let inBlockComment = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Track block comment state
    if (inBlockComment) {
      if (trimmed.includes("*/")) inBlockComment = false;
      continue;
    }
    if (trimmed.startsWith("/*")) {
      if (!trimmed.includes("*/")) inBlockComment = true;
      continue;
    }
    if (trimmed.startsWith("//") || trimmed.startsWith("*")) continue;

    // Only check lines with USER# in a template literal or string construction
    if (!line.includes("USER#")) continue;

    // Check for directly unsafe interpolation patterns (body, params, etc.)
    for (const pattern of UNSAFE_INTERPOLATION_PATTERNS) {
      if (pattern.test(line)) {
        violations.push({
          file: rel,
          line: i + 1,
          content: trimmed,
          reason: "USER# constructed from user-controlled input (IDOR risk)",
        });
        break; // One violation per line is enough
      }
    }

    // Check template literal interpolations: USER#${someVar}
    const interpolationMatch = /USER#\$\{(\w+)\}/.exec(line);
    if (interpolationMatch) {
      const varName = interpolationMatch[1];

      // Direct auth access is always safe
      if (varName === "auth" || varName === "ctx") continue;

      // If the variable is `userId`, verify it's auth-derived in this file
      if (varName === "userId") {
        if (!hasAuthUserId) {
          violations.push({
            file: rel,
            line: i + 1,
            content: trimmed,
            reason:
              "USER# uses `userId` but no auth-derived assignment found in file",
          });
        }
        continue;
      }

      // Any other variable in USER#${otherVar} is suspicious
      // unless it's clearly from auth (checked above)
      if (!line.includes(`auth`) && !line.includes(`ctx.auth`)) {
        violations.push({
          file: rel,
          line: i + 1,
          content: trimmed,
          reason: `USER# uses variable '${varName}' not traceable to auth context`,
        });
      }
    }
  }

  return violations;
}

describe("PK Construction Enforcement (IDOR Prevention)", () => {
  const handlerFiles = findHandlerFiles(FUNCTIONS_DIR);

  it("should find handler files to scan", () => {
    expect(handlerFiles.length).toBeGreaterThan(0);
  });

  it("all USER# PK constructions use auth-derived identifiers", () => {
    const allViolations: PKViolation[] = [];

    for (const file of handlerFiles) {
      allViolations.push(...scanFileForPKViolations(file));
    }

    if (allViolations.length > 0) {
      const messages = allViolations.map(
        (v) => `  ${v.file}:${v.line} — ${v.reason}\n    ${v.content}`
      );
      expect.fail(
        `IDOR-vulnerable PK construction found:\n\n${messages.join("\n\n")}\n\n` +
          "USER# must be constructed from auth context (auth.userId, auth!.userId), " +
          "never from request body, path params, or query params."
      );
    }
  });
});

describe("PK Enforcement Scanner Detection (Negative Tests)", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "pk-enforcement-"));

  afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("detects USER# constructed from body.userId", () => {
    const filePath = path.join(tmpDir, "unsafe-body.ts");
    fs.writeFileSync(
      filePath,
      [
        "const body = JSON.parse(event.body);",
        "const pk = `USER#${body.userId}`;",
      ].join("\n")
    );

    const violations = scanFileForPKViolations(filePath);
    expect(violations.length).toBeGreaterThanOrEqual(1);
    expect(violations[0].reason).toContain("user-controlled input");
  });

  it("detects USER# constructed from pathParameters", () => {
    const filePath = path.join(tmpDir, "unsafe-params.ts");
    fs.writeFileSync(filePath, "const pk = `USER#${pathParameters.userId}`;\n");

    const violations = scanFileForPKViolations(filePath);
    expect(violations.length).toBeGreaterThanOrEqual(1);
    expect(violations[0].reason).toContain("user-controlled input");
  });

  it("detects USER# constructed from event.pathParameters", () => {
    const filePath = path.join(tmpDir, "unsafe-event-params.ts");
    fs.writeFileSync(
      filePath,
      "const pk = `USER#${event.pathParameters.userId}`;\n"
    );

    const violations = scanFileForPKViolations(filePath);
    expect(violations.length).toBeGreaterThanOrEqual(1);
    expect(violations[0].reason).toContain("user-controlled input");
  });

  it("detects USER# constructed from queryStringParameters", () => {
    const filePath = path.join(tmpDir, "unsafe-query.ts");
    fs.writeFileSync(
      filePath,
      "const pk = `USER#${queryStringParameters.userId}`;\n"
    );

    const violations = scanFileForPKViolations(filePath);
    expect(violations.length).toBeGreaterThanOrEqual(1);
    expect(violations[0].reason).toContain("user-controlled input");
  });

  it("detects USER# with userId not traceable to auth", () => {
    const filePath = path.join(tmpDir, "unsafe-no-auth.ts");
    fs.writeFileSync(
      filePath,
      [
        "const userId = JSON.parse(event.body).userId;",
        "const pk = `USER#${userId}`;",
      ].join("\n")
    );

    const violations = scanFileForPKViolations(filePath);
    expect(violations.length).toBeGreaterThanOrEqual(1);
    expect(violations[0].reason).toContain("no auth-derived assignment");
  });

  it("allows USER# with auth-derived userId (safe pattern)", () => {
    const filePath = path.join(tmpDir, "safe-auth.ts");
    fs.writeFileSync(
      filePath,
      ["const userId = auth!.userId;", "const pk = `USER#${userId}`;"].join(
        "\n"
      )
    );

    const violations = scanFileForPKViolations(filePath);
    expect(violations).toHaveLength(0);
  });

  it("allows USER# with inline auth!.userId (safe pattern)", () => {
    const filePath = path.join(tmpDir, "safe-inline-auth.ts");
    fs.writeFileSync(filePath, "const pk = `USER#${auth!.userId}`;\n");

    const violations = scanFileForPKViolations(filePath);
    expect(violations).toHaveLength(0);
  });
});
