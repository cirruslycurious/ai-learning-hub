# State File Management

Supporting reference for the epic orchestrator. Read this file when entering Phase 1.6 (Create/Resume State File) or when updating story status during Phase 2.

## State File Format

**Location:** `docs/progress/epic-{id}-auto-run.md` (e.g., `docs/progress/epic-1-auto-run.md`)

**Structure:** YAML frontmatter (machine-readable source of truth) + markdown body (human-readable display, regenerated from frontmatter).

**Story statuses:** `pending` | `in-progress` | `review` | `done` | `blocked` (see Status Source of Truth table below for mapping to external systems).

```markdown
---
epic_id: Epic-1
status: in-progress
started: 2026-02-06T14:30:00Z
last_updated: 2026-02-06T15:15:00Z
stories:
  "1.1":
    {
      status: done,
      pr: 74,
      commit: abc123,
      coverage: 87,
      review_rounds: 2,
      duration: "12m",
    }
  "1.2":
    {
      status: done,
      pr: 75,
      commit: def456,
      coverage: 92,
      review_rounds: 1,
      duration: "8m",
    }
  "1.3": { status: in-progress }
  "1.4": { status: pending }
---

<!-- Human-readable display below (generated from frontmatter) -->

# Epic 1 Auto-Run Progress

| Story | Status         | PR  | Coverage | Review Rounds | Duration |
| ----- | -------------- | --- | -------- | ------------- | -------- |
| 1.1   | ✅ Complete    | #74 | 87%      | 2             | 12m      |
| 1.2   | ✅ Complete    | #75 | 92%      | 1             | 8m       |
| 1.3   | 🔄 In Progress | -   | -        | -             | -        |
| 1.4   | ⏳ Pending     | -   | -        | -             | -        |

## Activity Log

- [14:30] Epic 1 auto-run started
- [14:32] Story 1.1: Implementation started
- [14:42] Story 1.1: Tests passed (87% coverage)
- [14:44] Story 1.1: PR #74 created
- ...
```

**Key design:** The YAML frontmatter is the machine-readable source of truth. The markdown table is regenerated from frontmatter on each update. Never parse the markdown table — always parse YAML frontmatter.

## Status Source of Truth

**Primary:** State file (orchestration decisions)
**Secondary:** sprint-status.yaml, GitHub Issues/PRs (synced views)

| Status        | State File (emoji) | sprint-status.yaml | GitHub     |
| ------------- | ------------------ | ------------------ | ---------- |
| `pending`     | ⏳ Pending         | `backlog`          | No issue   |
| `in-progress` | 🔄 In Progress     | `in-progress`      | Issue open |
| `review`      | 🔍 In Review       | `review`           | PR open    |
| `done`        | ✅ Complete        | `done`             | PR merged  |
| `blocked`     | ❌ Blocked         | `blocked`          | Issue open |

All status transitions go through `updateStoryStatus(story, newStatus)` which updates the state file (primary) and syncs to secondary sources via `runner.updateStatus()`.

**Decision flow:** The workflow reads the state file to make all control-flow decisions (e.g., "Can I start Story 1.4?" → check that 1.2 and 1.3 are "done" in state file). Secondary sources inform recovery, not decisions.

**Conflict resolution:** If secondary sources diverge from state file, **state file wins** for orchestration. Emit warning: `⚠️ sprint-status.yaml shows Story 1.2 = 'in-progress', but state file shows 'done'. Using state file.`

## Resume Semantics (`--resume` flag)

When resuming from an existing state file, reconcile state file (primary) with GitHub reality (secondary):

| State File Status | GitHub Reality     | Action                                                       |
| ----------------- | ------------------ | ------------------------------------------------------------ |
| `done`            | PR merged          | Skip story (already complete)                                |
| `done`            | PR closed/unmerged | Keep "done" (state file wins; human closed PR intentionally) |
| `in-progress`     | PR exists          | Resume from post-commit (skip to review/finalization)        |
| `in-progress`     | Branch deleted     | Mark "blocked", require human decision                       |
| `in-progress`     | No PR/branch       | Resume from last successful checkpoint in activity log       |
| `pending`         | PR exists          | Treat as "review" (someone manually created PR)              |
| `pending`         | Branch exists      | Check out branch, resume from implementation phase           |

**Resume always favors state file status for control flow.** Secondary sources (GitHub) inform recovery strategy.

## Dependency Completion Policy

Different completion requirements based on whether a story has dependents:

**Stories WITH dependents** (default `--require-merged`):
Story only satisfies dependency if:

- PR is merged to base branch, OR
- Commit is reachable from base branch (verified via `git merge-base --is-ancestor ${commitSha} origin/${baseBranch}`)

**Rationale:** Downstream stories need code on base branch to build correctly.

**Leaf stories (NO dependents)** (relaxed):
Story considered "done" when:

- PR is open AND tests passing

**Rationale:** No downstream impact, safe to mark complete before human review/merge.

**Override:** `--no-require-merged` disables strict checking. Use only when you understand the risk.

## Atomic Write Protocol

To prevent corruption on crash or interruption:

1. Write state file to temporary path: `docs/progress/epic-{id}-auto-run.md.tmp`
2. Rename temp file to final path (atomic on most filesystems)
3. Never write directly to the state file

## Commit SHA Tracking

Record the HEAD commit SHA after each story's implementation:

```javascript
const commitSha = await execCommand("git rev-parse HEAD");
stateFile.stories[story.id].commit = commitSha;
```

Used for:

- Dependency completion verification: `git merge-base --is-ancestor ${commitSha} origin/${baseBranch}`
- Diff scope for code review: reviewer uses SHA to scope review to relevant changes
- Resume: identifies exactly what code was produced
