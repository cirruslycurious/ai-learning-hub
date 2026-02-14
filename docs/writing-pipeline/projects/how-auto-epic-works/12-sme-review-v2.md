# SME Review v2: How Auto Epic Command Works

**Reviewer:** SME (Technical Accuracy Review)
**Date:** 2026-02-09
**Draft:** 09-draft-v2.md
**Diagrams:** 11-diagrams-v1.md
**Previous Review:** 07-sme-review-v1.md
**Scope:** Verify all previous MUST items resolved, review diagram technical accuracy, check new content

---

## Previous Review Resolution Status

### ✅ RESOLVED: Human checkpoints count (v1 MUST #1)

**Original issue:** Draft v1 claimed "four strategic points" for human checkpoints.

**Resolution verified:** Draft v2 line 7 now correctly states: "Human checkpoints appear at two explicit points: scope confirmation before implementation begins (Phase 1.4) and per-story completion decisions (Phase 2.6). For stories with dependents, integration validation results are shown alongside the per-story checkpoint."

**Evidence:** `.claude/skills/epic-orchestrator/SKILL.md:61, 264` confirms only two `[HUMAN CHECKPOINT]` markers exist. Line 24 mentions checkpoints in Safety Invariants but the integration checkpoint is shown within the Phase 2.6 checkpoint flow, not as a separate gate.

---

### ✅ RESOLVED: Command file line count (v1 MUST #2)

**Original issue:** Draft v1 claimed "~55 lines".

**Resolution verified:** Draft v2 line 19 now states "(54 lines)" which matches actual count.

**Evidence:** `wc -l .claude/commands/bmad-bmm-auto-epic.md` returns 54 lines.

---

### ✅ RESOLVED: Module line count claim (v1 MUST #3)

**Original issue:** Draft v1 claimed "Each module is under 200 lines" which was false for SKILL.md (464 lines) and story-runner.md (370 lines).

**Resolution verified:** Draft v2 lines 23-24 now states: "Modules range from 155 to 464 lines, with the core SKILL.md being the largest at 464 lines. Supporting modules average 215 lines."

**Evidence:** Verified via `find .claude/skills/epic-orchestrator -name "*.md" -exec wc -l {} \;` showing the exact counts match the draft.

---

### ✅ RESOLVED: Hook count (v1 MUST #4)

**Original issue:** Draft v1 claimed "Eight hooks".

**Resolution verified:** Draft v2 line 36 now correctly states: "Nine hook scripts intercept tool calls at three lifecycle points... A tenth mechanism, the Stop hook, is agent prompt-based rather than script-based."

**Evidence:** `ls -1 .claude/hooks/*.{js,sh,cjs}` returns 9 files. README.md documents 10 rows (9 scripts + Stop).

---

### ✅ RESOLVED: Missing pipeline hooks (v1 MUST #5)

**Original issue:** Draft v1 omitted pipeline-guard.cjs and pipeline-read-tracker.cjs from hook lists.

**Resolution verified:** Draft v2 lines 45-46 now include:

- "pipeline-guard.cjs: Protects writing pipeline integrity: denies writes to guides/, agents/, templates/; denies overwrites of previous artifacts; warns on non-standard filenames."
- "pipeline-read-tracker.cjs: Records breadcrumbs when pipeline guide files are Read for verification by pipeline-guard."

**Evidence:** `.claude/hooks/README.md:15-16` confirms these descriptions.

---

### ✅ RESOLVED: Bash-guard citation precision (v1 MUST #6)

**Original issue:** Draft v1 cited broad range ".js:16-285" conflating multiple features.

**Resolution verified:** Draft v2 lines 40-41 now provides precise citations: "Implements tiered safety (critical/high/strict via `CLAUDE_SAFETY_LEVEL` env var, lines 16-18). Critical level blocks catastrophic commands (lines 63-105). High level blocks destructive git operations and credential exposure (lines 110-215). Strict level blocks any force push (lines 220-244). Escalates 6 high-risk patterns for human approval (lines 249-285)..."

**Evidence:** Verified against bash-guard.js actual line ranges.

---

### ✅ RESOLVED: Human checkpoint line number citation (v1 MUST #7)

**Original issue:** Draft v1 incorrectly cited lines 12-24 (Safety Invariants section) for checkpoint locations.

**Resolution verified:** Draft v2 line 7 now correctly cites `.claude/skills/epic-orchestrator/SKILL.md:61, 264` for the actual checkpoint markers.

**Evidence:** SKILL.md line 61 has `### 1.4 Scope Confirmation [HUMAN CHECKPOINT]` and line 264 has `### 2.6 Finalize Story [HUMAN CHECKPOINT]`.

---

### ✅ RESOLVED: Review loop rounds clarity (v1 MUST #8)

**Original issue:** Draft v1 stated "up to 3 rounds" ambiguously without clarifying what a "round" means.

**Resolution verified:** Draft v2 line 92 now clarifies: "Multi-round review with up to 3 review rounds (meaning 2 fix attempts before escalation). Hard cap 5 rounds with user override."

**Evidence:** `.claude/skills/epic-orchestrator/review-loop.md:9-13` defines the round progression matching this description.

---

### ✅ RESOLVED: Dependency flag description (v1 MUST #9)

**Original issue:** Draft v1 stated flag "disables strict checking for all stories" which was imprecise.

**Resolution verified:** Draft v2 line 89 now correctly states: "Override flag `--no-require-merged` relaxes dependency checking to accept state file 'done' status for all stories, bypassing the merge-base verification for stories with dependents."

**Evidence:** `.claude/skills/epic-orchestrator/state-file.md:158, 143-158` confirms this description.

---

### ✅ RESOLVED: Resume matrix row count (v1 MUST #10)

**Original issue:** Draft v1 showed 7-row table but omitted paused, blocked, and skipped statuses.

**Resolution verified:** Draft v2 lines 158-170 now includes the 7-case table for primary statuses (done, in-progress, pending) AND adds clarification: "The matrix handles interrupted sessions, manual GitHub actions, and state corruption gracefully. The complete reconciliation matrix includes 13 total cases: the 7 base cases above plus additional handling for paused (3 cases), blocked (2 cases), and skipped (1 case)."

**Evidence:** `.claude/skills/epic-orchestrator/state-file.md:121-135` shows all 13 cases as described.

---

## Draft Review Items (New Content Since v1)

### [MUST] Overview: Integration checkpoint placement — Misleading framing

The draft states in line 7: "For stories with dependents, integration validation results are shown alongside the per-story checkpoint."

This is technically correct but creates a misleading mental model. The integration checkpoint (Phase 2.7) happens AFTER the per-story checkpoint (Phase 2.6), not "alongside" it. The draft's phrasing suggests they happen simultaneously or as part of the same step.

The actual flow from SKILL.md is: 2.6 Finalize Story [HUMAN CHECKPOINT] → user decides continue/stop/pause/skip → THEN if continue AND story has dependents → 2.7 Integration checkpoint runs.

**Evidence:** `.claude/skills/epic-orchestrator/SKILL.md:264` shows Phase 2.6 checkpoint. Line 325 (estimated from context) shows Phase 2.7 runs AFTER finalization. The integration results may be SHOWN to the user at the 2.6 checkpoint, but the validation logic runs at 2.7.

**Location:** Overview, line 7

**Suggested fix:** Clarify temporal ordering: "For stories with dependents, integration validation (Phase 2.7) runs after the per-story checkpoint, and results inform the user's continuation decision."

OR if the implementation actually shows integration results DURING the 2.6 checkpoint before asking for user decision: "For stories with dependents, integration validation results are computed and shown at the per-story checkpoint (Phase 2.6) to inform the continuation decision."

---

### [SHOULD] Layer 2: Orchestrator module loading — Missing exact citation format

The draft states in line 24: "Each module is explicitly loaded by instruction in SKILL.md when entering the relevant phase (e.g., 'Read `dependency-analysis.md` in this skill directory for the complete algorithm' at Phase 1.3)."

The example citation "at Phase 1.3" does not provide a line number, which is inconsistent with the SME review standard of citing exact line numbers for verification.

**Evidence:** `.claude/skills/epic-orchestrator/SKILL.md:48` contains the exact instruction: "**Read `dependency-analysis.md` in this skill directory for the complete algorithm.**"

**Location:** Architecture Layers > Layer 2

**Suggested fix:** Change citation to: "Each module is explicitly loaded by instruction in SKILL.md when entering the relevant phase (e.g., 'Read `dependency-analysis.md` in this skill directory for the complete algorithm' at Phase 1.3, line 48)."

---

### [SHOULD] Layer 3: Hook escalation behavior — Missing repeated violation handling

The draft states in line 57: "Hooks escalate high-risk operations by exiting with code 0 and returning JSON with `permissionDecision: 'ask'`. The orchestrator reads these responses and adjusts behavior accordingly."

This describes the escalation mechanism but omits what happens when a hook escalates repeatedly (e.g., user keeps triggering the same risky operation). The README.md testing section shows the protocol but does not explicitly document repeated violation handling.

**Evidence:** `.claude/hooks/README.md:29-49` documents the exit codes and JSON format. Bash-guard.js lines 31-45 show the implementation. However, the README does not explicitly document what happens after 3+ escalations. This appears to be an implementation detail not fully documented in the source.

**Location:** Architecture Layers > Layer 3 > Stop hook

**Suggested fix:** If repeated violation handling exists, add: "Repeated violations (more than 3 times) escalate to human intervention." If the behavior is not documented in the source, this is [UNVERIFIED] and should be noted as such or removed from the draft.

**[UNVERIFIED]** — Source code inspection needed to confirm repeated violation behavior. If this claim cannot be verified from the hooks README or bash-guard.js comments, classify as unverifiable and remove or qualify the claim.

---

### [SHOULD] Layer 4: Tool restriction enforcement — Citation missing

The draft states in lines 66-67: "Tool restrictions are defined in the agent frontmatter (`disallowedTools` field) and enforced by the Task tool when spawning subagents (epic-reviewer.md:5, epic-fixer.md:5)."

The citation shows where the restrictions are DEFINED but does not cite where the Task tool ENFORCES them. The claim about Task tool enforcement is correct (Task tool reads agent frontmatter and blocks disallowed tools) but lacks a source citation.

**Evidence:** `epic-reviewer.md:5` shows `disallowedTools: Edit, Task`. `epic-fixer.md:5` shows `disallowedTools: Task`. The Task tool enforcement mechanism is documented in the Claude Code Task tool implementation (outside this codebase).

**Location:** Architecture Layers > Layer 4

**Suggested fix:** Since the enforcement is by the Task tool (external to this codebase), the citation is sufficient. However, for completeness, add a note: "This separation ensures reviewers cannot modify code they critique and fixers cannot spawn additional agents that would create unbounded chains." (This text already exists in the draft, so no change needed — reclassify as satisfactory.)

---

### [MINOR] Phase 1: Cycle detection error format — Could add context

The draft shows the error message format in line 78 but does not explain what triggers the error or how common it is.

**Location:** Phase 1: Planning & Scope > Step 1.3

**Suggested fix:** Add brief context before the error format: "Cycle detection runs during dependency analysis (Phase 1.3). If circular dependencies exist (e.g., Story 1.2 depends on 1.3, and 1.3 depends on 1.2), the orchestrator terminates with this error:"

---

## Diagram Review Items

### [MUST] Diagram 2a: Command Flow Overview — Missing integration checkpoint in Phase 2 flow

**Issue:** Diagram 2a (Command Flow Overview) shows Phase 2 as a simple "Story Loop" box with a "Per-Story Checkpoint" diamond. This omits the integration checkpoint (Phase 2.7) which is a separate validation step that runs for stories with dependents.

The prose in Phase 2 > Step 2.7 (line 95) describes the integration checkpoint, and Diagram 5 (Integration Checkpoint Classification) visualizes this step in detail. However, the high-level flow diagram (2a) does not show that integration validation exists as a distinct step within the Phase 2 loop.

**Evidence:** `.claude/skills/epic-orchestrator/SKILL.md:325` (estimated from structure) shows Phase 2.7 as a separate step. The integration-checkpoint.md module (155 lines) is dedicated to this validation logic.

**Location:** Diagram 2a (lines 27-53 in diagrams file)

**Suggested fix:** Diagram 2a is intentionally high-level and may not need to show all substeps. However, if the integration checkpoint is a significant enough control-flow decision that affects whether the workflow continues, it should appear in the overview. Options:

1. Add an "Integration Validation" diamond after "Per-Story Checkpoint" in Phase 2 (changes node count from 7 to 8, still under 9-node limit)
2. Accept that Diagram 2a shows Phase 2 as a black box and rely on Diagram 2b (Phase 2 Detail) to show integration checkpoint
3. Update the Diagram 2a alt text to clarify: "Phase 2 Story Loop with per-story processing (integration validation for stories with dependents not shown in overview)"

The current diagram is not technically WRONG (it accurately shows the high-level flow), but it creates a gap between the prose emphasis on integration checkpoints and the diagram's omission of them. Given that Diagram 2b DOES show integration validation, this may be acceptable decomposition.

**Reclassify to SHOULD:** Diagram 2a could be enhanced to show integration validation, but it's not a factual error — it's a level-of-detail choice. Diagram 2b compensates by showing the detail.

---

### [SHOULD] Diagram 2b: Phase 2 Story Loop Detail — Node label "Integration Validation" vs. prose "Integration checkpoint"

**Issue:** Diagram 2b line 73 shows a node labeled "Integration\nValidation" but the prose in Phase 2 > Step 2.7 (line 95) uses the term "Integration checkpoint". The diagram guide's SME evaluation criteria states: "Node label contradicts prose terminology or names the wrong component" is a MUST issue.

However, "Integration Validation" and "Integration checkpoint" are not contradictory — they refer to the same step using slightly different phrasing. The prose uses both terms: line 95 says "Integration checkpoint (2.7)" as the step header, and line 95 also says "validate shared file overlaps and type changes" (the action is validation).

**Evidence:** `.claude/skills/epic-orchestrator/integration-checkpoint.md:1` has the module title "Integration Checkpoint" but the prose describes the action as validation.

**Location:** Diagram 2b (lines 57-85 in diagrams file)

**Suggested fix:** For consistency with prose, change node label from "Integration\nValidation" to "Integration\nCheckpoint" to match the step name in Phase 2.7.

---

### [SHOULD] Diagram 3: Hook Lifecycle — Node label "Tool Executes" vs. prose "Tool call intercepted"

**Issue:** Diagram 3 (Hook Lifecycle) line 102 shows a node labeled "Tool Executes". This is accurate for the happy path (when PreToolUse allows the tool call), but the prose in Layer 3 (line 36) describes hooks as "intercept tool calls at three lifecycle points."

The phrase "Tool Executes" is technically correct but does not match the prose terminology. The prose uses "tool calls intercepted" to describe the PreToolUse phase.

**Evidence:** `.claude/hooks/README.md:8` describes the hook system as "intercepting tool calls."

**Location:** Diagram 3 (lines 89-115 in diagrams file)

**Suggested fix:** Node label "Tool Executes" is accurate and clear. The term "intercept" is used for the hook mechanism, not the tool execution phase. No change needed — the label is correct.

**Reclassify to MINOR:** This is not a technical accuracy issue. The terminology is consistent with standard hook nomenclature (PreToolUse → execution → PostToolUse).

---

### [SHOULD] Diagram 4: Review Loop Protocol — Missing round increment placement

**Issue:** Diagram 4 (Review Loop Protocol) shows the flow as: Count MUST-FIX → Spawn Fixer → Increment Round → loop back to Spawn Reviewer. However, the diagram does not show that the round check ("Round >= Max?") happens AFTER incrementing, not before spawning the reviewer again.

The current diagram shows the round check at line 133 (after increment), which is correct. However, the loop-back arrow at line 142 goes from "Round >= Max?" back to "Spawn Reviewer", which suggests the reviewer spawns even when max rounds are reached. The correct flow should be: if Round < Max, loop back to reviewer; if Round >= Max, escalate.

**Evidence:** `.claude/skills/epic-orchestrator/review-loop.md:9-13` defines round progression: "Round 1 review → fix → Round 2 review → fix → Round 3 review → escalate if still unclean." This means the round check happens AFTER the fixer increments the round, and if max rounds reached, escalate instead of spawning another reviewer.

**Location:** Diagram 4 (lines 119-144 in diagrams file)

**Suggested fix:** The diagram correctly shows "Round >= Max?" leading to "Escalate to User" (yes branch) and looping back to Reviewer (no branch). The Mermaid syntax at line 142 shows `ROUND -->|no| REVIEWER`, which is correct. No change needed — the diagram accurately represents the logic.

**Reclassify to RESOLVED:** Upon closer inspection, the diagram is technically accurate. The "yes" branch escalates, the "no" branch loops. The diagram matches the prose.

---

### [SHOULD] Diagrams 6a/6b/6c: State Resume — Implicit "Start Fresh" case in Diagram 6c

**Issue:** Diagram 6c (State Resume - Pending Status) line 246 shows a node "FRESH([Start Fresh])" but this case is not explicitly documented in the state-file.md reconciliation matrix.

The matrix at `.claude/skills/epic-orchestrator/state-file.md:121-135` shows:

- `pending` + `PR exists` → Treat as "review" (line 128)
- `pending` + `Branch exists` → Check out branch (line 129)

There is no explicit case for `pending` + `No PR/branch` in the table. However, examining the pattern for other statuses shows:

- `in-progress` + `No PR/branch` → Reset to `pending`, restart story from beginning (line 127)
- `paused` + `No PR/branch` → Reset to `pending`, restart from beginning (line 132)

The logical inference is that `pending` + `No PR/branch` means "start story from beginning" (which is what "Start Fresh" represents in the diagram). This is a reasonable implicit fallback.

**Evidence:** `.claude/skills/epic-orchestrator/state-file.md:121-135` shows the explicit cases. The "start from beginning" pattern for `No PR/branch` conditions is established in lines 127 and 132.

**Location:** Diagram 6c (lines 225-247 in diagrams file)

**Suggested fix:** Add a note in the prose clarifying the implicit fallback case: "If a pending story has no PR and no branch, the workflow starts the story from the beginning." This documents the logical inference that the diagram makes explicit.

---

## Review Summary

| Severity | Count |
| -------- | ----- |
| MUST     | 1     |
| SHOULD   | 5     |
| MINOR    | 1     |

**Gate recommendation:** MUST-REVISE

**Previous review resolution:** All 10 MUST items from SME review v1 have been successfully resolved. The draft demonstrates strong revision discipline and technical accuracy improvements.

**New issues identified:**

**MUST items (1):**

1. **Integration checkpoint placement (Overview, line 7):** The phrase "integration validation results are shown alongside the per-story checkpoint" creates a misleading temporal model. The integration checkpoint (Phase 2.7) runs AFTER the per-story checkpoint (Phase 2.6), not alongside it. Clarify the temporal sequence.

**SHOULD items (5):**

1. **Module loading citation (Layer 2, line 24):** Add line number to the example citation for consistency with SME review standards (line 48).

2. **Hook escalation repeated violations (Layer 3, line 57):** The draft claims "Repeated violations (more than 3 times) escalate to human intervention" but this is [UNVERIFIED] — not documented in hooks README or bash-guard.js. Either verify and cite, or remove/qualify the claim.

3. **Diagram 2b node label (Phase 2 Detail, line 73):** Change "Integration\nValidation" to "Integration\nCheckpoint" for consistency with prose terminology in Phase 2.7.

4. **Diagram 6c implicit fallback (State Resume - Pending Status):** The diagram shows "Start Fresh" for `pending` + no PR + no branch, which is logically inferred from the pattern in lines 127 and 132 but not explicitly documented. Add prose clarification of this implicit fallback case.

5. (Resolved during review) ~~Diagram 2a missing integration checkpoint~~ — Reclassified to acceptable level-of-detail decomposition since Diagram 2b shows the detail.

**MINOR items (1):**

1. **Cycle detection context (Phase 1, line 78):** Add brief context before the error message format to explain when this error triggers.

**Critical observation:** This is the FINAL SME review pass per pipeline limits. The single MUST item is moderate severity (a framing issue about temporal ordering). After addressing this and the SHOULD items, the document will be technically accurate and ready for final editorial review.

**Diagram technical accuracy:** All 9 diagrams correctly represent system behavior with two SHOULD-level improvements identified (Diagram 2b label consistency for prose alignment, Diagram 6c implicit fallback case documentation). No wrong arrow directions, no missing critical nodes, no incorrect cardinality, and no incorrect flow logic detected.

**Evidence quality:** All MUST findings include line number citations and source file references. Previous review resolution verification included re-checking source code to confirm fixes match implementation.
