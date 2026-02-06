#!/usr/bin/env node
/**
 * tdd-guard.js - Enforce Test-Driven Development
 *
 * Blocks implementation file writes unless failing tests exist.
 * Pattern from nizos/tdd-guard adapted for AI Learning Hub.
 *
 * Workflow:
 *   1. Agent writes test file → ALLOWED (always)
 *   2. Agent runs tests → Tests fail (captured in test.json)
 *   3. Agent writes implementation → ALLOWED (failing tests exist)
 *   4. Agent runs tests → Tests pass
 *   5. Agent writes more implementation → BLOCKED (no failing tests)
 *
 * Toggle: Set TDD_GUARD_ENABLED=false to disable during prototyping
 */

const fs = require('fs');
const path = require('path');

// Configuration
const TDD_ENABLED = process.env.TDD_GUARD_ENABLED !== 'false';
const TEST_RESULTS_PATH = process.env.TDD_TEST_RESULTS ||
  path.join(__dirname, '..', 'tdd-guard', 'data', 'test.json');

// File patterns
const TEST_FILE_PATTERNS = [
  /\.test\.[jt]sx?$/,
  /\.spec\.[jt]sx?$/,
  /__tests__\//,
  /\.stories\.[jt]sx?$/, // Storybook stories are like tests
];

const IMPL_FILE_PATTERNS = [
  /\.[jt]sx?$/,
];

const EXCLUDED_PATTERNS = [
  /\.config\.[jt]s$/,
  /\.d\.ts$/,
  /node_modules/,
  /\.next\//,
  /dist\//,
  /build\//,
];

// Read input from stdin
let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => input += chunk);
process.stdin.on('end', () => {
  if (!TDD_ENABLED) {
    process.exit(0); // TDD guard disabled
  }

  try {
    const data = JSON.parse(input);
    const filePath = data.tool_input?.file_path || data.tool_input?.path || '';
    const result = checkTDD(filePath);

    if (result.decision) {
      console.log(JSON.stringify({
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          permissionDecision: result.decision,
          permissionDecisionReason: result.reason
        }
      }));
    }

    if (result.context) {
      console.log(JSON.stringify({
        hookSpecificOutput: {
          additionalContext: result.context
        }
      }));
    }

    process.exit(0);
  } catch (err) {
    // On error, allow (fail open)
    process.exit(0);
  }
});

function checkTDD(filePath) {
  if (!filePath) return {};

  const normalizedPath = filePath.replace(/\\/g, '/');

  // Check exclusions first
  for (const pattern of EXCLUDED_PATTERNS) {
    if (pattern.test(normalizedPath)) {
      return {}; // Excluded file, allow
    }
  }

  // Always allow test files
  for (const pattern of TEST_FILE_PATTERNS) {
    if (pattern.test(normalizedPath)) {
      return { context: '✅ Test file write allowed. Remember to run tests!' };
    }
  }

  // Check if it's an implementation file
  let isImplFile = false;
  for (const pattern of IMPL_FILE_PATTERNS) {
    if (pattern.test(normalizedPath)) {
      isImplFile = true;
      break;
    }
  }

  if (!isImplFile) {
    return {}; // Not a code file, allow
  }

  // It's an implementation file - check for failing tests
  const testStatus = getTestStatus();

  if (testStatus.error) {
    // Can't read test results - allow with warning
    return {
      context: `⚠️ TDD Guard: Cannot read test results (${testStatus.error}). Run tests first with: npm test`
    };
  }

  if (testStatus.failed > 0) {
    // Failing tests exist - allow implementation
    return {
      context: `✅ TDD: ${testStatus.failed} failing test(s). Implementation allowed to make them pass.`
    };
  }

  if (testStatus.passed === 0 && testStatus.failed === 0) {
    // No tests have been run
    return {
      decision: 'ask',
      reason: `🧪 TDD Guard: No test results found. Write tests first!\n\n1. Create test file: ${getTestFileName(normalizedPath)}\n2. Run tests: npm test\n3. Then implement to make tests pass.\n\nBypass with: TDD_GUARD_ENABLED=false`
    };
  }

  // All tests passing - block new implementation
  return {
    decision: 'ask',
    reason: `🧪 TDD Guard: All ${testStatus.passed} tests pass. Write a failing test before adding implementation!\n\nTest file: ${getTestFileName(normalizedPath)}\n\nBypass with: TDD_GUARD_ENABLED=false`
  };
}

function getTestStatus() {
  try {
    if (!fs.existsSync(TEST_RESULTS_PATH)) {
      return { error: 'no test.json', passed: 0, failed: 0 };
    }

    const data = JSON.parse(fs.readFileSync(TEST_RESULTS_PATH, 'utf8'));

    return {
      passed: data.passed || 0,
      failed: data.failed || 0,
      timestamp: data.timestamp
    };
  } catch (err) {
    return { error: err.message, passed: 0, failed: 0 };
  }
}

function getTestFileName(implPath) {
  // Convert implementation path to test path
  // src/utils/helper.ts → src/utils/helper.test.ts
  const ext = path.extname(implPath);
  const base = implPath.slice(0, -ext.length);
  return `${base}.test${ext}`;
}
