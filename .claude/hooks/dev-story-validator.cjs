#!/usr/bin/env node
/**
 * dev-story-validator.cjs - Validate dev-story workflow efficiency invariants
 *
 * Checks that instructions.xml and workflow.yaml do not contain the redundant
 * patterns identified in Group 3 of the auto-epic improvements plan:
 *   3.1 No duplicate story parse in Step 2
 *   3.2 No double-read after task_check anchor
 *   3.3 No ghost project_context variable
 *   3.4 Sprint-status loaded once (not re-read in Steps 4/9)
 *   3.5 Single DoD source (no inline list or re-execution)
 *   3.6 No duplicate story_dir variable
 *   3.7 Consistent brace style for sprint_status
 *
 * CLI args:
 *   --instructions <path>  Path to instructions.xml (default: _bmad/bmm/workflows/4-implementation/dev-story/instructions.xml)
 *   --workflow <path>      Path to workflow.yaml (default: _bmad/bmm/workflows/4-implementation/dev-story/workflow.yaml)
 *
 * Output: JSON { pass: boolean, findings: string[] } on stdout
 * Exit code: 0 always (check JSON for pass/fail), non-zero on script error
 */

const { readFileSync } = require("fs");
const { resolve } = require("path");

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Extract the content of a specific step from instructions.xml.
 * Returns everything between <step n="N" ...> and </step>.
 *
 * @param {string} xml - Full instructions.xml content
 * @param {number} stepNumber - The step number to extract
 * @returns {string|null} Step content or null if not found
 */
function extractStep(xml, stepNumber) {
  // Match <step n="N" ...> through </step>, non-greedy
  const regex = new RegExp(
    `<step\\s+n="${stepNumber}"[^>]*>([\\s\\S]*?)</step>`,
    "m"
  );
  const match = xml.match(regex);
  return match ? match[1] : null;
}

// ─── Check Functions ────────────────────────────────────────────────────────

/**
 * 3.1 — Step 2 must NOT contain the duplicate story parse block from Step 1.
 * Detects "Parse sections:" or "Load comprehensive context from story file"
 * inside <action> tags within Step 2.
 *
 * @param {string} xml - Full instructions.xml content
 * @returns {{ pass: boolean, findings: string[] }}
 */
function checkNoDuplicateStoryParse(xml) {
  const step2 = extractStep(xml, 2);
  if (!step2) {
    return { pass: true, findings: ["Step 2 not found (possibly already removed — OK)"] };
  }

  const findings = [];

  // Check for parse actions inside <action> tags
  const actionBlocks = step2.match(/<action[^>]*>[\s\S]*?<\/action>/g) || [];
  const actionTexts = actionBlocks.map((b) => b.replace(/<\/?action[^>]*>/g, ""));

  for (const text of actionTexts) {
    if (/Parse sections:/i.test(text)) {
      findings.push('Step 2 contains duplicate "Parse sections:" action (should only be in Step 1)');
    }
    if (/Load comprehensive context from story file/i.test(text)) {
      findings.push('Step 2 contains duplicate "Load comprehensive context from story file" action');
    }
    if (/Extract developer guidance from Dev Notes/i.test(text)) {
      findings.push('Step 2 contains duplicate "Extract developer guidance from Dev Notes" action');
    }
    if (/Use enhanced story context to inform/i.test(text)) {
      findings.push('Step 2 contains duplicate "Use enhanced story context" action');
    }
  }

  return { pass: findings.length === 0, findings };
}

/**
 * 3.2 — No "Read COMPLETE story file" action after the task_check anchor in Step 1.
 * The direct-path branch (story_path provided) reads the file before the goto,
 * so a read after the anchor is a double-read.
 *
 * @param {string} xml - Full instructions.xml content
 * @returns {{ pass: boolean, findings: string[] }}
 */
function checkNoDoubleRead(xml) {
  const step1 = extractStep(xml, 1);
  if (!step1) {
    return { pass: false, findings: ["Step 1 not found in instructions.xml"] };
  }

  const anchorIndex = step1.indexOf('<anchor id="task_check"');
  if (anchorIndex === -1) {
    return { pass: true, findings: ["No task_check anchor found in Step 1 (informational)"] };
  }

  const afterAnchor = step1.slice(anchorIndex);
  const findings = [];

  // Check for read actions after the anchor
  if (/Read COMPLETE story file/i.test(afterAnchor)) {
    findings.push('Found "Read COMPLETE story file" action after task_check anchor — double read');
  }

  return { pass: findings.length === 0, findings };
}

/**
 * 3.3 — No ghost project_context variable.
 * workflow.yaml must not define project_context.
 * instructions.xml Step 2 must not reference {project_context}.
 *
 * @param {string} yaml - Full workflow.yaml content
 * @param {string} xml - Full instructions.xml content
 * @returns {{ pass: boolean, findings: string[] }}
 */
function checkNoGhostProjectContext(yaml, xml) {
  const findings = [];

  // Check YAML for project_context key (not in comments)
  const yamlLines = yaml.split("\n");
  for (const line of yamlLines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("#")) continue; // skip comments
    if (/^project_context\s*:/.test(trimmed)) {
      findings.push('workflow.yaml still defines "project_context" variable (ghost reference to non-existent file)');
      break;
    }
  }

  // Check XML Step 2 for {project_context} reference
  const step2 = extractStep(xml, 2);
  if (step2 && /\{project_context\}/i.test(step2)) {
    findings.push('Step 2 still references {project_context} (file does not exist)');
  }

  return { pass: findings.length === 0, findings };
}

/**
 * 3.4 — Sprint-status.yaml should be fully loaded only in Step 1.
 * Steps 4 and 9 must NOT contain "Load the FULL file" for sprint_status.
 *
 * @param {string} xml - Full instructions.xml content
 * @returns {{ pass: boolean, findings: string[] }}
 */
function checkSprintStatusReadOnce(xml) {
  const findings = [];

  for (const stepNum of [4, 9]) {
    const step = extractStep(xml, stepNum);
    if (!step) continue;

    // Match "Load the FULL file" with either brace style
    if (/Load the FULL file[^<]*sprint.?status/i.test(step)) {
      findings.push(`Step ${stepNum} re-reads sprint-status.yaml (should use content cached from Step 1)`);
    }
  }

  return { pass: findings.length === 0, findings };
}

/**
 * 3.5 — Single DoD source. Step 9 should reference the {validation} checklist,
 * not contain an inline 11-item list. Step 10 should not re-execute DoD.
 *
 * @param {string} xml - Full instructions.xml content
 * @returns {{ pass: boolean, findings: string[] }}
 */
function checkSingleDoDSource(xml) {
  const findings = [];

  // Check Step 9 for inline DoD list
  const step9 = extractStep(xml, 9);
  if (step9) {
    // The inline list starts with "Validate definition-of-done checklist with essential requirements:"
    // and contains a multi-line bulleted list inside an <action> tag
    if (/Validate definition-of-done checklist with essential requirements:/i.test(step9)) {
      findings.push("Step 9 contains inline DoD validation list (should reference {validation} checklist only)");
    }
  }

  // Check Step 10 for DoD re-execution
  const step10 = extractStep(xml, 10);
  if (step10) {
    if (/Execute the enhanced definition-of-done checklist/i.test(step10)) {
      findings.push("Step 10 re-executes DoD validation (should be communication-only)");
    }
  }

  return { pass: findings.length === 0, findings };
}

/**
 * 3.6 — No duplicate variable. workflow.yaml should NOT have both
 * story_dir and implementation_artifacts.
 *
 * @param {string} yaml - Full workflow.yaml content
 * @returns {{ pass: boolean, findings: string[] }}
 */
function checkNoDuplicateVariable(yaml) {
  const findings = [];

  const yamlLines = yaml.split("\n");
  let hasStoryDir = false;
  let hasImplArtifacts = false;

  for (const line of yamlLines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("#")) continue;
    if (/^story_dir\s*:/.test(trimmed)) hasStoryDir = true;
    if (/^implementation_artifacts\s*:/.test(trimmed)) hasImplArtifacts = true;
  }

  if (hasStoryDir && hasImplArtifacts) {
    findings.push('workflow.yaml has both "story_dir" and "implementation_artifacts" (duplicate — remove story_dir)');
  }

  return { pass: findings.length === 0, findings };
}

/**
 * 3.7 — Consistent brace style for sprint_status in instructions.xml.
 * All references should use double-brace {{sprint_status}}, not single-brace.
 *
 * @param {string} xml - Full instructions.xml content
 * @returns {{ pass: boolean, findings: string[] }}
 */
function checkBraceConsistency(xml) {
  const findings = [];
  const lines = xml.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Find single-brace {sprint_status} that is NOT double-brace {{sprint_status}}
    // Strategy: find all {sprint_status} occurrences, then check they're double-braced
    const singleBraceRegex = /(?<!\{)\{sprint_status\}(?!\})/g;
    let match;
    while ((match = singleBraceRegex.exec(line)) !== null) {
      findings.push(`Line ${i + 1}: single-brace {sprint_status} found (should be {{sprint_status}})`);
    }
  }

  return { pass: findings.length === 0, findings };
}

// ─── CLI ────────────────────────────────────────────────────────────────────

/**
 * Parse CLI arguments.
 * @param {string[]} argv - Command line arguments
 * @returns {{ instructions: string, workflow: string }}
 */
function parseArgs(argv) {
  const defaults = {
    instructions: "_bmad/bmm/workflows/4-implementation/dev-story/instructions.xml",
    workflow: "_bmad/bmm/workflows/4-implementation/dev-story/workflow.yaml",
  };

  const result = { ...defaults };

  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--instructions" && argv[i + 1]) {
      result.instructions = argv[++i];
    } else if (argv[i] === "--workflow" && argv[i + 1]) {
      result.workflow = argv[++i];
    }
  }

  return result;
}

/**
 * Run all checks against the given file contents.
 *
 * @param {{ xml: string, yaml: string }} contents - File contents
 * @returns {{ pass: boolean, findings: string[], results: Object }}
 */
function runAllChecks(contents) {
  const { xml, yaml } = contents;
  const results = {};
  const allFindings = [];

  const checks = [
    ["noDuplicateStoryParse", () => checkNoDuplicateStoryParse(xml)],
    ["noDoubleRead", () => checkNoDoubleRead(xml)],
    ["noGhostProjectContext", () => checkNoGhostProjectContext(yaml, xml)],
    ["sprintStatusReadOnce", () => checkSprintStatusReadOnce(xml)],
    ["singleDoDSource", () => checkSingleDoDSource(xml)],
    ["noDuplicateVariable", () => checkNoDuplicateVariable(yaml)],
    ["braceConsistency", () => checkBraceConsistency(xml)],
  ];

  let allPass = true;
  for (const [name, fn] of checks) {
    const result = fn();
    results[name] = result;
    if (!result.pass) {
      allPass = false;
      allFindings.push(...result.findings);
    }
  }

  return { pass: allPass, findings: allFindings, results };
}

// ─── CLI entry point ────────────────────────────────────────────────────────

if (require.main === module) {
  const args = parseArgs(process.argv.slice(2));

  try {
    const xml = readFileSync(resolve(args.instructions), "utf-8");
    const yaml = readFileSync(resolve(args.workflow), "utf-8");

    const output = runAllChecks({ xml, yaml });
    process.stdout.write(JSON.stringify(output, null, 2) + "\n");
  } catch (err) {
    process.stderr.write(`dev-story-validator: ${err.message}\n`);
    process.exit(1);
  }
}

module.exports = {
  extractStep,
  checkNoDuplicateStoryParse,
  checkNoDoubleRead,
  checkNoGhostProjectContext,
  checkSprintStatusReadOnce,
  checkSingleDoDSource,
  checkNoDuplicateVariable,
  checkBraceConsistency,
  parseArgs,
  runAllChecks,
};
