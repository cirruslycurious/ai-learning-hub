# QA Read v2 - Second Cold Read

**Reader:** QA Reader (no prior context)
**Document:** 16-draft-v3r1.md
**Date:** 2026-02-09

---

## Executive Summary

Second cold read completed. The document is significantly clearer than v1. Most structural confusion points have been resolved. Remaining issues are minor friction points around terminology and cross-reference clarity.

**Major improvements from v1:**

- Integration checkpoint timing is now clear (Phase 2 step 6, before human approval)
- Dev-story role and relationship to orchestrator is well-explained
- Dependency verification logic is explicit and comprehensible
- Review loop mechanics are much clearer with exit conditions well-defined

**Remaining friction points:** 3 items (all "Minor friction")

---

## Confusion Points Found

### 1. Topological sort alternate orders (minor)

**What I was trying to understand:**
Why the document says two different execution orders are both valid for the same dependency graph.

**Where I got confused:**
Section "Phase 1: Planning" (lines 173-174):

> "Topological sort produces: `[1.1, 1.2, 1.3, 1.4]` or `[1.1, 1.3, 1.2, 1.4]` — topological sort can produce either order (both valid) depending on how the algorithm processes parallel nodes, because Story 1.2 and Story 1.3 are independent (neither depends on the other)."

This is technically correct, but on first read I wasn't sure if this was theoretical ("the algorithm could produce either") or practical ("Auto Epic actually produces different orders on different runs").

**What I thought it meant:**
Initially I thought this was just explaining the algorithm's theoretical behavior, not what Auto Epic actually does. Then I realized it's saying Auto Epic's actual execution order might vary between runs.

**What would have helped:**
One additional sentence clarifying the practical implication:
"Auto Epic's actual execution order may vary between runs when parallel stories exist. Both orders are valid because neither 1.2 nor 1.3 depends on the other."

**Severity:** Minor friction — I understood after re-reading the sentence, but adding practical context would eliminate the need to re-read.

---

### 2. "State file wins control flow decisions" scope

**What I was trying to understand:**
What "control flow decisions" means in the context of state file vs GitHub reconciliation.

**Where I got confused:**
Section "State Management and Resume" (line 406):

> "State file wins control flow decisions. If the state file marks a story 'done' but GitHub shows PR closed (not merged), the workflow assumes the human closed the PR for a reason and skips the story."

The phrase "control flow decisions" is vague. I initially thought it meant all workflow routing (which stories run next, loop exits, etc.). The example clarifies it's specifically about reconciliation when state file and GitHub disagree, but the opening statement is broader than needed.

**What I thought it meant:**
I thought "control flow decisions" meant the state file determines execution order, dependency validation, and loop termination — essentially all workflow routing.

**What would have helped:**
More precise wording:
"When state file status conflicts with GitHub PR status, state file wins. If the state file marks a story 'done' but GitHub shows PR closed (not merged), the workflow skips the story (assumes the human closed the PR intentionally)."

This limits the scope to reconciliation conflicts rather than implying the state file controls all workflow logic.

**Severity:** Minor friction — the example clarified the scope, but the opening statement created momentary confusion about what "control flow decisions" encompasses.

---

### 3. "Atomic write pattern" implementation status

**What I was trying to understand:**
Whether the atomic write pattern described is actually implemented or still a design specification.

**Where I got confused:**
Section "State Management and Resume" (lines 408-409):

> "The atomic write pattern is specified in the design docs but not yet implemented in the codebase. The design specifies atomic writes using a `.tmp` file pattern..."

This is clear that it's not implemented, but I wondered why this unimplemented detail is included in a "How Auto Epic Works" document. If the pattern isn't implemented, does the current system have a race condition risk? Should I worry about partial state writes?

**What I thought it meant:**
Initially I thought this paragraph was warning me about a current bug or limitation. Then I realized it's documenting a future enhancement.

**What would have helped:**
Either remove this paragraph entirely (since it's not how Auto Epic currently works) or add context about current behavior:
"The atomic write pattern is specified in design docs for future implementation. Currently, state writes use standard file I/O. Race conditions are not expected in normal usage because the orchestrator is the only writer, but the atomic pattern would eliminate this assumption."

**Severity:** Minor friction — I understood the implementation status, but I was momentarily distracted by "why is this unimplemented feature in a 'how it works' document?"

---

## Things That Worked Well

These elements were clear and required no re-reading:

1. **Phase 2 integration checkpoint timing:** Lines 101-106 make it crystal clear that checkpoints run at step 6, before the human approval prompt at step 7. No confusion about sequencing.

2. **Dev-story vs reviewer/fixer distinction:** Lines 49-64 (the dev-story skill section) clearly explain the shared-context (Skill tool) vs isolated-context (Task tool) spawning patterns. I understood immediately why dev-story uses different tooling.

3. **Dependency verification policy:** Lines 96-97 (Phase 2 step 1) lay out the logic clearly with concrete rules: dependencies with dependents need merge-base verification, leaf dependencies need only state file check. No ambiguity.

4. **Review loop exit conditions:** Lines 308-311 are explicit about both success and failure exits. I didn't have to infer when the loop stops.

5. **Hook phases (PreToolUse/PostToolUse/Stop):** Lines 349-365 use consistent terminology and clear timing language ("before tool execution", "after tool execution", "before agent marks task complete"). No timing confusion.

6. **Integration checkpoint result classifications (Green/Yellow/Red):** Lines 336-341 define each tier with concrete criteria. I understood the difference immediately and knew which tier escalates vs which allows continuation.

7. **"Note" about base branch assumption:** Line 17 immediately clarifies that "base branch" means `main` throughout the document. This eliminated potential confusion in later sections that reference "base branch" or "main branch" interchangeably.

---

## Overall Assessment

**Document quality:** Strong. This is a clear, well-structured technical deep-dive.

**Readability for target audience:** High. Software engineers with CLI/git/agent knowledge will follow this with minimal friction.

**Could I implement Auto Epic from this document?** No, but I don't think that's the goal. I could _use_ Auto Epic confidently after reading this, and I'd know where to look in the codebase if I wanted to customize behavior.

**Would I stop reading early?** Unlikely. The progressive disclosure structure works — I could stop after Overview (understand what it does), after Architecture Layers (understand components), or after Three-Phase Workflow (understand execution model). I read through to the end because each section added value without repeating earlier content.

**Remaining friction points:** 3 minor issues, all "recovered with effort" level. None blocked comprehension.

---

## Recommendation

**Approve for Designer.** The remaining friction points are polish-level issues, not comprehension blockers. The document successfully teaches how Auto Epic works at architectural, workflow, and operational levels. The target audience will understand the system after one read-through.

The three friction points documented above are "nice to have" improvements, not mandatory fixes. If the author wants to address them, the suggestions are concrete and scoped. If the author decides the document is ready as-is, I would not object.

---

## Comparison to v1

**QA Read v1 found:** 5 confusion points (1 Could not proceed, 2 Recovered with effort, 2 Minor friction)

**QA Read v2 found:** 3 confusion points (0 Could not proceed, 0 Recovered with effort, 3 Minor friction)

**Major v1 blockers resolved:**

- ✅ Integration checkpoint timing (was "Could not proceed" in v1, now clear)
- ✅ Dev-story role confusion (was "Recovered with effort" in v1, now clear via dedicated section)
- ✅ Dependency verification logic (was "Recovered with effort" in v1, now explicit)

**v1 minor issues resolved:**

- ✅ Execution order sequencing (was minor friction in v1, now clear with explicit step numbering)

**New issues in v2:**

- Topological sort alternate orders (minor friction, not present in v1 because example wasn't as detailed)
- "State file wins" scope (minor friction, new phrasing in v2)
- Atomic write pattern implementation status (minor friction, detail added in v2)

**Net improvement:** Significant. The v2 revision eliminated the major blocker and both "recovered with effort" issues. The three new friction points are all minor and are side effects of adding more detail (which overall improves the document).

---

**End of QA Read v2**
