#!/usr/bin/env node
/**
 * prompt-template-validator.cjs - Validate prompt template fields in review-loop.md and agent definitions
 *
 * Called standalone or by CI to verify that the reviewer/fixer prompt templates
 * in review-loop.md contain all required labeled fields, and that the agent
 * definition docs (epic-reviewer.md, epic-fixer.md) document the same fields.
 *
 * CLI args:
 *   --review-loop <path>     Path to review-loop.md (default: .claude/skills/epic-orchestrator/review-loop.md)
 *   --reviewer-agent <path>  Path to epic-reviewer.md (default: .claude/agents/epic-reviewer.md)
 *   --fixer-agent <path>     Path to epic-fixer.md (default: .claude/agents/epic-fixer.md)
 *
 * Output: JSON { pass: boolean, results: { ... } } on stdout
 * Exit code: 0 always (check JSON for pass/fail), non-zero on script error
 */

const { readFileSync } = require("fs");
const { resolve } = require("path");

/**
 * Extract a code-fenced prompt block from markdown content under a given step heading.
 * Looks for a heading containing the stepKey (e.g., "Step A"), then finds the next
 * triple-backtick code block that contains "subagent_type:" to identify it as a prompt template.
 *
 * @param {string} markdownContent - Full markdown file content
 * @param {string} stepKey - Step identifier to search for in headings (e.g., "Step A", "Step C")
 * @returns {string|null} The code block content, or null if not found
 */
function extractPromptBlock(markdownContent, stepKey) {
  if (!markdownContent || !stepKey) return null;

  const lines = markdownContent.split("\n");
  let inSection = false;
  let inCodeBlock = false;
  let codeBlockLines = [];
  let foundBlock = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check for heading containing the step key
    if (/^#{1,4}\s+/.test(line) && line.includes(stepKey)) {
      inSection = true;
      continue;
    }

    // If we hit another heading of same or higher level, stop searching this section
    if (inSection && !inCodeBlock && /^#{1,3}\s+/.test(line) && !line.includes(stepKey)) {
      // Check if this is a higher-level heading that ends our section
      const currentLevel = (line.match(/^(#{1,3})\s/) || ["", ""])[1].length;
      if (currentLevel <= 2) {
        inSection = false;
        continue;
      }
    }

    if (!inSection) continue;

    // Handle code block boundaries
    if (line.trimStart().startsWith("```")) {
      if (inCodeBlock) {
        // End of code block
        const blockContent = codeBlockLines.join("\n");
        if (blockContent.includes("subagent_type:")) {
          foundBlock = blockContent;
          break;
        }
        inCodeBlock = false;
        codeBlockLines = [];
      } else {
        // Start of code block
        inCodeBlock = true;
        codeBlockLines = [];
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockLines.push(line);
    }
  }

  return foundBlock;
}

/**
 * Check whether a prompt block contains a labeled field (e.g., "Base branch:").
 * Matches lines where the field label appears at the start (after optional whitespace).
 *
 * @param {string} blockContent - The extracted prompt block content
 * @param {string} fieldLabel - The field label to search for, including colon (e.g., "Base branch:")
 * @returns {boolean} True if the field is found
 */
function hasField(blockContent, fieldLabel) {
  const escaped = fieldLabel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`^\\s*${escaped}`, "m");
  return regex.test(blockContent);
}

/** Required fields for the reviewer prompt (Step A) */
const REVIEWER_REQUIRED_FIELDS = [
  "Branch:",
  "Base branch:",
  "Story file:",
  "Round:",
  "Output path:",
  "Expected files:",
];

/** Required fields for the fixer prompt (Step C) */
const FIXER_REQUIRED_FIELDS = [
  "Branch:",
  "Base branch:",
  "Story file:",
  "Findings:",
  "Round:",
  "Expected files:",
  "Coverage baseline:",
];

/**
 * Validate the reviewer prompt template in review-loop.md.
 *
 * @param {string} reviewLoopContent - Full content of review-loop.md
 * @returns {{ pass: boolean, findings: string[] }}
 */
function validateReviewerPrompt(reviewLoopContent) {
  const block = extractPromptBlock(reviewLoopContent, "Step A");
  if (!block) {
    return {
      pass: false,
      findings: [
        "Could not find Step A prompt block in review-loop.md (expected a code-fenced block with subagent_type: under a Step A heading)",
      ],
    };
  }

  const findings = [];
  for (const field of REVIEWER_REQUIRED_FIELDS) {
    if (!hasField(block, field)) {
      findings.push(`Missing required field "${field}" in reviewer prompt (Step A)`);
    }
  }

  return { pass: findings.length === 0, findings };
}

/**
 * Validate the fixer prompt template in review-loop.md.
 *
 * @param {string} reviewLoopContent - Full content of review-loop.md
 * @returns {{ pass: boolean, findings: string[] }}
 */
function validateFixerPrompt(reviewLoopContent) {
  const block = extractPromptBlock(reviewLoopContent, "Step C");
  if (!block) {
    return {
      pass: false,
      findings: [
        "Could not find Step C prompt block in review-loop.md (expected a code-fenced block with subagent_type: under a Step C heading)",
      ],
    };
  }

  const findings = [];
  for (const field of FIXER_REQUIRED_FIELDS) {
    if (!hasField(block, field)) {
      findings.push(`Missing required field "${field}" in fixer prompt (Step C)`);
    }
  }

  return { pass: findings.length === 0, findings };
}

/**
 * Validate an agent definition file documents all expected context fields.
 * Checks the "Context You Will Receive" section for bold-formatted list items.
 *
 * @param {string} agentContent - Full content of the agent definition markdown
 * @param {string[]} expectedFields - Field names expected in the context section
 * @returns {{ pass: boolean, findings: string[] }}
 */
function validateAgentDefinition(agentContent, expectedFields) {
  // Find the "Context You Will Receive" section
  const sectionMatch = agentContent.match(
    /##\s+Context You Will Receive\s*\n([\s\S]*?)(?=\n##\s|\n---|$)/
  );

  if (!sectionMatch) {
    return {
      pass: false,
      findings: [
        'Could not find "Context You Will Receive" section in agent definition',
      ],
    };
  }

  const sectionContent = sectionMatch[1];
  const findings = [];

  for (const field of expectedFields) {
    // Match bold list items: "- **Field name** — description" or "- **Field name**"
    const escaped = field.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`-\\s+\\*\\*${escaped}\\*\\*`, "i");
    if (!regex.test(sectionContent)) {
      findings.push(
        `Missing field "${field}" in "Context You Will Receive" section`
      );
    }
  }

  return { pass: findings.length === 0, findings };
}

/**
 * Check if the reviewer prompt has an inline Acceptance Criteria block.
 * This is informational (item 2.5), not a hard gate.
 *
 * @param {string} reviewLoopContent - Full content of review-loop.md
 * @returns {{ present: boolean }}
 */
function checkInlineACs(reviewLoopContent) {
  const block = extractPromptBlock(reviewLoopContent, "Step A");
  if (!block) return { present: false };

  return { present: /Acceptance Criteria:/i.test(block) };
}

/**
 * Parse CLI arguments.
 * @param {string[]} argv - Command line arguments (without node and script path)
 * @returns {{ reviewLoop: string, reviewerAgent: string, fixerAgent: string }}
 */
function parseArgs(argv) {
  const defaults = {
    reviewLoop: ".claude/skills/epic-orchestrator/review-loop.md",
    reviewerAgent: ".claude/agents/epic-reviewer.md",
    fixerAgent: ".claude/agents/epic-fixer.md",
  };

  const result = { ...defaults };

  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--review-loop" && argv[i + 1]) {
      result.reviewLoop = argv[++i];
    } else if (argv[i] === "--reviewer-agent" && argv[i + 1]) {
      result.reviewerAgent = argv[++i];
    } else if (argv[i] === "--fixer-agent" && argv[i + 1]) {
      result.fixerAgent = argv[++i];
    }
  }

  return result;
}

// --- CLI entry point ---

if (require.main === module) {
  const args = parseArgs(process.argv.slice(2));

  try {
    const reviewLoopContent = readFileSync(resolve(args.reviewLoop), "utf-8");
    const reviewerAgentContent = readFileSync(
      resolve(args.reviewerAgent),
      "utf-8"
    );
    const fixerAgentContent = readFileSync(resolve(args.fixerAgent), "utf-8");

    const reviewerPromptResult = validateReviewerPrompt(reviewLoopContent);
    const fixerPromptResult = validateFixerPrompt(reviewLoopContent);

    const reviewerAgentResult = validateAgentDefinition(
      reviewerAgentContent,
      [
        "Story ID and title",
        "Branch name",
        "Base branch",
        "Story file path",
        "Round number",
        "Output path",
        "Expected files",
      ]
    );

    const fixerAgentResult = validateAgentDefinition(fixerAgentContent, [
      "Story ID and title",
      "Branch name",
      "Base branch",
      "Story file path",
      "Findings document path",
      "Round number",
      "Expected files",
      "Coverage baseline",
    ]);

    const inlineACsResult = checkInlineACs(reviewLoopContent);

    const allPass =
      reviewerPromptResult.pass &&
      fixerPromptResult.pass &&
      reviewerAgentResult.pass &&
      fixerAgentResult.pass;

    const output = {
      pass: allPass,
      results: {
        reviewerPrompt: reviewerPromptResult,
        fixerPrompt: fixerPromptResult,
        reviewerAgent: reviewerAgentResult,
        fixerAgent: fixerAgentResult,
        inlineACs: inlineACsResult,
      },
    };

    process.stdout.write(JSON.stringify(output, null, 2) + "\n");
  } catch (err) {
    process.stderr.write(`Error: ${err.message}\n`);
    process.exit(1);
  }
}

module.exports = {
  extractPromptBlock,
  hasField,
  validateReviewerPrompt,
  validateFixerPrompt,
  validateAgentDefinition,
  checkInlineACs,
  parseArgs,
};
