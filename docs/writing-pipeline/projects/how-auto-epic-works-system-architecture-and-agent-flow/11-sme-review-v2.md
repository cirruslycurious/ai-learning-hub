# SME Review v2 - How Auto Epic Works: System Architecture and Agent Flow

**Reviewer:** SME
**Date:** 2026-02-09
**Drafts reviewed:** 08-draft-v2.md, 10-diagrams-v1.md
**Review type:** Technical accuracy review of Draft v2 + Diagrams (Step 8)

---

## Previous Review Resolution Status

Verifying resolution of all 10 MUST items from `07-sme-review-v1.md`:

### ✅ MUST #1: Review round terminology - RESOLVED

**Original issue:** Draft conflated "3 rounds" with "3 fix attempts" when spec shows 3 review rounds = 2 fix cycles + final review.

**Resolution in Draft v2:** Line 5 now states "up to 3 review rounds with 2 fix attempts before escalation" and line 75 expands this to "3 review rounds by default: Round 1 review → fix → Round 2 review → fix → Round 3 review → escalate if still unclean, giving 2 fix attempts before escalation". This matches `.claude/skills/epic-orchestrator/review-loop.md` line 13 exactly.

**Status:** RESOLVED

---

### ✅ MUST #2: Command file path verification - RESOLVED

**Original issue:** Draft stated command file is "thin wrapper" without clarifying what that means technically.

**Resolution in Draft v2:** Line 17 now states "thin wrapper containing only argument parsing and a delegation instruction to load `.claude/skills/epic-orchestrator/SKILL.md`" and adds "This file contains no orchestration logic." This matches `.claude/commands/bmad-bmm-auto-epic.md` lines 34-37.

**Status:** RESOLVED

---

### ✅ MUST #3: Incomplete flag list - RESOLVED

**Original issue:** Draft listed only 4 flags when command supports 6 parameters.

**Resolution in Draft v2:** Line 17 now lists all 6 flags: "`--epic`, `--stories`, `--resume`, `--dry-run`, `--epic-path`, `--no-require-merged`, and `--max-review-rounds`". This matches `.claude/commands/bmad-bmm-auto-epic.md` lines 22-30.

**Status:** RESOLVED

---

### ✅ MUST #4: Phase 1 step numbering - RESOLVED

**Original issue:** Draft mentioned cycle detection as fatal error but didn't cite which Phase 1 step performs it.

**Resolution in Draft v2:** Line 66 now states "Phase 1.3 (dependency analysis) enforces the never-silently-ignore-failures invariant by treating dependency cycles as fatal errors that stop execution immediately." This matches `.claude/skills/epic-orchestrator/SKILL.md` line 55.

**Status:** RESOLVED

---

### ✅ MUST #5: Missing git fetch in Phase 2 step 1 - RESOLVED

**Original issue:** Draft omitted the critical `git fetch` before dependency merge-base checks.

**Resolution in Draft v2:** Line 72 now states "Fetch latest remote state (`git fetch origin main`) to ensure local remote-tracking refs are current for merge-base checks." This matches `.claude/skills/epic-orchestrator/SKILL.md` line 114.

**Status:** RESOLVED

---

### ✅ MUST #6: Wrong dependency completion criteria - RESOLVED

**Original issue:** Draft reversed the dependency completion logic (AND when it should be conditional IF/ELSE).

**Resolution in Draft v2:** Lines 72-73 now state "For each dependency: if the dependency has dependents (`hasDependents === true`), verify code reached base branch via `git merge-base --is-ancestor`; if the dependency is a leaf story (no dependents), state file status "done" is sufficient." This matches `.claude/skills/epic-orchestrator/SKILL.md` lines 115-116.

**Status:** RESOLVED

---

### ✅ MUST #7: Integration checkpoint timing - RESOLVED

**Original issue:** Draft didn't clarify integration checkpoint runs after Phase 2.6 sync-with-main and before human checkpoint prompt.

**Resolution in Draft v2:** Line 77 now states "(after Phase 2.6 sync-with-main, before presenting the human checkpoint prompt in step 7)". This matches `.claude/skills/epic-orchestrator/SKILL.md` lines 323-327.

**Status:** RESOLVED

---

### ✅ MUST #8: Review Round 2 details - RESOLVED

**Original issue:** Draft showed Round 2 exits without explaining no fixer spawned because review is clean.

**Resolution in Draft v2:** Line 171 now states "Round 2: spawn `epic-reviewer` → finds 0 MUST-FIX issues → loop exits (no fixer spawned because review is clean)". This clarifies that clean review = no fix cycle.

**Status:** RESOLVED

---

### ✅ MUST #9: Wrong leaf dependency policy - RESOLVED

**Original issue:** Draft claimed leaf dependencies require PR merge when spec says state file "done" is sufficient.

**Resolution in Draft v2:** Line 263 now states "If the dependency is a leaf (has no other dependents), the dependent can start after the dependency's state is marked 'done' — no merge-base check is required because leaf stories have no downstream integration risk." This matches the spec exactly.

**Status:** RESOLVED

---

### ✅ MUST #10: Hook count and file extensions - RESOLVED

**Original issue:** Hook names missing file extensions for readers to locate actual files.

**Resolution in Draft v2:** Lines 322-332 now include file extensions for all hooks: `bash-guard.js`, `file-guard.js`, `architecture-guard.sh`, `import-guard.sh`, `tdd-guard.js`, `auto-format.sh`, `type-check.sh`. Verified all 7 files exist via glob pattern check.

**Status:** RESOLVED

---

## Draft v2 Review Items

### [MUST] Section: "Multi-Agent Code Review Loop" — Missing MUST-FIX definition on first use

The draft introduces "MUST-FIX issues" in line 30 (Layer 3 supporting modules description: "counts MUST-FIX issues (MUST-FIX = Critical + Important severity findings)") which is good, but then uses "MUST-FIX count" in line 267 without repeating the definition.

However, the more critical issue is in line 267 where the draft states: "The goal is zero MUST-FIX issues (MUST-FIX = Critical + Important severity findings) before proceeding to PR creation."

**Evidence:** `.claude/skills/epic-orchestrator/review-loop.md` line 10 defines "Clean state: 0 MUST-FIX findings (Critical + Important)" but the draft now defines MUST-FIX in two different locations (line 30 and line 267). The first definition is in the Layer 3 module description, not in the section where readers first encounter the review loop workflow.

When readers reach "Multi-Agent Code Review Loop" section (line 266), they have not yet seen the Layer 3 description if they skipped directly to this section (which the document design explicitly allows via "Each major section should be self-contained enough that a reader can skip ahead" per `00-request.md` line 43).

**Location:** "Multi-Agent Code Review Loop", line 267

**Suggested fix:** Move the MUST-FIX definition to the opening paragraph of "Multi-Agent Code Review Loop" (line 266-267) where it first appears in workflow context, not buried in the Layer 3 module list. The definition in line 30 can remain as forward reference, but the primary definition belongs where the term first appears in operational context.

---

### [SHOULD] Section: "Architecture Layers" → "Layer 2: Orchestrator skill" — Vague "reads supporting modules on-demand via the Read tool"

The draft states in line 21: "The orchestrator reads supporting modules on-demand via the Read tool as it enters each phase."

**Evidence:** `.claude/skills/epic-orchestrator/SKILL.md` line 48 shows the actual instruction: "**Read `dependency-analysis.md` in this skill directory for the complete algorithm.**" This is not a generic "Read tool" invocation — the orchestrator is told to read specific markdown files at specific phases.

The draft's phrasing "via the Read tool" is technically correct but doesn't clarify that these are markdown instruction files being read and followed, not data files being parsed. A reader might think the orchestrator is loading JSON config or YAML state, not prose instructions.

**Location:** "Architecture Layers" → "Layer 2: Orchestrator skill", line 21

**Suggested fix:** Change "reads supporting modules on-demand via the Read tool" to "reads supporting module instructions (markdown files with specialized algorithms and protocols) via the Read tool". This clarifies that modules are instruction documents, not code libraries.

---

### [SHOULD] Section: "Execution Example" → "Phase 1: Planning" — Topological sort non-determinism explanation could be clearer

The draft states in line 147: "both valid, algorithm may choose either because Story 1.2 and Story 1.3 are independent — neither depends on the other."

This is correct, but the phrasing "algorithm may choose either" is vague about whether this is implementation-defined behavior or truly non-deterministic runtime behavior.

**Evidence:** `.claude/skills/epic-orchestrator/dependency-analysis.md` does not specify which topological sort implementation is used (Kahn's vs DFS-based), and both algorithms can produce different valid orderings for graphs with parallel nodes. The draft correctly identifies that both orders are valid, but doesn't clarify that the specific order chosen depends on the algorithm's implementation details (DFS visit order, queue processing order in Kahn's).

**Location:** "Execution Example" → "Phase 1: Planning", line 147

**Suggested fix:** Change "algorithm may choose either" to "topological sort can produce either order (both valid) depending on how the algorithm processes parallel nodes". This clarifies it's an algorithm behavior pattern, not randomness.

---

### [SHOULD] Section: "Integration Checkpoints" — Missing clarification that `touches` field is advisory

The draft states in line 301: "The `touches` field is developer-declared guidance, not authoritative — actual conflict detection relies on git diff analysis."

This is technically correct and matches `.claude/skills/epic-orchestrator/integration-checkpoint.md` line 15: "Source of truth is `git diff` (actual files changed), NOT the `touches` field (which is advisory only)."

However, the draft buries this critical detail mid-paragraph after first using `touches` in the file overlap description. Readers might assume `touches` is authoritative on first read, then encounter the caveat later.

**Location:** "Integration Checkpoints", "File overlap detection" paragraph, line 301

**Suggested fix:** Move the clarification earlier. Change line 301 to lead with: "File overlap detection compares actual changed files via `git diff` against the advisory `touches` field in dependent story frontmatter. The `touches` field is developer-declared guidance, not authoritative — actual conflict detection relies on git diff analysis. If the completed story modified..."

---

### [MINOR] Section: "Three-Phase Workflow" → "Phase 2: Story implementation loop" — Redundant "For each story in topological order"

The draft's Phase 2 heading is "Phase 2: Story implementation loop" (line 69) and the opening sentence is "For each story in topological order, the orchestrator checks dependency completion..." (line 70).

The heading already contains "loop" and the context from Phase 1 established that stories execute in topological order. The opening sentence repeats "topological order" unnecessarily.

**Location:** "Three-Phase Workflow" → "Phase 2: Story implementation loop", line 70

**Suggested fix:** Change line 70 to "The orchestrator checks dependency completion for the current story, runs implementation via `dev-story`, executes the review loop..." to avoid repeating "topological order" immediately after Phase 1 established this.

---

## Diagram Review Items

### [MUST] Diagram 2: Command Flow Sequence — Missing Phase 2 loop indication

**Issue:** The sequence diagram shows Phase 2 as a single story execution (lines 70-79) but does not indicate that Phase 2 is a loop that repeats for each story in topological order. The diagram shows one iteration: "Update: in-progress" → "Implement story" → "Update: review" → "Review code" → "Create PR" → "Present checkpoint" → "Continue". This gives the impression Phase 2 executes once, when it actually loops N times (once per story).

**Evidence:** The prose in Draft v2 line 70 states "For each story in topological order, the orchestrator checks dependency completion..." and the Execution Example shows Story 1.1, 1.2, 1.3, 1.4 executing sequentially. The diagram must show that Phase 2 repeats.

**Location:** Diagram 2 (Command Flow Sequence), Phase 2 section

**Suggested fix:** Add a loop indicator in the mermaid sequence diagram. Use `loop Each story in topological order` before the Phase 2 message sequence and close the loop after the "Continue" message. Example:

```mermaid
loop Each story in topological order
    Note over Orchestrator,GitHub: Phase 2: Story Loop
    Orchestrator->>StateFile: Update: in-progress
    Orchestrator->>DevStory: Implement story
    # ... rest of Phase 2 messages
    User->>Orchestrator: Continue
end
```

This visually indicates Phase 2 repeats N times.

---

### [SHOULD] Diagram 3: Agent Interaction (Review Loop) — Missing round counter increment visualization

**Issue:** The diagram shows the loop-back path with "Increment round, loop" (line 114) but does not show where the round counter is checked against max rounds. The diagram shows `if MUST-FIX > 0` spawns fixer and loops, `else MUST-FIX == 0` exits loop — but the actual exit conditions are **either** MUST-FIX == 0 **or** round > max rounds.

**Evidence:** `.claude/skills/epic-orchestrator/review-loop.md` line 11 states "Exit conditions: Clean state reached OR max rounds exceeded". The diagram only shows the clean state exit path, not the max rounds exceeded escalation path.

**Location:** Diagram 3 (Agent Interaction), alt fragment lines 110-117

**Suggested fix:** Add a third branch to the alt fragment or add a note box showing "If round > max rounds: escalate to user (not shown in diagram)". Alternatively, add a loop wrapper around the entire review sequence with condition "while round <= maxRounds AND MUST-FIX > 0" to show both exit conditions.

---

### [SHOULD] Diagram 4: Hook Lifecycle — PostToolUse hook description incomplete

**Issue:** The diagram shows "PostToolUse hooks (auto-fix)" with example "Run Prettier, commit format changes" (lines 136-137) but does not show that PostToolUse has two hooks: `auto-format.sh` (Prettier + ESLint) **and** `type-check.sh` (TypeScript type checking). The prose in Draft v2 lines 329-332 lists both hooks.

**Evidence:** `.claude/hooks/auto-format.sh` and `.claude/hooks/type-check.sh` both exist (verified via glob). The draft correctly lists both in line 329-332. The diagram simplifies to one example but this could mislead readers into thinking only formatting happens in PostToolUse.

**Location:** Diagram 4 (Hook Lifecycle), PostToolUse node line 136

**Suggested fix:** Change the PostToolUse node label from "PostToolUse hooks (auto-fix)" with example "Run Prettier, commit format changes" to "PostToolUse hooks" with two example bullets: "auto-format (Prettier/ESLint)" and "type-check (tsc --noEmit)". This shows both hooks fire in this phase.

---

### [MINOR] Diagram 5: Dependency Graph — Execution order note placement

**Issue:** The execution order note appears below the diagram as a separate text block (line 177): "**Execution order note:** Valid orders are `[1.1, 1.2, 1.3, 1.4]` or `[1.1, 1.3, 1.2, 1.4]` because Stories 1.2 and 1.3 are independent."

This note is essential context but is visually separated from the graph, requiring readers to look away from the diagram to understand the parallel execution possibility. In mermaid flowcharts, notes can be embedded as node annotations.

**Location:** Diagram 5 (Dependency Graph), line 177

**Suggested fix:** Add the execution order note as a mermaid `Note` inside the diagram flowchart, positioned below the graph nodes. Example:

```mermaid
flowchart LR
    # ... existing nodes and edges ...
    note["Valid orders: [1.1, 1.2, 1.3, 1.4] or [1.1, 1.3, 1.2, 1.4]<br/>Stories 1.2 and 1.3 are independent"]
```

Or keep the external note but add a visual cue (like a border or background color) to show 1.2 and 1.3 nodes have no edge between them.

---

## Review Summary

| Severity | Count |
| -------- | ----- |
| MUST     | 2     |
| SHOULD   | 5     |
| MINOR    | 2     |

**Gate recommendation:** MUST-REVISE

**Rationale:**

**Previous Review Resolution:** All 10 MUST items from SME Review v1 are confirmed resolved. The Tech Writer addressed every factual error, missing detail, and technical inaccuracy from the first review. Excellent work.

**Draft v2 Findings:** One MUST item remains:

1. **MUST-FIX definition placement** — The definition appears in Layer 3 description (line 30) but readers who skip directly to the "Multi-Agent Code Review Loop" section (which the document design explicitly allows) will encounter "MUST-FIX count" without context. The definition must be in the section where the term first appears in operational context, not buried in an earlier module list.

This is a MUST because it creates a comprehension gap for readers using the document's intended navigation pattern (skip to depth level of interest). The document promises "Each major section should be self-contained" but the review loop section depends on a definition from an earlier architectural layer description.

**Diagram Findings:** One diagram MUST item:

1. **Diagram 2 missing loop indication** — The sequence diagram shows Phase 2 as a single story execution when it actually loops N times. This misrepresents the system's behavior and will mislead readers about execution timeline.

The 5 SHOULD items improve clarity (Layer 2 module loading mechanism, topological sort non-determinism explanation, `touches` field advisory status placement) and diagram completeness (review loop exit conditions, PostToolUse hook coverage) but do not block comprehension of core system behavior.

**Technical Accuracy Assessment:** The draft is now highly accurate. All major factual errors from Review v1 are corrected. The remaining MUST items are structural (definition placement, diagram loop visualization) rather than factual errors about system behavior. After addressing these 2 MUST items, the document will be ready to proceed.

**Diagram Quality Assessment:** All 5 diagrams correctly represent the system architecture, flow, and interactions. The diagrams show:

- Correct component relationships (Layer 1 delegates to Layer 2, which spawns Layer 4 agents)
- Correct spawning mechanisms (Task tool for subagents, Skill tool for dev-story)
- Correct review loop logic (spawn reviewer → count MUST-FIX → conditional fixer spawn)
- Correct hook firing timeline (PreToolUse blocks, PostToolUse auto-fixes, Stop verifies)
- Correct dependency relationships (Story 1.1 → 1.2/1.3 → 1.4 with checkpoint annotations)

No diagrams depict incorrect behavior, wrong relationships, or misleading flows. The MUST item for Diagram 2 is about completeness (missing loop indication), not incorrectness. The SHOULD items are presentation improvements, not accuracy fixes.

After revision, this document will accurately represent the Auto Epic system at the level of detail appropriate for the declared audience (engineers familiar with CLI tools who want to understand orchestration mechanics).
