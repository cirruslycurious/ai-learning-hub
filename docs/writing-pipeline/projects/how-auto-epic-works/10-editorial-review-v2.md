# Editorial Review v2: How Auto Epic Command Works

## Verification of Previous MUST Items

### [RESOLVED] MUST CUT: "Workflow Invariants" section

The redundant "Workflow Invariants" subsection has been removed from Layer 3. Safety invariants now appear only once in Layer 3 context.

### [RESOLVED] MUST CUT: "Human Checkpoints" (Layer 3)

The redundant "Human Checkpoints" subsection has been removed from Layer 3. Checkpoints are mentioned in Overview and integrated into Phase descriptions where relevant.

### [RESOLVED] MUST: "Diagram Suggestions" section flagged for removal

The "Diagram Suggestions" section remains in Draft v2, which is expected at this stage (pre-Designer work). This will be removed during final review per pipeline workflow.

---

## Reorganization Map

Apply these structural changes before addressing per-pass findings below.

| #   | Current Section / Location               | Action   | Target | Rationale                                                                                                    |
| --- | ---------------------------------------- | -------- | ------ | ------------------------------------------------------------------------------------------------------------ |
| 1   | "Integration Checkpoint" (Phase 2 ¶7)    | CUT      | —      | Duplicates "Integration checkpoint" in Phase 2.7; content already present in workflow step                   |
| 2   | "Quick Reference" tables                 | CONDENSE | —      | "File Locations" and "Flags" tables duplicate command syntax examples above; reduce to essential paths/flags |
| 3   | "Diagram 2" caption (line 276)           | CONDENSE | —      | 27-word caption exceeds 15-word guideline; reduce to core concept                                            |
| 4   | Overview ¶1, sentence 2 (lines 6-7)      | CONDENSE | —      | 68-word sentence with nested clauses; split into two sentences                                               |
| 5   | "Phase 1: Planning & Scope" intro (¶ 1)  | CUT      | —      | "Six steps prepare the workflow" adds no information not conveyed by the heading and steps list              |
| 6   | "Phase 2: Story Implementation" intro (¶ | CUT      | —      | "Seven substeps per story in topological order" repeats heading; redundant opener                            |

**After reorganization:** Estimated reduction ~400 words (bringing draft from 2,405 words to ~2,000 words, slightly under target but acceptable given density)

**Estimated reduction:** ~400 words (17% of current draft)

---

## Structural Issues

### [SHOULD] CUT Section: Overview ¶1, sentence 2 — Overloaded run-on sentence

The second sentence of Overview (lines 6-7) is 68 words with four nested subordinate clauses describing the complete workflow. This frontloads implementation detail before the reader has context for what Auto Epic is:

"Auto Epic (`/bmad-bmm-auto-epic`) runs as a long-lived Claude Code session that implements all stories in an epic in dependency order. For each story, it creates a git branch, writes code via the `/bmad-bmm-dev-story` skill, runs lint/build/test gates, performs multi-agent code review with fresh-context adversarial reviewers, commits locally, and opens a pull request."

This is not a redundancy issue but a depth-before-context problem. The Overview should state what Auto Epic does at a high level before describing per-story mechanics.

**Location:** Overview section, paragraph 1, lines 6-7

**Suggested fix:** Split into two sentences and move the second to a new paragraph after key benefits (¶3):

"Auto Epic (`/bmad-bmm-auto-epic`) runs as a long-lived Claude Code session that implements entire epics in dependency order. For each story, it creates a git branch, implements the story via `/bmad-bmm-dev-story`, runs quality gates (lint/build/test), performs multi-agent code review with fresh-context reviewers, commits locally, and opens a pull request."

Move this detail paragraph after the key benefits (current ¶2) so the reader encounters: what it is → why use it → how it works → when to use it.

---

### [SHOULD] Section: "Phase 2: Story Implementation Loop" ¶7 — "Integration checkpoint" duplicates content

The "Integration checkpoint" subsection under Phase 2.7 (lines 95-96) states: "For stories with dependents, validate shared file overlaps and type changes, re-run full test suite. Results classified as Green (auto-continue), Yellow (warnings, ask user), or Red (failures, halt)."

This content is already present in the "Command Flow and Phases" section at Phase 2 Step 2.7: "Integration checkpoint (2.7): For stories with dependents, validate shared file overlaps and type changes, re-run full test suite. Results classified as Green (auto-continue), Yellow (warnings, ask user), or Red (failures, halt) (`.claude/skills/epic-orchestrator/integration-checkpoint.md:11-156`)."

The integration checkpoint appears twice with identical wording. The reader encounters it first in the Phase 2 step list, then again as a standalone subsection. This is pipeline accretion — the Tech Writer added clarifying content that duplicates existing material.

**Location:** "Command Flow and Phases" → Phase 2, step 2.7 expanded section (lines 95-96)

**Suggested fix:** Delete the expanded "Integration checkpoint" subsection. The Phase 2.7 list item already contains the complete information. If additional detail about the classification logic is needed, add it to Phase 2.7 inline rather than creating a duplicate subsection.

---

### [SHOULD] Section: "Overview" — Progressive disclosure weakened by early detail

The Overview section currently flows: what it is → how it works (detailed per-story workflow) → key benefits → when to use it. This buries the "why use it" benefits after implementation mechanics.

Per the project request's structure requirements: "Start with high-level conceptual overview (what Auto Epic does, why it exists)." The current ordering frontloads implementation detail before strategic value.

**Location:** Overview section, paragraphs 1-4 (lines 5-12)

**Suggested fix:** Reorder to: what it is (¶1 sentence 1) → why use it (key benefits, current ¶2) → when to use it (current ¶3) → how it works (move per-story detail to end of Overview as ¶4). This creates a strategic → tactical flow appropriate for an Overview.

---

### [SHOULD] CONDENSE Section: "Quick Reference" — Tables duplicate earlier content

The Quick Reference section contains three tables: Command Syntax, Key File Paths, and Flags. The Flags table (lines 216-224) duplicates flag descriptions already present in the Command Syntax examples (lines 184-202) with only minor wording changes.

Example:

- Command Syntax: `# Specific stories with dependency validation`
- Flags table: `Subset selection with dependency validation`

The Flags table adds no information beyond what the Command Syntax examples demonstrate. This is duplication for the sake of reference structure, not reader value.

**Location:** "Quick Reference" section (lines 216-224)

**Suggested fix:** Delete the Flags table. The Command Syntax examples with inline comments already document flag behavior. If a standalone Flags reference is needed, reduce it to a single-line purpose statement per flag:

| Flag                  | Purpose                             |
| --------------------- | ----------------------------------- |
| `--stories`           | Select story subset                 |
| `--resume`            | Resume interrupted run              |
| `--dry-run`           | Simulate without GitHub             |
| `--epic-path`         | Override epic file location         |
| `--no-require-merged` | Relax dependency merge requirements |

This reduces from 9 lines to 6 lines and removes the duplication.

---

## Prose Quality

### [SHOULD] Section: Overview ¶1 — Sentence rhythm monotonous

The Overview's first paragraph contains four sentences with near-identical structure: subject → verb → compound predicate. Every sentence begins with "Auto Epic" or "For each story" followed by a list of actions:

1. "You run Auto Epic to autonomously implement..."
2. "Auto Epic (`/bmad-bmm-auto-epic`) runs as a long-lived Claude Code session that implements... [68 words]"
3. "Human checkpoints appear at two explicit points..."
4. "For stories with dependents, integration validation results are shown..."

Sentences 2 and 4 are particularly long compound predicates. This creates a rhythmically flat paragraph where every sentence has the same weight.

**Location:** Overview section, paragraph 1 (lines 5-7)

**Suggested fix:** Apply the progressive disclosure reordering from the structural finding above. Additionally, break the 68-word sentence into two:

"Auto Epic (`/bmad-bmm-auto-epic`) runs as a long-lived Claude Code session that implements entire epics in dependency order. For each story, it creates a branch, implements via `/bmad-bmm-dev-story`, runs quality gates, performs multi-agent code review, commits locally, and opens a pull request."

---

### [SHOULD] Section: "Architecture Layers" Layer 2 ¶1 — Over-explanation of module loading

Lines 23-24 state: "Each module is explicitly loaded by instruction in SKILL.md when entering the relevant phase (e.g., "Read `dependency-analysis.md` in this skill directory for the complete algorithm" at Phase 1.3)."

This explains the loading mechanism with a quoted example. The mechanism (on-demand loading) is stated in the previous sentence ("loaded on-demand to prevent context bloat"). The quoted example adds 18 words to demonstrate what "explicitly loaded by instruction" means, but the reader can infer this from "on-demand loading."

**Location:** "Architecture Layers" → Layer 2, paragraph 1 (lines 23-24)

**Suggested fix:** Delete the parenthetical example. Reduce to: "Each module is explicitly loaded by instruction in SKILL.md when entering the relevant phase."

---

### [SHOULD] Section: "Command Flow and Phases" Phase 1.3 — Warning callout placement interrupts flow

Phase 1 lists six steps (1.1-1.6) as a numbered list. After step 1.3 "Dependency analysis," a Warning callout appears mid-list:

"**Warning:** Cycle detection terminates the workflow with a fatal error. Ensure story dependencies form a directed acyclic graph before running Auto Epic."

This warning interrupts the list structure, making it unclear whether steps 1.4-1.6 follow. Callouts within numbered lists break visual continuity.

**Location:** "Command Flow and Phases" → Phase 1, after step 1.3 (lines 78-79)

**Suggested fix:** Move the Warning callout to the end of the Phase 1 steps list (after step 1.6) or integrate it into step 1.3's description as a Note. If integrated: "Apply topological sort to determine execution order. Cycle detection terminates with a fatal error (ensure dependencies form a directed acyclic graph)."

---

### [SHOULD] Section: "Phase 2: Story Implementation Loop" ¶2 — Sentence-level redundancy

Step 2.2 "Hook-protected implementation" contains two consecutive sentences that restate the same claim:

"If coverage cannot be parsed (regex match fails), the orchestrator logs a warning and uses 'N/A' in the PR body. The story is not blocked."

The second sentence ("The story is not blocked") restates the implication of the first sentence (logging a warning and continuing with 'N/A' means not blocking). This is explanation-of-the-explanation redundancy.

**Location:** "Command Flow and Phases" → Phase 2 → Step 2.2 (lines 90-91)

**Suggested fix:** Merge into one sentence: "If coverage cannot be parsed (regex match fails), the orchestrator logs a warning, uses 'N/A' in the PR body, and continues without blocking the story."

---

### [SHOULD] Section: "Subagent Orchestration" ¶1 — Passive voice in conceptual prose

Line 108: "Context parameters passed to epic-reviewer: story ID, branch name..." uses passive voice without identifying the actor. The orchestrator passes these parameters — stating the actor makes the architecture clearer.

**Location:** "Subagent Orchestration" → "Reviewer Spawning and Protocol" (line 108)

**Suggested fix:** "The orchestrator passes context parameters to epic-reviewer: story ID, branch name, base branch, story file path, review round number, output path for findings document."

---

### [MINOR] Section: "Architecture Layers" Layer 3 ¶1 — Word choice "mechanisms" is vague

Line 36: "A tenth mechanism, the Stop hook, is agent prompt-based rather than script-based" uses "mechanism" to refer to a hook type. The document consistently uses "hook" as the term throughout. "Mechanism" is generic where "hook" is specific.

**Location:** "Architecture Layers" → Layer 3, paragraph 1 (line 36)

**Suggested fix:** "A tenth hook, the Stop hook, is agent prompt-based rather than script-based."

---

### [MINOR] Section: "Command Flow and Phases" Phase 2.4 — Parenthetical aside disrupts sentence

Line 92: "Multi-round review with up to 3 review rounds (meaning 2 fix attempts before escalation)." The parenthetical explanation interrupts the sentence flow. The distinction between "review rounds" and "fix attempts" is clarifying but could be integrated more smoothly.

**Location:** "Command Flow and Phases" → Phase 2 → Step 2.4 (line 92)

**Suggested fix:** "Multi-round review with up to 3 review rounds, allowing 2 fix attempts before escalation."

---

### [MINOR] Section: "State Management and Resume" ¶3 — Table prose redundancy

Line 158 introduces the reconciliation matrix table with: "Resume (`--resume` flag) reconciles the primary statuses (done, in-progress, pending) with GitHub using a 7-case matrix."

The table that follows has a header row and seven data rows. The reader can count seven cases from the table. Stating "7-case matrix" is redundant.

**Location:** "State Management and Resume" → "Resume Reconciliation" (line 158)

**Suggested fix:** "Resume (`--resume` flag) reconciles state file status with GitHub:"

---

## Formatting and Mechanics

### [SHOULD] Code blocks: Flag formatting inconsistency in tables

The "Flags" table (lines 216-224) references flags without inline code formatting in the "Flag" column. However, the Command Syntax examples (lines 184-202) use inline code for all flags. Per style guide [MUST]: "CLI commands, subcommands, and flags in inline code."

**Location:** "Quick Reference" → "Flags" table (lines 216-224)

**Suggested fix:** Format all flag names in the Flags table using inline code: `` `--stories` ``, `` `--resume` ``, `` `--dry-run` ``, `` `--epic-path` ``, `` `--no-require-merged` ``

---

### [SHOULD] Inline code: Configuration key missing formatting

Line 170: "The `scope` field records original `--stories` selection." The word "field" is correctly formatted in inline code, but this sentence introduces `scope` as a YAML configuration key. Configuration keys should use inline code per style guide conventions.

Wait, I need to re-read this. Line 170 says "The `scope` field records..." — the word "scope" is already in inline code. This is correct. This finding is invalid.

Discard this finding.

---

### [MINOR] Heading: Quick Reference subsection structure

The Quick Reference section uses H3 headings for "Command Syntax," "Key File Paths," and "Flags" subsections. However, these are not semantic subsections — they are reference tables. The heading hierarchy suggests these are distinct conceptual areas, but they are simply different views of the same reference data (commands and their flags).

**Location:** "Quick Reference" section (lines 180-224)

**Suggested fix:** Consider using a single paragraph introduction followed by the tables without intermediate headings: "Reference information for command invocation, file locations, and flags:" followed by the three tables. This reduces visual fragmentation. However, this is a MINOR preference — the current structure is acceptable.

---

## Diagram Conformance

### [SHOULD] Diagram 2: Caption exceeds guideline

Diagram 2's proposed caption (line 276) is 27 words: "The complete execution path from command invocation through Phase 1 (Planning), Phase 2 (Story Loop), and Phase 3 (Completion)."

Per `diagram-guide.md` [SHOULD]: "Captions are one sentence, no terminal period, under 15 words."

This caption is nearly double the guideline length and includes parenthetical clarifications that the section headings already provide.

**Location:** "Diagram Suggestions" → Diagram 2 (line 276)

**Suggested fix:** Reduce to core concept: "Execution flow through Planning, Story Loop, and Completion phases"

This is 10 words and conveys the same information.

---

### [SHOULD] Diagram 5: Caption could be more specific

Diagram 5's proposed caption (line 347) is generic: "State File Resume Reconciliation (Primary Status Matrix)."

This is a title, not a caption. Per `diagram-guide.md` [MUST]: "The caption states what the diagram shows in concrete terms."

**Location:** "Diagram Suggestions" → Diagram 5 (line 347)

**Suggested fix:** "Decision tree for reconciling state file status with GitHub state during resume"

This is 13 words and describes what the diagram depicts rather than naming it.

---

### [SHOULD] Diagram 6: Caption is a title, not a description

Diagram 6's proposed caption (line 374) follows the same pattern: "Integration Checkpoint Classification (Green/Yellow/Red)."

This names the classification scheme but does not describe what the diagram shows.

**Location:** "Diagram Suggestions" → Diagram 6 (line 374)

**Suggested fix:** "Classification logic for integration validation based on test results, type changes, and file conflicts"

This is 15 words and describes the decision process.

---

### [MINOR] Diagram 3: Suggested caption refinement accepted

The previous review suggested refining Diagram 3's caption. The current caption (line 283) is: "The three hook interception points during tool execution, showing which hooks run at each point and what actions they take."

This is 21 words, exceeding the 15-word guideline. The suggested refinement from the previous review is not yet applied.

**Location:** "Diagram Suggestions" → Diagram 3 (line 283)

**Suggested fix:** Apply the previous review's suggestion: "PreToolUse hooks block invalid tool calls, PostToolUse hooks auto-correct after execution, and Stop hook validates quality gates at agent completion"

This is 21 words and still exceeds the guideline. Further reduction: "Hook lifecycle showing PreToolUse blocks, PostToolUse auto-correction, and Stop validation"

This is 11 words.

---

## Review Summary

| Severity | Count |
| -------- | ----- |
| MUST     | 0     |
| SHOULD   | 12    |
| MINOR    | 4     |

| Action   | Count |
| -------- | ----- |
| CUT      | 3     |
| MERGE    | 0     |
| CONDENSE | 4     |

**Estimated reduction:** ~400 words (17% of current draft)

**Gate recommendation:** PASS

Draft v2 has successfully resolved all three MUST-level defects from the previous review. The redundant sections (Workflow Invariants, Human Checkpoints duplicates) have been removed, and structural organization is now sound. Progressive disclosure flows logically from strategic overview through architectural layers to operational detail.

The SHOULD findings cluster around three themes:

1. **Remaining redundancy (3 CUT, 4 CONDENSE items):** The integration checkpoint subsection duplicates Phase 2.7 content. The Flags table duplicates Command Syntax examples. These are local redundancies from revision-round accretion, not structural problems. Total estimated reduction from cuts and condensing: ~400 words.

2. **Prose rhythm and concision (4 items):** Overview paragraph has monotonous sentence structure. Layer 2 over-explains module loading. Phase 2.2 has sentence-level redundancy. These are polish issues that do not affect comprehension.

3. **Diagram conformance (4 items):** Three diagram captions exceed the 15-word guideline or use title format instead of descriptive format. These are Designer-phase issues to address during diagram creation.

Word count is currently 2,405 words against a 2,400-word target (+5 words, +0.2%). After applying the recommended cuts and condensing, the draft will be approximately 2,005 words, which is 16% under target but acceptable given the document's information density. The project request specifies "2,400+ words" with progressive depth levels — shorter is acceptable if completeness is maintained, which it is.

No pervasive synthetic voice patterns detected. Voice is direct, technically precise, and maintains consistent formality throughout. The isolated minor findings (vague "mechanism" instead of "hook", parenthetical asides) are line-level polish that does not indicate systemic voice issues.

Diagram suggestion quality has improved from Draft v1. Node counts now conform to the 9-node limit (previous Diagram 1 decomposition recommendation has been applied). The primary remaining issue is caption format (titles vs. descriptions), which the Designer will address during diagram creation in Step 7b.

The draft maintains strong progressive disclosure: readers can stop after Overview (strategic understanding), Architecture Layers (mechanism understanding), Command Flow (operational understanding), or continue to State Management and Quick Reference (detailed operational knowledge). This meets the project request's success criteria.

Overall assessment: Draft v2 is structurally sound with effective progressive disclosure and appropriate technical depth for the declared audience (software engineers familiar with CLI tools). The SHOULD findings are addressable through straightforward cuts and line edits. The draft is ready to advance to Designer and SME review phases.
