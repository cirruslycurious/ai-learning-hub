# Outline Review

## Review Items

### [MUST] Section: "Execution example" — Missing diagram planning for required diagrams

The outline defers all diagram planning to "Diagram Suggestions" at the end, stating "These diagram suggestions will be added starting in Draft v2 (step 6)." However, the project request explicitly requires 4-6 diagrams that "must illuminate the prose, not just decorate it" and lists specific required diagrams: system architecture, command flow sequence, agent interaction, and hook lifecycle.

The outline must plan which diagrams support which sections. Without this planning, the Tech Writer cannot write prose that integrates with diagrams (prose must introduce diagrams, reference their elements, and remain understandable without them per diagram-guide.md).

**Location:** End of outline, "Diagram Suggestions" section
**Suggested fix:** Add diagram planning to each relevant section's outline entry. Specify:

- Section "Architecture layers" → System architecture diagram (block diagram showing 4 layers with component boundaries)
- Section "Three-phase workflow" → Command flow sequence diagram (Phase 1/2/3 with key steps)
- Section "Multi-agent code review loop" → Agent interaction diagram (orchestrator spawning reviewer/fixer subagents)
- Section "Hook system enforcement" → Hook lifecycle diagram (when each hook fires in the workflow)
- Section "Execution example" → Concrete dependency graph showing Stories 1.1-1.4
- Section "Dependency analysis" → Topological sort visualization (optional, counts toward 4-6 total)

---

### [MUST] Section: "StoryRunner abstraction" — Section outside declared scope

The project request defines scope as "system architecture, command flow, hook interactions, subagent orchestration, and operational mechanics." The audience is engineers who want to understand "how Auto Epic orchestrates complex epic implementation."

The StoryRunner abstraction is an implementation detail (platform adapter for GitHub operations) that does not illuminate orchestration mechanics. Understanding the interface pattern and --dry-run mode does not advance the reader's understanding of how Auto Epic works — it explains how one supporting module works internally.

This section fits a different document: "Auto Epic Internals: Module Design Patterns" or "Extending Auto Epic." It does not belong in a document about orchestration flow and agent interactions.

**Location:** Section "StoryRunner abstraction"
**Suggested fix:** Remove this section entirely. If GitHub operations need mention (they likely do), fold them into "Three-phase workflow" or "Architecture layers" as a single bullet: "GitHub operations (issues, branches, PRs) are isolated behind an interface for idempotent resume behavior." The interface pattern and dry-run mode are implementation details that do not serve the declared scope.

---

### [SHOULD] Section: "Three-phase workflow" — Research coverage incomplete for Phase 2 human checkpoints

The outline states Phase 2 includes "human checkpoint" (line 52) but does not reference the integration checkpoint or explain the relationship between Phase 2.6 (per-story human approval) and Phase 2.7 (integration checkpoint for stories with dependents).

The research notes for "Integration checkpoints" (lines 135-149) show that integration checkpoint results "fold into Phase 2.6 human checkpoint prompt" (line 139). This means the two checkpoints are connected, but the "Three-phase workflow" outline does not reflect this relationship.

**Location:** Section "Three-phase workflow", Phase 2 description (lines 51-53)
**Suggested fix:** Revise Phase 2 description to clarify checkpoint sequence: "Phase 2 (Story Implementation Loop): For each story in order — check deps, implement via dev-story, review loop with subagents, commit/PR, integration checkpoint (if story has dependents), human checkpoint with integration results (if any), continue or pause based on user input"

---

### [SHOULD] Section: "Dependency analysis" — Prose fallback detection mentioned but not grounded in research

The outline mentions "prose fallback detection" (line 83) in the progressive disclosure layer without explaining what it is or referencing a research finding that defines it.

Searching the research notes and source citations in this outline, the term "prose fallback" appears only in this line. No research finding supports it, and the dependency-analysis.md citation (lines 77-78) does not explain this term.

**Location:** Section "Dependency analysis", thorough reader layer (line 83)
**Suggested fix:** Either remove "prose fallback detection" (if no research finding supports it) or add a research note explaining what it means with a line citation from the source material. If this refers to detecting dependencies mentioned in story prose but not in YAML frontmatter, state that explicitly and cite the source.

---

### [SHOULD] Structural evaluation — Section ordering does not support progressive disclosure claim

The outline claims "Progressive disclosure: Readers should be able to stop after Overview, Architecture Layers, or System Flow sections" (request line 55). However, the section sequence does not align with this layering strategy:

1. Overview (high-level)
2. Architecture layers (structural)
3. Three-phase workflow (operational flow)
4. Dependency analysis (deep-dive on one subsystem)
5. Multi-agent code review loop (deep-dive on another subsystem)
6. StoryRunner abstraction (implementation detail — see MUST finding)
7. Integration checkpoints (deep-dive on another subsystem)
8. Hook system enforcement (quality mechanism)
9. State management and resume (persistence mechanism)
10. Safety invariants (policy)
11. Execution example (concrete walkthrough)

After "Three-phase workflow" (section 3), the reader encounters eight more sections that dive into specific subsystems, mechanisms, and policies. A reader who stops after section 3 gets a workflow overview but no understanding of hooks, dependencies, or multi-agent review — all core to "how Auto Epic works."

The "System Flow" stopping point mentioned in the request does not exist as a section. The closest match is "Three-phase workflow" (operational) or "Execution example" (concrete).

**Location:** Overall section ordering
**Suggested fix:** Reorder sections to support three clear stopping points:

**Tier 1 (High-level understanding):**

- Overview
- Architecture layers
- Three-phase workflow

**Tier 2 (Operational understanding — "System Flow" tier):**

- Dependency analysis (how order is determined)
- Multi-agent code review loop (how quality is enforced during implementation)
- Hook system enforcement (how constraints are enforced during implementation)
- Integration checkpoints (how dependent stories are validated)
- State management and resume (how progress is tracked)

**Tier 3 (Complete understanding):**

- Safety invariants and human checkpoints (policy summary)
- Execution example (concrete trace)

This ordering lets readers stop after Tier 1 (general understanding), Tier 2 (operational mechanics), or Tier 3 (full detail with example). The current ordering scatters operational detail across ten sections with no clear depth boundary.

---

### [SHOULD] Section: "Safety invariants and human checkpoints" — Redundant with sections already covering checkpoints

The outline has a dedicated "Safety invariants and human checkpoints" section (lines 195-213) that lists nine safety rules and four checkpoint types. However:

- Integration checkpoints already have their own section (lines 130-149)
- The "Three-phase workflow" section already mentions "human scope confirmation" in Phase 1 (line 51)
- The safety invariants appear only in this section — no other section references them

This creates redundancy (integration checkpoints described twice) and orphaned content (safety invariants not integrated into the operational flow narrative).

**Location:** Section "Safety invariants and human checkpoints"
**Suggested fix:** Two options:

1. **Merge into "Three-phase workflow"**: Add safety invariants as a subsection within the workflow description, showing how they apply at each phase. Fold the four checkpoint types into Phase 1/2/3 descriptions where they occur.
2. **Reposition as a summary section**: Move this section to the end (before "Execution example") as a policy summary that ties together all the safety mechanisms described in previous sections. This works only if safety invariants are referenced in earlier sections (e.g., "The orchestrator enforces the never-auto-merge invariant by leaving all PRs open for human review").

The current positioning (between "State management" and "Execution example") does not integrate with the narrative flow.

---

### [SHOULD] Section: "Execution example" — Example structure does not demonstrate all key concepts

The execution example covers a four-story epic with dependencies (lines 216-234). It demonstrates:

- Dependency ordering (topological sort)
- Integration checkpoints (stories with dependents)
- Phase 1/2/3 flow

It does NOT demonstrate:

- Multi-agent review loop (no mention of reviewer/fixer subagents in the example trace)
- Hook enforcement (no mention of which hooks fire or how they self-correct)
- Resume behavior (no interruption scenario)
- Blocked/skipped story handling (all four stories complete successfully)

An execution example should be comprehensive enough to show the system under realistic conditions, not just the happy path.

**Location:** Section "Execution example", key points (lines 221-226)
**Suggested fix:** Either expand the example to include one review loop iteration (e.g., "Story 1.1 implementation triggers epic-reviewer, which finds 2 MUST-FIX issues, epic-fixer applies corrections, second review round finds 0 MUST-FIX, loop exits") or note in the section's progressive disclosure that the example shows dependency/checkpoint flow only and refers readers to the "Multi-agent code review loop" section for review mechanics. The latter is acceptable if the example is already long; the former is better for demonstrating the complete system.

---

### [MINOR] Section: "Architecture layers" — Layer 4 description uses unclear term "inline skills"

The outline describes Layer 4 as "Subagents and inline skills — epic-reviewer, epic-fixer (fresh contexts), dev-story (same context)" (line 33).

The term "inline skills" is not defined. Does this mean skills invoked via Skill tool? Skills that run in the same context as the orchestrator? The parenthetical "(same context)" applies only to dev-story, which suggests that "inline skills" means something different from "fresh context subagents," but the distinction is not explicit.

**Location:** Section "Architecture layers", Layer 4 description (line 33)
**Suggested fix:** Replace "inline skills" with a clearer term. Options: "same-context skills" (if the defining characteristic is context sharing) or "invoked skills" (if the defining characteristic is invocation method via Skill tool vs Task tool). Add a brief definition: "Layer 4: Subagents and same-context skills — epic-reviewer, epic-fixer spawn as isolated subagents (fresh contexts via Task tool); dev-story invokes as a skill (same context via Skill tool)"

---

### [MINOR] Progressive disclosure — Multiple sections repeat the same pattern

Six sections use nearly identical progressive disclosure phrasing:

- "Skimming reader gets: [one sentence]"
- "Thorough reader gets: [longer description]"

This formulaic pattern (flagged in style-guide.md under "Synthetic voice: formulaic openers") makes the outline feel mechanically generated. While this is an outline (not final prose), the pattern suggests the Tech Writer may carry this structure into the draft.

**Location:** Progressive disclosure entries in sections "Overview", "Architecture layers", "Three-phase workflow", "Dependency analysis", "Multi-agent code review loop", "StoryRunner abstraction", "Integration checkpoints", "Hook system enforcement", "State management and resume", "Safety invariants", "Execution example"
**Suggested fix:** Vary the progressive disclosure structure across sections. Options:

- Some sections: Use bullet lists for skimming/thorough layers instead of repeated "gets:" phrasing
- Some sections: Integrate progressive disclosure into the "Key points" list with depth markers (e.g., "High-level: dependency order matters", "Detail: Kahn's algorithm with cycle detection")
- Some sections: Omit progressive disclosure entry if it does not add information beyond what "Key points" already conveys

---

## Review Summary

| Severity | Count |
| -------- | ----- |
| MUST     | 2     |
| SHOULD   | 5     |
| MINOR    | 2     |

**Gate recommendation:** MUST-REVISE

The outline provides a strong structural foundation with research-backed sections and clear coverage of Auto Epic's core mechanics. However, two critical issues block the gate:

1. **Missing diagram planning**: The outline defers all diagram planning to a future step, but diagrams must be integrated with prose from the start. The Tech Writer cannot write prose that introduces, references, and remains independent of diagrams without knowing which diagrams will appear in which sections.

2. **Scope violation**: The StoryRunner abstraction section covers an implementation detail (platform adapter) that does not serve the declared scope (understanding orchestration mechanics). This section belongs in a different document.

The SHOULD findings address structural concerns (section ordering does not support the claimed progressive disclosure strategy, safety invariants section creates redundancy, execution example does not demonstrate all key concepts) and research grounding issues (prose fallback detection unverified, incomplete checkpoint description). These do not independently block the gate but require attention to ensure the outline produces a well-structured, scope-aligned document.

Addressing the two MUST items and the section ordering SHOULD item will position the outline for a strong draft.
