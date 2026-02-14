# QA Read Report v2 — Draft v3r1

**Reader Profile:** Software engineer familiar with CLI tools and basic agent concepts (per 00-request.md)

**Read Date:** 2026-02-09

**Document Read:** 17-draft-v3r1.md (second cold read, post-revision)

---

## Overall Assessment

This revision addressed many of the major confusion points from the previous read. The document now provides clearer technical detail and better mechanical explanations. However, several areas still need clarification, particularly around hook mechanics, subagent execution context, and dependency checking logic.

---

## Confusion Points

### Confusion Point: "Overview" — When human checkpoints actually occur

**What I was trying to understand:** At what points in the workflow will I be prompted for input?

**Where I got confused:** The overview states "Human checkpoints appear at two explicit points: scope confirmation before implementation begins (Phase 1.4) and per-story completion decisions (Phase 2.6)." But then it adds a third condition: "For stories with dependents, integration validation (Phase 2.7) can trigger an additional user prompt if results are Yellow..."

**What I thought it meant:** I thought there were only two checkpoints, but then discovered there might be a third one conditionally. This makes me wonder if there are other implicit checkpoints I don't know about.

**What would have helped:** Either say "up to three checkpoints" in the opening statement, or structure it as "two mandatory checkpoints + conditional checkpoints when [conditions]." The current phrasing presents "two explicit points" as exhaustive, then contradicts itself.

**Severity self-assessment:** Recovered with effort

---

### Confusion Point: "Architecture Layers > Layer 2" — What "adding it to the active context" means

**What I was trying to understand:** How the orchestrator loads these module files.

**Where I got confused:** "The orchestrator instructs Claude to read each module file using the Read tool when entering the corresponding phase, adding it to the active context." I understand it uses the Read tool, but "adding it to the active context" is vague. Does this mean:

- The content stays in memory for the rest of the session?
- It's only available during that phase?
- Does loading one module unload another?
- Is there a context size limit I should know about?

**What I thought it meant:** I assume it means the file content is available to Claude during that phase, but I don't understand the persistence model or what happens to context as more modules are loaded.

**What would have helped:** A brief explanation of context lifecycle: "Once loaded, module content remains in Claude's context for the remainder of the session" or "Each module is loaded on-demand and remains until the phase completes" or whatever the actual behavior is.

**Severity self-assessment:** Minor friction

---

### Confusion Point: "Architecture Layers > Layer 3" — Hook execution visibility

**What I was trying to understand:** How the orchestrator knows when a hook has blocked or escalated an operation.

**Where I got confused:** "The orchestrator reads hook responses indirectly through Claude Code's tool execution results. When a hook blocks an operation, the orchestrator sees a tool execution failure with the hook's error message."

This tells me what the orchestrator sees, but not what I (the human) see. If a hook blocks a bash command:

- Do I see anything in my terminal?
- Is it logged somewhere?
- Does execution just pause with an error message?
- Can I tell which specific hook blocked it?

**What I thought it meant:** The orchestrator can see hook responses, but I'm not clear if these are visible to me or only to the orchestrator agent.

**What would have helped:** A sentence or two about observability from the human operator's perspective: "Hook blocks and escalations appear in the Claude Code output as [description]. The hook name and reason are logged to [location]."

**Severity self-assessment:** Recovered with effort

---

### Confusion Point: "Architecture Layers > Layer 3 > bash-guard.js" — Cumulative tier model

**What I was trying to understand:** What rules apply at each safety level.

**Where I got confused:** "Tiers are cumulative: strict includes high and critical checks; high includes critical checks; critical is the minimal baseline."

This explains the relationship clearly, but then the list shows:

- Critical level blocks catastrophic commands (lines 63-105)
- High level adds blocks for destructive git operations... (lines 110-215)
- Strict level adds blocks for any force push (lines 220-244)

But then: "Escalates 6 high-risk patterns for human approval (lines 249-285): git push main, npm publish..."

**What I thought it meant:** I thought escalation patterns would also be cumulative (critical has some escalations, high adds more, strict adds even more). But the phrasing suggests the 6 escalation patterns are fixed across all levels.

**What would have helped:** Clarify whether escalation patterns are also tiered, or if all 6 patterns escalate regardless of safety level. Example: "All tiers share the same 6 escalation patterns" or "Escalation patterns vary by tier: critical escalates X, high adds Y, strict adds Z."

**Severity self-assessment:** Minor friction

---

### Confusion Point: "Architecture Layers > Layer 3 > PreToolUse hooks" — pipeline-guard.cjs "warns on non-standard filenames"

**What I was trying to understand:** What constitutes a "non-standard filename" in the pipeline context.

**Where I got confused:** "warns on non-standard filenames" — this is too vague. What naming convention is expected? Is this about file extensions, numbering schemes, special characters?

**What I thought it meant:** I assume this relates to the pipeline's artifact naming conventions (like the numbered draft files I'm working with), but without knowing the expected pattern, I can't predict when this warning would fire.

**What would have helped:** Either a brief example ("e.g., files without numeric prefixes like '01-'") or a reference to where the naming standard is documented.

**Severity self-assessment:** Minor friction

---

### Confusion Point: "Architecture Layers > Layer 4 > Subagents" — Tool restriction mechanism

**What I was trying to understand:** How tool restrictions are enforced technically.

**Where I got confused:** "Tool restrictions are defined in the agent frontmatter (`disallowedTools` field). When spawning a subagent, the Task tool configures the agent's runtime to disable the specified tools, preventing the agent from invoking them."

This describes WHAT happens, but I don't understand HOW the runtime enforces this. Is it:

- A runtime check that returns an error if the agent tries to use a disabled tool?
- The tools aren't made available to the agent at all?
- There's a validation layer that rejects the tool call?

**What I thought it meant:** I think the runtime prevents the agent from calling those tools, but I don't know if this is a hard block or if the agent could theoretically try and fail.

**What would have helped:** One sentence about the enforcement mechanism: "If a subagent attempts to use a disallowed tool, the runtime returns an error and the tool call is not executed" or "Disallowed tools are not made available in the subagent's tool list."

**Severity self-assessment:** Minor friction

---

### Confusion Point: "Command Flow and Phases > Phase 1 > Step 2" — YAML frontmatter structure

**What I was trying to understand:** What story frontmatter looks like so I can understand the data model.

**Where I got confused:** "Read story files from `_bmad-output/implementation-artifacts/stories/{story_id}.md` with YAML frontmatter (id, title, depends_on, touches, risk)."

This lists the fields, but I don't know:

- Is `depends_on` a single value or a list?
- What are valid values for `risk`?
- What does `touches` represent (file paths? components?)?
- Is this frontmatter formatted as key-value pairs or something else?

**What I thought it meant:** I understand these fields exist, but without seeing an example structure, I can't visualize the data model clearly enough to understand the dependency analysis that follows.

**What would have helped:** A minimal example in a code block:

```yaml
---
id: "1.2"
title: "Implement auth middleware"
depends_on: ["1.1"]
touches: ["backend/middleware/", "shared/types/"]
risk: high
---
```

**Severity self-assessment:** Recovered with effort

---

### Confusion Point: "Command Flow and Phases > Phase 1 > Step 3" — Cycle detection timing

**What I was trying to understand:** When cycle detection happens and what the failure mode looks like.

**Where I got confused:** The text explains cycle detection with a clear error example, but the warning box at the end says "Warning: Cycle detection terminates the workflow with a fatal error." This makes me wonder:

- Does the check happen before ANY work begins (Phase 1.3)?
- Or could I get partway through an epic before discovering a cycle?
- What happens to any partial work that's been done?

**What I thought it meant:** I think cycle detection happens early (Phase 1.3 is very early), but the phrasing "terminates the workflow" made me wonder if it could happen later too.

**What would have helped:** Clarify timing explicitly: "Cycle detection runs during Phase 1.3, before any story implementation begins. If a cycle is detected, the orchestrator terminates immediately with no stories modified."

**Severity self-assessment:** Minor friction

---

### Confusion Point: "Command Flow and Phases > Phase 2 > Step 1" — Dependency check override semantics

**What I was trying to understand:** What `--no-require-merged` actually does and when I'd use it.

**Where I got confused:** "Override flag `--no-require-merged` relaxes dependency checking to accept state file 'done' status for all stories, bypassing the merge-base verification for stories with dependents."

I understand it relaxes checks, but the consequences aren't clear:

- If I skip merge-base verification, could dependent stories fail to build because code isn't on the base branch?
- When would I actually want to use this flag?
- Is this dangerous or just for special workflows?

**What I thought it meant:** It skips a safety check, but I don't know if this is "skip for local testing" vs. "skip at your own risk because you know what you're doing."

**What would have helped:** A use case explanation: "Use `--no-require-merged` when implementing dependent stories on a feature branch where merging to main isn't practical, accepting the risk that dependent stories may not have access to prerequisite code."

**Severity self-assessment:** Recovered with effort

---

### Confusion Point: "Command Flow and Phases > Phase 2 > Step 2" — Coverage parsing fallback behavior

**What I was trying to understand:** What happens if coverage can't be parsed.

**Where I got confused:** "If coverage cannot be parsed (regex match fails), the orchestrator logs a warning, uses 'N/A' in the PR body, and continues without blocking the story."

This is clear about WHAT happens, but doesn't explain WHY it would fail to parse. Is this:

- An expected case for some test configurations?
- A fallback for non-Jest test runners?
- A bug that should be fixed if encountered?

**What I thought it meant:** It's a graceful degradation, but I don't know if encountering this scenario indicates a problem with my setup.

**What would have helped:** A brief explanation: "This fallback handles test runners that don't output Jest's standard 'All files' summary format, or when output is redirected in a way that changes the format."

**Severity self-assessment:** Minor friction

---

### Confusion Point: "Command Flow and Phases > Phase 2 > Step 4" — "Hard cap 5 rounds with user override"

**What I was trying to understand:** What happens when the hard cap is reached.

**Where I got confused:** "Hard cap 5 rounds with user override" — I don't understand what "with user override" means here. Does this mean:

- The system will ask me if I want to continue after 5 rounds?
- I can set a different cap value upfront?
- There's some other way to override the cap?

**What I thought it meant:** I think it means the system stops at 5 rounds and asks me to decide, but the phrasing is ambiguous.

**What would have helped:** Rephrase for clarity: "Hard cap of 5 rounds, after which the orchestrator requires user decision to continue or proceed with remaining MUST-FIX findings."

**Severity self-assessment:** Minor friction

---

### Confusion Point: "Command Flow and Phases > Phase 2 > Step 6" — "Merge main into feature branch"

**What I was trying to understand:** Why this merge happens and what it achieves.

**Where I got confused:** Step 2.6 says "Merge main into feature branch, re-run tests, update PR description with review summary, mark story done."

I don't understand the purpose of merging main into the feature branch at this point:

- Is this to ensure the feature branch has the latest main changes before marking done?
- Does this happen before or after PR creation?
- What if the merge has conflicts?

**What I thought it meant:** It keeps the feature branch up to date with main, but the sequencing relative to PR creation (step 2.5) is unclear. Does the PR already exist when this merge happens?

**What would have helped:** Explain the rationale and conflict handling: "Merge main into the feature branch to ensure the PR is up-to-date with the latest base branch changes. If conflicts occur, the orchestrator pauses and prompts the user to resolve them manually."

**Severity self-assessment:** Recovered with effort

---

### Confusion Point: "Command Flow and Phases > Phase 2 > Step 7" — Integration checkpoint color classification

**What I was trying to understand:** Exactly what qualifies as Yellow vs. Red.

**Where I got confused:** "Results classified as Green (all tests pass, no type errors, auto-continue), Yellow (tests pass but new warnings or type widening detected, ask user), or Red (test failures or type conflicts, halt)."

This gives examples but not exhaustive criteria. Specifically:

- What counts as "type widening"?
- Are there other Yellow conditions besides warnings and type widening?
- Are there other Red conditions besides test failures and type conflicts?
- What about ESLint errors vs. warnings?

**What I thought it meant:** I understand the general severity model, but the boundary cases aren't clear. For example, is a TypeScript error Red or Yellow?

**What would have helped:** More explicit criteria:

- Green: all quality gates pass (tests, lint, type check) with no new warnings
- Yellow: quality gates pass but with new warnings (ESLint, TypeScript "as any" usage, etc.)
- Red: any quality gate fails (test failures, TypeScript errors, lint errors in strict mode)

**Severity self-assessment:** Recovered with effort

---

### Confusion Point: "Subagent Orchestration > Reviewer Spawning" — "Fresh context isolation"

**What I was trying to understand:** How fresh context is technically achieved.

**Where I got confused:** "Fresh context isolation ensures adversarial review. The reviewer has NO knowledge of implementation decisions or previous review rounds."

I understand the GOAL (adversarial review), but not the MECHANISM. Does "fresh context" mean:

- The reviewer agent starts a completely new Claude API session?
- The reviewer's context window doesn't include any of the orchestrator's conversation history?
- The reviewer only sees the specific files/diffs passed to it?

**What I thought it meant:** I think it means the reviewer doesn't have the orchestrator's memory, but I don't know if this is enforced by the Task tool or by some other isolation mechanism.

**What would have helped:** Earlier in the document (Layer 4 or here), explain exactly what "fresh context" means technically: "The Task tool starts a new, isolated agent session (separate API call) with its own context window, ensuring the reviewer has no memory of the orchestrator's decisions."

**Severity self-assessment:** Recovered with effort

---

### Confusion Point: "Subagent Orchestration > Fixer Spawning" — "Stage and commit with descriptive messages"

**What I was trying to understand:** Whether the fixer creates one commit or multiple commits.

**Where I got confused:** Step 4 says "Stage and commit with descriptive messages: `fix: address code review round {N} - {description}`" but step 5 says "Validate no secrets introduced before each commit."

The phrase "each commit" implies multiple commits, but step 4's singular message format suggests one commit per round.

**What I thought it meant:** I think the fixer creates one commit per round, addressing all findings in that single commit, but "before each commit" made me second-guess this interpretation.

**What would have helped:** Clarify the commit strategy: "The fixer creates a single commit per round addressing all MUST-FIX findings, using the format: `fix: address code review round {N} - {description}`."

**Severity self-assessment:** Minor friction

---

### Confusion Point: "State Management and Resume > Resume Reconciliation" — "PR closed" vs. "Branch deleted" distinction

**What I was trying to understand:** Why "PR closed" and "Branch deleted" have different outcomes.

**Where I got confused:** The reconciliation table shows:

- `done + PR closed → Keep done (state file wins)`
- `in-progress + Branch deleted → Mark blocked (no recovery)`

Why does a closed PR for a "done" story get to keep done status, but a deleted branch for an "in-progress" story becomes blocked? Both seem like situations where the GitHub state suggests abandonment.

**What I thought it meant:** I think the distinction is that "done" stories already completed successfully (so closing the PR is just cleanup), while "in-progress" stories weren't finished (so branch deletion means lost work). But this logic isn't explicitly stated.

**What would have helped:** Add a brief rationale: "Done stories already completed implementation, so PR closure is treated as post-completion cleanup. In-progress stories with deleted branches have lost their work and cannot recover without recreating the implementation."

**Severity self-assessment:** Minor friction

---

### Confusion Point: "State Management and Resume > Resume Reconciliation" — "manual PR" scenario

**What I was trying to understand:** What "Treat as review (manual PR)" means in the pending+PR exists case.

**Where I got confused:** The table shows: `pending + PR exists → Treat as review (manual PR)`.

I don't understand what happens operationally:

- Does the orchestrator skip implementation and just run review on the existing PR?
- Does it validate that the PR meets story criteria?
- Does it assume I implemented the story manually and pick up from review?

**What I thought it meant:** I think it means "if someone manually created a PR before Auto Epic ran, treat the story as already implemented and move to review phase," but I'm not confident.

**What would have helped:** Expand on the action: "Treat as review (manual PR) — skip implementation phase and proceed directly to code review loop, assuming the PR was created manually or by a previous run."

**Severity self-assessment:** Recovered with effort

---

### Confusion Point: "Quick Reference > Flags" — Missing flag documentation

**What I was trying to understand:** All available flags and their purposes.

**Where I got confused:** The flags table only lists 5 flags, but the document mentions `CLAUDE_SAFETY_LEVEL` (for bash-guard), which seems like it might be an environment variable rather than a flag. Are there other environment variables or flags I should know about?

**What I thought it meant:** The table shows command-line flags specifically, but I don't know if there are other configuration mechanisms (env vars, config files) that affect behavior.

**What would have helped:** Either clarify that the table is only for CLI flags and note where env vars are documented, or expand the table to include environment variables as a separate section.

**Severity self-assessment:** Minor friction

---

## Summary Metrics

- **Total confusion points identified:** 18
- **Could not proceed:** 0
- **Recovered with effort:** 7
- **Minor friction:** 11

## Positive Observations

1. **Layer 3 hook mechanics** — The addition of the "Hook execution mechanics" section significantly improved understanding of how hooks work technically (exit codes, JSON responses, interception). This was a major gap in the previous draft.

2. **Dependency check logic** — The pre-implementation dependency check (2.1) now includes clear rationale for why stories with dependents require merged PRs. This wasn't clear before.

3. **Coverage parsing fallback** — Explicitly documenting the coverage parsing fallback behavior (2.2) shows attention to edge cases.

4. **Reconciliation matrix** — The state file reconciliation table is very helpful for understanding resume behavior.

5. **Commit SHA tracking** — Adding explicit mention of when and how commit SHAs are recorded improves understanding of the data model.

6. **Cycle detection error example** — The specific error message example helps me understand what I'd see if I hit a dependency cycle.

## Remaining High-Priority Improvements

1. **Hook observability** — Explain what the human operator sees when hooks fire, block, or escalate.

2. **YAML frontmatter example** — Add a concrete example of story file frontmatter structure.

3. **Fresh context mechanism** — Explain how fresh context is technically enforced (likely via Task tool creating new sessions).

4. **Dependency check override** — Provide use case rationale for `--no-require-merged` flag.

5. **Integration checkpoint classification** — Make Green/Yellow/Red criteria exhaustive rather than example-based.

6. **Human checkpoint count** — Reconcile "two explicit points" with the conditional third checkpoint for integration validation.

---

**QA Reader:** AI Agent simulating software engineer reader
**Document Version:** v3r1 (second cold read)
