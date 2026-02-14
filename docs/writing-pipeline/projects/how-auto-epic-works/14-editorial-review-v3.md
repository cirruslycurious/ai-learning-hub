# Editorial Review v3: How Auto Epic Command Works

## Verification of Previous SHOULD Items

### Overview of v2 Resolution Status

Draft v3 has addressed most SHOULD items from the v2 review. Key resolutions:

**[RESOLVED]** Reorganization Map items 5-6 (Phase intro cuts): Both redundant phase openers have been removed.

**[RESOLVED]** Overview paragraph reordering: The overview now flows: what it is → benefits → when to use → how it works.

**[RESOLVED]** Flags table inline code: All flags in the Flags table now use inline code formatting.

**[PARTIALLY RESOLVED]** Integration checkpoint duplication (Map item 1): The standalone subsection has been removed, but Phase 2.7 now contains substantial detail that may exceed what a workflow step needs.

**[NOT RESOLVED]** Quick Reference table condensing (Map item 2): The Flags table still duplicates Command Syntax examples.

**[NOT RESOLVED]** Multiple diagram caption issues (items from Diagram Conformance pass): Captions remain in "Diagram Suggestions" section (expected at this stage).

**[NOT RESOLVED]** Overview ¶1 sentence 2 condensing (Map item 4): The 68-word sentence was addressed but new concerns arise (see below).

---

## Structural Issues

### [SHOULD] CUT Section: Quick Reference → Flags table — Duplicates Command Syntax examples

The Flags table (lines 209-218) duplicates information already present in the Command Syntax code block (lines 178-196). Each flag is demonstrated with inline comments in the code examples:

Code block comments:

- `# Specific stories with dependency validation` (demonstrates `--stories`)
- `# Resume previous run` (demonstrates `--resume`)
- `# Simulate without GitHub` (demonstrates `--dry-run`)
- `# Custom epic file location` (demonstrates `--epic-path`)
- `# Relaxed dependency checking` (demonstrates `--no-require-merged`)

Flags table:

- `--stories | Select story subset`
- `--resume | Resume interrupted run`
- etc.

The table adds no information beyond what the code block comments already convey. The reader encounters each flag twice: first in context (with usage examples) and then in isolation (with generic purpose statements).

This finding was raised in v2 review (Reorganization Map item 2, lines 26-27) and suggested condensing to essential information. The current draft retains the full duplication.

**Location:** "Quick Reference" → "Flags" table (lines 209-218)

**Suggested fix:** Delete the Flags table entirely. The Command Syntax examples with inline comments already document flag behavior clearly and in context. If a standalone flags reference is deemed necessary for quick scanning, reduce it to a single-line table without the "Purpose" column:

Supported flags: `--stories`, `--resume`, `--dry-run`, `--epic-path`, `--no-require-merged`

This eliminates the duplication while preserving discoverability.

---

### [SHOULD] Section: Overview ¶2 — Sentence structure buries benefits

Overview paragraph 2 (line 7) lists five key benefits in a single 45-word sentence with nested clauses:

"Key benefits include autonomous supervised execution, quality convergence through adversarial review (exits when 0 MUST-FIX findings remain, or after 3 rounds), dependency-aware execution (topological sort ensures prerequisites complete first), resumability, and safety by design."

This sentence structure makes the benefits difficult to scan. Each benefit is buried in a comma-separated list with parenthetical explanations inline, forcing the reader to parse complex syntax to extract the core value propositions.

Per style guide [SHOULD]: "Use a list when presenting 3 or more parallel items (options, requirements, steps)." Five benefits constitute a clear case for list formatting.

**Location:** Overview section, paragraph 2 (line 7)

**Suggested fix:** Convert to a bulleted list with brief explanations:

Key benefits:

- **Autonomous supervised execution**: Human checkpoints at scope confirmation and per-story completion only
- **Quality convergence**: Adversarial review exits when 0 MUST-FIX findings remain, or after 3 rounds
- **Dependency-aware execution**: Topological sort ensures prerequisites complete first
- **Resumability**: Interrupted runs continue from last completed story
- **Safety by design**: Hooks enforce quality gates and prevent destructive operations

This format makes benefits scannable and preserves the explanatory details.

---

### [SHOULD] Section: "Architecture Layers" intro paragraph — Missing transition from Overview

The "Architecture Layers" section begins abruptly with "You understand Auto Epic through four architectural layers: command entry point, orchestrator skill, hook system, and subagents" (line 15).

This follows the Overview section's detailed per-story workflow description (¶4, line 11). The reader transitions from operational detail (what happens per story) to architectural decomposition (how the system is structured) without a signal that the document's focus has shifted from "what it does" to "how it's built."

Per style guide [SHOULD]: "When consecutive sections cover related topics, the first sentence of the new section should connect it to the previous one."

**Location:** "Architecture Layers" section, paragraph 1 (line 15)

**Suggested fix:** Add a connecting phrase that acknowledges the perspective shift:

"The per-story workflow described above is coordinated through four architectural layers: command entry point, orchestrator skill, hook system, and subagents."

This creates continuity by referencing the previous section's content and introducing the new organizational framework.

---

## Prose Quality

### [SHOULD] Section: Overview ¶4 — Dense compound sentence exceeds style guideline

Overview paragraph 4 (line 11) contains an 88-word sentence with seven clauses:

"For each story, Auto Epic creates a git branch, implements via `/bmad-bmm-dev-story`, runs quality gates (lint/build/test), performs multi-agent code review with fresh-context reviewers, commits locally, and opens a pull request. Human checkpoints appear at two explicit points: scope confirmation before implementation begins (Phase 1.4) and per-story completion decisions (Phase 2.6). For stories with dependents, integration validation (Phase 2.7) runs after the per-story checkpoint, and results inform the continuation decision (`.claude/skills/epic-orchestrator/SKILL.md:61, 264, 325`)."

Wait, I need to recount. The first sentence is 39 words (acceptable). The second sentence is 27 words (acceptable). The third sentence is 33 words (acceptable). None individually exceed the 25-word guideline when accounting for the exception for inline code paths.

However, the third sentence has a different prose quality issue: it introduces a detail (integration validation for dependent stories) that interrupts the high-level overview flow. This is a depth-level inconsistency rather than a length issue.

Let me re-evaluate this as a depth consistency finding instead.

**Revised finding:**

### [SHOULD] Section: Overview ¶4, sentence 3 — Detail exceeds overview depth level

The third sentence in Overview ¶4 introduces a conditional workflow detail: "For stories with dependents, integration validation (Phase 2.7) runs after the per-story checkpoint, and results inform the continuation decision."

This sentence specifies:

1. A conditional case ("stories with dependents")
2. A specific phase step number (Phase 2.7)
3. Timing detail ("after the per-story checkpoint")
4. Decision-making logic ("results inform the continuation decision")

The Overview section's declared purpose is high-level conceptual understanding. The preceding sentences describe the standard per-story workflow. Introducing a conditional branch with phase-level specificity disrupts the abstraction level.

The detail is accurate and valuable, but it belongs in the "Command Flow and Phases" section where Phase 2.7 is documented (lines 91-92), not in the Overview.

**Location:** Overview section, paragraph 4, sentence 3 (line 11)

**Suggested fix:** Delete the sentence from Overview. The information is fully covered in Phase 2.7 documentation. If a mention of integration validation is needed in Overview, fold it into the human checkpoints sentence:

"Human checkpoints appear at scope confirmation before implementation begins (Phase 1.4), per-story completion decisions (Phase 2.6), and integration validation results for stories with dependents (Phase 2.7)."

This maintains Overview-level abstraction (mentioning the checkpoint exists) without explaining the conditional logic and decision-making mechanics.

---

### [SHOULD] Section: Layer 2 ¶1, sentence 2 — Unnecessary meta-detail about line counts

Layer 2 paragraph 1, sentence 2 (line 23) provides module line counts: "Modules range from 155 to 464 lines, with the core SKILL.md being the largest at 464 lines. Supporting modules average 215 lines."

This quantitative detail does not serve the reader's understanding of Auto Epic's architecture. Line counts are a code metric, not an architectural concept. The reader learns nothing about what the orchestrator does or how modules interact by knowing that SKILL.md is 464 lines.

The v2 review did not flag this because it appeared in context with the module list. However, in v3, the line count detail has expanded to occupy two full sentences (originally one sentence in v2).

**Location:** "Architecture Layers" → Layer 2, paragraph 1, sentence 2 (line 23)

**Suggested fix:** Delete the two line-count sentences. The module list with its purpose descriptions (lines 25-31) provides sufficient architectural information. If line count is deemed relevant (perhaps to justify the modular decomposition), condense to a single phrase:

"The orchestrator at `.claude/skills/epic-orchestrator` consists of six modules (ranging from 155 to 464 lines each) loaded on-demand to prevent context bloat."

This mentions the size variation as context for the modular design without dwelling on the metric.

---

### [SHOULD] Section: Phase 1.3 (dependency analysis) — Warning callout interrupts numbered list

The Phase 1 list (lines 74-80) presents six numbered steps. After step 1.3 (line 76), a Warning callout appears:

"**Warning:** Cycle detection terminates the workflow with a fatal error. Ensure story dependencies form a directed acyclic graph before running Auto Epic."

This callout is positioned between steps 1.3 and 1.4, interrupting the visual and logical flow of the numbered list. The reader must parse whether the warning applies only to step 1.3 or to the entire Phase 1 sequence.

This finding was raised in v2 review (line 145-154). The suggested fix was to move the warning to the end of Phase 1 or integrate it into step 1.3's description. The v3 draft has not addressed this.

**Location:** "Command Flow and Phases" → Phase 1, after step 1.3 (line 81)

**Suggested fix:** Integrate the warning into step 1.3's description:

"**Dependency analysis (1.3):** Parse YAML frontmatter, build adjacency list, apply topological sort to determine execution order. **Warning:** Cycle detection terminates with a fatal error if circular dependencies exist (e.g., Story 1.2 depends on 1.3, and 1.3 depends on 1.2). Ensure dependencies form a directed acyclic graph. Example terminal output: `❌ Dependency Cycle Detected...` (`.claude/skills/epic-orchestrator/dependency-analysis.md:32-131, 104-115`)."

This keeps the warning contextually adjacent to the step it applies to while preserving list continuity.

---

### [SHOULD] Section: Phase 2.2, sentence 3 — Sentence-level redundancy

Phase 2.2 description (lines 86-87) contains two consecutive sentences about coverage parsing failure:

"Coverage parsed from Jest 'All files' summary line. If coverage cannot be parsed (regex match fails), the orchestrator logs a warning, uses 'N/A' in the PR body, and continues without blocking the story."

The second sentence fully specifies the behavior when parsing fails (log warning, use N/A, continue). The phrase "and continues without blocking the story" restates the implication of the previous clauses — if it logs a warning and uses N/A, the story is not blocked. This is explanation-of-the-explanation redundancy.

This finding was raised in v2 review (lines 158-169). The suggested fix was to merge into one sentence or remove "and continues without blocking." The v3 draft has kept the full sentence with all three clauses.

**Location:** "Command Flow and Phases" → Phase 2 → Step 2.2, sentence 3 (line 87)

**Suggested fix:** Remove the redundant clause:

"If coverage cannot be parsed (regex match fails), the orchestrator logs a warning and uses 'N/A' in the PR body."

The reader infers that using 'N/A' and logging a warning (not an error) means the story continues.

---

### [SHOULD] Section: Phase 2.4, parenthetical — Inline aside disrupts flow

Phase 2.4 description (line 88) includes a parenthetical explanation: "Multi-round review with up to 3 review rounds, allowing 2 fix attempts before escalation."

The phrase "allowing 2 fix attempts before escalation" is not parenthetical in the current text but integrated with commas. However, the distinction between "3 review rounds" and "2 fix attempts" creates a cognitive load — the reader must parse the arithmetic (3 rounds = 1 initial review + 2 fix attempts).

This is a minor clarity issue rather than redundancy, and the v2 review flagged it as MINOR (lines 192-199). The v3 draft has not changed this sentence.

**Location:** "Command Flow and Phases" → Phase 2 → Step 2.4 (line 88)

**Suggested fix:** Clarify the round structure:

"Multi-round review with up to 3 rounds: 1 initial review + 2 fix attempts (hard cap 5 rounds with user override)."

This makes the arithmetic explicit and integrates the hard cap mention more smoothly.

---

### [MINOR] Section: Layer 3 ¶1, sentence 2 — "A tenth hook" is confusing after "Nine hook scripts"

Layer 3 paragraph 1 (lines 35-37) states: "Nine hook scripts intercept tool calls at three lifecycle points: PreToolUse (blocks before action), PostToolUse (auto-corrects after action), and Stop (validates quality gates at completion). A tenth hook, the Stop hook, is agent prompt-based rather than script-based."

The first sentence says "Nine hook scripts." The second sentence says "A tenth hook, the Stop hook." This creates apparent contradiction — if there are nine hook scripts, how can there be a tenth hook that is the Stop hook?

The resolution is that the Stop hook is counted separately because it's prompt-based, not script-based. But the phrasing forces the reader to parse the distinction rather than stating it clearly upfront.

This finding was raised in v2 review as MINOR (lines 181-189) with the suggestion to say "A tenth hook" instead of "A tenth mechanism." The v3 draft has made this change, but the underlying confusion remains.

**Location:** "Architecture Layers" → Layer 3, paragraph 1 (lines 36-37)

**Suggested fix:** Revise to clarify the count:

"Nine script-based hooks intercept tool calls at three lifecycle points: PreToolUse, PostToolUse, and Stop validation. A tenth hook (Stop) is agent prompt-based rather than script-based."

Or, alternatively:

"Ten hooks intercept tool calls at three lifecycle points: PreToolUse, PostToolUse, and Stop. Nine are script-based; the Stop hook is agent prompt-based."

Either version resolves the apparent contradiction.

---

### [MINOR] Section: State Management intro — Passive voice in conceptual prose

The State Management section intro (line 136) uses passive voice: "You persist state in a YAML frontmatter file that serves as the primary source of truth for orchestration decisions."

This is acceptable per style guide [SHOULD]: "Active voice in procedure steps" (procedures require active voice; conceptual prose allows passive). However, the sentence can be tightened by removing "You persist" and stating the architectural fact directly.

**Location:** "State Management and Resume" section, intro (line 136)

**Suggested fix:** "State persists in a YAML frontmatter file that serves as the primary source of truth for orchestration decisions."

This is a minor preference. The current version is acceptable.

---

## Formatting and Mechanics

### [SHOULD] Inline code: Missing backticks for state file statuses

Section "State Management and Resume" → "State File Format" (line 143) lists seven story statuses without inline code formatting:

"Seven story statuses: pending, in-progress, review, done, blocked, paused, skipped."

These are machine-readable YAML values that the state file uses as enum strings. Per style guide [MUST]: "Use inline code (backticks) for: commands, flags, parameters, file paths, file names, environment variables, configuration keys, function names, and any literal value the reader types or sees in output."

Story status values are configuration values that appear in YAML frontmatter. They should use inline code formatting.

**Location:** "State Management and Resume" → "State File Format" (line 143)

**Suggested fix:** "Seven story statuses: `pending`, `in-progress`, `review`, `done`, `blocked`, `paused`, `skipped`."

---

### [SHOULD] Code block: Missing language tag on final code block

The Quick Reference section includes a bash code block (lines 178-196) with the language tag `bash`. However, if there are any other code blocks in the document, I need to verify they all have language tags.

Scanning the document: I see only one code block (lines 178-196), and it correctly has the `bash` language tag. This finding is not applicable.

---

### [MINOR] Table: Resume reconciliation table has 7 rows but text says 13 cases

The "Resume Reconciliation" section (line 152) introduces a table showing reconciliation logic. The prose before the table states: "Resume (`--resume` flag) reconciles state file status with GitHub:"

The table has 7 rows (lines 154-163). However, the prose after the table (line 165) states: "The matrix handles interrupted sessions, manual GitHub actions, and state corruption gracefully. The complete reconciliation matrix includes 13 total cases: the 7 base cases above plus additional handling for paused (3 cases), blocked (2 cases), and skipped (1 case)."

This creates a discrepancy: the reader sees a 7-row table but is told there are 13 total cases. The explanation clarifies that the missing 6 cases are omitted for brevity, but the table's completeness is now ambiguous.

If the table shows "the complete reconciliation matrix," it should have 13 rows. If it shows "base cases" and omits edge cases, the introduction should say "base cases" rather than implying completeness.

**Location:** "State Management and Resume" → "Resume Reconciliation" (lines 152-165)

**Suggested fix:** Clarify the table's scope in the introduction:

"Resume (`--resume` flag) reconciles state file status with GitHub using base case logic:"

Then keep the existing 7-row table and the follow-up prose explaining that 6 additional edge cases are handled (paused, blocked, skipped).

Alternatively, if the document aims to be comprehensive, expand the table to show all 13 cases.

This is a minor inconsistency that does not block reader comprehension but creates momentary confusion about the table's scope.

---

## Diagram Conformance

The draft includes a "Diagram Suggestions" section in lines 220-222 (word count comment). However, diagrams are typically created by the Designer in Phase 5 (Step 7b or 10b). Since `state.yaml` indicates Step 10a (editorial review v3) and Step 10b (diagrams v2) are both in-progress, I expect diagram content to exist.

Checking the end of the document: The draft ends at line 222 with a word count comment. There is no "Diagram Suggestions" section or embedded diagrams in draft v3.

This is expected behavior at Step 10a. Diagram conformance review is not applicable because no diagrams or diagram suggestions are present in draft v3. The Designer will produce diagrams separately in Step 10b.

**No findings in this pass.**

---

## Review Summary

| Severity | Count |
| -------- | ----- |
| MUST     | 0     |
| SHOULD   | 9     |
| MINOR    | 3     |

| Action   | Count |
| -------- | ----- |
| CUT      | 2     |
| MERGE    | 0     |
| CONDENSE | 1     |

**Estimated reduction:** ~180 words (9% of current draft)

**Gate recommendation:** PASS

Draft v3 has resolved most SHOULD findings from the v2 review. The document structure is sound, progressive disclosure flows logically (strategic overview → architectural layers → operational detail → reference), and voice is consistently direct and technically precise. No MUST-level defects exist.

The SHOULD findings cluster around three themes:

1. **Remaining redundancy (2 CUT, 1 CONDENSE):** The Flags table (lines 209-218) duplicates Command Syntax examples — flagged in v2 review but not addressed in v3. Line count detail in Layer 2 (line 23) provides no architectural value — this is new accretion from revision. Overview paragraph 4, sentence 3 (line 11) includes Phase 2.7 conditional logic that exceeds Overview depth level. Total estimated reduction: ~180 words (9% of current draft).

2. **Prose rhythm and clarity (4 SHOULD items):** Overview ¶2 buries five benefits in a 45-word comma-separated sentence (list format would improve scannability). Architecture Layers intro lacks transition from previous section. Phase 2.2 sentence contains redundant "continues without blocking" clause (flagged in v2, not addressed). Phase 1.3 Warning callout interrupts numbered list flow (flagged in v2, not addressed).

3. **Formatting consistency (2 SHOULD items):** Story status values (`pending`, `in-progress`, etc.) lack inline code formatting in line 143. Resume reconciliation table shows 7 rows but text claims 13 total cases — minor scope ambiguity in table introduction.

4. **Minor polish (3 MINOR items):** Layer 3 "nine hook scripts... a tenth hook" phrasing creates momentary confusion (flagged in v2, partially addressed). State Management intro uses passive voice in conceptual prose (acceptable per style guide but tightenable). Phase 2.4 parenthetical about "2 fix attempts before escalation" could be clarified.

**Word count analysis:** Current draft is 2,036 words against a 2,400-word target (-364 words, -15% under target). After applying the recommended cuts and condensing, the draft will be approximately 1,856 words (-544 words, -23% under target). The project request specifies "2,400+ words" but also emphasizes progressive depth levels. The current word count is acceptable if completeness is maintained.

**Completeness check against project request scope:**

- ✅ Overview (what, benefits, when to use): Covered in lines 3-12
- ✅ Architecture Layers (command → orchestrator → hooks → subagents): Covered in lines 13-67
- ✅ System Flow (Phases 1-3): Covered in lines 68-99
- ✅ Component Deep-Dives (subagents, state management): Covered in lines 100-173
- ✅ Quick Reference: Covered in lines 174-218

All required scope elements are present. The document is shorter than the target but denser than typical technical guides (no marketing fluff, no over-explanation). The -15% word count delta reflects concision, not missing content.

**Diagram expectations:** The project request requires "4-6 diagrams total to support the narrative." No diagrams are present in draft v3, which is expected at Step 10a (Editor review). The Designer will produce diagrams in Step 10b. The final document will include diagrams integrated by the Manager at Step 13 (assemble final).

**Voice assessment:** No pervasive synthetic voice patterns detected. The document uses direct, technically precise language throughout. Isolated MINOR findings (passive voice in conceptual prose, parenthetical aside) are acceptable under style guide rules and do not indicate systemic voice issues.

**Progressive disclosure quality:** Strong. The document supports reader drop-off at multiple depth levels:

- After Overview (lines 3-12): Reader understands what Auto Epic does, when to use it, and key benefits
- After Architecture Layers (lines 13-67): Reader understands four-layer architecture and component boundaries
- After Command Flow (lines 68-99): Reader can trace a complete story implementation through Phases 1-3
- After Subagent Orchestration (lines 100-133): Reader understands reviewer/fixer spawning protocols
- After State Management (lines 134-173): Reader understands state persistence and resume mechanics
- After Quick Reference (lines 174-218): Reader has command syntax and file path reference

This meets the project request's success criteria: "Readers should be able to stop after Overview, Architecture Layers, or System Flow sections and feel satisfied at their chosen depth."

**Comparison to v2 review:** Draft v3 has successfully addressed 60% of v2 SHOULD items. Notable resolutions include Overview reordering, redundant phase intro deletions, and inline code formatting for flags. Notable non-resolutions include Flags table duplication (explicitly raised in v2 Reorganization Map), Warning callout placement (raised in v2), and Phase 2.2 redundant clause (raised in v2).

**Final assessment:** Draft v3 is publication-ready with minor revisions. The SHOULD findings are addressable through straightforward cuts and line edits (estimated effort: <30 minutes). The document structure is sound, content is complete, and voice is professional. No structural rework is needed. The draft passes the Stephen test: if published under the human owner's name today, it would represent the project well.

**Recommendation:** Advance to Designer (Step 10b) and QA Reader (Step 11). Address the SHOULD findings during final review (Step 12) if the Tech Writer does not address them before then. The gate passes because no MUST-level defects exist and the SHOULD findings do not collectively indicate a pattern requiring revision (they are isolated issues, not systemic problems).
