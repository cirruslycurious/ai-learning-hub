# Auto-Epic Orchestrator Improvements Plan

**Created:** 2026-02-19
**Status:** Groups 1-4 Complete (2026-02-19)
**Source:** Analysis of Epic 1, Epic 2 (9 stories), and Epic 2.1 (4 stories) auto-run artifacts, 23 review findings files, 3 completion reports, and 2 retrospectives.

---

## Motivation

The auto-epic workflow produces correct results but burns significant tokens, review rounds, and developer attention on issues that are avoidable. Every story in Epic 2 and 2.1 required at least 2 review rounds. Recurring findings (uncommitted files, missing barrel exports, mock-only ACs) indicate systemic gaps rather than one-off mistakes. Beyond correctness, the workflow also has operational inefficiencies: redundant file reads, phantom file searches, missing context causing subagents to re-discover information the orchestrator already had, and temp artifacts littering the project root.

This plan addresses both **quality gate gaps** (catching errors earlier) and **operational efficiency** (reducing wasted tokens and effort).

---

## Group 1: Orchestrator Quality Gate Hardening

_Changes to: `.claude/skills/epic-orchestrator/SKILL.md` Phase 2.2_

These address the top recurring review findings — things the dev agent should catch before requesting review but consistently doesn't.

### 1.1 — Commit Verification Gate ✅

- [x] **Problem:** 4 of 6 stories had uncommitted/untracked files at review time. The reviewer found `git diff main...branch` showing zero changes. The quality gate runs `npm test`, `npm run lint`, `npm run type-check` but never checks whether the work is actually committed.
- [x] **Fix:** After the existing quality gate checks pass, add:
  ```
  git diff --stat origin/${baseBranch}...HEAD
  ```
  If this shows 0 changed files, STOP: "No changes committed to branch. Run `git add` and `git commit` before proceeding to review."
- [x] **Also verify no untracked implementation files:**
  ```
  git status --porcelain
  ```
  If untracked `.ts`, `.tsx`, `.test.ts` files exist in story-relevant directories, STOP with a warning listing the files.
- [x] **Where:** SKILL.md Phase 2.2, after the secrets scan gate, before Phase 2.3 (Mark for Review).
- [x] **Implemented:** `.claude/hooks/commit-gate.cjs` — standalone script with 19 unit tests + 5 integration tests. SKILL.md Phase 2.2 updated.

### 1.2 — CDK Synth Gate (Conditional) ✅

- [x] **Problem:** Story D1 burned 3 review rounds because CDK topology errors (circular dependencies, missing CORS on imported APIs) only surface at `cdk synth` time. Tests pass with simplified mock topology that masks real deployment failures.
- [x] **Fix:** After the quality gate, if any files in `infra/` were modified:
  ```bash
  git diff --name-only origin/${baseBranch}...HEAD | grep '^infra/'
  ```
  If matches found, run:
  ```bash
  cd infra && npx cdk synth --quiet 2>&1
  ```
  If synth fails, STOP: show the synth error and require fix before review.
- [x] **Where:** SKILL.md Phase 2.2, after the secrets scan gate, alongside the commit verification gate.
- [x] **Note:** This is conditional — only runs when infra files changed. Adds ~15-30s per story that touches infra, saves potentially 2+ review rounds.
- [x] **Implemented:** `.claude/hooks/cdk-synth-gate.cjs` — standalone script with 14 unit tests + 4 integration tests. Auto-detects infra changes and skips when not needed.

### 1.3 — Structured AC Verification Step ✅

- [x] **Problem:** 3 stories had ACs marked complete when only mock coverage existed. The dev agent writes a test that mocks an error, validates propagation works, and calls the AC done — but the actual behavior was never implemented. Self-certification is unreliable.
- [x] **Fix:** Before marking the quality gate as passed, add a structured verification step:
  ```
  For each Acceptance Criterion in the story file:
    1. State the AC
    2. Cite the specific implementation file(s) and function(s) that fulfill it
    3. Cite the specific test(s) that verify it — tests must exercise real behavior, not just mock propagation
    4. If the AC involves a specific response code, header, or data format, verify the test asserts that exact value
  ```
  If any AC cannot be substantiated with real implementation + real test, flag it before review.
- [x] **Where:** SKILL.md Phase 2.2, as a new sub-step between the quality gate and secrets scan. This is a prose instruction for the dev agent, not a programmatic check — but it forces explicit reasoning rather than implicit self-certification.
- [x] **Implemented:** `.claude/hooks/ac-verify-validator.cjs` — validates structured JSON output with 9 unit tests. SKILL.md updated with prose instructions + validator invocation. Catches mock-only and missing-impl ACs.

### 1.4 — Standardize Temp Artifact Paths ✅

- [x] **Problem:** 8 stray secrets-scan JSON files at project root with different names each run (`quality-gate-final-secrets.json`, `quality-gate-secrets-verification.json`, etc.). 3 stray test output files (`test-output.txt`, `test-results.txt`, `test-results-check.txt`). The agent invents new filenames each run.
- [x] **Fix:** Define standard temp paths in SKILL.md:
  - Secrets scan output: `.claude/temp/secrets-scan.json` (overwritten each run, git-ignored)
  - Test output capture: `.claude/temp/test-output.txt` (overwritten each run, git-ignored)
  - Add `.claude/temp/` to `.gitignore` if not already present
  - Add cleanup step in Phase 2.5 (after commit): remove temp artifacts
- [x] **Also:** Clean up existing stray files at project root (one-time cleanup task).
- [x] **Implemented:** `.claude/hooks/temp-cleanup.cjs` — standalone script with 12 unit tests. `.claude/temp/` directory created. SKILL.md Phase 2.2 uses standard paths, Phase 2.5 runs cleanup. `.gitignore` update pending manual application (file-guard protected).

---

## Group 2: Subagent Context Passing

_Changes to: `.claude/skills/epic-orchestrator/review-loop.md`, `.claude/agents/epic-reviewer.md`, `.claude/agents/epic-fixer.md`_

These reduce wasted effort where subagents re-discover information the orchestrator already has.

### 2.1 — Pass `baseBranch` to Fixer Prompt ✅

- [x] **Problem:** The fixer's own rules require checking "changed files vs base branch" for secrets scanning, but its prompt does not include `baseBranch`. The fixer must guess "main" or call `git remote show origin` to discover it.
- [x] **Fix:** Add `Base branch: {baseBranch}` to the fixer prompt template in `review-loop.md`.
- [x] **Impact:** Eliminates one discovery step per fixer invocation.
- [x] **Implemented:** `review-loop.md` Step C fixer prompt now includes `Base branch: {baseBranch}`. `epic-fixer.md` "Context You Will Receive" updated. Validated by `prompt-template-validator.cjs` (44 tests).

### 2.2 — Pass `story.touches` to Reviewer and Fixer ✅

- [x] **Problem:** The orchestrator parses `story.touches` from YAML frontmatter in Phase 1.2 (the list of files/directories the story is expected to modify). Neither the reviewer nor fixer receives this. The reviewer cannot quickly flag "this file was supposed to be touched but wasn't" or "this file was modified but not listed in touches."
- [x] **Fix:** Add `Expected files: {story.touches}` (as a comma-separated list) to both the reviewer and fixer prompt templates in `review-loop.md`.
- [x] **Impact:** Enables scope-drift detection without the reviewer having to re-parse the story file's YAML frontmatter.
- [x] **Implemented:** Both Step A (reviewer) and Step C (fixer) prompts now include `Expected files: {story.touches}`. Both agent definitions updated. Validated by `prompt-template-validator.cjs`.

### 2.3 — Pass Coverage Baseline to Fixer ✅

- [x] **Problem:** The fixer runs the full test suite after each fix group to verify coverage is maintained, but doesn't know the baseline. It cannot distinguish "79% is a regression from 87%" vs "79% was always the number."
- [x] **Fix:** Add `Coverage baseline: {coverage}%` to the fixer prompt template. The `coverage` variable is already captured by the orchestrator in Phase 2.2.
- [x] **Impact:** Fixer can verify "coverage did not regress" without running from scratch.
- [x] **Implemented:** `review-loop.md` Step C fixer prompt now includes `Coverage baseline: {coverage}%`. `epic-fixer.md` "Context You Will Receive" updated. Validated by `prompt-template-validator.cjs`.

### 2.4 — Make Reviewer Output Path an Explicit Field ✅

- [x] **Problem:** The reviewer agent definition (`epic-reviewer.md`) says it receives an explicit "Output path" field, but the actual prompt in `review-loop.md` embeds the path in prose ("Write your findings to: docs/progress/story-{id}-review-findings-round-{n}.md"). If the story ID format is unusual, path construction could fail.
- [x] **Fix:** Add a labeled field to the reviewer prompt template:
  ```
  Output path: docs/progress/story-{story.id}-review-findings-round-{round}.md
  ```
- [x] **Impact:** Consistency between agent definition and actual prompt. Reduces fragility.
- [x] **Implemented:** `review-loop.md` Step A reviewer prompt now includes `Output path:` as a labeled field. Prose updated to reference "Write your findings to the Output path above." Validated by `prompt-template-validator.cjs`.

### 2.5 — Inline AC Summary in Reviewer Prompt (Optional) ✅

- [x] **Problem:** The story file is read by the orchestrator (Phase 1.2), by dev-story, by the reviewer (each round), and by the fixer (each round). For a 2-round review, the story file is parsed 6+ times. The reviewer could skip the story-file read if the ACs were inlined in its prompt.
- [x] **Fix:** Add a compact AC list to the reviewer prompt:
  ```
  Acceptance Criteria:
  1. {ac1}
  2. {ac2}
  ...
  ```
  The reviewer still reads the story file for full context (dev notes, task breakdown), but the ACs — the primary review target — are immediately available without a file read.
- [x] **Trade-off:** Adds prompt tokens but saves a file-read round-trip. Net positive for stories with short AC lists, marginal for stories with 10+ ACs. Consider making this conditional on AC count.
- [x] **Priority:** Low — the current approach works, this is an optimization.
- [x] **Implemented:** `checkInlineACs()` function added to `prompt-template-validator.cjs` as an informational check (reports `present: true/false`). Template placeholder not added yet — deferred to orchestrator logic changes. Validator ready for when it's populated.

---

## Group 3: Dev-Story Workflow Efficiency

_Changes to: `_bmad/bmm/workflows/4-implementation/dev-story/instructions.xml`, `_bmad/bmm/workflows/4-implementation/dev-story/workflow.yaml`_

These eliminate redundant file reads and dead references that waste tokens on every single dev-story run.

### 3.1 — Remove Redundant Step 2 Story Re-Parse ✅

- [x] **Problem:** Steps 1 and 2 both contain identical 7-line section-parse blocks:
  ```
  Parse sections: Story, Acceptance Criteria, Tasks/Subtasks, Dev Notes, Dev Agent Record, File List, Change Log, Status
  Load comprehensive context from story file's Dev Notes section
  Extract developer guidance from Dev Notes: architecture requirements, previous learnings, technical specifications
  Use enhanced story context to inform implementation decisions and approaches
  ```
  These are copy-pasted verbatim. Step 2 adds nothing new except a glob search for the non-existent `project-context.md`.
- [x] **Fix:** Remove the duplicated parse actions from Step 2. Step 2 should only load project context (see 3.3) and emit the "Context Loaded" confirmation.
- [x] **Implemented:** Removed all 5 duplicate actions from Step 2 (parse, load project_context, load story context, extract Dev Notes, use enhanced context). Step 2 now contains only the critical tag and Context Loaded output. Validated by `dev-story-validator.cjs` (40 unit + 12 integration tests).

### 3.2 — Fix Step 1 Double-Read in Direct-Path Branch ✅

- [x] **Problem:** When `story_path` is provided (the orchestrator path), the story file is read at line 18 ("Read COMPLETE story file"), then the `goto` jumps to `task_check`, which says "Read COMPLETE story file from discovered path" again at line 118. Double read of the same file.
- [x] **Fix:** Remove line 118 ("Read COMPLETE story file from discovered path") since it is only reached after the `task_check` anchor. The direct-path branch already read the file. The discovery branches (sprint-status and filesystem) should read the file before jumping to `task_check`.
- [x] **Implemented:** Verified that the read action (line 118) is already positioned BEFORE the anchor (line 120), so the direct-path goto skips it. No double-read exists. Integration test confirms the invariant. Validated by `dev-story-validator.cjs`.

### 3.3 — Replace `project_context` Ghost Reference ✅

- [x] **Problem:** `workflow.yaml` defines `project_context: "**/project-context.md"`. This file does not exist in the repo. Every run, Step 2 executes a `**/*.md` glob search across the entire project, finds nothing, and silently continues. `CLAUDE.md` is the actual project standards file.
- [x] **Fix:** Either:
  - **(a)** Update `workflow.yaml` to `project_context: "{project-root}/CLAUDE.md"` (directly reference the real file), OR
  - **(b)** Remove the `project_context` variable entirely and update Step 2 to reference CLAUDE.md directly. Note: CLAUDE.md is loaded by the Claude Code environment automatically, so an explicit read may not be needed.
- [x] **Recommendation:** Option (b). CLAUDE.md is already in the agent's context. Remove the dead variable and the Step 2 glob search entirely. The `checklist.md` DoD item referencing `project-context.md` should also be updated.
- [x] **Implemented:** Option (b) applied. Removed `project_context` from `workflow.yaml`, removed the `Load {project_context}` action from Step 2 in `instructions.xml`, updated `checklist.md` to reference `CLAUDE.md` instead of `project-context.md`. Validated by `dev-story-validator.cjs`.

### 3.4 — Reduce sprint-status.yaml Reads from 3 to 1 ✅

- [x] **Problem:** `sprint-status.yaml` is read in full three times: Step 1 (discovery), Step 4 (mark in-progress), Step 9 (mark review). The file is ~128 lines and stable during a single story run.
- [x] **Fix:** Add a note in Step 1 that the sprint-status content should be retained in context for Steps 4 and 9. Steps 4 and 9 should reference the already-loaded content rather than re-reading the full file. The only new I/O needed is the write (update status value).
- [x] **Trade-off:** This is a prose instruction — the LLM may not perfectly cache across steps. But the explicit "do not re-read, use the version loaded in Step 1" instruction should reduce redundant reads in most cases.
- [x] **Implemented:** Added `<critical>` retention note in Step 1 after initial load. Replaced "Load the FULL file" actions in Steps 4 and 9 with "Use the sprint-status.yaml content loaded/retained from Step 1" instructions. Validated by `dev-story-validator.cjs`.

### 3.5 — Consolidate DoD Validation (Triple → Single) ✅

- [x] **Problem:** The Definition of Done is evaluated three times:
  1. Step 9 inline list (11 items in XML)
  2. Step 9 loads `checklist.md` (20 items across 5 sections)
  3. Step 10 says "Execute the enhanced definition-of-done checklist using the validation framework"
     These overlap significantly. The inline list and checklist.md cover the same categories with different wording.
- [x] **Fix:**
  - Keep `checklist.md` as the single source of truth for DoD validation
  - Remove the inline 11-item list from Step 9 (replace with "Execute DoD validation using {validation} checklist")
  - Remove the Step 10 re-execution ("Execute the enhanced definition-of-done checklist") — Step 10 is for communication, not re-validation
- [x] **Impact:** Reduces DoD evaluation from 3 passes to 1, saves significant tokens on story completion.
- [x] **Implemented:** Replaced Step 9 inline 11-item list with single `{validation}` checklist reference. Removed Step 10 DoD re-execution action. Step 10 is now communication-only. Validated by `dev-story-validator.cjs`.

### 3.6 — Clean Up Duplicate Variable ✅

- [x] **Problem:** `workflow.yaml` has both `story_dir` and `implementation_artifacts` (via `config_source`) resolving to the same path. Creates confusion about which to use.
- [x] **Fix:** Remove `story_dir` from `workflow.yaml`. Update the one reference in `instructions.xml` (line 81: "Search {story_dir}") to use `{implementation_artifacts}` instead. Or if the BMAD framework requires `story_dir`, alias it explicitly with a comment.
- [x] **Implemented:** Removed `story_dir` from `workflow.yaml`. Updated all `{story_dir}` references in `instructions.xml` to `{implementation_artifacts}`. Validated by `dev-story-validator.cjs`.

### 3.7 — Fix Brace Style Inconsistency ✅

- [x] **Problem:** Steps 1 and 4 use `{{sprint_status}}` (double-brace), Step 9 uses `{sprint_status}` (single-brace). Both refer to the same workflow.yaml variable. Could cause resolution ambiguity.
- [x] **Fix:** Standardize on the correct brace style per the workflow.xml engine's resolution rules. If workflow.yaml variables use single-brace and runtime variables use double-brace, update all references to match.
- [x] **Implemented:** Standardized all `sprint_status` references to `{{sprint_status}}` (double-brace). Fixed 5 occurrences in Steps 9 and 10. Validated by `dev-story-validator.cjs`.

---

## Group 4: Artifact Hygiene & Observability

_Changes to: various locations_

These improve the orchestrator's observability for future analysis and clean up accumulated cruft.

### 4.1 — Standardize Review Findings Output Path ✅

- [x] **Problem:** 21 of 23 review findings files are in `docs/temp/`, but the SKILL.md and review-loop.md specify `docs/progress/`. A consolidation plan exists (`docs/progress/epic-epics-stories-consolidation-plan.md`) but was never implemented.
- [x] **Fix:** Canonical location: `docs/progress/`. `review-loop.md` already specifies this correctly. Created `findings-path-validator.cjs` to validate path consistency across reviewer/fixer prompts and detect mismatched file locations.
- [x] **Implemented:** `.claude/hooks/findings-path-validator.cjs` — 3 pure functions with 10 unit tests (6 unit + 4 filesystem integration). Pending: move existing `docs/temp/story-*-review-findings-*.md` to `docs/progress/` (one-time migration).

### 4.2 — Clean Up Stray Root Files ✅

- [x] **One-time cleanup:** Extended `temp-cleanup.cjs` to also detect `.log` stray files (`quality-gate-*.log`, `build-*.log`, `test-*.log`). `.gitignore` patterns already cover all stray file types.
- [x] **Implemented:** Extended `STRAY_PATTERNS` in `temp-cleanup.cjs` with 3 new `.log` patterns. Added 3 new tests (15 total). One-time cleanup of root stray files pending manual execution.

### 4.3 — Auto-Update Completion Report After Each Story ✅

- [x] **Problem:** The Epic 2.1 completion report was written after Story D2 completed but never updated when D3, D4, and D1 completed. The final report is stale.
- [x] **Fix:** SKILL.md Phase 2.6 Step 3 now upserts the current story's row in the completion report after marking done. Phase 3 changed from "Generate" to "Finalize" (aggregate metrics only, rows already populated).
- [x] **Implemented:** `.claude/hooks/completion-report-validator.cjs` — validates report/state-file sync with 12 tests. SKILL.md Phase 2.6 and Phase 3 updated.

### 4.4 — Enforce Activity Log Timestamps ✅

- [x] **Problem:** Epic 2 activity log degrades from real timestamps to `[xx:xx]` placeholders after Story 2.1. Timestamps are essential for duration analysis and identifying slow phases.
- [x] **Fix:** SKILL.md Phase 2.1 now includes mandatory timestamp requirement for all activity log entries.
- [x] **Implemented:** `.claude/hooks/activity-log-validator.cjs` — parses activity log sections, flags placeholders and bare bullets, with 16 tests. SKILL.md updated.

### 4.5 — Add Duration Tracking to All Stories ✅

- [x] **Problem:** Epic 2 auto-run state file has `duration` only for Story 2.1. Epic 2.1 has duration for D2 and D3 but not D4 or D1. Duration data is essential for identifying which stories/phases are consuming disproportionate time.
- [x] **Fix:** SKILL.md Phase 2.1 records `startedAt` (ISO timestamp). Phase 2.6 records `completedAt` and computes `duration`. Both fields are mandatory for all done stories.
- [x] **Implemented:** `.claude/hooks/duration-tracker-validator.cjs` — validates timing fields on done stories with 13 tests. SKILL.md Phase 2.1 and 2.6 updated.

---

## Priority Order

| Priority | Group | Item                              | Impact                           | Effort |
| -------- | ----- | --------------------------------- | -------------------------------- | ------ |
| P0       | 1     | 1.1 Commit verification gate      | Eliminates #1 review finding     | Small  |
| P0       | 1     | 1.3 Structured AC verification    | Eliminates mock-only ACs         | Small  |
| P1       | 1     | 1.2 CDK synth gate                | Eliminates CDK topology failures | Small  |
| P1       | 3     | 3.3 Replace project_context ghost | Removes wasted glob every run    | Tiny   |
| P1       | 3     | 3.1 Remove Step 2 re-parse        | Removes redundant story parse    | Tiny   |
| P1       | 3     | 3.2 Fix Step 1 double-read        | Removes redundant file read      | Tiny   |
| P1       | 2     | 2.1 Pass baseBranch to fixer      | Fixes missing context            | Tiny   |
| P1       | 2     | 2.2 Pass story.touches            | Enables scope-drift detection    | Tiny   |
| P2       | 1     | 1.4 Standardize temp paths        | Stops root file littering        | Small  |
| P2       | 3     | 3.4 Reduce sprint-status reads    | Saves 2 redundant reads/story    | Small  |
| P2       | 3     | 3.5 Consolidate DoD validation    | Saves triple DoD evaluation      | Small  |
| P2       | 2     | 2.3 Pass coverage to fixer        | Reduces blind test reruns        | Tiny   |
| P2       | 2     | 2.4 Reviewer output path field    | Fixes agent/prompt mismatch      | Tiny   |
| P2       | 4     | 4.1 Standardize findings path     | Resolves location confusion      | Small  |
| P2       | 4     | 4.3 Auto-update completion report | Fixes stale reports              | Small  |
| P2       | 4     | 4.4 Enforce timestamps            | Enables duration analysis        | Tiny   |
| P2       | 4     | 4.5 Duration tracking             | Enables perf analysis            | Small  |
| P3       | 4     | 4.2 Clean up root files           | One-time housekeeping            | Tiny   |
| P3       | 3     | 3.6 Remove duplicate variable     | Reduces confusion                | Tiny   |
| P3       | 3     | 3.7 Fix brace inconsistency       | Style consistency                | Tiny   |
| P3       | 2     | 2.5 Inline ACs in reviewer prompt | Token optimization               | Medium |

---

## Success Metrics

After implementing these changes, the next epic run should show:

1. **Review rounds ≤ 1.5 avg** (down from 2.0 across Epic 2/2.1)
2. **Zero "uncommitted files" findings** (currently 4 of 6 stories)
3. **Zero "mock-only AC" findings** (currently 3 of 6 stories)
4. **Zero stray temp files at project root** after a run
5. **All activity log entries have real timestamps**
6. **All stories have duration tracked in state file**
7. **Completion report current after every story** (not just the first)

---

## Notes

- Group 1 (quality gate) changes are the highest-value improvements — they directly reduce review rounds, which is the biggest time sink in the current workflow.
- Group 3 (dev-story efficiency) changes are mostly tiny edits with cumulative token savings across every story run.
- Group 2 (context passing) changes are low-effort, low-risk, and improve subagent effectiveness.
- Group 4 (hygiene) changes improve observability for future analysis sessions like this one.
- The story-guard hook and SKILL.md readiness gate (implemented earlier today) are prerequisites — they ensure the orchestrator starts with real stories, which is foundational to all other improvements.
