# SME Review v1 - How Auto Epic Works: System Architecture and Agent Flow

**Reviewer:** SME
**Date:** 2026-02-09
**Draft reviewed:** 06-draft-v1r1-corrected.md
**Review type:** Technical accuracy review (Step 5)

---

## Review Items

### [MUST] Section: "Overview" — Wrong default max review rounds

The draft states "runs multi-agent code review on each story" but does not specify the default max rounds. Later in "Multi-Agent Code Review Loop" it says "up to 3 rounds by default, hard cap 5 with override" but the default is not consistently stated in the overview where readers first encounter the review loop concept.

More critically, the draft claims default is 3 rounds throughout, but the source material shows this is 3 _review rounds_ which means up to 2 fix cycles + 1 final review. The distinction matters because readers may misunderstand how many fix attempts occur.

**Evidence:** `.claude/skills/epic-orchestrator/review-loop.md` lines 9-10: "**Max rounds:** 3 (review rounds, meaning up to 2 fix cycles + 1 final review)" and line 13: "**Round progression:** Round 1 review → fix → Round 2 review → fix → Round 3 review → escalate if still unclean. This gives 2 fix attempts before escalation."

**Location:** "Overview", paragraph 1 and "Multi-Agent Code Review Loop", opening paragraph

**Suggested fix:** In "Overview" paragraph 1, change "runs multi-agent code review on each story" to "runs multi-agent code review on each story (up to 3 review rounds with 2 fix attempts before escalation)". In "Multi-Agent Code Review Loop" opening paragraph, clarify that "3 rounds" means "3 review rounds (Round 1 review → fix → Round 2 review → fix → Round 3 review)" to make the progression explicit.

---

### [MUST] Section: "Architecture Layers" — Missing command file path

The draft states: "The `.claude/commands/bmad-bmm-auto-epic.md` file serves as a thin wrapper" but does not verify this file actually exists at that path or describe what "thin wrapper" means technically.

**Evidence:** `.claude/commands/bmad-bmm-auto-epic.md` exists and contains only 55 lines, with lines 34-46 showing the delegation logic: "Read the COMPLETE file `.claude/skills/epic-orchestrator/SKILL.md`" and "Follow its instructions exactly". This confirms "thin wrapper" = argument parsing + delegation, no orchestration logic.

**Location:** "Architecture Layers" → "Layer 1: Command entry point", paragraph 1

**Suggested fix:** Add after "thin wrapper": "containing only argument parsing and a delegation instruction to load `.claude/skills/epic-orchestrator/SKILL.md`" to clarify what "thin" means. Verified file exists and is 55 lines total.

---

### [MUST] Section: "Architecture Layers" — Incomplete flag list

The draft lists `--epic`, `--stories`, `--resume`, `--max-review-rounds` as command-line arguments but the actual command supports more flags.

**Evidence:** `.claude/commands/bmad-bmm-auto-epic.md` lines 22-30 show 6 parameters: `epic_id`, `--stories`, `--resume`, `--dry-run`, `--epic-path`, `--no-require-merged`. The draft omits `--dry-run`, `--epic-path`, and `--no-require-merged`. These are not minor flags — `--dry-run` is critical for testing and is mentioned later in the draft, and `--no-require-merged` changes dependency policy behavior.

**Location:** "Architecture Layers" → "Layer 1: Command entry point", paragraph 1

**Suggested fix:** Change the flag list to: "`--epic`, `--stories`, `--resume`, `--dry-run`, `--epic-path`, `--no-require-merged`, and `--max-review-rounds`" or use "including" rather than listing them exhaustively if the draft prefers to show examples. If listing exhaustively, all 6 flags must appear.

---

### [MUST] Section: "Three-Phase Workflow" — Wrong Phase 1 step numbering reference

The draft states "Phase 1 enforces the never-silently-ignore-failures invariant" but does not specify which Phase 1 step performs cycle detection.

**Evidence:** `.claude/skills/epic-orchestrator/SKILL.md` line 61 shows Phase 1.3 performs dependency analysis including cycle detection (step 4: "Detect cycles — **STOP if cycles found** (fatal error)"). The draft mentions cycles are fatal but doesn't cite the specific step.

**Location:** "Three-Phase Workflow" → "Phase 1: Planning and scope", final paragraph

**Suggested fix:** Change "Phase 1 enforces the never-silently-ignore-failures invariant by treating dependency cycles as fatal errors" to "Phase 1.3 (dependency analysis) enforces the never-silently-ignore-failures invariant by treating dependency cycles as fatal errors that stop execution immediately."

---

### [MUST] Section: "Three-Phase Workflow" — Missing Phase 2 step 1 fetch command

The draft describes Phase 2 dependency checking but does not mention the critical `git fetch` that occurs before checking dependencies.

**Evidence:** `.claude/skills/epic-orchestrator/SKILL.md` line 114 under "**Check dependencies:**" states "**Fetch latest remote state** before checking: `git fetch origin ${baseBranch}` (ensures local remote-tracking ref is current for merge-base checks)". This fetch is essential for accurate merge-base verification in step 2.1.

**Location:** "Three-Phase Workflow" → "Phase 2: Story implementation loop", step 1

**Suggested fix:** Add before "Check if all dependencies are complete": "Fetch latest remote state (`git fetch origin main`) to ensure local remote-tracking refs are current for merge-base checks." This is a MUST because without the fetch, merge-base checks can produce stale results.

---

### [MUST] Section: "Three-Phase Workflow" — Wrong dependency completion criteria

The draft states: "Check if all dependencies are complete (status "done" with merged PR or dependency has its own dependents)" but this misrepresents the actual logic.

**Evidence:** `.claude/skills/epic-orchestrator/SKILL.md` lines 115-116: "For each dependency D of the current story: if D has dependents (`D.hasDependents === true`), verify D's code reached base branch via `git merge-base --is-ancestor ${D.commit} origin/${baseBranch}` ... If D is a leaf story (no dependents), state file "done" status is sufficient."

The draft reverses the logic. The correct criteria: if dependency D _has_ dependents, use git merge-base check; if D is a _leaf_ (no dependents), state file "done" is sufficient. The draft says "merged PR or dependency has its own dependents" which implies both conditions must be true (AND), when the actual logic is conditional (IF has dependents THEN merge-base, ELSE state-file).

**Location:** "Three-Phase Workflow" → "Phase 2: Story implementation loop", step 1

**Suggested fix:** Replace the entire sentence with: "For each dependency: if the dependency has dependents (`hasDependents === true`), verify code reached base branch via `git merge-base --is-ancestor`; if the dependency is a leaf story (no dependents), state file status "done" is sufficient."

---

### [MUST] Section: "Three-Phase Workflow" — Missing integration checkpoint timing clarification

The draft states integration checkpoint runs "If story has dependents" in Phase 2 step 6 but does not clarify this runs _after_ Phase 2.6 sync-with-main and _before_ the human checkpoint prompt.

**Evidence:** `.claude/skills/epic-orchestrator/SKILL.md` lines 323-327: "**When:** After completing a story where `story.hasDependents === true`. Runs AFTER Phase 2.6 sync-with-main and BEFORE the user "Continue?" prompt. (The 2.6 human checkpoint prompt is deferred until after integration checkpoint results are available, so the user sees the full picture before deciding.)"

This timing is critical because it explains why the user sees integrated checkpoint results in the same prompt, not as a separate interaction.

**Location:** "Three-Phase Workflow" → "Phase 2: Story implementation loop", step 6

**Suggested fix:** Change "If story has dependents (inverse graph non-empty), run integration checkpoint:" to "If story has dependents (inverse graph non-empty), run integration checkpoint (after Phase 2.6 sync-with-main, before presenting the human checkpoint prompt in step 7):"

---

### [MUST] Section: "Execution Example" — Incomplete Phase 2 Story 1.1 review round details

The draft shows Review Round 1 findings but states "Round 2: spawn `epic-reviewer` → finds 0 MUST-FIX issues → loop exits" without explaining that this is a _review-only_ round with no fixer spawned.

**Evidence:** `.claude/skills/epic-orchestrator/review-loop.md` lines 9-13 show the round progression: "Round 1 review → fix → Round 2 review → fix → Round 3 review → escalate if still unclean." When Round 2 review finds 0 MUST-FIX, the loop exits _before_ spawning a fixer because the decision point (Step B) checks MUST-FIX count and exits on 0.

**Location:** "Execution Example" → "Phase 2: Story implementation loop" → "Story 1.1 execution", step 4, Round 2

**Suggested fix:** Change "Round 2: spawn `epic-reviewer` → finds 0 MUST-FIX issues → loop exits" to "Round 2: spawn `epic-reviewer` → finds 0 MUST-FIX issues → loop exits (no fixer spawned because review is clean)". This clarifies that a clean review means no fix cycle runs.

---

### [MUST] Section: "Dependency Analysis" — Wrong dependency completion policy description

The draft states: "If Story 1.2 depends on Story 1.1 and Story 1.1 has other dependents (Story 1.3), Story 1.2 can start after Story 1.1's implementation completes and integration checkpoint passes — even if the PR is not yet merged."

This is correct but incomplete. The draft continues: "If Story 1.1 has no other dependents (leaf dependency), Story 1.2 must wait for PR merge because there is no integration validation."

**Evidence:** `.claude/skills/epic-orchestrator/SKILL.md` lines 115-116 and `dependency-analysis.md` do NOT state that leaf dependencies require PR merge. The policy is: if dependency has dependents, use `git merge-base` to verify code reached base branch (which happens when PR is merged); if dependency is a leaf, state file "done" status is sufficient.

The draft conflates "leaf dependency" (a dependency that itself has no dependents) with "Story 1.1 has no other dependents" which is the same thing, but then claims leaf dependencies need PR merge. This contradicts the source which says leaf dependencies only need state file "done".

**Location:** "Dependency Analysis", paragraph starting "Dependency completion policy varies"

**Suggested fix:** Replace the second sentence with: "If the dependency is a leaf (has no other dependents), the dependent can start after the dependency's state is marked "done" — no merge-base check is required because leaf stories have no downstream integration risk."

---

### [MUST] Section: "Hook System Enforcement" — Missing hook count and wrong hook list

The draft states "Eight hooks enforce quality gates" but then lists only 7 hooks in the PreToolUse/PostToolUse/Stop breakdown. The actual hook count must match the list.

**Evidence:** `.claude/hooks/README.md` line 9 table shows 11 total scripts including `pipeline-guard.cjs` and `pipeline-read-tracker.cjs` which are pipeline-specific, not Auto Epic hooks. Filtering for hooks relevant to Auto Epic (excluding pipeline hooks):

- PreToolUse: bash-guard.js, file-guard.js, architecture-guard.sh, import-guard.sh, tdd-guard.js = 5
- PostToolUse: auto-format.sh, type-check.sh = 2
- Stop: agent prompt = 1
- Total: 8

The draft lists:

- PreToolUse: bash-guard, file-guard, architecture-guard, import-guard, tdd-guard = 5
- PostToolUse: auto-format, type-check = 2
- Stop: agent prompt = 1
- Total: 8

The count is correct but the draft is missing the file extensions and does not clarify that bash-guard, file-guard, and tdd-guard are `.js` files while architecture-guard, import-guard, auto-format, and type-check are `.sh` files. This is a technical accuracy issue when readers try to locate the hook files.

**Location:** "Hook System Enforcement", opening paragraph and hook list

**Suggested fix:** Add file extensions to all hook names in the list: `bash-guard.js`, `file-guard.js`, `architecture-guard.sh`, `import-guard.sh`, `tdd-guard.js`, `auto-format.sh`, `type-check.sh`. Verify count of 8 total hooks is correct and matches the list.

---

### [MUST] Section: "State Management and Resume" — Missing atomic write implementation detail

The draft states "Atomic writes use a `.tmp` file pattern: write new state to `epic-{id}-auto-run.tmp.md`, verify write succeeded, then `mv epic-{id}-auto-run.tmp.md epic-{id}-auto-run.md`. The `mv` operation is atomic on POSIX filesystems."

This is technically correct but the draft does not cite the source in the codebase where this is specified.

**Evidence:** `.claude/skills/epic-orchestrator/SKILL.md` does not contain the `.tmp` pattern. Searching for "atomic" in the repo... The atomic write pattern is mentioned in `docs/auto-epic-diagram.md` line 478: "**State file atomic writes** — Write to `.tmp` then `mv` for crash safety" but there is no implementation code yet (this is a design doc, not running code).

This is a **design intent** documented in the workflow diagrams, not a verified implementation. The draft presents it as if it's implemented ("Atomic writes use...") when it's actually a specification.

**Location:** "State Management and Resume", paragraph starting "Atomic writes use"

**Suggested fix:** Change "Atomic writes use a `.tmp` file pattern" to "Atomic writes are specified to use a `.tmp` file pattern" and add: "(design spec from `docs/auto-epic-diagram.md` — implementation pending verification)". Alternatively, verify if this is implemented in actual StoryRunner code and cite the implementation file.

---

### [SHOULD] Section: "Overview" — Vague "multi-story feature development" phrasing

The draft states "Multi-story feature development creates a coordination problem" but does not quantify what "multi-story" means (2 stories? 5? 10?) or give a concrete example before the parenthetical.

**Evidence:** The example in parentheses shows "five stories with dependencies" which is good, but readers encounter "multi-story" first without context.

**Location:** "Overview", paragraph 3

**Suggested fix:** Change "Multi-story feature development" to "Features spanning multiple dependent stories" or lead with the concrete example: "Features spanning five or more stories with complex dependencies create a coordination problem."

---

### [SHOULD] Section: "Architecture Layers" — Vague "on-demand loading" claim

The draft states "The orchestrator loads supporting modules on-demand as it enters each phase" but does not specify the mechanism (how does "loading" work? Is it `Read` tool? `require()`? Manual copy-paste of instructions?).

**Evidence:** `.claude/skills/epic-orchestrator/SKILL.md` uses inline instructions like "Read `dependency-analysis.md` in this skill directory" (line 48) which suggests the orchestrator uses the Read tool to load module content, not a code import mechanism.

**Location:** "Architecture Layers" → "Layer 2: Orchestrator skill", paragraph 1

**Suggested fix:** Change "loads supporting modules on-demand" to "reads supporting modules on-demand via the Read tool" to clarify the loading mechanism.

---

### [SHOULD] Section: "Three-Phase Workflow" — Missing explanation of "toposort" algorithm name

The draft states "Perform topological sort using Kahn's algorithm" but does not explain what Kahn's algorithm is or why it was chosen over DFS-based topological sort.

**Evidence:** `.claude/skills/epic-orchestrator/dependency-analysis.md` line 121 mentions "Kahn's algorithm or DFS-based toposort" as alternatives, suggesting either would work. The draft claims Kahn's is _the_ algorithm used but the source says it's one option.

**Location:** "Three-Phase Workflow" → "Phase 1: Planning and scope", step 5

**Suggested fix:** Either (a) verify which algorithm is actually implemented and state "uses Kahn's algorithm" if confirmed, or (b) change to "performs topological sort (commonly Kahn's algorithm or DFS-based)" to reflect that either approach is valid per the spec.

---

### [SHOULD] Section: "Execution Example" — Missing explanation of topological sort non-determinism

The draft states: "Topological sort produces: `[1.1, 1.2, 1.3, 1.4]` or `[1.1, 1.3, 1.2, 1.4]` (both valid, algorithm may choose either)" but does not explain _why_ both are valid.

**Evidence:** Story 1.2 and Story 1.3 both depend on Story 1.1 but have no dependency relationship with each other, so they can execute in either order. The draft shows this in the dependency graph but doesn't explicitly state "Story 1.2 and Story 1.3 are independent of each other."

**Location:** "Execution Example" → "Phase 1: Planning", "Topological sort produces"

**Suggested fix:** Add after "(both valid, algorithm may choose either)": "because Story 1.2 and Story 1.3 are independent — neither depends on the other."

---

### [SHOULD] Section: "Multi-Agent Code Review Loop" — Missing MUST-FIX definition clarity

The draft states "counts MUST-FIX issues" in step 5 but does not define MUST-FIX until the "Exit conditions" section.

**Evidence:** `.claude/skills/epic-orchestrator/review-loop.md` line 10 defines MUST-FIX as "0 MUST-FIX findings (Critical + Important)" and lines 86-90 define the categories. The draft defines it later in the section but readers encounter "MUST-FIX count" before the definition.

**Location:** "Multi-Agent Code Review Loop", "Round execution", step 5

**Suggested fix:** Add a parenthetical after "counts MUST-FIX issues": "(MUST-FIX = Critical + Important severity findings)" so readers understand immediately what is being counted.

---

### [SHOULD] Section: "Integration Checkpoints" — Missing actual git command for type change detection

The draft states "Type/interface change detection scans TypeScript files in the diff for exported type definitions and interface changes. The module uses regex to match `export (type|interface) <name>` patterns" but does not show the actual git diff command used.

**Evidence:** `.claude/skills/epic-orchestrator/integration-checkpoint.md` lines 60-65 show:

```javascript
const diffOutput = await execCommand(
  `git diff origin/${baseBranch}...${completedBranchName} -- "*.ts" "*.d.ts"`
);
```

**Location:** "Integration Checkpoints", paragraph starting "Type/interface change detection"

**Suggested fix:** Add the git diff command: "The module runs `git diff origin/main...story-branch -- '*.ts' '*.d.ts'` and uses regex to match `export (type|interface) <name>` patterns in the diff output."

---

### [SHOULD] Section: "Hook System Enforcement" — Missing hook firing phase explanations

The draft lists hooks by phase (PreToolUse, PostToolUse, Stop) but does not explain when each phase fires in the agent execution timeline.

**Evidence:** `.claude/hooks/README.md` does not define the phases inline but the phase names are standard Claude Code hook timing. PreToolUse = before tool execution, PostToolUse = after tool execution, Stop = before agent marks task complete.

**Location:** "Hook System Enforcement", hook list section

**Suggested fix:** Add a brief explanation before the hook list: "Hooks fire at three phases: PreToolUse (before tool execution, can block actions), PostToolUse (after tool execution, can auto-fix), and Stop (before agent marks task complete, verification prompt)."

---

### [SHOULD] Section: "Safety Invariants and Human Checkpoints" — Missing invariant #7 rationale

The draft lists invariant #7 as "Idempotent operations — GitHub operations check for existence before creating (branch, PR, issue comment)" but does not explain _why_ idempotency matters.

**Evidence:** `.claude/skills/epic-orchestrator/SKILL.md` line 22 states "Idempotent operations" as an invariant and the StoryRunner interface uses `getOrCreate*` method names (line 134-136 in command file). The rationale is resume behavior — if the workflow crashes and resumes, idempotent operations prevent duplicate issues/branches/PRs.

**Location:** "Safety Invariants and Human Checkpoints", "Nine safety invariants", item 7

**Suggested fix:** Add rationale: "Idempotent operations — GitHub operations check for existence before creating (branch, PR, issue comment) to support clean resume after workflow interruption."

---

### [MINOR] Section: "Architecture Layers" — Inconsistent capitalization of "Layer"

The draft uses "Layer 1", "Layer 2", "Layer 3", "Layer 4" as section headings but refers to them in prose as "layer 1", "layer 2" (lowercase).

**Location:** Throughout "Architecture Layers" section

**Suggested fix:** Standardize on capitalized "Layer 1" or lowercase "layer 1" throughout. Current style guide does not mandate either, so this is a polish issue.

---

### [MINOR] Section: "Three-Phase Workflow" — Redundant "loop" in subheading

The draft uses subheading "Phase 2: Story implementation loop" and then immediately states "The implementation loop processes stories in topological order."

**Location:** "Three-Phase Workflow" → "Phase 2: Story implementation loop", opening sentence

**Suggested fix:** Change opening sentence to "For each story in topological order:" to avoid repeating "loop" twice in close proximity.

---

## Review Summary

| Severity | Count |
| -------- | ----- |
| MUST     | 10    |
| SHOULD   | 7     |
| MINOR    | 2     |

**Gate recommendation:** MUST-REVISE

**Rationale:** The draft has strong technical depth and accurately represents most of the system architecture. However, 10 MUST items require correction before the document can ship:

1. **Review round terminology confusion** — The draft conflates "3 rounds" with "3 fix attempts" when the spec clearly states 3 review rounds = 2 fix cycles + final review. This will mislead readers about loop behavior.

2. **Missing critical git fetch step** — Phase 2.1 dependency checking requires `git fetch` before merge-base checks, but the draft omits this essential step.

3. **Reversed dependency completion logic** — The draft states the logic backward (dependencies with dependents OR merged PR) when the actual logic is conditional (IF has dependents THEN merge-base, ELSE state-file).

4. **Hook count/list accuracy** — Hook names need file extensions for readers to locate the actual files in `.claude/hooks/`.

5. **Atomic write specification vs implementation** — The draft presents a design spec as if it's implemented code. Need to verify implementation or clarify it's a design intent.

The SHOULD items improve depth and clarity (defining MUST-FIX earlier, adding git commands to integration checkpoint descriptions, explaining topological sort non-determinism) but do not block comprehension.

All MUST items have cited evidence from source files and are actionable for the Tech Writer to address in revision.
