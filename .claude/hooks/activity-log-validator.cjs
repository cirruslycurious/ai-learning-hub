/**
 * Activity Log Timestamp Validator
 *
 * Validates that all activity log entries in auto-run state files
 * have real timestamps (not placeholders or bare bullets).
 */

"use strict";

const TIMESTAMP_HH_MM = /^\s*-\s+\[(\d{1,2}:\d{2})\]/;
const TIMESTAMP_ISO = /^\s*-\s+\[(\d{4}-\d{2}-\d{2}T[\d:]+Z?)\]/;
const PLACEHOLDER = /^\s*-\s+\[xx:xx\]/i;
const BULLET_LINE = /^\s*-\s+\S/;

/**
 * Extract activity log lines from a state file's content.
 * Returns array of { line, hasTimestamp, timestamp } objects.
 */
function parseActivityLog(content) {
  const lines = content.split("\n");
  let inActivityLog = false;
  const entries = [];

  for (const line of lines) {
    // Detect start of Activity Log section
    if (/^#+\s+Activity\s+Log/i.test(line)) {
      inActivityLog = true;
      continue;
    }

    // Stop at next heading
    if (inActivityLog && /^#+\s+/.test(line)) {
      break;
    }

    if (!inActivityLog) continue;

    // Only process bullet lines
    if (!BULLET_LINE.test(line)) continue;

    const hhmmMatch = line.match(TIMESTAMP_HH_MM);
    const isoMatch = line.match(TIMESTAMP_ISO);
    const isPlaceholder = PLACEHOLDER.test(line);

    if (isPlaceholder) {
      entries.push({ line: line.trim(), hasTimestamp: false, timestamp: null });
    } else if (hhmmMatch) {
      entries.push({
        line: line.trim(),
        hasTimestamp: true,
        timestamp: hhmmMatch[1],
      });
    } else if (isoMatch) {
      entries.push({
        line: line.trim(),
        hasTimestamp: true,
        timestamp: isoMatch[1],
      });
    } else {
      entries.push({ line: line.trim(), hasTimestamp: false, timestamp: null });
    }
  }

  return entries;
}

/**
 * Validate that all activity log entries have real timestamps.
 * Returns { pass: boolean, findings: string[] }.
 */
function validateTimestamps(content) {
  const entries = parseActivityLog(content);
  const findings = [];

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    if (entry.hasTimestamp) continue;

    const lineNum = i + 1;
    if (PLACEHOLDER.test(entry.line)) {
      findings.push(
        `Line ${lineNum}: placeholder timestamp [xx:xx] — "${entry.line}"`
      );
    } else {
      findings.push(
        `Line ${lineNum}: missing timestamp — "${entry.line}"`
      );
    }
  }

  return {
    pass: findings.length === 0,
    findings,
  };
}

module.exports = { parseActivityLog, validateTimestamps };
