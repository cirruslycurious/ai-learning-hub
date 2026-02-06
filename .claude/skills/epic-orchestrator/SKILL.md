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
6. **Never silently ignore failures** — Failures trigger auto-recovery (max 3 attempts), then require human decision (fix/skip/pause)
7. **Idempotent operations** — All GitHub operations (issue/branch/PR creation) reuse existing resources if found
8. **State persistence** — Progress saved continuously with atomic writes; `--resume` picks up exactly where workflow left off
9. **Human checkpoints** — Scope confirmation (Phase 1), per-story approval (Phase 2), integration checkpoints (Phase 2), and completion review (Phase 3) require human approval

---

## Phase 1: Planning & Scope

### 1.1 Load Epic File

Locate and parse the epic file:

1. Find epic file at `_bmad-output/planning-artifacts/epics/epic-{N}.md` (where N is extracted from epic_id, e.g., "Epic-1" → "epic-1.md")
2. If `--epic-path` provided, use that path instead
3. Parse the epic file to extract: epic title, description, and the list of story references

### 1.2 Load Story Files

For each story referenced in the epic:

1. Read story file (typically at `_bmad-output/implementation-artifacts/stories/{story_id}.md`)
2. Parse YAML frontmatter: `id`, `title`, `depends_on`, `touches`, `risk`
3. Store as structured story objects with `story.dependencies` for consistent access

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

- For each dependency, verify status is "done" in state file
- For stories WITH dependents (default `--require-merged`): verify code reached base branch via `git merge-base --is-ancestor` (see state-file.md dependency completion policy)
- If dependency not met → error with actionable message

**Update status:** `updateStoryStatus(story, "in-progress")`

**Create resources (idempotent via StoryRunner):**

```
issue = getOrCreateIssue(story, epic)     // Reuses existing if found
branch = getOrCreateBranch(story)          // Reuses existing if found
```

All operations go through StoryRunner interface (see story-runner.md). No direct `gh` commands.

### 2.2 Implementation (Protected by Hooks)

**Invoke `/bmad-bmm-dev-story`** for the current story:

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

**Final quality gate** (run AFTER PostToolUse hooks complete, before commit):

```bash
npm run lint      # Verify format/style
npm run build     # Verify TypeScript compiles
npm test          # Verify all tests still pass after formatting
```

### 2.3 Commit & PR

**Commit with issue reference:**

```bash
git commit -m "feat: implement story ${story.id} - ${story.title} #${issue.issueNumber}"
```

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

### 2.4 Mark for Review

Update status: `updateStoryStatus(story, "review")`

### 2.5 Code Review Loop

**Read `review-loop.md` in this skill directory for the full protocol.**

Summary of the loop:

1. **Spawn `epic-reviewer` subagent** (Task tool, `subagent_type: "epic-reviewer"`) — fresh context, writes findings doc
2. **Read findings doc**, count MUST-FIX items (Critical + Important)
3. **If clean (0 MUST-FIX):** Exit loop, proceed to 2.6
4. **If not clean AND round < 3:** Spawn `epic-fixer` subagent (Task tool, `subagent_type: "epic-fixer"`) — reads findings, fixes issues, commits
5. **If not clean AND round == 3:** Escalate to human (manual review / accept / override limit)
6. Loop back to step 1 with fresh reviewer

**In `--dry-run` mode:** Skip subagent spawning, log dry-run messages, proceed directly to 2.6.

### 2.6 Finalize Story [HUMAN CHECKPOINT]

**Step 1: Sync with main**

```bash
git fetch origin main
git merge origin/main    # Merge, never rebase (preserves history, no force push)
```

- If merge succeeds: re-run tests, push
- If merge conflicts: attempt auto-resolve for simple cases (imports, non-overlapping changes). Escalate complex conflicts to human.

**Step 2: Update PR description** — add review summary (rounds, findings fixed, review doc links)

**Step 3: Mark complete & prompt user**

- `updateStoryStatus(story, "done")`
- Record final commit SHA
- Show combined summary: PR#, tests, coverage, review rounds, findings fixed, progress (N/M)

**Ask:** `Continue to Story X.Z? (y/n/pause/skip)`

- **y** → Continue to next story
- **n** → Stop execution, save progress
- **pause** → Save state, resume later with `--resume`
- **skip** → Skip next story (with dependency validation):
  - If skipped story has NO dependents → safe to skip
  - If skipped story HAS dependents → show impact, ask: (a) skip entire sub-tree, (b) go back, (c) remove dependents from scope

### 2.7 Integration Checkpoint

**Read `integration-checkpoint.md` in this skill directory for validation details.**

**When:** After completing a story where `story.hasDependents === true`

**Checks:**

1. Shared file changes — `git diff --name-only` cross-referenced with dependent stories' `touches` field
2. Interface/type changes — TypeScript export analysis vs dependent imports
3. Acceptance criteria — re-run tests for completed story

**Result classification and user interaction** (see integration-checkpoint.md for details):

- **Green (all clear):** Show results, auto-continue to next story (still display checkpoint summary)
- **Yellow (warnings):** Show warnings, prompt user to confirm before continuing
- **Red (failures):** Escalate to user, do NOT continue automatically

**User options (when prompted):** y / n / pause / review-X.Y

---

## Phase 3: Completion & Reporting

After all stories complete (or user stops):

1. **Generate epic report** at `docs/progress/epic-{id}-completion-report.md`:
   - Status (Complete/Paused/Partial)
   - Duration, stories completed count
   - Per-story table: status, PR#, review rounds, findings fixed, duration
   - Metrics: average story time, test pass rate, review convergence, common issue categories
   - Blockers list with details
   - Next steps (merge PRs, investigate blockers, run integration tests)

2. **Update epic file** — mark completed stories, add timestamps, link PRs

3. **Update state file** — set `status: done` (or `paused` if user stopped early)

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
