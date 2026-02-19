---
name: epic-orchestrator
description: "Orchestrates autonomous epic implementation: dependency analysis, story loop, review cycles, human checkpoints"
disable-model-invocation: true
user-invocable: false
---

# Epic Orchestrator

Autonomous epic implementation engine. Execute stories in dependency order with code review loops, integration checkpoints, and human approval gates.

## Safety Invariants

These are **non-negotiable**. The orchestrator enforces ALL of these at all times:

1. **Never auto-merge PRs** — All PRs remain open for human review; workflow NEVER merges
2. **Never bypass hooks** — All commits go through pre-commit hooks (architecture-guard, import-guard, TDD-guard, etc.)
3. **Never force push** — All pushes use standard `git push` (no `--force` or `--force-with-lease`)
4. **Never push to base branch** — All story work happens on feature branches; base branch (main/master) remains protected
5. **Never skip tests** — All stories must pass tests before marking complete
6. **Never silently ignore failures** — Failures trigger auto-fix (max 2 attempts), then require human decision (fix/skip/pause)
7. **Idempotent operations** — All GitHub operations (issue/branch/PR creation) reuse existing resources if found
8. **State persistence** — Progress saved continuously with atomic writes; `--resume` picks up exactly where workflow left off
9. **Human checkpoints** — Scope confirmation (Phase 1), per-story approval (Phase 2), integration checkpoints (Phase 2), and completion review (Phase 3) require human approval
10. **Never implement without a real story** — Each story must have a standalone story file with acceptance criteria, dev notes/task breakdown, and ready-for-dev status. Planning summaries, epic descriptions, and progress docs are NOT valid substitutes. FATAL STOP if story files are missing or incomplete (Phase 1.2 + 1.2a)

---

## Phase 1: Planning & Scope

### 1.1 Load Epic File

Locate and parse the epic file:

1. If `--epic-path` provided, use that path directly
2. Otherwise, load `_bmad-output/planning-artifacts/epics.md` (single file containing all epics under `## Epic List`) and extract the section matching the epic_id. Epics use `### Epic N:` headings (h3). For example, "Epic-1" → find `### Epic 1: ...` and parse through the next `---` separator or next `### Epic` heading or end of file.
3. Parse the extracted section to get: epic title, description, and the list of story references

### 1.2 Load Story Files

For each story referenced in the epic:

1. Resolve story file under `_bmad-output/implementation-artifacts/` (flat directory, no `stories/` subfolder). Story IDs use dot notation (e.g., `2.1`) but filenames use dashes with a slug (e.g., `2-1-shared-lambda-layer.md`). Resolution order:
   - Try exact match: `_bmad-output/implementation-artifacts/{story_id}.md`
   - Try dash-converted glob: `_bmad-output/implementation-artifacts/{N}-{M}-*.md` (where story_id `N.M` becomes `{N}-{M}-*`)
   - Fallback glob: `_bmad-output/**/{N}-{M}-*.md`
     If no match found — **FATAL STOP**:

   ```
   ❌ FATAL: Story file not found for ${story_id}.
   Searched: _bmad-output/implementation-artifacts/{story_id}.md, _bmad-output/implementation-artifacts/{N}-{M}-*.md

   The orchestrator CANNOT proceed without standalone story files.
   Story descriptions embedded in epic plans, progress docs, or other files
   are NOT valid substitutes — they lack the detail needed for implementation.

   Options:
   a) Create missing stories now (invoke /bmad-bmm-create-story for each)
   b) Cancel epic run
   ```

   **CRITICAL:** Do NOT fall back to reading story content from epic files, progress docs, planning summaries, or any other source. Only standalone story files at the expected path (or glob fallback) are valid. If the file does not exist, STOP. This is the same severity as a dependency cycle — the epic run cannot proceed.

   **Note on file layout:** Story files live flat in `_bmad-output/implementation-artifacts/` (no `stories/` subfolder). The filename convention is `{epic}-{num}-{slug}.md` (e.g., `2-1-shared-lambda-layer.md` for story `2.1`). There is no `_bmad-output/implementation-artifacts/stories/` directory.

2. Parse YAML frontmatter: `id`, `title`, `depends_on`, `touches`, `risk`
3. Store as structured story objects with `story.dependencies` for consistent access

### 1.2a Story Readiness Validation

After all story files are loaded, validate each story is implementation-ready. A story file existing is necessary but not sufficient — the content must be complete enough for an agent to implement without guessing.

**For each story, verify ALL of the following:**

1. **Required YAML frontmatter fields** — `id`, `title` must be present and non-empty. `depends_on` and `touches` must be present (can be empty arrays).
2. **Acceptance Criteria** — Story must contain an "Acceptance Criteria" section (or equivalent heading like "ACs") with at least 2 concrete, testable criteria. Criteria that are vague placeholders (e.g., "it works", "everything functions correctly") do not count.
3. **Dev Notes / Task Breakdown** — Story must contain a "Dev Notes", "Tasks", or "Technical Notes" section with a non-empty task or subtask breakdown. A story with no task breakdown forces the agent to invent implementation steps from vague requirements.
4. **Status check** — If the story YAML frontmatter contains a `status` field, it must be `ready-for-dev` or `done`. Stories with `status: draft` or `status: created` have not been through the creation workflow and are not ready.

**Readiness result for each story:** `ready` | `not-ready` (with list of failures)

**If ANY story fails readiness validation — STOP and present findings:**

```
❌ Story Readiness Gate — ${failCount} of ${totalCount} stories not ready

Story ${story_id}: NOT READY
  ✗ Missing: Acceptance Criteria (found 0, need ≥2)
  ✗ Missing: Dev Notes / Task Breakdown
  ✓ YAML frontmatter complete

Story ${story_id}: NOT READY
  ✗ Status is "draft" (need "ready-for-dev")
  ✓ Acceptance Criteria (4 found)
  ✓ Dev Notes present

Options:
a) Create/complete stories now — invoke /bmad-bmm-create-story for each not-ready story
b) Remove not-ready stories from scope and continue with ready stories only
c) Cancel epic run
```

**Option (b) — scope reduction:** If the user chooses to remove not-ready stories, re-run dependency analysis (1.3) on the reduced set. If removing a story breaks dependencies for other in-scope stories, warn the user before proceeding.

**Why this gate exists:** Without this check, the orchestrator will attempt to implement stories from insufficient detail, causing the dev agent to hallucinate implementation decisions, produce code that doesn't match intent, or build against a planning summary instead of a real spec. This was observed in practice during Epic 2 where the orchestrator proceeded with no standalone story files at all, using a 30-line planning summary as a substitute.

### 1.3 Dependency Analysis

**Read `dependency-analysis.md` in this skill directory for the complete algorithm.**

Execute these steps:

1. Parse dependencies from YAML frontmatter (with prose fallback + warning)
2. Build dependency graph (adjacency list)
3. Compute dependents (inverse graph) — populates `story.dependents` and `story.hasDependents`
4. Detect cycles — **STOP if cycles found** (fatal error)
5. Topological sort — determines execution order
6. Mark integration checkpoint stories (those with dependents)

If `--stories` flag provided, run `validateStorySelection` from dependency-analysis.md before proceeding.

### 1.4 Scope Confirmation [HUMAN CHECKPOINT]

Display to user:

- Epic ID and title
- Story list with IDs, titles, and dependencies
- Execution order (from topological sort)
- Integration checkpoint markers

Ask: **"Implement: (a) all stories in order, (b) select specific stories, or (c) cancel?"**

- **(a)** All stories enter Phase 2 in topological order
- **(b)** Prompt for comma-separated story IDs, then validate dependencies (see dependency-analysis.md `validateStorySelection`). Options if deps missing: add missing / proceed anyway / cancel
- **(c)** Stop execution

### 1.5 Initialize StoryRunner

**Read `story-runner.md` in this skill directory for adapter details.**

Select runner:

- If `--dry-run` flag or `DRY_RUN=true` → use DryRunStoryRunner (no API calls, deterministic mock data)
- If `.github` directory exists → use GitHubCLIRunner (real `gh` + `git` commands)
- Otherwise → error: "No story tracking system detected"

### 1.6 Create/Resume State File

**Read `state-file.md` in this skill directory for format and resume semantics.**

**If `--resume` flag:**

1. Load existing state file at `docs/progress/epic-{id}-auto-run.md`
2. Parse YAML frontmatter for story statuses
3. Reconcile each story with GitHub reality (7-case matrix in state-file.md)
4. Show user: "Resuming from Story X.Y. Progress: N/M complete."
5. Enter Phase 2 starting from first non-done story

**If new run:**

1. Create state file at `docs/progress/epic-{id}-auto-run.md`
2. Initialize YAML frontmatter with epic_id, status: in-progress, started timestamp
3. Initialize all stories as `pending`

---

## Phase 2: Story Implementation Loop

For each story in scope (topological order):

### 2.1 Pre-Implementation

**Check dependencies:**

- **Fetch latest remote state** before checking: `git fetch origin ${baseBranch}` (ensures local remote-tracking ref is current for merge-base checks)
- For each dependency, verify status is "done" in state file
- For each dependency D of the current story: if D has dependents (`D.hasDependents === true`), verify D's code reached base branch via `git merge-base --is-ancestor ${D.commit} origin/${baseBranch}` (see state-file.md dependency completion policy). If D is a leaf story (no dependents), state file "done" status is sufficient.
- If dependency not met → show actionable error and prompt user:

  ```
  ❌ Dependency not met for Story ${story.id}
  Dependency ${depId} has status: ${depStatus}

  Options:
  a) Skip this story (mark as blocked, continue to next)
  b) Pause workflow (resume after manually resolving dependency)
  c) Override (proceed anyway — use only if you understand the risk)
  ```

**Update status:** `updateStoryStatus(story, "in-progress")`

**Record start time:** Add `startedAt: <ISO timestamp>` to the story's entry in the state file YAML frontmatter. This is used to compute duration when the story completes. Example: `startedAt: "2026-02-17T00:24:00Z"`.

**Activity log timestamp requirement:** All activity log entries MUST include an `[HH:MM]` timestamp (minutes since epic run started) or an ISO timestamp. Never use placeholder timestamps like `[xx:xx]`. If the exact time is unknown, use the current system time at the moment of writing.

**Create resources (idempotent via StoryRunner):**

```
issue = getOrCreateIssue(story, epic)     // Reuses existing if found
branch = getOrCreateBranch(story)          // Reuses existing if found
```

All operations go through StoryRunner interface (see story-runner.md). No direct `gh` commands.

### 2.2 Implementation (Protected by Hooks)

**Dry-run gate:** If `--dry-run` mode is active, skip the entire implementation phase. Log `[DRY-RUN] Would invoke /bmad-bmm-dev-story for Story ${story.id}` and proceed directly to Phase 2.5 (commit & PR will also be handled by DryRunStoryRunner). Set `coverage = null` since no tests are actually run.

**Invoke `/bmad-bmm-dev-story`** for the current story using the Skill tool: `Skill(skill: "bmad-bmm-dev-story", args: "${storyFilePath}")`. The orchestrator waits for the skill invocation to complete before proceeding. The skill runs inline in the current agent context (not as a subagent) and has access to the checked-out branch.

- Read story acceptance criteria
- Write tests first (tdd-guard enforces this)
- Write implementation (hooks enforce architecture, shared libs)
- Run tests until passing

**Hooks active during this phase:**

- `tdd-guard.js` (PreToolUse) — blocks implementation before tests
- `architecture-guard.sh` (PreToolUse) — blocks ADR violations
- `import-guard.sh` (PreToolUse) — enforces `@ai-learning-hub/*` shared libs
- `auto-format.sh` (PostToolUse) — auto-formats code
- `type-check.sh` (PostToolUse) — validates TypeScript
- Stop hook (agent) — blocks completion if tests fail

**Final quality gate** (run AFTER PostToolUse hooks complete, before review):

```bash
npm run lint             # Verify format/style
npm run type-check       # Verify TypeScript compiles (tsc --build, matches CI exactly)
npm test -- --coverage   # Verify all tests pass AND capture coverage in a single run
```

> **Why `type-check` not `build`?** CI runs `tsc --build` (project references mode),
> which is stricter than per-workspace `tsc`. Using `type-check` locally ensures
> parity with CI and catches type errors before pushing. You can also run
> `npm run validate` which chains lint → type-check → test in one command.

**Capture coverage** from the `npm test -- --coverage` output (the single test run above). Parse the coverage summary line to extract the overall percentage. Store as `coverage` for PR body and state file:

```javascript
// Parse coverage from the quality gate test output (already captured above)
// Look for "All files" line in Jest coverage summary table
// Example line: "All files      |   87.5 |    82.3 |   91.2 |   87.5 |"
const coverageMatch = testOutput.match(/All files\s*\|\s*([\d.]+)/);
const coverage = coverageMatch
  ? Math.round(parseFloat(coverageMatch[1]))
  : null;
// If coverage cannot be parsed, log warning and use "N/A" in PR body
```

**Temp artifact paths** — All quality gate artifacts MUST use standard paths (not ad-hoc filenames at project root):

- Secrets scan output: `.claude/temp/secrets-scan.json`
- Test output capture: `.claude/temp/test-output.txt`
- AC verification output: `.claude/temp/ac-verification.json`

Ensure `.claude/temp/` exists before writing: `mkdir -p .claude/temp`

**Structured AC verification** (run AFTER quality gate, BEFORE secrets scan):

Before proceeding to the secrets scan, verify each Acceptance Criterion has real implementation and real tests. For each AC in the story file:

1. State the criterion text
2. Cite the specific implementation file(s) and function(s) that fulfill it
3. Cite the specific test file(s) and test case(s) that verify it
4. Classify behavior: `"real"` (test exercises actual behavior) or `"mock-only"` (test only exercises mocked paths)

Write the structured output as JSON to `.claude/temp/ac-verification.json`:

```json
[
  {
    "criterion": "Returns 401 for invalid JWT",
    "implFile": "backend/functions/auth/handler.ts",
    "testFile": "backend/functions/auth/handler.test.ts",
    "behaviorType": "real"
  }
]
```

Then run the validator:

```bash
node .claude/hooks/ac-verify-validator.cjs --input .claude/temp/ac-verification.json
```

If the validator reports `pass: false`, STOP. Fix the implementation or tests for the flagged ACs before proceeding. Tests must exercise real behavior, not just mock propagation.

**Secrets scan gate** (run AFTER AC verification, BEFORE commit verification):

Run a secrets pattern scan on all changed files:

```bash
git diff --name-only origin/${baseBranch}...HEAD
```

For each changed file, verify:

- No AWS account IDs (12-digit numbers in string literals)
- No AWS access keys (AKIA pattern)
- No AWS resource IDs (vpc-\*, subnet-\*, sg-\*, nat-\*, igw-\*, rtb-\*, eni-\*, ami-\*, snap-\*)
- No private key material (-----BEGIN \* PRIVATE KEY-----)
- No third-party API keys (sk_live\_\*, pk_live\_\*, Clerk/Stripe/SendGrid patterns)
- No connection strings (mongodb://, postgres://, redis://)
- No ARNs with embedded account IDs

If ANY findings: **STOP implementation**. Show findings to user. Do NOT proceed to review or commit. Write scan results to `.claude/temp/secrets-scan.json`.

**Commit verification gate** (run AFTER secrets scan, BEFORE marking for review):

Verify that all implementation work is actually committed to the branch. Run:

```bash
node .claude/hooks/commit-gate.cjs --base-branch ${baseBranch} --story-dirs ${story.touches}
```

Where `${story.touches}` is the comma-separated list of directories from the story's YAML frontmatter `touches` field (e.g., `backend/functions/auth,infra/stacks`). If the story has no `touches` field, omit `--story-dirs`.

If the gate reports `pass: false`:

- If "No changes committed": run `git add` for the relevant files, then `git commit` with an appropriate message, then re-run the gate.
- If untracked files listed: either `git add` and commit them, or confirm they are intentionally untracked (e.g., temp files). Re-run the gate.

Do NOT proceed to review with uncommitted implementation files.

**CDK synth gate** (conditional — run AFTER commit verification, BEFORE marking for review):

```bash
node .claude/hooks/cdk-synth-gate.cjs --base-branch ${baseBranch} --infra-dir infra/
```

This gate automatically detects whether `infra/` files were changed. If no infra files changed, it reports `skipped: true` and the orchestrator proceeds. If infra files changed, it runs `cdk synth --quiet` and reports the result.

If the gate reports `pass: false`: fix the CDK errors (circular dependencies, missing imports, CORS issues, etc.) and re-run. CDK topology errors caught here save 2+ review rounds.

### 2.3 Mark for Review

Update status: `updateStoryStatus(story, "review")`

### 2.4 Code Review Loop

**Read `review-loop.md` in this skill directory for the full protocol.**

The review loop operates on uncommitted local changes (the reviewer diffs the working tree against the base branch). No push occurs until the review loop exits cleanly.

Summary of the loop:

1. **Spawn `epic-reviewer` subagent** (Task tool, `subagent_type: "epic-reviewer"`) — fresh context, writes findings doc
2. **Read findings doc**, count MUST-FIX items (Critical + Important)
3. **If clean (0 MUST-FIX):** Exit loop, proceed to 2.5
4. **If not clean AND round < 3:** Spawn `epic-fixer` subagent (Task tool, `subagent_type: "epic-fixer"`) — reads findings, fixes issues, commits locally
5. **If not clean AND round == 3:** Escalate to human (manual review / accept / override limit)
6. Loop back to step 1 with fresh reviewer

**In `--dry-run` mode:** Skip subagent spawning, log dry-run messages, proceed directly to 2.5 (Commit & PR).

### 2.5 Commit & PR

**Pre-stage validation** (run BEFORE staging):

Check for sensitive file extensions that should never be committed:

```bash
# List files that would be staged, check for sensitive extensions
git status --porcelain | grep -E '\.(env|pem|key|crt|p12|pfx)$'
# If any match found: STOP. Show files to user. Do NOT stage or commit.
```

**Stage all changes** (implementation files + any fixer commits):

```bash
git add -A
```

**Commit with issue reference:**

```bash
git commit -m "feat: implement story ${story.id} - ${story.title} #${issue.issueNumber}"
```

**Note:** If the review loop's fixer already made commits during fix cycles, this final commit captures any remaining unstaged changes. The branch will contain the implementation commit(s) plus any fixer commits from the review loop.

**Record commit SHA** in state file (needed for dependency merge-check):

```bash
git rev-parse HEAD  # Store result as stateFile.stories[story.id].commit
```

**Push branch:** `git push -u origin ${branchName}` (standard push, never force)

**Create PR (idempotent via StoryRunner):**

```
pr = getOrCreatePR(story, epic, issue, coverage)
```

**If PR creation fails:** Show manual fallback command, mark story as `blocked`, ask user to continue or pause.

**Clean up temp artifacts** (run AFTER push, BEFORE CI verification):

```bash
node .claude/hooks/temp-cleanup.cjs --project-dir ${projectDir}
```

This removes any stray quality gate artifacts from the project root (e.g., `quality-gate-*.json`, `secrets-*.json`, `test-output*.txt`). These should have been written to `.claude/temp/` but may have been created at the root by earlier invocations.

**Verify CI passes** (MANDATORY — do NOT proceed to human checkpoint until CI is green):

```bash
gh pr checks ${pr.number} --watch   # Wait for all CI checks to complete
```

- **All checks pass:** Proceed to 2.6 (Finalize Story)
- **Any check fails:** Investigate the failure, fix locally, push again, and re-verify.
  Do NOT present the PR as ready for merge until CI is green.

> **Why this matters:** The local quality gate (`npm run validate`) catches most issues,
> but CI may run additional or stricter checks (e.g., `tsc --build` vs per-workspace `tsc`,
> CDK synth, security scanning). Never assume local green means CI green.

### 2.6 Finalize Story [HUMAN CHECKPOINT]

**Step 1: Sync with main**

```bash
git fetch origin ${baseBranch}
git merge origin/${baseBranch}    # Merge, never rebase (preserves history, no force push)
```

- If merge succeeds: re-run tests (`npm test`):
  - **Tests pass:** push updated branch
  - **Tests fail after merge:** The merge introduced a regression. Present error recovery options:

    ```
    ❌ Tests failed after merging main into Story X.Y branch
    Options:
    a) Auto-fix: Analyze failures and attempt fix (max 2 attempts)
    b) Revert merge: git reset --merge ORIG_HEAD, keep story in "review" status, pause for manual resolution
    c) Skip story: Mark as blocked, continue to next
    d) Debug: Show full test output
    ```

    **Note on revert command:** Use `git reset --merge ORIG_HEAD` (not `git merge --abort`) because the merge already completed successfully — `git merge --abort` only works during an in-progress merge with unresolved conflicts. `git reset --merge ORIG_HEAD` undoes a completed merge by resetting to the pre-merge state.

- If merge conflicts (merge did NOT complete): use `git merge --abort` to cancel the in-progress merge, then attempt auto-resolve for simple cases (imports, non-overlapping changes). Escalate complex conflicts to human.

**Important:** Steps 2 and 3 below are only reached if Step 1 (sync with base branch) succeeds. If Step 1 fails (merge conflict or test failure), follow the error recovery paths above — do NOT proceed to Steps 2 or 3.

**Step 2: Update PR description** — add review summary (rounds, findings fixed, review doc links)

**Step 3: Mark complete & prompt user**

- `updateStoryStatus(story, "done")`
- Record final commit SHA
- **Record completion time:** Add `completedAt: <ISO timestamp>` and compute `duration` from `startedAt` to `completedAt` (e.g., `"31m"`, `"1h 12m"`). Write both to the story's state file entry. Duration tracking is mandatory for all stories.
- **Update completion report:** Upsert the current story's row in `docs/progress/epic-{id}-completion-report.md`:
  - If the file doesn't exist, create it using the Phase 3 template with this story's row populated
  - If the file exists, upsert the story's row in the Story Summary table (replace pending row with completed data, or add new row)
  - Update the header: `Stories Completed` count, `Status` (set to `Partial` if stories remain, `Complete` if all done)
- Show combined summary: PR#, tests, coverage, review rounds, findings fixed, progress (N/M)

**User prompt (merged with integration checkpoint if applicable):**

For stories **WITHOUT dependents:** prompt here at Step 3:
`Continue to Story X.Z? (y/n/pause/skip)`

For stories **WITH dependents:** defer this prompt until AFTER Phase 2.7 integration checkpoint completes. Show integration checkpoint results alongside the prompt with a merged option set:
`Continue to Story X.Z? (y/n/pause/skip/review-X.Y)`

The `review-X.Y` option is only available when integration checkpoint ran and shows detailed diff for a dependent story (see integration-checkpoint.md).

**Options:**

- **y** → Continue to next story
- **n** → Stop execution, save progress (current story stays `done`, epic marked `paused`)
- **pause** → Current story stays `done`. Set epic-level status to `paused` in state file frontmatter (`status: paused`), save state, resume later with `--resume`. Do NOT call `updateStoryStatus` on the completed story — pause applies to the epic workflow, not to the finished story.
- **skip** → Skip the NEXT story in execution order (current story remains `done`). With dependency validation:
  - `updateStoryStatus(nextStory, "skipped")`
  - If skipped story has NO dependents → safe to skip, continue to story after
  - If skipped story HAS dependents → show impact, ask:
    - **(a) skip entire sub-tree** → `updateStoryStatus(depStory, "skipped")` for each dependent in sub-tree, continue to next non-skipped story
    - **(b) go back** → revert skip status, re-prompt the "Continue?" question
    - **(c) remove dependents from scope** → `updateStoryStatus(depStory, "skipped")` for each dependent, remove them from the in-memory execution list, continue to next non-skipped story

### 2.7 Integration Checkpoint

**Read `integration-checkpoint.md` in this skill directory for validation details.**

**When:** After completing a story where `story.hasDependents === true`. Runs AFTER Phase 2.6 sync-with-main and BEFORE the user "Continue?" prompt. (The 2.6 human checkpoint prompt is deferred until after integration checkpoint results are available, so the user sees the full picture before deciding.)

**Branch guarantee:** Before running integration checks, ensure the completed story's branch is checked out:

```bash
git checkout ${branchName}  # Ensure correct branch context after merge operations
```

**Checks:**

1. Shared file changes — `git diff --name-only` cross-referenced with dependent stories' `touches` field
2. Interface/type changes — TypeScript export diff analysis (see integration-checkpoint.md)
3. Acceptance criteria — re-run tests for completed story

**Result classification and user interaction** (see integration-checkpoint.md for details):

- **Green (all clear):** Show results, fold into the Phase 2.6 "Continue?" prompt (no separate prompt)
- **Yellow (warnings):** Show warnings alongside the Phase 2.6 "Continue?" prompt for user to consider
- **Red (failures):** Escalate to user, do NOT continue automatically

**User options (when prompted):** y / n / pause / review-X.Y

---

## Phase 3: Completion & Reporting

After all stories complete (or user stops):

1. **Finalize epic report** at `docs/progress/epic-{id}-completion-report.md`. Story rows are already populated incrementally during Phase 2.6. In this step, fill in the aggregate Metrics section (average duration, review convergence, common issue categories) and update the Status to "Complete" (or "Paused" if stopped early). Use this template if the file doesn't exist yet:

   ```markdown
   # Epic {id} Completion Report

   **Status:** {Complete | Paused | Partial}
   **Duration:** {total duration}
   **Stories Completed:** {done_count}/{total_count}
   **Date:** {completion date}

   ## Story Summary

   | Story | Title   | Status   | PR    | Coverage    | Review Rounds | Findings Fixed | Duration   |
   | ----- | ------- | -------- | ----- | ----------- | ------------- | -------------- | ---------- |
   | {id}  | {title} | {status} | #{pr} | {coverage}% | {rounds}      | {fixed_count}  | {duration} |

   ## Metrics

   - **Average story time:** {avg_duration}
   - **Test pass rate:** {pass_rate}%
   - **Review convergence:** {avg_rounds} rounds average
   - **Common issue categories:** {categories}

   ## Blockers

   {list of blocked stories with details, or "None"}

   ## Next Steps

   - [ ] Review and merge open PRs: {list of PR numbers}
   - [ ] Investigate blocked stories: {list or "None"}
   - [ ] Run full integration test suite
   - [ ] Update sprint status
   ```

2. **Update epic file** — mark completed stories, add timestamps, link PRs

3. **Update state file** — set epic-level `status: done` (or `paused` if user stopped early). Note: `paused` is a valid story and epic status (see state-file.md)

4. **Notify user** — show completion summary, list all PRs for review, highlight blockers

---

## Error Recovery

### Test Failures

When tests fail during implementation:

```
❌ Tests Failed for Story X.Y
Options:
a) Auto-fix: Analyze and attempt fix (max 2 attempts)
b) Skip story: Mark as blocked, continue to next
c) Pause: Stop execution, save progress
d) Debug: Show full test output
```

Auto-fix: analyze failure → attempt fix (hooks enforce correct patterns) → re-run tests. Max 2 attempts, then escalate.

### Hook Violations

When hooks block an action (architecture-guard, import-guard, etc.):

- **Self-correcting:** Hooks teach the correct pattern. The agent reads the hook's error message and retries with the correct approach.
- **No user intervention needed** unless the hook blocks repeatedly (>3 times for same violation).

### Merge Conflicts

When syncing with main produces conflicts:

```
⚠️ Merge Conflict Detected
Options:
a) Auto-resolve (simple conflicts: imports, non-overlapping changes)
b) Manual resolution (pause for human)
c) Skip story (mark as blocked, continue)
```

### PR Creation Failures

If `gh pr create` fails (API error, network):

- Show manual fallback: `gh pr create --base {base} --head {head} --title "{title}"`
- Mark story as `blocked`
- Ask: continue to next story or pause

---

## Flags & Modes

### `--resume`

Resume from existing state file. Reconciles state file (primary) with GitHub reality (secondary). See state-file.md for the 7-case reconciliation matrix.

### `--stories=1.1,1.2,1.5`

Implement only specific stories. Validates dependencies upfront (see dependency-analysis.md `validateStorySelection`). Topological sort applied to selected subset.

### `--dry-run`

Simulate workflow without creating branches/PRs/commits. Uses DryRunStoryRunner (deterministic mock IDs, logging only). State file IS created. Subagent spawning is skipped.

### `--epic-path`

Override auto-detected epic file path.

### `--no-require-merged`

Disable strict dependency completion checking (state file wins for all stories, not just leaf stories). Use only when you understand the risk.

---

## Lessons Learned

Accumulated from past epic runs. Read these before starting a new epic.

### Epic 2 (Authentication)

1. **Story files MUST exist before the epic run starts.** During an early Epic 2 run, the orchestrator found zero standalone story files (`Glob _bmad-output/**/stories/*` returned nothing). Instead of stopping, it used a 30-line planning summary from `docs/progress/epic-2-stories-and-plan.md` as a substitute and proceeded to implement. This produced code based on guesswork rather than real specs. The fix: Phase 1.2 now FATAL STOPs on missing stories (same severity as dependency cycles), and Phase 1.2a validates story content readiness (ACs, dev notes, status) before any implementation begins. Planning docs, progress files, and embedded story descriptions are never valid substitutes for standalone story files.

2. **Use `npm run type-check` not `npm run build` in quality gate.** CI runs `tsc --build` (project references mode) which is stricter than per-workspace `tsc`. Vitest strips types via esbuild, so tests pass even with TS errors. The `type-check` script matches CI exactly. Run `npm run validate` to chain lint → type-check → test.

3. **CDK entry paths need `process.cwd()` not `__dirname`.** With ESM + esbuild bundling, `__dirname` resolves to the bundled output directory, not the source. Use `path.join(process.cwd(), 'backend/functions/...')`.

4. **Use `CLERK_SECRET_KEY_PARAM` env var + SSM runtime fetch.** Don't use CDK `ssm-secure` dynamic references for Lambda env vars — they resolve at deploy time and get cached. Instead, pass the SSM parameter name and fetch at runtime with `@aws-sdk/client-ssm`.

5. **Merge guard pre-commit hook is active.** The repo has a gitleaks pre-commit hook that blocks commits with secrets. Factor this into commit workflows.

6. **Always verify CI passes before presenting PR as ready.** After pushing a PR, run `gh pr checks --watch` and wait for all checks to pass. Never tell the user a PR is ready to merge without confirming CI is green first. Local quality gate is necessary but not sufficient — CI is the source of truth.
