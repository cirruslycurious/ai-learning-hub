#!/usr/bin/env node
/**
 * story-guard.cjs - Enforce story readiness before dev-story execution
 *
 * PreToolUse hook on Task tool. When a subagent is spawned whose prompt
 * references dev-story with a story file path, validates that the story file:
 *   1. EXISTS as a standalone file (not embedded in epic/progress docs)
 *   2. Has required YAML frontmatter (id, title)
 *   3. Has Acceptance Criteria (≥2 concrete items)
 *   4. Has Dev Notes / Task Breakdown (non-empty)
 *   5. Has ready-for-dev or done status (if status field present)
 *
 * This is the deterministic enforcement backing SKILL.md Phase 1.2 + 1.2a.
 * The SKILL.md prose tells the agent what to do; this hook BLOCKS if it doesn't.
 *
 * Exit codes:
 *   0 = allow (or not a dev-story invocation)
 *   2 = fatal error (fail closed)
 *
 * Output: JSON with permissionDecision: "deny" + reason on failure
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

// Toggle: set STORY_GUARD_ENABLED=false to disable (e.g., during manual dev)
const ENABLED = process.env.STORY_GUARD_ENABLED !== "false";

// Minimum acceptance criteria count
const MIN_AC_COUNT = 2;

// Valid story statuses for implementation
const VALID_STATUSES = ["ready-for-dev", "done"];

// Statuses that explicitly indicate NOT ready
const INVALID_STATUSES = ["draft", "created", "backlog"];

if (require.main === module) {
  let input = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (chunk) => (input += chunk));
  process.stdin.on("end", () => {
    if (!ENABLED) {
      process.exit(0);
    }

    try {
      const data = JSON.parse(input);
      const result = checkStoryReadiness(data);

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
      // Fail CLOSED — if we can't parse, block execution
      console.error(
        `📋 story-guard: Failed to parse input (${err.message}). Blocking for safety.`
      );
      process.exit(2);
    }
  });
}

function checkStoryReadiness(data) {
  const toolName = data.tool_name || "";
  const toolInput = data.tool_input || {};

  // Handle both invocation paths:
  // 1. Skill tool: skill="bmad-bmm-dev-story", args="<path>"
  // 2. Task tool: prompt contains dev-story reference with story path
  let storyPathArg = "";

  if (toolName === "Skill") {
    // Direct Skill invocation
    const skill = toolInput.skill || "";
    if (skill !== "bmad-bmm-dev-story") {
      return {};
    }
    storyPathArg = toolInput.args || "";
  } else {
    // Task tool — check if prompt references dev-story with a story path
    const prompt = toolInput.prompt || "";
    const description = toolInput.description || "";
    const combined = `${prompt} ${description}`.toLowerCase();

    // Only intercept if this Task is about dev-story
    if (
      !combined.includes("dev-story") &&
      !combined.includes("dev story") &&
      !combined.includes("bmad-bmm-dev-story")
    ) {
      return {};
    }

    // Try to extract a story file path from the prompt
    // Common patterns: "story file at <path>", "story: <path>", just a .md path
    const pathMatch = prompt.match(
      /(?:story\s+(?:file\s+)?(?:at|path|:)\s*)?(\S+\/stories\/\S+\.md)/i
    );
    if (pathMatch) {
      storyPathArg = pathMatch[1];
    } else {
      // Look for any .md path in _bmad-output
      const mdMatch = prompt.match(
        /(_bmad-output\S+\.md|implementation-artifacts\S+\.md)/i
      );
      if (mdMatch) {
        storyPathArg = mdMatch[1];
      }
    }
  }

  // Extract story file path from args
  const storyPath = resolveStoryPath(storyPathArg);

  if (!storyPath) {
    // No path provided — dev-story is running in standalone discovery mode.
    // It will find its own story via sprint-status.yaml or filesystem search.
    // The readiness gate in instructions.xml handles validation for that path.
    // The hook can only validate when a specific path is given.
    return {};
  }

  // 1. Check file exists
  if (!fs.existsSync(storyPath)) {
    return {
      decision: "deny",
      reason: [
        `📋 Story Guard: Story file not found: ${storyPath}`,
        "",
        "The orchestrator CANNOT proceed without a standalone story file.",
        "Planning docs, epic descriptions, and progress files are NOT valid substitutes.",
        "",
        "Options:",
        "  a) Create the story first: /bmad-bmm-create-story",
        "  b) Cancel this dev-story invocation",
        "",
        "Bypass: STORY_GUARD_ENABLED=false (not recommended)",
      ].join("\n"),
    };
  }

  // 2. Read and validate story content
  let content;
  try {
    content = fs.readFileSync(storyPath, "utf8");
  } catch (err) {
    return {
      decision: "deny",
      reason: `📋 Story Guard: Cannot read story file: ${err.message}`,
    };
  }

  const failures = [];

  // 2a. Check YAML frontmatter exists and has required fields
  const frontmatter = parseFrontmatter(content);
  if (!frontmatter) {
    failures.push("✗ No YAML frontmatter found");
  } else {
    if (!frontmatter.id || String(frontmatter.id).trim() === "") {
      failures.push("✗ Missing required frontmatter field: id");
    }
    if (!frontmatter.title || String(frontmatter.title).trim() === "") {
      failures.push("✗ Missing required frontmatter field: title");
    }

    // 2b. Status check (only if field exists)
    if (frontmatter.status) {
      const status = String(frontmatter.status).toLowerCase().trim();
      if (INVALID_STATUSES.includes(status)) {
        failures.push(
          `✗ Status is "${status}" — must be "ready-for-dev" or "done" to implement`
        );
      } else if (
        VALID_STATUSES.length > 0 &&
        !VALID_STATUSES.includes(status)
      ) {
        // Unknown status — warn but don't block (might be a custom workflow status)
        // Only block on explicitly invalid statuses
      }
    }
  }

  // 2c. Check for Acceptance Criteria section
  const acCount = countAcceptanceCriteria(content);
  if (acCount < MIN_AC_COUNT) {
    failures.push(
      `✗ Acceptance Criteria: found ${acCount}, need ≥${MIN_AC_COUNT} concrete criteria`
    );
  }

  // 2d. Check for Dev Notes / Task Breakdown
  if (!hasDevNotes(content)) {
    failures.push("✗ Missing: Dev Notes / Task Breakdown section");
  }

  if (failures.length > 0) {
    const storyId = frontmatter?.id || path.basename(storyPath, ".md");
    return {
      decision: "deny",
      reason: [
        `📋 Story Guard: Story ${storyId} is NOT implementation-ready`,
        "",
        ...failures,
        "",
        "The story file exists but lacks sufficient detail for implementation.",
        "Without these sections, the dev agent will hallucinate implementation details.",
        "",
        "Options:",
        "  a) Complete the story: /bmad-bmm-create-story",
        "  b) Cancel this dev-story invocation",
        "",
        "Bypass: STORY_GUARD_ENABLED=false (not recommended)",
      ].join("\n"),
    };
  }

  // All checks pass
  return {};
}

/**
 * Resolve the story file path from the args string.
 * Args could be:
 *   - A direct file path: "_bmad-output/implementation-artifacts/stories/2.1.md"
 *   - A story ID that needs resolution: "2.1"
 *   - Empty (standalone dev-story discovers its own)
 */
function resolveStoryPath(args) {
  if (!args || args.trim() === "") {
    // No args — dev-story is running standalone, it handles discovery itself.
    // We can't validate here because we don't know which story it will pick.
    // Return null to signal "skip validation" for standalone mode.
    return null;
  }

  const trimmed = args.trim();

  // If it looks like a file path (contains / or .md), use directly
  if (trimmed.includes("/") || trimmed.endsWith(".md")) {
    // Handle both absolute and relative paths
    if (path.isAbsolute(trimmed)) {
      return trimmed;
    }
    // Relative to project dir
    const projectDir =
      process.env.CLAUDE_PROJECT_DIR || process.cwd();
    return path.join(projectDir, trimmed);
  }

  // Looks like a story ID — try to find the file
  const projectDir =
    process.env.CLAUDE_PROJECT_DIR || process.cwd();
  const candidates = [
    path.join(
      projectDir,
      "_bmad-output/implementation-artifacts/stories",
      `${trimmed}.md`
    ),
    path.join(
      projectDir,
      `_bmad-output/implementation-artifacts/stories/story-${trimmed}.md`
    ),
  ];

  // Also try glob-like search
  try {
    const globResult = execSync(
      `find "${projectDir}/_bmad-output" -path "*/stories/*${trimmed}*" -name "*.md" 2>/dev/null | head -1`,
      { encoding: "utf8", timeout: 3000 }
    ).trim();
    if (globResult) {
      candidates.unshift(globResult);
    }
  } catch {
    // find not available or timed out, continue with candidates
  }

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  // Return the primary expected path so the "not found" error is helpful
  return candidates[0];
}

/**
 * Parse YAML frontmatter from markdown content.
 * Returns object with parsed fields, or null if no frontmatter.
 */
function parseFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return null;

  const yaml = match[1];
  const result = {};

  // Simple YAML parser for flat key-value pairs and arrays
  for (const line of yaml.split("\n")) {
    const kvMatch = line.match(/^(\w[\w_-]*)\s*:\s*(.*)$/);
    if (kvMatch) {
      const key = kvMatch[1].trim();
      let value = kvMatch[2].trim();

      // Handle quoted strings
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      // Handle inline arrays [a, b, c]
      if (value.startsWith("[") && value.endsWith("]")) {
        value = value
          .slice(1, -1)
          .split(",")
          .map((s) => s.trim().replace(/^['"]|['"]$/g, ""))
          .filter(Boolean);
      }

      result[key] = value;
    }
  }

  return Object.keys(result).length > 0 ? result : null;
}

/**
 * Count acceptance criteria in the story content.
 * Looks for an "Acceptance Criteria" heading and counts list items under it.
 * Filters out vague/placeholder criteria.
 */
function countAcceptanceCriteria(content) {
  // Find AC section — look for heading
  const acMatch = content.match(
    /^#{1,4}\s*(?:Acceptance\s+Criteria|ACs?)\s*$/im
  );
  if (!acMatch) return 0;

  // Get content after the heading until the next heading of same or higher level
  const afterHeading = content.slice(acMatch.index + acMatch[0].length);
  const nextHeading = afterHeading.match(/\n#{1,4}\s+\S/);
  const acSection = nextHeading
    ? afterHeading.slice(0, nextHeading.index)
    : afterHeading;

  // Count list items (- or * or numbered) AND table rows
  const listItems = acSection.match(/^[\s]*[-*]\s+.+|^[\s]*\d+[.)]\s+.+/gm) || [];

  // Count table data rows (rows starting with |, excluding header and separator rows)
  const tableRows = (acSection.match(/^\|[^|].*\|/gm) || []).filter((row) => {
    const trimmed = row.trim();
    // Skip separator rows (|---|---|...) and header rows
    if (/^\|[\s-:|]+\|$/.test(trimmed)) return false;
    // Skip header row (first non-separator row — heuristic: contains # or Given/When/Then/Criterion)
    if (/^\|\s*#\s*\|/i.test(trimmed)) return false;
    // Must have meaningful content (not just pipes and spaces)
    const cellContent = trimmed.replace(/\|/g, "").trim();
    return cellContent.length >= 5;
  });

  const items = [...listItems, ...tableRows];
  if (items.length === 0) return 0;

  // Filter out vague placeholders
  const vaguePatterns = [
    /^it works$/i,
    /^everything (?:works|functions|is) correctly$/i,
    /^should work$/i,
    /^tbd$/i,
    /^todo$/i,
    /^placeholder$/i,
    /^n\/a$/i,
  ];

  let count = 0;
  for (const item of items) {
    const text = item.replace(/^[\s]*[-*]\s+|^[\s]*\d+[.)]\s+|^\|[^|]*\|\s*/, "").trim();
    if (text.length < 5) continue; // Too short to be meaningful
    const isVague = vaguePatterns.some((p) => p.test(text));
    if (!isVague) count++;
  }

  return count;
}

/**
 * Check if the story has a Dev Notes / Task Breakdown section with content.
 * Searches for tasks/subtasks within the entire section subtree, including
 * nested subheadings (e.g., ### Tasks inside ## Dev Notes).
 */
function hasDevNotes(content) {
  // Look for dev notes section heading at any level
  const headingMatch = content.match(
    /^(#{1,4})\s*(?:Dev\s+Notes|Tasks?|Technical\s+Notes|Implementation\s+Notes|Task\s+Breakdown|Subtasks?)\s*$/im
  );
  if (!headingMatch) return false;

  const headingLevel = headingMatch[1].length; // e.g., 2 for ##

  // Get content after heading until the next heading of SAME or HIGHER level
  // (not subheadings — those are part of this section's subtree)
  const afterHeading = content.slice(
    headingMatch.index + headingMatch[0].length
  );

  // Build regex for same-or-higher level heading: #{1,headingLevel} followed by space
  // e.g., for ## Dev Notes (level 2), stop at ## or # but NOT ### or ####
  const sameLevelPattern = new RegExp(
    `\\n#{1,${headingLevel}}\\s+\\S`
  );
  const nextSameLevel = afterHeading.match(sameLevelPattern);
  const section = nextSameLevel
    ? afterHeading.slice(0, nextSameLevel.index)
    : afterHeading;

  // Check for any list items or checkbox items anywhere in the subtree
  const hasItems =
    /^[\s]*[-*]\s+.{5,}|^[\s]*\d+[.)]\s+.{5,}|^[\s]*[-*]\s+\[[ x]\]\s+.{5,}/im.test(
      section
    );

  return hasItems;
}

// Export for testing
module.exports = {
  checkStoryReadiness,
  parseFrontmatter,
  countAcceptanceCriteria,
  hasDevNotes,
  resolveStoryPath,
};
