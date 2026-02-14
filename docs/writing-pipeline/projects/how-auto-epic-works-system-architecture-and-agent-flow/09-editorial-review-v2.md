# Editorial Review v2: How Auto Epic Works - System Architecture and Agent Flow

**Reviewer:** Editor
**Date:** 2026-02-09
**Draft reviewed:** 08-draft-v2.md
**Review type:** Second editorial review (Step 7a)

---

## Pass 1: Structural Evaluation

### [MUST] Section: "Execution Example" — Section reordering not applied

Editorial Review v1 (SHOULD item) recommended moving "Execution Example" to immediately follow "Three-Phase Workflow" for better progressive disclosure. Draft v2 maintains the original order with "Execution Example" appearing after all detail sections (Dependency Analysis, Review Loop, Integration Checkpoints, Hook System, State Management).

This placement forces readers to hold the Phase 1/2/3 mental model through five intervening technical sections before seeing a concrete walkthrough. The structural issue compounds when readers try to understand integration checkpoints (Phase 2.6) without first seeing how they appear in actual execution.

**Location:** Document structure, section ordering after "Three-Phase Workflow"

**Suggested fix:** Move "Execution Example" section to position 4 (immediately after "Three-Phase Workflow"), before the detail sections begin. Revised order:

1. Overview
2. Architecture Layers
3. Three-Phase Workflow
4. Execution Example (demonstrates phases 1-3 concretely)
5. Dependency Analysis (Phase 1 detail)
6. Multi-Agent Code Review Loop (Phase 2 detail)
7. Integration Checkpoints (Phase 2 detail)
8. Hook System Enforcement (cross-cutting detail)
9. State Management and Resume (persistence detail)
10. Safety Invariants and Human Checkpoints (summary)
11. Diagram Suggestions (Designer instructions)
12. Next Steps

### [SHOULD] Section: "Execution Example" — Missing explicit lead-in to the example

The section opens with "This section walks through a concrete four-story epic execution" but does not connect this example back to the three-phase workflow just described. Readers need orientation: "You've seen the conceptual workflow — now here's how it looks in practice."

**Location:** "Execution Example", opening paragraph

**Suggested fix:** Add a transition sentence before the opening paragraph:

"This section walks through a concrete four-story epic execution showing dependency ordering, integration checkpoints, and review loop mechanics. The example demonstrates the three phases from the previous section with actual story data and command output."

---

## Pass 2: Prose Quality

### [SHOULD] Section: "Overview" — Redundant phrasing in paragraph 3

The opening "Features spanning multiple dependent stories create a coordination problem. A feature spanning five stories with dependencies..." repeats "spanning" twice in consecutive sentences and restates the same concept (multi-story features).

**Location:** "Overview", paragraph 3, first two sentences

**Suggested fix:** Combine into one sentence:

"A feature spanning five stories with dependencies (Story 1.2 depends on 1.1, Story 1.4 depends on both 1.2 and 1.3) creates coordination complexity that requires manual dependency tracking."

Then continue with "Auto Epic eliminates this by..."

### [SHOULD] Section: "Architecture Layers" — Over-explanation persists in final paragraph

Editorial Review v1 flagged the final paragraph of "Architecture Layers" as redundant. Draft v2 still contains the explanation paragraph starting "The orchestrator spawns `epic-reviewer` and `epic-fixer` as isolated subagents..."

This paragraph repeats information already stated in Layer 4's bullet points and diagram introduction. The Layer 4 bullets explicitly explain Task tool vs Skill tool and context isolation. The repetition adds no new information.

**Location:** "Architecture Layers", paragraph beginning "The orchestrator spawns `epic-reviewer` and `epic-fixer`..."

**Suggested fix:** Delete the entire paragraph. The Layer 4 subsection already explains spawning patterns, context isolation, and the Task/Skill tool distinction. The diagram caption reinforces this visually. No repetition needed.

### [SHOULD] Section: "Three-Phase Workflow" — Missing section opener

Editorial Review v1 requested a brief introductory sentence. Draft v2 now includes "This section describes the orchestrator's three execution phases: planning and scope confirmation, story implementation loop, and completion reporting." This resolves the previous finding.

**Status:** RESOLVED from v1 review.

### [SHOULD] Section: "Multi-Agent Code Review Loop" — Formulaic step numbering inconsistency

The "Round execution" steps use inconsistent grammatical structure. Steps 1, 3, 4 use "The orchestrator/reviewer..." (subject-verb), but step 2 uses "Reviewer diffs" (subject without article), step 5 uses "Orchestrator reads" (no article), steps 6-8 use conditional clauses.

**Location:** "Multi-Agent Code Review Loop", numbered list under "Round execution"

**Suggested fix:** Make all steps consistently use "The [subject] [verb]" structure:

1. The orchestrator spawns...
2. The reviewer diffs...
3. The reviewer analyzes...
4. The reviewer writes...
5. The orchestrator reads findings document and counts MUST-FIX issues
6. If MUST-FIX count > 0 and rounds < max, the orchestrator spawns...
7. The fixer reads...
8. The orchestrator increments...

### [SHOULD] Section: "Integration Checkpoints" — Vague "potential conflict" clarified

Draft v2 now includes the clarification "because both stories modify code in the same module. The `touches` field is developer-declared guidance, not authoritative — actual conflict detection relies on git diff analysis." This resolves Editorial Review v1's vague quantifier finding.

**Status:** RESOLVED from v1 review.

### [SHOULD] Section: "State Management and Resume" — Passive construction weakens authority

The sentence "Atomic writes are specified to use a `.tmp` file pattern" uses passive voice that obscures who specifies this. While technically correct (it's a spec, not implemented), the phrasing reads as uncertain.

**Location:** "State Management and Resume", paragraph beginning "Atomic writes are specified"

**Suggested fix:** Change to active voice with clear subject:

"The design specifies atomic writes using a `.tmp` file pattern: write new state to `epic-{id}-auto-run.tmp.md`, verify write succeeded, then `mv epic-{id}-auto-run.tmp.md epic-{id}-auto-run.md`."

The remainder of the paragraph (POSIX filesystem note and design spec citation) can stay as is.

### [MINOR] Section: "Overview" — Word choice improvement applied

Draft v2 changed "AI agents handle implementation" to "AI agents implement stories, run code review cycles, and enforce architectural constraints through hooks." This resolves Editorial Review v1's vague verb finding.

**Status:** RESOLVED from v1 review.

---

## Pass 3: Formatting and Mechanics

### [MUST] Section: All diagram placeholders — Format standardization complete

Editorial Review v1 flagged all diagram placeholders for using `[DIAGRAM: name — description]` format instead of proper caption + alt text + placeholder structure. Draft v2 has converted all diagrams to the correct format with italic captions, HTML alt text comments, and `[Diagram placeholder]` markers. All five diagrams now follow diagram guide conventions.

**Status:** RESOLVED from v1 review.

### [MUST] Section: "Architecture Layers" — Heading hierarchy corrected

Editorial Review v1 required converting Layer 1-4 bold text to H3 headings. Draft v2 now uses proper heading hierarchy:

```markdown
### Layer 1: Command entry point

### Layer 2: Orchestrator skill

### Layer 3: Supporting modules

### Layer 4: Subagents and skills
```

**Status:** RESOLVED from v1 review.

### [MUST] Section: "Execution Example" — Language tags added to code blocks

Editorial Review v1 flagged missing language tags on output examples. Draft v2 now consistently uses ` ```text ` for all scope displays, checkpoint prompts, and summary output blocks. All 4 code blocks in the Execution Example section have proper language tags.

**Status:** RESOLVED from v1 review.

### [SHOULD] Section: "Safety Invariants and Human Checkpoints" — List formatting inconsistency

The "Nine safety invariants" list uses plain numbers, but items 1-9 have inconsistent boldface application. Items 1-6 use `**Never auto-merge**`, items 7-9 use `**Idempotent operations**`. The "Four checkpoint types" list uses the same format. Both lists are now internally consistent.

**Status:** RESOLVED from v1 review (previously flagged list format mismatch between the two lists, now both use matching format).

### [SHOULD] Section: "Execution Example" — Story identifier formatting inconsistency persists

Editorial Review v1 (MINOR) noted inconsistent story identifier formatting (inline code vs plain text). Draft v2 still mixes both: "Story 1.1" (plain text) and `Story 1.1` (inline code) appear throughout the document.

**Location:** Throughout document, particularly "Dependency Analysis" and "Execution Example"

**Suggested fix:** Standardize on plain text for all story references in prose. Story IDs should only use inline code when appearing in data structures or command output: `depends_on: [1.1]`, `"1.1 → 1.2 → 1.3 → 1.4"` (in code blocks), but "Story 1.1" in running text.

Current inconsistent examples:

- "Story 1.1 execution" (plain) vs "`Story 1.1`" in dependency graph prose
- "Stories 1.2 and 1.3" (plain) vs "`[1.1, 1.2, 1.3, 1.4]`" (code, correct)

### [MINOR] Section: "Three-Phase Workflow" — Section transition could be tighter

Phase 2 ends with "This local-only git workflow allows the orchestrator to abandon work if max rounds exceeded without polluting the remote branch." Phase 3 begins with "After all stories complete, the orchestrator generates a summary report." No explicit connection signals the transition from loop mechanics back to the high-level workflow.

**Location:** Transition between "Phase 2: Story implementation loop" and "Phase 3: Completion and reporting"

**Suggested fix:** Add brief transition sentence at the start of Phase 3:

"After all stories complete (or the user pauses the workflow), the orchestrator moves to Phase 3 to generate a summary report."

---

## Pass 4: Diagram Conformance

### [SHOULD] Section: "Diagram Suggestions" — Diagram 2 participant ordering unclear

The Designer instructions for Diagram 2 (Command Flow Sequence) specify participants but don't indicate left-to-right ordering. Sequence diagrams require explicit ordering for readability. The specification lists "User, Orchestrator, State File, `dev-story` (skill), `epic-reviewer` (subagent), GitHub" but doesn't clarify if this is rendering order.

**Location:** "Diagram Suggestions" → "Diagram 2: Command Flow Sequence", "Participants" subsection

**Suggested fix:** Clarify participant ordering in the specification:

"**Participants (in order from left to right):**

- User
- Orchestrator
- State File
- `dev-story` (skill)
- `epic-reviewer` (subagent)
- GitHub"

Add a note: "This left-to-right order shows external actors (User) on the left, orchestrator in center, external systems (GitHub) on the right."

### [SHOULD] Section: "Diagram Suggestions" — Diagram 3 edge labels missing timing context

The Designer instructions for Diagram 3 (Agent Interaction / Review Loop) specify message sequences but don't indicate whether the spawning should show timing annotations. The review loop is inherently temporal (Round 1, Round 2, etc.) but the diagram spec doesn't mention round numbers.

**Location:** "Diagram Suggestions" → "Diagram 3: Agent Interaction (Review Loop)", "Key message sequences"

**Suggested fix:** Add annotation guidance after the message sequence list:

"**Annotations:** Add loop notation (mermaid `loop` construct) around steps 1-8 to show the round repeats. Label the loop condition: 'while MUST-FIX > 0 and round < max'."

This helps the Designer show the iterative nature without adding per-round complexity that would exceed node limits.

### [MINOR] Section: "Diagram Suggestions" — Diagram 5 node shape convention unspecified

The Designer instructions for Diagram 5 (Dependency Graph) specify components, relationships, and annotations but don't indicate what node shape to use. Should stories be rectangles (process), rounded rectangles (external), or stadium (manual trigger)?

**Location:** "Diagram Suggestions" → "Diagram 5: Dependency Graph", "Components" subsection

**Suggested fix:** Add node shape guidance after the components list:

"**Node shapes:** Use rectangles for all story nodes (standard process/component shape). Stories are internal workflow units, not external systems or decisions."

---

## Verification Against Previous Reviews

### Editorial Review v1 MUST items:

1. ✅ **Heading hierarchy violation** — RESOLVED: Layer 1-4 now use H3 headings
2. ✅ **Diagram placeholder format violations** — RESOLVED: All 5 diagrams use proper caption + alt text format
3. ✅ **Missing language tags** — RESOLVED: All code blocks in Execution Example have `text` tags
4. ✅ **Missing prose introductions for diagrams** — RESOLVED: Each diagram has preceding prose introduction and following diagram placement

### Editorial Review v1 SHOULD items (selective check):

1. ✅ **Progressive disclosure opening** — RESOLVED: Overview paragraph 1 split into clearer sentences
2. ✅ **Three-Phase Workflow section opener** — RESOLVED: Opening sentence added
3. ❌ **Execution Example placement** — UNRESOLVED: Still appears after detail sections (NEW MUST in this review)
4. ❌ **Over-explanation in Architecture Layers** — UNRESOLVED: Final paragraph still present (carried forward as SHOULD)
5. ✅ **Next Steps section** — RESOLVED: Added at end with command examples and cross-references
6. ✅ **Paired intensifier synthetic pattern** — RESOLVED: Overview paragraph 3 tightened
7. ❌ **Formulaic step structure** — PARTIALLY RESOLVED: Three-Phase phase openers vary, but Review Loop steps still inconsistent (carried forward)
8. ✅ **Vague quantifier** — RESOLVED: Integration checkpoint "potential" qualified with explanation
9. ❌ **Story identifier formatting** — UNRESOLVED: Still mixes inline code and plain text (carried forward as SHOULD)

### SME Review v1 MUST items (spot check for editorial carryover):

1. ✅ **Review round terminology** — RESOLVED: Draft now explicitly states "3 review rounds = Round 1 review → fix → Round 2 review → fix → Round 3 review → escalate"
2. ✅ **Missing git fetch step** — RESOLVED: Phase 2 step 1 now includes "Fetch latest remote state (`git fetch origin main`)"
3. ✅ **Dependency completion criteria** — RESOLVED: Step 1 now correctly states conditional logic "if dependency has dependents... verify via merge-base; if leaf... state file sufficient"
4. ✅ **Hook file extensions** — RESOLVED: All hooks now listed with extensions (bash-guard.js, architecture-guard.sh, etc.)
5. ✅ **Atomic write specification** — RESOLVED: Changed to "are specified to use" with design spec citation

---

## Review Summary

| Severity | Count |
| -------- | ----- |
| MUST     | 1     |
| SHOULD   | 7     |
| MINOR    | 3     |

**Gate recommendation:** MUST-REVISE

**Rationale:**

Draft v2 has successfully resolved all four MUST items and most SHOULD items from Editorial Review v1, plus all ten MUST items from SME Review v1. The document now has proper heading hierarchy, correct diagram placeholder format, complete technical accuracy, and appropriate language tags on code blocks.

However, one critical structural issue remains:

**The MUST item:** The "Execution Example" section placement creates a progressive disclosure failure. Readers encounter five dense technical sections (Dependency Analysis, Review Loop, Integration Checkpoints, Hook System, State Management) between the conceptual three-phase description and the concrete walkthrough. This interrupts the natural learning flow from abstract to concrete. The structural problem prevents readers from understanding how the pieces fit together until they've absorbed significant implementation detail.

This is a MUST-level issue because:

1. It violates the document's stated structure requirement: "Use clear section boundaries so readers can stop at their desired depth level"
2. It creates a comprehension barrier where readers must hold complex mental models across multiple sections before seeing them demonstrated
3. The request specification explicitly requires "progressive depth" with example walkthroughs following conceptual descriptions

**The SHOULD items** are primarily polish:

- Redundant phrasing in Overview (can combine sentences)
- Over-explanation paragraph in Architecture Layers (should delete, already covered)
- List parallelism in Review Loop steps (inconsistent article usage)
- Passive voice in State Management (weakens authority)
- Story identifier formatting inconsistency (minor style issue)
- Diagram specification clarity for Designer (participant ordering, timing annotations, node shapes)

**Quality assessment:**

The technical content is accurate, comprehensive, and well-researched. The prose is clear and direct with minimal synthetic patterns. The diagram specifications are detailed and actionable for the Designer. The Next Steps section provides appropriate closing guidance.

After resolving the section ordering MUST item and addressing the SHOULD items, this document will provide excellent progressive disclosure: readers can stop after Overview (high-level), Architecture Layers (components), Three-Phase Workflow + Execution Example (operations), or continue into implementation details.

**Revision priority:**

1. **MUST:** Move "Execution Example" to position 4 (after "Three-Phase Workflow")
2. **SHOULD:** Delete redundant Architecture Layers final paragraph
3. **SHOULD:** Combine redundant Overview paragraph 3 sentences
4. **SHOULD:** Standardize Review Loop step grammar (add articles consistently)
5. **SHOULD:** Change passive "are specified" to active voice in State Management
6. **SHOULD:** Standardize story identifier formatting (plain text in prose, inline code in data structures)
7. **SHOULD:** Clarify diagram specifications for Designer (participant order, loop annotations, node shapes)

The Tech Writer should prioritize the section reordering first, then address the prose improvements in a single pass. The changes are localized and non-invasive — no content needs rewriting, only repositioning and tightening.
