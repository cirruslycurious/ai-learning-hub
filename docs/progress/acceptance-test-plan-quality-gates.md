# Acceptance Test Plan: Quality Gate Hardening (Group 1)

**Created:** 2026-02-19
**Status:** Ready for validation
**Source:** `docs/progress/auto-epic-improvements-plan.md` Group 1 (items 1.1-1.4)

---

## Overview

This document defines manual/semi-automated acceptance tests for the 4 new quality gates added to the epic orchestrator's Phase 2.2. These tests validate the full orchestrator flow — the unit and integration tests (in `test/hooks/`) validate the gate scripts in isolation.

**Gate scripts under test:**

| Script                    | Gate                          | Location                                |
| ------------------------- | ----------------------------- | --------------------------------------- |
| `commit-gate.cjs`         | 1.1 Commit verification       | `.claude/hooks/commit-gate.cjs`         |
| `cdk-synth-gate.cjs`      | 1.2 CDK synth (conditional)   | `.claude/hooks/cdk-synth-gate.cjs`      |
| `ac-verify-validator.cjs` | 1.3 AC verification           | `.claude/hooks/ac-verify-validator.cjs` |
| `temp-cleanup.cjs`        | 1.4 Temp path standardization | `.claude/hooks/temp-cleanup.cjs`        |

**SKILL.md reference:** Phase 2.2 (lines 240-330 approx.)

---

## AT-01: Full Orchestrator Dry Run Includes New Gates

**Precondition:** A test epic with 1-2 simple stories exists.

**Steps:**

1. Run the epic orchestrator with `--dry-run`
2. Review the orchestrator activity log

**Expected:** The log mentions all gate checkpoints in order: quality gate -> AC verification -> secrets scan -> commit verification -> CDK synth gate. Dry-run may skip actual execution but should log the gate names.

**Pass criteria:** Gate names appear in log output in the correct sequence.

---

## AT-02: Commit Gate Blocks Uncommitted Work

**Precondition:** Feature branch with implementation code that has NOT been `git add`/`git commit`.

**Steps:**

1. Orchestrator reaches Phase 2.2 quality gate
2. Standard gates (lint, type-check, test) pass
3. Orchestrator runs `node .claude/hooks/commit-gate.cjs --base-branch main`
4. Gate detects no committed changes vs base branch

**Expected:** Orchestrator STOPS with message containing "No changes committed to branch."

**Pass criteria:** Orchestrator does not proceed to Phase 2.3 (Mark for Review).

---

## AT-03: Commit Gate Warns on Untracked Implementation Files

**Precondition:** Feature branch with committed changes AND untracked `.ts` files in story-relevant directories.

**Steps:**

1. Orchestrator reaches commit gate
2. `git diff --stat` shows committed changes (first check passes)
3. `git status --porcelain` shows `??` untracked `.ts` files in story dirs

**Expected:** Orchestrator STOPS, warning lists the specific untracked file paths.

**Pass criteria:** Each untracked `.ts`/`.tsx` file in a story-relevant directory is listed by name.

---

## AT-04: CDK Synth Gate Skips When No Infra Changes

**Precondition:** Feature branch modifying only `backend/` files (no `infra/` changes).

**Steps:**

1. Orchestrator reaches CDK synth gate
2. `git diff --name-only` shows no files with `infra/` prefix

**Expected:** Gate reports `skipped: true`. Orchestrator continues to Phase 2.3.

**Pass criteria:** No `cdk synth` command is executed. Gate output shows `"skipped": true`.

---

## AT-05: CDK Synth Gate Runs and Passes

**Precondition:** Feature branch modifying `infra/stacks/` files. CDK project is valid.

**Steps:**

1. Orchestrator detects infra changes via `git diff --name-only`
2. Gate runs `cd infra && npx cdk synth --quiet`
3. Synth exits 0

**Expected:** Gate reports `pass: true, skipped: false`. Orchestrator continues.

**Pass criteria:** Gate output shows `"pass": true, "skipped": false`.

---

## AT-06: CDK Synth Gate Blocks on Synth Failure

**Precondition:** Feature branch with CDK topology error (e.g., circular dependency, missing import).

**Steps:**

1. Orchestrator detects infra changes
2. Gate runs `cdk synth`
3. Synth exits non-zero

**Expected:** Orchestrator STOPS, shows synth error output, requires fix before review.

**Pass criteria:** Error message from CDK is visible in orchestrator output. Phase 2.3 is not reached.

---

## AT-07: AC Verification Step Produces Structured Output

**Precondition:** Story with 3+ ACs. Dev agent has completed implementation.

**Steps:**

1. Orchestrator reaches AC verification step
2. Dev agent produces structured JSON for each AC (per SKILL.md instructions)
3. JSON is written to `.claude/temp/ac-verification.json`
4. Orchestrator runs `node .claude/hooks/ac-verify-validator.cjs --input .claude/temp/ac-verification.json`

**Expected:** Each AC entry has `criterion`, `implFile`, `testFile`, `behaviorType`. Validator confirms `pass: true`.

**Pass criteria:** Validator output is `{ "pass": true, "failures": [] }`.

---

## AT-08: AC Verification Catches Mock-Only Tests

**Precondition:** Story where one AC is only tested via mocks (no real behavior verification).

**Steps:**

1. Dev agent marks one AC with `"behaviorType": "mock-only"` in the JSON output
2. Validator runs on the JSON

**Expected:** Validator reports `pass: false` with a failure message containing "test exercises mock-only behavior" for that AC.

**Pass criteria:** The specific AC is identified by name in the failure list. Orchestrator does not proceed past AC verification.

---

## AT-09: Temp Artifacts Use Standard Paths

**Precondition:** Full orchestrator story run.

**Steps:**

1. During secrets scan, verify output goes to `.claude/temp/secrets-scan.json` (not project root)
2. During test capture, verify output goes to `.claude/temp/test-output.txt` (not project root)
3. During AC verification, verify output goes to `.claude/temp/ac-verification.json`
4. After Phase 2.5 commit, verify cleanup step runs

**Expected:** No `quality-gate-*.json`, `secrets-*.json`, or `test-output*.txt` files at project root after the run.

**Pass criteria:** `ls *.json *.txt` at project root shows no temp artifacts. `.claude/temp/` contains the artifacts.

---

## AT-10: .gitignore Prevents Temp Artifact Commits

**Precondition:** `.claude/temp/` directory exists with files. `.gitignore` has been updated.

**Steps:**

1. Create a test file: `echo "test" > .claude/temp/test-artifact.json`
2. Run `git status` — `.claude/temp/` contents should not appear as untracked
3. Run `git add -A` — temp files should not be staged

**Expected:** `.claude/temp/` contents are completely invisible to git.

**Pass criteria:** `git status` does not list any `.claude/temp/` files. `git diff --cached` after `git add -A` does not include them.

---

## AT-11: All Gates Run in Correct Order

**Precondition:** Full orchestrator story run (non-dry-run).

**Steps:**

1. Observe or log the Phase 2.2 gate execution sequence

**Expected:** Gates execute in this order:

1. `npm run lint`
2. `npm run type-check`
3. `npm test -- --coverage` (+ coverage capture)
4. AC verification (`ac-verify-validator.cjs`)
5. Secrets scan (pattern matching on changed files)
6. Commit verification (`commit-gate.cjs`)
7. CDK synth (`cdk-synth-gate.cjs`, conditional)

**Pass criteria:** Each gate's failure stops the pipeline before subsequent gates run. No gate is skipped unless it is conditional (CDK synth with no infra changes).

---

## AT-12: End-to-End Quality Gate Pass

**Precondition:** Story implementation is correct, all code committed, no secrets, CDK synth passes (or no infra changes).

**Steps:**

1. All gates pass in sequence
2. Orchestrator proceeds to Phase 2.3 (Mark for Review)

**Expected:** No gate blocks. Orchestrator logs a summary of all passed gates and transitions to the code review loop.

**Pass criteria:** Story status changes to "review". Review loop begins.

---

## Success Metrics (from improvements plan)

After implementing these gates, the next epic run should show:

1. **Review rounds <= 1.5 avg** (down from 2.0 across Epic 2/2.1)
2. **Zero "uncommitted files" findings** (currently 4 of 6 stories)
3. **Zero "mock-only AC" findings** (currently 3 of 6 stories)
4. **Zero stray temp files at project root** after a run
