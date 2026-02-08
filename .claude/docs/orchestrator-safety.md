# Orchestrator Safety: Workflow-Level Invariants

**Version:** 1.0
**Date:** 2026-02-07
**Status:** Active in Epic 1 (stories 1.1–1.9 complete, 1.10–1.14 remaining)

## Overview

The epic orchestrator (`/bmad-bmm-auto-epic`) enforces **workflow-level safety invariants** during autonomous epic implementation. This is Layer 2 of our [three-layer safety architecture](./safety-architecture.md). The orchestrator coordinates [hooks (Layer 1)](./hook-system.md) and human checkpoints (Layer 3) to ensure quality convergence and safe autonomous execution.

**Primary Files:**

- `.claude/skills/epic-orchestrator/SKILL.md` — Main orchestrator logic
- `.claude/skills/epic-orchestrator/review-loop.md` — Multi-agent code review protocol
- `.claude/skills/epic-orchestrator/integration-checkpoint.md` — Dependency validation
- `.claude/skills/epic-orchestrator/dependency-analysis.md` — Dependency graph + toposort
- `.claude/skills/epic-orchestrator/state-file.md` — State persistence + resume
- `.claude/skills/epic-orchestrator/story-runner.md` — StoryRunner interface (GitHub/DryRun adapters)

**Subagents:**

- `.claude/agents/epic-reviewer.md` — Fresh-context code reviewer
- `.claude/agents/epic-fixer.md` — Code fixer guided by findings

## Nine Workflow-Level Invariants

These invariants are enforced by orchestrator design and verified by implementation:

### 1. Never Auto-Merge PRs

**Invariant:** The orchestrator does not call PR merge operations. All pull requests remain open for human review.

**Why:** Human controls final integration into base branch. Destructive changes are visible and reversible.

**Enforcement:**

- Orchestrator uses `gh pr create` command
- No `gh pr merge` command exists in orchestrator code (verified by grep)
- PRs listed in completion report for human review
- Human merges PRs via GitHub UI or CLI

**Override:** None. Enforced by design.

---

### 2. Never Bypass Hooks

**Invariant:** The orchestrator does not use hook bypass flags. Assumes hooks are enabled; escalates if hooks fail repeatedly.

**Why:** Hooks provide deterministic safety (bash-guard, file-guard, tdd-guard, architecture-guard, import-guard). Bypassing them removes critical protections.

**Enforcement:**

- All `git commit` commands use standard form (no `--no-verify` flag, verified by grep)
- Edit/Write tool calls trigger PreToolUse hooks (bash-guard, file-guard, etc.) before execution
- Edit/Write tool calls trigger PostToolUse hooks (auto-format, type-check) after execution
- If hooks fail >3 times consecutively, orchestrator escalates to human (see Error Recovery)

**Note:** Orchestrator assumes Claude Code hooks are enabled per `.claude/settings.json`. If settings are modified or hooks disabled externally, enforcement breaks. No runtime verification of hook state.

---

### 3. Never Force Push

**Invariant:** The orchestrator does not use force push flags. All pushes use standard `git push`.

**Why:** Force push rewrites history, potentially destroying work. Standard push preserves all commits.

**Enforcement:**

- All `git push` commands use standard form (verified by grep: no `--force` in orchestrator code)
- bash-guard hook blocks force push attempts at tool-call level
- If force push somehow attempted, hook blocks and orchestrator receives error

**Override:** None. Enforced by design + hook backup.

---

### 4. Never Push to Base Branch

**Invariant:** The orchestrator does not push directly to main/master. All story work happens on feature branches.

**Why:** Base branch is protected. All changes go through PR workflow for review.

**Enforcement:**

- Orchestrator creates feature branches (`story-X-Y-description`)
- All pushes target feature branch (`git push -u origin <branch>`)
- bash-guard hook blocks `git push origin main/master` at tool-call level
- PRs created from feature branch to base branch

**Override:** None. Enforced by design + hook backup.

---

### 5. Never Skip Tests

**Invariant:** The orchestrator does not mark stories complete without passing tests. Stories must pass tests before progressing to PR creation.

**Why:** Passing tests are the minimum quality bar. Failing tests indicate broken functionality.

**Enforcement:**

- After story implementation (Phase 2.2), orchestrator runs `npm test` before entering review loop
- If tests fail:
  - Orchestrator attempts auto-fix (max 2 attempts)
  - If auto-fix exhausted → escalates to human (user chooses: manual fix / skip story / pause)
- test-validator Stop hook provides additional validation at agent completion (blocks stopping if tests fail)
- Story cannot progress to PR creation (Phase 2.5) unless tests pass

**Override:** User can skip story (marks as `blocked`), but cannot mark story as `done` with failing tests.

---

### 6. Never Silently Ignore Failures

**Invariant:** The orchestrator does not proceed silently when operations fail. Failures trigger auto-fix (max 2 attempts), then require human decision.

**Why:** Silent failures lead to broken state. Escalation ensures human awareness and decision-making.

**Enforcement:**

- Test failures → auto-fix (max 2) → escalate
- Hook violations → self-correct (agent reads error) → escalate after >3 violations
- Merge conflicts → auto-resolve simple → escalate complex
- PR creation failures → show manual fallback → mark blocked → ask continue/pause

**Override:** User must explicitly choose to skip story or accept risk.

---

### 7. Idempotent Operations

**Invariant:** The orchestrator reuses existing GitHub resources (issues, branches, PRs) if found. Does not create duplicates.

**Why:** Prevents GitHub clutter. Resume workflow works correctly.

**Enforcement:**

- `getOrCreateIssue()` — checks for existing issue via `gh issue list` before creating
- `getOrCreateBranch()` — checks for existing branch (local + remote) via `git branch -a` before creating
- `getOrCreatePR()` — checks for existing PR via `gh pr list` before creating
- All operations via StoryRunner interface (encapsulates idempotency logic)

**Override:** None. Enforced by design.

---

### 8. State Persistence

**Invariant:** The orchestrator saves progress continuously with atomic writes. Supports `--resume` to continue from last checkpoint.

**Why:** Long-running epics can be paused and resumed. State is preserved across sessions.

**Enforcement:**

- State file at `docs/progress/epic-{id}-auto-run.md`
- YAML frontmatter with story statuses (pending/in-progress/review/done/blocked/skipped)
- Atomic writes (write to temp file → move to final path, prevents corruption)
- `--resume` flag reconciles state file with GitHub reality (7-case reconciliation matrix)

**Override:** None. Enforced by design.

---

### 9. Human Checkpoints

**Invariant:** The orchestrator pauses for explicit human approval at 4 workflow milestones.

**Why:** Human retains control over scope, story completion, integration risk, and final delivery.

**Enforcement:**

- Phase 1.4: Scope confirmation (all stories / select specific / cancel)
- Phase 2.6: Per-story completion (continue / stop / pause / skip)
- Phase 2.7: Integration checkpoint (for stories with dependents)
- Phase 3: Completion & reporting (epic complete, review PRs)

**Override:** None. Enforced by design (orchestrator waits for user input at each gate).

---

## Multi-Agent Code Review Loops

**Purpose:** Achieve code quality convergence through adversarial review + auto-fix cycles.

**Protocol:** See `.claude/skills/epic-orchestrator/review-loop.md` for full details.

### Review Loop Flow

```
Story Implementation Complete
  ↓
[Review Round 1]
  Spawn epic-reviewer (fresh context)
  → Reviewer writes findings doc
  → Orchestrator counts MUST-FIX findings
  ↓
  If MUST-FIX == 0 → EXIT LOOP (clean)
  If MUST-FIX > 0 AND round < 3 → Continue to Fix
  If MUST-FIX > 0 AND round == 3 → Escalate to Human
  ↓
[Fix Cycle 1]
  Spawn epic-fixer (implementation context)
  → Fixer reads findings
  → Fixer fixes Critical + Important issues
  → Fixer commits fixes locally
  ↓
[Review Round 2]
  Spawn NEW epic-reviewer (fresh context, no memory of Round 1)
  → Reviewer sees current code state (includes fixer commits)
  → Reviewer writes NEW findings doc
  ↓
  If MUST-FIX == 0 → EXIT LOOP (clean)
  If MUST-FIX > 0 AND round < 3 → Continue to Fix
  If MUST-FIX > 0 AND round == 3 → Escalate to Human
  ↓
[Fix Cycle 2]
  Spawn epic-fixer again
  → Fixer reads Round 2 findings
  → Fixer fixes remaining issues
  → Fixer commits fixes locally
  ↓
[Review Round 3]
  Spawn NEW epic-reviewer (fresh context)
  → Reviewer writes Round 3 findings
  ↓
  If MUST-FIX == 0 → EXIT LOOP (clean)
  If MUST-FIX > 0 → ESCALATE TO HUMAN (max rounds exceeded)
  ↓
[Human Escalation]
  Show user Round 3 findings
  Options:
    a) Manual review and fix (pause autonomous workflow)
    b) Accept findings and mark story complete (not recommended)
    c) Continue with 1 more review round (override limit, hard cap: 5 rounds)
```

### Key Design Principles

**Fresh Conversational Context for Every Review:**

- Each reviewer spawned via Task tool (creates new subagent with separate conversational context)
- Reviewer has no memory of previous review rounds' discussions
- Reviewer sees current code state (files, git diff, test results)
- Ensures adversarial review without implementation bias from prior rounds

**Note:** "Fresh context" means fresh conversational history (no prior round chat), not fresh runtime environment. Reviewers share repo state, git history, and Claude Code instructions.

**Structured Findings:**

- **Critical (MUST-FIX):** Security vulnerabilities, crashes, data loss, ADR violations, hook violations, missing critical tests
- **Important (MUST-FIX):** Performance issues, incomplete implementation, architectural concerns, significant test gaps
- **Minor (NICE-TO-HAVE):** Code style, naming conventions, documentation, minor refactoring

**Progressive Escalation:**

- **Review rounds:** Reviewer runs (default: up to 3 rounds)
- **Fix cycles:** Fixer runs between review rounds (default: up to 2 fix cycles)
- Default limit: 3 review rounds → escalate to human at round 3 if MUST-FIX findings remain
- **Override limit:** User can approve up to 5 total review rounds (hard cap, prevents unbounded loops)
- User explicitly chooses to override limit (with full visibility of round 3 findings)

**Branch Locality:**

- Fixer commits locally but does NOT push during review loop
- Reviewer diffs `origin/{base}...{local-branch}` (includes fixer commits)
- Push happens in Phase 2.5 (Commit & PR), after review loop exits cleanly

---

## Integration Checkpoints

**Purpose:** Validate that dependent stories are still valid after upstream changes.

**When:** After completing a story with dependents (`story.hasDependents === true`)

**Protocol:** See `.claude/skills/epic-orchestrator/integration-checkpoint.md` for full details.

### Three Validation Checks

**1. Shared File Changes**

Commands used to detect file overlaps:

```bash
# Get actual files changed (triple-dot for PR-style diff)
git diff --name-only origin/${baseBranch}...${completedBranchName}

# Compare with dependent stories' `touches` field (from YAML frontmatter)
# Warn if overlap detected
```

Logic: For each dependent story, check if any actual changed files match patterns in the story's `touches` field. If overlap found, warn user.

**2. Interface/Type Changes**

Commands used to detect type changes:

```bash
# Get TypeScript diff for completed story
git diff origin/${baseBranch}...${completedBranchName} -- "*.ts" "*.d.ts"

# Parse diff for lines matching: export (type|interface|enum|const) <name>
# Cross-reference changed types with dependent stories' `touches` directories
```

Logic: If exported types/interfaces changed AND dependent story touches same directories, warn user of potential breakage.

**3. Acceptance Criteria Validation**

```bash
npm test  # Re-run full test suite to detect regressions
```

### Result Classification

**Green (all clear):**

- No file overlaps
- No type changes
- Tests pass
  → Continue automatically (still show user results)

**Yellow (warnings):**

- File overlaps detected OR type changes detected
- Tests pass
  → Show warnings, ask user to confirm

**Red (failures):**

- Tests failing after upstream changes
  → Escalate to user, do NOT continue automatically

### User Options at Checkpoint

- `y` or `yes` — Continue to next story
- `n` or `no` — Stop execution
- `pause` — Pause for manual investigation
- `review-X.Y` — Show detailed diff for dependent story X.Y

---

## Secrets Scan Gates

**Purpose:** Reduce likelihood of accidental secret commits by detecting high-confidence secret patterns and warning on sensitive identifiers.

**When:** Before marking story for review (Phase 2.2, before review loop)

### Detection Patterns (BLOCK)

These patterns are blocked with high confidence of being secrets:

**Private Keys:**

- `-----BEGIN * PRIVATE KEY-----`
- File patterns: `*.pem`, `*.key`, `*.crt`, `*.p12`, `*.pfx`

**High-Confidence API Keys:**

- AWS Access Keys: `AKIA[A-Z0-9]{16}` pattern
- Stripe Live Keys: `sk_live_*`, `pk_live_*`
- Connection Strings: `mongodb://`, `postgres://`, `redis://` with embedded credentials

### Detection Patterns (WARN)

These patterns may be sensitive but context-dependent (warn, don't block):

**AWS Resource Identifiers:**

- Account IDs (12-digit patterns) — may be acceptable in non-secret contexts
- Resource IDs (vpc-_, subnet-_, sg-\_, etc.) — often not secrets but worth flagging
- ARNs with embedded account IDs — context-dependent

**Third-Party Keys:**

- Clerk, SendGrid, GitHub tokens — patterns vary, may have test keys

### Pre-Stage Validation

```bash
# Before staging any changes for commit
git status --porcelain | grep -E '\.(env|pem|key|crt|p12|pfx)$'
# If match found → STOP, show files to user, do NOT stage or commit
```

### Enforcement

**If HIGH-CONFIDENCE findings (BLOCK patterns):**

- **STOP implementation** immediately
- Show findings to user
- Do NOT proceed to review or commit
- User must manually remediate

**If WARN findings:**

- Show warnings to user
- Ask user to confirm: "Are these identifiers safe to commit?"
- Proceed if user confirms

**Limitations:** This is pattern-based detection, not exhaustive. Does not catch:

- Base64-encoded secrets
- Obfuscated credentials
- Secrets in unusual formats
- Novel API key patterns

Users must still follow secrets-and-config rules (see [Secrets and Config](./secrets-and-config.md)).

---

## Error Recovery Patterns

### Test Failures

```
❌ Tests Failed for Story X.Y

Options:
a) Auto-fix: Analyze and attempt fix (max 2 attempts)
b) Skip story: Mark as blocked, continue to next
c) Pause: Stop execution, save progress
d) Debug: Show full test output
```

**Auto-fix flow:**

1. Analyze failure output
2. Attempt fix (hooks enforce correct patterns)
3. Re-run tests
4. If still failing and attempts < 2 → repeat
5. If still failing and attempts == 2 → escalate to user

### Hook Violations

**Self-Correcting:**

- Hooks teach correct pattern via error message
- Agent reads error, adjusts approach, retries
- No user intervention needed (most cases)

**Escalation (>3 violations):**

```
⚠️ Story X.Y Blocked by Hook Violations
Hook: bash-guard.js
Violations: 4 attempts to run 'git push --force'

Options:
  a) Manual fix (human intervention)
  b) Override hook (not recommended)
  c) Skip story
```

### Merge Conflicts

```
⚠️ Merge Conflict Detected

Options:
a) Auto-resolve (simple conflicts: imports, non-overlapping changes)
b) Manual resolution (pause for human)
c) Skip story (mark as blocked, continue)
```

### PR Creation Failures

```
❌ PR Creation Failed

API Error: <error message>

Manual fallback command:
gh pr create --base main --head story-1-2-description --title "Story 1.2: Title"

Options:
a) Continue to next story (mark current as blocked)
b) Pause execution (resume after fixing)
```

### Dependency Not Met

```
❌ Dependency not met for Story 1.3
Dependency 1.2 has status: in-progress

Options:
a) Skip this story (mark as blocked, continue to next)
b) Pause workflow (resume after manually resolving dependency)
c) Override (proceed anyway — use only if you understand the risk)
```

---

## Human Checkpoints

### Phase 1.4: Scope Confirmation

**When:** After loading epic, parsing stories, building dependency graph

**User Sees:**

- Epic ID and title
- Story list with IDs, titles, dependencies
- Execution order (topological sort)
- Integration checkpoint markers

**User Decides:**

- **(a)** Implement all stories in order
- **(b)** Select specific stories (with dependency validation)
- **(c)** Cancel execution

### Phase 2.6: Per-Story Completion

**When:** After story implementation, code review, commit, PR creation

**User Sees:**

- PR number and URL
- Test results and coverage percentage
- Review rounds completed
- Findings fixed (Critical / Important / Minor counts)
- Progress (N/M stories complete)

**User Decides:**

- `y` → Continue to next story
- `n` → Stop execution, save progress
- `pause` → Pause epic (resume later with `--resume`)
- `skip` → Skip next story (with dependency validation)

### Phase 2.7: Integration Checkpoint

**When:** After completing a story with dependents (before user "Continue?" prompt)

**User Sees:**

- Dependent stories list
- Shared file changes (actual vs expected)
- Interface/type changes detected
- Test results (pass/fail)
- Result classification (Green/Yellow/Red)

**User Decides:**

- `y` → Continue to next story
- `n` → Stop execution
- `pause` → Pause for manual investigation
- `review-X.Y` → Show detailed diff for dependent story X.Y

### Phase 3: Completion & Reporting

**When:** After all stories complete (or user stops early)

**User Sees:**

- Epic completion report (`docs/progress/epic-{id}-completion-report.md`)
- Story summary table (status, PR, coverage, review rounds, findings, duration)
- Metrics (avg story time, test pass rate, review convergence, common issues)
- Blockers (list of blocked stories with details)
- Next steps (review PRs, investigate blockers, run integration tests)

**User Decides:**

- Review PRs and merge (human controls final integration)
- Investigate blocked stories
- Update sprint status

---

## State Persistence & Resume

**State File:** `docs/progress/epic-{id}-auto-run.md`

**Format:**

```markdown
---
epic_id: "1"
status: in-progress
started: 2026-02-07T10:00:00Z
last_updated: 2026-02-07T15:30:00Z
stories:
  "1.1":
    status: done
    pr: 42
    commit: abc123def456
    coverage: 85
    review_rounds: 2
    findings_fixed: 3
  "1.2":
    status: in-progress
    pr: null
    commit: null
  "1.3":
    status: pending
---

# Epic 1 Auto-Run Progress

## Current Status

- In Progress: Story 1.2
- Completed: 1 / 14 stories
- Started: 2026-02-07 10:00 AM
```

**Resume Semantics:**

When `--resume` flag provided:

1. Load existing state file
2. Parse YAML frontmatter for story statuses
3. Reconcile each story with GitHub reality (7-case matrix in state-file.md)
4. Show user: "Resuming from Story X.Y. Progress: N/M complete."
5. Enter Phase 2 starting from first non-done story

**Reconciliation ensures:**

- State file is primary source of truth
- GitHub is secondary (validates state file)
- Conflicts resolved with user confirmation

---

## Dry-Run Mode

**Flag:** `--dry-run`

**Purpose:** Simulate workflow without side effects (testing, demonstration)

**Behavior:**

- Uses `DryRunStoryRunner` (no API calls, deterministic mock data)
- Skips subagent spawning (no epic-reviewer, no epic-fixer)
- State file IS created (for testing state management)
- Logs all operations without executing

**Example Output:**

```
[DRY-RUN] Would create issue: Story 1.2
[DRY-RUN] Would create branch: story-1-2-description
[DRY-RUN] Would invoke /bmad-bmm-dev-story for Story 1.2
[DRY-RUN] Would spawn epic-reviewer for Story 1.2 round 1
[DRY-RUN] Would spawn epic-fixer for Story 1.2 round 1
[DRY-RUN] Would create PR: Story 1.2 → main
```

---

## Further Reading

- [Safety Architecture Overview](./safety-architecture.md) — Three-layer model
- [Hook System Details](./hook-system.md) — Layer 1 enforcement
- [Tool Risk Classification](./tool-risk.md) — Operation risk matrix
- [Epic Orchestrator SKILL.md](../.claude/skills/epic-orchestrator/SKILL.md) — Full implementation
- [Review Loop Protocol](../.claude/skills/epic-orchestrator/review-loop.md) — Multi-agent review details
- [Integration Checkpoint](../.claude/skills/epic-orchestrator/integration-checkpoint.md) — Dependency validation details

---

**Last Updated:** 2026-02-07
**Maintainer:** Stephen (human-owned)
**Status:** Active in Epic 1 (stories 1.1–1.9 complete, 1.10–1.14 remaining)
