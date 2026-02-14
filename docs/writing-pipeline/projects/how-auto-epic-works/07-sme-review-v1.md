# SME Review v1: How Auto Epic Command Works

**Reviewer:** SME (Technical Accuracy Review)
**Date:** 2026-02-09
**Draft:** 06-draft-v1r1.md
**Scope:** Verify all technical claims against codebase and documentation

---

## Review Items

### [MUST] Overview: "Human checkpoints" — Inaccurate count and description

The draft states "Human checkpoints appear at four strategic points: scope confirmation before implementation begins, per-story completion decisions, integration validation for stories with dependents, and epic completion review."

This claim is inaccurate. The SKILL.md defines human checkpoints at only TWO explicit locations with `[HUMAN CHECKPOINT]` markers:

1. Phase 1.4 - Scope Confirmation
2. Phase 2.6 - Finalize Story

The "epic completion review" mentioned in the draft is NOT a human checkpoint in Phase 3 — Phase 3 only generates reports and updates files, with no explicit human approval gate. The "integration validation" happens at Phase 2.7 but is not marked as a separate human checkpoint — it is part of the 2.6 finalization flow where the user sees integration results alongside the continuation prompt.

**Evidence:** `.claude/skills/epic-orchestrator/SKILL.md:24` lists "Human checkpoints — Scope confirmation (Phase 1), per-story approval (Phase 2), integration checkpoints (Phase 2), and completion review (Phase 3) require human approval" — but only two locations have `[HUMAN CHECKPOINT]` markers in the actual workflow definition (lines 61 and 264). Phase 3 (Completion & Reporting) has no checkpoint marker.

**Location:** Overview, paragraph 2

**Suggested fix:** Change to: "Human checkpoints appear at two explicit points: scope confirmation before implementation begins (Phase 1.4) and per-story completion decisions (Phase 2.6). For stories with dependents, integration validation results are shown alongside the per-story checkpoint."

---

### [MUST] Layer 1: Command entry point — Incorrect line count

The draft states "The command file at `.claude/commands/bmad-bmm-auto-epic.md` (~55 lines)".

The actual line count is 54 lines (including blank lines and frontmatter).

**Evidence:** Command output `wc -l .claude/commands/bmad-bmm-auto-epic.md` returns `54`.

**Location:** Architecture Layers > Layer 1

**Suggested fix:** Change "(~55 lines)" to "(54 lines)" or more accurately "(~54 lines)".

---

### [MUST] Layer 2: Orchestrator skill — Module line count claim unsupported

The draft states "Each module is under 200 lines".

Verification shows this is FALSE for multiple modules:

- SKILL.md: 464 lines
- story-runner.md: 370 lines
- dependency-analysis.md: 193 lines (under 200, but close)
- state-file.md: 183 lines
- review-loop.md: 175 lines
- integration-checkpoint.md: 155 lines

Only 4 of 6 modules are under 200 lines. The main SKILL.md is 464 lines (2.3x the claimed limit), and story-runner.md is 370 lines (1.85x the claimed limit).

**Evidence:** Command output from `find .claude/skills/epic-orchestrator -name "*.md" -exec wc -l {} \;` shows the actual line counts listed above.

**Location:** Architecture Layers > Layer 2

**Suggested fix:** Remove the "under 200 lines" claim entirely, or replace with: "Modules range from 155 to 464 lines, with the core SKILL.md being the largest at 464 lines. Supporting modules average 215 lines."

---

### [MUST] Layer 3: Hook system — Incorrect hook count

The draft states "Eight hooks intercept tool calls".

The actual count is 9 hook scripts (not including the Stop hook which is agent-based, not a script):

1. bash-guard.js
2. file-guard.js
3. architecture-guard.sh
4. import-guard.sh
5. pipeline-guard.cjs
6. pipeline-read-tracker.cjs
7. tdd-guard.js
8. auto-format.sh
9. type-check.sh

The README.md table lists 10 rows (9 scripts + 1 Stop entry which is agent prompt-based).

**Evidence:** Command `ls -1 .claude/hooks/*.{js,sh,cjs}` returns 9 files. The README.md table at `.claude/hooks/README.md` has 10 rows in the Scripts table.

**Location:** Architecture Layers > Layer 3

**Suggested fix:** Change "Eight hooks" to "Nine hook scripts" or "Nine hooks (plus the Stop hook agent prompt)". Clarify whether the Stop hook is counted or not.

---

### [MUST] Layer 3: Hook lifecycle — Missing pipeline hooks

The draft lists 5 PreToolUse hooks (bash-guard, file-guard, tdd-guard, architecture-guard, import-guard) and 2 PostToolUse hooks (auto-format, type-check).

This omits **pipeline-guard.cjs** (PreToolUse) and **pipeline-read-tracker.cjs** (PostToolUse), which are documented in the README.md hooks table.

**Evidence:** `.claude/hooks/README.md:15-16` documents pipeline-guard.cjs as PreToolUse (Edit|Write) and pipeline-read-tracker.cjs as PostToolUse (Read).

**Location:** Architecture Layers > Layer 3 > PreToolUse hooks and PostToolUse hooks

**Suggested fix:** Add pipeline-guard.cjs to the PreToolUse list with description: "Protects writing pipeline integrity: denies writes to guides/, agents/, templates/; denies overwrites of previous artifacts; warns on non-standard filenames." Add pipeline-read-tracker.cjs to PostToolUse list: "Records breadcrumbs when pipeline guide files are Read for verification by pipeline-guard."

---

### [MUST] Layer 3: Bash-guard safety levels — Incomplete citation

The draft cites `.claude/hooks/bash-guard.js:16-285` for the bash-guard implementation. While this range includes most of the implementation, the actual safety level definition is at line 16-18, and the escalation patterns start at line 249 (not 16).

The citation conflates the entire file range with the specific features. For precision, critical patterns are lines 63-105, high patterns are lines 110-215, strict patterns are lines 220-244, and escalation patterns are lines 249-285.

**Evidence:** Reading bash-guard.js shows SAFETY_LEVEL definition at lines 16-18, critical patterns at 63-105, high patterns at 110-215, strict patterns at 220-244, escalation patterns at 249-285.

**Location:** Architecture Layers > Layer 3 > PreToolUse hooks > bash-guard.js

**Suggested fix:** Change citation to: "Implements tiered safety (critical/high/strict via `CLAUDE_SAFETY_LEVEL` env var, lines 16-18). Critical level blocks catastrophic commands (lines 63-105). High level blocks destructive git operations and credential exposure (lines 110-215). Strict level blocks any force push (lines 220-244). Escalates 6 high-risk patterns for human approval (lines 249-285): git push main, npm publish, cdk deploy, aws delete, rm -rf, terraform destroy."

---

### [MUST] Phase 1: Human checkpoint reference — Incorrect line numbers

The draft cites `.claude/skills/epic-orchestrator/SKILL.md:12-24` for human checkpoint description.

Line 12-24 is the "Safety Invariants" section, not the human checkpoint locations. The human checkpoint reference in Safety Invariants is at line 24 only. The actual checkpoint definitions appear at:

- Line 61: `### 1.4 Scope Confirmation [HUMAN CHECKPOINT]`
- Line 264: `### 2.6 Finalize Story [HUMAN CHECKPOINT]`

**Evidence:** Reading SKILL.md shows lines 12-24 cover all 9 safety invariants. Only line 24 mentions human checkpoints. The actual workflow checkpoints are defined at lines 61 and 264.

**Location:** Overview, paragraph 2

**Suggested fix:** Change citation to: "Human checkpoints appear at Phase 1.4 (scope confirmation, line 61) and Phase 2.6 (per-story approval, line 264) (`.claude/skills/epic-orchestrator/SKILL.md`)."

---

### [MUST] Phase 2: Review loop rounds — Ambiguous "up to 3 rounds" claim

The draft states "Multi-round review with up to 3 rounds (hard cap 5 with user override)."

This is technically accurate but misleading. The protocol defines 3 rounds as the default max, where "round" means a review attempt (so 3 rounds = 2 fix cycles + 1 final review that triggers escalation). The hard cap of 5 is an escalation override.

However, the draft does not clarify what a "round" means in this context. The review-loop.md defines a round as spawning a reviewer + counting findings + potentially spawning a fixer. The phrasing "up to 3 rounds" could be misinterpreted as "3 review-fix cycles" when it actually means "3 review attempts."

**Evidence:** `.claude/skills/epic-orchestrator/review-loop.md:9-13` defines max rounds as 3 review rounds (not fix rounds), with round progression: "Round 1 review → fix → Round 2 review → fix → Round 3 review → escalate if still unclean."

**Location:** Phase 2: Story Implementation Loop > Step 2.4

**Suggested fix:** Clarify: "Multi-round review with up to 3 review rounds (meaning 2 fix attempts before escalation). Hard cap 5 rounds with user override."

---

### [MUST] Phase 2: Dependency policy — Incorrect flag description

The draft states "Override flag `--no-require-merged` disables strict checking for all stories."

This is imprecise. The flag does not "disable strict checking" — it changes the dependency completion policy from requiring merged PRs (for stories with dependents) to accepting state file "done" status (for all stories). The strict vs. relaxed distinction is about what counts as "dependency satisfied," not about disabling checking entirely.

**Evidence:** `.claude/skills/epic-orchestrator/state-file.md:158` defines the flag as: "`--no-require-merged` disables strict checking. Use only when you understand the risk." The policy table at lines 143-158 shows that WITH the flag, dependency completion uses state file status for all stories (not "no checking").

**Location:** Phase 2: Story Implementation Loop > Step 2.1

**Suggested fix:** Change to: "Override flag `--no-require-merged` relaxes dependency checking to accept state file 'done' status for all stories, bypassing the merge-base verification for stories with dependents."

---

### [MUST] State Management: Resume matrix — Incorrect row count description

The draft states "Resume reconciles with GitHub using a 7-case decision matrix" and shows a 7-row table.

The actual state-file.md has a matrix with MORE than 7 cases. The table at lines 121-135 has these rows:

1. done / PR merged
2. done / PR closed/unmerged
3. in-progress / PR exists
4. in-progress / Branch deleted
5. in-progress / No PR/branch
6. pending / PR exists
7. pending / Branch exists
8. paused / PR exists
9. paused / Branch exists
10. paused / No PR/branch
11. blocked / PR exists
12. blocked / No PR/branch
13. skipped / any

The draft's 7-row table omits `paused`, `blocked`, and `skipped` statuses entirely.

**Evidence:** `.claude/skills/epic-orchestrator/state-file.md:121-135` shows a 13-row reconciliation matrix (7 base cases for done/in-progress/pending, plus 6 additional cases for paused/blocked/skipped).

**Location:** State Management and Resume > Resume Reconciliation

**Suggested fix:** Either expand the table to include all statuses (paused, blocked, skipped), or change the description to: "Resume reconciles the primary statuses (done, in-progress, pending) with GitHub using a 7-case matrix. Additional handling exists for paused, blocked, and skipped statuses."

---

### [SHOULD] Overview: Vague "quality convergence" claim

The draft states "quality convergence through adversarial review (fresh-context reviewer finds issues the implementer missed)".

While this describes the mechanism, it does not define what "quality convergence" means quantitatively or what the exit criteria are. The review-loop.md defines convergence as reaching 0 MUST-FIX findings (Critical + Important), which is specific and verifiable. The draft should state this exit condition.

**Evidence:** `.claude/skills/epic-orchestrator/review-loop.md:10-11` defines clean state as "0 MUST-FIX findings (Critical + Important)" and exit conditions as "Clean state reached OR max rounds exceeded."

**Location:** Overview, paragraph 1

**Suggested fix:** Change "quality convergence through adversarial review" to "quality convergence through adversarial review (exits when 0 MUST-FIX findings remain, or after 3 rounds)".

---

### [SHOULD] Layer 2: Orchestrator modules — Missing load conditions

The draft lists 6 modules with their load phases but does not explain the on-demand loading mechanism or what "loaded on-demand" means operationally. Does the orchestrator read these files at specific phase boundaries? Does the command file instruct the agent to read them?

The command file at line 36 states: "Read the COMPLETE file `.claude/skills/epic-orchestrator/SKILL.md`" and line 38 mentions: "The orchestrator references supporting files in its directory (loaded on-demand as you reach each phase)." This suggests the SKILL.md contains instructions to read the other modules at specific points.

**Evidence:** `.claude/commands/bmad-bmm-auto-epic.md:36-42` describes the read-and-execute pattern. Checking SKILL.md shows explicit instructions at specific phases: "Read `dependency-analysis.md` in this skill directory" (line 48), "Read `story-runner.md`" (line 78), "Read `state-file.md`" (line 88), "Read `review-loop.md`" (line 207), "Read `integration-checkpoint.md`" (line 325).

**Location:** Architecture Layers > Layer 2

**Suggested fix:** Add clarification: "Each module is explicitly loaded by instruction in SKILL.md when entering the relevant phase (e.g., 'Read `dependency-analysis.md` in this skill directory for the complete algorithm' at Phase 1.3)."

---

### [SHOULD] Layer 3: Hook return behavior — Missing error handling detail

The draft states "Hooks block invalid operations and return error messages that explain violations and suggest correct approaches."

This is incomplete. According to the README.md testing section, hooks use specific exit codes and JSON output formats:

- Exit 0 = Allow (with optional JSON for escalation)
- Exit 2 = Block (stderr message)
- Escalation uses JSON with `hookSpecificOutput.permissionDecision: "ask"`
- Deny uses JSON with `hookSpecificOutput.permissionDecision: "deny"`

The draft does not explain how the orchestrator receives and interprets these responses.

**Evidence:** `.claude/hooks/README.md:29-49` documents the testing protocol showing exit codes and JSON structure. Bash-guard.js lines 31-45 show the actual implementation of block (exit 2, stderr) vs. escalate (exit 0, JSON output).

**Location:** Architecture Layers > Layer 3

**Suggested fix:** Add detail: "Hooks block invalid operations by exiting with code 2 and writing error messages to stderr. Hooks escalate high-risk operations by exiting with code 0 and returning JSON with `permissionDecision: 'ask'`. The orchestrator reads these responses and adjusts behavior accordingly."

---

### [SHOULD] Layer 4: Subagents — Missing tool restriction enforcement mechanism

The draft states "Tool restrictions enforce the separation: reviewers cannot modify code they critique; fixers cannot spawn additional agents that would create unbounded chains."

This describes the policy but does not explain HOW the restrictions are enforced. Are these restrictions in the agent definitions? Are they enforced by the Task tool? By hooks?

**Evidence:** Reading epic-reviewer.md:5 and epic-fixer.md:5 shows `disallowedTools: Edit, Task` and `disallowedTools: Task` in the YAML frontmatter. This suggests the enforcement is at the agent definition level (Task tool reads the agent definition and enforces the disallowed tools list).

**Location:** Architecture Layers > Layer 4

**Suggested fix:** Add: "Tool restrictions are defined in the agent frontmatter (`disallowedTools` field) and enforced by the Task tool when spawning subagents."

---

### [SHOULD] Phase 1: Cycle detection — Missing error message format

The draft states "Cycle detection terminates with a fatal error" and includes a warning callout that says "Cycle detection terminates the workflow with a fatal error."

The draft does not show what the actual error message format is. The dependency-analysis.md provides a specific error message template (lines 104-115) that would help readers understand what they'll see if this happens.

**Evidence:** `.claude/skills/epic-orchestrator/dependency-analysis.md:104-115` shows the exact error message format with example cycle output.

**Location:** Phase 1: Planning & Scope > Step 1.3

**Suggested fix:** Add the error message format from dependency-analysis.md as an example: "Error format: `❌ Dependency Cycle Detected\n\nStory 1.2 depends on Story 1.3\nStory 1.3 depends on Story 1.2\n\nThis epic cannot be implemented until dependencies are resolved.`"

---

### [SHOULD] Phase 2: Coverage parsing — Missing fallback behavior

The draft states "Coverage parsed from Jest 'All files' summary line" and shows the regex pattern.

The code example includes `coverage = null` fallback, but the draft does not explain what happens when coverage cannot be parsed. Does the PR body show "N/A"? Does the state file omit the coverage field? Does it block the story?

**Evidence:** `.claude/skills/epic-orchestrator/SKILL.md:176-179` shows: "If coverage cannot be parsed, log warning and use 'N/A' in PR body."

**Location:** Phase 2: Story Implementation Loop > Step 2.2

**Suggested fix:** After the code block, add: "If coverage cannot be parsed (regex match fails), the orchestrator logs a warning and uses 'N/A' in the PR body. The story is not blocked."

---

### [SHOULD] Subagent Orchestration: Fresh context isolation — Vague "no knowledge" claim

The draft states "Fresh context isolation ensures adversarial review. The reviewer has NO knowledge of implementation decisions or previous review rounds."

This is technically correct but does not explain the mechanism. How is fresh context achieved? Is it a new Claude API call? A new Task invocation? Does the reviewer see the branch history or just the diff?

**Evidence:** `.claude/skills/epic-orchestrator/review-loop.md:16-36` shows the reviewer is spawned via Task tool with a prompt containing: story ID, branch name, base branch, story file path, round number, output path. The reviewer runs `git diff origin/{base}...{branch}` to see changes. This is a fresh Task invocation with no inherited context.

**Location:** Subagent Orchestration > Reviewer Spawning and Protocol

**Suggested fix:** Add mechanism detail: "Fresh context is achieved by spawning the reviewer via Task tool, which creates a new agent invocation with no inherited context from the orchestrator or previous reviewers. The reviewer only sees the git diff output and story file."

---

### [SHOULD] State Management: Commit SHA tracking — Missing git command citation

The draft states "Record HEAD SHA after each story using `git rev-parse HEAD`" but does not cite where this is specified in the codebase.

**Evidence:** `.claude/skills/epic-orchestrator/state-file.md:172-183` documents the commit SHA tracking with the exact command and usage.

**Location:** State Management and Resume > Commit SHA Tracking

**Suggested fix:** Add citation: "Record HEAD SHA after each story using `git rev-parse HEAD` (`.claude/skills/epic-orchestrator/state-file.md:172-183`)."

---

### [MINOR] Overview: "BMAD" vs "bmad" casing inconsistency

The draft uses both "Auto Epic" and "bmad-bmm-auto-epic" but does not establish a convention for referring to BMAD vs bmad casing. The command uses all-lowercase `bmad-bmm-auto-epic`, but the draft might introduce confusion by mixing cases.

**Location:** Throughout document

**Suggested fix:** Establish consistent casing convention in first mention. For example: "Auto Epic (`/bmad-bmm-auto-epic` command, part of the BMAD-BMM framework)." Use lowercase for command references, uppercase for framework name.

---

### [MINOR] Layer 2: Module list — Consider alphabetical or dependency order

The draft lists modules in no apparent order (SKILL.md first, then the 5 supporting modules). Alphabetical order or dependency/load order would be clearer.

**Location:** Architecture Layers > Layer 2

**Suggested fix:** Reorder modules by load sequence (matching the phase progression): SKILL.md, dependency-analysis.md, story-runner.md, state-file.md, review-loop.md, integration-checkpoint.md. Add note: "Modules listed in load order (matching phase progression)."

---

### [MINOR] Quick Reference: Missing example for custom epic path

The draft shows command examples for most flags but the `--epic-path` example uses a placeholder path rather than a realistic example.

**Location:** Quick Reference > Command Syntax

**Suggested fix:** Change `--epic-path=path/to/epic.md` to `--epic-path=custom-epics/epic-1.md` for a more concrete example.

---

## Review Summary

| Severity | Count |
| -------- | ----- |
| MUST     | 10    |
| SHOULD   | 7     |
| MINOR    | 3     |

**Gate recommendation:** MUST-REVISE

The draft demonstrates strong research and mostly accurate technical claims, but contains 10 factual errors requiring correction:

1. Inaccurate human checkpoint count and location references
2. Incorrect command file line count (54, not 55)
3. False claim that all orchestrator modules are under 200 lines (SKILL.md is 464 lines, story-runner.md is 370 lines)
4. Incorrect hook count (9 scripts, not 8)
5. Missing 2 hooks from the lifecycle description (pipeline-guard, pipeline-read-tracker)
6. Imprecise bash-guard line number citation conflating multiple features
7. Wrong line numbers for human checkpoint citation (12-24 is Safety Invariants, not checkpoint definitions)
8. Ambiguous "up to 3 rounds" phrasing that could confuse review vs. fix cycles
9. Imprecise description of `--no-require-merged` flag behavior
10. Incomplete resume matrix (shows 7 cases, actual matrix has 13 including paused/blocked/skipped)

The SHOULD items primarily request additional precision and mechanism details to help readers understand implementation specifics. The MINOR items are polish suggestions for consistency and clarity.

All MUST items have been verified against source files with specific line numbers and evidence. After addressing these corrections, the document will be technically accurate and ready for diagram development.
