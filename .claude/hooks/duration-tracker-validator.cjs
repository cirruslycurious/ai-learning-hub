/**
 * Duration Tracker Validator
 *
 * Validates that all completed stories in auto-run state files
 * have duration, startedAt, and completedAt fields.
 */

"use strict";

// Matches a story block: "story-id": { ... }
const STORY_HEADER = /^\s+"([^"]+)":\s*$/;
const FIELD_PATTERN = /^\s+(\w+):\s*"?([^",}]+)"?,?\s*$/;
const BLOCK_START = /^\s+\{\s*$/;
const BLOCK_END = /^\s+\}\s*$/;

/**
 * Parse story timing data from state file YAML frontmatter.
 * Returns array of { id, status, duration, startedAt, completedAt }.
 */
function parseStoryDurations(content) {
  const lines = content.split("\n");
  const stories = [];
  let inFrontmatter = false;
  let inStories = false;
  let currentId = null;
  let currentFields = {};
  let frontmatterStarted = false;

  for (const line of lines) {
    // Track frontmatter boundaries
    if (line.trim() === "---") {
      if (!frontmatterStarted) {
        frontmatterStarted = true;
        inFrontmatter = true;
        continue;
      } else {
        // End of frontmatter
        if (currentId) {
          stories.push(buildStoryEntry(currentId, currentFields));
        }
        break;
      }
    }

    if (!inFrontmatter) continue;

    // Detect stories section
    if (/^stories:\s*$/.test(line)) {
      inStories = true;
      continue;
    }

    if (!inStories) continue;

    // Detect story header
    const headerMatch = line.match(STORY_HEADER);
    if (headerMatch) {
      if (currentId) {
        stories.push(buildStoryEntry(currentId, currentFields));
      }
      currentId = headerMatch[1];
      currentFields = {};
      continue;
    }

    // Skip block start/end braces
    if (BLOCK_START.test(line) || BLOCK_END.test(line)) continue;

    // Parse fields
    if (currentId) {
      const fieldMatch = line.match(FIELD_PATTERN);
      if (fieldMatch) {
        currentFields[fieldMatch[1]] = fieldMatch[2].trim();
      }
    }
  }

  return stories;
}

function buildStoryEntry(id, fields) {
  return {
    id,
    status: fields.status || null,
    duration: fields.duration || null,
    startedAt: fields.startedAt || null,
    completedAt: fields.completedAt || null,
  };
}

/**
 * Validate that all done stories have timing fields.
 * Returns { pass: boolean, findings: string[], warnings: string[] }.
 */
function validateDurations(content) {
  const stories = parseStoryDurations(content);
  const findings = [];
  const warnings = [];

  for (const story of stories) {
    if (story.status !== "done") continue;

    if (!story.duration) {
      findings.push(`Story ${story.id}: missing duration field`);
    } else if (story.duration.startsWith("~")) {
      warnings.push(
        `Story ${story.id}: approximate duration "${story.duration}" — consider computing from startedAt/completedAt`
      );
    }

    if (!story.startedAt) {
      findings.push(`Story ${story.id}: missing startedAt field`);
    }

    if (!story.completedAt) {
      findings.push(`Story ${story.id}: missing completedAt field`);
    }
  }

  return {
    pass: findings.length === 0,
    findings,
    warnings,
  };
}

module.exports = { parseStoryDurations, validateDurations };
