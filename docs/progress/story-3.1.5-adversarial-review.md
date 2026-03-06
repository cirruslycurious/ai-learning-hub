# Story 3.1.5 Code Review Findings - Round 1

**Reviewer:** Agent (Fresh Context)
**Date:** 2026-02-23
**Branch:** story-3-1-5-phase-runner-infrastructure

## Critical Issues (Must Fix)

1. **[Uncommitted Work]:** Story 3.1.5 deliverables are NOT committed to the branch
   - **File:** All new/modified files: `.claude/skills/epic-orchestrator/phase-registry.md` (new, untracked), `.claude/skills/epic-orchestrator/phase-runner.md` (new, untracked), `.claude/skills/epic-orchestrator/SKILL.md` (modified, unstaged), `.claude/agents/README.md` (modified, unstaged)
   - **Problem:** The branch `story-3-1-5-phase-runner-infrastructure` contains only one commit beyond `main`: `f5c5edf feat: add dedup scan agent & pipeline integration (Story 3.1.4) #199 (#200)`, which is the merged Story 3.1.4 work already present on `main`. The actual Story 3.1.5 deliverables exist only as unstaged modifications and untracked files in the working tree. Running `git diff main...story-3-1-5-phase-runner-infrastructure --stat` shows only Story 3.1.4 files, not Story 3.1.5 files. Running `git show story-3-1-5-phase-runner-infrastructure:.claude/skills/epic-orchestrator/phase-registry.md` returns a fatal error confirming the file does not exist in the branch commit tree.
   - **Impact:** The story cannot be reviewed via branch diff, cannot be PR'd, and the work would be lost if the working tree were cleaned or the branch were checked out fresh. Any CI checks on this branch see zero story-related changes. This is a blocking issue for the entire PR workflow.
   - **Fix:** Stage and commit all Story 3.1.5 files to the branch:
     ```bash
     git add .claude/skills/epic-orchestrator/phase-registry.md \
             .claude/skills/epic-orchestrator/phase-runner.md \
             .claude/skills/epic-orchestrator/SKILL.md \
             .claude/agents/README.md
     git commit -m "feat: add phase runner infrastructure (Story 3.1.5)"
     ```

2. **[Branch Contains Unrelated Work]:** Branch diff against main includes Story 3.1.4 files already merged to main
   - **File:** `.claude/agents/epic-dedup-fixer.md`, `.claude/agents/epic-dedup-scanner.md`, `.claude/skills/epic-orchestrator/dedup-scan-loop.md`, plus README.md and SKILL.md changes from 3.1.4
   - **Problem:** The branch's sole commit (`f5c5edf`) is a squashed copy of Story 3.1.4 that was already merged to `main` as commit `f5c5edf`. Running `git diff main...story-3-1-5-phase-runner-infrastructure --stat` shows 5 files changed (440 insertions) -- all from Story 3.1.4. When the Story 3.1.5 work is committed, the PR will show Story 3.1.4 files mixed in alongside Story 3.1.5 files.
   - **Impact:** Violates the project's "one issue = one PR" rule (CLAUDE.md). The PR would contain changes from two stories. Reviewers would see dedup-scanner/fixer agent files that are unrelated to phase runner infrastructure.
   - **Fix:** Rebase or recreate the branch from current `main` (which already includes the 3.1.4 merge), then commit only the 3.1.5 files. For example:
     ```bash
     git rebase main
     ```
     After rebase, the 3.1.4 commit should be elided since it is already in main, leaving a clean branch for 3.1.5 work only.

## Important Issues (Should Fix)

1. **[Name Mismatch: Step 2.2]:** Registry step name does not match SKILL.md heading
   - **File:** `/Users/stephen/Documents/ai-learning-hub/.claude/skills/epic-orchestrator/phase-registry.md` line 10, `/Users/stephen/Documents/ai-learning-hub/.claude/skills/epic-orchestrator/SKILL.md` line 207
   - **Problem:** Phase-registry.md lists step 2.2 as "Implementation". SKILL.md heading reads `### 2.2 Implementation (Protected by Hooks)`. The registry's own Sync Contract (line 85) states: "Step IDs and names in this registry MUST match the Phase 2 headings in SKILL.md." The parenthetical "(Protected by Hooks)" is part of the SKILL.md heading but absent from the registry.
   - **Impact:** Violates AC4 ("Phase order and step identities in SKILL.md match phase-registry.md; no conflicting numbering or steps") and the registry's own sync contract. Any future automated drift-detection tool would flag this.
   - **Fix:** Either add "(Protected by Hooks)" to the registry Name column for step 2.2, or define a convention that parenthetical qualifiers in SKILL.md headings are display-only and not part of the canonical step name (and document this convention in the Sync Contract section).

2. **[Name Mismatch: Step 2.6]:** Registry step name does not match SKILL.md heading
   - **File:** `/Users/stephen/Documents/ai-learning-hub/.claude/skills/epic-orchestrator/phase-registry.md` line 15, `/Users/stephen/Documents/ai-learning-hub/.claude/skills/epic-orchestrator/SKILL.md` line 443
   - **Problem:** Phase-registry.md lists step 2.6 as "Finalize Story". SKILL.md heading reads `### 2.6 Finalize Story [HUMAN CHECKPOINT]`. The `[HUMAN CHECKPOINT]` marker is semantically meaningful -- it signals this step requires user interaction -- and is part of the heading.
   - **Impact:** Same AC4/sync contract violation as above. Additionally, the human checkpoint nature of this step is important metadata that the registry omits. An implementer reading only the registry would not know this step has a mandatory user interaction.
   - **Fix:** Add `[HUMAN CHECKPOINT]` to the registry Name column, or add a separate column/flag to the registry table indicating which steps are human checkpoints (which would also benefit step 2.1 in some dependency-failure scenarios).

3. **[Internal Contradiction: Dry-Run Skip Logic]:** phase-runner.md Skip Condition table contradicts Dry-Run Mode table
   - **File:** `/Users/stephen/Documents/ai-learning-hub/.claude/skills/epic-orchestrator/phase-runner.md` lines 30-33 (Skip Condition table) vs lines 71-80 (Dry-Run Mode table)
   - **Problem:** In the Skip Condition Evaluation table, step 2.2 says on dry-run: "skip to 2.5". This implies steps 2.3, 2.3b, and 2.4 are never reached. However, the Dry-Run Mode table on lines 73-77 documents specific dry-run behavior for steps 2.3 (log message), 2.3b (skipped with log), and 2.4 (skipped with log), which implies these steps ARE visited and individually evaluated. If the runner jumps from 2.2 directly to 2.5, the 2.3/2.3b/2.4 dry-run behaviors are dead documentation. The story's own Task 2.4 description says "skip 2.2, 2.3, 2.3b, and 2.4; proceed directly to 2.5" which implies each step is individually skipped (visited but not executed), aligning with the Dry-Run Mode table, NOT with the "skip to 2.5" jump.
   - **Impact:** An implementer following the Skip Condition Evaluation table would jump from 2.2 to 2.5 and never emit the 2.3 dry-run log. An implementer following the Dry-Run Mode table would visit each step and log individually. The two authoritative tables in the same document give contradictory instructions.
   - **Fix:** In the Skip Condition Evaluation table, change step 2.2's evaluation from "skip to 2.5" to "skip step, advance to next" (same pattern as other steps). Each subsequent step (2.3, 2.3b, 2.4) then evaluates its own dry-run skip condition per the Dry-Run Mode table. This makes the two tables consistent.

4. **[Missing Dry-Run Skip in Registry: Step 2.3b]:** Phase-registry.md omits `--dry-run` as a skip condition for 2.3b
   - **File:** `/Users/stephen/Documents/ai-learning-hub/.claude/skills/epic-orchestrator/phase-registry.md` line 12
   - **Problem:** The registry lists the skip condition for 2.3b as only: "`story.touches` has no paths under `backend/functions/`". It does not mention `--dry-run`. However, SKILL.md (line 360) explicitly says: "In `--dry-run` mode: Skip subagent spawning, log dry-run messages, proceed directly to 2.4." The phase-runner.md Dry-Run Mode table (line 76) says 2.3b is "Skipped" in dry-run. And `dedup-scan-loop.md` (line 160) documents dry-run skip behavior. The registry -- which claims to be the single source of truth for skip conditions -- is incomplete for this step.
   - **Impact:** An implementer reading only the registry (as designed) would not skip 2.3b in dry-run mode when the story touches handler files. This is a functional gap, not just a documentation style issue.
   - **Fix:** Add `--dry-run` as an additional skip condition for step 2.3b. The skip condition should read: "`story.touches` has no paths under `backend/functions/` OR `--dry-run`". This matches the pattern used by steps 2.2, 2.3, and 2.4.

5. **[Missing Dry-Run Skip in Registry: Step 2.3]:** Phase-registry.md omits `--dry-run` as a skip condition for 2.3
   - **File:** `/Users/stephen/Documents/ai-learning-hub/.claude/skills/epic-orchestrator/phase-registry.md` line 11
   - **Problem:** Similar to the 2.3b issue: the registry lists the skip condition for 2.3 as `--dry-run: log [DRY-RUN] Would set status to 'review'`, which describes the behavior but calls it a skip condition. Meanwhile, the Dry-Run Mode table in phase-runner.md (line 75) says step 2.3 logs the message but does not say "skipped". The registry entry for 2.3 is actually more of a "behavior modification" than a true skip. The inconsistency is whether 2.3 is skipped (no status update) or runs with a log-only mode. SKILL.md (Phase 2.2 dry-run gate) says "proceed directly to Phase 2.5", implying 2.3 is skipped entirely.
   - **Impact:** Ambiguity about whether the `review` status is written to the state file during dry-run. If 2.3 runs and writes the status, the state file shows `review` for a story that was never actually implemented. If 2.3 is skipped, the state file stays at `in-progress` (set by 2.1).
   - **Fix:** Clarify in the registry whether 2.3 is fully skipped in dry-run (no status write) or runs in log-only mode (logs but still writes status). The most consistent interpretation matching SKILL.md's "proceed directly to 2.5" is that 2.3 is fully skipped, but the registry currently shows a log message, suggesting partial execution. Align all three sources (SKILL.md, registry, phase-runner.md).

## Minor Issues (Nice to Have)

1. **[Missing dedup-scan-loop.md in README Further Reading]:** README.md adds links to new docs but omits dedup-scan-loop.md
   - **File:** `/Users/stephen/Documents/ai-learning-hub/.claude/agents/README.md` lines 200-202
   - **Problem:** The Further Reading section adds `phase-registry.md`, `phase-runner.md`, and `review-loop.md` but omits `dedup-scan-loop.md`. The body of README.md references `dedup-scan-loop.md` at line 52, but the curated Further Reading list omits it.
   - **Impact:** Minor discoverability issue. The Further Reading list is incomplete as a quick-reference.
   - **Fix:** Add `- .claude/skills/epic-orchestrator/dedup-scan-loop.md -- Dedup scan loop protocol` to the Further Reading section.

2. **[Versioning Section Inconsistency]:** New docs have Versioning sections that other skill docs lack
   - **File:** `/Users/stephen/Documents/ai-learning-hub/.claude/skills/epic-orchestrator/phase-registry.md` lines 88-90, `/Users/stephen/Documents/ai-learning-hub/.claude/skills/epic-orchestrator/phase-runner.md` lines 122-124
   - **Problem:** Both new documents include a "Versioning" section (Created/Last updated). No other skill doc in the directory (`review-loop.md`, `state-file.md`, `story-runner.md`, `dependency-analysis.md`, `integration-checkpoint.md`, `dedup-scan-loop.md`) has this section. This introduces an inconsistent convention.
   - **Impact:** Very low. Cosmetic inconsistency. No functional impact.
   - **Fix:** Either remove the Versioning sections to match existing docs, or add them to all other skill docs in a follow-up for consistency. Not blocking.

3. **[Resume Table: "paused" status mapping is vague]:** phase-runner.md Resume Semantics table has thin coverage of `paused`
   - **File:** `/Users/stephen/Documents/ai-learning-hub/.claude/skills/epic-orchestrator/phase-runner.md` line 95
   - **Problem:** The resume table says `paused` status maps to "Varies -- Same logic as `in-progress` -- check for branch/PR existence". The state-file.md resume matrix has three rows for `paused` (PR exists, Branch exists, No PR/branch) with distinct actions. The phase-runner.md table collapses these into one row with a vague description.
   - **Impact:** Low. An implementer would need to consult state-file.md anyway for the full matrix. But the phase-runner.md table claims to be the resume reference for the phase runner, so brevity here may cause confusion.
   - **Fix:** Either expand the `paused` row into multiple sub-rows (matching state-file.md), or add a note: "See state-file.md Resume Semantics for the full reconciliation matrix for paused stories."

## Summary

- **Total findings:** 10
- **Critical:** 2
- **Important:** 5
- **Minor:** 3
- **Recommendation:** FIX REQUIRED

**Assessment of delivered content quality:** Setting aside the two Critical git/branch issues, the actual documentation content is strong. The `phase-registry.md` provides a clear, well-structured single-source-of-truth table with step details, cross-references, and a sync contract. The `phase-runner.md` thoroughly covers the execution loop, skip conditions, gate criteria, escalation semantics, dry-run, resume, and idempotency. The SKILL.md Phase 2 intro paragraph and README.md Further Reading additions are appropriate and well-placed. The main content issues are consistency gaps: name mismatches between the registry and SKILL.md headings (violating the documents' own sync contract), an internal contradiction in the dry-run skip logic tables, and missing `--dry-run` skip conditions for steps 2.3b in the registry.

The two Critical issues are strictly about the git workflow -- the work must be committed to the branch and the branch must be cleaned of unrelated Story 3.1.4 content before a PR can proceed. These are process issues, not content quality issues.
