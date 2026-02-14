# Outline Review v2 (Second Pass)

## Verification of MUST Item Resolution

### MUST Item 1: Missing diagram planning — RESOLVED

**Original finding:** The outline deferred all diagram planning to "Diagram Suggestions" at the end without integrating diagrams into section planning.

**Resolution verification:** The revised outline now includes diagram planning in five sections:

- **Architecture layers** (lines 44-51): Block diagram showing four layers with component boxes and delegation flow
- **Three-phase workflow** (lines 74-80): Sequence diagram showing linear flow through phases with loop boundary
- **Multi-agent code review loop** (lines 134-141): Sequence diagram showing agent interaction pattern with conditional branching
- **Hook system enforcement** (lines 186-193): Flowchart/timeline diagram showing hook firing points during implementation
- **Execution example** (lines 261-267): Dependency graph showing four story nodes with edges and execution order

Each diagram planning entry includes: type, what it shows, components, key relationships/interactions, placement, and purpose. This provides the Tech Writer sufficient guidance to write prose that introduces diagrams, references their elements, and remains understandable without them.

**Status:** RESOLVED

---

### MUST Item 2: StoryRunner abstraction section outside scope — RESOLVED

**Original finding:** The StoryRunner abstraction section covered an implementation detail (platform adapter pattern) that did not serve the declared scope of understanding orchestration mechanics.

**Resolution verification:** The revised outline has removed the dedicated "StoryRunner abstraction" section. GitHub operations are now mentioned in the "Architecture layers" section (lines 34-35): "GitHub operations (issues, branches, PRs) are isolated behind an interface for idempotent resume behavior."

This treatment is appropriate: the reader learns that GitHub operations exist and have specific characteristics (isolation, idempotency) without diving into implementation patterns that belong in an internals document.

**Status:** RESOLVED

---

## New Review Items (Second Pass)

### [SHOULD] Section: "Dependency analysis" — Diagram planning marked optional when diagram is listed as required

The outline marks the dependency analysis diagram as "optional" (line 104) but the "Execution example" section already plans a dependency graph diagram (lines 261-267). These appear to be the same diagram type illustrating the same concept (dependency structure).

The project request requires 4-6 diagrams. With the current planning, there are 5 diagrams committed (Architecture layers, Three-phase workflow, Multi-agent review loop, Hook system, Execution example). Adding an "optional" sixth diagram in "Dependency analysis" creates ambiguity: is this diagram distinct from the execution example dependency graph, or is it the same diagram appearing twice?

**Location:** Section "Dependency analysis", lines 104-110
**Suggested fix:** Either:

1. **Remove the "optional" diagram** from "Dependency analysis" section entirely. The execution example dependency graph (lines 261-267) already provides concrete visualization of dependency structure. The "Dependency analysis" section can describe the algorithm with prose and code/pseudocode examples without requiring a separate diagram.
2. **Make the diagram concrete and distinct** by showing before/after states: a sample dependency graph with 5 stories showing the unsorted adjacency list alongside the topologically sorted linear sequence. This would illustrate Kahn's algorithm visually and differ from the execution example graph (which shows a concrete 4-story epic, not algorithm mechanics).

Option 1 is recommended. Five diagrams meet the "4-6 diagrams total" requirement, and adding a sixth diagram that overlaps with the execution example adds redundancy without adding clarity.

---

### [SHOULD] Section: "Safety invariants and human checkpoints" — Section remains unintegrated despite being flagged in first review

The original review flagged this section as creating redundancy (SHOULD item, lines 104-121 of first review). The section lists integration checkpoints as one of four checkpoint types, but integration checkpoints already have a dedicated section.

The revised outline retains this section without changes. The section still sits between "State management and resume" and "Execution example" without clear narrative integration. Safety invariants appear only in this section — no earlier section references them.

**Location:** Section "Safety invariants and human checkpoints", lines 219-237
**Suggested fix:** Two options (same as original review):

1. **Fold into "Three-phase workflow"**: Add safety invariants as a subsection showing how they apply at each phase. Integrate the four checkpoint types into Phase 1/2/3 descriptions where they occur.
2. **Reposition as policy summary**: Move to the end (after "State management" but position it as a synthesis section that ties together mechanisms described earlier). This requires earlier sections to reference specific invariants (e.g., "The orchestrator enforces the never-auto-merge invariant by leaving PRs open").

This item remains SHOULD severity because it does not block the reader from understanding the system, but it weakens the document's cohesion by creating orphaned policy content.

---

### [SHOULD] Section: "Execution example" — Example still shows only happy path

The original review noted the execution example does not demonstrate multi-agent review loop mechanics, hook enforcement, or resume behavior (SHOULD item, lines 123-143 of first review).

The revised outline now mentions the review loop in the Phase 2, Story 1.1 walkthrough (lines 248-249): "review loop finds 2 MUST-FIX issues → epic-fixer applies corrections → second review finds 0 MUST-FIX → loop exits." This addresses the review loop demonstration.

However, the example still does not show:

- Hook enforcement (which hooks fire, how they self-correct)
- Resume behavior (interruption and recovery)
- Blocked/skipped story handling

**Location:** Section "Execution example", lines 246-267
**Suggested fix:** The review loop addition is sufficient improvement. Add a note in the progressive disclosure layer (lines 256-258) acknowledging the example's scope: "Complete walkthrough: Step-by-step trace through all three phases, dependency ordering, integration checkpoints, and one review loop iteration. For hook enforcement and resume mechanics, refer to dedicated sections."

This explicitly scopes the example and signals readers where to find omitted mechanics. Expanding the example to cover all mechanics would make it too long for its purpose (concrete demonstration, not exhaustive trace).

**Status:** Improved from original review but could be clarified with explicit scoping statement.

---

### [MINOR] Section: "Three-phase workflow" — Diagram planning does not specify max participants/messages

The sequence diagram planning for "Three-phase workflow" (lines 74-80) lists five participants (User, Orchestrator, State File, dev-story skill, epic-reviewer subagent) and describes "key interactions" without specifying message count.

The diagram-guide.md sets hard limits for sequence diagrams: max 5 participants (line 343) and max 12 messages (line 344). The planning meets the participant limit but does not verify message count.

**Location:** Section "Three-phase workflow", lines 74-80
**Suggested fix:** Add message count estimate to the diagram planning entry: "**Key interactions:** User approval gates, subagent spawning, state persistence points (estimate 8-10 messages across three phases)." This ensures the Designer can create a conforming diagram without exceeding the 12-message limit.

---

### [MINOR] Section: "Multi-agent code review loop" — Diagram shows "one complete iteration" but loop mechanics require showing exit condition

The diagram planning for the review loop (lines 134-141) specifies "one complete review loop iteration with conditional branching" showing "loop decision" as a key interaction.

However, a sequence diagram that shows "one iteration" cannot fully illustrate the loop structure (up to 3 rounds with MUST-FIX count driving exit). A single iteration shows the mechanics of one round but not the loop termination logic.

**Location:** Section "Multi-agent code review loop", lines 134-141
**Suggested fix:** Revise diagram planning to clarify what "one iteration with conditional branching" means: "**Shows:** One complete review loop round (spawn reviewer → findings doc → MUST-FIX count check → spawn fixer if needed → local commits) with branching paths for exit conditions (MUST-FIX = 0 exits loop, MUST-FIX > 0 and rounds < max loops back)."

This ensures the diagram illustrates both the iteration mechanics and the loop control flow.

---

## Review Summary

| Severity | Count |
| -------- | ----- |
| MUST     | 0     |
| SHOULD   | 3     |
| MINOR    | 2     |

**Gate recommendation:** CONDITIONAL-PASS

The revised outline resolves both MUST items from the first review:

1. Diagram planning is now integrated into five sections with sufficient detail for the Tech Writer to write diagram-aware prose
2. The StoryRunner abstraction section has been removed, eliminating the scope violation

Three SHOULD items remain:

1. **Optional diagram ambiguity** (Dependency analysis): The "optional" diagram creates uncertainty about whether it duplicates the execution example dependency graph. Recommend removing the optional diagram or making it distinctly algorithmic (before/after toposort visualization).

2. **Unintegrated safety invariants section**: This section remains orphaned from the narrative flow, creating redundancy with the integration checkpoints section. Recommend folding into "Three-phase workflow" or repositioning as a synthesis section with cross-references.

3. **Example scope not explicitly stated**: The execution example now demonstrates the review loop but does not cover hooks, resume, or failure scenarios. Recommend adding explicit scoping statement in progressive disclosure.

Two MINOR items address diagram planning precision (sequence diagram message count estimate, review loop iteration vs loop structure clarification).

**Rationale for CONDITIONAL-PASS:** The outline is now structurally sound with research-backed sections, integrated diagram planning, and appropriate scope. The SHOULD items do not indicate fundamental problems — they are refinement opportunities. The Tech Writer can proceed to Draft v1 using this outline while addressing the SHOULD items during drafting (e.g., remove the optional diagram, add explicit example scoping, reference safety invariants in earlier sections). These issues are easier to resolve in prose than in outline form.

If the Manager prefers a cleaner outline before draft, recommend one more revision cycle focused solely on: (1) remove optional diagram from Dependency analysis, (2) add explicit scoping to execution example progressive disclosure, (3) reposition or integrate safety invariants section. These are minor structural adjustments that do not require re-research.

The outline is ready to produce a strong draft. The SHOULD items are quality improvements, not blockers.
