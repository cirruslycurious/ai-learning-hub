#!/usr/bin/env node
/**
 * cdk-synth-gate.cjs - Conditional CDK synth verification
 *
 * Called by epic orchestrator (SKILL.md Phase 2.2) when infra/ files may have changed.
 * Only runs `cdk synth` if the branch actually modified files under the infra directory.
 *
 * CLI args:
 *   --base-branch <branch>  Base branch to diff against (default: "main")
 *   --infra-dir <dir>       Infra directory prefix to check (default: "infra/")
 *
 * Output: JSON { pass: boolean, skipped: boolean, error?: string } on stdout
 * Exit code: 0 always (check JSON for pass/fail), non-zero on script error
 */

const { execSync } = require("child_process");

/**
 * Check if any changed files are under the infra directory.
 * @param {string} gitDiffOutput - Output of `git diff --name-only origin/${baseBranch}...HEAD`
 * @param {string} infraDir - Directory prefix to match (e.g., "infra/")
 * @returns {boolean}
 */
function hasInfraChanges(gitDiffOutput, infraDir) {
  const lines = gitDiffOutput.split("\n").filter(Boolean);
  return lines.some((line) => line.startsWith(infraDir));
}

/**
 * Parse the result of a cdk synth execution.
 * @param {number} exitCode - Exit code from cdk synth
 * @param {string} stderr - stderr output from cdk synth
 * @returns {{ pass: boolean, error?: string }}
 */
function parseSynthResult(exitCode, stderr) {
  if (exitCode === 0) {
    return { pass: true };
  }
  return { pass: false, error: stderr };
}

/**
 * Parse CLI arguments.
 * @param {string[]} argv - process.argv.slice(2)
 * @returns {{ baseBranch: string, infraDir: string }}
 */
function parseArgs(argv) {
  const result = { baseBranch: "main", infraDir: "infra/" };

  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--base-branch" && argv[i + 1]) {
      result.baseBranch = argv[i + 1];
      i++;
    } else if (argv[i] === "--infra-dir" && argv[i + 1]) {
      result.infraDir = argv[i + 1];
      i++;
    }
  }

  return result;
}

/**
 * Run the full gate check.
 * @param {{ baseBranch: string, infraDir: string }} options
 * @returns {{ pass: boolean, skipped: boolean, error?: string }}
 */
function runGate(options) {
  const { baseBranch = "main", infraDir = "infra/" } = options;

  const diffOutput = execSync(
    `git diff --name-only origin/${baseBranch}...HEAD`,
    { encoding: "utf8" }
  );

  if (!hasInfraChanges(diffOutput, infraDir)) {
    return { pass: true, skipped: true };
  }

  try {
    execSync(`cd ${infraDir} && npx cdk synth --quiet 2>&1`, {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    return { pass: true, skipped: false };
  } catch (err) {
    const stderr = err.stderr || err.stdout || err.message;
    return { pass: false, skipped: false, error: stderr };
  }
}

if (require.main === module) {
  try {
    const options = parseArgs(process.argv.slice(2));
    const result = runGate(options);
    console.log(JSON.stringify(result, null, 2));
  } catch (err) {
    console.error(`cdk-synth-gate: ${err.message}`);
    process.exit(1);
  }
}

module.exports = { hasInfraChanges, parseSynthResult, parseArgs, runGate };
