/**
 * Completion Report Validator
 *
 * Validates that epic completion reports stay in sync with state files.
 * Detects stale reports where stories have completed but the report
 * still shows them as pending.
 */

"use strict";

const STATUS_PATTERN = /\*\*Status:\*\*\s*(\w+)/;
const STORIES_COMPLETED_PATTERN = /\*\*Stories Completed:\*\*\s*([\d/]+)/;
// Table row: | id | title | status | pr | coverage | rounds | fixed | duration |
const TABLE_ROW =
  /^\|\s*([^\|]+?)\s*\|\s*([^\|]+?)\s*\|\s*([^\|]+?)\s*\|\s*([^\|]+?)\s*\|\s*([^\|]+?)\s*\|\s*([^\|]+?)\s*\|\s*([^\|]+?)\s*\|\s*([^\|]+?)\s*\|$/;
const SEPARATOR_ROW = /^\|\s*[-:]+\s*\|/;

// State file YAML parsing (reuse pattern from duration-tracker)
const STORY_HEADER = /^\s+"([^"]+)":\s*$/;
const FIELD_PATTERN = /^\s+(\w+):\s*"?([^",}]+)"?,?\s*$/;

/**
 * Parse a completion report's markdown content.
 */
function parseCompletionReport(content) {
  const lines = content.split("\n");
  const statusMatch = content.match(STATUS_PATTERN);
  const storiesMatch = content.match(STORIES_COMPLETED_PATTERN);
  const storyRows = [];

  for (const line of lines) {
    if (SEPARATOR_ROW.test(line)) continue;
    const match = line.match(TABLE_ROW);
    if (!match) continue;

    const id = match[1].trim();
    // Skip header row
    if (id === "Story" || id === "-----" || id.startsWith("-")) continue;

    storyRows.push({
      id,
      title: match[2].trim(),
      status: match[3].trim(),
      pr: match[4].trim(),
      coverage: match[5].trim(),
      reviewRounds: match[6].trim(),
      findingsFixed: match[7].trim(),
      duration: match[8].trim(),
    });
  }

  return {
    status: statusMatch ? statusMatch[1] : null,
    storiesCompleted: storiesMatch ? storiesMatch[1] : null,
    storyRows,
  };
}

/**
 * Parse story data from state file YAML frontmatter.
 */
function parseStateFileStories(content) {
  const lines = content.split("\n");
  const stories = [];
  let inFrontmatter = false;
  let inStories = false;
  let currentId = null;
  let currentFields = {};
  let frontmatterStarted = false;

  for (const line of lines) {
    if (line.trim() === "---") {
      if (!frontmatterStarted) {
        frontmatterStarted = true;
        inFrontmatter = true;
        continue;
      } else {
        if (currentId) {
          stories.push({ id: currentId, ...currentFields });
        }
        break;
      }
    }

    if (!inFrontmatter) continue;

    if (/^stories:\s*$/.test(line)) {
      inStories = true;
      continue;
    }

    if (!inStories) continue;

    const headerMatch = line.match(STORY_HEADER);
    if (headerMatch) {
      if (currentId) {
        stories.push({ id: currentId, ...currentFields });
      }
      currentId = headerMatch[1];
      currentFields = {};
      continue;
    }

    if (currentId) {
      const fieldMatch = line.match(FIELD_PATTERN);
      if (fieldMatch) {
        currentFields[fieldMatch[1]] = fieldMatch[2].trim();
      }
    }
  }

  return stories;
}

/**
 * Validate completion report against state file.
 * Returns { pass: boolean, findings: string[] }.
 */
function validateCompletionReport(reportContent, stateFileContent) {
  const report = parseCompletionReport(reportContent);
  const stateStories = parseStateFileStories(stateFileContent);
  const findings = [];

  // Build lookup of report rows by story ID
  const reportRowMap = new Map();
  for (const row of report.storyRows) {
    reportRowMap.set(row.id, row);
  }

  for (const story of stateStories) {
    if (story.status !== "done") continue;

    const reportRow = reportRowMap.get(story.id);

    if (!reportRow) {
      findings.push(
        `Story ${story.id}: done in state file but missing from completion report`
      );
      continue;
    }

    // Check for stale data — report shows pending but state says done
    if (
      reportRow.status.includes("Pending") ||
      reportRow.status.includes("pending")
    ) {
      findings.push(
        `Story ${story.id}: stale in completion report (shows "${reportRow.status}" but state file shows "done")`
      );
    }
  }

  return {
    pass: findings.length === 0,
    findings,
  };
}

/**
 * Generate a markdown table row for a story.
 */
function generateStoryRow(storyId, data) {
  const isDone = data.status === "done";
  const statusDisplay = isDone ? "✅ Complete" : "⏳ Pending";
  const pr = data.pr ? `#${data.pr}` : "-";
  const coverage = data.coverage ? `${data.coverage}%` : "-";
  const rounds = data.review_rounds || "-";
  const fixed = data.findings_fixed || "-";
  const duration = data.duration || "-";
  const title = data.title || "-";

  return `| ${storyId} | ${title} | ${statusDisplay} | ${pr} | ${coverage} | ${rounds} | ${fixed} | ${duration} |`;
}

module.exports = {
  parseCompletionReport,
  parseStateFileStories,
  validateCompletionReport,
  generateStoryRow,
};
