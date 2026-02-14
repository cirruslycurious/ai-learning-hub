# Editorial Review v1: How Auto Epic Works - System Architecture and Agent Flow

## Pass 1: Structural Evaluation

### [MUST] Section: "Architecture Layers" — Heading hierarchy violation

The document uses H2 for "Three-Phase Workflow" but the subsections "Phase 1", "Phase 2", "Phase 3" are also H3, which is correct. However, the "Architecture Layers" section uses bold text for layer names instead of proper heading hierarchy.

**Location:** Architecture Layers section, Layer 1-4 descriptions
**Suggested fix:** Convert "**Layer 1: Command entry point**", "**Layer 2: Orchestrator skill**", etc. to H3 subsections for consistent heading hierarchy. The section should use:

```markdown
### Layer 1: Command entry point

### Layer 2: Orchestrator skill

### Layer 3: Supporting modules

### Layer 4: Subagents and skills
```

### [SHOULD] Section: "Overview" — Progressive disclosure opening could be stronger

The Overview section opens with a comprehensive sentence that explains what Auto Epic does, but it doesn't immediately establish the "what" before diving into "how." The first sentence combines the core purpose with implementation details (dependency awareness, review loops, checkpoints) which may overwhelm readers seeking a quick orientation.

**Location:** Overview, paragraph 1, first sentence
**Suggested fix:** Split the opening into two sentences. First sentence states what it is in simplest terms, second adds the key capabilities:

"Auto Epic autonomously implements complete epics by executing all stories in dependency order. The workflow analyzes story dependencies, runs multi-agent code review on each story, validates integration points when upstream changes affect downstream stories, and presents all work as pull requests for human approval before merge."

### [SHOULD] Section: "Three-Phase Workflow" — Missing task-section opener

The "Three-Phase Workflow" section begins immediately with Phase 1 subsection without a brief introductory sentence explaining what the reader will learn in this section. Per style guide, task sections should open with a single sentence stating what the reader will accomplish or understand.

**Location:** Three-Phase Workflow, immediately after section heading
**Suggested fix:** Add opening sentence before Phase 1:

"This section describes the orchestrator's three execution phases: planning and scope confirmation, story implementation loop, and completion reporting."

### [SHOULD] Section: "Execution Example" — Section appears after "Safety Invariants" but logically follows "Three-Phase Workflow"

The execution example demonstrates the three-phase workflow with concrete data, making it a natural continuation of the conceptual three-phase description. Placing it after Safety Invariants and all the detail sections (Dependency Analysis, Review Loop, Integration Checkpoints, Hooks, State Management) means readers must carry Phase 2/3 mental models through 5 intervening sections before seeing the concrete example.

**Location:** Document structure, Execution Example placement
**Suggested fix:** Move "Execution Example" to immediately follow "Three-Phase Workflow" section. The current order interrupts the conceptual-to-concrete flow. Suggested order:

1. Overview
2. Architecture Layers
3. Three-Phase Workflow
4. Execution Example (demonstrates phases 1-3)
5. Dependency Analysis (details mechanism from Phase 1)
6. Multi-Agent Code Review Loop (details mechanism from Phase 2)
7. Integration Checkpoints (details mechanism from Phase 2)
8. Hook System Enforcement (details constraint layer)
9. State Management and Resume (details persistence layer)
10. Safety Invariants and Human Checkpoints (summary of guarantees)

### [SHOULD] Section: Document overall — No "Next Steps" or closing section

The document ends abruptly after the execution example with no summary, reflection, or guidance on what readers should do with this knowledge. Per style guide, Next Steps sections should be the last content section when appropriate.

**Location:** End of document
**Suggested fix:** Add a brief closing section that orients readers to next actions:

```markdown
## Next Steps

To run Auto Epic on your own epic:

- Ensure epic and story files follow the BMAD format with dependency declarations
- Run `bmad-bmm-auto-epic --epic N` where N is your epic number
- Review the scope confirmation prompt before approving
- Monitor human checkpoints and approve/pause as stories complete

For customization details, see `.claude/skills/epic-orchestrator/SKILL.md`. For hook configuration, see `.claude/hooks/README.md`.
```

## Pass 2: Prose Quality

### [SHOULD] Section: "Overview" — Synthetic voice pattern: paired intensifier

Paragraph 3 uses "When building a feature that spans five stories with dependencies..." followed by a long description, then states "Auto Epic computes the dependency graph, validates it for cycles, executes stories in topological order, and runs integration checks after completing stories that have dependents." This feels like a setup-payoff construction that could be more direct.

**Location:** Overview, paragraph 3
**Suggested fix:** Lead with the problem statement more directly:

"Multi-story feature development creates a coordination problem. A feature spanning five stories with dependencies (Story 1.2 depends on 1.1, Story 1.4 depends on both 1.2 and 1.3) requires manual dependency tracking. Auto Epic eliminates this by computing the dependency graph, validating for cycles, executing in topological order, and running integration checks when dependencies complete."

### [SHOULD] Section: "Architecture Layers" — Over-explanation of architecture pattern

The architectural boundary explanation at the end of Layer 4 restates what was already clear from the Layer 4 bullet points. "The architectural boundary between Layer 2 and Layer 4 determines context isolation. The orchestrator spawns... invokes..." repeats information already conveyed.

**Location:** Architecture Layers, final paragraph
**Suggested fix:** Delete the final paragraph. The Layer 4 bullets already explain the Task/Skill tool distinction with context isolation details. If boundary explanation is needed, integrate it into the Layer 4 introduction rather than repeating as a summary paragraph.

### [SHOULD] Section: "Three-Phase Workflow" — Formulaic opener pattern

Phase 1, Phase 2, and Phase 3 subsections all open with nearly identical structure: "Phase X [does Y] by [list of actions]." Three consecutive subsections with the same syntactic pattern creates monotony.

**Location:** Three-Phase Workflow subsections
**Suggested fix:** Vary the opening patterns:

- Phase 1: Keep as-is or simplify: "Phase 1 confirms scope before implementation begins."
- Phase 2: "The implementation loop processes stories in topological order."
- Phase 3: "After all stories complete, the orchestrator generates a summary report."

### [SHOULD] Section: "Multi-Agent Code Review Loop" — Passive voice in process description

Step 2 states "Reviewer diffs local story branch against base branch using `git diff main...story-branch`". While technically in active voice, the subject "Reviewer" performing "diffs" is weaker than imperative construction. This is a procedure-like section describing what happens in sequence.

**Location:** Multi-Agent Code Review Loop, Round execution step 2
**Suggested fix:** Use active voice with specific subject and verb:

"The reviewer diffs the local story branch against the base branch using `git diff main...story-branch`."

(Note: This is borderline since it's a conceptual description not an instruction to the reader. Classification as SHOULD reflects that tightening improves clarity even if not strictly required.)

### [SHOULD] Section: "Integration Checkpoints" — Vague quantifier without qualification

The file overlap detection description states "if the completed story modified `shared/db/src/client.ts` and a dependent story declares `touches: [shared/db]`, the checkpoint flags potential conflict." The word "potential" is vague — what makes it potential vs actual?

**Location:** Integration Checkpoints, File overlap detection paragraph
**Suggested fix:** Qualify the statement to explain what "potential" means:

"the checkpoint flags this as a potential conflict because both stories modify code in the same module. The `touches` field is developer-declared guidance, not authoritative — actual conflict detection relies on git diff analysis."

### [MINOR] Section: "Overview" — Word choice: "handles" is vague

Paragraph 2 states "AI agents handle implementation". The verb "handle" is a vague placeholder that doesn't specify the actual action.

**Location:** Overview, paragraph 2
**Suggested fix:** Replace "handle" with specific verb: "AI agents implement stories, run code review cycles, and enforce architectural constraints through hooks."

### [MINOR] Section: "Dependency Analysis" — Sentence length exceeds 25 words

The sentence beginning "Topological sort uses Kahn's algorithm: initialize a queue..." is 54 words with multiple clauses describing the algorithm steps. While the code path exception applies, this sentence could be more digestible.

**Location:** Dependency Analysis, paragraph 3
**Suggested fix:** Split into two sentences:

"Topological sort uses Kahn's algorithm. The algorithm initializes a queue with all zero-dependency stories, processes stories from the queue, decrements dependency counts for their dependents, and adds newly-zero-dependency stories to the queue."

## Pass 3: Formatting and Mechanics

### [MUST] Section: "Architecture Layers" — Diagram placeholder violates format convention

The diagram placeholder uses square brackets `[DIAGRAM: system-architecture — ...]` instead of proper diagram integration format. Per diagram guide, diagrams must have italic caption on the line before the code block, not inline placeholder syntax.

**Location:** Architecture Layers, after Layer 4 description
**Suggested fix:** Replace placeholder with proper diagram structure:

```markdown
_System architecture showing four horizontal layers with delegation and spawning patterns_

<!-- Alt: Block diagram with four layers (Command, Orchestrator, Modules, Agents) showing arrows for delegation from Layer 1 to 2, on-demand loading from Layer 2 to 3, and spawning patterns from Layer 2 to 4 with Task/Skill tool labels -->

[Diagram placeholder for Designer - block-beta diagram with layers, delegation arrows, spawning patterns labeled]
```

### [MUST] Section: Multiple locations — All diagram placeholders use non-standard format

All six diagram placeholders use `[DIAGRAM: name — description]` format instead of the required format: italic caption above the placeholder location with proper diagram type specification for the Designer.

**Location:** Architecture Layers, Three-Phase Workflow (command-flow), Multi-Agent Code Review Loop (agent-interaction), Hook System Enforcement (hook-lifecycle), Execution Example (dependency-graph)
**Suggested fix:** Convert all diagram placeholders to proper format with caption and Designer instructions. Example for command-flow:

```markdown
_Linear flow through planning, story loop, and reporting phases_

<!-- Alt: Sequence diagram showing User, Orchestrator, State File, dev-story skill, and epic-reviewer as participants with approval gates at Phase 1 and Phase 2.7 -->

[Diagram placeholder for Designer - sequenceDiagram with participants User, Orchestrator, StateFile, DevStory, EpicReviewer, showing phase progression and approval gates]
```

### [MUST] Section: "Execution Example" — Code block missing language tag

The scope display and checkpoint prompts shown as code blocks use bare triple-backticks without language tags.

**Location:** Execution Example, Phase 1 scope display, Phase 2 checkpoint prompts, Phase 3 summary
**Suggested fix:** Add `text` language tag to all output examples:

````markdown
```text
Epic: Authentication System Overhaul
Stories: 4 total
...
```
````

### [SHOULD] Section: "Multi-Agent Code Review Loop" — List parallelism violation

The "Round execution" numbered list uses mixed grammatical forms. Steps 1-4 use third person ("Orchestrator spawns", "Reviewer diffs"), step 5 uses noun phrase ("Orchestrator reads"), steps 6-8 switch to conditional constructions.

**Location:** Multi-Agent Code Review Loop, Round execution steps
**Suggested fix:** Convert all steps to consistent subject-verb-object form:

1. The orchestrator spawns...
2. The reviewer diffs...
3. The reviewer analyzes...
4. The reviewer writes...
5. The orchestrator reads...
6. If MUST-FIX count > 0 and rounds < max, the orchestrator spawns...
7. The fixer reads...
8. The orchestrator increments...

### [SHOULD] Section: "Safety Invariants and Human Checkpoints" — Inconsistent list format

The "Nine safety invariants" list uses bold numbers followed by bold text for each item. The "Four checkpoint types" list uses plain numbers with bold text. Inconsistent formatting within the same section weakens readability.

**Location:** Safety Invariants and Human Checkpoints, both lists
**Suggested fix:** Use consistent format. Recommend numbered list with no bold numbers:

```markdown
1. **Never auto-merge** — all PRs remain open...
2. **Never bypass hooks** — all quality gates...
```

And:

```markdown
1. **Scope confirmation** (Phase 1.4) — user approves epic scope...
2. **Per-story approval** (Phase 2.7) — user reviews story completion...
```

### [MINOR] Section: "Dependency Analysis" — Inline code for identifiers inconsistent

Story identifiers are sometimes in inline code (`Story 1.1`, `[1.1]`) and sometimes plain text (Story 1.1). The document mixes both styles.

**Location:** Dependency Analysis and Execution Example sections
**Suggested fix:** Decide on one convention. Recommend: use plain text for story references in prose (Story 1.1) and inline code only when referencing data structures or code (`depends_on: [1.1]`).

## Pass 4: Diagram Conformance

### [MUST] Section: All diagram placeholders — Missing prose introduction before diagrams

Per diagram guide, every diagram must appear after prose that introduces the concept it illustrates, with the preceding paragraph referencing the diagram. The current placeholders are embedded in paragraphs without clear introduction.

**Location:** All diagram placeholder locations
**Suggested fix:** Add prose introduction before each diagram. Example for system-architecture:

Before:

```
The architectural boundary between Layer 2 and Layer 4 determines context isolation...

[DIAGRAM: system-architecture — ...]
```

After:

```
The architectural boundary between Layer 2 and Layer 4 determines context isolation. The orchestrator spawns `epic-reviewer` and `epic-fixer` as isolated subagents because the reviewer must not have access to implementation history. The orchestrator invokes `dev-story` in the same context because story implementation benefits from carrying forward epic-level knowledge. The following diagram shows how these layers interact.

_System architecture showing four horizontal layers with delegation and spawning patterns_
...
```

### [SHOULD] Section: "Architecture Layers" — Diagram type specification unclear

The placeholder description "Block diagram showing four horizontal layers" doesn't specify mermaid diagram type. Designer needs to know whether to use `flowchart TB`, `block-beta`, or C4 diagram with subgraphs.

**Location:** Architecture Layers diagram placeholder
**Suggested fix:** Specify diagram type in placeholder:

```markdown
[Diagram placeholder for Designer - Use block-beta or flowchart TB with subgraphs for layers. Show 4 horizontal layers as containers with component boxes inside. Arrows show delegation (Layer 1→2), on-demand loading (Layer 2→3), spawning with Task tool (Layer 2→4 for reviewer/fixer), and Skill invocation (Layer 2→4 for dev-story). Max 9 nodes total.]
```

### [SHOULD] Section: "Hook System Enforcement" — Diagram complexity may exceed limits

The hook lifecycle diagram description includes timeline, three phases, decision diamonds, labels for specific hooks at each phase, and flow connections. This risks exceeding the 9-node limit when fully diagrammed.

**Location:** Hook System Enforcement diagram placeholder
**Suggested fix:** Simplify diagram scope to focus on phases and one decision point, or note complexity constraint for Designer:

```markdown
[Diagram placeholder for Designer - flowchart LR showing hook firing sequence: Action Requested → PreToolUse Decision (block/allow) → Tool Execution → PostToolUse Auto-fix → Implementation Complete → Stop Verification. Use diamond for PreToolUse decision, rectangles for other phases. Annotate which hooks fire at PreToolUse vs PostToolUse vs Stop but don't show each hook as separate node. Target 7-8 nodes total.]
```

### [SHOULD] Section: "Execution Example" — Dependency graph diagram labels need clarification

The dependency-graph diagram description mentions "execution order annotations" and "checkpoint markers" but doesn't specify how these should render visually (text labels? colors? node styles?).

**Location:** Execution Example, dependency-graph diagram placeholder
**Suggested fix:** Clarify annotation style:

```markdown
[Diagram placeholder for Designer - Use flowchart or stateDiagram showing 4 nodes (Story 1.1, 1.2, 1.3, 1.4) with directed edges for dependencies. Add text labels like "[1]", "[2]", "[3]", "[4]" next to nodes for execution order. Add note "⚠ checkpoint" next to Stories 1.1, 1.2, 1.3. Do not use color to distinguish checkpoint vs non-checkpoint nodes — use text annotation only. Max 4 nodes + annotations.]
```

## Review Summary

| Severity | Count |
| -------- | ----- |
| MUST     | 4     |
| SHOULD   | 13    |
| MINOR    | 3     |

**Gate recommendation:** MUST-REVISE

The draft has strong technical content and good coverage of the Auto Epic system. However, it has four blocking issues that prevent it from passing the gate:

1. **Heading hierarchy violation** in Architecture Layers — uses bold text instead of H3 headings, breaking document navigation
2. **Diagram placeholder format violations** (all 6 diagrams) — uses non-standard inline bracket syntax instead of proper caption + placeholder format required by diagram guide
3. **Missing language tags** on code blocks in Execution Example — violates formatting MUST rule
4. **Missing prose introductions** for all diagrams — violates diagram integration MUST rule

The SHOULD items indicate structural improvements needed for progressive disclosure (reorder sections, add opening sentences, reduce repetition) and prose quality (remove synthetic patterns, tighten vague language, fix parallelism). The density of SHOULD items (13) relative to document length is moderate but manageable — most are localized fixes rather than wholesale rewrites.

After addressing MUST items and SHOULD items, the document will provide a solid technical deep-dive with clear progressive disclosure layers. The reader can stop after Overview (high-level understanding), Architecture Layers (component knowledge), Three-Phase Workflow + Execution Example (operational understanding), or continue into detail sections (Dependency Analysis, Review Loop, etc.) for implementation-level depth.

**Specific revision priorities:**

1. Convert Architecture Layers bold text to H3 headings
2. Reformat all 6 diagram placeholders per diagram guide format
3. Add language tags to Execution Example code blocks
4. Add prose introduction sentences before each diagram
5. Reorder sections to place Execution Example after Three-Phase Workflow
6. Add section opener to Three-Phase Workflow
7. Add Next Steps closing section
8. Address synthetic voice patterns (paired intensifiers, formulaic openers, over-explanation)
9. Fix list parallelism in Review Loop and Safety Invariants sections
10. Clarify diagram type specifications in placeholders for Designer

The Tech Writer should focus on MUST items first, then address SHOULD items during the same revision pass since many are quick fixes (reordering, adding sentences, removing redundant paragraphs).
