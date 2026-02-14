# QA Cold Read Report: Draft v3

**Date:** 2026-02-09
**Reader Profile:** Software engineer familiar with CLI tools and basic agent concepts
**Document:** 13-draft-v3.md

---

## Executive Summary

This cold read identified **11 confusion points** across the document, ranging from minor friction to moments requiring significant effort to recover understanding. The most severe issues center around:

1. **Hook execution mechanics** (Layer 3) - unclear when/how hooks actually intercept operations
2. **Fresh context isolation** (Subagent Orchestration) - the mechanism for achieving this is never explained
3. **DryRunStoryRunner** (Phase 1.5) - purpose and behavior remain opaque
4. **Integration checkpoint classification** (Phase 2.7) - criteria for Green/Yellow/Red are missing

The document excels at providing concrete file paths and specific line references, which helps ground abstract concepts. However, it frequently references implementation details (exit codes, JSON structures, environment variables) without first establishing the conceptual foundation.

---

## Confusion Points

### Confusion Point 1: "Overview" — Auto Epic's relationship to Claude Code

**What I was trying to understand:** How Auto Epic runs and what environment it requires

**Where I got confused:** Line 5: "Auto Epic (`/bmad-bmm-auto-epic`) runs as a long-lived Claude Code session"

**What I thought it meant:** Initially, I thought Auto Epic was a standalone tool that somehow integrates with Claude Code. The slash command syntax suggests it's _invoked_ in Claude Code, but "runs as" implies it _is_ a Claude Code session. This relationship wasn't clear until I saw "Layer 1: Command entry point" mention `.claude/commands/`.

**What would have helped:** One clarifying sentence: "Auto Epic is a Claude Code command invoked via `/bmad-bmm-auto-epic`, which starts a long-lived orchestration session within Claude Code's agent runtime." Or introduce the `.claude/` directory convention earlier.

**Severity self-assessment:** Recovered with effort

---

### Confusion Point 2: "Overview" — Integration validation timing vs. human checkpoint

**What I was trying to understand:** When humans can intervene in the workflow

**Where I got confused:** Line 11: "Human checkpoints appear at two explicit points: scope confirmation before implementation begins (Phase 1.4) and per-story completion decisions (Phase 2.6). For stories with dependents, integration validation (Phase 2.7) runs after the per-story checkpoint, and results inform the continuation decision."

**What I thought it meant:** I understood there are two checkpoints, but the second sentence made me question: Does integration validation (Phase 2.7) happen _before_ or _after_ the human makes the continuation decision at Phase 2.6? If it runs "after" the checkpoint, but results "inform the continuation decision," there's a temporal paradox.

**What would have helped:** Clarify that Phase 2.7 can _trigger_ an additional human prompt if results are Yellow/Red. Or rewrite: "per-story completion decisions (Phase 2.6, with integration validation at Phase 2.7 potentially requiring additional user input for stories with dependents)."

**Severity self-assessment:** Recovered with effort

---

### Confusion Point 3: "Layer 2: Orchestrator skill" — On-demand loading mechanism

**What I was trying to understand:** How modules are "loaded on-demand" in a single agent session

**Where I got confused:** Lines 22-31: "Each module is explicitly loaded by instruction in SKILL.md when entering the relevant phase (`.claude/skills/epic-orchestrator/SKILL.md:48`)"

**What I thought it meant:** As a software engineer, "loaded on-demand" suggests dynamic imports or lazy evaluation. But "loaded by instruction" is vague. Does SKILL.md contain instructions _for Claude_ to read these files? Is there a module system? Are they concatenated into context?

**What would have helped:** One sentence explaining the mechanism: "The orchestrator instructs Claude to read each module file using the Read tool when entering the corresponding phase, adding it to the active context." This clarifies it's about context management, not code imports.

**Severity self-assessment:** Minor friction

---

### Confusion Point 4: "Layer 3: Hook system" — Hook execution lifecycle

**What I was trying to understand:** When and how hooks actually intercept tool calls

**Where I got confused:** Lines 35-36: "Nine hook scripts intercept tool calls at three lifecycle points: PreToolUse (blocks before action), PostToolUse (auto-corrects after action), and Stop (validates quality gates at completion). A tenth hook, the Stop hook, is agent prompt-based rather than script-based."

**What I thought it meant:** The first sentence says there are nine hooks at three points. The second sentence says there's a tenth hook, which is the Stop hook... but Stop was already listed as one of the three lifecycle points. Does this mean there are 3 PreToolUse hooks, 3 PostToolUse hooks, 3 Stop hooks (totaling 9), plus 1 additional prompt-based Stop hook (totaling 10)? Or are there 9 script-based hooks distributed across the three points, plus 1 prompt-based Stop hook?

**What would have helped:** Rewrite for clarity: "Nine hook scripts (6 PreToolUse, 3 PostToolUse) intercept tool calls, plus an agent prompt-based Stop hook validates quality gates at completion." Include the count distribution.

**Severity self-assessment:** Recovered with effort

---

### Confusion Point 5: "PreToolUse hooks" — bash-guard.js execution order and blocking

**What I was trying to understand:** How bash-guard.js applies its three-tiered safety system

**Where I got confused:** Lines 40-41: "Implements tiered safety (critical/high/strict via `CLAUDE_SAFETY_LEVEL` env var, lines 16-18). Critical level blocks catastrophic commands (lines 63-105). High level blocks destructive git operations and credential exposure (lines 110-215). Strict level blocks any force push (lines 220-244). Escalates 6 high-risk patterns for human approval (lines 249-285)..."

**What I thought it meant:** I'm confused whether these are _tiers_ (mutually exclusive levels where high > critical > strict) or _layers_ (cumulative, where strict includes high and critical). The ordering "critical/high/strict" suggests severity escalation, but the line numbers suggest they're separate code sections. If I set `CLAUDE_SAFETY_LEVEL=high`, do I get critical + high, or only high?

**What would have helped:** Explicit tier semantics: "Tiers are cumulative: strict includes high and critical checks; high includes critical checks; critical is the minimal baseline. The `CLAUDE_SAFETY_LEVEL` env var defaults to 'high'."

**Severity self-assessment:** Recovered with effort

---

### Confusion Point 6: "PreToolUse hooks" — Hook response protocol

**What I was trying to understand:** How hooks communicate their decisions back to the orchestrator

**Where I got confused:** Line 57: "Hooks block invalid operations by exiting with code 2 and writing error messages to stderr. Hooks escalate high-risk operations by exiting with code 0 and returning JSON with `permissionDecision: 'ask'`."

**What I thought it meant:** This introduces a technical protocol (exit codes, stderr, JSON responses) without establishing _who_ executes these hooks and _who_ reads their output. Are these hooks executed by Claude Code's runtime? By the orchestrator? By some shell wrapper? The reference to `.claude/hooks/README.md:29-49` and `bash-guard.js:31-45` is concrete, but the conceptual model is missing.

**What would have helped:** Precede this with: "Claude Code's runtime intercepts tool calls and executes matching hook scripts before/after the tool runs. The orchestrator reads hook exit codes and output to decide whether to proceed, block, or ask the user."

**Severity self-assessment:** Could not proceed — had to infer this from context clues later in the document

---

### Confusion Point 7: "Layer 4: Subagents" — Tool restriction enforcement

**What I was trying to understand:** How tool restrictions are technically enforced

**Where I got confused:** Lines 66-67: "Tool restrictions are defined in the agent frontmatter (`disallowedTools` field) and enforced by the Task tool when spawning subagents."

**What I thought it meant:** This tells me _where_ restrictions are defined and _what_ enforces them, but not _how_. Does the Task tool refuse to spawn an agent with Edit if Edit is in `disallowedTools`? Does it spawn the agent but intercept Edit calls? Does the agent self-restrict?

**What would have helped:** Add: "When spawning a subagent, the Task tool configures the agent's runtime to disable the specified tools, preventing the agent from invoking them."

**Severity self-assessment:** Minor friction

---

### Confusion Point 8: "Phase 1.3: Dependency analysis" — Cycle detection error handling

**What I was trying to understand:** What happens if my epic has circular dependencies

**Where I got confused:** Lines 76: "Cycle detection runs during dependency analysis at Phase 1.3. If circular dependencies exist (e.g., Story 1.2 depends on 1.3, and 1.3 depends on 1.2), the orchestrator terminates with this error: `❌ Dependency Cycle Detected\n\nStory 1.2 depends on Story 1.3\nStory 1.3 depends on Story 1.2\n\nThis epic cannot be implemented until dependencies are resolved.`"

**What I thought it meant:** I understand the error message, but this is presented inline during Phase 1.3's description. It interrupts the flow without clearly signaling "this is an error case." When I first read "Cycle detection runs during..." I thought it was describing a normal step, not an abnormal termination.

**What would have helped:** Use visual structure to separate happy path from error cases. Either: (1) add a **Warning** callout box, or (2) group error cases in a subsection like "Phase 1.3 Error Cases: Circular Dependencies" or (3) move the note to line 81 where the warning already exists.

**Severity self-assessment:** Minor friction

---

### Confusion Point 9: "Phase 1.5: Initialize StoryRunner" — DryRunStoryRunner purpose

**What I was trying to understand:** What the DryRunStoryRunner actually does

**Where I got confused:** Line 78: "Select DryRunStoryRunner for `--dry-run` flag (deterministic mocks) or GitHubCLIRunner for real repos with `.github/` directory."

**What I thought it meant:** The term "deterministic mocks" is vague. Does DryRunStoryRunner mock GitHub API calls? Does it create fake branches? Does it skip implementation entirely? The word "deterministic" suggests reproducibility, but mocking _what_? I had to keep reading to infer that it probably simulates the story runner without actually touching GitHub, but I'm still not 100% certain.

**What would have helped:** Expand: "Select DryRunStoryRunner for `--dry-run` flag (simulates branch creation, PRs, and commits without calling GitHub CLI or git push) or GitHubCLIRunner for real repos..."

**Severity self-assessment:** Recovered with effort

---

### Confusion Point 10: "Phase 2.4: Code review loop" — Fresh context mechanism

**What I was trying to understand:** How "fresh context" is technically achieved for reviewers

**Where I got confused:** Lines 88: "Fresh context is achieved by spawning the reviewer via Task tool, which creates a new agent invocation with no inherited context from the orchestrator or previous reviewers."

**What I thought it meant:** This is the first time the document explains _how_ fresh context works. But I'm still unclear: Does the Task tool start a completely separate Claude API call? Is it a new thread? A new session? The phrase "new agent invocation" is jargon that assumes I know Claude Code's internal architecture.

**What would have helped:** Since the audience includes engineers who may not know Claude Code internals, add: "The Task tool starts a new, isolated agent session (separate API call) with its own context window, ensuring the reviewer has no memory of the orchestrator's decisions or previous review rounds."

**Severity self-assessment:** Minor friction

---

### Confusion Point 11: "Phase 2.7: Integration checkpoint" — Green/Yellow/Red classification criteria

**What I was trying to understand:** What determines whether integration results are Green, Yellow, or Red

**Where I got confused:** Line 91: "Results classified as Green (auto-continue), Yellow (warnings, ask user), or Red (failures, halt)."

**What I thought it meant:** This introduces a traffic-light classification system but doesn't define the criteria. What constitutes a "warning" vs. a "failure"? Is it based on test results? Build errors? Type mismatches? The reference `integration-checkpoint.md:11-156` suggests this is documented elsewhere, but I need at least a one-sentence summary to continue reading without confusion.

**What would have helped:** Add examples: "Results classified as Green (all tests pass, no type errors), Yellow (tests pass but new warnings or type widening detected, ask user), or Red (test failures or type conflicts, halt)."

**Severity self-assessment:** Recovered with effort

---

## Positive Observations

1. **Concrete file paths:** Every major component includes an actual file path (e.g., `.claude/commands/bmad-bmm-auto-epic.md`), which grounds the architecture in reality.
2. **Line number citations:** References like `bash-guard.js:31-45` help technical readers jump to source code.
3. **Command syntax examples:** The Quick Reference section provides immediately actionable commands.
4. **Status transition tables:** The Resume Reconciliation matrix (lines 154-162) is exceptionally clear and useful.

## Recommendations Summary

1. **Establish runtime context earlier:** Clarify that Auto Epic runs within Claude Code's agent runtime before diving into architecture layers.
2. **Separate happy path from error cases:** Use visual structure (warnings, callouts, or subsections) to prevent error handling from interrupting the narrative flow.
3. **Define mechanisms before protocols:** Explain _how_ hooks are executed before listing their exit codes and JSON responses. Explain _how_ fresh context works before describing its benefits.
4. **Expand terse technical phrases:** Terms like "deterministic mocks," "new agent invocation," and "results classified as Green/Yellow/Red" need brief expansions for readers without deep system knowledge.
5. **Resolve counting inconsistencies:** Clarify the hook count (9 scripts + 1 prompt-based = 10 total?) to avoid confusion.

---

**Overall Assessment:** The document contains strong technical detail and excellent concrete examples, but would benefit from more conceptual scaffolding to help readers build mental models before encountering implementation specifics. Most confusion points can be resolved with 1-2 clarifying sentences.
