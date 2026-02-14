# Editorial Review v1: Second Pass — Unresolved MUST Items

## Status

This is a second-pass review following Tech Writer revision. Two MUST items from the previous review remain unresolved. The "Diagram Suggestions" section was successfully removed.

---

## Unresolved MUST Items

### [MUST] CUT Section: "Workflow Invariants" — Duplicates Overview safety invariants [UNRESOLVED from previous review]

This subsection in Layer 3 (lines 59-70) lists nine workflow invariants that duplicate the nine safety invariants in Overview paragraph 4. The duplication is verbatim:

**Overview (line 9):**

> "Key benefits include autonomous supervised execution, quality convergence through adversarial review (fresh-context reviewer finds issues the implementer missed), dependency-aware execution (topological sort ensures prerequisites complete first), resumability, and safety by design."

**Layer 3 "Safety invariants" subsection (lines 59-70):**
Lists the same nine invariants:

1. Never auto-merge PRs
2. Never bypass hooks
3. Never force push
4. Never push to base branch
5. Never skip tests
6. Never silently ignore failures
7. Idempotent operations
8. State persistence with atomic writes
9. Human checkpoints at 4 milestones

The reader encounters this list twice with no new information in the second occurrence. One list must go.

**Location:** "Architecture Layers" → Layer 3 → "Safety invariants" subsection (lines 59-70)

**What remains wrong:** The subsection was not removed. The clarifying sentence about "control flow vs. configuration enforcement" was not moved to Overview as suggested.

**Suggested fix:** Delete lines 59-70 (the entire "Safety invariants" subsection). Add this sentence to Overview after the "safety by design" mention: "Nine invariants enforced by orchestrator control flow (not configuration) include: never auto-merge PRs, never bypass hooks, never force push, never skip tests, and state persistence with atomic writes."

Alternatively, if the detailed list is considered essential in Layer 3, remove it from Overview entirely and replace with: "Safety by design (nine workflow invariants enforced by orchestrator control flow)."

---

### [MUST] CUT Section: "Human Checkpoints" (Layer 3) — Duplicates Overview checkpoint list [UNRESOLVED from previous review]

Layer 3 contains a "Human Checkpoints" subsection (lines 73-81) with a table listing four checkpoints. Overview paragraph 5 already introduced these same four checkpoints with identical information except for the source citation.

**Overview (line 7):**

> "Human checkpoints appear at four strategic points: scope confirmation before implementation begins, per-story completion decisions, integration validation for stories with dependents, and epic completion review (`.claude/skills/epic-orchestrator/SKILL.md:12-24`)."

**Layer 3 "Human Checkpoints" subsection (lines 73-81):**
Same four checkpoints in table format with Phase numbers.

The reader encounters the checkpoint list twice. The table in Layer 3 adds Phase numbers but no other new information.

**Location:** "Architecture Layers" → Layer 3 → "Human Checkpoints" subsection (lines 73-81)

**What remains wrong:** The subsection was not removed.

**Suggested fix:** Delete lines 73-81 (the entire "Human Checkpoints" subsection). If Phase number references are needed in Layer 3, add a single cross-reference sentence: "The four human checkpoints (detailed in Overview) integrate with hook enforcement at Phases 1.4, 2.6, 2.7, and 3."

---

## Review Summary

| Severity | Count |
| -------- | ----- |
| MUST     | 2     |

**Gate recommendation:** MUST-REVISE

Two MUST-level redundancy defects block the gate. Both are section-level duplications where the reader encounters identical information in two locations. The Tech Writer did not apply the Reorganization Map items #3 and #4 from the previous review.

The "Diagram Suggestions" section was successfully removed, resolving the third MUST item from the previous review.

**Next steps:** Remove the two redundant subsections from Layer 3. The information exists in Overview — Layer 3 should not duplicate it. If detail is needed in Layer 3, the Overview versions should be condensed to high-level summaries and the Layer 3 versions should become the authoritative source.
