#!/usr/bin/env node
/**
 * ac-verify-validator.cjs - Validate structured AC verification output
 *
 * Called by epic orchestrator (SKILL.md Phase 2.2) after the dev agent
 * produces structured AC verification output. Validates that each
 * acceptance criterion has real implementation and real tests (not mock-only).
 *
 * CLI args:
 *   --input <path>  Path to JSON file with AC verification data
 *                    (or reads from stdin if no --input provided)
 *
 * Input format: JSON array of AC entries:
 *   [{ criterion: string, implFile?: string, testFile?: string, behaviorType?: "real"|"mock-only"|"not-verified" }]
 *
 * Output: JSON { pass: boolean, failures: string[] } on stdout
 * Exit code: 0 always (check JSON for pass/fail), non-zero on script error
 */

const fs = require("fs");

/**
 * Validate an array of AC verification entries.
 * @param {Array<{ criterion: string, implFile?: string, testFile?: string, behaviorType?: string }>} acList
 * @returns {{ pass: boolean, failures: string[] }}
 */
function validateACVerification(acList) {
  if (!acList || acList.length === 0) {
    return {
      pass: false,
      failures: ["No acceptance criteria provided for verification"],
    };
  }

  const failures = [];

  for (const ac of acList) {
    const label = ac.criterion || "(unnamed AC)";

    if (!ac.implFile) {
      failures.push(`${label}: missing implementation file`);
    }

    if (!ac.testFile) {
      failures.push(`${label}: missing test file`);
    }

    if (ac.behaviorType === "mock-only") {
      failures.push(`${label}: test exercises mock-only behavior`);
    }

    if (ac.behaviorType === "not-verified") {
      failures.push(`${label}: behavior not verified`);
    }
  }

  return {
    pass: failures.length === 0,
    failures,
  };
}

/**
 * Parse CLI arguments.
 * @param {string[]} argv - process.argv.slice(2)
 * @returns {{ inputPath?: string }}
 */
function parseArgs(argv) {
  const result = {};

  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--input" && argv[i + 1]) {
      result.inputPath = argv[i + 1];
      i++;
    }
  }

  return result;
}

if (require.main === module) {
  try {
    const options = parseArgs(process.argv.slice(2));
    let data;

    if (options.inputPath) {
      const raw = fs.readFileSync(options.inputPath, "utf8");
      data = JSON.parse(raw);
    } else {
      // Read from stdin
      let input = "";
      const fd = fs.openSync("/dev/stdin", "r");
      const buf = Buffer.alloc(4096);
      let bytesRead;
      while ((bytesRead = fs.readSync(fd, buf)) > 0) {
        input += buf.slice(0, bytesRead).toString("utf8");
      }
      fs.closeSync(fd);
      data = JSON.parse(input);
    }

    const result = validateACVerification(data);
    console.log(JSON.stringify(result, null, 2));
  } catch (err) {
    console.error(`ac-verify-validator: ${err.message}`);
    process.exit(1);
  }
}

module.exports = { validateACVerification, parseArgs };
