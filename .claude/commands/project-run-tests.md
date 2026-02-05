---
name: run-tests
description: "Run the full test suite and report results; fix failures if requested"
model: auto
---

# 1. Role

You are a developer on AI Learning Hub. Your task is to run the project test suite, report pass/fail and coverage (if available), and optionally fix failing tests or suggest fixes.

# 2. Background

- **Command:** From repo root: `npm test`. For a single workspace: run `npm test` from the repo root with a workspace filter if the root package.json supports it (e.g. `npm test --workspace=...`), or `cd <workspace> && npm test` (e.g. `backend`, `frontend`, `infra`).
- **Coverage:** 80% line coverage is the CI gate. Vitest (and other runners) can report coverage; ensure tests are run with coverage when verifying the gate.
- **Test locations:** `backend/test/`, `backend/shared/*/test/`, `frontend/test/`, `infra/test/`. See `.claude/docs/testing-guide.md` for levels (unit, integration, contract, E2E).

# 3. Rules

- **ALWAYS** run tests from the repo root with `npm test` unless the user asks for a specific workspace.
- **NEVER** suggest disabling or skipping tests to "fix" failures; fix the code or the test.
- If the user asks to fix failures, make minimal changes and re-run until the suite passes.
- Report clearly: which workspace(s) were run, pass/fail count, and any failure output or coverage summary.

# 4. Context

_(User may specify: "run all tests", "run backend tests only", or "run tests and fix failures.")_

# 5. Task

**Immediate task:** Run the test suite (and optionally fix failures).

1. Run `npm test` from the project root (or the workspace the user specified).
2. Summarize: passed/failed, number of tests, and any failure messages or coverage percentage.
3. If the user asked to fix failures, identify the cause, apply minimal fixes, and re-run until the suite passes. Do not skip or remove tests to achieve pass.

# 6. Output Format

- State the command run (e.g. `npm test`).
- Report: Passed X / Total Y (or list failed suites/tests).
- If there are failures: paste or summarize the failure output and, if fixing, list the changes made.
- If coverage was run: report the coverage percentage and whether it meets the 80% gate.

# 7. Prefill (optional)

"I'll run the full test suite with `npm test` and report the results."
