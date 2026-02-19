#!/usr/bin/env node
/**
 * temp-cleanup.cjs - Standardize and clean temp artifact paths
 *
 * Called by epic orchestrator (SKILL.md Phase 2.5) after committing.
 * Finds and removes stray temp files at the project root that should
 * have been written to .claude/temp/ instead.
 *
 * CLI args:
 *   --project-dir <dir>  Project root directory (default: cwd)
 *   --dry-run            List stray files without removing them
 *
 * Output: JSON { cleaned: number, files: string[] } on stdout
 * Exit code: 0 always, non-zero on script error
 */

const fs = require("fs");
const path = require("path");

/**
 * Stray file patterns that should not exist at project root.
 * These are temp artifacts from quality gate runs that should go to .claude/temp/.
 */
const STRAY_PATTERNS = [
  /^quality-gate-.*\.json$/,
  /^secrets-.*\.json$/,
  /^gitleaks-.*\.json$/,
  /^test-output.*\.txt$/,
  /^test-results.*\.txt$/,
  /^secrets-check-gate\.json$/,
  /^quality-gate-.*\.log$/,
  /^build-.*\.log$/,
  /^test-.*\.log$/,
];

/**
 * Get the canonical temp directory path.
 * @param {string} projectDir - Project root directory
 * @returns {string}
 */
function getTempDir(projectDir) {
  const normalized = projectDir.replace(/\/+$/, "");
  return path.join(normalized, ".claude", "temp");
}

/**
 * Get standard paths for temp artifacts.
 * @param {string} tempDir - The .claude/temp directory path
 * @returns {{ secretsScan: string, testOutput: string, acVerification: string }}
 */
function getStandardPaths(tempDir) {
  return {
    secretsScan: path.join(tempDir, "secrets-scan.json"),
    testOutput: path.join(tempDir, "test-output.txt"),
    acVerification: path.join(tempDir, "ac-verification.json"),
  };
}

/**
 * Find stray temp files at the project root.
 * Only checks direct children of the project directory (not subdirectories).
 * @param {string} projectDir - Project root directory
 * @returns {string[]} List of stray filenames
 */
function findStrayFiles(projectDir) {
  let entries;
  try {
    entries = fs.readdirSync(projectDir, { withFileTypes: true });
  } catch {
    return [];
  }

  const stray = [];
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const name = entry.name;
    if (STRAY_PATTERNS.some((pattern) => pattern.test(name))) {
      stray.push(name);
    }
  }

  return stray;
}

/**
 * Remove stray temp files from the project root.
 * @param {string} projectDir - Project root directory
 * @returns {number} Number of files removed
 */
function cleanupStrayFiles(projectDir) {
  const stray = findStrayFiles(projectDir);
  for (const file of stray) {
    try {
      fs.unlinkSync(path.join(projectDir, file));
    } catch {
      // Ignore removal errors (file may have been removed already)
    }
  }
  return stray.length;
}

/**
 * Ensure the temp directory exists.
 * @param {string} projectDir - Project root directory
 */
function ensureTempDir(projectDir) {
  const tempDir = getTempDir(projectDir);
  fs.mkdirSync(tempDir, { recursive: true });
}

/**
 * Parse CLI arguments.
 * @param {string[]} argv - process.argv.slice(2)
 * @returns {{ projectDir: string, dryRun: boolean }}
 */
function parseArgs(argv) {
  const result = { projectDir: process.cwd(), dryRun: false };

  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--project-dir" && argv[i + 1]) {
      result.projectDir = argv[i + 1];
      i++;
    } else if (argv[i] === "--dry-run") {
      result.dryRun = true;
    }
  }

  return result;
}

if (require.main === module) {
  try {
    const options = parseArgs(process.argv.slice(2));
    const stray = findStrayFiles(options.projectDir);

    if (options.dryRun) {
      console.log(
        JSON.stringify({ cleaned: 0, files: stray, dryRun: true }, null, 2)
      );
    } else {
      const cleaned = cleanupStrayFiles(options.projectDir);
      console.log(JSON.stringify({ cleaned, files: stray }, null, 2));
    }
  } catch (err) {
    console.error(`temp-cleanup: ${err.message}`);
    process.exit(1);
  }
}

module.exports = {
  getTempDir,
  getStandardPaths,
  findStrayFiles,
  cleanupStrayFiles,
  ensureTempDir,
  parseArgs,
};
