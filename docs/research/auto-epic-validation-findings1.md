# /bmad-bmm-auto-epic Validation Findings (Deep Validation)

**Audit Date:** 2026-02-06
**Files Audited:** 9 spec files + 2 context files (CLAUDE.md, .claude/settings.json)
**Auditor:** Adversarial deep validation (second-pass audit)
**Prior Audit:** `auto-epic-validation-findings.md` (first-pass, same date)

**Methodology:** Walked the concrete scenario (Epic with stories 1.1, 1.2 deps:[1.1], 1.3 deps:[1.1], 1.4 deps:[1.2,1.3]) end-to-end through all phases. Traced every cross-reference. Verified state machine completeness. Tested safety invariants against spec.

**Note on prior audit:** The first-pass findings document contains several findings (C1, C2, C3, C4, C5, M5, M7, A2, A3, A6, N5) that were already resolved in the current spec files. This second-pass audit starts fresh against the current state of all files.

---

## Critical Issues (workflow would fail or produce wrong results)

### C1. Phase 2.6 "pause" option overwrites "done" status — corrupts completed story

**Files:** SKILL.md:259, SKILL.md:251
**Cross-ref:** state-file.md:113-114 (resume matrix for `paused`)

Phase 2.6 Step 3 first runs `updateStoryStatus(story, "done")` (line 251), then presents the "Continue?" prompt. The `pause` option says: `updateStoryStatus(currentStory, "paused") if in-progress`. But by line 251, the current story is already `done`, not `in-progress`. The "if in-progress" guard means this is a no-op on the current story. However, the semantic intent appears to be pausing the _epic_, not the completed story — but the spec says `updateStoryStatus(currentStory, ...)` not an epic-level status update.

**Impact:** If the intent is to mark the current story as paused (overriding done), this destroys the record of completion. If the intent is epic-level pause only, the "if in-progress" guard makes this a no-op, and the epic-level `paused` status mentioned in Phase 3 (SKILL.md:310) is never set until Phase 3. The user's "pause" choice between stories has no persistent effect beyond whatever Phase 3 later determines.

### C2. `git merge --abort` after a completed merge is a no-op — recovery option is broken

**Files:** SKILL.md:241

Phase 2.6 test failure recovery option (b) says: `Revert merge: git merge --abort, keep story in "review" status, pause for manual resolution`. But `git merge --abort` only works during an in-progress merge (unresolved conflicts). If the merge succeeded and tests then failed, the merge is already committed. `git merge --abort` will error: `fatal: There is no merge to abort`. The correct command would be `git reset --merge ORIG_HEAD` or `git revert -m 1 HEAD`.

**Impact:** Selecting option (b) will fail with a git error. The story will be left in an ambiguous state — merged with main but with failing tests, no revert applied, and no clear recovery path.

### C3. `getStory(depStoryId)` referenced in integration-checkpoint.md is never defined

**Files:** integration-checkpoint.md:31, integration-checkpoint.md:75

The integration checkpoint code calls `getStory(depStoryId)` (line 31) and `getStory(depStoryId)` (line 75) to look up dependent story objects by ID. This function is never defined in any spec file. `getStoryStatus(storyId)` is defined in state-file.md:86, but that returns a status string, not a story object. The agent must invent a lookup mechanism to retrieve story objects by ID from whatever in-memory data structure holds parsed stories.

**Impact:** The integration checkpoint's shared-file and type-change checks both depend on this undefined function. Without it, the agent cannot retrieve dependent story metadata (especially the `touches` field), causing the overlap detection to silently fail or error.

### C4. Dependency completion check at Phase 2.1 is applied to the wrong subject

**Files:** SKILL.md:116

Phase 2.1 says: "For stories WITH dependents (default `--require-merged`): verify code reached base branch via `git merge-base --is-ancestor`". This checks dependencies of the _current_ story, but the condition "WITH dependents" filters on whether the _dependency_ has dependents, not whether the _current story_ has dependents.

The dependency completion policy in state-file.md:122-138 says: "Stories WITH dependents" need merged verification; "Leaf stories (NO dependents)" have relaxed checking. This policy defines completion _requirements for the dependency_, not for the current story. So at Phase 2.1 when checking dependency D for current story S, the question should be: "Does D have dependents?" (yes → must be merged) or "Is D a leaf?" (yes → relaxed). SKILL.md:116 ambiguously says "For stories WITH dependents" without clarifying whether "stories" refers to the current story being checked or its dependencies.

**Impact:** If misinterpreted, leaf stories that are dependencies of other stories would bypass the merge-base check, allowing dependent stories to start when their dependency code is not yet on main. This defeats the isolation guarantee.

---

## Major Issues (workflow could fail under realistic conditions)

### M1. Phase 2.3 commits before review — code review loop reviews already-committed code

**Files:** SKILL.md:182-208, review-loop.md

The Phase 2 workflow is: 2.2 Implementation → 2.3 Commit & PR → 2.4 Mark for Review → 2.5 Code Review Loop → 2.6 Finalize. This means:

- Code is committed (2.3) and pushed (2.3) BEFORE the review loop (2.5)
- The fixer (2.5) makes additional commits on top
- The reviewer diffs `origin/{base}...{branch}` which includes both the original implementation commits AND fixer commits

This means the first review round reviews code that is already committed and pushed to origin. If the reviewer finds Critical issues, the fixer commits _more_ code on top rather than amending. The PR will contain the original flawed commit plus fix commits, rather than clean history. While this is not a functional failure, it means every PR will contain a trail of review-fix commits visible to the human reviewer.

More critically, the push at Phase 2.3 happens BEFORE review. If the review finds severe issues (security vulnerabilities, data loss bugs), that code is already pushed to the remote branch. The spec never addresses retracting pushed-but-unreviewed code.

### M2. Review loop says push happens in "Phase 2.3/2.6" but 2.3 already pushed

**Files:** review-loop.md:159, SKILL.md:196-197

review-loop.md:159 says: "No push is needed until the review loop exits cleanly (push happens in Phase 2.3/2.6)." But Phase 2.3 (SKILL.md:196) runs BEFORE the review loop (Phase 2.5). The push already happened. The fixer's local commits are NOT pushed during the review loop (review-loop.md says fixer "commits locally but does NOT push"). After the review loop completes, Phase 2.6 Step 1 does `git fetch origin main` and `git merge origin/main`, then pushes again. But the initial 2.3 push already occurred.

**Impact:** The fixer's commits exist only locally until Phase 2.6 pushes again. If the workflow is interrupted between the review loop completing and Phase 2.6 pushing, the remote branch has the original (potentially flawed) code but not the fixes. On `--resume`, the remote branch would be out of sync with local.

### M3. No `git add` before commit in Phase 2.3 — commit may be empty

**Files:** SKILL.md:187

Phase 2.3 runs `git commit -m "feat: implement story..."` but never runs `git add`. The `/bmad-bmm-dev-story` skill (Phase 2.2) creates/modifies files using agent tools (Write, Edit), but those tools don't automatically stage files in git. The commit would fail with "nothing to commit" unless the dev-story skill or the agent explicitly stages changes.

**Impact:** The commit fails with "nothing to commit, working tree clean" (false — changes exist but aren't staged). The workflow would hit the PR creation failure path, marking the story as `blocked`.

### M4. Integration checkpoint `actualChangedFiles` variable used but scoped to wrong code block

**Files:** integration-checkpoint.md:26-52, integration-checkpoint.md:78

The shared file changes check (section 1) computes `actualChangedFiles` from `git diff --name-only`. The type changes check (section 2, line 78) references `actualChangedFiles` inside its own code block, but `actualChangedFiles` was defined in the section 1 code block. Since these are pseudo-code blocks (not a single script), the variable scope is ambiguous. An agent treating each code block independently would need to re-run the diff or retain the variable across blocks.

**Impact:** If the agent treats each code block as independent, the type change check would fail because `actualChangedFiles` is undefined. Alternatively, if the agent runs the diff again, it would duplicate work but function correctly. Ambiguity, not guaranteed failure.

### M5. `git fetch origin main` in Phase 2.6 hardcodes "main" — should use `${baseBranch}`

**Files:** SKILL.md:230

Phase 2.6 runs `git fetch origin main` but the base branch is determined dynamically by `runner.getDefaultBaseBranch()` (which could return "master" or another branch). Phase 2.1 correctly uses `${baseBranch}`, but Phase 2.6 hardcodes "main". If the repo's default branch is "master", this fetch would either fail or fetch the wrong ref.

**Impact:** On repos with a non-"main" default branch, the merge with `origin/main` would fail or merge from a stale/nonexistent ref.

### M6. `--resume` does not reconcile `blocked` status — blocked stories have no resume path

**Files:** state-file.md:104-116

The 11-row reconciliation matrix covers `done`, `in-progress`, `pending`, `paused`, and `skipped` statuses. There is no row for `blocked` status. When a story is `blocked` (e.g., from test failure, PR creation failure, or dependency not met), and the user resumes with `--resume`, the reconciliation has no defined action.

**Impact:** The agent must invent behavior for blocked stories on resume. Reasonable guesses include "skip" or "re-prompt user," but the spec gives no guidance. Different agent interpretations would produce inconsistent behavior.

### M7. Review loop round 3 escalation option (c) creates unbounded loop potential

**Files:** review-loop.md:113-120

When review round 3 still has findings, option (c) says: "Continue with 1 more review round (override limit)." This increments max rounds by 1, looping back to Step A. If the user keeps choosing (c), the review loop runs indefinitely. There is no hard upper bound.

**Impact:** In practice, a user would eventually stop choosing (c). But the spec provides no maximum override count or warning after repeated overrides. A careless user (or an automated wrapper) could loop forever.

---

## Moderate Issues (ambiguities that could cause inconsistent behavior)

### A1. Phase 2.6 marks "done" BEFORE sync-with-main succeeds — status may be wrong

**Files:** SKILL.md:225-253

The Phase 2.6 structure is: Step 1 (sync with main) → Step 2 (update PR) → Step 3 (mark done + prompt). Step 3 calls `updateStoryStatus(story, "done")`. But Step 1 can fail (merge conflicts, test failures after merge). The error recovery options in Step 1 include marking as `blocked` or reverting. The problem is that the spec lists Steps 1-3 sequentially, implying "done" is only set after sync succeeds. However, the error recovery paths in Step 1 don't explicitly prevent Step 3 from executing. The agent must infer that Step 1 failure means Steps 2-3 are skipped.

**Impact:** An agent that follows the numbered steps without reading the error recovery carefully could mark a story "done" even when the merge failed.

### A2. Phase 2.7 integration checkpoint runs "BEFORE the user Continue? prompt" but Phase 2.6 Step 3 already includes the prompt

**Files:** SKILL.md:272, SKILL.md:255

SKILL.md:272 says integration checkpoint "Runs AFTER Phase 2.6 sync-with-main and BEFORE the user 'Continue?' prompt. (The 2.6 human checkpoint prompt is deferred until after integration checkpoint results are available.)" But Phase 2.6 Step 3 explicitly says: "Ask: Continue to Story X.Z? (y/n/pause/skip)". The spec asks the agent to defer the Phase 2.6 prompt to after 2.7, but the Phase 2.6 section reads as if the prompt happens inline.

The integration checkpoint (SKILL.md:289-293) also has its own user options: "y / n / pause / review-X.Y". Phase 2.6 has options: "y/n/pause/skip". These are different option sets (2.7 adds `review-X.Y`, 2.6 adds `skip`). The spec says to fold them together ("show results alongside the Continue? prompt") but the merged option set is never defined.

**Impact:** The agent could: (a) prompt twice (once at 2.6, once at 2.7), (b) prompt once with 2.6's options missing `review-X.Y`, or (c) prompt once with a merged set. Inconsistent UX between stories with and without dependents.

### A3. Reviewer subagent prompt doesn't provide all context listed in epic-reviewer.md "Context You Will Receive"

**Files:** review-loop.md:20-33, epic-reviewer.md:13-19

epic-reviewer.md "Context You Will Receive" lists: Story ID and title, Branch name, Base branch, Round number, Output path.

review-loop.md Task prompt provides: Story ID and title (`{story.id}: {story.title}`), Branch name (`{branchName}`), Base branch (`{baseBranch}`), Round (`{round}`), Output path (`docs/progress/story-{story.id}-review-findings-round-{round}.md`).

This actually matches. However, the prompt does NOT provide:

- The story file path (so the reviewer can check acceptance criteria)
- The epic context (other stories, dependencies)
- The diff commands to use (the reviewer has them inline, but the prompt doesn't specify the diff format)

The reviewer has inline instructions for how to diff, so it should work. But if the reviewer's preloaded `bmad-bmm-code-review` skill conflicts with these inline instructions (see A4), the reviewer may use wrong methodology.

### A4. Reviewer's `bmad-bmm-code-review` skill uses BMAD workflow engine — conflicts with inline review format

**Files:** epic-reviewer.md:7-8, .claude/commands/bmad-bmm-code-review.md

epic-reviewer.md declares `skills: [bmad-bmm-code-review]`. The `bmad-bmm-code-review.md` command (line 9-14) instructs loading `workflow.xml` + `workflow.yaml` from `_bmad/core/tasks/` and `_bmad/bmm/workflows/4-implementation/code-review/`. This BMAD workflow engine likely produces output in its own format.

Meanwhile, epic-reviewer.md:32-33 says: "Use the structured findings format defined below (not the skill's own output format) since the orchestrator parses findings by the Critical/Important/Minor structure."

The reviewer explicitly overrides the skill's output format. But the skill's `workflow.yaml` may have its own steps, prompts, and methodology that conflict with the reviewer's inline instructions. Whether `skills:` in an agent definition means "preloaded as background knowledge" or "loaded and executed as a workflow" is undefined in the spec. If the skill is executed as a workflow, it would take over the agent's flow.

**Impact:** If the BMAD workflow engine activates and produces findings in a different format, the orchestrator's parsing of Critical/Important/Minor counts would fail, causing the review loop to make wrong decisions.

### A5. `--resume` doesn't record or validate original `--stories` scope

**Files:** SKILL.md:90-96, state-file.md

When a run is started with `--stories=1.1,1.2`, only those stories are initialized in the state file. On `--resume` without `--stories`, Phase 1.6 loads the state file and reconciles. Phase 1.1-1.3 also loads ALL stories from the epic file and builds a dependency graph for ALL stories. The `--resume` logic (SKILL.md:96) says "Enter Phase 2 starting from first non-done story" — but does it iterate all epic stories or only those in the state file?

If the state file only has 1.1 and 1.2, but the epic has 1.1-1.4, does resume attempt 1.3 and 1.4 (which aren't in the state file and would be initialized as `pending`)? Or does it only process stories found in the state file?

**Impact:** Resume could unexpectedly expand scope beyond the original run's intent, implementing stories the user didn't select.

### A6. No `git add` specification for the fixer subagent's commits

**Files:** epic-fixer.md:33-35

The fixer is told to "Commit fixes with message: `fix: address code review round {round} - [brief description]`". But the fixer edits files using the Edit tool, which doesn't stage changes. The fixer has the Bash tool available so it could run `git add`, but the spec never mentions staging. Same issue as M3 but for the fixer context.

**Impact:** Fixer commits could be empty if the fixer doesn't independently know to stage files.

### A7. `slugify` edge case — story titles with leading/trailing special characters produce empty or odd branch names

**Files:** story-runner.md:92-101

`slugify` replaces non-alphanumeric with hyphens and trims leading/trailing hyphens. For a story titled "(TBD)" or "---", the result would be "tbd" or "" (empty string). `branchNameFor` would produce `story-1-1-` or `story-1-1-tbd` — the former has a trailing hyphen (trimmed by slugify, but the `story-${id}-` prefix ends with a hyphen that isn't trimmed). Actually, looking more carefully, the prefix is `story-${story.id.replace(".", "-")}-${slugify(story.title)}`. If `slugify("")` returns `""`, the branch name becomes `story-1-1-` which is valid but unusual.

**Impact:** Cosmetic. Git allows trailing hyphens in branch names. Not a functional failure, but could confuse tooling.

### A8. Fixer subagent has no access to the story file or acceptance criteria

**Files:** epic-fixer.md:17-18, review-loop.md:128-140

The fixer prompt provides: Story ID, title, branch name, findings path, round number. It does NOT provide the story file path or any acceptance criteria. The fixer must address findings from the review, but without knowing the story's AC, it can't validate that fixes maintain compliance with the story requirements.

**Impact:** The fixer could fix review findings in a way that breaks acceptance criteria, which would only be caught in the next review round (or not at all if the reviewer doesn't check AC either — the reviewer also doesn't receive the story file).

### A9. Phase 2.2 captures coverage with `npm test -- --coverage` but final quality gate already ran `npm test`

**Files:** SKILL.md:162-180

Phase 2.2 runs the final quality gate: `npm run lint`, `npm run build`, `npm test` (line 162-166). Then it says to capture coverage by running `npm test -- --coverage` (line 172). This runs the test suite twice — once without coverage flags and once with. If the project's test config already outputs coverage by default, the first run's output is discarded. If coverage requires the `--coverage` flag, only the second run produces it.

**Impact:** Tests run twice unnecessarily. Not a failure, but wastes time. If the project has long-running tests, this doubles the test execution time at the end of every story.

---

## Minor Issues (improvements, not failures)

### N1. PR body checklist has hardcoded `[x]` for documentation

**Files:** story-runner.md:183

The PR body always includes `- [x] Documentation updated (if needed)` pre-checked, even when no documentation was changed. Human reviewers may rely on this checklist.

### N2. DryRunStoryRunner `findIssueByStoryId` always returns null — breaks idempotency simulation

**Files:** story-runner.md:329-331

`findIssueByStoryId()` returns null, so `getOrCreateIssue` always "creates" a new mock issue. On dry-run + resume, duplicate mock IDs would be generated rather than demonstrating the idempotent getOrCreate pattern.

### N3. Error recovery max-attempts inconsistency across spec

**Files:** SKILL.md:22, SKILL.md:325, SKILL.md:240

Safety Invariant 6 (SKILL.md:22) says "max 2 attempts" for auto-recovery. Test failure recovery (SKILL.md:325) says "max 2 attempts." Phase 2.6 merge test failure recovery (SKILL.md:240) says "max 2 attempts." These are consistent with each other, but Safety Invariant 6 uses the word "auto-recovery" while the recovery sections use "auto-fix." The term difference is minor but could cause confusion about whether these refer to the same retry policy.

### N4. No template for epic completion report

**Files:** SKILL.md:300-306

Phase 3 lists what the completion report should contain but provides no structured template, unlike the state file and findings document which have explicit markdown formats.

### N5. `bmad-bmm-code-review` skill references BMAD core files that may not exist

**Files:** .claude/commands/bmad-bmm-code-review.md:9-12

The skill loads `_bmad/core/tasks/workflow.xml` and `_bmad/bmm/workflows/4-implementation/code-review/workflow.yaml`. Whether these files exist in the project was not verified (they're in `_bmad/`, not `_bmad-output/`). If they don't exist, the skill would fail when the reviewer tries to use it.

### N6. Phase 2.6 "skip" operates on the NEXT story, not the current one

**Files:** SKILL.md:260-266

The "Continue?" prompt is shown after the CURRENT story is marked "done." The "skip" option says "Skip next story" with `updateStoryStatus(nextStory, "skipped")`. This is logically sound (you're choosing to skip what comes next), but the UX could confuse users who think "skip" means skip the current story (which is already done).

### N7. `gh issue edit --remove-label` uses comma-separated list — may not be valid gh syntax

**Files:** story-runner.md:283

The `updateStatus` implementation runs: `gh issue edit ${issueNumber} --add-label "status:${status}" --remove-label "status:pending,status:in-progress,..."`. The `gh issue edit --remove-label` flag expects a single label per flag invocation in some versions of `gh`. Passing a comma-separated string may add a single label with commas in the name rather than removing multiple labels.

**Impact:** Status labels may accumulate rather than being replaced, showing contradictory statuses on GitHub issues.

---

## Verified Working

1. **Status values consistency:** state-file.md:11 defines 7 statuses (`pending | in-progress | review | done | blocked | paused | skipped`). story-runner.md:53-60 defines the identical `StoryStatus` union type. All status values referenced in SKILL.md match this set.

2. **Resume reconciliation matrix completeness for defined rows:** The 11-row matrix in state-file.md:104-116 covers `done` (2 rows), `in-progress` (3 rows), `pending` (2 rows), `paused` (3 rows), and `skipped` (1 row). Each row has a defined action. Within these rows, actions are reasonable and complete.

3. **`getStoryStatus` is defined:** state-file.md:81-91 defines `getStoryStatus(storyId)` with clear semantics. dependency-analysis.md:150 references it correctly for checking if out-of-scope dependencies are already done.

4. **`branchNameFor` is defined and consistently referenced:** story-runner.md:99-101 defines it. integration-checkpoint.md:22 references it correctly. Naming convention is deterministic.

5. **`slugify` is defined:** story-runner.md:92-97 defines the function with clear regex transformations.

6. **`getOrCreateIssue/Branch/PR` idempotency pattern:** story-runner.md:109-161 implements the full getOrCreate pattern with find-first semantics. Function signatures match SKILL.md references.

7. **`updateStoryStatus` semantics:** state-file.md:79 defines it as updating primary (state file) and syncing to secondary (via `runner.updateStatus()`). SKILL.md references it consistently at all status transitions.

8. **`updateStatus` for GitHubCLIRunner IS defined:** story-runner.md:277-286 provides the implementation using `gh issue edit` with label management.

9. **Safety Invariant 1 (Never auto-merge):** No file calls `gh pr merge` or any merge-to-main operation. PRs are only created via `gh pr create`.

10. **Safety Invariant 3 (Never force push):** All push operations use `git push -u origin` (SKILL.md:196) with no `--force` flag.

11. **Safety Invariant 4 (Never push to base branch):** All work on feature branches. Base branch only fetched/merged FROM.

12. **Safety Invariant 7 (Idempotent operations):** getOrCreate pattern with `findIssueByStoryId` (unique tag search `bmad:story=`) and `findPRByBranch` correctly implement find-first-or-create.

13. **Dry-run gate at Phase 2.2:** SKILL.md:142 explicitly gates implementation with: "If `--dry-run` mode is active, skip the entire implementation phase." This addresses the concern about dry-run executing real code.

14. **Dry-run gate at Phase 2.5:** SKILL.md:223 says "In `--dry-run` mode: Skip subagent spawning, log dry-run messages, proceed directly to 2.6."

15. **`createBranch` branches from correct starting point:** story-runner.md:245-249 explicitly creates from `origin/${baseBranch}` with a note explaining why this prevents code bleed between stories.

16. **Phase 2.1 fetches before dependency check:** SKILL.md:114 runs `git fetch origin ${baseBranch}` before the `merge-base --is-ancestor` check, ensuring the local remote-tracking ref is current.

17. **Skill invocation for dev-story is specified:** SKILL.md:144 says: `Skill(skill: "bmad-bmm-dev-story", args: "${storyFilePath}")` with explanation that it runs inline (not as subagent).

18. **Reviewer can write findings without Edit tool:** The reviewer has `Write` tool (epic-reviewer.md:4) which creates new files. The findings doc is always a new file (new path per round). `Edit` (disallowed) is only needed for modifying existing files.

19. **Fixer has all needed tools:** epic-fixer.md:5 lists `Read, Glob, Grep, Bash, Write, Edit`. This covers file reading, searching, editing, running tests, and committing. `Task` is disallowed (correct — prevents sub-subagent spawning).

20. **Hook configuration matches SKILL.md references:** tdd-guard.js, architecture-guard.sh, import-guard.sh, auto-format.sh, type-check.sh, and Stop hook are all present in settings.json with appropriate matchers.

21. **Dependency analysis correctly handles the 4-story scenario:** dependency-analysis.md:64-68 shows the adjacency list matching the audit scenario. Topological sort (Kahn's algorithm, line 119-131) produces valid execution order. Cycle detection (line 104-116) is specified as fatal.

22. **Story selection validation works end-to-end:** dependency-analysis.md:138-181 validates selected stories, checks deps are in-scope or done, presents three user options (add missing / proceed / cancel). Option (a) recurses until clean.

23. **Review loop branch locality is correctly specified:** review-loop.md:159 explains that the triple-dot diff `origin/{base_branch}...{branch_name}` resolves `{branch_name}` as a local ref, making fixer commits visible to subsequent reviewers without pushing.

24. **State file write protocol is specified:** state-file.md:142-149 defines write-to-tmp then rename pattern with recovery note for the `.tmp` file on crash.
