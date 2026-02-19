#!/usr/bin/env node
/**
 * commit-gate.cjs - Verify changes are committed before review
 *
 * Called by epic orchestrator (SKILL.md Phase 2.2), NOT a PreToolUse hook.
 *
 * Checks:
 *   1. git diff --stat origin/${baseBranch}...HEAD shows > 0 changed files
 *   2. git status --porcelain has no untracked .ts/.tsx/.test.ts files in story-relevant dirs
 *
 * CLI args:
 *   --base-branch <branch>    Base branch to diff against (default: "main")
 *   --story-dirs <dir1,dir2>  Comma-separated list of story-relevant directories
 *
 * Output: JSON { pass: boolean, findings?: string[] } on stdout
 * Exit code: 0 always (check JSON for pass/fail), non-zero on script error
 */

const { execSync } = require("child_process");

/**
 * Check if there are committed changes on the branch vs the base branch.
 * @param {string} gitDiffStatOutput - Output of `git diff --stat origin/${baseBranch}...HEAD`
 * @returns {{ pass: boolean, finding?: string }}
 */
function checkCommittedChanges(gitDiffStatOutput) {
  const trimmed = gitDiffStatOutput.trim();
  if (trimmed.length === 0) {
    return {
      pass: false,
      finding:
        "No changes committed to branch. Run `git add` and `git commit` before proceeding to review.",
    };
  }
  return { pass: true };
}

/**
 * Check for untracked implementation files in story-relevant directories.
 * @param {string} gitStatusOutput - Output of `git status --porcelain`
 * @param {string[]} storyDirs - List of directory prefixes to check
 * @returns {{ pass: boolean, findings: string[] }}
 */
function checkUntrackedFiles(gitStatusOutput, storyDirs) {
  if (!storyDirs || storyDirs.length === 0) {
    return { pass: true, findings: [] };
  }

  const implExtensions = /\.(ts|tsx|test\.ts|test\.tsx)$/;
  const findings = [];

  const lines = gitStatusOutput.split("\n").filter(Boolean);
  for (const line of lines) {
    // Only check untracked files (??), not modified (M) or staged (A) files
    if (!line.startsWith("??")) continue;

    const filePath = line.slice(3).trim();
    if (!implExtensions.test(filePath)) continue;

    const inStoryDir = storyDirs.some((dir) => filePath.startsWith(dir));
    if (inStoryDir) {
      findings.push(filePath);
    }
  }

  return {
    pass: findings.length === 0,
    findings,
  };
}

/**
 * Parse CLI arguments.
 * @param {string[]} argv - process.argv.slice(2)
 * @returns {{ baseBranch: string, storyDirs: string[] }}
 */
function parseArgs(argv) {
  const result = { baseBranch: "main", storyDirs: [] };

  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--base-branch" && argv[i + 1]) {
      result.baseBranch = argv[i + 1];
      i++;
    } else if (argv[i] === "--story-dirs" && argv[i + 1] !== undefined) {
      result.storyDirs = argv[i + 1]
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      i++;
    }
  }

  return result;
}

/**
 * Run the full gate check.
 * @param {{ baseBranch: string, storyDirs: string[] }} options
 * @returns {{ pass: boolean, findings: string[] }}
 */
function runGate(options) {
  const { baseBranch = "main", storyDirs = [] } = options;

  const diffStat = execSync(`git diff --stat origin/${baseBranch}...HEAD`, {
    encoding: "utf8",
  });
  const statusOutput = execSync("git status --porcelain", {
    encoding: "utf8",
  });

  const commitCheck = checkCommittedChanges(diffStat);
  const untrackedCheck = checkUntrackedFiles(statusOutput, storyDirs);

  const findings = [];
  if (!commitCheck.pass) findings.push(commitCheck.finding);
  if (!untrackedCheck.pass) findings.push(...untrackedCheck.findings);

  return { pass: findings.length === 0, findings };
}

if (require.main === module) {
  try {
    const options = parseArgs(process.argv.slice(2));
    const result = runGate(options);
    console.log(JSON.stringify(result, null, 2));
  } catch (err) {
    console.error(`commit-gate: ${err.message}`);
    process.exit(1);
  }
}

module.exports = { checkCommittedChanges, checkUntrackedFiles, parseArgs, runGate };
