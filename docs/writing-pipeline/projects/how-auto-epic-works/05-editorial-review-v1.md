# Editorial Review v1: How Auto Epic Command Works

## Reorganization Map

Apply these structural changes before addressing per-pass findings below.

| #   | Current Section / Location          | Action   | Target                                      | Rationale                                                                                        |
| --- | ----------------------------------- | -------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| 1   | "Safety Invariants" (Overview ¶4)   | MERGE    | → "Architecture Layers" Layer 3             | Safety invariants are hook enforcement details; belong with hook system, not strategic overview  |
| 2   | "Human Checkpoints" (Overview ¶5)   | MERGE    | → "Architecture Layers" Layer 3             | Checkpoint mechanism is orchestrator/hook detail; belongs with workflow enforcement              |
| 3   | "Workflow Invariants" (Layer 3)     | CUT      | Move unique content to Safety Invariants ¶4 | 8/9 invariants duplicate Overview ¶4; consolidate into single authoritative list                 |
| 4   | "Human Checkpoints" (Layer 3)       | CUT      | —                                           | Duplicates Overview ¶5 verbatim                                                                  |
| 5   | "State File Format" (State Mgmt §1) | CONDENSE | —                                           | 150 words → ~80 words (remove embedded examples already in next section)                         |
| 6   | "Dependency Completion Policy" (§4) | MERGE    | → "Command Flow" Phase 2.1                  | Policy is Phase 2.1 execution detail; duplicates with incremental detail                         |
| 7   | "Quick Reference" section           | CONDENSE | —                                           | Tables duplicate prior content; consolidate to half size (250 words → ~125 words)                |
| 8   | "Diagram Suggestions" section       | CUT      | —                                           | Designer instructions, not reader content (pipeline artifact must be removed before publication) |

**After reorganization:** Document should have 7 H2 sections (down from 9).

**Estimated reduction:** ~900 words (31% of current draft, bringing it to target length of 2,400 words)

---

## Structural Issues

### [MUST] CUT Section: "Workflow Invariants" — Duplicates Overview ¶4 Safety Invariants

This subsection in Layer 3 lists nine workflow invariants, eight of which duplicate the nine safety invariants listed in Overview ¶4. The duplication is nearly verbatim:

- Overview ¶4: "never auto-merge PRs (human review required)"
- Layer 3: "Never auto-merge PRs (human review required)"

The only unique content is one sentence: "Nine invariants enforced by orchestrator control flow (not configuration)." This distinction (control flow vs. configuration enforcement) adds clarity but does not justify repeating the entire list.

**Location:** "Architecture Layers" → Layer 3 → "Workflow Invariants" subsection (lines 61-72)

**Suggested fix:** Delete the "Workflow Invariants" subsection. Move the sentence "Nine invariants enforced by orchestrator control flow (not configuration)" to Overview ¶4, before the safety invariants list, to clarify enforcement mechanism.

---

### [MUST] CUT Section: "Human Checkpoints" (Layer 3) — Duplicates Overview ¶5

Layer 3 contains a "Human Checkpoints" subsection that restates the four checkpoints already listed in Overview ¶5. The location references differ slightly (Layer 3 omits the `.claude/skills/epic-orchestrator/SKILL.md:12-24` citation), but the content is otherwise identical.

**Location:** "Architecture Layers" → Layer 3 → "Human Checkpoints" subsection (lines 73-80)

**Suggested fix:** Delete the "Human Checkpoints" subsection from Layer 3. The reader already encountered this list in Overview ¶5. If the section needs a reference to checkpoints in context, add: "The four human checkpoints (described in Overview) integrate with hook enforcement at strategic workflow milestones."

---

### [SHOULD] MERGE Section: "Dependency Completion Policy" — Overlaps with Phase 2.1

"State Management and Resume" contains a "Dependency Completion Policy" subsection (lines 191-198) that explains when story dependencies are considered complete. This policy is also explained in "Command Flow and Phases" → Phase 2 → Step 2.1 "Pre-implementation dependency check" (lines 110-111).

Phase 2.1 states: "Stories with dependents require PR merged OR commit reachable from base via `git merge-base --is-ancestor`. Leaf stories only need open PR with passing tests."

The standalone subsection adds rationale ("downstream stories need code on base branch to build correctly") and the `--no-require-merged` override flag. These details belong in Phase 2.1, not in a separate section that forces the reader to encounter the policy twice.

**Location:** "State Management and Resume" → "Dependency Completion Policy" subsection (lines 191-198)

**Suggested fix:** Move the rationale sentences and override flag description to "Command Flow and Phases" → Phase 2.1 as a Note callout or additional paragraph. Delete the standalone "Dependency Completion Policy" subsection.

---

### [SHOULD] MERGE Section: "Safety Invariants" — Move to Layer 3 Hook System

Overview ¶4 lists nine safety invariants. These invariants describe hook enforcement and workflow controls, not strategic goals. The Overview section should answer "what does Auto Epic do and why use it?" at a high level. Technical enforcement mechanisms belong in the Architecture Layers section with the hook system.

**Location:** Overview section, paragraph 4 (lines 9)

**Suggested fix:** Move the safety invariants list to "Architecture Layers" → Layer 3 → "Hook System and Safety Enforcement" as a subsection after the hook descriptions. Retain only the high-level benefit in Overview: "Safety by design (hooks enforce architectural rules, workflow invariants prevent destructive operations)."

---

### [SHOULD] MERGE Section: "Human Checkpoints" — Move to Layer 3 Workflow

Overview ¶5 lists four human checkpoints with file locations. Like the safety invariants, these are architectural details, not strategic overview content. The checkpoint mechanism is part of the orchestrator's control flow and belongs with the workflow description.

**Location:** Overview section, paragraph 5 (lines 13)

**Suggested fix:** Move the human checkpoints list to "Architecture Layers" → Layer 3 after the hook system subsections. Replace Overview ¶5 with a single sentence: "Human checkpoints appear at four strategic points: scope confirmation before implementation begins, per-story completion decisions, integration validation for stories with dependents, and epic completion review."

---

### [SHOULD] Section: "Architecture Layers" — Flat subsections should use heading hierarchy

Layer 3 "Hook System and Safety Enforcement" contains five subsections marked with bold text ("PreToolUse hooks", "PostToolUse hooks", "Stop hook", "Workflow Invariants", "Human Checkpoints") rather than H3 headings. This breaks the document's heading hierarchy and makes the section structure invisible to readers skimming headings.

**Location:** "Architecture Layers" → Layer 3 (lines 39-80)

**Suggested fix:** Convert bold subsection markers to H3 headings:

- `### PreToolUse hooks (gate enforcement)`
- `### PostToolUse hooks (auto-correction)`
- `### Stop hook (quality validation)`

After applying Reorganization Map items #3 and #4, the "Workflow Invariants" and "Human Checkpoints" subsections will be removed, resolving the hierarchy issue for those.

---

### [SHOULD] Section: "Command Flow and Phases" — Phase 2 step ordering buries critical detail

Phase 2 describes seven substeps per story. Step 2.1 "Pre-implementation dependency check" is critical for understanding when stories can execute, but it appears after the reader has already read about "Hook-protected implementation" (2.2). Dependency checks gate whether implementation begins — they should precede the implementation description.

However, the current ordering (2.1 before 2.2) is technically correct. The issue is prose emphasis: Step 2.1 receives only two sentences, while Step 2.2 receives a full paragraph with subsections. This creates the impression that dependency checking is less important than implementation mechanics.

**Location:** "Command Flow and Phases" → Phase 2 (lines 108-116)

**Suggested fix:** Expand Step 2.1 into a full paragraph explaining the policy (stories with dependents require merged PRs, leaf stories need open PRs) and the verification mechanism (`git merge-base --is-ancestor`). Move the dependency policy details from "State Management and Resume" → "Dependency Completion Policy" here (see Reorganization Map #6).

---

## Prose Quality

### [SHOULD] CONDENSE Section: "Overview" ¶2 — Key benefits list inflated

Paragraph 2 lists five key benefits in a 90-word sentence with nested parenthetical clauses. The information density is low — the parenthetical descriptions mostly restate the benefit names.

Example: "autonomous supervised execution (agent implements stories without constant oversight)" — the phrase "without constant oversight" is synonymous with "autonomous supervised."

**Location:** Overview section, paragraph 2 (lines 7)

**Suggested fix:** Reduce to ~50 words by removing redundant parentheticals:

"Key benefits include autonomous supervised execution, quality convergence through adversarial review (fresh-context reviewer finds issues the implementer missed), dependency-aware execution (topological sort ensures prerequisites complete first), resumability, and safety by design."

---

### [SHOULD] CONDENSE Section: "Overview" ¶3 — When to use guidance verbose

Paragraph 3 explains when to use Auto Epic vs. alternatives in 80 words with three distinct tool comparisons. The core decision is simpler than the prose suggests.

**Location:** Overview section, paragraph 3 (lines 11)

**Suggested fix:** Reduce to ~40 words:

"Use Auto Epic for implementing entire epics (5-15 stories) with defined dependencies. Use `/bmad-bmm-dev-story` for single stories. Use `/bmad-bmm-code-review` for one-shot reviews without epic orchestration."

---

### [SHOULD] CONDENSE Section: "State Management and Resume" ¶1 "State File Format" — Over-explains format

This subsection uses 150 words to describe the state file format. The key information is: location, structure (YAML frontmatter + markdown table), and seven status values. The paragraph includes explanatory phrases that restate what "primary source of truth" and "secondary display" already convey.

**Location:** "State Management and Resume" → "State File Format" (lines 164-170)

**Suggested fix:** Reduce to ~80 words by removing redundant explanations:

"Location: `docs/progress/epic-{id}-auto-run.md`

Structure: YAML frontmatter (machine-readable source of truth) + regenerated markdown table (human-readable display). Seven story statuses: pending, in-progress, review, done, blocked, paused, skipped.

Status transitions use `updateStoryStatus()` which updates the state file then syncs to GitHub issue labels. Conflicts favor the state file."

---

### [SHOULD] CONDENSE Section: "Quick Reference" — Tables duplicate prior content

The Quick Reference section contains five tables totaling ~250 words. Most table content directly duplicates earlier sections:

- "Command Syntax" duplicates examples from Phase 1 descriptions
- "File Locations" lists paths already cited inline throughout the document
- "Safety Invariants" duplicates Overview ¶4 (third occurrence)
- "Human Checkpoints" duplicates Overview ¶5 (third occurrence)
- "Common Flags" duplicates command syntax examples

Quick reference sections serve readers who want condensed lookup information. These tables provide that, but the duplication density is high.

**Location:** "Quick Reference" section (lines 209-276)

**Suggested fix:** Consolidate to three tables (~125 words total):

1. Command Syntax (keep as-is, this is the most useful reference)
2. Key File Paths (reduce to 5 most critical paths: command, orchestrator, agents, state file, hooks directory)
3. Flags (keep as-is)

Delete the "Safety Invariants" and "Human Checkpoints" tables — these are strategic concepts, not quick lookup data. Delete the full "File Locations" table — replace with abbreviated version.

---

### [SHOULD] Section: "Overview" ¶1 — Verb choice "invoke" less direct than standard

Line 5: "You invoke Auto Epic to autonomously implement entire epics" uses "invoke" where documentation typically uses "run" or "use." "Invoke" is correct but slightly formal for CLI tool documentation.

Per style guide preference for direct language, "run" is the standard verb for CLI commands.

**Location:** Overview section, paragraph 1, line 5

**Suggested fix:** "You run Auto Epic to autonomously implement entire epics with code review loops and human checkpoints."

---

### [SHOULD] Section: "Architecture Layers" Layer 2 — Phrase "decompose into" is passive framing

Line 25: "The orchestrator at `.claude/skills/epic-orchestrator/` decomposes into six modules" uses passive framing. The orchestrator does not decompose itself — it is structured as six modules.

**Location:** "Architecture Layers" → Layer 2, paragraph 1

**Suggested fix:** "The orchestrator at `.claude/skills/epic-orchestrator/` consists of six modules loaded on-demand to prevent context bloat."

---

### [SHOULD] Section: "Architecture Layers" Layer 3 — Synthetic pattern "self-correcting"

Line 57: "Hooks are self-correcting: error messages explain violations and suggest correct approaches." The phrase "self-correcting" is marketing language that overstates mechanism. Hooks do not correct code — they block operations and return error messages that the agent must interpret and respond to.

**Location:** "Architecture Layers" → Layer 3, paragraph after Stop hook description

**Suggested fix:** "Hooks block invalid operations and return error messages that explain violations and suggest correct approaches. The agent reads the error and adjusts."

---

### [SHOULD] Section: "Command Flow and Phases" Phase 1.3 — Parenthetical aside interrupts flow

Line 101: "Apply topological sort to determine execution order. Detect cycles (fatal error)" has a parenthetical that interrupts the procedure description. The severity of cycle detection is important but does not need parenthetical treatment.

**Location:** "Command Flow and Phases" → Phase 1 → Step 1.3

**Suggested fix:** "Apply topological sort to determine execution order. Cycle detection terminates with a fatal error."

---

### [SHOULD] Section: "Subagent Orchestration" ¶1 "Reviewer Spawning" — Paragraph restates section opener

The "Reviewer Spawning and Protocol" subsection opens with: "The orchestrator spawns epic-reviewer via Task tool with context: story ID, branch name, base branch, story file path, review round number, output path for findings document."

The section opener ("You spawn two subagent types...") already introduced that reviewers spawn via Task tool with fresh context. This sentence adds the specific context parameters, but the spawning mechanism itself is redundant.

**Location:** "Subagent Orchestration" → "Reviewer Spawning and Protocol" (lines 133)

**Suggested fix:** Start the subsection directly with context parameters: "Context parameters passed to epic-reviewer: story ID, branch name, base branch, story file path, review round number, output path for findings document."

---

### [SHOULD] Section: "State Management and Resume" ¶3 "Resume Reconciliation" — Numbered list could be table

The 7-case decision matrix (lines 179-187) uses a numbered list with case descriptions in the format "status + GitHub state: action." This format works but is harder to scan than a table with columns for state file status, GitHub state, and action.

**Location:** "State Management and Resume" → "Resume Reconciliation" (lines 179-187)

**Suggested fix:** Convert to a table:

| State File Status | GitHub State   | Action                      |
| ----------------- | -------------- | --------------------------- |
| done              | PR merged      | Skip (already complete)     |
| done              | PR closed      | Keep done (state file wins) |
| in-progress       | PR exists      | Resume from finalization    |
| in-progress       | Branch deleted | Mark blocked (no recovery)  |
| in-progress       | No PR/branch   | Reset to pending            |
| pending           | PR exists      | Treat as review (manual PR) |
| pending           | Branch exists  | Check out branch, resume    |

---

### [MINOR] Section: "Overview" ¶2 — Word choice "genuinely" is filler

Line 7: "genuinely adversarial review" — the adverb "genuinely" adds emphasis but no information. "Adversarial review" already conveys the concept; "genuinely" is defensive qualification.

**Location:** Overview section, paragraph 2

**Suggested fix:** "quality convergence through adversarial review (fresh-context reviewer finds issues the implementer missed)"

---

### [MINOR] Section: "Architecture Layers" Layer 2 — Repeated file extension in citation

Line 27: "`.claude/skills/epic-orchestrator/`" ends with a trailing slash, which is inconsistent with inline code path conventions elsewhere in the document (most paths omit trailing directory slashes).

**Location:** "Architecture Layers" → Layer 2, paragraph 1

**Suggested fix:** "The orchestrator at `.claude/skills/epic-orchestrator` consists of..."

---

### [MINOR] Section: "Command Flow and Phases" Phase 1.1 — Inconsistent path format

Line 99: "`_bmad-output/planning-artifacts/epics/epic-{id}.md`" uses a leading underscore, which is correct for the codebase path. However, other paths in the document use relative forms without leading underscores. Verify consistency across all path citations.

**Location:** "Command Flow and Phases" → Phase 1 → Step 1.1

**Suggested fix:** Verify that all paths match their actual codebase locations. If `_bmad-output` is correct, ensure all other paths starting with underscores are similarly formatted. If relative paths are preferred, adjust accordingly.

---

## Formatting and Mechanics

### [MUST] Section: "Diagram Suggestions" — Pipeline artifact must be removed

The "Diagram Suggestions" section (lines 277-398) is Designer instructions, not reader-facing content. Per the Editor agent definition (Task D, final review rules), pipeline scaffolding like "Diagram Suggestions" sections must be removed before publication.

This section should not exist in a published document. It exists here because this is Draft v1, and the Designer has not yet created diagrams. However, it should be flagged now for removal in the final review.

**Location:** "Diagram Suggestions" section (lines 277-398)

**Suggested fix:** This section will be removed during the final review (Step 12). Flag for tracking: "Remove 'Diagram Suggestions' section before publication — this is Designer instructions, not reader content."

---

### [SHOULD] Inline code: "touches" field inconsistently formatted

Line 79 references the `touches` field in a dependency policy explanation, but the field name is not consistently in inline code format. Earlier references to fields (like `stateFile.stories[story.id].commit` on line 202) use inline code.

**Location:** "Architecture Layers" → Layer 3 → "Integration Checkpoint" (line 79), and "State Management and Resume" → "Commit SHA Tracking" (line 202)

**Suggested fix:** Ensure all field names, object keys, and data structure references use inline code: "the `touches` field is developer-declared guidance"

---

### [SHOULD] Inline code: CLI flag formatting inconsistent

The document references flags in multiple formats:

- With inline code: `` `--resume` `` (line 104)
- Without inline code: "--stories" in table headers (line 269)

Per style guide [MUST]: "CLI commands, subcommands, and flags in inline code."

**Location:** "Quick Reference" → "Common Flags" table (lines 267-275)

**Suggested fix:** Ensure all flag references use inline code in table cells: `` `--stories` ``, `` `--resume` ``, `` `--dry-run` ``, `` `--epic-path` ``, `` `--no-require-merged` ``

---

### [SHOULD] Callout usage: Warning for fatal error underutilized

Line 101 mentions "fatal error" for cycle detection in parenthetical format. A fatal error that terminates the workflow is harm-avoidance (blocks task completion). Per style guide, this warrants a Warning callout, not inline parenthetical.

**Location:** "Command Flow and Phases" → Phase 1 → Step 1.3 (line 101)

**Suggested fix:** Replace the parenthetical with a Warning callout after the topological sort description:

> **Warning:** Cycle detection terminates the workflow with a fatal error. Ensure story dependencies form a directed acyclic graph before running Auto Epic.

---

### [MINOR] Heading capitalization: "Layer 3" descriptor uses mixed case

Section heading "Hook System and Safety Enforcement" follows sentence case correctly, but the layer descriptors ("Layer 1: Command Entry Point") use title case for the descriptor phrase. This is inconsistent with the section heading convention.

**Location:** "Architecture Layers" section, subheadings (lines 19-82)

**Suggested fix:** Use sentence case throughout: "Layer 1: Command entry point", "Layer 2: Orchestrator skill", "Layer 3: Hook system and safety enforcement", "Layer 4: Subagents"

---

### [MINOR] List formatting: Phase 1 and Phase 2 step lists inconsistent

Phase 1 steps (lines 97-105) use a numbered list format with bold step names and inline descriptions. Phase 2 steps (lines 107-116) use the same format. However, Phase 3 steps (lines 119-124) drop the bold formatting and use plain numbered list items. This inconsistency weakens visual structure.

**Location:** "Command Flow and Phases" → Phase 3 (lines 119-124)

**Suggested fix:** Apply consistent formatting to Phase 3 steps — use bold for step names like Phase 1 and Phase 2.

---

## Diagram Conformance

### [SHOULD] Diagram 1: Node count exceeds limit

The "System Architecture" diagram proposal (lines 280-302) describes:

- 1 Command Entry Point block
- 6 module boxes within Orchestrator Skill block
- 8 hook boxes within Hook System block
- 2 agent boxes within Subagents block

Total: 17 nodes (1 + 6 + 8 + 2). This exceeds the 9-node limit from `diagram-guide.md` [MUST].

**Location:** "Diagram Suggestions" → Diagram 1 (lines 280-302)

**Suggested fix:** Decompose into two diagrams:

1. **Overview diagram (5 nodes):** Four layer blocks (Command, Orchestrator, Hook System, Subagents) + one external GitHub block showing orchestrator-GitHub interaction
2. **Detail diagram (7 nodes):** Hook System detail showing the eight hooks grouped by lifecycle point: PreToolUse group (5 hooks), PostToolUse group (2 hooks), Stop hook (1)

---

### [SHOULD] Diagram 2: Participant count at upper limit

The "Command Flow Sequence" diagram (lines 304-329) proposes 5 participants: User, Orchestrator, StoryRunner, Subagents, GitHub. This is at the maximum for sequence diagrams per `diagram-guide.md` (5 participants max).

The proposal merges "Command" into "Orchestrator," which is good. However, StoryRunner is an internal orchestrator component, not an external participant. Showing it as a separate participant overstates its architectural significance — it is a strategy pattern implementation (GitHubCLIRunner vs. DryRunStoryRunner), not a distinct service.

**Location:** "Diagram Suggestions" → Diagram 2 (lines 304-329)

**Suggested fix:** Reduce to 4 participants: User, Orchestrator, Subagents, GitHub. StoryRunner is internal orchestrator state; do not show it as a separate participant. Label orchestrator messages differently based on mode: "create branch (via GitHub CLI)" vs. "create branch (dry-run)."

---

### [SHOULD] Diagram 4: State diagram node count at limit

The "Review Loop State Machine" diagram (lines 353-379) proposes 8 states. This is within the 9-node limit but has no decomposition room if the design needs adjustment during diagram creation. State diagrams at the upper limit often benefit from grouping.

The diagram conflates actions (spawn reviewer, count MUST-FIX, spawn fixer) with states. State diagrams should represent stable states, not transient actions.

**Location:** "Diagram Suggestions" → Diagram 4 (lines 353-379)

**Suggested fix:** Reduce to 5 states representing stable conditions: Ready for Review, Reviewing (loop state), Fixing (loop state), Review Passed, Escalated. Transitions are labeled with conditions: "MUST-FIX > 0 AND round < 3" → Fixing, "MUST-FIX = 0" → Review Passed, "round ≥ 3 AND MUST-FIX > 0" → Escalated.

---

### [MINOR] Diagram 3: Caption could be more specific

The proposed caption for Diagram 3 (Hook Enforcement) is adequate but could be more concrete about what the diagram shows.

**Location:** "Diagram Suggestions" → Diagram 3 (lines 331-351)

**Suggested fix:** Refine caption to: "PreToolUse hooks block invalid tool calls, PostToolUse hooks auto-correct after execution, and Stop hook validates quality gates at agent completion"

---

## Review Summary

| Severity | Count |
| -------- | ----- |
| MUST     | 3     |
| SHOULD   | 19    |
| MINOR    | 6     |

| Action   | Count |
| -------- | ----- |
| CUT      | 4     |
| MERGE    | 4     |
| CONDENSE | 4     |

**Estimated reduction:** ~900 words (31% of current draft, bringing it from 2,931 words to approximately 2,030 words)

**Gate recommendation:** MUST-REVISE

The draft has three MUST-level defects: two fully redundant sections that duplicate Overview content in Layer 3 (Workflow Invariants, Human Checkpoints), and one pipeline artifact (Diagram Suggestions) that must be flagged for removal. The redundancy is structural, not incidental — the reader encounters the same lists of invariants and checkpoints twice with no new information, forcing re-reading of material already absorbed.

Beyond the MUST items, the draft exhibits a double-coverage pattern at the section level: safety invariants, human checkpoints, and dependency policy each appear in both strategic overview and architectural detail sections. The Reorganization Map addresses this by consolidating detail into the Architecture Layers section and retaining only high-level summaries in the Overview. After these structural changes, the draft will have clearer progressive disclosure: Overview provides strategic context, Architecture Layers provides mechanism detail, and later sections provide operational specifics.

The SHOULD findings include four CONDENSE items (Overview benefits, state file format, Quick Reference tables) that inflate word count by 2-3x relative to information density. The draft is currently 531 words over target (+22%). Applying the CONDENSE and CUT actions will bring it to approximately 2,030 words, which is within acceptable range of the 2,400-word target while preserving all essential technical content.

Prose quality is generally strong: voice is direct, terminology is consistent, and technical precision is high. The SHOULD findings related to word choice ("invoke" vs. "run", "self-correcting" marketing language) are minor polish that does not affect reader comprehension. No pervasive synthetic voice patterns detected — the isolated instances flagged (e.g., "genuinely" as filler) are addressable through line edits.

Diagram proposals require adjustment: Diagram 1 exceeds the 9-node limit and needs decomposition; Diagram 2 overstates StoryRunner's architectural role; Diagram 4 conflates states with actions. These are design-phase issues for the Designer to resolve, not draft defects.

The two MUST CUT findings and the structural MERGE findings are the gate blockers. Once resolved, the draft will have sound architecture with progressive disclosure that allows readers to stop at their desired depth level per the project request's success criteria.
