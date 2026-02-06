# /bmad-bmm-auto-epic Validation Findings

**Audit Date:** 2026-02-06
**Files Audited:** 9 spec files + 2 context files (CLAUDE.md, .claude/settings.json)
**Auditor:** Adversarial validation per user request

---

## Critical Issues (workflow would fail or produce wrong results)

### C1. `paused` is not a valid story status -- state machine gap

**Files:** SKILL.md:263, state-file.md:11, story-runner.md:53

SKILL.md Phase 3 says: `set status: done (or paused if user stopped early)`. But `paused` is not in the defined status enum anywhere:

- state-file.md:11 defines: `pending | in-progress | review | done | blocked`
- story-runner.md:53 defines `StoryStatus = "pending" | "in-progress" | "review" | "done" | "blocked"`

If the orchestrator writes `paused` to the state file, `--resume` reconciliation will encounter an unrecognized status with no case to handle it. The 7-case resume matrix (state-file.md:87-95) has no row for `paused`. The workflow would either crash or behave unpredictably on resume.

### C2. `skipped` is not a valid story status -- skip operation has no state representation

**Files:** SKILL.md:223-225, state-file.md:11, story-runner.md:53

SKILL.md Phase 2.6 provides a `skip` option and even handles skip cascading for stories with dependents. But there is no `skipped` status value. When a user chooses "skip", the spec does not say what status to write to the state file. The story would remain in whatever status it had (likely `pending`), meaning `--resume` would attempt to implement it again rather than respecting the skip decision.

### C3. `getStoryStatus` function referenced but never defined

**Files:** dependency-analysis.md:150, all other files

`validateStorySelection` (dependency-analysis.md:150) calls `getStoryStatus(depId)` to check if a dependency is already done. This function is never defined in any of the 9 files. It is not part of the StoryRunner interface, not in state-file.md, and not a utility defined anywhere. The agent would have to invent how to read status from the state file (or from where?) during story selection validation.

### C4. `coverage` variable in `getOrCreatePR` is never computed or passed

**Files:** SKILL.md:174, story-runner.md:126

SKILL.md:174 calls `getOrCreatePR(story, epic, issue, coverage)` but `coverage` is never computed or captured anywhere in the Phase 2 flow before this call. The PR body template (story-runner.md:163) uses `{coverage}%`. The spec says to run `npm test` but never says to capture or parse a coverage number. The agent would have to invent how to extract coverage from test output.

### C5. Dry-run mode still invokes `/bmad-bmm-dev-story` for implementation -- contradicts dry-run purpose

**Files:** SKILL.md:131-145, SKILL.md:196, SKILL.md:325-327

SKILL.md only specifies dry-run skipping for:

- StoryRunner operations (Phase 1.5, via DryRunStoryRunner)
- Subagent spawning in review loop (Phase 2.5, SKILL.md:196)

But Phase 2.2 ("Implementation") has NO dry-run gate. It says "Invoke `/bmad-bmm-dev-story`" with no conditional. In dry-run mode, the workflow would actually write code, create files, run tests, and make real commits to the working directory -- while using mock issue/PR numbers. The `--dry-run` description (SKILL.md:327) says "Simulate without branches/PRs/commits" but the spec doesn't actually skip commits or implementation.

### C6. Integration checkpoint diffs against branch after main-merge -- wrong baseline

**Files:** integration-checkpoint.md:27, SKILL.md:200-209

integration-checkpoint.md:27 runs:

```
git diff --name-only origin/${baseBranch}...${completedBranchName}
```

But Phase 2.6 (SKILL.md:200-209) performs `git fetch origin main` and `git merge origin/main` BEFORE the integration checkpoint at Phase 2.7. After merging main into the feature branch, the merge-base of the triple-dot diff shifts to the tip of main, so the diff would only show the story's own changes (this part is OK). However, there is no guarantee the branch ref `${completedBranchName}` is still checked out at this point -- the spec doesn't explicitly maintain branch context between 2.6 and 2.7. Additionally, if another story's PR was merged into main between push (2.3) and fetch (2.6), the integration checkpoint would miss conflicts introduced by that merge.

---

## Major Issues (workflow could fail under realistic conditions)

### M1. Resume reconciliation case 5 ("in-progress, no PR/branch") references "activity log checkpoints" that are never defined

**Files:** state-file.md:93, state-file.md:53-59

The reconciliation matrix says: `Resume from last successful checkpoint in activity log`. The activity log (state-file.md:53-59) is described only as a human-readable display with timestamped entries. No checkpoints are defined. No format for machine-parseable checkpoint markers exists. The agent cannot determine "last successful checkpoint" from entries like `[14:42] Story 1.1: Tests passed (87% coverage)`.

### M2. `getExportedTypes` and `getExpectedImports` are undefined abstractions

**Files:** integration-checkpoint.md:60-74

The type change detection in integration-checkpoint.md uses `getExportedTypes(completedBranchName)` and `getExpectedImports(depStory)`. Neither function is defined anywhere. There is no spec for how to parse TypeScript exports/imports. `getExpectedImports(depStory)` takes a story object for a story that hasn't been implemented yet -- its files don't exist, so there are no imports to analyze. This entire check would fail for any dependent story that hasn't been implemented.

### M3. `runTests(completedStory.testFiles)` uses undefined `testFiles` property

**Files:** integration-checkpoint.md:82, dependency-analysis.md:18-28

The acceptance criteria validation calls `runTests(completedStory.testFiles)`. The story metadata schema (dependency-analysis.md:10-15) defines `id`, `title`, `depends_on`, `touches`, and `risk`. There is no `testFiles` field. `runTests` is also never defined. The agent would have to invent both what test files belong to a story and how to run them selectively.

### M4. `git merge-base --is-ancestor` check fails when local remote-tracking ref is stale

**Files:** state-file.md:107, SKILL.md:115

The dependency completion policy (state-file.md:107) checks:

```
git merge-base --is-ancestor ${commitSha} origin/${baseBranch}
```

This requires `origin/${baseBranch}` to be up-to-date. After a dependency's PR is merged on GitHub, the commit is on remote main but not in the local `origin/main` until a fetch. The only `git fetch origin main` in the spec is in Phase 2.6 for the _current_ story, not before Phase 2.1 dependency checks. If the human merged a dependency's PR between runs, the ancestor check would fail with a stale local ref even though the code IS on main remotely.

### M5. No handling for story files that don't exist at the expected path

**Files:** SKILL.md:42

SKILL.md:42 says story files are "typically at `_bmad-output/implementation-artifacts/stories/{story_id}.md`". The word "typically" implies the path may vary. There is no fallback search, no error handling for file-not-found, and no way for the epic file to specify a different story file location. If the path convention differs, the workflow silently fails or the agent must guess.

### M6. Fixer subagent commits are local-only -- reviewer may diff against stale remote

**Files:** epic-fixer.md, review-loop.md:136, epic-reviewer.md:28-29

The fixer agent commits locally but never pushes. When the review loop spawns a fresh reviewer, the reviewer runs `git diff origin/{base_branch}...{branch_name}`. The local `{branch_name}` ref includes the fixer's commits (so the diff works for local refs), but `origin/{base_branch}` may be stale. If someone pushed to main between review rounds, the diff baseline would be wrong. More importantly, if the reviewer's bash `git diff` resolves `{branch_name}` as a local ref (not `origin/{branch_name}`), this works. But the spec is ambiguous about whether this is intentional.

### M7. `createBranch` doesn't specify starting point -- story code bleeds across branches

**Files:** story-runner.md:230-232, SKILL.md Phase 2.1

`createBranch` runs `git checkout -b ${branchName}` which creates from current HEAD. After completing Story 1.1, HEAD is on the `story-1-1-*` branch. When Phase 2.1 runs for Story 1.2, `getOrCreateBranch` calls `runner.createBranch(story, branchName)` which runs `git checkout -b story-1-2-... ` -- branching from Story 1.1's branch tip, not from `origin/main`. Story 1.2's branch would include all of Story 1.1's uncommitted/unmerged changes, violating branch isolation.

### M8. Phase 2.6 merge with main happens AFTER status is NOT yet "done" -- but ordering is ambiguous

**Files:** SKILL.md:200-215

Phase 2.6 has three steps: (1) Sync with main, (2) Update PR description, (3) Mark complete. Step 1 merges main, re-runs tests, and pushes. But the SKILL says "re-run tests, push" -- if tests fail after the merge, what happens? The error recovery section covers test failures during implementation (Phase 2.2) but not test failures during the merge-sync in Phase 2.6. The story is not yet "done" but is past the review loop -- there's no path back to the fixer.

---

## Moderate Issues (ambiguities that could cause inconsistent behavior)

### A1. "Skip" option at Phase 2.6 sets no status -- stories with dependents in skip cascade are not tracked

**Files:** SKILL.md:223-225

When the user chooses "skip" with sub-options (a) skip entire sub-tree, (b) go back, (c) remove dependents from scope:

- Option (c) "remove dependents from scope" -- spec doesn't say how to modify the in-memory scope list or whether removed stories get a status update
- Option (a) "skip entire sub-tree" -- no spec for how to mark the sub-tree stories or what status they get
- Since `skipped` is not a valid status (see C2), none of these can be properly persisted

### A2. Phase 2.2 says "Invoke `/bmad-bmm-dev-story`" but doesn't specify invocation mechanics

**Files:** SKILL.md:131

The orchestrator invokes `/bmad-bmm-dev-story` but:

- Is this a Skill tool invocation? Inline execution? The spec doesn't say.
- What arguments are passed to scope it to the current story?
- How does the orchestrator know when `/bmad-bmm-dev-story` is complete?
- The interface contract between orchestrator and dev-story is not specified.

### A3. `updateStatus` for GitHubCLIRunner is in the interface but has no implementation

**Files:** story-runner.md:33, story-runner.md:192-263

The StoryRunner interface defines `updateStatus(story, status)`. state-file.md:77 says `updateStoryStatus` "syncs to secondary sources via `runner.updateStatus()`". But the GitHubCLIRunner implementation section (story-runner.md:192-263) provides implementations for createIssue, createBranch, createPR, findIssueByStoryId, branchExists, ensureBranchCheckedOut, isPRMerged, getDefaultBaseBranch -- but NOT `updateStatus`. What does it do? Update GitHub issue labels? Close issues? Update sprint-status.yaml? Undefined.

### A4. Review loop round boundary: only 2 fix cycles occur before escalation, not 3

**Files:** review-loop.md:88-94, review-loop.md:152

The decision matrix: Round `< 3` with findings -> spawn fixer; Round `== 3` with findings -> escalate. Step D: increment round, loop if `round <= 3`. This means:

- Round 1: review -> findings -> fix -> increment to round 2
- Round 2: review -> findings -> fix -> increment to round 3
- Round 3: review -> findings -> escalate (no fix)

So only 2 fix cycles happen before escalation, despite max rounds being described as 3. The "3 review rounds" framing may mislead users into expecting 3 fix attempts.

### A5. `--resume` doesn't validate that the same `--stories` subset is being resumed

**Files:** SKILL.md:90-96, state-file.md

When resuming, the spec reconciles all stories in the state file. But if the original run used `--stories=1.1,1.2` and the resume is invoked without `--stories` (or with a different set), the workflow would attempt to implement ALL stories, not just the original subset. The state file does not record the original scope/selection.

### A6. Atomic write protocol is not achievable with the agent's Write tool

**Files:** state-file.md:122-126

The protocol says: write to `.tmp` path, then rename. Claude Code agents use the Write tool which writes directly to a path -- there is no atomic "rename" tool. The agent would need to use Bash `mv` to rename. More fundamentally, the Write tool doesn't support writing to one path then atomically moving to another in a single operation.

### A7. Ambiguity: ordering of Phase 2.6 (Finalize) vs Phase 2.7 (Integration Checkpoint)

**Files:** SKILL.md:198-246

Phase 2.6 is "Finalize Story" with a human checkpoint asking "Continue to Story X.Z?". Phase 2.7 is "Integration Checkpoint" which runs for stories with dependents. The ordering is unclear:

- Does 2.7 run before or after the user answers the "Continue?" prompt at 2.6?
- If after: the user approved continuation without seeing integration results
- If before: the numbering (2.6 before 2.7) contradicts this
- Both phases have their own user prompts (2.6: "Continue?", 2.7: "y/n/pause/review-X.Y"), creating potential double-prompting

### A8. The reviewer's preloaded `bmad-bmm-code-review` skill conflicts with its inline review methodology

**Files:** epic-reviewer.md:7-8, epic-reviewer.md:32-72, bmad-bmm-code-review.md

The reviewer declares `skills: [bmad-bmm-code-review]`. That skill instructs loading a BMAD workflow engine (`workflow.xml` + `workflow.yaml`). But the reviewer also has its own complete review methodology inline (diff commands, findings format, rules). The agent prompt says "using the code review methodology from your preloaded skill" (line 32), suggesting the BMAD workflow takes precedence. The BMAD workflow may produce output in a different format than the structured findings document the orchestrator expects to parse. Two competing methodologies in one agent context.

### A9. No spec for what happens when a dependency is `blocked`

**Files:** SKILL.md:113-116

Phase 2.1 says: "For each dependency, verify status is 'done' in state file." If a dependency is `blocked` (not `done`), the spec says "error with actionable message." But what IS the actionable message? Can the user override? Can they unblock the dependency inline? The workflow would simply stop with no recovery path beyond `--resume` after manual intervention.

---

## Minor Issues (improvements, not failures)

### N1. Story file path uses dot notation in filename

**Files:** SKILL.md:42

Path is `stories/{story_id}.md` where story_id is "1.4", creating filenames like `1.4.md`. Valid but unusual.

### N2. PR body template has hardcoded checklist items

**Files:** story-runner.md:165-170

The PR body always includes `- [x] Documentation updated (if needed)` pre-checked, even when no docs were changed.

### N3. DryRunStoryRunner `findIssueByStoryId` always returns null -- prevents idempotency testing

**Files:** story-runner.md:301

Dry-run `findIssueByStoryId()` always returns null, so `getOrCreateIssue` always "creates" a new mock issue. Dry-run + resume would create duplicate mock IDs rather than demonstrating idempotent behavior.

### N4. No template for epic completion report

**Files:** SKILL.md:253-259

Phase 3 lists completion report contents but provides no structured template, unlike the state file and findings document which have explicit formats.

### N5. `slugify` function used in `branchNameFor` is never defined

**Files:** story-runner.md:86

`branchNameFor` calls `slugify(story.title)` but `slugify` is never defined. Edge cases (special characters, consecutive spaces, trailing hyphens) are unspecified.

### N6. Error recovery max-attempts inconsistency

**Files:** SKILL.md:22, SKILL.md:284

Safety Invariant 6 says "max 3 attempts" for auto-recovery. Test failure recovery section says "max 2 attempts" for auto-fix. These should be consistent.

---

## Verified Working

1. **Topological sort with the 4-story scenario (1.1 no deps, 1.2 depends on 1.1, 1.3 depends on 1.1, 1.4 depends on 1.2+1.3):** dependency-analysis.md correctly produces execution order with proper cycle detection, dependent computation, and Kahn's algorithm. The scenario is explicitly used as the example.

2. **Cross-reference: `branchNameFor`** is defined in story-runner.md:85 and correctly referenced in integration-checkpoint.md:22. Consistent naming and usage.

3. **Cross-reference: `getOrCreateIssue`, `getOrCreateBranch`, `getOrCreatePR`** are defined in story-runner.md and referenced correctly in SKILL.md. Function signatures match.

4. **Cross-reference: `updateStoryStatus`** is referenced in SKILL.md:118, 181, 214 and defined conceptually in state-file.md:77. Consistent concept.

5. **Status values consistency** between state-file.md:11 and story-runner.md:53 -- both define exactly `pending | in-progress | review | done | blocked`.

6. **Safety invariant 1 (Never auto-merge PRs):** No file in the spec calls `gh pr merge` or any merge-to-main operation. PRs are only created.

7. **Safety invariant 3 (Never force push):** All push operations use `git push -u origin` (SKILL.md:169) with no `--force` flag.

8. **Safety invariant 4 (Never push to base branch):** All work happens on feature branches. Base branch is only fetched/merged FROM, never pushed TO.

9. **Safety invariant 7 (Idempotent operations):** The getOrCreate pattern correctly checks for existing resources before creating. findIssueByStoryId uses unique tag search (`bmad:story=`) with title fallback.

10. **7-case resume reconciliation matrix** (state-file.md:87-95) covers all listed combinations of state-file-status x GitHub-reality with defined actions.

11. **Dependency validation for `--stories` flag:** dependency-analysis.md:138-163 correctly validates that selected stories have dependencies either in-scope or already done, with three user options for resolution.

12. **Review loop structure:** Correctly cycles reviewer -> decision -> fixer -> reviewer with escalation at the boundary. Findings document format is consistent between review-loop.md and epic-reviewer.md.

13. **Subagent tool restrictions:** epic-reviewer has `disallowedTools: Edit, Task` (read-only). epic-fixer has `disallowedTools: Task` (can edit, can't spawn sub-subagents). Both appropriate.

14. **Hook configuration matches SKILL.md references:** tdd-guard.js, architecture-guard.sh, import-guard.sh, auto-format.sh, type-check.sh, and Stop hook are all present in settings.json.

15. **DryRunStoryRunner** implements all methods from the StoryRunner interface with deterministic mock behavior.

16. **Reviewer can write findings without Edit tool:** The reviewer has `Write` tool which is sufficient for creating new findings documents. `Edit` is only needed for modifying existing files, which the reviewer should never do.
