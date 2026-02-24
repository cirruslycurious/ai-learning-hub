# Phase Runner Protocol

Execution protocol for Phase 2 steps. Describes how the orchestrator reads the phase registry and runs each step with consistent handling for dry-run, resume, skip conditions, and gate criteria.

## Execution Loop

For each story in topological order:

```
1. Read phase-registry.md to get ordered step list (2.1 → 2.2 → 2.3 → 2.3b → 2.4 → 2.5 → 2.6 → 2.7)
2. Resolve current story and its state from the state file
3. Determine starting step (see Resume Semantics below)
4. For each step from starting step onward:
   a. Evaluate skip conditions from the registry
      - If skip condition met → log skip reason, advance to next step
   b. Execute step (invoke skill / run shell / spawn subagent per registry)
   c. Evaluate gate criteria
      - If gate passes → advance to next step
      - If gate fails → follow escalation semantics for that step
5. After all steps complete → story is done, move to next story in scope
```

## Skip Condition Evaluation

Before running a step, the runner checks its skip condition from the registry:

| Step | Skip Condition                                            | Evaluation                                                                                                                          |
| ---- | --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| 2.1  | — (never skipped)                                         | Always runs                                                                                                                         |
| 2.2  | `--dry-run`                                               | If `isDryRun === true`, log `[DRY-RUN] Would invoke /bmad-bmm-dev-story for Story ${story.id}`, skip step, advance to next          |
| 2.3  | `--dry-run`                                               | If `isDryRun === true`, log `[DRY-RUN] Would set story status to 'review'`, skip step (status stays `in-progress`), advance to next |
| 2.3b | No `backend/functions/` in `story.touches` OR `--dry-run` | Parse `story.touches`; if no handler paths OR `isDryRun`, log skip reason, advance to next step                                     |
| 2.4  | `--dry-run`                                               | If `isDryRun === true`, skip subagent spawning, log dry-run message                                                                 |
| 2.5  | — (never skipped)                                         | Always runs (DryRunStoryRunner handles mock operations internally)                                                                  |
| 2.6  | — (never skipped)                                         | Always runs                                                                                                                         |
| 2.7  | `story.hasDependents === false`                           | Computed during dependency analysis (Phase 1.3); skip if current story has no dependent stories                                     |

## Gate Criteria Evaluation

After a step completes, the runner evaluates its gate:

| Step | Gate                                     | On Failure                                                                     |
| ---- | ---------------------------------------- | ------------------------------------------------------------------------------ |
| 2.1  | Deps satisfied, resources created        | Prompt user: skip / pause / override                                           |
| 2.2  | Tests pass, lint clean, type-check clean | Auto-fix (max 2 attempts), then HALT                                           |
| 2.3  | Status updated                           | N/A (always succeeds)                                                          |
| 2.3b | 0 MUST-FIX findings                      | Round < 2: spawn fixer, re-scan. Round == 2: escalate per `dedup-scan-loop.md` |
| 2.4  | 0 MUST-FIX findings                      | Round < 3: spawn fixer, re-review. Round == 3: escalate per `review-loop.md`   |
| 2.5  | CI green, PR created                     | Fix CI failures, re-push. If PR fails, show manual command                     |
| 2.6  | Merge clean, tests pass, user approves   | Merge conflicts: auto-resolve or escalate. Test failures: auto-fix or escalate |
| 2.7  | Green or Yellow result                   | Red: escalate to user. Yellow: show warnings alongside 2.6 prompt              |

## Escalation Semantics

When a gate fails and cannot be auto-resolved, the runner escalates to the user. Escalation behavior is defined per step in the protocol docs:

- **2.1 (Pre-Implementation):** Dependency failure → user chooses skip / pause / override (SKILL.md §2.1)
- **2.2 (Implementation):** Test/lint failure → auto-fix (max 2), then HALT (SKILL.md §Error Recovery)
- **2.3b (Dedup Scan Loop):** Max rounds exceeded → user chooses fix / accept / extend (dedup-scan-loop.md §Step B)
- **2.4 (Code Review Loop):** Max rounds exceeded → user chooses fix / accept / extend (review-loop.md §Step B)
- **2.5 (Commit & PR):** CI failure → fix and re-push. PR creation failure → manual fallback (SKILL.md §2.5)
- **2.6 (Finalize Story):** Merge conflict → auto-resolve or escalate. Test failure → auto-fix or escalate (SKILL.md §2.6)
- **2.7 (Integration Checkpoint):** Red result → show details, user chooses continue / pause / review (integration-checkpoint.md)

The runner advances only when the step completes successfully or the user resolves an escalation. It never silently skips a failed gate.

## Dry-Run Mode

In `--dry-run` mode, the runner skips implementation-heavy steps while still exercising the control flow:

| Step | Dry-Run Behavior                                                                         |
| ---- | ---------------------------------------------------------------------------------------- |
| 2.1  | Runs normally with DryRunStoryRunner (mock issue/branch creation)                        |
| 2.2  | Skipped entirely; log `[DRY-RUN] Would invoke /bmad-bmm-dev-story`                       |
| 2.3  | Log `[DRY-RUN] Would set story status to 'review'`                                       |
| 2.3b | Skipped; log `[DRY-RUN] Would spawn epic-dedup-scanner`                                  |
| 2.4  | Skipped; log `[DRY-RUN] Would spawn epic-reviewer`                                       |
| 2.5  | Runs with DryRunStoryRunner (mock commit/push/PR)                                        |
| 2.6  | Runs with DryRunStoryRunner (mock merge/status update). Human checkpoint still triggers. |
| 2.7  | Runs if `story.hasDependents === true` (validation logic still exercised with mock data) |

## Resume Semantics

The state file (see `state-file.md`) stores story-level status only — there is no per-phase "current step" field. When resuming, the runner infers the starting step from the story status:

| Story Status                         | Starting Step | Rationale                                                    |
| ------------------------------------ | ------------- | ------------------------------------------------------------ |
| `pending`                            | 2.1           | Fresh start                                                  |
| `in-progress` (no branch)            | 2.1           | No recoverable state; restart from beginning                 |
| `in-progress` (branch exists, no PR) | 2.2           | Branch exists; resume implementation                         |
| `in-progress` (PR exists)            | 2.5           | Skip to post-commit (implementation already done)            |
| `review`                             | 2.3           | Re-run from 2.3, which re-runs 2.3b (dedup) and 2.4 (review) |
| `done`                               | —             | Skip story entirely                                          |
| `blocked`                            | —             | Prompt user: retry / skip / keep blocked                     |
| `paused`                             | Varies        | Same logic as `in-progress` — check for branch/PR existence  |

**Convention for `review` status:** The state file cannot distinguish between steps 2.3, 2.3b, and 2.4. The convention is to resume from step 2.3 and re-run the dedup scan (2.3b) and code review (2.4). This ensures no scan/review is skipped on resume, at the cost of potentially re-running a clean scan.

**Future enhancement (out of scope):** Add a `last_completed_phase` field per story in the state file YAML for precise phase-level resume. Example: `"3.1.5": { status: review, last_completed_phase: "2.3b" }` → resume from 2.4.

## Idempotency

All steps that create resources are idempotent via the StoryRunner interface:

- `getOrCreateIssue` — checks for existing issue before creating
- `getOrCreateBranch` — checks for existing branch before creating
- `getOrCreatePR` — checks for existing PR before creating

This makes the runner safe to re-run from any step without duplicate resource creation.

## Cross-References

- **Phase 2 steps (canonical prose):** `SKILL.md` §Phase 2
- **Step order and gate criteria:** `phase-registry.md` (this protocol's companion)
- **Dedup scan protocol:** `dedup-scan-loop.md`
- **Code review protocol:** `review-loop.md`
- **Integration checkpoint protocol:** `integration-checkpoint.md`
- **State file format and resume:** `state-file.md`
- **StoryRunner interface:** `story-runner.md`

## Versioning

- **Created:** 2026-02-23 (Story 3.1.5)
- **Last updated:** 2026-02-23
