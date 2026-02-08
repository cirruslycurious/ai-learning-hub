#!/usr/bin/env node
/**
 * pipeline-read-tracker.cjs - Track guide file reads for pipeline enforcement
 *
 * PostToolUse hook on Read. When a pipeline guide or agent definition is read,
 * records a breadcrumb so pipeline-guard.cjs can verify guides were actually
 * loaded before artifacts are written.
 *
 * Breadcrumbs are stored in .claude/.pipeline-reads.json with timestamps.
 * Stale breadcrumbs (>2 hours) are ignored by the guard.
 *
 * Part of AI Learning Hub's deterministic enforcement layer
 */

const fs = require("fs");
const path = require("path");

const PIPELINE_ROOT = "docs/writing-pipeline";

// Files we track reads for
const TRACKED_GUIDES = [
  `${PIPELINE_ROOT}/guides/style-guide.md`,
  `${PIPELINE_ROOT}/guides/review-taxonomy.md`,
  `${PIPELINE_ROOT}/guides/diagram-guide.md`,
];

const BREADCRUMB_DIR = path.join(
  process.env.CLAUDE_PROJECT_DIR || process.cwd(),
  ".claude"
);
const BREADCRUMB_FILE = path.join(BREADCRUMB_DIR, ".pipeline-reads.json");

// Read input from stdin
let input = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => (input += chunk));
process.stdin.on("end", () => {
  try {
    const data = JSON.parse(input);
    const toolName = data.tool_name || "";

    // Only track Read operations
    if (toolName !== "Read") {
      process.exit(0);
    }

    const filePath =
      data.tool_input?.file_path || data.tool_input?.path || "";
    if (!filePath) {
      process.exit(0);
    }

    const normalizedPath = filePath.replace(/\\/g, "/");

    // Check if this read is for a tracked guide
    const isTrackedGuide = TRACKED_GUIDES.some((guide) =>
      normalizedPath.includes(guide)
    );

    if (!isTrackedGuide) {
      process.exit(0);
    }

    // Record the breadcrumb
    let reads = {};
    try {
      if (fs.existsSync(BREADCRUMB_FILE)) {
        reads = JSON.parse(fs.readFileSync(BREADCRUMB_FILE, "utf8"));
      }
    } catch {
      reads = {}; // Corrupt file, start fresh
    }

    // Find which guide was read and record it by its short name
    for (const guide of TRACKED_GUIDES) {
      if (normalizedPath.includes(guide)) {
        const shortName = path.basename(guide);
        reads[shortName] = {
          path: normalizedPath,
          timestamp: Date.now(),
        };
        break;
      }
    }

    // Write breadcrumbs
    fs.mkdirSync(BREADCRUMB_DIR, { recursive: true });
    fs.writeFileSync(BREADCRUMB_FILE, JSON.stringify(reads, null, 2));

    process.exit(0);
  } catch (err) {
    // Read tracker should never block — fail open
    process.exit(0);
  }
});
