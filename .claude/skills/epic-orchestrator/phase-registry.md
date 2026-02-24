# Phase Registry

Single source of truth for Phase 2 (Story Implementation Loop) step order, execution semantics, and gate criteria. Referenced by the orchestrator's SKILL.md and executed via the phase-runner.md protocol.

## Phase 2 Steps

| Step | Name                                | Purpose                                                       | What Runs                                                                                         | Skip Condition                                                         | Gate Criteria                                            |
| ---- | ----------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | -------------------------------------------------------- |
| 2.1  | Pre-Implementation                  | Check deps, create issue/branch, set status to in-progress    | StoryRunner: `getOrCreateIssue`, `getOrCreateBranch`                                              | —                                                                      | All deps "done" in state file; resources created         |
| 2.2  | Implementation (Protected by Hooks) | Write tests, implement code, run quality gates                | Invoke `/bmad-bmm-dev-story`; then `npm run lint`, `npm run type-check`, `npm test -- --coverage` | `--dry-run`: skip entirely, log only                                   | All tests pass; lint clean; type-check clean             |
| 2.3  | Mark for Review                     | Update story status to "review" in state file                 | `updateStoryStatus(story, "review")`                                                              | `--dry-run`: skip entirely (status stays `in-progress`)                | Status updated                                           |
| 2.3b | Dedup Scan Loop                     | Detect cross-handler duplication before adversarial review    | Spawn `epic-dedup-scanner` per `dedup-scan-loop.md`; spawn `epic-dedup-fixer` if findings present | `story.touches` has no paths under `backend/functions/` OR `--dry-run` | 0 MUST-FIX findings (Critical + Important); max 2 rounds |
| 2.4  | Code Review Loop                    | Adversarial review of branch changes                          | Spawn `epic-reviewer` per `review-loop.md`; spawn `epic-fixer` if findings present                | `--dry-run`: skip subagent spawning, log only                          | 0 MUST-FIX findings (Critical + Important); max 3 rounds |
| 2.5  | Commit & PR                         | Push branch, create PR, verify CI                             | `git push`, StoryRunner: `getOrCreatePR`, `gh pr checks --watch`                                  | —                                                                      | CI green; PR created                                     |
| 2.6  | Finalize Story [HUMAN CHECKPOINT]   | Sync with main, update status to "done", human checkpoint     | `git merge origin/${baseBranch}`, `npm test`, `updateStoryStatus(story, "done")`                  | —                                                                      | Merge clean; tests pass; user approves                   |
| 2.7  | Integration Checkpoint              | Validate dependent stories still valid after upstream changes | File overlap check, type change detection, test re-run per `integration-checkpoint.md`            | `story.hasDependents === false` (no dependent stories)                 | Green/Yellow → continue; Red → escalate                  |

## Step Details

### 2.1 Pre-Implementation

- **Dependency check:** For each dependency, verify "done" in state file. For dependencies with dependents, verify code reached base branch via `git merge-base --is-ancestor`.
- **Resource creation:** Idempotent via StoryRunner — `getOrCreateIssue(story, epic)`, `getOrCreateBranch(story)`.
- **State update:** `updateStoryStatus(story, "in-progress")`, record `startedAt` timestamp.
- **Failure escalation:** If dependency not met, prompt user (skip / pause / override).

### 2.2 Implementation

Sub-steps executed within this phase (not individually registered — phase-level resume only):

1. **Invoke dev-story skill:** `Skill(skill: "bmad-bmm-dev-story", args: "${storyFilePath}")`
2. **Quality gate:** `npm run lint`, `npm run type-check`, `npm test -- --coverage`
3. **AC verification:** Write `.claude/temp/ac-verification.json`, run `node .claude/hooks/ac-verify-validator.cjs`
4. **Secrets scan:** Check changed files for AWS keys, account IDs, private key material
5. **Commit verification:** Run `node .claude/hooks/commit-gate.cjs`
6. **CDK synth gate (conditional):** Run `node .claude/hooks/cdk-synth-gate.cjs` if infra files changed

### 2.3 Mark for Review

- **State update:** `updateStoryStatus(story, "review")`
- Lightweight step; exists as a discrete phase so the state file reflects the transition.

### 2.3b Dedup Scan Loop

- **Protocol:** See `dedup-scan-loop.md` for the full 2-round protocol.
- **Scanner:** `epic-dedup-scanner` subagent (fresh context, reads ALL domain handlers).
- **Fixer:** `epic-dedup-fixer` subagent (implementation context, extracts to shared packages).
- **Gate:** 0 Critical + Important findings to exit. Max 2 rounds, then escalate.
- **Findings path:** `.claude/dedup-findings-{story.id}-round-{round}.md`

### 2.4 Code Review Loop

- **Protocol:** See `review-loop.md` for the full 3-round protocol.
- **Reviewer:** `epic-reviewer` subagent (fresh context, diffs branch vs base).
- **Fixer:** `epic-fixer` subagent (implementation context, fixes findings).
- **Gate:** 0 Critical + Important findings to exit. Max 3 rounds, then escalate.
- **Findings path:** `docs/progress/story-{story.id}-review-findings-round-{round}.md`

### 2.5 Commit & PR

- **Pre-stage validation:** Check for `.env`, `.pem`, `.key` files.
- **Commit:** `git add -A && git commit` with issue reference.
- **Push:** `git push -u origin ${branchName}` (standard push, never force).
- **PR creation:** Idempotent via StoryRunner — `getOrCreatePR(story, epic, issue, coverage)`.
- **Temp cleanup:** `node .claude/hooks/temp-cleanup.cjs`
- **CI verification:** `gh pr checks ${pr.number} --watch` — must be green before proceeding.

### 2.6 Finalize Story [HUMAN CHECKPOINT]

- **Sync:** `git fetch origin ${baseBranch} && git merge origin/${baseBranch}` — merge, never rebase.
- **Test:** Re-run tests after merge.
- **State update:** `updateStoryStatus(story, "done")`, record `completedAt`, compute `duration`.
- **Completion report:** Upsert story row in `docs/progress/epic-{id}-completion-report.md`.
- **User prompt:** "Continue to Story X.Z? (y/n/pause/skip)" — deferred until after 2.7 if story has dependents.

### 2.7 Integration Checkpoint

- **Protocol:** See `integration-checkpoint.md` for validation details.
- **Checks:** Shared file changes, interface/type changes, test re-run.
- **Result classification:** Green (all clear), Yellow (warnings), Red (failures → escalate).
- **User options:** y / n / pause / review-X.Y.

## Sync Contract

Step IDs and names in this registry MUST match the Phase 2 headings in SKILL.md. If either document adds, removes, or reorders a step, update both to maintain consistency.

## Versioning

- **Created:** 2026-02-23 (Story 3.1.5)
- **Last updated:** 2026-02-23
