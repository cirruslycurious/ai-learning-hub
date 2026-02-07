#!/usr/bin/env node
/**
 * file-guard.js - Protect critical files from auto-modification
 *
 * Blocks writes to protected files, escalates for sensitive directories
 * Part of AI Learning Hub's deterministic enforcement layer
 */

// Allowlist - files that match sensitive patterns but ARE safe to modify
const ALLOWLIST = [
  /\.env\.example$/i,
  /\.env\.sample$/i,
  /\.env\.template$/i,
  /\.env\.schema$/i,
  /\.env\.defaults$/i,
  /\.env\.test$/i,
];

// Blocked files - NEVER auto-modified
const BLOCKED_FILES = [
  "CLAUDE.md",
  ".claude/settings.json",
  ".claude/settings.local.json",
  ".env",
  ".env.local",
  ".env.production",
  ".env.development",
  "package-lock.json",
  "yarn.lock",
  "pnpm-lock.yaml",
  ".gitignore", // Prevent accidental exposure of secrets
];

// Blocked directories - files here are never auto-modified
const BLOCKED_DIRS = [
  ".git/",
  "node_modules/",
  "_bmad-output/planning-artifacts/", // Planning docs are human-owned
];

// Escalate directories - require human approval
const ESCALATE_DIRS = [
  "infra/", // CDK stacks affect production
  ".github/", // CI/CD workflows
  ".claude/hooks/", // Hook scripts are critical
];

// Read input from stdin
let input = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => (input += chunk));
process.stdin.on("end", () => {
  try {
    const data = JSON.parse(input);
    const toolName = data.tool_name || "";

    // Only guard write operations - reads should always be allowed
    const writeTools = ["Write", "Edit", "NotebookEdit"];
    if (!writeTools.includes(toolName)) {
      process.exit(0); // Allow all non-write operations
    }

    const filePath = data.tool_input?.file_path || data.tool_input?.path || "";
    const result = checkFile(filePath);

    if (result.decision) {
      console.log(
        JSON.stringify({
          hookSpecificOutput: {
            hookEventName: "PreToolUse",
            permissionDecision: result.decision,
            permissionDecisionReason: result.reason,
          },
        })
      );
    }

    process.exit(0);
  } catch (err) {
    // Fail CLOSED on parse error — do not allow unvalidated operations
    console.error(
      `🔒 file-guard: Failed to parse input (${err.message}). Blocking operation for safety.`
    );
    process.exit(2);
  }
});

function checkFile(filePath) {
  if (!filePath) return {};

  // Normalize path for matching
  const normalizedPath = filePath.replace(/\\/g, "/");
  const fileName = normalizedPath.split("/").pop();

  // Check allowlist first
  for (const pattern of ALLOWLIST) {
    if (pattern.test(normalizedPath)) {
      return {}; // Explicitly allowed
    }
  }

  // Check blocked files
  for (const blocked of BLOCKED_FILES) {
    if (normalizedPath.endsWith(blocked) || fileName === blocked) {
      return {
        decision: "deny",
        reason: `🔒 Protected file: ${blocked} cannot be auto-modified. This file is human-owned.`,
      };
    }
  }

  // Check blocked directories
  for (const blockedDir of BLOCKED_DIRS) {
    if (normalizedPath.includes(blockedDir)) {
      return {
        decision: "deny",
        reason: `🔒 Protected directory: Files in ${blockedDir} cannot be auto-modified.`,
      };
    }
  }

  // Check escalate directories
  for (const escalateDir of ESCALATE_DIRS) {
    if (normalizedPath.includes(escalateDir)) {
      return {
        decision: "ask",
        reason: `⚠️ Modifying ${escalateDir} file. Please review: ${filePath}`,
      };
    }
  }

  // Check for sensitive file patterns
  if (/\.(pem|key|crt|p12|pfx)$/i.test(normalizedPath)) {
    return {
      decision: "deny",
      reason: `🔒 Certificate/key file: ${fileName} cannot be auto-modified.`,
    };
  }

  if (/credentials|secrets|passwords/i.test(normalizedPath)) {
    return {
      decision: "deny",
      reason: `🔒 Sensitive file pattern detected: ${fileName}`,
    };
  }

  return {}; // Allow
}
