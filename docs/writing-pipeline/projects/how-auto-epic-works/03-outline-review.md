# Outline Review: How Auto Epic Works

## Review Context

**Reviewer:** Editor
**Review date:** 2026-02-09
**Outline artifact:** `02-outline.md`
**Target length:** 2,400+ words (from `00-request.md`)
**Outline budget:** ~3,400 words (+42% over target)

**Critical constraint:** The research file (`01-research.md`) is missing due to a pipeline-guard.cjs limitation. The Tech Writer documented research findings inline within the outline's "Research notes" sections. This review evaluates the outline's structural soundness, scope alignment, and length budget, acknowledging that research backing cannot be formally cross-referenced against a separate artifact.

---

## Review Items

### [MUST] Length Budget — Total exceeds target by 42%

Section budgets sum to ~3,400 words against a target of 2,400+ words (42% over). While the scope defined in `00-request.md` is comprehensive (four major areas with progressive depth), the current outline commits to word counts that guarantee the draft will exceed target from the start. Every revision round typically adds content, pushing the final document further over. The style guide allows up to 20% variance; 42% is double that tolerance.

**Location:** Length Budget summary table
**Suggested fix:** Apply the outline's own Option 2 recommendation: reduce "Command Flow and Phases" depth by moving algorithmic details (topological sort algorithm, 7-case resume matrix internals, coverage parsing specifics) from inline prose to callouts or condensed bullet lists. Target ~600 words for this section instead of ~800 (saves 200 words). Additionally, merge "Safety Architecture" into "Architecture Layers" as a deep-dive on Layer 3 (Hook System) and Layer 2 (Workflow Invariants), eliminating section overhead and reducing redundancy (saves ~100 words). Tighten "Subagent Orchestration" by removing duplicated secrets-checking details already covered in Safety Architecture (saves ~50 words). This brings total to ~2,850 words (19% over target), within the 20% tolerance.

---

### [SHOULD] Section: "Overview" — Missing diagram suggestion reference

The Overview section is planned to cover what Auto Epic does, key benefits, use cases, and safety invariants. However, the Diagram Suggestions section proposes six diagrams, none of which are explicitly tied to the Overview. The "System Architecture" diagram (Diagram 1) is positioned "immediately after the 'Architecture Layers' section opener." For a complex system like Auto Epic, readers benefit from seeing a high-level visual even before diving into architectural layers.

**Location:** Overview section outline entry, Diagram Suggestions section
**Suggested fix:** Either add a simplified "What Auto Epic Does" diagram to the Overview (showing User → Auto Epic → Stories → PRs at a very high level, 4-5 nodes max), or explicitly note in the Overview section plan that readers can reference Diagram 1 (System Architecture) early if they prefer visual grounding. Alternatively, accept that the Overview is purely prose and reserve all diagrams for later sections. The current plan is silent on this, which may lead to a diagram-free opening that feels text-heavy for a visual audience.

---

### [SHOULD] Section: "Command Flow and Phases" — Budget implausible for stated depth

This section is allocated 800 words and covers Phase 1 (6 steps), Phase 2 (7 substeps with detailed protocol for each), and Phase 3 (4 outputs). The key points list contains 15 bullets, many of which are multi-sentence explanations (e.g., dependency analysis with Kahn's algorithm, 7-case resume matrix, review loop convergence, integration checkpoint classification). At 800 words, that is ~53 words per bullet point average. Given the technical density and the progressive disclosure promise ("Deep readers get the algorithmic details"), 800 words is under-budgeted.

The outline acknowledges this tension in the Length Budget note and recommends "reduce Command Flow depth" as Option 2. However, the 800-word budget and the stated coverage (algorithmic details, 7-case matrix, etc.) are contradictory.

**Location:** "Command Flow and Phases" section outline entry
**Suggested fix:** Commit to the reduced depth now in the outline itself. Revise the key points to remove or condense algorithmic details (e.g., "Dependency analysis applies topological sort to determine execution order" instead of "Dependency analysis parses YAML frontmatter with regex prose fallback, builds adjacency list, computes inverse graph..."). Move the 7-case resume matrix details to the "State Management and Resume" section where they logically belong. Reduce the budget to ~600 words with the understanding that Phase 1, Phase 2, and Phase 3 are covered at a higher level, with pointers to later sections for protocol details. This aligns budget with coverage and prevents the Tech Writer from either blowing the budget or producing shallow treatment of complex topics.

---

### [SHOULD] Section: "Safety Architecture" — Redundant with "Architecture Layers"

The "Architecture Layers" section already introduces Layer 3 (Hook System) and lists the eight hooks. The "Safety Architecture" section then re-introduces hooks as Layer 1 of the safety architecture and provides detailed descriptions of bash-guard.js, tdd-guard.js, architecture-guard.sh, import-guard.sh, auto-format.sh, and type-check.sh. This creates overlap: readers will encounter hooks twice, first as a layer in the architecture, then as a safety mechanism.

While the perspectives differ (architectural boundary vs. safety enforcement), the content overlap (hook names, lifecycle points, what they block) will feel redundant. The outline's Length Budget note suggests merging these sections as Option 1, which aligns with reducing this redundancy.

**Location:** "Safety Architecture" section outline entry and "Architecture Layers" Layer 3 description
**Suggested fix:** Merge "Safety Architecture" into "Architecture Layers" as an H3 subsection titled "Layer 3: Hook System and Safety Enforcement." Cover hooks once with both the architectural boundary perspective (when they intercept, what lifecycle points exist) and the safety enforcement details (specific patterns blocked, tiered safety levels, self-correcting errors). This eliminates the standalone "Safety Architecture" section, reduces the section count from 8 to 7, and cuts ~100 words of overhead (section opener, progressive disclosure duplication). Workflow invariants and human checkpoints can remain as separate H3 subsections within "Architecture Layers" or be moved to "Command Flow and Phases" where checkpoints are encountered during execution.

---

### [SHOULD] Section: "Subagent Orchestration" — Secrets-checking detail duplicated

The "Subagent Orchestration" section includes a detailed bullet point on what the reviewer must check for hardcoded secrets: "AWS account IDs (12-digit numbers), access keys (AKIA pattern), resource IDs (vpc-_, subnet-_, sg-_, etc.), API keys (sk*live*_, pk*live*\*, etc.), private key material, connection strings (mongodb://, postgres://, redis://)." This exact list also appears as a key point in the "Command Flow and Phases" section: "secrets scan gate checks for AWS credentials, API keys, private keys before review."

Additionally, the outline notes that "Secrets checking requirements are identical for both agents" (reviewer and fixer), but then lists the reviewer's specific checks without noting the fixer's parallel responsibility in the same detail.

**Location:** "Subagent Orchestration" key points and "Command Flow and Phases" key points
**Suggested fix:** Remove the detailed secrets pattern list from "Subagent Orchestration." State that the reviewer performs secrets validation and reference the "Safety Architecture" (or merged "Architecture Layers" Layer 3 section) for the specific patterns checked. This avoids duplication and keeps the secrets enforcement details in one canonical location. If secrets checking is a gate enforced by hooks (which the outline suggests), then the hook system description is the right place for the pattern list, not the subagent orchestration description.

---

### [SHOULD] Section: "State Management and Resume" — 7-case matrix detail belongs here, not in Command Flow

The "Command Flow and Phases" section includes a detailed bullet on the 7-case resume matrix: "(1) done + PR merged → skip, (2) done + PR closed → keep done, (3) in-progress + PR exists → resume from post-commit..." This is 80+ words within an already over-budgeted section. The "State Management and Resume" section also covers the 7-case matrix but from a different angle (reconciliation logic).

The outline's structure promises progressive depth: readers who stop after "Command Flow and Phases" should understand the complete execution path, while "State Management and Resume" provides the reference detail for one specific mechanism (state persistence and resume). Repeating the 7-case matrix in both places violates the "each thing once" principle.

**Location:** "Command Flow and Phases" key points and "State Management and Resume" key points
**Suggested fix:** In "Command Flow and Phases," replace the detailed 7-case enumeration with a single sentence: "Resume reconciles state file status with GitHub reality using a 7-case decision matrix (see State Management and Resume section for details)." Keep the full 7-case matrix in "State Management and Resume" where readers seeking that level of detail will find it. This saves ~60 words in the over-budgeted Command Flow section and eliminates redundancy.

---

### [SHOULD] Section: "Integration with BMAD Method" — Weak connection to reader task flow

The section plan covers upstream artifacts (epic files, story files, PRD/Architecture docs) and downstream artifacts (PRs, completion reports, state files). However, the reader's task flow for understanding "How Auto Epic Works" does not naturally include "how does this fit into BMAD?" until after they understand the system's internal mechanics. The section feels appended rather than integrated.

The scope in `00-request.md` does not explicitly require BMAD integration coverage. The closest match is "Integration points with broader BMAD system" under "Component Deep-Dives," which suggests this is reference material, not core narrative. Placing it as Section 7 (before Quick Reference) positions it as if it is equally important to the three-phase flow and safety architecture, which may not match reader priorities.

**Location:** "Integration with BMAD Method" section placement
**Suggested fix:** Either move this section to the end after "Quick Reference" as an optional "Further Context" or "System Context" section, or fold the key upstream/downstream artifact details into the "Command Flow and Phases" Phase 1 (loading epic/story files) and Phase 3 (producing completion reports). The latter approach integrates BMAD artifacts into the execution flow where they naturally appear, eliminating the need for a standalone section and saving ~250 words. If preserving the section, add a sentence to the section opener explicitly stating why a reader learning "how Auto Epic works" needs to understand BMAD integration (e.g., "Understanding Auto Epic's inputs and outputs clarifies its role in the end-to-end development workflow").

---

### [SHOULD] Diagram 2: Command Flow Sequence — Participant count at limit

The "Command Flow Sequence" diagram proposes seven participants: User, Command, Orchestrator, StoryRunner, Subagents (epic-reviewer, epic-fixer), Hooks, GitHub. The diagram guide specifies a maximum of 5 participants for sequence diagrams to maintain readability. Seven participants will produce a dense, hard-to-scan diagram.

**Location:** Diagram Suggestions, Diagram 2
**Suggested fix:** Consolidate participants to stay within the 5-participant limit. Merge "Command" into "Orchestrator" (the command is a thin delegation layer; showing it as a separate participant adds no insight). Merge "Subagents" into a single participant (the diagram can label individual messages as "spawn epic-reviewer" or "spawn epic-fixer" without needing separate swimlanes). This reduces the count to 5: User, Orchestrator, StoryRunner, Hooks, GitHub. If Hooks intercept but do not respond (they allow/block), consider whether Hooks need a swimlane or can be shown as annotations on the arrows from Orchestrator.

---

### [SHOULD] Diagram 3: Hook Lifecycle — Node count exceeds limit

The "Hook Lifecycle" diagram proposes 16+ nodes: Start, five PreToolUse hook actions (bash-guard, file-guard, tdd-guard, architecture-guard, import-guard), decision ("Any hook blocks?"), two end states (blocked/success), tool execution, two PostToolUse hook actions (auto-format, type-check), another end state, agent completion branch, Stop hook action, another decision ("All gates pass?"), two more end states. The diagram guide specifies a maximum of 9 nodes per diagram.

**Location:** Diagram Suggestions, Diagram 3
**Suggested fix:** Decompose into two diagrams: (1) "PreToolUse Hook Enforcement" showing the gate logic (Start → PreToolUse checks → Any block? → Denied/Tool executes), treating the five PreToolUse hooks as a single "PreToolUse Checks" node with a note listing which hooks run, and (2) "PostToolUse and Stop Hooks" showing tool execution → PostToolUse auto-corrections → Stop validation at completion. Alternatively, simplify Diagram 3 to show only the three lifecycle points (PreToolUse gate, PostToolUse auto-fix, Stop validation) without enumerating every individual hook, and rely on prose to list which hooks run at each point.

---

### [SHOULD] Diagram 5: State File Resume Reconciliation — Duplicates prose detail

The "State File Resume Reconciliation" diagram proposes a decision tree for the 7-case matrix. The "State Management and Resume" section already covers this matrix in prose with the same level of detail. The diagram guide states: "Do not include a diagram when the concept can be explained clearly in 2-3 sentences of prose. A diagram that restates what the text already says without adding spatial or relational clarity is noise."

The 7-case matrix is inherently a nested conditional, which does benefit from a decision tree. However, the proposed diagram node labels are prose sentences ("State file status = done?" → "PR merged?" → "Skip story (already complete)"). This is a transcription of the prose into boxes, not a spatial insight.

**Location:** Diagram Suggestions, Diagram 5
**Suggested fix:** Either simplify the diagram to show only the three primary branches (done, in-progress, pending) with high-level outcomes, leaving the sub-case details to prose, or enhance the diagram to show why the cases matter (e.g., annotate edges with "state file wins" vs. "GitHub wins" to highlight the reconciliation policy). If the diagram ends up being a 1:1 mapping of the prose bullet list, consider whether it is worth including. A table may be more effective than a decision tree for this reference material.

---

### [MINOR] Section: "Quick Reference" — Flat structure appropriate for reference

The outline notes: "This is a terminal section with no deeper layers - it's already at maximum density for quick reference. All readers get the same flat information regardless of reading depth." This correctly identifies that reference sections do not need progressive disclosure. However, the section is budgeted at ~300 words for command syntax, file locations, safety invariants list, human checkpoints table, and common flags. That is five distinct reference artifacts in 300 words (~60 words each on average).

**Location:** "Quick Reference" section outline entry
**Suggested fix (optional):** Consider whether all five reference artifacts fit comfortably in 300 words, or whether the budget should increase slightly (~350 words) to allow for readable formatting (tables, code blocks). Alternatively, prioritize the most commonly needed references (command syntax, human checkpoints) and move the file locations table to an appendix or inline into the "Architecture Layers" section where each component is introduced. This is a minor optimization; the current plan is functional.

---

### [MINOR] Progressive Disclosure — Inconsistent phrasing across sections

Most sections follow the pattern "Skimmers learn X. Readers understand Y. Deep readers get Z." However, some sections vary the phrasing: "Overview" uses "Skimmers learn... Readers get... Deep readers will find..." and "Integration with BMAD Method" uses "Skimmers learn... Readers understand... Deep readers get..." These are minor stylistic inconsistencies.

**Location:** Progressive disclosure notes across all sections
**Suggested fix (optional):** Standardize the phrasing pattern for consistency. Suggested form: "Skimmers learn [high-level takeaway]. Readers understand [complete working knowledge]. Deep readers get [reference details or edge cases]." This is purely cosmetic and does not affect the structural plan, but consistency helps the Tech Writer calibrate depth across sections.

---

## Review Summary

| Severity | Count |
| -------- | ----- |
| MUST     | 1     |
| SHOULD   | 8     |
| MINOR    | 2     |

**Length budget:** Total budget ~3,400 words | Target 2,400+ words | Variance +42%

**Gate recommendation:** MUST-REVISE

---

## Overall Assessment

The outline demonstrates strong research grounding (despite the missing `01-research.md` artifact, the inline research notes cite specific source files and line numbers), comprehensive scope coverage, and thoughtful progressive disclosure planning. The section structure follows a logical flow from high-level overview through architectural layers, detailed execution flow, and reference material. The diagram suggestions are well-chosen and serve the narrative effectively (System Architecture, Command Flow Sequence, Hook Lifecycle, Review Loop Protocol, Integration Checkpoint are all high-value visuals).

However, the outline commits to a 3,400-word budget against a 2,400-word target (+42% over), which is double the 20% tolerance allowed by the style guide. This variance is acknowledged in the outline's own "Length tension note," which proposes four options to address it. The outline must revise to commit to one of these options (preferably Option 2: reduce Command Flow depth, combined with section consolidation) and adjust budgets accordingly before drafting begins.

Additionally, the outline exhibits content overlap in three areas:

1. **Hook System coverage** appears in both "Architecture Layers" (Layer 3) and "Safety Architecture" (Layer 1), creating redundancy that inflates the word count and risks reader fatigue.
2. **7-case resume matrix** appears in both "Command Flow and Phases" and "State Management and Resume," violating the "say each thing once" principle.
3. **Secrets-checking patterns** appear in both "Command Flow and Phases" and "Subagent Orchestration," duplicating detail that belongs in the safety/hook enforcement section.

Consolidating these overlaps (as suggested in SHOULD items above) can reduce the total budget by ~300-400 words, bringing the outline closer to the 2,600-2,800 word range (8-17% over target), which is acceptable given the scope's inherent complexity.

The diagram suggestions are ambitious (6 diagrams) and some exceed the diagram guide's node/participant limits (Diagram 2 at 7 participants, Diagram 3 at 16+ nodes). These will require simplification or decomposition during the design phase to meet the guide's readability constraints.

**Key themes in findings:**

- Length overcommitment is the blocking issue (MUST)
- Content redundancy across sections inflates word count unnecessarily (3 SHOULD items)
- Diagram complexity needs simplification to meet guide limits (3 SHOULD items)
- Section consolidation opportunities exist (merge Safety Architecture into Architecture Layers, fold BMAD artifacts into Command Flow)

**Recommendation:** Revise the outline to commit to Option 2 (reduce Command Flow depth) + selective consolidation (merge Safety Architecture, remove redundant matrix/secrets details). Reduce total budget to ~2,800 words (17% over). Simplify Diagram 2 (consolidate participants to 5) and Diagram 3 (decompose or abstract to 9 nodes). Address these structural adjustments before proceeding to Draft v1.

The structural plan is sound; the scope is well-aligned with `00-request.md`; the progressive disclosure strategy is clear. The revision required is primarily budget reduction and redundancy elimination, not a fundamental rethink of the approach.
