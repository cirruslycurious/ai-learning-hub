#!/usr/bin/env node
/**
 * pipeline-guard.cjs - Protect writing pipeline integrity
 *
 * Enforces four invariants during pipeline runs:
 *   1. Pipeline infrastructure (guides, agents, templates) is read-only
 *   2. Previous pipeline artifacts cannot be overwritten
 *   3. Artifact filenames must match expected numbering
 *   4. Required guides must be actually Read before artifacts are written
 *      (works with pipeline-read-tracker.cjs which records breadcrumbs)
 *
 * Activation: Rules 1 always active. Rules 2-4 only during active runs
 *   (state.yaml with status: in-progress).
 *
 * Part of AI Learning Hub's deterministic enforcement layer
 */

const fs = require("fs");
const path = require("path");

const PIPELINE_ROOT = "docs/writing-pipeline";

// Infrastructure files — never modified by subagents during a run
const PROTECTED_INFRASTRUCTURE = [
  `${PIPELINE_ROOT}/guides/`,
  `${PIPELINE_ROOT}/agents/`,
  `${PIPELINE_ROOT}/templates/`,
  `${PIPELINE_ROOT}/config.yaml`,
  `${PIPELINE_ROOT}/README.md`,
];

// Valid artifact filename patterns (prefix number → filename)
const ARTIFACT_PATTERNS = [
  /^00-request\.md$/,
  /^01-research\.md$/,
  /^02-outline\.md$/,
  /^03-outline-review\.md$/,
  /^04-draft-v1\.md$/,
  /^05-editorial-review-v1\.md$/,
  /^06-draft-v1r1\.md$/,
  /^07-sme-review-v1\.md$/,
  /^08-draft-v2\.md$/,
  /^09-editorial-review-v2\.md$/,
  /^10-diagrams-v1\.md$/,
  /^11-sme-review-v2\.md$/,
  /^12-draft-v3\.md$/,
  /^13-editorial-review-v3\.md$/,
  /^14-diagrams-v2\.md$/,
  /^15-qa-read-v1\.md$/,
  /^16-draft-v3r1\.md$/,
  /^17-qa-read-v2\.md$/,
  /^18-draft-v3r2\.md$/,
  /^19-final-review\.md$/,
  /^20-final\.md$/,
  /^21-final-with-diagrams\.md$/,
  /^state\.yaml$/,
];

// Which guides each agent must have Read before writing artifacts
// Keyed by agent name as it appears in state.yaml
const REQUIRED_GUIDES = {
  "tech-writer": ["style-guide.md", "review-taxonomy.md"],
  editor: ["style-guide.md", "review-taxonomy.md"],
  sme: ["review-taxonomy.md"],
  designer: ["diagram-guide.md"],
  "qa-reader": [], // Intentionally blank — cold reader, no guides
};

// Breadcrumb staleness threshold (2 hours in ms)
const BREADCRUMB_MAX_AGE_MS = 2 * 60 * 60 * 1000;

// Map step numbers to their expected output artifact prefix
const STEP_TO_ARTIFACT_PREFIX = {
  1: 2, // Step 1 → 02-outline.md (also 01-research.md)
  2: 3, // Step 2 → 03-outline-review.md
  3: 4, // Step 3 → 04-draft-v1.md
  4: 5, // Step 4 → 05-editorial-review-v1.md
  "4b": 6, // Step 4b → 06-draft-v1r1.md
  5: 7, // Step 5 → 07-sme-review-v1.md
  6: 8, // Step 6 → 08-draft-v2.md
  "7a": 9, // Step 7a → 09-editorial-review-v2.md
  "7b": 10, // Step 7b → 10-diagrams-v1.md
  8: 11, // Step 8 → 11-sme-review-v2.md
  9: 12, // Step 9 → 12-draft-v3.md
  10: 13, // Step 10 → 13-editorial-review-v3.md (also 14-diagrams-v2.md)
  11: 15, // Step 11 → 15-qa-read-v1.md
  "11b": 16, // Step 11b → 16-draft-v3r1.md
  "11c": 17, // Step 11c → 17-qa-read-v2.md
  "11d": 18, // Step 11d → 18-draft-v3r2.md
  12: 19, // Step 12 → 19-final-review.md (also 20-final.md)
  13: 21, // Step 13 → 21-final-with-diagrams.md
};

// Read input from stdin
let input = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => (input += chunk));
process.stdin.on("end", () => {
  try {
    const data = JSON.parse(input);
    const toolName = data.tool_name || "";

    // Only guard write operations
    const writeTools = ["Write", "Edit", "NotebookEdit"];
    if (!writeTools.includes(toolName)) {
      process.exit(0);
    }

    const filePath = data.tool_input?.file_path || data.tool_input?.path || "";
    const result = checkPipelineWrite(filePath);

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

    if (result.context) {
      console.log(
        JSON.stringify({
          hookSpecificOutput: {
            additionalContext: result.context,
          },
        })
      );
    }

    process.exit(0);
  } catch (err) {
    // Fail CLOSED on parse error
    console.error(
      `📝 pipeline-guard: Failed to parse input (${err.message}). Blocking write for safety.`
    );
    process.exit(2);
  }
});

function checkPipelineWrite(filePath) {
  if (!filePath) return {};

  const normalizedPath = filePath.replace(/\\/g, "/");

  // Only care about writes inside the pipeline directory
  if (!normalizedPath.includes(PIPELINE_ROOT)) {
    return {};
  }

  // ═══════════════════════════════════════════════════════════════════
  // Rule 1: Protect pipeline infrastructure (ALWAYS, not just during runs)
  // ═══════════════════════════════════════════════════════════════════

  for (const protected_ of PROTECTED_INFRASTRUCTURE) {
    if (normalizedPath.includes(protected_)) {
      return {
        decision: "deny",
        reason: `📝 Pipeline Guard: ${getInfraType(protected_)} are protected and cannot be modified by pipeline agents. These files are human-owned infrastructure.`,
      };
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // Rule 2 & 3: Artifact protection (only during active pipeline runs)
  // ═══════════════════════════════════════════════════════════════════

  // Check if this is a write to a project directory
  const projectMatch = normalizedPath.match(
    new RegExp(`${PIPELINE_ROOT}/projects/([^/]+)/(.+)$`)
  );
  if (!projectMatch) {
    return {}; // Not a project artifact write
  }

  const projectSlug = projectMatch[1];
  const artifactName = projectMatch[2];

  // Try to read state.yaml for this project
  const state = readProjectState(projectSlug);
  if (!state) {
    return {}; // No active pipeline, allow (initial setup)
  }

  // Allow state.yaml writes (the Manager updates this)
  if (artifactName === "state.yaml") {
    return {};
  }

  // Allow 00-request.md writes (initial project setup)
  if (artifactName === "00-request.md") {
    return {};
  }

  // Rule 2: Check if writing to a previous artifact
  const artifactNumber = getArtifactNumber(artifactName);
  const currentStepMaxArtifact = getCurrentStepMaxArtifact(state);

  if (
    artifactNumber !== null &&
    currentStepMaxArtifact !== null &&
    artifactNumber < currentStepMaxArtifact
  ) {
    return {
      decision: "deny",
      reason: `📝 Pipeline Guard: Cannot overwrite previous artifact "${artifactName}". The pipeline is at step ${state.current_step}, which produces artifact ${String(currentStepMaxArtifact).padStart(2, "0")}-*. Previous artifacts are immutable.`,
    };
  }

  // Rule 3: Validate artifact naming
  const isValidName = ARTIFACT_PATTERNS.some((pattern) =>
    pattern.test(artifactName)
  );
  if (!isValidName) {
    return {
      context: `⚠️ Pipeline Guard: "${artifactName}" does not match expected pipeline artifact naming. Expected patterns: 00-request.md through 21-final-with-diagrams.md. Verify this is the correct output file.`,
    };
  }

  // ═══════════════════════════════════════════════════════════════════
  // Rule 4: Verify required guides were actually Read (not just claimed)
  // Uses breadcrumbs from pipeline-read-tracker.cjs
  // ═══════════════════════════════════════════════════════════════════

  const agentName = state.current_agent;
  if (agentName) {
    const missingGuides = checkRequiredGuides(agentName);
    if (missingGuides.length > 0) {
      return {
        decision: "deny",
        reason: `📝 Pipeline Guard: Cannot write artifact before loading required guides. Read these files first:\n${missingGuides.map((g) => `  - docs/writing-pipeline/guides/${g}`).join("\n")}\nUse the Read tool to load each guide, then retry writing "${artifactName}".`,
      };
    }
  }

  return {};
}

function getInfraType(protectedPath) {
  if (protectedPath.includes("/guides/")) return "Style guides and references";
  if (protectedPath.includes("/agents/")) return "Agent definitions";
  if (protectedPath.includes("/templates/")) return "Pipeline templates";
  if (protectedPath.includes("config.yaml")) return "Pipeline configuration";
  if (protectedPath.includes("README.md")) return "Pipeline README";
  return "Pipeline infrastructure files";
}

function checkRequiredGuides(agentName) {
  const required = REQUIRED_GUIDES[agentName];
  if (!required || required.length === 0) {
    return []; // No guides required for this agent
  }

  const projectRoot = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  const breadcrumbFile = path.join(projectRoot, ".claude", ".pipeline-reads.json");

  let reads = {};
  try {
    if (!fs.existsSync(breadcrumbFile)) {
      return required; // No breadcrumbs at all — all guides are missing
    }
    reads = JSON.parse(fs.readFileSync(breadcrumbFile, "utf8"));
  } catch {
    return required; // Can't read breadcrumbs — assume nothing was loaded
  }

  const now = Date.now();
  const missing = [];

  for (const guide of required) {
    const entry = reads[guide];
    if (!entry || !entry.timestamp) {
      missing.push(guide);
      continue;
    }

    // Check staleness — breadcrumb older than threshold means it's from a previous session
    if (now - entry.timestamp > BREADCRUMB_MAX_AGE_MS) {
      missing.push(guide);
    }
  }

  return missing;
}

function readProjectState(projectSlug) {
  const projectRoot = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  const statePath = path.join(
    projectRoot,
    PIPELINE_ROOT,
    "projects",
    projectSlug,
    "state.yaml"
  );

  try {
    if (!fs.existsSync(statePath)) {
      return null;
    }

    const content = fs.readFileSync(statePath, "utf8");

    // Simple YAML parsing for the fields we need
    const statusMatch = content.match(/^status:\s*(.+)$/m);
    const stepMatch = content.match(/^current_step:\s*(.+)$/m);
    const agentMatch = content.match(/^current_agent:\s*(.+)$/m);

    if (!statusMatch || statusMatch[1].trim() !== "in-progress") {
      return null; // Pipeline not active
    }

    return {
      status: statusMatch[1].trim(),
      current_step: stepMatch ? stepMatch[1].trim() : null,
      current_agent: agentMatch ? agentMatch[1].trim() : null,
    };
  } catch {
    return null; // Can't read state, don't enforce artifact rules
  }
}

function getArtifactNumber(artifactName) {
  const match = artifactName.match(/^(\d{2})-/);
  if (!match) return null;
  return parseInt(match[1], 10);
}

function getCurrentStepMaxArtifact(state) {
  if (!state.current_step) return null;

  const step = state.current_step;
  const artifactPrefix = STEP_TO_ARTIFACT_PREFIX[step];
  if (artifactPrefix === undefined) return null;

  // The current step can write its own artifact and anything at that number.
  // Everything below that number is a previous artifact.
  return artifactPrefix;
}
